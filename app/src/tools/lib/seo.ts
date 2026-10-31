/**
 * Pure helpers shared by the SEO & web tools: HTML/robots/.htaccess builders,
 * QR payload formats, password generation and text analysis. Nothing here
 * touches the DOM, so every function can be reasoned about in isolation.
 */

/* ───────────────────────── Escaping ───────────────────────── */

/** Escape text for use inside a double-quoted HTML attribute. */
export function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Escape text for use as HTML element content. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Escape a string for literal use inside a regular expression (also valid for Apache PCRE). */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True for absolute http(s) URLs. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Collapse whitespace, the way search engines and social networks display titles. */
export function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Shorten text at a word boundary and add an ellipsis, like a search result snippet. */
export function truncateText(value: string, max: number): string {
  const text = normalizeSpace(value);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, "")} …`;
}

/** "https://www.example.com/blog/post?x=1" → "www.example.com › blog › post" */
export function urlBreadcrumb(value: string): string {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean).map(decodeSafe);
    return [url.host, ...parts].join(" › ");
  } catch {
    return value;
  }
}

function decodeSafe(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

/* ───────────────────────── Meta tags ───────────────────────── */

export interface MetaTagInput {
  title: string;
  description: string;
  keywords: string;
  author: string;
  canonical: string;
  index: boolean;
  follow: boolean;
  viewport: string;
  charset: string;
  language: string;
  themeColor: string;
}

export function buildMetaTags(input: MetaTagInput): string {
  const lines: string[] = [];
  const meta = (name: string, content: string) => {
    if (content.trim()) lines.push(`<meta name="${name}" content="${escapeAttribute(normalizeSpace(content))}">`);
  };

  if (input.charset.trim()) lines.push(`<meta charset="${escapeAttribute(input.charset.trim())}">`);
  meta("viewport", input.viewport);
  if (input.title.trim()) lines.push(`<title>${escapeHtml(normalizeSpace(input.title))}</title>`);
  meta("description", input.description);
  meta(
    "keywords",
    input.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
      .join(", "),
  );
  meta("author", input.author);
  meta("robots", `${input.index ? "index" : "noindex"}, ${input.follow ? "follow" : "nofollow"}`);
  if (input.canonical.trim()) lines.push(`<link rel="canonical" href="${escapeAttribute(input.canonical.trim())}">`);
  if (input.language.trim()) {
    lines.push(`<meta http-equiv="content-language" content="${escapeAttribute(input.language.trim())}">`);
  }
  meta("theme-color", input.themeColor);
  return lines.join("\n");
}

/* ───────────────────────── Open Graph ───────────────────────── */

export type OgType = "website" | "article" | "product";
export type TwitterCard = "summary" | "summary_large_image";

export interface OpenGraphInput {
  title: string;
  description: string;
  url: string;
  image: string;
  imageAlt: string;
  type: OgType;
  siteName: string;
  twitterCard: TwitterCard;
  twitterSite: string;
}

export function buildOpenGraphTags(input: OpenGraphInput): string {
  const lines: string[] = [];
  const tag = (attr: "property" | "name", key: string, content: string) => {
    if (content.trim()) lines.push(`<meta ${attr}="${key}" content="${escapeAttribute(normalizeSpace(content))}">`);
  };
  tag("property", "og:type", input.type);
  tag("property", "og:title", input.title);
  tag("property", "og:description", input.description);
  tag("property", "og:url", input.url);
  tag("property", "og:site_name", input.siteName);
  tag("property", "og:image", input.image);
  tag("property", "og:image:alt", input.image.trim() ? input.imageAlt : "");
  tag("name", "twitter:card", input.twitterCard);
  const handle = input.twitterSite.trim().replace(/^@*/, "");
  tag("name", "twitter:site", handle ? `@${handle}` : "");
  tag("name", "twitter:title", input.title);
  tag("name", "twitter:description", input.description);
  tag("name", "twitter:image", input.image);
  tag("name", "twitter:image:alt", input.image.trim() ? input.imageAlt : "");
  return lines.join("\n");
}

/* ───────────────────────── robots.txt ───────────────────────── */

export interface RobotsRule {
  type: "allow" | "disallow";
  path: string;
}

export interface RobotsGroup {
  userAgent: string;
  rules: RobotsRule[];
  /** Seconds between requests; ignored when not a positive number. */
  crawlDelay: number | null;
}

/** Paths must start with "/" (or "*" for wildcards); add the slash if it was forgotten. */
export function normalizeRobotsPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("/") || trimmed.startsWith("*") ? trimmed : `/${trimmed}`;
}

export function buildRobotsTxt(groups: RobotsGroup[], sitemaps: string[]): string {
  const blocks = groups.map((group) => {
    const lines = [`User-agent: ${group.userAgent.trim() || "*"}`];
    const rules = group.rules.map((r) => ({ ...r, path: normalizeRobotsPath(r.path) })).filter((r) => r.path);
    // Every group needs at least one rule; an empty group means "crawl everything".
    if (!rules.length) lines.push("Allow: /");
    for (const rule of rules) lines.push(`${rule.type === "allow" ? "Allow" : "Disallow"}: ${rule.path}`);
    if (group.crawlDelay && group.crawlDelay > 0) lines.push(`Crawl-delay: ${group.crawlDelay}`);
    return lines.join("\n");
  });
  const maps = sitemaps.map((s) => s.trim()).filter(Boolean);
  if (maps.length) blocks.push(maps.map((s) => `Sitemap: ${s}`).join("\n"));
  return `${blocks.join("\n\n")}\n`;
}

/* ───────────────────────── UTM ───────────────────────── */

export const UTM_FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
export type UtmField = (typeof UTM_FIELDS)[number];
export type UtmParams = Record<UtmField, string>;

export type UtmResult = { ok: true; url: string; addedScheme: boolean } | { ok: false; error: string };

/**
 * Add UTM parameters to a URL. Existing query parameters and the #fragment are kept;
 * existing utm_* values are replaced. A missing scheme defaults to https://.
 */
export function buildUtmUrl(base: string, params: UtmParams): UtmResult {
  const trimmed = base.trim();
  if (!trimmed) return { ok: false, error: "Enter the URL of the page you want to track." };
  const addedScheme = !/^[a-z][a-z\d+.-]*:/i.test(trimmed);
  let url: URL;
  try {
    url = new URL(addedScheme ? `https://${trimmed}` : trimmed);
  } catch {
    return { ok: false, error: "This doesn't look like a valid URL. Check for typos or spaces." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Only http:// and https:// links can be tracked." };
  }
  if (!url.hostname.includes(".") && url.hostname !== "localhost") {
    return { ok: false, error: "The URL needs a full domain name, such as example.com." };
  }
  for (const field of UTM_FIELDS) {
    const value = params[field].trim();
    if (value) url.searchParams.set(field, value);
    else url.searchParams.delete(field);
  }
  return { ok: true, url: url.toString(), addedScheme };
}

