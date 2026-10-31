/**
 * Unicode "fancy text" styles. Each style maps plain letters and digits to
 * look-alike characters from the Mathematical Alphanumeric Symbols, Enclosed
 * Alphanumerics and other Unicode blocks, or adds combining marks.
 *
 * Tables are built from code point offsets so the source stays plain ASCII.
 */

import { reverseText } from "./text";

export interface FancyStyle {
  id: string;
  name: string;
  convert: (text: string) => string;
}

type CharMap = Record<string, string>;

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";

const cp = (code: number) => String.fromCodePoint(code);

interface AlphabetSpec {
  upper?: number;
  lower?: number;
  digits?: number;
  /** Letters that live outside the main block (Unicode reused older characters). */
  exceptions?: Record<string, number>;
}

function alphabet({ upper, lower, digits, exceptions = {} }: AlphabetSpec): CharMap {
  const map: CharMap = {};
  if (upper !== undefined) Array.from(UPPER).forEach((c, i) => (map[c] = cp(upper + i)));
  if (lower !== undefined) Array.from(LOWER).forEach((c, i) => (map[c] = cp(lower + i)));
  if (digits !== undefined) Array.from(DIGITS).forEach((c, i) => (map[c] = cp(digits + i)));
  for (const [c, code] of Object.entries(exceptions)) map[c] = cp(code);
  return map;
}

/** Map from a string of source characters to a list of code points, position by position. */
function table(source: string, codes: number[]): CharMap {
  const map: CharMap = {};
  Array.from(source).forEach((c, i) => {
    if (codes[i]) map[c] = cp(codes[i]);
  });
  return map;
}

function mapChars(map: CharMap, foldCase?: "upper" | "lower"): (text: string) => string {
  return (text) =>
    Array.from(text, (c) => {
      if (map[c]) return map[c];
      const folded = foldCase === "upper" ? c.toUpperCase() : foldCase === "lower" ? c.toLowerCase() : c;
      return map[folded] ?? c;
    }).join("");
}

/** Put a combining mark after every visible character. */
function combine(mark: number): (text: string) => string {
  const m = cp(mark);
  return (text) => Array.from(text, (c) => (/\s/.test(c) ? c : c + m)).join("");
}

const BOLD_DIGITS = 0x1d7ce;
const SANS_DIGITS = 0x1d7e2;
const SANS_BOLD_DIGITS = 0x1d7ec;

const SMALL_CAPS = table(LOWER, [
  0x1d00, 0x299, 0x1d04, 0x1d05, 0x1d07, 0xa730, 0x262, 0x29c, 0x26a, 0x1d0a, 0x1d0b, 0x29f, 0x1d0d,
  0x274, 0x1d0f, 0x1d18, 0x1eb, 0x280, 0xa731, 0x1d1b, 0x1d1c, 0x1d20, 0x1d21, 0x78, 0x28f, 0x1d22,
]);

const SUPERSCRIPT = {
  ...table(LOWER, [
    0x1d43, 0x1d47, 0x1d9c, 0x1d48, 0x1d49, 0x1da0, 0x1d4d, 0x2b0, 0x2071, 0x2b2, 0x1d4f, 0x2e1, 0x1d50,
    0x207f, 0x1d52, 0x1d56, 0, 0x2b3, 0x2e2, 0x1d57, 0x1d58, 0x1d5b, 0x2b7, 0x2e3, 0x2b8, 0x1dbb,
  ]),
  ...table(DIGITS, [0x2070, 0xb9, 0xb2, 0xb3, 0x2074, 0x2075, 0x2076, 0x2077, 0x2078, 0x2079]),
  ...table("+-=()", [0x207a, 0x207b, 0x207c, 0x207d, 0x207e]),
};

const CIRCLED = {
  ...alphabet({ upper: 0x24b6, lower: 0x24d0 }),
  ...table(DIGITS, [0x24ea, 0x2460, 0x2461, 0x2462, 0x2463, 0x2464, 0x2465, 0x2466, 0x2467, 0x2468]),
};

const NEGATIVE_CIRCLED = {
  ...alphabet({ upper: 0x1f150 }),
  ...table(DIGITS, [0x24ff, 0x2776, 0x2777, 0x2778, 0x2779, 0x277a, 0x277b, 0x277c, 0x277d, 0x277e]),
};

const PARENTHESIZED = {
  ...alphabet({ lower: 0x249c }),
  ...table("123456789", [0x2474, 0x2475, 0x2476, 0x2477, 0x2478, 0x2479, 0x247a, 0x247b, 0x247c]),
};

