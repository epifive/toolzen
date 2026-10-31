/**
 * Pure text helpers shared by the text tools. Everything here runs in the browser
 * (and in Node for testing); nothing touches the network.
 */

import { useEffect, useState } from "react";

/* ───────────────────────── General ───────────────────────── */

/**
 * Split text into lines. Accepts \n, \r\n and \r line endings and ignores a single
 * trailing line break, so "a\nb\n" gives ["a", "b"] and "" gives [].
 */
export function toLines(text: string): string[] {
  if (!text) return [];
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

const graphemeSegmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

/** Split text into user-perceived characters, so emoji and accented letters stay whole. */
export function graphemes(text: string): string[] {
  if (graphemeSegmenter) return Array.from(graphemeSegmenter.segment(text), (s) => s.segment);
  return Array.from(text);
}

/** Number of Unicode code points (what people usually mean by "characters"). */
export function charCount(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    // Skip the second half of surrogate pairs (emoji and other astral characters).
    const code = text.charCodeAt(i);
    if (code < 0xdc00 || code > 0xdfff) n++;
  }
  return n;
}

/** Returns `value` once it has stopped changing for `delay` milliseconds. */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function upperFirst(word: string): string {
  const [first = "", ...rest] = Array.from(word);
  return first.toUpperCase() + rest.join("");
}

/** Apply `fn` to every line while keeping the original line endings. */
function mapLines(text: string, fn: (line: string) => string): string {
  return text.replace(/[^\r\n]+/g, fn);
}

/* ───────────────────────── Case converter ───────────────────────── */

export type CaseMode =
  | "upper"
  | "lower"
  | "title"
  | "sentence"
  | "camel"
  | "pascal"
  | "snake"
  | "kebab"
  | "constant"
  | "alternating"
  | "inverse";

/** Words kept lowercase in Title Case unless they start or end the title. */
const TITLE_SMALL_WORDS = new Set([
  "a", "an", "the", "and", "but", "or", "nor", "for", "so", "yet", "as", "at", "by", "in", "of",
  "off", "on", "per", "to", "up", "via", "vs", "from", "into", "onto", "with", "over",
]);

