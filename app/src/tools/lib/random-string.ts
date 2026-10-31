/**
 * Cryptographically secure random strings. Every character is chosen with
 * crypto.getRandomValues and rejection sampling, so there is no modulo bias.
 */

import { secureRandomInt } from "./seo";

export const RANDOM_CHARSETS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  digits: "0123456789",
  symbols: "!#$%&()*+,-./:;<=>?@[]^_{|}~",
} as const;

export type RandomCharset = keyof typeof RANDOM_CHARSETS;

/** Characters that are easy to confuse with each other when read or typed. */
export const SIMILAR_CHARACTERS = "0OoIl1|";

export interface RandomStringOptions {
  length: number;
  sets: Record<RandomCharset, boolean>;
  /** Extra characters to include, e.g. "äöü" or "-_". */
  custom: string;
  excludeSimilar: boolean;
  /** Use at least one character from every selected group. */
  everyGroup: boolean;
}

function unique(chars: string[]): string[] {
  return [...new Set(chars)];
}

/** The character groups in use after exclusions, each without duplicates. Custom characters form their own group. */
export function characterGroups(options: Pick<RandomStringOptions, "sets" | "custom" | "excludeSimilar">): string[][] {
  const allowed = (ch: string) => !(options.excludeSimilar && SIMILAR_CHARACTERS.includes(ch));
  const groups = (Object.keys(RANDOM_CHARSETS) as RandomCharset[])
    .filter((name) => options.sets[name])
    .map((name) => [...RANDOM_CHARSETS[name]].filter(allowed));
  // Custom characters are split by code point so emoji and accented letters stay whole.
  groups.push([...options.custom].filter((ch) => allowed(ch) && ch.trim() !== ""));
  return groups.filter((group) => group.length > 0);
}

/** All distinct characters a string can contain. */
export function alphabetOf(groups: string[][]): string[] {
  return unique(groups.flat());
}

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function randomString(groups: string[][], length: number, everyGroup: boolean): string {
  const alphabet = alphabetOf(groups);
  if (!alphabet.length || length < 1) return "";
  const chars = everyGroup ? groups.slice(0, length).map((group) => group[secureRandomInt(group.length)]) : [];
  while (chars.length < length) chars.push(alphabet[secureRandomInt(alphabet.length)]);
  return (everyGroup ? shuffle(chars) : chars).join("");
}

/** Entropy in bits of a string drawn uniformly from `alphabetSize` characters. */
export function entropyBits(alphabetSize: number, length: number): number {
  return alphabetSize > 1 ? length * Math.log2(alphabetSize) : 0;
}
