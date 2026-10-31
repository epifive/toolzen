/**
 * robots.txt parser and matcher following Google's rules (RFC 9309):
 * - the crawler obeys the group with the most specific matching user-agent
 *   (groups naming the same agent are merged), falling back to "*";
 * - the longest matching rule wins; on a tie, Allow wins;
 * - "*" matches any sequence of characters and a trailing "$" anchors the end.
 *
 * Pure logic with no Node.js APIs, so the robots.txt tester can also re-run
 * tests in the browser without fetching the file again.
 */

export type RobotsRuleType = "allow" | "disallow";

export interface ParsedRule {
  type: RobotsRuleType;
  path: string;
  line: number;
}

export interface ParsedGroup {
  agents: string[];
  rules: ParsedRule[];
}

export interface ParsedRobots {
  groups: ParsedGroup[];
  sitemaps: string[];
}

export interface RobotsVerdict {
  allowed: boolean;
  /** The user-agent line of the group that applies, or null when no group applies. */
  group: string | null;
  /** The deciding rule, or null when nothing matched (allowed by default). */
  rule: ParsedRule | null;
}

const MAX_LINES = 20_000;

/** Lower-cased product token: the leading letters, "_" and "-" of a user-agent name. */
export function productToken(agent: string): string {
  return (agent.trim().match(/^[a-z_-]+/i)?.[0] ?? "").toLowerCase();
}

export function parseRobots(text: string): ParsedRobots {
  const groups: ParsedGroup[] = [];
  const sitemaps: string[] = [];
  let current: ParsedGroup | null = null;
  let collectingAgents = false;

  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = body.split(/\r\n|\r|\n/).slice(0, MAX_LINES);
  lines.forEach((raw, index) => {
    const line = raw.replace(/#.*$/, "").trim();
    const colon = line.indexOf(":");
    if (colon < 1) return;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (key === "user-agent") {
      if (!collectingAgents || !current) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      if (value) current.agents.push(value);
      collectingAgents = true;
      return;
    }
    if (key === "sitemap") {
      if (value) sitemaps.push(value);
      return;
    }
    if (key === "allow" || key === "disallow") {
      collectingAgents = false;
      // Rules before the first user-agent line belong to no group and are ignored.
      if (current && value) current.rules.push({ type: key, path: value, line: index + 1 });
      return;
    }
    // Other directives (crawl-delay, host, …) end the user-agent list but don't affect matching.
    if (current) collectingAgents = false;
  });

  return { groups: groups.filter((g) => g.agents.length), sitemaps };
}

/** Key used to compare user-agent names: "*" or the lower-cased product token. */
function agentKey(agent: string): string {
  return agent.trim() === "*" ? "*" : productToken(agent);
}

/** Picks the rules that apply to a crawler. An exact token match beats a "token-…" family match, which beats "*". */
function rulesFor(parsed: ParsedRobots, userAgent: string): { label: string; rules: ParsedRule[] } | null {
  const token = productToken(userAgent);
  let best: { score: number; key: string; label: string } | null = null;

  for (const group of parsed.groups) {
    for (const agent of group.agents) {
      const key = agentKey(agent);
      let score = -1;
      if (key === "*") score = 0;
      else if (key && key === token) score = Number.MAX_SAFE_INTEGER;
      else if (key && token.startsWith(`${key}-`)) score = key.length;
      if (score >= 0 && (!best || score > best.score)) best = { score, key, label: agent.trim() };
    }
  }
  if (!best) return null;

  const { key, label } = best;
  const rules = parsed.groups.filter((g) => g.agents.some((a) => agentKey(a) === key)).flatMap((g) => g.rules);
  return { label, rules };
}

/** Percent-encodes a single character; lone surrogates become the replacement character. */
function encodeChar(char: string): string {
  try {
    return encodeURIComponent(char);
  } catch {
    return "%EF%BF%BD";
  }
}

/** Upper-cases percent escapes and percent-encodes characters that browsers would encode. */
function normalizePath(path: string): string {
  return path.replace(/%[0-9a-f]{2}/gi, (m) => m.toUpperCase()).replace(/[^\x21-\x7E]/gu, encodeChar);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

/** True when a robots.txt path pattern matches the given path. */
export function patternMatches(pattern: string, path: string): boolean {
  const normalized = normalizePath(pattern);
  const anchored = normalized.endsWith("$");
  const body = anchored ? normalized.slice(0, -1) : normalized;
  const source = body
    .split("*")
    .map(escapeRegExp)
    .join(".*");
  return new RegExp(`^${source}${anchored ? "$" : ""}`).test(normalizePath(path));
}

/** Turns "https://site/a?b" or "a" into a path starting with "/". */
export function toRobotsPath(input: string): string {
  const value = input.trim();
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return `${url.pathname}${url.search}`;
    } catch {
      return "/";
    }
  }
  if (!value) return "/";
  return value.startsWith("/") ? value : `/${value}`;
}

/** Decides whether a crawler may fetch a path. */
export function checkRobots(parsed: ParsedRobots, userAgent: string, path: string): RobotsVerdict {
  const target = toRobotsPath(path);
  if (target === "/robots.txt") return { allowed: true, group: null, rule: null };

  const applicable = rulesFor(parsed, userAgent);
  if (!applicable) return { allowed: true, group: null, rule: null };

  let winner: ParsedRule | null = null;
  for (const rule of applicable.rules) {
    if (!patternMatches(rule.path, target)) continue;
    if (
      !winner ||
      rule.path.length > winner.path.length ||
      (rule.path.length === winner.path.length && rule.type === "allow" && winner.type === "disallow")
    ) {
      winner = rule;
    }
  }
  return { allowed: !winner || winner.type === "allow", group: applicable.label, rule: winner };
}
