/**
 * Descriptive statistics and cryptographically secure random numbers.
 */

/* ───────────────────────── Number lists ───────────────────────── */

export interface ParsedList {
  values: number[];
  /** Tokens that are not numbers, in the order they appear. */
  invalid: string[];
}

/** Split text on whitespace, commas and semicolons and parse each token as a number. */
export function parseNumberList(text: string): ParsedList {
  const values: number[] = [];
  const invalid: string[] = [];
  for (const token of text.split(/[\s,;]+/)) {
    if (!token) continue;
    const value = Number(token);
    if (Number.isFinite(value)) values.push(value);
    else invalid.push(token);
  }
  return { values, invalid };
}

export interface Summary {
  count: number;
  sum: number;
  mean: number;
  median: number;
  /** Most frequent values; empty when every value occurs equally often. */
  modes: number[];
  modeCount: number;
  min: number;
  max: number;
  range: number;
  populationVariance: number;
  populationSd: number;
  /** Null for a single value, where the sample statistics are undefined. */
  sampleVariance: number | null;
  sampleSd: number | null;
  /** Null unless every value is positive. */
  geometricMean: number | null;
  sorted: number[];
}

/** Summary statistics for a non-empty list of numbers. */
export function summarize(values: number[]): Summary {
  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((total, v) => total + v, 0);
  const mean = sum / count;
  const middle = Math.floor(count / 2);
  const median = count % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;

  const frequency = new Map<number, number>();
  for (const v of sorted) frequency.set(v, (frequency.get(v) ?? 0) + 1);
  let modeCount = 0;
  for (const f of frequency.values()) if (f > modeCount) modeCount = f;
  const allEqual = [...frequency.values()].every((f) => f === modeCount);
  const modes = allEqual && frequency.size > 1 ? [] : [...frequency].filter(([, f]) => f === modeCount).map(([v]) => v);

  // Sum of squared deviations from the mean (two-pass, which is numerically stable enough here).
  const squares = sorted.reduce((total, v) => total + (v - mean) ** 2, 0);
  const populationVariance = squares / count;
  const sampleVariance = count > 1 ? squares / (count - 1) : null;
  const positive = sorted[0] > 0;

  return {
    count,
    sum,
    mean,
    median,
    modes,
    modeCount,
    min: sorted[0],
    max: sorted[count - 1],
    range: sorted[count - 1] - sorted[0],
    populationVariance,
    populationSd: Math.sqrt(populationVariance),
    sampleVariance,
    sampleSd: sampleVariance === null ? null : Math.sqrt(sampleVariance),
    geometricMean: positive ? Math.exp(sorted.reduce((total, v) => total + Math.log(v), 0) / count) : null,
    sorted,
  };
}

/* ───────────────────────── Random numbers ───────────────────────── */

const TWO_32 = 2 ** 32;
const TWO_53 = 2 ** 53;

/**
 * Uniform random integer in [0, n) from crypto.getRandomValues. Rejection
 * sampling removes the modulo bias; `n` may be any safe integer (up to 2^53 − 1).
 */
export function randomBelow(n: number): number {
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError("n must be a safe integer of at least 1.");
  const words = new Uint32Array(2);
  if (n <= TWO_32) {
    const limit = Math.floor(TWO_32 / n) * n;
    for (;;) {
      crypto.getRandomValues(words);
      if (words[0] < limit) return words[0] % n;
    }
  }
  const limit = Math.floor(TWO_53 / n) * n;
  for (;;) {
    crypto.getRandomValues(words);
    // 21 high bits + 32 low bits = a uniform 53-bit integer.
    const value = (words[0] >>> 11) * TWO_32 + words[1];
    if (value < limit) return value % n;
  }
}

export interface RandomOptions {
  min: number;
  max: number;
  count: number;
  /** Decimal places; 0 generates integers. */
  decimals: number;
  unique: boolean;
}

export type RandomPlan = { ok: true; low: number; size: number; scale: number } | { ok: false; error: string };

/**
 * Validate the options and describe the grid of possible values: every result is
 * (low + k) ÷ scale for an integer k in [0, size).
 */
export function planRandom({ min, max, count, decimals, unique }: RandomOptions): RandomPlan {
  if (min > max) return { ok: false, error: "The minimum must not be greater than the maximum." };
  const scale = 10 ** decimals;
  const low = Math.ceil(min * scale - 1e-9);
  const high = Math.floor(max * scale + 1e-9);
  if (!Number.isSafeInteger(low) || !Number.isSafeInteger(high)) {
    return { ok: false, error: "The range is too large for this many decimal places." };
  }
  if (high < low) return { ok: false, error: "No value with this many decimal places lies between the minimum and maximum." };
  const size = high - low + 1;
  if (!Number.isSafeInteger(size)) return { ok: false, error: "The range is too large for this many decimal places." };
  if (unique && count > size) {
    return {
      ok: false,
      error: `Only ${size.toLocaleString()} different values are possible, so ${count.toLocaleString()} unique numbers can't be drawn.`,
    };
  }
  return { ok: true, low, size, scale };
}

/** Largest range shuffled in memory for unique draws; larger ranges use rejection with a Set. */
const SHUFFLE_LIMIT = 100_000;

/** Draw `count` random grid indices in [0, size), optionally without repeats. */
function drawIndices(size: number, count: number, unique: boolean): number[] {
  if (!unique) return Array.from({ length: count }, () => randomBelow(size));
  if (size <= SHUFFLE_LIMIT) {
    // Partial Fisher–Yates shuffle: the first `count` items are a uniform sample.
    const pool = Array.from({ length: size }, (_, i) => i);
    for (let i = 0; i < count; i++) {
      const j = i + randomBelow(size - i);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  }
  const seen = new Set<number>();
  while (seen.size < count) seen.add(randomBelow(size));
  return [...seen];
}

/** Generate random numbers for a validated plan. */
export function generateRandom(plan: Extract<RandomPlan, { ok: true }>, count: number, unique: boolean): number[] {
  return drawIndices(plan.size, count, unique).map((k) => (plan.low + k) / plan.scale);
}