/** Split an identifier-like string into words: "XMLHttpRequest id_2" → ["XML", "Http", "Request", "id", "2"]. */
export function splitWords(text: string): string[] {
  return (
    text
      .replace(/['’]/g, "")
      .replace(/(\p{Ll}|\p{N})(\p{Lu})/gu, "$1 $2")
      .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, "$1 $2")
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}

function titleCaseLine(line: string): string {
  const lower = line.toLowerCase();
  const words = Array.from(lower.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu));
  let out = "";
  let cursor = 0;
  words.forEach((match, i) => {
    const start = match.index ?? 0;
    const before = lower.slice(cursor, start);
    // A word right after ":", "!", "?" or "." starts a new phrase (e.g. a subtitle).
    const startsPhrase = /[:!?.—–]\s*$/.test(lower.slice(0, start));
    const word = match[0];
    const keepSmall = TITLE_SMALL_WORDS.has(word) && i !== 0 && i !== words.length - 1 && !startsPhrase;
    out += before + (keepSmall ? word : upperFirst(word));
    cursor = start + word.length;
  });
  return out + lower.slice(cursor);
}

function sentenceCase(text: string): string {
  return text.toLowerCase().replace(/(^|[.!?…]\s+|[\r\n]\s*)(\p{L})/gu, (_, prefix: string, letter: string) => {
    return prefix + letter.toUpperCase();
  });
}

function joinWords(line: string, mode: "camel" | "pascal" | "snake" | "kebab" | "constant"): string {
  const words = splitWords(line).map((w) => w.toLowerCase());
  switch (mode) {
    case "camel":
      return words.map((w, i) => (i ? upperFirst(w) : w)).join("");
    case "pascal":
      return words.map(upperFirst).join("");
    case "snake":
      return words.join("_");
    case "kebab":
      return words.join("-");
    case "constant":
      return words.join("_").toUpperCase();
  }
}

function alternatingCase(text: string): string {
  let letterIndex = 0;
  let out = "";
  for (const ch of text) {
    const isLetter = ch.toLowerCase() !== ch.toUpperCase();
    out += isLetter ? (letterIndex++ % 2 ? ch.toUpperCase() : ch.toLowerCase()) : ch;
  }
  return out;
}

function inverseCase(text: string): string {
  let out = "";
  for (const ch of text) {
    const lower = ch.toLowerCase();
    out += ch === lower ? ch.toUpperCase() : lower;
  }
  return out;
}

export function convertCase(text: string, mode: CaseMode): string {
  switch (mode) {
    case "upper":
      return text.toUpperCase();
    case "lower":
      return text.toLowerCase();
    case "title":
      return mapLines(text, titleCaseLine);
    case "sentence":
      return sentenceCase(text);
    case "camel":
    case "pascal":
    case "snake":
    case "kebab":
    case "constant":
      return mapLines(text, (line) => joinWords(line, mode));
    case "alternating":
      return alternatingCase(text);
    case "inverse":
      return inverseCase(text);
  }
}

/* ───────────────────────── Lorem ipsum ───────────────────────── */

export type LoremUnit = "paragraphs" | "sentences" | "words";

export interface LoremOptions {
  unit: LoremUnit;
  count: number;
  startWithLorem: boolean;
  html: boolean;
}

const LOREM_OPENING = ["lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit"];

const LOREM_WORDS = [
  "accumsan", "aenean", "aliquam", "aliquet", "amet", "ante", "arcu", "auctor", "augue", "blandit",
  "commodo", "condimentum", "congue", "consectetur", "consequat", "convallis", "cras", "cursus", "dapibus",
  "diam", "dictum", "dignissim", "dolor", "donec", "dui", "egestas", "eget", "eleifend", "elementum",
  "elit", "enim", "erat", "eros", "est", "etiam", "euismod", "facilisis", "faucibus", "felis",
  "fermentum", "feugiat", "fringilla", "fusce", "gravida", "habitant", "hendrerit", "iaculis", "integer",
  "interdum", "ipsum", "justo", "lacinia", "lacus", "laoreet", "lectus", "leo", "libero", "ligula",
  "lobortis", "lorem", "luctus", "maecenas", "magna", "malesuada", "massa", "mattis", "mauris", "metus",
  "mi", "molestie", "mollis", "morbi", "nam", "nec", "neque", "nibh", "nisi", "nisl", "non", "nulla",
  "nunc", "odio", "orci", "ornare", "pellentesque", "pharetra", "phasellus", "placerat", "porta",
  "porttitor", "posuere", "praesent", "pretium", "proin", "pulvinar", "purus", "quam", "quis", "quisque",
  "rhoncus", "risus", "rutrum", "sagittis", "sapien", "scelerisque", "sed", "sem", "semper", "senectus",
  "sit", "sodales", "sollicitudin", "suscipit", "suspendisse", "tellus", "tempor", "tempus", "tincidunt",
  "tortor", "tristique", "turpis", "ullamcorper", "ultrices", "ultricies", "urna", "ut", "varius", "vel",
  "velit", "venenatis", "vestibulum", "vitae", "vivamus", "viverra", "volutpat", "vulputate",
];

/** Small, fast seeded PRNG (mulberry32), so the same seed always gives the same text. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loremSentence(random: () => number, opening = false): string {
  if (opening) return "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
  const length = 6 + Math.floor(random() * 9);
  const words: string[] = [];
  for (let i = 0; i < length; i++) {
    let word = LOREM_WORDS[Math.floor(random() * LOREM_WORDS.length)];
    if (i > 2 && i < length - 2 && random() < 0.12) word += ",";
    words.push(word);
  }
  return `${upperFirst(words.join(" ").replace(/,$/, ""))}.`;
}

function loremParagraph(random: () => number, opening: boolean): string {
  const count = 4 + Math.floor(random() * 4);
  return Array.from({ length: count }, (_, i) => loremSentence(random, opening && i === 0)).join(" ");
}

export function generateLorem({ unit, count, startWithLorem, html }: LoremOptions, seed: number): string {
  const random = seededRandom(seed);
  const n = Math.min(100, Math.max(1, Math.floor(count)));
  let blocks: string[];

  if (unit === "paragraphs") {
    blocks = Array.from({ length: n }, (_, i) => loremParagraph(random, startWithLorem && i === 0));
  } else if (unit === "sentences") {
    blocks = [Array.from({ length: n }, (_, i) => loremSentence(random, startWithLorem && i === 0)).join(" ")];
  } else {
    const words = startWithLorem ? LOREM_OPENING.slice(0, n) : [];
    while (words.length < n) words.push(LOREM_WORDS[Math.floor(random() * LOREM_WORDS.length)]);
    blocks = [`${upperFirst(words.join(" "))}.`];
  }

  return html ? blocks.map((b) => `<p>${b}</p>`).join("\n") : blocks.join("\n\n");
}

/* ───────────────────────── Line tools ───────────────────────── */

function lineCollator(caseSensitive: boolean, numeric: boolean): Intl.Collator {
  return new Intl.Collator(undefined, {
    numeric,
    sensitivity: caseSensitive ? "variant" : "accent",
    caseFirst: caseSensitive ? "upper" : "false",
  });
}

export interface DedupeOptions {
  caseInsensitive: boolean;
  trim: boolean;
  removeEmpty: boolean;
  sort: boolean;
}

export interface DedupeResult {
  output: string;
  before: number;
  after: number;
  duplicates: number;
  emptyRemoved: number;
}

export function removeDuplicateLines(text: string, options: DedupeOptions): DedupeResult {
  const lines = toLines(text);
  const seen = new Set<string>();
  const kept: string[] = [];
  let duplicates = 0;
  let emptyRemoved = 0;

  for (const line of lines) {
    if (options.removeEmpty && !line.trim()) {
      emptyRemoved++;
      continue;
    }
    let key = options.trim ? line.trim() : line;
    if (options.caseInsensitive) key = key.toLowerCase();
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    kept.push(line);
  }

  if (options.sort) {
    const collator = lineCollator(!options.caseInsensitive, true);
    kept.sort(collator.compare);
  }

  return { output: kept.join("\n"), before: lines.length, after: kept.length, duplicates, emptyRemoved };
}

/** Uniform random integer in [0, max) from the Web Crypto API (no modulo bias). */
export function secureRandomInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return value % max;
}

