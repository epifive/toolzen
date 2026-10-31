/**
 * Unix file permission helpers for the chmod calculator. A mode is a number
 * from 0 to 0o7777: three special bits followed by owner, group and others.
 */

export type PermissionClass = "owner" | "group" | "others";
export type PermissionBit = "read" | "write" | "execute";

export const PERMISSION_CLASSES: ReadonlyArray<{ key: PermissionClass; label: string; letter: "u" | "g" | "o"; shift: number }> = [
  { key: "owner", label: "Owner", letter: "u", shift: 6 },
  { key: "group", label: "Group", letter: "g", shift: 3 },
  { key: "others", label: "Others", letter: "o", shift: 0 },
];

export const PERMISSION_BITS: ReadonlyArray<{ key: PermissionBit; label: string; char: "r" | "w" | "x"; value: number }> = [
  { key: "read", label: "Read", char: "r", value: 4 },
  { key: "write", label: "Write", char: "w", value: 2 },
  { key: "execute", label: "Execute", char: "x", value: 1 },
];

export const SETUID = 0o4000;
export const SETGID = 0o2000;
export const STICKY = 0o1000;

export const SPECIAL_BITS: ReadonlyArray<{ value: number; label: string; hint: string }> = [
  { value: SETUID, label: "Set user ID (setuid)", hint: "Executables run with the permissions of the file's owner." },
  { value: SETGID, label: "Set group ID (setgid)", hint: "Executables run as the file's group; new files in a directory inherit its group." },
  { value: STICKY, label: "Sticky bit", hint: "In a shared directory, only a file's owner can delete or rename it." },
];

export const MAX_MODE = 0o7777;

export function hasBit(mode: number, cls: PermissionClass, bit: PermissionBit): boolean {
  return (mode & bitMask(cls, bit)) !== 0;
}

export function toggleBit(mode: number, mask: number, on: boolean): number {
  return on ? mode | mask : mode & ~mask & MAX_MODE;
}

export function bitMask(cls: PermissionClass, bit: PermissionBit): number {
  const shift = PERMISSION_CLASSES.find((c) => c.key === cls)?.shift ?? 0;
  const value = PERMISSION_BITS.find((b) => b.key === bit)?.value ?? 0;
  return value << shift;
}

/** "755", or "4755" when a special bit is set. */
export function modeToOctal(mode: number): string {
  const octal = (mode & MAX_MODE).toString(8);
  return mode & 0o7000 ? octal.padStart(4, "0") : octal.padStart(3, "0");
}

/** "rwxr-xr-x", with s/S and t/T for the special bits, like `ls -l`. */
export function modeToSymbolic(mode: number): string {
  const special = [SETUID, SETGID, STICKY];
  const specialChar = ["s", "s", "t"];
  return PERMISSION_CLASSES.map((cls, i) => {
    const bits = (mode >> cls.shift) & 7;
    const r = bits & 4 ? "r" : "-";
    const w = bits & 2 ? "w" : "-";
    const executable = (bits & 1) !== 0;
    let x = executable ? "x" : "-";
    if (mode & special[i]) x = executable ? specialChar[i] : specialChar[i].toUpperCase();
    return r + w + x;
  }).join("");
}

/** Parse 1–4 octal digits, as chmod does ("7" means 007). Returns null when invalid. */
export function parseOctalMode(input: string): number | null {
  const text = input.trim().replace(/^0o/i, "");
  if (!/^[0-7]{1,4}$/.test(text)) return null;
  return parseInt(text, 8);
}

/**
 * Parse "rwxr-xr-x" (9 characters) or an `ls -l` string such as "-rwsr-xr-x" or
 * "drwxrwxrwt" (10 characters). Returns null when invalid.
 */
export function parseSymbolicMode(input: string): number | null {
  // ls -l may append "." (SELinux context), "+" (ACL) or "@" (macOS extended attributes).
  let text = input.trim().replace(/[.+@]$/, "");
  if (text.length === 10) {
    if (!/^[-dlcbps]/.test(text)) return null;
    text = text.slice(1);
  }
  if (!/^([r-][w-][xsS-]){2}[r-][w-][xtT-]$/.test(text)) return null;
  let mode = 0;
  const special = [SETUID, SETGID, STICKY];
  PERMISSION_CLASSES.forEach((cls, i) => {
    const chunk = text.slice(i * 3, i * 3 + 3);
    let bits = 0;
    if (chunk[0] === "r") bits |= 4;
    if (chunk[1] === "w") bits |= 2;
    if (/[xst]/.test(chunk[2])) bits |= 1;
    if (/[sStT]/.test(chunk[2])) mode |= special[i];
    mode |= bits << cls.shift;
  });
  return mode;
}

/** Symbolic chmod argument, e.g. "u=rwx,g=rx,o=rx" or "u=rwx,g=rx,o=rx,u+s". */
export function modeToChmodSymbolic(mode: number): string {
  const classes = PERMISSION_CLASSES.map((cls) => {
    const bits = (mode >> cls.shift) & 7;
    const letters = PERMISSION_BITS.filter((b) => bits & b.value)
      .map((b) => b.char)
      .join("");
    return `${cls.letter}=${letters}`;
  });
  if (mode & SETUID) classes.push("u+s");
  if (mode & SETGID) classes.push("g+s");
  if (mode & STICKY) classes.push("+t");
  return classes.join(",");
}

/** One sentence per class, e.g. "Owner can read, write and execute." */
export function describeMode(mode: number): string[] {
  const lines = PERMISSION_CLASSES.map((cls) => {
    const bits = (mode >> cls.shift) & 7;
    const verbs = PERMISSION_BITS.filter((b) => bits & b.value).map((b) => b.label.toLowerCase());
    if (!verbs.length) return `${cls.label} ${cls.key === "others" ? "have" : "has"} no permissions.`;
    const list = verbs.length === 1 ? verbs[0] : `${verbs.slice(0, -1).join(", ")} and ${verbs[verbs.length - 1]}`;
    return `${cls.label} can ${list}.`;
  });
  for (const special of SPECIAL_BITS) if (mode & special.value) lines.push(`${special.label}: ${special.hint}`);
  return lines;
}
