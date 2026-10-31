/**
 * Helpers shared by the developer tools.
 *
 * Everything here is plain TypeScript with no React dependency, so it can be
 * unit-tested in isolation. Only `decodeHtmlEntities` and `sanitizeHtml` need a
 * browser DOM (they use DOMParser, which never executes scripts).
 */

/** Human-readable message for any thrown value. */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

/** Number of bytes a string takes when encoded as UTF-8. */
export function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

/* ───────────────────────── JSON ───────────────────────── */

export interface TextPosition {
  /** 1-based line number. */
  line: number;
  /** 1-based column number. */
  column: number;
}

export interface JsonErrorInfo extends Partial<TextPosition> {
  message: string;
  /** 0-based character offset of the error, when known. */
  offset?: number;
}

export function offsetToPosition(text: string, offset: number): TextPosition {
  const clamped = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < clamped; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: clamped - lineStart + 1 };
}

function positionToOffset(text: string, { line, column }: TextPosition): number {
  let current = 1;
  let index = 0;
  while (current < line) {
    const next = text.indexOf("\n", index);
    if (next < 0) return text.length;
    index = next + 1;
    current++;
  }
  return Math.min(text.length, index + column - 1);
}

const JSON_NUMBER = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;
const JSON_ESCAPES = new Set(['"', "\\", "/", "b", "f", "n", "r", "t"]);

/**
 * Strict RFC 8259 scanner that returns the offset of the first syntax error,
 * or null when the text is valid JSON. Used when the browser's own error
 * message does not include a position.
 */
export function findJsonErrorOffset(text: string): number | null {
  const n = text.length;
  let i = 0;

  const skipWhitespace = () => {
    while (i < n) {
      const c = text[i];
      if (c !== " " && c !== "\t" && c !== "\n" && c !== "\r") break;
      i++;
    }
  };

  const scanString = (): boolean => {
    i++; // opening quote
    while (i < n) {
      const c = text[i];
      if (c === '"') {
        i++;
        return true;
      }
      if (c === "\\") {
        const next = text[i + 1] ?? "";
        if (JSON_ESCAPES.has(next)) i += 2;
        else if (next === "u" && /^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) i += 6;
        else return false;
        continue;
      }
      if (text.charCodeAt(i) < 0x20) return false;
      i++;
    }
    return false;
  };

  const scanValue = (): boolean => {
    skipWhitespace();
    const c = text[i];
    if (c === "{" || c === "[") {
      const close = c === "{" ? "}" : "]";
      i++;
      skipWhitespace();
      if (text[i] === close) {
        i++;
        return true;
      }
      for (;;) {
        if (c === "{") {
          skipWhitespace();
          if (text[i] !== '"' || !scanString()) return false;
          skipWhitespace();
          if (text[i] !== ":") return false;
          i++;
        }
        if (!scanValue()) return false;
        skipWhitespace();
        if (text[i] === ",") {
          i++;
          continue;
        }
        if (text[i] === close) {
          i++;
          return true;
        }
        return false;
      }
    }
    if (c === '"') return scanString();
    if (c === "-" || (c !== undefined && c >= "0" && c <= "9")) {
      JSON_NUMBER.lastIndex = i;
      const match = JSON_NUMBER.exec(text);
      if (!match) return false;
      i += match[0].length;
      return true;
    }
    for (const literal of ["true", "false", "null"]) {
      if (text.startsWith(literal, i)) {
        i += literal.length;
        return true;
      }
    }
    return false;
  };

  try {
    const ok = scanValue();
    skipWhitespace();
    if (ok && i === n) return null;
    return Math.min(i, n);
  } catch {
    // Extremely deep nesting can overflow the call stack; report no position.
    return null;
  }
}

function tidyJsonMessage(message: string): string {
  const cleaned = message
    .replace(/^JSON\.parse:\s*/i, "")
    .replace(/^JSON Parse error:\s*/i, "")
    .replace(/\s*(?:in JSON\s*)?at position \d+.*$/i, "")
    .replace(/\s*at line \d+ column \d+ of the JSON data$/i, "")
    .replace(/,\s*(?:\.\.\.)?"[\s\S]*is not valid JSON$/i, "")
    .trim();
  const text = cleaned || "Invalid JSON";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Turn a JSON.parse error into a message with a line and column. Browsers word
 * these errors differently ("at position 12", "at line 2 column 5", or no
 * location at all), so every form is handled and the strict scanner above is
 * used as a fallback.
 */
export function describeJsonError(text: string, error: unknown): JsonErrorInfo {
  const raw = errorMessage(error, "Invalid JSON");
  const message = tidyJsonMessage(raw);

  const lineColumn = /line (\d+) column (\d+)/i.exec(raw);
  if (lineColumn) {
    const position = { line: Number(lineColumn[1]), column: Number(lineColumn[2]) };
    return { message, ...position, offset: positionToOffset(text, position) };
  }

  const position = /position (\d+)/i.exec(raw);
  const offset = position ? Number(position[1]) : findJsonErrorOffset(text);
  if (offset === null || Number.isNaN(offset)) return { message };
  return { message, offset, ...offsetToPosition(text, offset) };
}

/** Parse JSON, throwing an Error whose message includes the line and column. */
export function parseJsonStrict(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    const info = describeJsonError(text, error);
    throw new Error(info.line ? `${info.message} (line ${info.line}, column ${info.column})` : info.message);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Recursively sort object keys alphabetically. Arrays keep their order. */
export function sortJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonKeys);
  if (!isPlainObject(value)) return value;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) sorted[key] = sortJsonKeys(value[key]);
  return sorted;
}

export type JsonIndent = "2" | "4" | "tab";

export function stringifyJson(value: unknown, indent: JsonIndent | "none"): string {
  if (indent === "none") return JSON.stringify(value);
  return JSON.stringify(value, null, indent === "tab" ? "\t" : Number(indent));
}