/* ───────────────────────── QR payloads ───────────────────────── */

export type WifiEncryption = "WPA" | "WEP" | "nopass";

/** Escape a value for the WIFI: QR format (backslash before \ ; , : and "). */
export function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

export function wifiPayload(ssid: string, password: string, encryption: WifiEncryption, hidden: boolean): string {
  const parts = [`T:${encryption}`, `S:${escapeWifi(ssid)}`];
  if (encryption !== "nopass") parts.push(`P:${escapeWifi(password)}`);
  if (hidden) parts.push("H:true");
  return `WIFI:${parts.join(";")};;`;
}

export function mailtoPayload(to: string, subject: string, body: string): string {
  const query = [subject ? `subject=${encodeURIComponent(subject)}` : "", body ? `body=${encodeURIComponent(body)}` : ""].filter(
    Boolean,
  );
  return `mailto:${to.trim()}${query.length ? `?${query.join("&")}` : ""}`;
}

/** Keep only characters that are meaningful in a phone number. */
export function cleanPhone(value: string): string {
  return value.replace(/[^\d+*#]/g, "");
}

export function smsPayload(phone: string, message: string): string {
  return `SMSTO:${cleanPhone(phone)}:${message}`;
}

export interface VCardInput {
  firstName: string;
  lastName: string;
  organization: string;
  title: string;
  phone: string;
  email: string;
  website: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

/** Escape a vCard 3.0 text value (RFC 2426). */
export function escapeVCard(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/([;,])/g, "\\$1")
    .replace(/\r?\n/g, "\\n");
}

export function vCardPayload(input: VCardInput): string {
  const v = (s: string) => escapeVCard(s.trim());
  const fullName = normalizeSpace(`${input.firstName} ${input.lastName}`);
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${v(input.lastName)};${v(input.firstName)};;;`, `FN:${v(fullName)}`];
  if (input.organization.trim()) lines.push(`ORG:${v(input.organization)}`);
  if (input.title.trim()) lines.push(`TITLE:${v(input.title)}`);
  if (input.phone.trim()) lines.push(`TEL;TYPE=CELL:${cleanPhone(input.phone)}`);
  if (input.email.trim()) lines.push(`EMAIL;TYPE=INTERNET:${v(input.email)}`);
  if (input.website.trim()) lines.push(`URL:${v(input.website)}`);
  const address = [input.street, input.city, input.region, input.postalCode, input.country];
  if (address.some((p) => p.trim())) lines.push(`ADR;TYPE=WORK:;;${address.map(v).join(";")}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

/* ───────────────────────── .htaccess ───────────────────────── */

export interface PageRedirect {
  from: string;
  to: string;
  code: 301 | 302;
}

export interface HtaccessOptions {
  redirects: PageRedirect[];
  /** Move every request from oldDomain to newDomain, keeping the path. */
  domainMove: { oldDomain: string; newDomain: string } | null;
  forceHttps: boolean;
  /** Canonical host: add or remove the www. prefix. */
  www: "keep" | "www" | "non-www";
  removeTrailingSlash: boolean;
  /** Path of a custom 404 page, e.g. /404.html. */
  notFoundPage: string;
}

/** "https://www.Example.com/path" → "www.example.com" */
export function cleanDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "");
}

/** Split "/old-page?id=3" into a RewriteRule pattern and an optional query condition. */
function redirectSource(from: string): { pattern: string; query: string } {
  const value = from.trim().replace(/^https?:\/\/[^/]+/i, "");
  const [rawPath, ...rest] = value.split("?");
  const path = rawPath.replace(/^\/+/, "").replace(/\/+$/, "");
  return {
    pattern: path ? `^${escapeRegex(path)}/?$` : "^$",
    query: rest.join("?"),
  };
}

/**
 * Substitution strings treat %N and $N as back-references, so escape them
 * (a URL-encoded "%20" would otherwise become back-reference %2 followed by "0").
 */
function rewriteTarget(to: string): string {
  return to.trim().replace(/([%$])(\d)/g, "\\$1$2");
}

/** Problems with the options that would produce a broken file; empty when everything is fine. */
export function validateHtaccess(options: HtaccessOptions): string[] {
  const errors: string[] = [];
  options.redirects.forEach((r, i) => {
    if (!r.from.trim() && !r.to.trim()) return;
    if (!r.from.trim()) errors.push(`Redirect ${i + 1}: enter the old path.`);
    if (!r.to.trim()) errors.push(`Redirect ${i + 1}: enter the new URL.`);
    else if (!isHttpUrl(r.to.trim()) && !r.to.trim().startsWith("/")) {
      errors.push(`Redirect ${i + 1}: the new URL must start with https://, http:// or /.`);
    }
    if (/\s/.test(r.from.trim()) || /\s/.test(r.to.trim())) errors.push(`Redirect ${i + 1}: URLs can't contain spaces.`);
  });
  if (options.domainMove) {
    const { oldDomain, newDomain } = options.domainMove;
    const domain = /^[a-z\d-]+(\.[a-z\d-]+)+$/;
    if (!domain.test(cleanDomain(oldDomain))) errors.push("Enter the old domain, for example old-site.com.");
    if (!domain.test(cleanDomain(newDomain))) errors.push("Enter the new domain, for example new-site.com.");
  }
  const page = options.notFoundPage.trim();
  if (page && (!page.startsWith("/") || /\s/.test(page)))
    errors.push("The 404 page must be a path starting with /, such as /404.html.");
  return errors;
}

export function buildHtaccess(options: HtaccessOptions): string {
  const blocks: string[] = [];
  const scheme = options.forceHttps ? "https" : "%{REQUEST_SCHEME}";

  const redirects = options.redirects.filter((r) => r.from.trim() && r.to.trim());
  if (redirects.length) {
    const lines = ["# Page redirects"];
    for (const r of redirects) {
      const { pattern, query } = redirectSource(r.from);
      if (query) lines.push(`RewriteCond %{QUERY_STRING} ^${escapeRegex(query)}$`);
      lines.push(`RewriteRule ${pattern} ${rewriteTarget(r.to)} [R=${r.code},NE,L${query ? ",QSD" : ""}]`);
    }
    blocks.push(lines.join("\n"));
  }

  if (options.domainMove) {
    const oldDomain = cleanDomain(options.domainMove.oldDomain).replace(/^www\./, "");
    const newDomain = cleanDomain(options.domainMove.newDomain);
    blocks.push(
      [
        "# Move the whole site to the new domain, keeping the path",
        `RewriteCond %{HTTP_HOST} ^(www\\.)?${escapeRegex(oldDomain)}$ [NC]`,
        `RewriteRule ^(.*)$ https://${newDomain}/$1 [R=301,L]`,
      ].join("\n"),
    );
  }

  if (options.forceHttps) {
    blocks.push(
      [
        "# Force HTTPS",
        "RewriteCond %{HTTPS} off",
        "RewriteCond %{HTTP:X-Forwarded-Proto} !https",
        "RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]",
      ].join("\n"),
    );
  }

  if (options.www === "www") {
    blocks.push(
      [
        "# Force www.",
        "RewriteCond %{HTTP_HOST} !^www\\. [NC]",
        `RewriteRule ^ ${scheme}://www.%{HTTP_HOST}%{REQUEST_URI} [R=301,L]`,
      ].join("\n"),
    );
  } else if (options.www === "non-www") {
    blocks.push(
      [
        "# Remove www.",
        "RewriteCond %{HTTP_HOST} ^www\\.(.+)$ [NC]",
        `RewriteRule ^ ${scheme}://%1%{REQUEST_URI} [R=301,L]`,
      ].join("\n"),
    );
  }

  if (options.removeTrailingSlash) {
    blocks.push(
      [
        "# Remove trailing slashes (except for real directories)",
        "RewriteCond %{REQUEST_FILENAME} !-d",
        "RewriteCond %{REQUEST_URI} (.+)/$",
        "RewriteRule ^ %1 [R=301,L]",
      ].join("\n"),
    );
  }

  const sections: string[] = [];
  if (blocks.length) {
    sections.push(["<IfModule mod_rewrite.c>", "RewriteEngine On", "", blocks.join("\n\n"), "</IfModule>"].join("\n"));
  }
  const page = options.notFoundPage.trim();
  if (page) sections.push(`# Custom 404 page\nErrorDocument 404 ${page}`);
  return sections.length ? `${sections.join("\n\n")}\n` : "";
}

/* ───────────────────────── Passwords ───────────────────────── */

export const CHARSETS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.<>/?~|`'\"\\",
} as const;

export type CharsetName = keyof typeof CHARSETS;

const SIMILAR = new Set("Il1O0");
const AMBIGUOUS = new Set("{}[]()/\\'\"`~,;:.<>");

export interface PasswordOptions {
  length: number;
  sets: Record<CharsetName, boolean>;
  excludeSimilar: boolean;
  excludeAmbiguous: boolean;
}

/** Uniform random integer in [0, max) using crypto.getRandomValues and rejection sampling (no modulo bias). */
export function secureRandomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0 || max > 2 ** 32) throw new RangeError("max must be an integer in 1..2^32");
  const limit = Math.floor(2 ** 32 / max) * max;
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < limit) return buffer[0] % max;
  }
}

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** Characters of each selected set after the exclusion options are applied. */
export function activeCharsets(options: PasswordOptions): string[] {
  return (Object.keys(CHARSETS) as CharsetName[])
    .filter((name) => options.sets[name])
    .map((name) =>
      [...CHARSETS[name]]
        .filter((c) => !(options.excludeSimilar && SIMILAR.has(c)))
        .filter((c) => !(options.excludeAmbiguous && AMBIGUOUS.has(c)))
        .join(""),
    )
    .filter(Boolean);
}

