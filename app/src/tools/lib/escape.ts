/**
 * Escape and unescape text for common string formats: JSON, JavaScript, XML,
 * CSV, SQL and regular expressions. HTML uses the entity helpers in dev.ts.
 * Plain TypeScript with no DOM dependency.
 */

const BACKSLASH = "\\";

function hex(code: number, width: number): string {
  return code.toString(16).toUpperCase().padStart(width, "0");
}

/** A four-digit UTF-16 escape (backslash, "u", hex code), built without writing the sequence literally. */
function unicodeEscape(code: number): string {
  return `${BACKSLASH}u${hex(code, 4)}`;
}

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/** True when the UTF-16 unit at `i` is half of a surrogate pair that is not complete. */
function isLoneSurrogate(text: string, i: number): boolean {
  const code = text.charCodeAt(i);
  if (isHighSurrogate(code)) return !isLowSurrogate(text.charCodeAt(i + 1));
  if (isLowSurrogate(code)) return !isHighSurrogate(text.charCodeAt(i - 1));
  return false;
}

/** Error with the 1-based character position where unescaping failed. */
export class UnescapeError extends Error {
  readonly position: number;

  constructor(message: string, index: number) {
    super(`${message} at position ${index + 1}.`);
    this.name = "UnescapeError";
    this.position = index + 1;
  }
}

/* ───────────────────────── JSON ───────────────────────── */

const JSON_SHORT: Record<number, string> = { 8: "b", 9: "t", 10: "n", 12: "f", 13: "r", 34: '"', 92: BACKSLASH };

/** Escape text for the inside of a JSON string (without the surrounding quotes). */
export function escapeJsonString(text: string, asciiOnly = false): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const short = JSON_SHORT[code];
    if (short) out += BACKSLASH + short;
    else if (code < 0x20 || isLoneSurrogate(text, i) || (asciiOnly && code > 0x7e)) out += unicodeEscape(code);
    else out += text[i];
  }
  return out;
}

const JSON_UNESCAPE: Record<string, string> = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };

function readHex(text: string, start: number, length: number, escapeStart: number): number {
  const digits = text.slice(start, start + length);
  if (digits.length !== length || !/^[0-9a-fA-F]+$/.test(digits)) {
    throw new UnescapeError(`Expected ${length} hexadecimal digits after ${text.slice(escapeStart, start)}`, escapeStart);
  }
  return parseInt(digits, 16);
}

/** Decode the escapes of a JSON string. A complete "quoted" JSON string literal is also accepted. */
export function unescapeJsonString(text: string): string {
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed === "string") return parsed;
    } catch {
      // Not a complete literal; decode the content as it is.
    }
  }
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== BACKSLASH) {
      out += ch;
      continue;
    }
    const next = text[i + 1];
    if (next === undefined) throw new UnescapeError("Unfinished escape sequence", i);
    if (next === "u") {
      out += String.fromCharCode(readHex(text, i + 2, 4, i));
      i += 5;
    } else if (next in JSON_UNESCAPE) {
      out += JSON_UNESCAPE[next];
      i += 1;
    } else {
      throw new UnescapeError(`"${BACKSLASH}${next}" is not a valid JSON escape`, i);
    }
  }
  return out;
}

/* ───────────────────────── JavaScript ───────────────────────── */

export type JsQuote = '"' | "'" | "`";

const JS_SHORT: Record<number, string> = { 8: "b", 9: "t", 10: "n", 11: "v", 12: "f", 13: "r", 92: BACKSLASH };

/** Escape text for a JavaScript string literal delimited by `quote`. */
export function escapeJsString(text: string, quote: JsQuote, asciiOnly = false): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const code = text.charCodeAt(i);
    const short = JS_SHORT[code];
    if (short) out += BACKSLASH + short;
    else if (ch === quote) out += BACKSLASH + ch;
    else if (quote === "`" && ch === "$" && text[i + 1] === "{") out += BACKSLASH + ch;
    else if (code === 0) out += /[0-9]/.test(text[i + 1] ?? "") ? `${BACKSLASH}x00` : `${BACKSLASH}0`;
    else if (code < 0x20 || code === 0x7f) out += `${BACKSLASH}x${hex(code, 2)}`;
    else if (code === 0x2028 || code === 0x2029 || isLoneSurrogate(text, i) || (asciiOnly && code > 0x7e)) {
      out += unicodeEscape(code);
    } else out += ch;
  }
  return out;
}