/* ───────────────────────── CSV ───────────────────────── */

export type CsvDelimiter = "," | ";" | "\t" | "|";

export const CSV_DELIMITERS: Array<{ value: CsvDelimiter; label: string }> = [
  { value: ",", label: "Comma" },
  { value: ";", label: "Semicolon" },
  { value: "\t", label: "Tab" },
  { value: "|", label: "Pipe" },
];

export type FlatValue = string | number | boolean | null;

/**
 * Flatten nested objects into dot-notation keys (address.city). Arrays are kept
 * as JSON text so no information is lost.
 */
export function flattenRecord(value: unknown, prefix = "", out: Record<string, FlatValue> = {}): Record<string, FlatValue> {
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (!keys.length && prefix) out[prefix] = "{}";
    for (const key of keys) flattenRecord(value[key], prefix ? `${prefix}.${key}` : key, out);
    return out;
  }
  const key = prefix || "value";
  if (Array.isArray(value)) out[key] = JSON.stringify(value);
  else if (value === undefined) out[key] = null;
  else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) out[key] = value;
  else out[key] = String(value);
  return out;
}

/** Find the list of records in parsed JSON: an array, { data: [...] } or a single object. */
export function extractRecords(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (isPlainObject(data)) {
    if (Array.isArray(data.data)) return data.data;
    return [data];
  }
  throw new Error("Expected a JSON array of objects, a single object, or an object with a \"data\" array.");
}

export interface Table {
  headers: string[];
  rows: FlatValue[][];
}

export function recordsToTable(records: unknown[]): Table {
  const flat = records.map((record) => flattenRecord(record));
  const headers: string[] = [];
  const seen = new Set<string>();
  for (const row of flat) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }
  return { headers, rows: flat.map((row) => headers.map((h) => (h in row ? row[h] : null))) };
}

export function cellText(value: FlatValue): string {
  return value === null ? "" : String(value);
}

/** Quote a CSV field when it contains the delimiter, quotes, line breaks or edge spaces. */
export function csvEscape(field: string, delimiter: string): string {
  const needsQuotes =
    field.includes(delimiter) || field.includes('"') || field.includes("\n") || field.includes("\r") || field !== field.trim();
  return needsQuotes ? `"${field.replace(/"/g, '""')}"` : field;
}

export function stringifyCsv(table: Table, delimiter: string, includeHeader = true, lineEnding = "\r\n"): string {
  const lines: string[] = [];
  if (includeHeader) lines.push(table.headers.map((h) => csvEscape(h, delimiter)).join(delimiter));
  for (const row of table.rows) lines.push(row.map((v) => csvEscape(cellText(v), delimiter)).join(delimiter));
  return lines.join(lineEnding);
}

export interface CsvParseOptions {
  /** When false, an unterminated quote is tolerated instead of throwing. */
  strict?: boolean;
}

/**
 * RFC 4180 parser: quoted fields may contain the delimiter, doubled quotes ("")
 * and line breaks; rows may end with LF, CRLF or CR. Blank lines are skipped.
 */
export function parseCsv(text: string, delimiter: string, { strict = true }: CsvParseOptions = {}): string[][] {
  const rows: string[][] = [];
  const n = text.length;
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let quoted = false;
  let quoteLine = 0;
  let line = 1;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  const endField = () => {
    row.push(field);
    field = "";
    quoted = false;
  };
  const endRow = () => {
    endField();
    if (row.length > 1 || row[0] !== "") rows.push(row);
    row = [];
  };

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      if (c === "\n") line++;
      field += c;
      i++;
      continue;
    }
    if (c === '"' && field === "" && !quoted) {
      inQuotes = true;
      quoted = true;
      quoteLine = line;
      i++;
      continue;
    }
    if (c === delimiter) {
      endField();
      i++;
      continue;
    }
    if (c === "\n" || c === "\r") {
      endRow();
      line++;
      i += c === "\r" && text[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    field += c;
    i++;
  }

  if (inQuotes && strict) {
    throw new Error(`The quoted field that starts on line ${quoteLine} is never closed. Check for a missing quote (").`);
  }
  if (field !== "" || quoted || row.length) endRow();
  return rows;
}

/** Guess the delimiter from the first lines of the data. */
export function detectDelimiter(text: string): CsvDelimiter {
  const sampleEnd = text.length > 20_000 ? text.lastIndexOf("\n", 20_000) : text.length;
  const sample = text.slice(0, sampleEnd > 0 ? sampleEnd : 20_000);
  let best: { delimiter: CsvDelimiter; score: number } = { delimiter: ",", score: 0 };
  for (const { value } of CSV_DELIMITERS) {
    if (!sample.includes(value)) continue;
    const rows = parseCsv(sample, value, { strict: false }).slice(0, 20);
    if (!rows.length) continue;
    const width = rows[0].length;
    if (width < 2) continue;
    const consistent = rows.filter((r) => r.length === width).length;
    const score = consistent * 100 + width;
    if (score > best.score) best = { delimiter: value, score };
  }
  return best.delimiter;
}

const CSV_NUMBER = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/;

/** Convert "42", "true" or "null" to typed values. Leading zeros (zip codes) stay text. */
export function inferCsvValue(value: string): FlatValue {
  if (value === "") return "";
  if (/^true$/i.test(value)) return true;
  if (/^false$/i.test(value)) return false;
  if (value === "null" || value === "NULL") return null;
  if (CSV_NUMBER.test(value)) {
    const num = Number(value);
    const isPlainInteger = !/[.eE]/.test(value);
    if (Number.isFinite(num) && (!isPlainInteger || Number.isSafeInteger(num))) return num;
  }
  return value;
}

export interface CsvToJsonOptions {
  header: boolean;
  infer: boolean;
  shape: "objects" | "arrays";
}

