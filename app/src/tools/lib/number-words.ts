/**
 * Spell numbers out in English words: plain, ordinal and currency/cheque styles,
 * in the international (million, billion) or Indian (lakh, crore) system.
 *
 * Integers are handled as BigInt so very large values stay exact.
 */

export type NumberSystem = "international" | "indian";
export type WordsFormat = "words" | "ordinal" | "currency" | "cheque";
export type LetterCase = "lower" | "sentence" | "title" | "upper";

export interface Currency {
  code: string;
  major: [singular: string, plural: string];
  minor: [singular: string, plural: string];
}

export const CURRENCIES: Currency[] = [
  { code: "USD", major: ["dollar", "dollars"], minor: ["cent", "cents"] },
  { code: "EUR", major: ["euro", "euros"], minor: ["cent", "cents"] },
  { code: "GBP", major: ["pound", "pounds"], minor: ["penny", "pence"] },
  { code: "INR", major: ["rupee", "rupees"], minor: ["paisa", "paise"] },
  { code: "AUD", major: ["Australian dollar", "Australian dollars"], minor: ["cent", "cents"] },
  { code: "CAD", major: ["Canadian dollar", "Canadian dollars"], minor: ["cent", "cents"] },
  { code: "AED", major: ["dirham", "dirhams"], minor: ["fils", "fils"] },
  { code: "SAR", major: ["riyal", "riyals"], minor: ["halala", "halalas"] },
  { code: "PKR", major: ["rupee", "rupees"], minor: ["paisa", "paise"] },
  { code: "NGN", major: ["naira", "naira"], minor: ["kobo", "kobo"] },
  { code: "ZAR", major: ["rand", "rand"], minor: ["cent", "cents"] },
  { code: "PHP", major: ["peso", "pesos"], minor: ["centavo", "centavos"] },
];

export interface WordsOptions {
  format: WordsFormat;
  system: NumberSystem;
  currency: Currency;
  /** British style: "one hundred and five". */
  useAnd: boolean;
  letterCase: LetterCase;
}

export interface ParsedNumber {
  negative: boolean;
  integer: bigint;
  /** Digits after the decimal point, exactly as typed (may be ""). */
  fraction: string;
}

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const INTERNATIONAL_SCALES = ["", "thousand", "million", "billion", "trillion", "quadrillion", "quintillion", "sextillion"];

const ZERO = BigInt(0);
const TEN = BigInt(10);
const HUNDRED = BigInt(100);
const THOUSAND = BigInt(1000);
const LAKH = BigInt(100000);
const CRORE = BigInt(10000000);

/** Largest supported magnitude (exclusive): 10^24, i.e. up to 999 sextillion. */
export const MAX_INTEGER = TEN ** BigInt(24);

/**
 * Parse a number typed by a person. Thousands separators (commas, spaces,
 * underscores and apostrophes) are ignored. Throws an Error with a readable
 * message when the input is not a number or is too large.
 */
export function parseNumberInput(input: string): ParsedNumber {
  const cleaned = input.trim().replace(/[\s,_']/g, "");
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(cleaned);
  if (!cleaned || !match || (!match[2] && !match[3])) {
    throw new Error("Enter a number such as 1234, -56.78 or 1,000,000.");
  }
  const integer = BigInt(match[2] || "0");
  if (integer >= MAX_INTEGER) {
    throw new Error("The number is too large. Numbers up to 999 sextillion (24 digits) are supported.");
  }
  const fraction = match[3] ?? "";
  const isZero = integer === ZERO && !/[1-9]/.test(fraction);
  return { negative: match[1] === "-" && !isZero, integer, fraction };
}

function underThousand(n: number, useAnd: boolean): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(`${ONES[hundreds]} hundred`);
  if (rest) {
    if (hundreds && useAnd) parts.push("and");
    if (rest < 20) parts.push(ONES[rest]);
    else parts.push(TENS[Math.floor(rest / 10)] + (rest % 10 ? `-${ONES[rest % 10]}` : ""));
  }
  return parts.join(" ");
}

function internationalWords(n: bigint, useAnd: boolean): string {
  const groups: number[] = [];
  let rest = n;
  while (rest > ZERO) {
    groups.push(Number(rest % THOUSAND));
    rest /= THOUSAND;
  }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i];
    if (!group) continue;
    // "one thousand and five": British usage adds "and" before a final group under 100.
    if (i === 0 && useAnd && group < 100 && parts.length) parts.push("and");
    parts.push(underThousand(group, useAnd) + (INTERNATIONAL_SCALES[i] ? ` ${INTERNATIONAL_SCALES[i]}` : ""));
  }
  return parts.join(" ");
}