const JS_UNESCAPE: Record<string, string> = { b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v" };

/** Decode the escapes of a JavaScript string literal (without its quotes). */
export function unescapeJsString(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== BACKSLASH) {
      out += ch;
      continue;
    }
    const next = text[i + 1];
    if (next === undefined) throw new UnescapeError("Unfinished escape sequence", i);
    if (next in JS_UNESCAPE) {
      out += JS_UNESCAPE[next];
      i += 1;
    } else if (next === "x") {
      out += String.fromCharCode(readHex(text, i + 2, 2, i));
      i += 3;
    } else if (next === "u" && text[i + 2] === "{") {
      const close = text.indexOf("}", i + 3);
      const digits = close < 0 ? "" : text.slice(i + 3, close);
      const code = /^[0-9a-fA-F]{1,6}$/.test(digits) ? parseInt(digits, 16) : -1;
      if (code < 0 || code > 0x10ffff) throw new UnescapeError(`Invalid code point escape "${text.slice(i, close < 0 ? i + 3 : close + 1)}"`, i);
      out += String.fromCodePoint(code);
      i = close;
    } else if (next === "u") {
      out += String.fromCharCode(readHex(text, i + 2, 4, i));
      i += 5;
    } else if (next === "0" && !/[0-9]/.test(text[i + 2] ?? "")) {
      out += "\0";
      i += 1;
    } else if (/[0-7]/.test(next)) {
      throw new UnescapeError(`Octal escape "${BACKSLASH}${next}" is not allowed in modern JavaScript; use ${BACKSLASH}x or ${BACKSLASH}u instead`, i);
    } else if (next === "\r") {
      // Line continuation: the backslash and the line break are removed.
      i += text[i + 2] === "\n" ? 2 : 1;
    } else if (next === "\n" || next.charCodeAt(0) === 0x2028 || next.charCodeAt(0) === 0x2029) {
      i += 1;
    } else {
      // Any other escaped character stands for itself (\' \" \` \\ \$ …).
      out += next;
      i += 1;
    }
  }
  return out;
}

/* ───────────────────────── XML ───────────────────────── */

const XML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
const XML_NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Escape the five XML special characters. */
export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => XML_ESCAPES[ch]);
}

/** Decode the five predefined XML entities and numeric character references. */
export function unescapeXml(text: string): string {
  return text.replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|(amp|lt|gt|quot|apos));/g, (entity, dec?: string, hexDigits?: string, name?: string) => {
    if (name) return XML_NAMED[name];
    const code = dec ? parseInt(dec, 10) : parseInt(hexDigits ?? "", 16);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });
}

/* ───────────────────────── CSV ───────────────────────── */

/** Quote a CSV field when needed (or always), doubling any quotes inside it. */
export function escapeCsvField(text: string, delimiter: string, alwaysQuote: boolean): string {
  const needsQuotes = alwaysQuote || /["\r\n]/.test(text) || text.includes(delimiter) || text !== text.trim();
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Remove the quotes around a CSV field and undouble the quotes inside it. */
export function unescapeCsvField(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('"')) return text;
  if (trimmed.length < 2 || !trimmed.endsWith('"')) throw new UnescapeError("The quoted field has no closing quote", text.indexOf('"'));
  const inner = trimmed.slice(1, -1);
  const stray = inner.replace(/""/g, "").indexOf('"');
  if (stray >= 0) {
    throw new UnescapeError('A quote inside a quoted field must be doubled ("")', text.indexOf('"') + 1 + inner.indexOf('"', stray));
  }
  return inner.replace(/""/g, '"');
}

/* ───────────────────────── SQL ───────────────────────── */

const MYSQL_ESCAPES: Record<number, string> = { 0: "0", 8: "b", 9: "t", 10: "n", 13: "r", 26: "Z", 34: '"', 39: "'", 92: BACKSLASH };
const MYSQL_UNESCAPE: Record<string, string> = { "0": "\0", b: "\b", t: "\t", n: "\n", r: "\r", Z: String.fromCharCode(26) };

/**
 * Escape text for a single-quoted SQL string. Standard SQL doubles quotes;
 * the MySQL style uses backslash escapes, which MySQL and MariaDB also accept.
 */
export function escapeSqlString(text: string, backslashes: boolean): string {
  if (!backslashes) return text.replace(/'/g, "''");
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const short = MYSQL_ESCAPES[text.charCodeAt(i)];
    out += short ? BACKSLASH + short : text[i];
  }
  return out;
}

export function unescapeSqlString(text: string, backslashes: boolean): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "'" && text[i + 1] === "'") {
      out += "'";
      i += 1;
    } else if (backslashes && ch === BACKSLASH) {
      const next = text[i + 1];
      if (next === undefined) throw new UnescapeError("Unfinished escape sequence", i);
      // MySQL keeps the backslash in \% and \_ so they still work in LIKE patterns.
      out += next in MYSQL_UNESCAPE ? MYSQL_UNESCAPE[next] : next === "%" || next === "_" ? BACKSLASH + next : next;
      i += 1;
    } else {
      out += ch;
    }
  }
  return out;
}

/* ───────────────────────── Regular expressions ───────────────────────── */

/** Escape every character that has a special meaning in a regular expression (and "/" for literals). */
export function escapeRegexLiteral(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

/** Remove the backslash from escaped special characters. Escapes like \d and \n are kept. */
export function unescapeRegexLiteral(text: string): string {
  return text.replace(/\\([.*+?^${}()|[\]\\/-])/g, "$1");
}