/** Make header names unique and non-empty so no column is lost. */
export function uniqueHeaders(names: string[]): string[] {
  const used = new Map<string, number>();
  return names.map((raw, i) => {
    const base = raw.trim() || `column_${i + 1}`;
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    return count ? `${base}_${count + 1}` : base;
  });
}

export function csvRowsToJson(rows: string[][], { header, infer, shape }: CsvToJsonOptions): unknown[] {
  const convert = (v: string): FlatValue => (infer ? inferCsvValue(v) : v);
  if (!rows.length) return [];
  const body = header ? rows.slice(1) : rows;
  if (shape === "arrays") {
    return header ? [rows[0], ...body.map((r) => r.map(convert))] : body.map((r) => r.map(convert));
  }
  const width = Math.max(...rows.map((r) => r.length));
  const names = uniqueHeaders(Array.from({ length: width }, (_, i) => (header ? (rows[0][i] ?? "") : "")));
  return body.map((r) => {
    const record: Record<string, FlatValue> = {};
    names.forEach((name, i) => {
      record[name] = i < r.length ? convert(r[i]) : infer ? null : "";
    });
    return record;
  });
}

/* ───────────────────────── Base64 ───────────────────────── */

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function toUrlSafeBase64(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decode standard or URL-safe Base64 (padding optional, whitespace and a
 * data: URL prefix ignored). Throws an Error that explains what is wrong.
 */
export function base64ToBytes(input: string): Uint8Array {
  let clean = input.trim().replace(/^data:[^,]*;base64,/i, "").replace(/\s+/g, "");
  clean = clean.replace(/-/g, "+").replace(/_/g, "/");
  const invalid = /[^A-Za-z0-9+/=]/.exec(clean);
  if (invalid) throw new Error(`"${invalid[0]}" is not a valid Base64 character.`);
  const firstPad = clean.indexOf("=");
  if (firstPad >= 0 && !/^=+$/.test(clean.slice(firstPad))) {
    throw new Error("Padding characters (=) can only appear at the end.");
  }
  const body = clean.replace(/=+$/, "");
  if (body.length % 4 === 1) throw new Error("The Base64 text has an invalid length. It may be cut off.");
  const padded = body + "=".repeat((4 - (body.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function encodeBase64Text(text: string, urlSafe: boolean): string {
  const encoded = bytesToBase64(new TextEncoder().encode(text));
  return urlSafe ? toUrlSafeBase64(encoded) : encoded;
}

/** Decode bytes as UTF-8, returning null when they are not valid UTF-8 text. */
export function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/* ───────────────────────── URL ───────────────────────── */

/** Explain why decodeURIComponent failed, pointing at the bad sequence. */
export function describePercentError(text: string): string {
  const bad = /%(?![0-9a-fA-F]{2})/.exec(text);
  if (bad) return `Invalid escape sequence at position ${bad.index + 1}: "%" must be followed by two hexadecimal digits.`;
  return "The percent-encoded bytes do not form valid UTF-8 text.";
}

/* ───────────────────────── HTML entities ───────────────────────── */

const BASIC_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape & < > " ' and, optionally, every non-ASCII character as &#N;. */
export function encodeHtmlEntities(text: string, encodeNonAscii: boolean): string {
  let out = "";
  for (const ch of text) {
    const basic = BASIC_ENTITIES[ch];
    if (basic) out += basic;
    else if (encodeNonAscii && (ch.codePointAt(0) ?? 0) > 126) out += `&#${ch.codePointAt(0)};`;
    else out += ch;
  }
  return out;
}

const ENTITY = /&(?:#[0-9]+|#[xX][0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]*);?/g;

/**
 * Decode named and numeric entities. Each entity is resolved by the browser's
 * HTML parser in an inert document, so all 2,000+ named entities work and no
 * markup is ever interpreted. Requires a DOM.
 */
export function decodeHtmlEntities(text: string): string {
  const parser = new DOMParser();
  const cache = new Map<string, string>();
  return text.replace(ENTITY, (entity) => {
    let decoded = cache.get(entity);
    if (decoded === undefined) {
      decoded = parser.parseFromString(`<!doctype html><body>${entity}`, "text/html").body.textContent ?? entity;
      cache.set(entity, decoded);
    }
    return decoded;
  });
}

/* ───────────────────────── Bytes & hashes ───────────────────────── */

export function bytesToHex(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Normalise a hash for comparison: lowercase, no spaces, colons or "0x". */
export function normalizeHash(hash: string): string {
  return hash.trim().toLowerCase().replace(/^0x/, "").replace(/[\s:-]/g, "");
}

/* ───────────────────────── UUID ───────────────────────── */

/** Random version 4 UUID from the browser's secure random number generator. */
export function randomUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // crypto.randomUUID only exists on secure (HTTPS) origins; build one by hand otherwise.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytesToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface UuidFormat {
  uppercase: boolean;
  hyphens: boolean;
  braces: boolean;
}

export function formatUuid(uuid: string, { uppercase, hyphens, braces }: UuidFormat): string {
  let out = hyphens ? uuid : uuid.replace(/-/g, "");
  if (uppercase) out = out.toUpperCase();
  return braces ? `{${out}}` : out;
}

export interface UuidInfo {
  canonical: string;
  version: number;
  versionLabel: string;
  variant: string;
  /** Creation time encoded in version 7 UUIDs. */
  timestamp?: Date;
}

const UUID_VERSIONS: Record<number, string> = {
  1: "Version 1 (time-based)",
  2: "Version 2 (DCE security)",
  3: "Version 3 (name-based, MD5)",
  4: "Version 4 (random)",
  5: "Version 5 (name-based, SHA-1)",
  6: "Version 6 (reordered time)",
  7: "Version 7 (Unix time-ordered)",
  8: "Version 8 (custom)",
};

/** Validate a UUID in any common notation and describe its version and variant. */
export function inspectUuid(input: string): UuidInfo | null {
  const hex = input
    .trim()
    .replace(/^urn:uuid:/i, "")
    .replace(/^\{(.*)\}$/, "$1");
  if (!/^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$/.test(hex)) return null;
  const plain = hex.replace(/-/g, "").toLowerCase();
  const canonical = `${plain.slice(0, 8)}-${plain.slice(8, 12)}-${plain.slice(12, 16)}-${plain.slice(16, 20)}-${plain.slice(20)}`;
  if (/^0+$/.test(plain)) return { canonical, version: 0, versionLabel: "Nil UUID", variant: "Nil" };
  if (/^f+$/.test(plain)) return { canonical, version: 15, versionLabel: "Max UUID", variant: "Max" };

  const version = parseInt(plain[12], 16);
  const variantNibble = parseInt(plain[16], 16);
  const variant =
    variantNibble < 8
      ? "NCS (reserved, backward compatibility)"
      : variantNibble < 12
        ? "RFC 9562 / RFC 4122"
        : variantNibble < 14
          ? "Microsoft (reserved)"
          : "Reserved for future use";
  const info: UuidInfo = {
    canonical,
    version,
    versionLabel: UUID_VERSIONS[version] ?? `Version ${version} (unknown)`,
    variant,
  };
  if (version === 7) info.timestamp = new Date(parseInt(plain.slice(0, 12), 16));
  return info;
}

/* ───────────────────────── JWT ───────────────────────── */

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: unknown;
  signature: string;
}

function decodeJwtPart(part: string, name: string): unknown {
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(part);
  } catch (error) {
    throw new Error(`The ${name} is not valid Base64URL: ${errorMessage(error, "decoding failed")}`);
  }
  const text = decodeUtf8(bytes);
  if (text === null) throw new Error(`The ${name} is not valid UTF-8 text.`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`The ${name} is not valid JSON.`);
  }
}

/** Decode (but never verify) a JSON Web Token. Throws a descriptive Error. */
export function decodeJwt(token: string): DecodedJwt {
  const clean = token.trim().replace(/^Bearer\s+/i, "");
  const parts = clean.split(".");
  if (parts.length === 5) {
    throw new Error("This is an encrypted token (JWE). Its payload cannot be read without the decryption key.");
  }
  if (parts.length !== 3) {
    throw new Error(`A JWT has three parts separated by dots, but this token has ${parts.length}.`);
  }
  if (!parts[0] || !parts[1]) throw new Error("The header or payload part of the token is empty.");
  const header = decodeJwtPart(parts[0], "header");
  if (!isPlainObject(header)) throw new Error("The header must be a JSON object.");
  return { header, payload: decodeJwtPart(parts[1], "payload"), signature: parts[2] };
}

/* ───────────────────────── Dates & time zones ───────────────────────── */

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 3600 * 1000],
  ["month", 30 * 24 * 3600 * 1000],
  ["week", 7 * 24 * 3600 * 1000],
  ["day", 24 * 3600 * 1000],
  ["hour", 3600 * 1000],
  ["minute", 60 * 1000],
  ["second", 1000],
];

/** "3 days ago", "in 2 hours". */
export function formatRelativeTime(targetMs: number, nowMs: number, locale?: string): string {
  const diff = targetMs - nowMs;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= size || unit === "second") return rtf.format(Math.round(diff / size), unit);
  }
  return rtf.format(0, "second");
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function zonedParts(date: Date, timeZone: string): ZonedParts {
  let fmt = partsFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
      era: "short",
    });
    partsFormatters.set(timeZone, fmt);
  }
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) out[p.type] = p.value;
  const year = Number(out.year);
  return {
    year: out.era === "BC" || out.era === "B" ? 1 - year : year,
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: out.weekday,
  };
}

