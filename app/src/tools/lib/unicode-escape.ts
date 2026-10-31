/**
 * Text ↔ Unicode escape sequences in the formats used by JavaScript, HTML,
 * CSS and Python, plus U+ code point notation.
 */

export type EscapeFormat = "js" | "js-es6" | "html-hex" | "html-dec" | "css" | "python" | "codepoint";

export const ESCAPE_FORMATS: Array<{ value: EscapeFormat; label: string; example: string }> = [
  { value: "js", label: "JavaScript / JSON (\\uXXXX)", example: "\\u00E9 \\uD83D\\uDE00" },
  { value: "js-es6", label: "JavaScript ES6 (\\u{…})", example: "\\u{E9} \\u{1F600}" },
  { value: "html-hex", label: "HTML hex (&#x…;)", example: "&#xE9; &#x1F600;" },
  { value: "html-dec", label: "HTML decimal (&#…;)", example: "&#233; &#128512;" },
  { value: "css", label: "CSS (\\XXXX)", example: "\\E9 \\1F600" },
  { value: "python", label: "Python (\\u / \\U)", example: "\\u00e9 \\U0001f600" },
  { value: "codepoint", label: "Code points (U+XXXX)", example: "U+00E9 U+1F600" },
];

export interface EscapeOptions {
  /** Escape ASCII characters too, not only non-ASCII ones. */
  escapeAscii: boolean;
  uppercase: boolean;
}

const BACKSLASH = String.fromCharCode(92);

function hex(value: number, width: number, uppercase: boolean): string {
  const digits = value.toString(16).padStart(width, "0");
  return uppercase ? digits.toUpperCase() : digits;
}

function escapeOne(char: string, format: EscapeFormat, next: string, uppercase: boolean): string {
  const code = char.codePointAt(0) ?? 0;
  switch (format) {
    case "js":
      return Array.from({ length: char.length }, (_, i) => `${BACKSLASH}u${hex(char.charCodeAt(i), 4, uppercase)}`).join("");
    case "js-es6":
      return `${BACKSLASH}u{${hex(code, 1, uppercase)}}`;
    case "html-hex":
      return `&#x${hex(code, 1, uppercase)};`;
    case "html-dec":
      return `&#${code};`;
    case "css":
      // A space ends the escape when the next character could be read as part of it.
      return BACKSLASH + hex(code, 1, uppercase) + (/^[0-9a-fA-F\s]/.test(next) ? " " : "");
    case "python":
      return code > 0xffff ? `${BACKSLASH}U${hex(code, 8, uppercase)}` : `${BACKSLASH}u${hex(code, 4, uppercase)}`;
    case "codepoint":
      return `U+${hex(code, 4, true)}`;
  }
}

/** Characters that must be escaped even in "non-ASCII only" mode, so the result decodes back exactly. */
function mustEscape(char: string, format: EscapeFormat): string | null {
  if (format.startsWith("html")) return char === "&" ? "&amp;" : null;
  if (format === "codepoint") return null;
  return char === BACKSLASH ? BACKSLASH + BACKSLASH : null;
}

export function escapeText(text: string, format: EscapeFormat, { escapeAscii, uppercase }: EscapeOptions): string {
  const chars = Array.from(text);
  if (format === "codepoint") return chars.map((c) => escapeOne(c, format, "", uppercase)).join(" ");
  return chars
    .map((char, i) => {
      const code = char.codePointAt(0) ?? 0;
      if (code < 0x80 && !escapeAscii) return mustEscape(char, format) ?? char;
      return escapeOne(char, format, chars[i + 1] ?? "", uppercase);
    })
    .join("");
}

const SIMPLE_ESCAPES: Record<string, string> = {
  n: "\n",
  r: "\r",
  t: "\t",
  v: "\v",
  "0": "\0",
  "'": "'",
  '"': '"',
  [BACKSLASH]: BACKSLASH,
};

const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

const ESCAPE_PATTERN = new RegExp(
  [
    String.raw`\\u\{([0-9a-fA-F]{1,6})\}`,
    String.raw`\\u([0-9a-fA-F]{4})`,
    String.raw`\\U([0-9a-fA-F]{8})`,
    String.raw`\\x([0-9a-fA-F]{2})`,
    String.raw`&#[xX]([0-9a-fA-F]{1,6});`,
    String.raw`&#([0-9]{1,7});`,
    String.raw`U\+([0-9a-fA-F]{4,6}) ?`,
    String.raw`\\([0-9a-fA-F]{1,6})[ \t\n]?`,
    String.raw`\\([nrtv0'"\\])`,
    String.raw`&(amp|lt|gt|quot|apos);`,
  ].join("|"),
  "g",
);

function fromCode(code: number, original: string): string {
  return code <= 0x10ffff ? String.fromCodePoint(code) : original;
}

/**
 * Decode every supported escape format at once. \uXXXX surrogate pairs are
 * joined back into one character; unknown sequences are left as they are.
 */
export function unescapeText(text: string): string {
  return text.replace(ESCAPE_PATTERN, (match: string, ...groups: Array<string | undefined>) => {
    const [es6, js, py, x, htmlHex, htmlDec, uPlus, css, simple, named] = groups;
    if (js) return String.fromCharCode(parseInt(js, 16));
    const hexValue = es6 ?? py ?? x ?? htmlHex ?? uPlus ?? css;
    if (hexValue) return fromCode(parseInt(hexValue, 16), match);
    if (htmlDec) return fromCode(parseInt(htmlDec, 10), match);
    if (simple) return SIMPLE_ESCAPES[simple] ?? simple;
    if (named) return NAMED_ENTITIES[named] ?? match;
    return match;
  });
}

/** Count of escape sequences in the text, used to tell the visitor whether anything was decoded. */
export function countEscapes(text: string): number {
  return text.match(ESCAPE_PATTERN)?.length ?? 0;
}