/** Fisher–Yates shuffle driven by crypto.getRandomValues. Returns a new array. */
export function secureShuffle<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type SortMode = "az" | "za" | "natural" | "length" | "reverse" | "shuffle";

export interface SortOptions {
  caseSensitive: boolean;
  removeEmpty: boolean;
}

export function sortLines(text: string, mode: SortMode, { caseSensitive, removeEmpty }: SortOptions): string {
  let lines = toLines(text);
  if (removeEmpty) lines = lines.filter((l) => l.trim());

  switch (mode) {
    case "az":
      lines.sort(lineCollator(caseSensitive, false).compare);
      break;
    case "za":
      lines.sort(lineCollator(caseSensitive, false).compare).reverse();
      break;
    case "natural":
      lines.sort(lineCollator(caseSensitive, true).compare);
      break;
    case "length": {
      const collator = lineCollator(caseSensitive, true);
      const lengths = new Map(lines.map((l) => [l, graphemes(l).length]));
      lines.sort((a, b) => (lengths.get(a) ?? 0) - (lengths.get(b) ?? 0) || collator.compare(a, b));
      break;
    }
    case "reverse":
      lines.reverse();
      break;
    case "shuffle":
      lines = secureShuffle(lines);
      break;
  }
  return lines.join("\n");
}