function utcFromParts(p: Omit<ZonedParts, "weekday">, ms = 0): number {
  const d = new Date(0);
  d.setUTCFullYear(p.year, p.month - 1, p.day);
  d.setUTCHours(p.hour, p.minute, p.second, ms);
  return d.getTime();
}

/** Offset of a time zone from UTC at a given instant, in minutes (east positive). */
export function timeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = utcFromParts(p, date.getUTCMilliseconds());
  return Math.round((asUtc - date.getTime()) / 60_000);
}

function formatOffset(minutes: number, separator: boolean): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}${separator ? ":" : ""}${mm}`;
}

const pad = (n: number, width = 2) => String(Math.abs(n)).padStart(width, "0");

function formatYear(year: number): string {
  if (year >= 0 && year <= 9999) return pad(year, 4);
  return `${year < 0 ? "-" : "+"}${pad(year, 6)}`;
}

/** ISO 8601 with the offset of the given time zone, e.g. 2024-05-01T14:30:00.000+02:00. */
export function formatIsoInZone(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  const offset = timeZoneOffsetMinutes(date, timeZone);
  const ms = pad(date.getUTCMilliseconds(), 3);
  const time = `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}.${ms}`;
  return `${formatYear(p.year)}-${pad(p.month)}-${pad(p.day)}T${time}${offset === 0 ? "Z" : formatOffset(offset, true)}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** RFC 2822 date in the given time zone, e.g. Wed, 01 May 2024 14:30:00 +0200. */
export function formatRfc2822(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  const offset = timeZoneOffsetMinutes(date, timeZone);
  return `${p.weekday}, ${pad(p.day)} ${MONTHS[p.month - 1]} ${p.year} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)} ${formatOffset(offset, false)}`;
}

