import "server-only";
import { z } from "zod";
import type {
  CheckStatus,
  HeadersResult,
  PageAsset,
  PageSizeResult,
  RedirectHop,
  RedirectResult,
  SecurityHeaderCheck,
  SiteVerdict,
  StatusResult,
} from "@/tools/lib/server-types";
import { fetchHtmlPage } from "../fetch-page";
import type { ServerToolHandler } from "../index";
import { parseInput, textField, withTimeout } from "../input";
import { fetchFollow, fetchOnce, parsePublicUrl, resolvePublic, ToolInputError, type FetchedResponse } from "../net";
import { extractAssets, parseHtml } from "../page-analysis";

const MAX_HOPS = 10;
const MAX_HEADERS = 100;
const MAX_HEADER_VALUE = 2_000;
const ASSET_LIMIT = 25;
const ASSET_CONCURRENCY = 5;
const ASSET_BUDGET_MS = 8_000;
const HSTS_MIN_AGE = 15_552_000; // 180 days

const urlInput = z.object({ url: textField("Enter a URL, e.g. https://example.com.") });

/* ───────────────────────── Redirect tracing ───────────────────────── */

type Probe = (url: URL) => Promise<FetchedResponse>;

interface Trace {
  hops: RedirectHop[];
  final: FetchedResponse;
  loop: boolean;
  tooMany: boolean;
}

/** Follows redirects one request at a time, validating every Location with the SSRF guards. */
async function traceRedirects(start: URL, probe: Probe): Promise<Trace> {
  const hops: RedirectHop[] = [];
  const visited = new Set<string>();
  let url = start;
  let final: FetchedResponse | null = null;
  let loop = false;
  let tooMany = false;

  for (;;) {
    const key = url.toString();
    if (visited.has(key)) {
      loop = true;
      break;
    }
    if (hops.length > MAX_HOPS) {
      tooMany = true;
      break;
    }
    visited.add(key);

    let response: FetchedResponse;
    try {
      response = await probe(url);
    } catch (error) {
      // The first request failing means the site can't be checked; later failures are part of the chain.
      if (!(error instanceof ToolInputError) || !final) throw error;
      hops.push({ url: key, status: null, statusText: "", location: null, timeMs: 0, error: error.message });
      break;
    }
    final = response;

    const location = response.headers.location ?? null;
    let next: URL | null = null;
    let hopError: string | null = null;
    if (response.status >= 300 && response.status < 400 && location) {
      try {
        next = parsePublicUrl(new URL(location, url).toString());
      } catch (error) {
        hopError = error instanceof ToolInputError ? error.message : "The Location header is not a valid URL.";
      }
    }
    hops.push({
      url: key,
      status: response.status,
      statusText: response.statusText,
      location: next?.toString() ?? location,
      timeMs: response.timeMs,
      error: hopError,
    });
    if (!next) break;
    url = next;
  }

  if (!final) throw new ToolInputError("The URL could not be checked.");
  return { hops, final, loop, tooMany };
}

const getWithoutBody: Probe = (url) => fetchOnce(url, { readBody: false });

/* ───────────────────────── HTTP headers ───────────────────────── */