/** A random password that contains at least one character from every selected set. */
export function generatePassword(options: PasswordOptions): string {
  const sets = activeCharsets(options);
  if (!sets.length) return "";
  const pool = sets.join("");
  const chars = sets.slice(0, options.length).map((set) => set[secureRandomInt(set.length)]);
  while (chars.length < options.length) chars.push(pool[secureRandomInt(pool.length)]);
  return shuffle(chars).join("");
}

export function passwordEntropy(options: PasswordOptions): number {
  const pool = activeCharsets(options).join("").length;
  return pool ? options.length * Math.log2(pool) : 0;
}

export interface PassphraseOptions {
  words: number;
  separator: string;
  capitalize: boolean;
  addNumber: boolean;
}

export function generatePassphrase(wordlist: readonly string[], options: PassphraseOptions): string {
  const words = Array.from({ length: options.words }, () => {
    const word = wordlist[secureRandomInt(wordlist.length)];
    return options.capitalize ? word.charAt(0).toUpperCase() + word.slice(1) : word;
  });
  if (options.addNumber && words.length) {
    const index = secureRandomInt(words.length);
    words[index] = `${words[index]}${secureRandomInt(100)}`;
  }
  return words.join(options.separator);
}

export function passphraseEntropy(wordlistSize: number, options: PassphraseOptions): number {
  const base = options.words * Math.log2(wordlistSize);
  return options.addNumber ? base + Math.log2(100 * options.words) : base;
}

