/** Roman numeral conversion for the standard range 1–3999. */

export const ROMAN_MIN = 1;
export const ROMAN_MAX = 3999;

export interface RomanPart {
  symbol: string;
  value: number;
}

const SYMBOLS: RomanPart[] = [
  { symbol: "M", value: 1000 },
  { symbol: "CM", value: 900 },
  { symbol: "D", value: 500 },
  { symbol: "CD", value: 400 },
  { symbol: "C", value: 100 },
  { symbol: "XC", value: 90 },
  { symbol: "L", value: 50 },
  { symbol: "XL", value: 40 },
  { symbol: "X", value: 10 },
  { symbol: "IX", value: 9 },
  { symbol: "V", value: 5 },
  { symbol: "IV", value: 4 },
  { symbol: "I", value: 1 },
];

/** The symbols that make up a number, largest first: 1994 → M, CM, XC, IV. */
export function romanParts(n: number): RomanPart[] {
  if (!Number.isInteger(n) || n < ROMAN_MIN || n > ROMAN_MAX) {
    throw new Error(`Roman numerals cover whole numbers from ${ROMAN_MIN} to ${ROMAN_MAX.toLocaleString("en-US")}.`);
  }
  const parts: RomanPart[] = [];
  let rest = n;
  for (const part of SYMBOLS) {
    while (rest >= part.value) {
      parts.push(part);
      rest -= part.value;
    }
  }
  return parts;
}

export function toRoman(n: number): string {
  return romanParts(n)
    .map((p) => p.symbol)
    .join("");
}

const CANONICAL = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

/** Parse a Roman numeral, accepting only the standard (canonical) form, e.g. "IV" but not "IIII". */
export function fromRoman(input: string): number {
  const roman = input.trim().toUpperCase();
  if (!roman) throw new Error("Enter a Roman numeral such as XIV.");
  const bad = roman.match(/[^IVXLCDM]/);
  if (bad) throw new Error(`"${bad[0]}" is not a Roman numeral symbol. Use I, V, X, L, C, D and M.`);
  if (!CANONICAL.test(roman)) {
    throw new Error("This is not a valid Roman numeral. Symbols must go from largest to smallest, e.g. XIV, not IVX or XIIII.");
  }
  let value = 0;
  let i = 0;
  for (const part of SYMBOLS) {
    while (roman.startsWith(part.symbol, i)) {
      value += part.value;
      i += part.symbol.length;
    }
  }
  return value;
}