function securityChecks(headers: Record<string, string>, https: boolean): SecurityHeaderCheck[] {
  const get = (name: string) => headers[name]?.trim() || null;
  const result = (header: string, status: CheckStatus, advice: string): SecurityHeaderCheck => ({
    header,
    status,
    value: get(header.toLowerCase()),
    advice,
  });

  const hsts = get("strict-transport-security");
  const maxAge = Number(hsts?.match(/max-age\s*=\s*"?(\d+)/i)?.[1] ?? 0);
  const csp = get("content-security-policy");
  const xfo = get("x-frame-options")?.toUpperCase() ?? null;
  const nosniff = get("x-content-type-options");
  const referrer = get("referrer-policy");

  return [
    !hsts
      ? result(
          "Strict-Transport-Security",
          "fail",
          https ? "Add HSTS so browsers always use HTTPS." : "Serve the site over HTTPS, then add HSTS.",
        )
      : maxAge >= HSTS_MIN_AGE
        ? result("Strict-Transport-Security", "pass", "Browsers will only connect over HTTPS.")
        : result("Strict-Transport-Security", "warn", "max-age is short; use at least 15552000 (180 days)."),
    csp
      ? result("Content-Security-Policy", "pass", "A content security policy limits where scripts can load from.")
      : get("content-security-policy-report-only")
        ? result("Content-Security-Policy", "warn", "Only a report-only policy is set; it doesn't block anything yet.")
        : result("Content-Security-Policy", "fail", "Add a CSP to reduce the impact of cross-site scripting."),
    xfo === "DENY" || xfo === "SAMEORIGIN"
      ? result("X-Frame-Options", "pass", "Other sites can't embed the page in a frame.")
      : csp && /frame-ancestors/i.test(csp)
        ? result("X-Frame-Options", "pass", "Framing is controlled by the CSP frame-ancestors directive.")
        : xfo
          ? result("X-Frame-Options", "warn", "Use DENY or SAMEORIGIN; other values are ignored by modern browsers.")
          : result("X-Frame-Options", "fail", "Add X-Frame-Options or CSP frame-ancestors to prevent clickjacking."),
    nosniff?.toLowerCase() === "nosniff"
      ? result("X-Content-Type-Options", "pass", "Browsers won't guess content types.")
      : result("X-Content-Type-Options", nosniff ? "warn" : "fail", "Set it to nosniff to stop MIME-type sniffing."),
    !referrer
      ? result("Referrer-Policy", "warn", "Set a policy such as strict-origin-when-cross-origin.")
      : /unsafe-url|no-referrer-when-downgrade/i.test(referrer)
        ? result("Referrer-Policy", "warn", "This policy can leak full URLs to other sites.")
        : result("Referrer-Policy", "pass", "Referrer information is limited."),
    get("permissions-policy")
      ? result("Permissions-Policy", "pass", "Browser features such as camera and location are restricted.")
      : result("Permissions-Policy", "warn", "Add a Permissions-Policy to disable features the site doesn't use."),
  ];
}

const headersInput = urlInput.extend({ followRedirects: z.boolean().default(true) });

const httpHeadersChecker: ServerToolHandler = async (input) => {
  const { url, followRedirects } = parseInput(headersInput, input);
  const start = parsePublicUrl(url);

  let method: "HEAD" | "GET" = "HEAD";
  // HEAD first; some servers reject or mishandle it, so retry those with GET.
  const probe: Probe = async (target) => {
    const head = await fetchOnce(target, { method: "HEAD" });
    if (head.status < 400) {
      method = "HEAD";
      return head;
    }
    method = "GET";
    return fetchOnce(target, { readBody: false });
  };

  let final: FetchedResponse;
  if (followRedirects) {
    const trace = await traceRedirects(start, probe);
    if (trace.loop) throw new ToolInputError("The URL redirects in a loop. Use the Redirect Checker to see the chain.");
    if (trace.tooMany) throw new ToolInputError(`The URL redirects more than ${MAX_HOPS} times.`);
    final = trace.final;
  } else {
    final = await probe(start);
  }

  const headers = Object.entries(final.headers)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, MAX_HEADERS)
    .map(([name, value]) => ({ name, value: value.length > MAX_HEADER_VALUE ? `${value.slice(0, MAX_HEADER_VALUE)}…` : value }));

  const result: HeadersResult = {
    url: start.toString(),
    finalUrl: final.url,
    method,
    status: final.status,
    statusText: final.statusText,
    timeMs: final.timeMs,
    headers,
    security: securityChecks(final.headers, final.url.startsWith("https:")),
  };
  return result;
};

/* ───────────────────────── Redirects ───────────────────────── */

const redirectChecker: ServerToolHandler = async (input) => {
  const start = parsePublicUrl(parseInput(urlInput, input).url);
  const { hops, loop, tooMany } = await traceRedirects(start, getWithoutBody);

  const redirects = hops.filter((h) => h.status !== null && h.status >= 300 && h.status < 400 && h.location);
  const steps = hops.slice(1).map((hop, i) => [new URL(hops[i].url).protocol, new URL(hop.url).protocol]);
  const lastHop = hops[hops.length - 1];

  const result: RedirectResult = {
    hops,
    finalUrl: lastHop.url,
    finalStatus: lastHop.status,
    redirects: redirects.length,
    totalMs: hops.reduce((sum, h) => sum + h.timeMs, 0),
    loop,
    tooMany,
    httpToHttps: steps.some(([from, to]) => from === "http:" && to === "https:"),
    httpsToHttp: steps.some(([from, to]) => from === "https:" && to === "http:"),
    temporary: redirects.some((h) => h.status !== 301 && h.status !== 308),
  };
  return result;
};

/* ───────────────────────── Website status ───────────────────────── */

function verdictFor(status: number): SiteVerdict {
  if (status < 400) return "up";
  if (status === 401 || status === 403 || status === 429) return "restricted";
  return "error";
}

const websiteStatusChecker: ServerToolHandler = async (input) => {
  const start = parsePublicUrl(parseInput(urlInput, input).url);
  // Unknown and private hosts are input errors, not "down" results.
  if (!/^\[|^\d+\.\d+\.\d+\.\d+$/.test(start.hostname)) await resolvePublic(start.hostname);

  const checkedAt = new Date().toISOString();
  const started = Date.now();
  try {
    const { hops, final } = await fetchFollow(start, { maxRedirects: MAX_HOPS, maxBytes: 300_000 });
    const isHtml = /html/i.test(final.headers["content-type"] ?? "");
    const title = isHtml ? parseHtml(final.body).querySelector("title")?.text.replace(/\s+/g, " ").trim() || null : null;
    const result: StatusResult = {
      url: start.toString(),
      finalUrl: final.url,
      verdict: verdictFor(final.status),
      status: final.status,
      statusText: final.statusText,
      timeMs: Date.now() - started,
      redirects: hops.length - 1,
      title: title && title.length > 200 ? `${title.slice(0, 200)}…` : title,
      message: null,
      checkedAt,
    };
    return result;
  } catch (error) {
    if (!(error instanceof ToolInputError)) throw error;
    const result: StatusResult = {
      url: start.toString(),
      finalUrl: start.toString(),
      verdict: "down",
      status: null,
      statusText: "",
      timeMs: Date.now() - started,
      redirects: 0,
      title: null,
      message: error.message,
      checkedAt,
    };
    return result;
  }
};

/* ───────────────────────── Page size ───────────────────────── */

/** HEAD requests for same-origin assets, a few at a time, within an overall time budget. */
async function measureAssets(assets: PageAsset[]): Promise<PageAsset[]> {
  const deadline = Date.now() + ASSET_BUDGET_MS;
  const measured = assets.map((asset) => ({ ...asset }));
  let next = 0;

  async function worker() {
    while (next < measured.length && Date.now() < deadline) {
      const asset = measured[next++];
      try {
        const response = await withTimeout(
          fetchOnce(parsePublicUrl(asset.url), { method: "HEAD" }),
          Math.max(1, deadline - Date.now()),
          "Timed out.",
        );
        const length = response.headers["content-length"];
        asset.status = response.status;
        asset.bytes = response.status < 300 && length && /^\d+$/.test(length) ? Number(length) : null;
      } catch {
        asset.bytes = null;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(ASSET_CONCURRENCY, measured.length) }, worker));
  return measured;
}

const pageSizeChecker: ServerToolHandler = async (input) => {
  const { url, final, timeMs } = await fetchHtmlPage(parseInput(urlInput, input).url, 5_000_000);
  const found = extractAssets(final.body, final.url);
  const origin = new URL(final.url).origin;

  const sameOrigin: PageAsset[] = [
    ...found.stylesheets.map((u) => ({ url: u, kind: "stylesheet" as const })),
    ...found.scripts.map((u) => ({ url: u, kind: "script" as const })),
    ...found.images.map((u) => ({ url: u, kind: "image" as const })),
  ]
    .filter((asset) => new URL(asset.url).origin === origin)
    .map((asset) => ({ ...asset, bytes: null, status: null }));

  const assets = await measureAssets(sameOrigin.slice(0, ASSET_LIMIT));
  const length = final.headers["content-length"];

  const result: PageSizeResult = {
    url: url.toString(),
    finalUrl: final.url,
    status: final.status,
    timeMs,
    htmlBytes: final.truncated ? final.bytes : Buffer.byteLength(final.body),
    htmlTruncated: final.truncated,
    transferBytes: length && /^\d+$/.test(length) ? Number(length) : null,
    contentEncoding: final.headers["content-encoding"] ?? null,
    counts: {
      scripts: found.scripts.length,
      inlineScripts: found.inlineScripts,
      stylesheets: found.stylesheets.length,
      inlineStyles: found.inlineStyles,
      images: found.imageCount,
      iframes: found.iframes,
    },
    assets,
    assetBytes: assets.reduce((sum, a) => sum + (a.bytes ?? 0), 0),
    assetsPartial: sameOrigin.length > ASSET_LIMIT || assets.some((a) => a.bytes === null),
  };
  return result;
};

export const HTTP_HANDLERS: Record<string, ServerToolHandler> = {
  "http-headers-checker": httpHeadersChecker,
  "redirect-checker": redirectChecker,
  "website-status-checker": websiteStatusChecker,
  "page-size-checker": pageSizeChecker,
};