/* ───────────────────────── Find and replace ───────────────────────── */

export interface FindOptions {
  matchCase: boolean;
  wholeWord: boolean;
  regex: boolean;
  replaceAll: boolean;
}

export type FindResult =
  | { ok: true; output: string; matches: number; replaced: number }
  | { ok: false; error: string };

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Turns "\n", "\t" and "\\" typed into the replacement field into real characters. */
function unescapeReplacement(text: string): string {
  return text.replace(/\\([nt\\])/g, (_, c: string) => (c === "n" ? "\n" : c === "t" ? "\t" : "\\"));
}

export function buildFindRegExp(find: string, { matchCase, wholeWord, regex }: Omit<FindOptions, "replaceAll">): RegExp {
  const flags = `g${matchCase ? "" : "i"}`;
  if (regex) return new RegExp(wholeWord ? `\\b(?:${find})\\b` : find, flags + "m");
  // Literal search: Unicode-aware word boundaries, so "café" is a whole word too.
  const pattern = escapeRegExp(find);
  return new RegExp(wholeWord ? `(?<![\\p{L}\\p{N}_])${pattern}(?![\\p{L}\\p{N}_])` : pattern, `${flags}u`);
}

function countMatches(text: string, re: RegExp): number {
  let count = 0;
  re.lastIndex = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    count++;
    if (m[0] === "") re.lastIndex++;
  }
  re.lastIndex = 0;
  return count;
}

export function findAndReplace(text: string, find: string, replacement: string, options: FindOptions): FindResult {
  if (!find) return { ok: true, output: text, matches: 0, replaced: 0 };
  let re: RegExp;
  try {
    re = buildFindRegExp(find, options);
  } catch (e) {
    const message = e instanceof Error ? e.message.replace(/^Invalid regular expression:\s*/i, "") : "";
    return { ok: false, error: `This regular expression is not valid${message ? `: ${message}` : "."}` };
  }

  const matches = countMatches(text, re);
  const target = options.replaceAll ? re : new RegExp(re.source, re.flags.replace("g", ""));
  // In literal mode "$" in the replacement must stay a dollar sign, so use a function.
  const output = options.regex
    ? text.replace(target, unescapeReplacement(replacement))
    : text.replace(target, () => replacement);
  return { ok: true, output, matches, replaced: options.replaceAll ? matches : Math.min(matches, 1) };
}

/* ───────────────────────── Slugs ───────────────────────── */

export interface SlugOptions {
  separator: "-" | "_";
  lowercase: boolean;
  removeStopWords: boolean;
  /** 0 means no limit. */
  maxLength: number;
}

const SLUG_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "how", "in", "into", "is", "it",
  "its", "of", "on", "or", "that", "the", "this", "to", "was", "what", "when", "where", "which", "who",
  "why", "will", "with",
]);

/** Letters that Unicode normalisation does not split into a base letter + accent. */
const SLUG_LETTERS: Record<string, string> = {
  ß: "ss", æ: "ae", Æ: "AE", œ: "oe", Œ: "OE", ø: "o", Ø: "O", đ: "d", Đ: "D", ð: "d", Ð: "D",
  ł: "l", Ł: "L", þ: "th", Þ: "TH", ı: "i",
};

