/**
 * Result shapes returned by the server-side SEO & web tools. Shared by the
 * API handlers (src/lib/server-tools/handlers) and the tool components.
 */

export type CheckStatus = "pass" | "warn" | "fail";

/* ───────────────────────── DNS ───────────────────────── */

export const DNS_RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "CAA", "SRV"] as const;
export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];

export interface DnsRecord {
  /** Record data in zone-file notation, e.g. "10 mail.example.com" for MX. */
  value: string;
  /** Time to live in seconds (only reported for A and AAAA records). */
  ttl: number | null;
}

export interface DnsTypeResult {
  type: DnsRecordType;
  records: DnsRecord[];
  /** Set when the lookup for this type failed for a reason other than "no records". */
  error: string | null;
}

export interface DnsLookupResult {
  domain: string;
  resolvers: string[];
  results: DnsTypeResult[];
  timeMs: number;
}

export interface ReverseDnsResult {
  ip: string;
  version: 4 | 6;
  hostnames: Array<{ hostname: string; forwardConfirmed: boolean; addresses: string[] }>;
  timeMs: number;
}

export interface MyIpResult {
  ip: string | null;
  version: 4 | 6 | null;
  isPublic: boolean;
  hostnames: string[];
  userAgent: string;
  language: string;
}

/* ───────────────────────── WHOIS (RDAP) ───────────────────────── */

export interface WhoisResult {
  domain: string;
  registrar: string | null;
  registrarIanaId: string | null;
  registrarUrl: string | null;
  abuseEmail: string | null;
  abusePhone: string | null;
  created: string | null;
  updated: string | null;
  expires: string | null;
  ageDays: number | null;
  daysToExpiry: number | null;
  status: string[];
  nameservers: string[];
  dnssec: boolean | null;
  rdapServer: string;
  /** Pretty-printed RDAP response, or an empty string when it was too large to return. */
  raw: string;
}

/* ───────────────────────── SSL ───────────────────────── */

export interface CertificateSummary {
  subject: string;
  issuer: string;
  validTo: string | null;
  selfSigned: boolean;
}

export interface SslResult {
  host: string;
  ip: string;
  protocol: string | null;
  cipher: string | null;
  authorized: boolean;
  authorizationError: string | null;
  hostnameMatch: boolean;
  chainTrusted: boolean;
  subject: string;
  issuer: string;
  sans: string[];
  validFrom: string | null;
  validTo: string | null;
  daysRemaining: number | null;
  serialNumber: string;
  fingerprint256: string;
  keyInfo: string | null;
  chain: CertificateSummary[];
}

/* ───────────────────────── HTTP ───────────────────────── */

export interface SecurityHeaderCheck {
  header: string;
  status: CheckStatus;
  value: string | null;
  advice: string;
}

export interface HeadersResult {
  url: string;
  finalUrl: string;
  method: "HEAD" | "GET";
  status: number;
  statusText: string;
  timeMs: number;
  headers: Array<{ name: string; value: string }>;
  security: SecurityHeaderCheck[];
}

export interface RedirectHop {
  url: string;
  status: number | null;
  statusText: string;
  location: string | null;
  timeMs: number;
  error: string | null;
}

export interface RedirectResult {
  hops: RedirectHop[];
  finalUrl: string;
  finalStatus: number | null;
  redirects: number;
  totalMs: number;
  loop: boolean;
  tooMany: boolean;
  httpToHttps: boolean;
  httpsToHttp: boolean;
  temporary: boolean;
}

export type SiteVerdict = "up" | "restricted" | "error" | "down";

export interface StatusResult {
  url: string;
  finalUrl: string;
  verdict: SiteVerdict;
  status: number | null;
  statusText: string;
  timeMs: number;
  redirects: number;
  title: string | null;
  message: string | null;
  checkedAt: string;
}

export interface PageAsset {
  url: string;
  kind: "script" | "stylesheet" | "image";
  bytes: number | null;
  status: number | null;
}

export interface PageSizeResult {
  url: string;
  finalUrl: string;
  status: number;
  timeMs: number;
  htmlBytes: number;
  htmlTruncated: boolean;
  transferBytes: number | null;
  contentEncoding: string | null;
  counts: {
    scripts: number;
    inlineScripts: number;
    stylesheets: number;
    inlineStyles: number;
    images: number;
    iframes: number;
  };
  assets: PageAsset[];
  assetBytes: number;
  /** True when some assets were skipped because of the per-request limit or time budget. */
  assetsPartial: boolean;
}

/* ───────────────────────── Page analysis ───────────────────────── */

export interface MetaCheck {
  id: string;
  label: string;
  status: CheckStatus;
  message: string;
}

export interface MetaAnalysis {
  title: string | null;
  description: string | null;
  canonical: string | null;
  robots: string | null;
  viewport: string | null;
  lang: string | null;
  charset: string | null;
  favicon: string | null;
  h1: string[];
  h1Count: number;
  h2: string[];
  h2Count: number;
  openGraph: Array<{ property: string; content: string }>;
  twitter: Array<{ name: string; content: string }>;
  hreflang: Array<{ lang: string; href: string }>;
  images: number;
  imagesWithoutAlt: number;
  wordCount: number;
  checks: MetaCheck[];
  score: number;
}

export interface MetaResult extends MetaAnalysis {
  url: string;
  finalUrl: string;
  status: number;
  timeMs: number;
  truncated: boolean;
}

export type LinkKind = "internal" | "external" | "email" | "phone";

export interface ExtractedLink {
  url: string;
  text: string;
  kind: LinkKind;
  rel: string[];
  newTab: boolean;
}

export interface LinkResult {
  url: string;
  finalUrl: string;
  total: number;
  unique: number;
  links: ExtractedLink[];
  /** True when the page had more links than the tool returns. */
  limited: boolean;
}

/* ───────────────────────── robots.txt ───────────────────────── */

export interface RobotsResult {
  robotsUrl: string;
  status: number;
  /** "found": file served; "missing": 4xx (everything allowed); "error": 5xx (Google treats the site as disallowed). */
  state: "found" | "missing" | "error";
  content: string;
  truncated: boolean;
}