/** Value for <input type="datetime-local"> showing an instant in a time zone. */
export function toDateTimeLocalValue(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${formatYear(p.year)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
}

/**
 * Interpret a wall-clock time ("2024-05-01T14:30" or with seconds) in a time
 * zone and return the UTC instant in milliseconds, or null if it is invalid.
 */
export function zonedWallTimeToUtc(value: string, timeZone: string): number | null {
  const m = /^(-?\d{4,6})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value);
  if (!m) return null;
  const parts = {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
    second: Number(m[6] ?? 0),
  };
  const ms = Number((m[7] ?? "0").padEnd(3, "0"));
  const guess = utcFromParts(parts, ms);
  if (Number.isNaN(guess)) return null;
  // Two passes settle the offset correctly around daylight-saving changes.
  let result = guess - timeZoneOffsetMinutes(new Date(guess), timeZone) * 60_000;
  result = guess - timeZoneOffsetMinutes(new Date(result), timeZone) * 60_000;
  return result;
}

export type TimestampUnit = "s" | "ms" | "us" | "ns";

/** Guess the unit of a Unix timestamp from its magnitude. */
export function detectTimestampUnit(value: number): TimestampUnit {
  const abs = Math.abs(value);
  if (abs >= 1e17) return "ns";
  if (abs >= 1e14) return "us";
  if (abs >= 1e11) return "ms";
  return "s";
}

export const TIMESTAMP_UNIT_FACTOR: Record<TimestampUnit, number> = { s: 1000, ms: 1, us: 0.001, ns: 0.000001 };

/* ───────────────────────── Colour ───────────────────────── */

export interface Rgba {
  /** 0–255 */
  r: number;
  g: number;
  b: number;
  /** 0–1 */
  a: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function parseHue(token: string): number | null {
  const m = /^(-?[0-9]*\.?[0-9]+(?:e[+-]?[0-9]+)?)(deg|grad|rad|turn)?$/i.exec(token);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = (m[2] ?? "deg").toLowerCase();
  const deg = unit === "turn" ? n * 360 : unit === "rad" ? (n * 180) / Math.PI : unit === "grad" ? n * 0.9 : n;
  return ((deg % 360) + 360) % 360;
}

/** Parse "50%" (relative to `scale`) or a plain number. */
function parseNumberOrPercent(token: string, scale: number): number | null {
  const m = /^(-?[0-9]*\.?[0-9]+(?:e[+-]?[0-9]+)?)(%?)$/i.exec(token);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] ? (n / 100) * scale : n;
}

/** Accepts #rgb, #rgba, #rrggbb, #rrggbbaa (# optional), rgb()/rgba() and hsl()/hsla(). */
export function parseColor(input: string): Rgba | null {
  const value = input.trim().toLowerCase();
  const hex = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(value);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join("");
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? Math.round((parseInt(h.slice(6, 8), 16) / 255) * 1000) / 1000 : 1,
    };
  }

  const fn = /^(rgba?|hsla?)\(\s*([^)]*)\)$/.exec(value);
  if (!fn) return null;
  const tokens = fn[2].split(/\s*[,/]\s*|\s+/).filter(Boolean);
  if (tokens.length !== 3 && tokens.length !== 4) return null;
  const alpha = tokens.length === 4 ? parseNumberOrPercent(tokens[3], 1) : 1;
  if (alpha === null) return null;
  const a = clamp(alpha, 0, 1);

  if (fn[1].startsWith("rgb")) {
    const [r, g, b] = tokens.slice(0, 3).map((t) => parseNumberOrPercent(t, 255));
    if (r === null || g === null || b === null) return null;
    return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255), a };
  }

  const h = parseHue(tokens[0]);
  const s = parseNumberOrPercent(tokens[1].endsWith("%") ? tokens[1] : `${tokens[1]}%`, 100);
  const l = parseNumberOrPercent(tokens[2].endsWith("%") ? tokens[2] : `${tokens[2]}%`, 100);
  if (h === null || s === null || l === null) return null;
  return { ...hslToRgb(h, clamp(s, 0, 100), clamp(l, 0, 100)), a };
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const chroma = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - chroma * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 };
}

export function rgbToHsl({ r, g, b }: Rgba): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  return { h: hueOf(rn, gn, bn, max, d), s: s * 100, l: l * 100 };
}

