/**
 * UTF-8 text ↔ binary / hexadecimal byte strings, shared by the Text to Binary,
 * Binary to Text, Text to Hex and Hex to Text tools.
 */

export type ByteFormat = "binary" | "hex";
export type ByteSeparator = "space" | "none" | "comma";

export const SEPARATORS: Record<ByteSeparator, string> = { space: " ", none: "", comma: ", " };

export interface EncodeOptions {
  separator: ByteSeparator;
  /** Hex only: A–F instead of a–f. */
  uppercase?: boolean;
  /** Hex only: write each byte as 0x41. */
  prefix?: boolean;
}

/** Encode text as UTF-8 and write every byte in binary (8 digits) or hex (2 digits). */
export function encodeText(text: string, format: ByteFormat, { separator, uppercase = false, prefix = false }: EncodeOptions): string {
  const bytes = new TextEncoder().encode(text);
  const parts = Array.from(bytes, (byte) => {
    if (format === "binary") return byte.toString(2).padStart(8, "0");
    const hex = byte.toString(16).padStart(2, "0");
    return (prefix ? "0x" : "") + (uppercase ? hex.toUpperCase() : hex);
  });
  return parts.join(SEPARATORS[separator]);
}

export type DecodeResult =
  | { ok: true; text: string; bytes: number; validUtf8: boolean }
  | { ok: false; error: string };

const DIGITS: Record<ByteFormat, { pattern: RegExp; width: number; radix: number; name: string }> = {
  binary: { pattern: /^[01]+$/, width: 8, radix: 2, name: "binary" },
  hex: { pattern: /^[0-9a-f]+$/i, width: 2, radix: 16, name: "hexadecimal" },
};

/**
 * Parse bytes written in binary or hex and decode them as UTF-8.
 *
 * Bytes may be separated by spaces, commas, semicolons or line breaks, or written
 * as one continuous run. Hex may use 0x or \x prefixes; binary may use 0b.
 */
export function decodeBytes(input: string, format: ByteFormat): DecodeResult {
  const spec = DIGITS[format];
  const prefix = format === "hex" ? /^(?:0x|\\x)/i : /^0b/i;
  const tokens = input
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map((token) => token.replace(prefix, ""));
  const bytes: number[] = [];

  for (const token of tokens) {
    if (!spec.pattern.test(token)) {
      const bad = Array.from(token).find((c) => !spec.pattern.test(c)) ?? token;
      return { ok: false, error: `"${bad}" is not a ${spec.name} digit (in "${token}").` };
    }
    // A short group is one byte with its leading zeros left out, e.g. "1000001" or "a".
    if (token.length <= spec.width) {
      bytes.push(parseInt(token, spec.radix));
      continue;
    }
    if (token.length % spec.width) {
      return {
        ok: false,
        error: `"${token.length > 24 ? `${token.slice(0, 24)}…` : token}" has ${token.length} digits, which is not a whole number of bytes (${spec.width} digits each).`,
      };
    }
    for (let i = 0; i < token.length; i += spec.width) bytes.push(parseInt(token.slice(i, i + spec.width), spec.radix));
  }

  const data = new Uint8Array(bytes);
  let validUtf8 = true;
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    validUtf8 = false;
    text = new TextDecoder("utf-8").decode(data);
  }
  return { ok: true, text, bytes: data.length, validUtf8 };
}