/** Indian system: crore groups repeat, so 10^12 is "one lakh crore". */
function indianWords(n: bigint, useAnd: boolean): string {
  const parts: string[] = [];
  const crores = n / CRORE;
  let rest = n % CRORE;
  if (crores > ZERO) parts.push(`${indianWords(crores, useAnd)} crore`);
  const lakhs = rest / LAKH;
  rest %= LAKH;
  if (lakhs > ZERO) parts.push(`${underThousand(Number(lakhs), useAnd)} lakh`);
  const thousands = rest / THOUSAND;
  rest %= THOUSAND;
  if (thousands > ZERO) parts.push(`${underThousand(Number(thousands), useAnd)} thousand`);
  if (rest > ZERO) {
    if (useAnd && rest < HUNDRED && parts.length) parts.push("and");
    parts.push(underThousand(Number(rest), useAnd));
  }
  return parts.join(" ");
}

/** Cardinal words for a non-negative integer, e.g. 1205 → "one thousand two hundred five". */
export function integerToWords(n: bigint, system: NumberSystem, useAnd = false): string {
  if (n === ZERO) return ONES[0];
  return system === "indian" ? indianWords(n, useAnd) : internationalWords(n, useAnd);
}

const ORDINAL_EXCEPTIONS: Record<string, string> = {
  one: "first",
  two: "second",
  three: "third",
  five: "fifth",
  eight: "eighth",
  nine: "ninth",
  twelve: "twelfth",
};

/** Turn the last word of cardinal words into its ordinal form: "twenty-one" → "twenty-first". */
export function toOrdinalWords(words: string): string {
  return words.replace(/([a-z]+)$/, (word) => {
    if (ORDINAL_EXCEPTIONS[word]) return ORDINAL_EXCEPTIONS[word];
    if (word.endsWith("y")) return `${word.slice(0, -1)}ieth`;
    return `${word}th`;
  });
}

/** Ordinal suffix for digits: 1 → "st", 12 → "th", 23 → "rd". */
export function ordinalSuffix(n: bigint): string {
  const lastTwo = Number(n % HUNDRED);
  if (lastTwo >= 11 && lastTwo <= 13) return "th";
  return ["th", "st", "nd", "rd"][lastTwo % 10] ?? "th";
}

/** Group digits the way each system writes them: 1,234,567 or 12,34,567. */
export function formatGrouped(n: bigint, system: NumberSystem): string {
  const digits = n.toString();
  if (system === "international" || digits.length <= 3) return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const head = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${head},${digits.slice(-3)}`;
}

function applyCase(text: string, letterCase: LetterCase): string {
  switch (letterCase) {
    case "lower":
      return text;
    case "upper":
      return text.toUpperCase();
    case "sentence":
      return text.charAt(0).toUpperCase() + text.slice(1);
    case "title":
      return text.replace(/(^|[\s-])([a-z])/g, (_, sep: string, c: string) => sep + c.toUpperCase()).replace(/ And /g, " and ");
  }
}

/** Round the fraction to whole minor units (cents). Returns the possibly carried integer too. */
function toMinorUnits(integer: bigint, fraction: string): { major: bigint; minor: number } {
  const padded = (fraction + "00").slice(0, 2);
  let minor = Number(padded);
  let major = integer;
  if (fraction.length > 2 && Number(fraction[2]) >= 5) minor += 1;
  if (minor === 100) {
    minor = 0;
    major += BigInt(1);
  }
  return { major, minor };
}

/** Spell out a parsed number. Throws an Error with a readable message when the format does not apply. */
export function numberToWords(value: ParsedNumber, options: WordsOptions): string {
  const { format, system, currency, useAnd, letterCase } = options;
  const sign = value.negative ? "minus " : "";
  let text: string;

  switch (format) {
    case "words": {
      text = sign + integerToWords(value.integer, system, useAnd);
      const fraction = value.fraction.replace(/0+$/, "");
      if (fraction) text += ` point ${Array.from(fraction, (d) => ONES[Number(d)]).join(" ")}`;
      break;
    }
    case "ordinal": {
      if (value.negative || /[1-9]/.test(value.fraction)) throw new Error("Ordinals need a whole number of zero or more.");
      text = toOrdinalWords(integerToWords(value.integer, system, useAnd));
      break;
    }
    case "currency":
    case "cheque": {
      const { major, minor } = toMinorUnits(value.integer, value.fraction);
      const majorWords = integerToWords(major, system, useAnd);
      if (format === "cheque") {
        if (value.negative) throw new Error("A cheque amount cannot be negative.");
        // Cheque convention: "one hundred twenty-three and 45/100 dollars".
        text = `${majorWords} and ${String(minor).padStart(2, "0")}/100 ${currency.major[1]}`;
      } else {
        const majorName = currency.major[major === BigInt(1) ? 0 : 1];
        const minorName = currency.minor[minor === 1 ? 0 : 1];
        const minorWords = minor ? ` and ${integerToWords(BigInt(minor), system)} ${minorName}` : "";
        text = `${sign}${majorWords} ${majorName}${minorWords}`;
      }
      break;
    }
  }

  return applyCase(text, letterCase);
}