function hueOf(r: number, g: number, b: number, max: number, d: number): number {
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

export function rgbToHsv({ r, g, b }: Rgba): { h: number; s: number; v: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const d = max - Math.min(rn, gn, bn);
  return { h: d === 0 ? 0 : hueOf(rn, gn, bn, max, d), s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
}

export function rgbToCmyk({ r, g, b }: Rgba): { c: number; m: number; y: number; k: number } {
  const k = 1 - Math.max(r, g, b) / 255;
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  const part = (v: number) => ((1 - v / 255 - k) / (1 - k)) * 100;
  return { c: part(r), m: part(g), y: part(b), k: k * 100 };
}

const hex2 = (n: number) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");

/** #RRGGBB, or #RRGGBBAA when the colour is translucent (and alpha is requested). */
export function rgbToHex(color: Rgba, withAlpha = true): string {
  const base = `#${hex2(color.r)}${hex2(color.g)}${hex2(color.b)}`;
  return (withAlpha && color.a < 1 ? base + hex2(color.a * 255) : base).toUpperCase();
}

const round = (n: number, digits = 0) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

export interface ColorFormats {
  hex: string;
  rgb: string;
  hsl: string;
  hsv: string;
  cmyk: string;
}

export function formatColor(color: Rgba): ColorFormats {
  const r = Math.round(color.r);
  const g = Math.round(color.g);
  const b = Math.round(color.b);
  const a = round(color.a, 3);
  const hsl = rgbToHsl(color);
  const hsv = rgbToHsv(color);
  const cmyk = rgbToCmyk(color);
  const translucent = a < 1;
  return {
    hex: rgbToHex(color),
    rgb: translucent ? `rgba(${r}, ${g}, ${b}, ${a})` : `rgb(${r}, ${g}, ${b})`,
    hsl: translucent
      ? `hsla(${round(hsl.h)}, ${round(hsl.s)}%, ${round(hsl.l)}%, ${a})`
      : `hsl(${round(hsl.h)}, ${round(hsl.s)}%, ${round(hsl.l)}%)`,
    hsv: `hsv(${round(hsv.h)}, ${round(hsv.s)}%, ${round(hsv.v)}%)`,
    cmyk: `cmyk(${round(cmyk.c)}%, ${round(cmyk.m)}%, ${round(cmyk.y)}%, ${round(cmyk.k)}%)`,
  };
}

/** Blend `color` towards `target` by `amount` (0–1). Alpha is kept. */
export function mixColors(color: Rgba, target: { r: number; g: number; b: number }, amount: number): Rgba {
  return {
    r: color.r + (target.r - color.r) * amount,
    g: color.g + (target.g - color.g) * amount,
    b: color.b + (target.b - color.b) * amount,
    a: color.a,
  };
}

/** Composite a translucent colour over an opaque background. */
export function flattenOver(color: Rgba, background: { r: number; g: number; b: number }): Rgba {
  return { ...mixColors({ ...color, a: 1 }, background, 1 - color.a), a: 1 };
}

/** WCAG 2 relative luminance. */
export function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2 contrast ratio between two opaque colours (1–21). */
export function contrastRatio(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* ───────────────────────── Minifiers ───────────────────────── */

/** Copy a quoted string starting at `start`; returns the index just after it. */
function skipQuoted(source: string, start: number): number {
  const quote = source[start];
  let i = start + 1;
  while (i < source.length) {
    if (source[i] === "\\") i += 2;
    else if (source[i] === quote) return i + 1;
    else if (source[i] === "\n" && quote !== "`") return i; // unterminated CSS string
    else i++;
  }
  return source.length;
}

/**
 * True when the ":" at `index` separates a property from its value (followed by
 * ";" or "}") rather than starting a pseudo-class in a selector (followed by "{").
 */
function isDeclarationColon(css: string, index: number): boolean {
  let i = index + 1;
  while (i < css.length) {
    const c = css[i];
    if (c === '"' || c === "'") i = skipQuoted(css, i);
    else if (c === "{") return false;
    else if (c === ";" || c === "}") return true;
    else i++;
  }
  return true;
}

const CSS_TIGHT = new Set(["{", "}", ";", ",", ">", "!"]);

/**
 * Minify CSS: remove comments (except /*! licence comments), collapse
 * whitespace, drop spaces around { } ; , > and declaration colons, and remove
 * the last semicolon in each block. Strings are never modified.
 */
export function minifyCss(css: string): string {
  let out = "";
  let i = 0;
  const n = css.length;
  let pendingSpace = false;

  const emitSpaceIfNeeded = (next: string, index: number) => {
    if (!pendingSpace) return;
    pendingSpace = false;
    const prev = out[out.length - 1];
    if (prev === undefined || CSS_TIGHT.has(prev) || prev === ":" || CSS_TIGHT.has(next)) return;
    if (next === ":" && isDeclarationColon(css, index)) return;
    out += " ";
  };

  while (i < n) {
    const c = css[i];
    if (c === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      const stop = end < 0 ? n : end + 2;
      if (css[i + 2] === "!") {
        emitSpaceIfNeeded("/", i);
        out += css.slice(i, stop);
      } else {
        // A comment separates tokens (0/**/auto), so it is replaced by a space where one is needed.
        pendingSpace = true;
      }
      i = stop;
      continue;
    }
    if (/\s/.test(c)) {
      pendingSpace = true;
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      emitSpaceIfNeeded(c, i);
      const end = skipQuoted(css, i);
      out += css.slice(i, end);
      i = end;
      continue;
    }
    emitSpaceIfNeeded(c, i);
    if (c === "}" && out.endsWith(";")) out = out.slice(0, -1);
    out += c;
    i++;
  }
  return out.trim();
}

const BLOCK_TAGS = new Set(
  (
    "address article aside base blockquote body br caption col colgroup dd details dialog div dl dt fieldset figcaption " +
    "figure footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html iframe legend li link main meta nav noscript ol " +
    "optgroup option p pre script section select style summary table tbody td template textarea tfoot th thead title tr ul !doctype"
  ).split(" "),
);
const RAW_TAGS = new Set(["pre", "textarea", "script", "style"]);

type HtmlToken =
  | { type: "text"; value: string }
  | { type: "raw"; value: string }
  | { type: "comment"; value: string }
  | { type: "tag"; value: string; name: string; closing: boolean };

function tokenizeHtml(html: string): HtmlToken[] {
  const tokens: HtmlToken[] = [];
  const n = html.length;
  let i = 0;
  let text = "";
  const flushText = () => {
    if (text) tokens.push({ type: "text", value: text });
    text = "";
  };

  while (i < n) {
    if (html.startsWith("<!--", i)) {
      flushText();
      const end = html.indexOf("-->", i + 4);
      const stop = end < 0 ? n : end + 3;
      tokens.push({ type: "comment", value: html.slice(i, stop) });
      i = stop;
      continue;
    }
    if (html[i] === "<" && /[A-Za-z/!?]/.test(html[i + 1] ?? "")) {
      flushText();
      let j = i + 1;
      let quote = "";
      while (j < n) {
        const c = html[j];
        if (quote) {
          if (c === quote) quote = "";
        } else if ((c === '"' || c === "'") && /[=\s]/.test(html[j - 1])) {
          quote = c;
        } else if (c === ">") {
          break;
        }
        j++;
      }
      const value = html.slice(i, Math.min(j + 1, n));
      const nameMatch = /^<\/?([A-Za-z!?][^\s/>]*)/.exec(value);
      const name = (nameMatch?.[1] ?? "").toLowerCase();
      const closing = value.startsWith("</");
      tokens.push({ type: "tag", value, name, closing });
      i = j + 1;
      if (!closing && RAW_TAGS.has(name) && !value.endsWith("/>")) {
        const closeAt = html.toLowerCase().indexOf(`</${name}`, i);
        const stop = closeAt < 0 ? n : closeAt;
        if (stop > i) tokens.push({ type: "raw", value: html.slice(i, stop) });
        i = stop;
      }
      continue;
    }
    text += html[i];
    i++;
  }
  flushText();
  return tokens;
}

/** Collapse whitespace inside a tag while leaving quoted attribute values untouched. */
function minifyTag(tag: string): string {
  let out = "";
  let quote = "";
  let space = false;
  for (let i = 0; i < tag.length; i++) {
    const c = tag[i];
    if (quote) {
      out += c;
      if (c === quote) quote = "";
      continue;
    }
    if (/\s/.test(c)) {
      space = true;
      continue;
    }
    if (space) {
      const prev = out[out.length - 1];
      if (c !== ">" && c !== "=" && prev !== "=" && !(c === "/" && tag[i + 1] === ">")) out += " ";
      space = false;
    }
    if ((c === '"' || c === "'") && out.endsWith("=")) quote = c;
    out += c;
  }
  return out;
}

function isConditionalComment(comment: string): boolean {
  return /^<!--\s*\[if\b/i.test(comment) || /<!\[endif\]\s*-->$/i.test(comment);
}

const HTML_SPACE = /[ \t\n\r\f]+/g;

/**
 * Minify HTML: remove comments (conditional comments are kept), collapse
 * whitespace, drop whitespace next to block-level tags, and tidy whitespace
 * inside tags. The contents of <pre>, <textarea>, <script> and <style> are kept
 * exactly as written.
 */
export function minifyHtml(html: string): string {
  const tokens = tokenizeHtml(html).filter((t) => t.type !== "comment" || isConditionalComment(t.value));
  const isBlockBoundary = (t: HtmlToken | undefined) =>
    t === undefined || t.type === "comment" || (t.type === "tag" && BLOCK_TAGS.has(t.name));

  let out = "";
  tokens.forEach((token, index) => {
    if (token.type === "tag") out += minifyTag(token.value);
    else if (token.type === "text") {
      let value = token.value.replace(HTML_SPACE, " ");
      if (value.startsWith(" ") && isBlockBoundary(tokens[index - 1])) value = value.slice(1);
      if (value.endsWith(" ") && isBlockBoundary(tokens[index + 1])) value = value.slice(0, -1);
      out += value;
    } else out += token.value;
  });
  return out.trim();
}

/**
 * Put a SQL query on one line: comments are removed (MySQL /*! hints are kept),
 * whitespace is collapsed, and strings, quoted identifiers and dollar-quoted
 * bodies are left untouched.
 */
export function minifySql(sql: string): string {
  let out = "";
  let i = 0;
  const n = sql.length;
  let pendingSpace = false;
  const tightAfter = new Set(["(", ","]);
  const tightBefore = new Set([")", ",", ";"]);

  const emit = (chunk: string) => {
    if (pendingSpace && out && !tightAfter.has(out[out.length - 1]) && !tightBefore.has(chunk[0])) out += " ";
    pendingSpace = false;
    out += chunk;
  };

  while (i < n) {
    const c = sql[i];
    if (c === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      i = end < 0 ? n : end;
      pendingSpace = true;
      continue;
    }
    if (c === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      const stop = end < 0 ? n : end + 2;
      if (sql[i + 2] === "!") emit(sql.slice(i, stop));
      else pendingSpace = true;
      i = stop;
      continue;
    }
    if (/\s/.test(c)) {
      pendingSpace = true;
      i++;
      continue;
    }
    if (c === "'" || c === '"' || c === "`" || c === "[") {
      const close = c === "[" ? "]" : c;
      let j = i + 1;
      while (j < n) {
        if (sql[j] === close) {
          if (sql[j + 1] === close && close !== "]") {
            j += 2;
            continue;
          }
          break;
        }
        if (sql[j] === "\\" && c === "'") j++;
        j++;
      }
      emit(sql.slice(i, Math.min(j + 1, n)));
      i = j + 1;
      continue;
    }
    if (c === "$") {
      const tag = /^\$[A-Za-z_]*\$/.exec(sql.slice(i, i + 64));
      if (tag) {
        const end = sql.indexOf(tag[0], i + tag[0].length);
        const stop = end < 0 ? n : end + tag[0].length;
        emit(sql.slice(i, stop));
        i = stop;
        continue;
      }
    }
    emit(c);
    i++;
  }
  return out.trim();
}

/* ───────────────────────── Number bases ───────────────────────── */

const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";
const PREFIXES: Record<number, string> = { 2: "0b", 8: "0o", 16: "0x" };

/**
 * Parse an integer of any size written in base 2–36. Spaces, underscores and
 * (in base 10) commas are ignored, a leading sign and a 0b/0o/0x prefix are
 * allowed. Throws an Error that names the first invalid digit.
 */
export function parseBigIntInBase(input: string, base: number): bigint {
  let s = input.trim().replace(base === 10 ? /[\s_,]/g : /[\s_]/g, "").toLowerCase();
  let negative = false;
  if (s.startsWith("-") || s.startsWith("+")) {
    negative = s[0] === "-";
    s = s.slice(1);
  }
  const prefix = PREFIXES[base];
  if (prefix && s.startsWith(prefix)) s = s.slice(2);
  if (!s) throw new Error("Enter a number.");
  const allowed = DIGITS.slice(0, base);
  for (const ch of s) {
    if (!allowed.includes(ch)) {
      const range = base <= 10 ? `0–${base - 1}` : `0–9 and A–${DIGITS[base - 1].toUpperCase()}`;
      throw new Error(`"${ch}" is not a valid base ${base} digit (use ${range}).`);
    }
  }
  let value: bigint;
  if (prefix || base === 10) {
    value = BigInt(prefix ? `${prefix}${s}` : s);
  } else {
    const big = BigInt(base);
    value = BigInt(0);
    for (const ch of s) value = value * big + BigInt(allowed.indexOf(ch));
  }
  return negative ? -value : value;
}

export function formatBigIntInBase(value: bigint, base: number, uppercase = false): string {
  const text = value.toString(base);
  return uppercase ? text.toUpperCase() : text;
}

/** Group digits from the right, e.g. ("11010110", 4) → "1101 0110". */
export function groupDigits(value: string, size: number, separator = " "): string {
  const negative = value.startsWith("-");
  const digits = negative ? value.slice(1) : value;
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= size) groups.unshift(digits.slice(Math.max(0, end - size), end));
  return (negative ? "-" : "") + groups.join(separator);
}

/* ───────────────────────── Regex ───────────────────────── */

export interface RegexMatch {
  index: number;
  end: number;
  text: string;
  groups: Array<string | undefined>;
  named: Record<string, string | undefined> | null;
}

/**
 * Collect matches safely: at most `limit` results, and zero-length matches
 * always advance so patterns like /a*|/g cannot loop forever.
 */
export function collectMatches(pattern: RegExp, text: string, limit: number): { matches: RegexMatch[]; truncated: boolean } {
  const re = new RegExp(pattern.source, pattern.flags);
  const matches: RegexMatch[] = [];
  const toMatch = (m: RegExpExecArray): RegexMatch => ({
    index: m.index,
    end: m.index + m[0].length,
    text: m[0],
    groups: m.slice(1),
    named: m.groups ? { ...m.groups } : null,
  });

  if (!re.global) {
    const m = re.exec(text);
    return { matches: m ? [toMatch(m)] : [], truncated: false };
  }

  const unicode = re.unicode || re.flags.includes("v");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    matches.push(toMatch(m));
    if (m[0] === "") {
      const code = text.codePointAt(re.lastIndex) ?? 0;
      re.lastIndex += unicode && code > 0xffff ? 2 : 1;
      if (re.lastIndex > text.length) break;
    }
    if (matches.length >= limit) return { matches, truncated: re.exec(text) !== null };
  }
  return { matches, truncated: false };
}

/* ───────────────────────── HTML sanitizer ───────────────────────── */

const ALLOWED_TAGS = new Set(
  (
    "a abbr b bdi bdo blockquote br caption cite code col colgroup dd del details dfn div dl dt em figcaption figure " +
    "h1 h2 h3 h4 h5 h6 hr i img input ins kbd li mark ol p pre q rp rt ruby s samp small span strong sub summary sup " +
    "table tbody td tfoot th thead time tr u ul var wbr"
  ).split(" "),
);
/** Elements removed together with everything inside them. */
const DROPPED_TAGS = new Set(
  "script style iframe frame frameset object embed applet template noscript noembed title textarea select button form svg math link meta base video audio source track canvas portal".split(
    " ",
  ),
);
const ALLOWED_ATTRIBUTES = new Set(
  "href src alt title width height align colspan rowspan start reversed type checked disabled class lang dir open cite datetime scope abbr span".split(
    " ",
  ),
);
const URL_ATTRIBUTES = new Set(["href", "src", "cite"]);

/** Allow http(s), mailto, tel, relative URLs and embedded raster images. */
export function isSafeUrl(value: string, attribute: string): boolean {
  // Browsers ignore control characters and whitespace inside a scheme, so strip them before checking.
  const compact = [...value]
    .filter((ch) => (ch.codePointAt(0) ?? 0) > 32)
    .join("")
    .toLowerCase();
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(compact);
  if (!scheme) return true;
  if (["http", "https", "mailto", "tel"].includes(scheme[1])) return true;
  return attribute === "src" && /^data:image\/(png|gif|jpe?g|webp|avif);/.test(compact);
}

export interface SanitizeOptions {
  /** Open links in a new tab with rel="noopener noreferrer". */
  externalLinks?: boolean;
}

/**
 * Allow-list HTML sanitizer for untrusted Markdown output. Parses the markup in
 * an inert DOMParser document (nothing runs, nothing loads), keeps only safe
 * elements and attributes, and drops event handlers, inline styles and
 * javascript:/data: URLs. Requires a DOM.
 */
export function sanitizeHtml(html: string, { externalLinks = false }: SanitizeOptions = {}): string {
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}`, "text/html");

  const clean = (parent: Element) => {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === 8) {
        node.remove(); // comment
        continue;
      }
      if (node.nodeType !== 1) continue;
      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      if (DROPPED_TAGS.has(tag)) {
        el.remove();
        continue;
      }
      clean(el);
      if (!ALLOWED_TAGS.has(tag) || (tag === "input" && el.getAttribute("type") !== "checkbox")) {
        el.replaceWith(...Array.from(el.childNodes));
        continue;
      }
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        if (!ALLOWED_ATTRIBUTES.has(name) || (URL_ATTRIBUTES.has(name) && !isSafeUrl(attr.value, name))) {
          el.removeAttribute(attr.name);
        }
      }
      // Only keep language-* classes (code highlighting hooks) so content cannot borrow the site's own styles.
      const classes = (el.getAttribute("class") ?? "").split(/\s+/).filter((c) => /^language-[\w+#-]+$/.test(c));
      if (classes.length) el.setAttribute("class", classes.join(" "));
      else el.removeAttribute("class");
      if (tag === "input") el.setAttribute("disabled", "");
      if (tag === "a" && externalLinks && el.hasAttribute("href")) {
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
    }
  };

  clean(doc.body);
  return doc.body.innerHTML;
}

/** Escape text for use inside HTML element content or attribute values. */
export function escapeHtml(text: string): string {
  return encodeHtmlEntities(text, false);
}