export function toSlug(title: string, { separator, lowercase, removeStopWords, maxLength }: SlugOptions): string {
  const ascii = title
    .replace(/[ßæÆœŒøØđĐðÐłŁþÞı]/g, (ch) => SLUG_LETTERS[ch] ?? ch)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/['’]/g, "")
    .replace(/&/g, " and ");
  let words: string[] = ascii.match(/[A-Za-z0-9]+/g) ?? [];
  if (removeStopWords) {
    const filtered = words.filter((w) => !SLUG_STOP_WORDS.has(w.toLowerCase()));
    if (filtered.length) words = filtered;
  }
  let slug = words.join(separator);
  if (lowercase) slug = slug.toLowerCase();

  if (maxLength > 0 && slug.length > maxLength) {
    // Cut at the last separator that fits, so words are not chopped in half.
    const cut = slug.slice(0, maxLength + 1).lastIndexOf(separator);
    slug = cut > 0 ? slug.slice(0, cut) : slug.slice(0, maxLength);
  }
  return slug;
}

/** One slug per input line; blank lines stay blank so results line up with the input. */
export function slugLines(text: string, options: SlugOptions): string {
  return toLines(text)
    .map((line) => toSlug(line, options))
    .join("\n");
}

/* ───────────────────────── Text cleaner ───────────────────────── */

export interface CleanOptions {
  stripHtml: boolean;
  straightQuotes: boolean;
  removeEmoji: boolean;
  removeNonAscii: boolean;
  removeNumbers: boolean;
  removePunctuation: boolean;
  trimLines: boolean;
  collapseSpaces: boolean;
  removeEmptyLines: boolean;
  removeLineBreaks: boolean;
}

const BLOCK_TAGS = "p,div,li,tr,h1,h2,h3,h4,h5,h6,section,article,header,footer,blockquote,pre,ul,ol,table,dt,dd";

/**
 * Plain text of an HTML fragment. Uses DOMParser (scripts never run) and keeps
 * paragraph and line breaks; falls back to stripping tags outside the browser.
 */
export function htmlToText(html: string): string {
  if (typeof DOMParser === "undefined") return html.replace(/<[^>]*>/g, "");
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,noscript,template").forEach((el) => el.remove());
  doc.querySelectorAll("br").forEach((el) => el.replaceWith("\n"));
  doc.querySelectorAll(BLOCK_TAGS).forEach((el) => el.append("\n"));
  return (doc.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").replace(/^\n+|\n+$/g, "");
}

/** Text-style symbols that are technically pictographic but rarely meant as emoji. */
const TEXT_SYMBOLS = "©®‼⁉™ℹ";
const PICTOGRAPH = String.raw`(?:\p{Extended_Pictographic}\u{FE0F}|(?![${TEXT_SYMBOLS}])\p{Extended_Pictographic})\p{Emoji_Modifier}?`;
/** Emoji including skin tones, flags, keycaps, tag sequences and ZWJ families. */
const EMOJI_RE = new RegExp(
  String.raw`[#*0-9]\u{FE0F}?\u{20E3}|\p{Regional_Indicator}+|\p{Emoji_Modifier}|${PICTOGRAPH}[\u{E0020}-\u{E007F}]*(?:\u{200D}${PICTOGRAPH})*`,
  "gu",
);

export function removeEmoji(text: string): string {
  return text.replace(EMOJI_RE, "");
}

export function cleanText(text: string, o: CleanOptions): string {
  let out = text.replace(/\r\n?/g, "\n");
  if (o.stripHtml) out = htmlToText(out);
  if (o.straightQuotes) out = out.replace(/[‘’‚‛′]/g, "'").replace(/[“”„‟″]/g, '"');
  if (o.removeEmoji) out = removeEmoji(out);
  if (o.removeNonAscii) out = out.normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^\t\n\x20-\x7E]/g, "");
  if (o.removeNumbers) out = out.replace(/\p{N}/gu, "");
  if (o.removePunctuation) out = out.replace(/\p{P}/gu, "");
  if (o.collapseSpaces) out = out.replace(/[^\S\n]{2,}/g, " ");
  if (o.trimLines) out = out.split("\n").map((l) => l.trim()).join("\n");
  if (o.removeEmptyLines) out = out.split("\n").filter((l) => l.trim()).join("\n");
  if (o.removeLineBreaks) out = out.replace(/[^\S\n]*\n+[^\S\n]*/g, " ").trim();
  return out;
}

/* ───────────────────────── Reverse text ───────────────────────── */

export type ReverseMode = "characters" | "words" | "each-word" | "lines" | "upside-down";