/** Fullwidth forms cover every printable ASCII character; the space becomes an ideographic space. */
const FULLWIDTH: CharMap = { " ": cp(0x3000) };
for (let code = 0x21; code <= 0x7e; code++) FULLWIDTH[String.fromCharCode(code)] = cp(0xff01 + code - 0x21);

export const FANCY_STYLES: FancyStyle[] = [
  { id: "bold", name: "Bold", convert: mapChars(alphabet({ upper: 0x1d400, lower: 0x1d41a, digits: BOLD_DIGITS })) },
  { id: "italic", name: "Italic", convert: mapChars(alphabet({ upper: 0x1d434, lower: 0x1d44e, exceptions: { h: 0x210e } })) },
  { id: "bold-italic", name: "Bold italic", convert: mapChars(alphabet({ upper: 0x1d468, lower: 0x1d482, digits: BOLD_DIGITS })) },
  {
    id: "script",
    name: "Script",
    convert: mapChars(
      alphabet({
        upper: 0x1d49c,
        lower: 0x1d4b6,
        exceptions: {
          B: 0x212c, E: 0x2130, F: 0x2131, H: 0x210b, I: 0x2110, L: 0x2112, M: 0x2133, R: 0x211b,
          e: 0x212f, g: 0x210a, o: 0x2134,
        },
      }),
    ),
  },
  { id: "bold-script", name: "Bold script", convert: mapChars(alphabet({ upper: 0x1d4d0, lower: 0x1d4ea, digits: BOLD_DIGITS })) },
  {
    id: "fraktur",
    name: "Fraktur (gothic)",
    convert: mapChars(
      alphabet({ upper: 0x1d504, lower: 0x1d51e, exceptions: { C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128 } }),
    ),
  },
  { id: "bold-fraktur", name: "Bold fraktur", convert: mapChars(alphabet({ upper: 0x1d56c, lower: 0x1d586, digits: BOLD_DIGITS })) },
  {
    id: "double-struck",
    name: "Double-struck (outline)",
    convert: mapChars(
      alphabet({
        upper: 0x1d538,
        lower: 0x1d552,
        digits: 0x1d7d8,
        exceptions: { C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124 },
      }),
    ),
  },
  { id: "sans", name: "Sans-serif", convert: mapChars(alphabet({ upper: 0x1d5a0, lower: 0x1d5ba, digits: SANS_DIGITS })) },
  { id: "sans-bold", name: "Sans-serif bold", convert: mapChars(alphabet({ upper: 0x1d5d4, lower: 0x1d5ee, digits: SANS_BOLD_DIGITS })) },
  { id: "sans-italic", name: "Sans-serif italic", convert: mapChars(alphabet({ upper: 0x1d608, lower: 0x1d622, digits: SANS_DIGITS })) },
  {
    id: "sans-bold-italic",
    name: "Sans-serif bold italic",
    convert: mapChars(alphabet({ upper: 0x1d63c, lower: 0x1d656, digits: SANS_BOLD_DIGITS })),
  },
  { id: "monospace", name: "Monospace", convert: mapChars(alphabet({ upper: 0x1d670, lower: 0x1d68a, digits: 0x1d7f6 })) },
  { id: "fullwidth", name: "Fullwidth (vaporwave)", convert: mapChars(FULLWIDTH) },
  { id: "small-caps", name: "Small caps", convert: mapChars(SMALL_CAPS, "lower") },
  { id: "superscript", name: "Superscript (tiny)", convert: mapChars(SUPERSCRIPT, "lower") },
  { id: "circled", name: "Circled", convert: mapChars(CIRCLED) },
  { id: "bubble", name: "Bubble (filled circles)", convert: mapChars(NEGATIVE_CIRCLED, "upper") },
  { id: "squared", name: "Squared", convert: mapChars(alphabet({ upper: 0x1f130 }), "upper") },
  { id: "squared-filled", name: "Filled squares", convert: mapChars(alphabet({ upper: 0x1f170 }), "upper") },
  { id: "parenthesized", name: "Parenthesized", convert: mapChars(PARENTHESIZED, "lower") },
  { id: "upside-down", name: "Upside down", convert: (text) => reverseText(text, "upside-down") },
  { id: "strikethrough", name: "Strikethrough", convert: combine(0x336) },
  { id: "slashed", name: "Slashed", convert: combine(0x338) },
  { id: "underline", name: "Underline", convert: combine(0x332) },
  { id: "double-underline", name: "Double underline", convert: combine(0x333) },
  { id: "overline", name: "Overline", convert: combine(0x305) },
  { id: "spaced", name: "Wide spaced", convert: (text) => Array.from(text).join(" ") },
];
