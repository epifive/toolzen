import { parse, TextNode, type HTMLElement, type Node } from "node-html-parser";
import type { CheckStatus, ExtractedLink, LinkKind, MetaAnalysis, MetaCheck } from "@/tools/lib/server-types";

/**
 * HTML analysis used by the meta tags analyzer, link extractor and page size
 * checker. Pure functions over an HTML string, so they are easy to test.
 */

export const TITLE_RANGE: [number, number] = [30, 60];
export const DESCRIPTION_RANGE: [number, number] = [70, 160];
const MIN_WORDS = 300;
const MAX_TEXT = 300;
const MAX_TAGS = 50;

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
const clip = (text: string, max = MAX_TEXT) => (text.length > max ? `${text.slice(0, max)}…` : text);

function relTokens(el: HTMLElement): string[] {
  return (el.getAttribute("rel") ?? "").toLowerCase().split(/\s+/).filter(Boolean);
}

/** Resolves an href against a base URL; returns null for anything that isn't http(s). */
function resolveHttp(href: string | undefined, base: URL): URL | null {
  if (!href?.trim()) return null;
  try {
    const url = new URL(href.trim(), base);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** The page URL, or the document's <base href> when it has a valid one. */
function documentBase(root: HTMLElement, pageUrl: string): URL {
  const page = new URL(pageUrl);
  return resolveHttp(root.querySelector("base")?.getAttribute("href"), page) ?? page;
}

const siteHost = (hostname: string) => hostname.toLowerCase().replace(/^www\./, "");

/** Text of every text node, space-separated so adjacent inline elements don't merge words. */
function visibleText(node: Node, out: string[] = []): string[] {
  for (const child of node.childNodes) {
    if (child instanceof TextNode) out.push(child.text);
    else visibleText(child, out);
  }
  return out;
}

export function parseHtml(html: string): HTMLElement {
  return parse(html, { comment: false });
}

/* ───────────────────────── Meta tags ───────────────────────── */

function lengthCheck(id: string, label: string, value: string | null, [min, max]: [number, number]): MetaCheck {
  if (!value) return { id, label, status: "fail", message: `The page has no ${label.toLowerCase()}.` };
  const length = value.length;
  if (length < min) return { id, label, status: "warn", message: `${length} characters; aim for ${min}–${max}.` };
  if (length > max) return { id, label, status: "warn", message: `${length} characters; it may be cut off after about ${max}.` };
  return { id, label, status: "pass", message: `${length} characters, a good length.` };
}

const check = (id: string, label: string, status: CheckStatus, message: string): MetaCheck => ({ id, label, status, message });

export function analyzeMeta(html: string, pageUrl: string): MetaAnalysis {
  const root = parseHtml(html);
  const base = documentBase(root, pageUrl);

  const named = new Map<string, string>();
  const openGraph: MetaAnalysis["openGraph"] = [];
  const twitter: MetaAnalysis["twitter"] = [];
  let charset: string | null = null;

  for (const meta of root.querySelectorAll("meta")) {
    const content = normalize(meta.getAttribute("content") ?? "");
    const name = (meta.getAttribute("name") ?? "").toLowerCase().trim();
    const property = (meta.getAttribute("property") ?? "").toLowerCase().trim();
    const httpEquiv = (meta.getAttribute("http-equiv") ?? "").toLowerCase().trim();
    const key = property || name;

    if (meta.getAttribute("charset")) charset ??= meta.getAttribute("charset")?.trim() ?? null;
    if (httpEquiv === "content-type") charset ??= content.match(/charset=([\w-]+)/i)?.[1] ?? null;
    if (key.startsWith("og:") && openGraph.length < MAX_TAGS) openGraph.push({ property: key, content: clip(content) });
    else if (key.startsWith("twitter:") && twitter.length < MAX_TAGS) twitter.push({ name: key, content: clip(content) });
    else if (name && !named.has(name)) named.set(name, content);
  }

  const links = root.querySelectorAll("link");
  const linkHref = (rel: string) => {
    const el = links.find((l) => relTokens(l).includes(rel));
    return resolveHttp(el?.getAttribute("href"), base)?.toString() ?? null;
  };

  const title = normalize(root.querySelector("title")?.text ?? "") || null;
  const description = named.get("description") || null;
  const robots = named.get("robots") || null;
  const viewport = named.get("viewport") || null;
  const lang = root.querySelector("html")?.getAttribute("lang")?.trim() || null;
  const canonical = linkHref("canonical");
  const favicon = linkHref("icon") ?? linkHref("apple-touch-icon");
  const hreflang = links
    .filter((l) => relTokens(l).includes("alternate") && l.getAttribute("hreflang"))
    .slice(0, MAX_TAGS)
    .map((l) => ({ lang: l.getAttribute("hreflang")?.trim() ?? "", href: resolveHttp(l.getAttribute("href"), base)?.toString() ?? "" }));

  const headingTexts = (tag: string) => root.querySelectorAll(tag).map((h) => clip(normalize(h.text)));
  const h1All = headingTexts("h1");
  const h2All = headingTexts("h2");

  const images = root.querySelectorAll("img");
  const imagesWithoutAlt = images.filter((img) => img.getAttribute("alt") === undefined).length;

  for (const el of root.querySelectorAll("script, style, noscript, template, svg")) el.remove();
  const bodyText = visibleText(root.querySelector("body") ?? root).join(" ");
  const wordCount = bodyText.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;

  const ogTags = new Set(openGraph.map((t) => t.property));
  const ogMissing = ["og:title", "og:description", "og:image"].filter((t) => !ogTags.has(t));
  const noindex = robots ? /\bnoindex\b|\bnone\b/i.test(robots) : false;

  const checks: MetaCheck[] = [
    lengthCheck("title", "Title", title, TITLE_RANGE),
    lengthCheck("description", "Meta description", description, DESCRIPTION_RANGE),
    h1All.length === 1
      ? check("h1", "H1 heading", "pass", "The page has exactly one H1.")
      : h1All.length === 0
        ? check("h1", "H1 heading", "fail", "Add one H1 heading that describes the page.")
        : check("h1", "H1 heading", "warn", `The page has ${h1All.length} H1 headings; one is clearer.`),
    canonical
      ? check("canonical", "Canonical URL", "pass", "A canonical URL is set.")
      : check("canonical", "Canonical URL", "warn", "Add a canonical link to avoid duplicate-content issues."),
    viewport
      ? check("viewport", "Mobile viewport", "pass", "A viewport meta tag is set.")
      : check("viewport", "Mobile viewport", "fail", "Add a viewport meta tag so the page displays correctly on phones."),
    lang
      ? check("lang", "Language", "pass", `The page declares its language (${clip(lang, 20)}).`)
      : check("lang", "Language", "warn", "Add a lang attribute to the <html> tag."),
    noindex
      ? check("robots", "Indexing", "warn", "The robots meta tag asks search engines not to index this page.")
      : check("robots", "Indexing", "pass", "Search engines are allowed to index the page."),
    ogMissing.length === 0
      ? check("og", "Open Graph", "pass", "og:title, og:description and og:image are set.")
      : check("og", "Open Graph", "warn", `Missing ${ogMissing.join(", ")}; shared links may look plain.`),
    twitter.some((t) => t.name === "twitter:card")
      ? check("twitter", "Twitter card", "pass", "A twitter:card tag is set.")
      : check("twitter", "Twitter card", "warn", "Add a twitter:card tag for a rich preview on X."),
    imagesWithoutAlt === 0
      ? check("alt", "Image alt text", "pass", images.length ? "Every image has an alt attribute." : "The page has no images.")
      : check("alt", "Image alt text", "warn", `${imagesWithoutAlt} of ${images.length} images have no alt attribute.`),
    wordCount >= MIN_WORDS
      ? check("words", "Content length", "pass", `${wordCount.toLocaleString("en-US")} words of text.`)
      : check(
          "words",
          "Content length",
          "warn",
          `Only ${wordCount.toLocaleString("en-US")} words; pages with more useful text tend to rank better.`,
        ),
    favicon
      ? check("favicon", "Favicon", "pass", "A favicon is declared.")
      : check("favicon", "Favicon", "warn", "No favicon link found; browsers will try /favicon.ico."),
    charset
      ? check("charset", "Character set", "pass", `Declared as ${clip(charset, 30)}.`)
      : check("charset", "Character set", "warn", "Declare the character set with <meta charset=\"utf-8\">."),
  ];
  const points = checks.reduce((sum, c) => sum + (c.status === "pass" ? 1 : c.status === "warn" ? 0.5 : 0), 0);

  return {
    title,
    description,
    canonical,
    robots,
    viewport,
    lang,
    charset,
    favicon,
    h1: h1All.slice(0, 10),
    h1Count: h1All.length,
    h2: h2All.slice(0, 10),
    h2Count: h2All.length,
    openGraph,
    twitter,
    hreflang,
    images: images.length,
    imagesWithoutAlt,
    wordCount,
    checks,
    score: Math.round((points / checks.length) * 100),
  };
}

/* ───────────────────────── Links ───────────────────────── */

export function extractLinks(html: string, pageUrl: string, limit: number) {
  const root = parseHtml(html);
  const base = documentBase(root, pageUrl);
  const host = siteHost(new URL(pageUrl).hostname);
  const links: ExtractedLink[] = [];

  for (const a of root.querySelectorAll("a")) {
    const href = a.getAttribute("href")?.trim();
    if (!href || href.startsWith("#") || /^javascript:/i.test(href)) continue;

    let url: string;
    let kind: LinkKind;
    if (/^mailto:/i.test(href)) {
      url = href;
      kind = "email";
    } else if (/^tel:/i.test(href)) {
      url = href;
      kind = "phone";
    } else {
      const resolved = resolveHttp(href, base);
      if (!resolved) continue;
      url = resolved.toString();
      kind = siteHost(resolved.hostname) === host ? "internal" : "external";
    }

    const imageAlt = a.querySelector("img")?.getAttribute("alt")?.trim();
    const text = normalize(a.text) || (imageAlt ? `[image] ${imageAlt}` : "");
    links.push({
      url: clip(url, 2048),
      text: clip(text, 200),
      kind,
      rel: relTokens(a).filter((r) => ["nofollow", "sponsored", "ugc", "noopener", "noreferrer"].includes(r)),
      newTab: a.getAttribute("target")?.toLowerCase() === "_blank",
    });
  }

  return {
    total: links.length,
    unique: new Set(links.map((l) => l.url)).size,
    links: links.slice(0, limit),
    limited: links.length > limit,
  };
}

/* ───────────────────────── Assets ───────────────────────── */

export interface PageAssets {
  scripts: string[];
  inlineScripts: number;
  stylesheets: string[];
  inlineStyles: number;
  images: string[];
  imageCount: number;
  iframes: number;
}

export function extractAssets(html: string, pageUrl: string): PageAssets {
  const root = parseHtml(html);
  const base = documentBase(root, pageUrl);
  const unique = (values: Array<string | undefined>) => [
    ...new Set(values.map((v) => resolveHttp(v, base)?.toString()).filter((v): v is string => Boolean(v))),
  ];

  const scripts = root.querySelectorAll("script");
  const images = root.querySelectorAll("img");
  return {
    scripts: unique(scripts.map((s) => s.getAttribute("src"))),
    inlineScripts: scripts.filter((s) => !s.getAttribute("src")).length,
    stylesheets: unique(root.querySelectorAll("link").filter((l) => relTokens(l).includes("stylesheet")).map((l) => l.getAttribute("href"))),
    inlineStyles: root.querySelectorAll("style").length,
    images: unique(images.map((img) => img.getAttribute("src"))),
    imageCount: images.length,
    iframes: root.querySelectorAll("iframe").length,
  };
}