export interface Strength {
  label: string;
  /** 0 (very weak) to 4 (very strong). */
  score: number;
}

/** Rate entropy in bits on the familiar five-step scale. */
export function strengthFromEntropy(bits: number): Strength {
  if (bits < 28) return { label: "Very weak", score: 0 };
  if (bits < 36) return { label: "Weak", score: 1 };
  if (bits < 60) return { label: "Fair", score: 2 };
  if (bits < 128) return { label: "Strong", score: 3 };
  return { label: "Very strong", score: 4 };
}

/* ───────────────────────── Keyword density ───────────────────────── */

export const STOP_WORDS = new Set(
  (
    "a about above after again against all am an and any are aren't as at be because been before being below between both " +
    "but by can can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from further " +
    "had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how how's " +
    "i i'd i'll i'm i've if in into is isn't it it's its itself just let's me more most mustn't my myself no nor not now of " +
    "off on once only or other ought our ours ourselves out over own same shan't she she'd she'll she's should shouldn't so " +
    "some such than that that's the their theirs them themselves then there there's these they they'd they'll they're " +
    "they've this those through to too under until up very was wasn't we we'd we'll we're we've were weren't what what's " +
    "when when's where where's which while who who's whom why why's will with won't would wouldn't you you'd you'll you're " +
    "you've your yours yourself yourselves also may might must shall us get got one two"
  ).split(" "),
);

