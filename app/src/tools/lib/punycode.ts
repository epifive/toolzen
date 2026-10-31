/**
 * Punycode (RFC 3492) and IDNA-style domain conversion, implemented from the
 * specification so it has no dependency on Node's deprecated `punycode` module.
 */

const BASE = 36;
const T_MIN = 1;
const T_MAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128;
const DELIMITER = "-";
const MAX_INT = 0x7fffffff;
const ACE_PREFIX = "xn--";

/** Characters that IDNA treats as label separators besides the ASCII full stop. */
const DOT_VARIANTS = [0x3002, 0xff0e, 0xff61].map((code) => String.fromCharCode(code));

function adapt(delta: number, numPoints: number, firstTime: boolean): number {
  let d = firstTime ? Math.floor(delta / DAMP) : delta >> 1;
  d += Math.floor(d / numPoints);
  let k = 0;
  while (d > ((BASE - T_MIN) * T_MAX) >> 1) {
    d = Math.floor(d / (BASE - T_MIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - T_MIN + 1) * d) / (d + SKEW));
}

/** Digit value (0–35) to its basic code point: a–z, then 0–9. */
function digitToChar(digit: number): string {
  return String.fromCharCode(digit < 26 ? digit + 97 : digit + 22);
}

function charToDigit(code: number): number {
  if (code >= 48 && code <= 57) return code - 22; // 0–9 → 26–35
  if (code >= 65 && code <= 90) return code - 65; // A–Z
  if (code >= 97 && code <= 122) return code - 97; // a–z
  return BASE;
}

function threshold(k: number, bias: number): number {
  if (k <= bias) return T_MIN;
  if (k >= bias + T_MAX) return T_MAX;
  return k - bias;
}

/** Encode a Unicode string to Punycode (without the xn-- prefix). */
export function punycodeEncode(input: string): string {
  const codePoints = Array.from(input, (c) => c.codePointAt(0) ?? 0);
  let output = codePoints
    .filter((cp) => cp < 0x80)
    .map((cp) => String.fromCharCode(cp))
    .join("");
  const basicLength = output.length;
  let handled = basicLength;
  if (basicLength) output += DELIMITER;

  let n = INITIAL_N;
  let delta = 0;
  let bias = INITIAL_BIAS;

  while (handled < codePoints.length) {
    let m = MAX_INT;
    for (const cp of codePoints) if (cp >= n && cp < m) m = cp;
    if (m - n > Math.floor((MAX_INT - delta) / (handled + 1))) throw new Error("The text is too long to encode.");
    delta += (m - n) * (handled + 1);
    n = m;
    for (const cp of codePoints) {
      if (cp < n && ++delta > MAX_INT) throw new Error("The text is too long to encode.");
      if (cp === n) {
        let q = delta;
        for (let k = BASE; ; k += BASE) {
          const t = threshold(k, bias);
          if (q < t) break;
          output += digitToChar(t + ((q - t) % (BASE - t)));
          q = Math.floor((q - t) / (BASE - t));
        }
        output += digitToChar(q);
        bias = adapt(delta, handled + 1, handled === basicLength);
        delta = 0;
        handled++;
      }
    }
    delta++;
    n++;
  }
  return output;
}

/** Decode Punycode (without the xn-- prefix) back to Unicode. */
export function punycodeDecode(input: string): string {
  const output: number[] = [];
  const lastDelimiter = input.lastIndexOf(DELIMITER);
  const basic = lastDelimiter < 0 ? 0 : lastDelimiter;
  for (let j = 0; j < basic; j++) {
    const code = input.charCodeAt(j);
    if (code >= 0x80) throw new Error("Punycode can only contain ASCII letters, digits and hyphens.");
    output.push(code);
  }

  let n = INITIAL_N;
  let bias = INITIAL_BIAS;
  let i = 0;
  for (let index = basic > 0 ? basic + 1 : 0; index < input.length; ) {
    const oldI = i;
    for (let w = 1, k = BASE; ; k += BASE) {
      if (index >= input.length) throw new Error("The Punycode ends unexpectedly.");
      const digit = charToDigit(input.charCodeAt(index++));
      if (digit >= BASE) throw new Error(`"${input[index - 1]}" is not allowed in Punycode.`);
      if (digit > Math.floor((MAX_INT - i) / w)) throw new Error("The Punycode value is out of range.");
      i += digit * w;
      const t = threshold(k, bias);
      if (digit < t) break;
      if (w > Math.floor(MAX_INT / (BASE - t))) throw new Error("The Punycode value is out of range.");
      w *= BASE - t;
    }
    const length = output.length + 1;
    bias = adapt(i - oldI, length, oldI === 0);
    if (Math.floor(i / length) > MAX_INT - n) throw new Error("The Punycode value is out of range.");
    n += Math.floor(i / length);
    i %= length;
    if (n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) throw new Error("The Punycode decodes to an invalid character.");
    output.splice(i++, 0, n);
  }
  return String.fromCodePoint(...output);
}