const UPSIDE_DOWN: Record<string, string> = {
  a: "ɐ", b: "q", c: "ɔ", d: "p", e: "ǝ", f: "ɟ", g: "ƃ", h: "ɥ", i: "ᴉ", j: "ɾ", k: "ʞ", l: "l", m: "ɯ",
  n: "u", o: "o", p: "d", q: "b", r: "ɹ", s: "s", t: "ʇ", u: "n", v: "ʌ", w: "ʍ", x: "x", y: "ʎ", z: "z",
  A: "∀", B: "ꓭ", C: "Ɔ", D: "ꓷ", E: "Ǝ", F: "Ⅎ", G: "⅁", H: "H", I: "I", J: "ſ", K: "ꓘ", L: "˥", M: "W",
  N: "N", O: "O", P: "Ԁ", Q: "Ό", R: "ꓤ", S: "S", T: "ꓕ", U: "∩", V: "Λ", W: "M", X: "X", Y: "⅄", Z: "Z",
  "0": "0", "1": "Ɩ", "2": "ᄅ", "3": "Ɛ", "4": "ㄣ", "5": "ϛ", "6": "9", "7": "ㄥ", "8": "8", "9": "6",
  ".": "˙", ",": "'", "'": ",", '"': "„", "!": "¡", "?": "¿", "(": ")", ")": "(", "[": "]", "]": "[",
  "{": "}", "}": "{", "<": ">", ">": "<", _: "‾", "&": "⅋", ";": "؛", "‿": "⁀", "⁀": "‿",
};

export function reverseText(text: string, mode: ReverseMode): string {
  switch (mode) {
    case "characters":
      return graphemes(text).reverse().join("");
    case "words":
      return mapLines(text, (line) => line.split(/(\s+)/).reverse().join(""));
    case "each-word":
      return text.replace(/\S+/g, (word) => graphemes(word).reverse().join(""));
    case "lines":
      return text.split(/\r\n|\r|\n/).reverse().join("\n");
    case "upside-down":
      return graphemes(text)
        .reverse()
        .map((g) => UPSIDE_DOWN[g] ?? g)
        .join("");
  }
}

/* ───────────────────────── Text to speech ───────────────────────── */

export interface TextChunk {
  text: string;
  /** Offset of the chunk in the original text. */
  start: number;
}

const sentenceSegmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "sentence" }) : null;

function sentencePieces(text: string): TextChunk[] {
  if (sentenceSegmenter) return Array.from(sentenceSegmenter.segment(text), (s) => ({ text: s.segment, start: s.index }));
  return Array.from(text.matchAll(/[^.!?…\n]+[.!?…]*\s*|\n+/g), (m) => ({ text: m[0], start: m.index ?? 0 }));
}

/** Break a piece longer than `max` at spaces (or hard, for a single huge word). */
function splitLongPiece(piece: TextChunk, max: number): TextChunk[] {
  const parts: TextChunk[] = [];
  for (const m of piece.text.matchAll(/\S+\s*|\s+/g)) {
    let word = m[0];
    let start = piece.start + (m.index ?? 0);
    while (word.length > max) {
      parts.push({ text: word.slice(0, max), start });
      word = word.slice(max);
      start += max;
    }
    if (word) parts.push({ text: word, start });
  }
  return parts;
}

/**
 * Split text into chunks of at most `max` characters, preferably at sentence ends.
 * Browsers cut off or stall on very long utterances, so long texts are spoken in parts.
 */
export function chunkForSpeech(text: string, max = 200): TextChunk[] {
  const pieces = sentencePieces(text).flatMap((p) => (p.text.length > max ? splitLongPiece(p, max) : [p]));
  const chunks: TextChunk[] = [];
  let current: TextChunk | null = null;
  for (const piece of pieces) {
    if (current && current.text.length + piece.text.length <= max) {
      current.text += piece.text;
    } else {
      if (current) chunks.push(current);
      current = { ...piece };
    }
  }
  if (current) chunks.push(current);
  return chunks.filter((c) => /\S/.test(c.text));
}