export interface Token {
  /** Lower-cased word with typographic apostrophes normalised. */
  word: string;
  start: number;
  end: number;
  /** Index of the sentence or clause the word belongs to; phrases never span clauses. */
  clause: number;
}

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
const CLAUSE_BREAK = /[.!?;:()[\]{}"“”|\n]/;

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let clause = 0;
  let previousEnd = 0;
  for (const match of text.matchAll(WORD_PATTERN)) {
    const start = match.index ?? 0;
    if (CLAUSE_BREAK.test(text.slice(previousEnd, start))) clause++;
    tokens.push({ word: match[0].toLowerCase().replace(/’/g, "'"), start, end: start + match[0].length, clause });
    previousEnd = start + match[0].length;
  }
  return tokens;
}

export interface PhraseStat {
  phrase: string;
  count: number;
  /** Occurrences × words in the phrase ÷ total words × 100. */
  density: number;
}

export interface DensityOptions {
  /** Size of the phrases: 1, 2 or 3 words. */
  size: number;
  ignoreStopWords: boolean;
  minLength: number;
  limit: number;
}

/**
 * Most frequent phrases of a given size. With filters on, a phrase is skipped
 * when its first or last word is a stop word or shorter than the minimum length.
 */
export function phraseFrequency(tokens: Token[], options: DensityOptions): PhraseStat[] {
  const excluded = (word: string) => [...word].length < options.minLength || (options.ignoreStopWords && STOP_WORDS.has(word));
  const counts = new Map<string, number>();
  for (let i = 0; i + options.size <= tokens.length; i++) {
    const slice = tokens.slice(i, i + options.size);
    if (slice[slice.length - 1].clause !== slice[0].clause) continue;
    if (excluded(slice[0].word) || excluded(slice[slice.length - 1].word)) continue;
    const phrase = slice.map((t) => t.word).join(" ");
    counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
  }
  const total = tokens.length;
  return [...counts.entries()]
    .filter(([, count]) => options.size === 1 || count > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, options.limit)
    .map(([phrase, count]) => ({ phrase, count, density: total ? ((count * options.size) / total) * 100 : 0 }));
}

/** Character ranges [start, end) where a phrase occurs, for highlighting. */
export function phraseRanges(tokens: Token[], phrase: string): Array<[number, number]> {
  const words = phrase.split(" ");
  const ranges: Array<[number, number]> = [];
  for (let i = 0; i + words.length <= tokens.length; i++) {
    const slice = tokens.slice(i, i + words.length);
    if (slice[slice.length - 1].clause !== slice[0].clause) continue;
    if (slice.every((t, j) => t.word === words[j])) ranges.push([slice[0].start, slice[slice.length - 1].end]);
  }
  return ranges;
}