/* ───────────────────────── Domains ───────────────────────── */

const LDH = /^[a-z0-9-]+$/i;

function splitLabels(domain: string): string[] {
  let normalized = domain;
  for (const dot of DOT_VARIANTS) normalized = normalized.split(dot).join(".");
  return normalized.split(".");
}

function checkLength(labels: string[], ascii: string): void {
  labels.forEach((label, index) => {
    const isLastEmpty = index === labels.length - 1 && label === "" && labels.length > 1;
    if (!label && !isLastEmpty) throw new Error("The domain has an empty label (two dots in a row, or a leading dot).");
    if (label.length > 63) throw new Error(`The label "${label.slice(0, 20)}…" is longer than 63 characters.`);
    if (label.startsWith("-") || label.endsWith("-")) throw new Error(`The label "${label}" cannot start or end with a hyphen.`);
  });
  if (ascii.replace(/\.$/, "").length > 253) throw new Error("The domain is longer than 253 characters.");
}

const isAscii = (text: string) => Array.from(text).every((c) => c.charCodeAt(0) < 0x80);

/** Convert a Unicode domain (e.g. "bücher.de") to its ASCII form ("xn--bcher-kva.de"). */
export function domainToAscii(domain: string): string {
  const labels = splitLabels(domain.trim().normalize("NFC").toLowerCase()).map((label) => {
    const asciiPart = Array.from(label).filter((c) => c.charCodeAt(0) < 0x80).join("");
    if (asciiPart && !LDH.test(asciiPart)) {
      throw new Error(`The label "${label}" contains spaces or symbols that are not allowed in domain names.`);
    }
    return isAscii(label) ? label : ACE_PREFIX + punycodeEncode(label);
  });
  const ascii = labels.join(".");
  checkLength(labels, ascii);
  return ascii;
}

/** Convert an ASCII domain with xn-- labels back to Unicode. */
export function domainToUnicode(domain: string): string {
  const labels = splitLabels(domain.trim());
  checkLength(labels, labels.join("."));
  return labels
    .map((label) => {
      if (!label.toLowerCase().startsWith(ACE_PREFIX)) return label;
      const encoded = label.slice(ACE_PREFIX.length).toLowerCase();
      if (!encoded) throw new Error(`"${label}" has nothing after the xn-- prefix.`);
      if (!LDH.test(encoded)) throw new Error(`"${label}" contains characters that are not allowed in Punycode.`);
      const decoded = punycodeDecode(encoded);
      if (punycodeEncode(decoded) !== encoded) throw new Error(`"${label}" is not valid Punycode.`);
      return decoded;
    })
    .join(".");
}

const ADDRESS = /^((?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^\s/?#@]*@)?)([^\s/?#:@]+)(.*)$/i;

/**
 * Convert the host inside a domain, URL or email address, leaving the rest
 * (scheme, user, port, path) untouched.
 */
export function convertAddress(address: string, direction: "toAscii" | "toUnicode"): string {
  const match = ADDRESS.exec(address.trim());
  if (!match) throw new Error("Enter a domain name such as bücher.de, a URL or an email address.");
  const [, prefix, host, rest] = match;
  return prefix + (direction === "toAscii" ? domainToAscii(host) : domainToUnicode(host)) + rest;
}
