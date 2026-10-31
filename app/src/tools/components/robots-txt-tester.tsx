"use client";

import { useMemo, useState } from "react";
import { DownloadTextButton, ErrorText, Panel } from "@/components/tool-ui";
import { Alert } from "@/components/ui/alert";
import { Field, Input, Select } from "@/components/ui/field";
import { checkRobots, parseRobots, toRobotsPath } from "@/lib/server-tools/robots";
import { cn } from "@/lib/utils";
import type { RobotsResult } from "@/tools/lib/server-types";
import { ExternalLink, LookupForm, useServerTool } from "@/tools/lib/server-ui";

const CUSTOM = "__custom";
const MAX_LINES_SHOWN = 1000;

const CRAWLERS = [
  "Googlebot",
  "Googlebot-Image",
  "Googlebot-News",
  "Bingbot",
  "DuckDuckBot",
  "YandexBot",
  "Baiduspider",
  "Applebot",
  "GPTBot",
  "ClaudeBot",
  "CCBot",
  "PerplexityBot",
  "Google-Extended",
  "AhrefsBot",
  "SemrushBot",
];

const STATE_TEXT: Record<RobotsResult["state"], { tone: "success" | "info" | "error"; text: string }> = {
  found: { tone: "success", text: "robots.txt found." },
  missing: { tone: "info", text: "No robots.txt file. Crawlers may fetch every page." },
  error: { tone: "error", text: "The server returned an error for robots.txt. Google treats the whole site as blocked until it can read the file." },
};

export default function RobotsTxtTester() {
  const [site, setSite] = useState("");
  const [agent, setAgent] = useState("Googlebot");
  const [customAgent, setCustomAgent] = useState("");
  const [path, setPath] = useState("/");
  const { result, error, loading, run } = useServerTool<RobotsResult>("robots-txt-tester");

  const parsed = useMemo(() => parseRobots(result?.content ?? ""), [result]);
  const userAgent = agent === CUSTOM ? customAgent.trim() : agent;
  const verdict = useMemo(() => {
    if (!result || !userAgent) return null;
    // A server error means Google stops crawling the whole site.
    if (result.state === "error") return { allowed: false, group: null, rule: null };
    return checkRobots(parsed, userAgent, path);
  }, [result, parsed, userAgent, path]);

  const lines = useMemo(() => (result?.content ? result.content.split(/\r\n|\r|\n/) : []), [result]);
  const host = result ? new URL(result.robotsUrl).hostname : "";

  return (
    <div className="space-y-4">
      <LookupForm
        id="robots-site"
        label="Website"
        value={site}
        onChange={setSite}
        onSubmit={() => run({ url: site })}
        loading={loading}
        placeholder="example.com"
        submitLabel="Fetch robots.txt"
      />

      <ErrorText>{error}</ErrorText>

      {result ? (
        <>
          <Alert tone={STATE_TEXT[result.state].tone}>
            {STATE_TEXT[result.state].text} <ExternalLink href={result.robotsUrl} /> returned HTTP {result.status}.
          </Alert>

          <Panel title="Test a URL">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Crawler (user-agent)" htmlFor="robots-agent">
                <Select id="robots-agent" value={agent} onChange={(e) => setAgent(e.target.value)}>
                  {CRAWLERS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value={CUSTOM}>Other (type a name)</option>
                </Select>
              </Field>
              {agent === CUSTOM ? (
                <Field label="User-agent name" htmlFor="robots-custom">
                  <Input id="robots-custom" value={customAgent} onChange={(e) => setCustomAgent(e.target.value)} placeholder="ExampleBot" />
                </Field>
              ) : null}
              <Field label="Path or URL" htmlFor="robots-path" hint={`Tested as ${toRobotsPath(path)}`} className="sm:col-span-2">
                <Input
                  id="robots-path"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/blog/post"
                  className="font-mono"
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
            </div>

            {verdict ? (
              <div className="mt-4" aria-live="polite">
                <Alert tone={verdict.allowed ? "success" : "error"} title={verdict.allowed ? "Allowed" : "Blocked"}>
                  {verdict.rule
                    ? `Line ${verdict.rule.line}: ${verdict.rule.type === "allow" ? "Allow" : "Disallow"}: ${verdict.rule.path}`
                    : result.state === "error"
                      ? "robots.txt could not be read."
                      : "No rule matches this path, so crawling is allowed."}
                  {verdict.group ? ` (group User-agent: ${verdict.group})` : ""}
                </Alert>
              </div>
            ) : null}
          </Panel>

          {parsed.sitemaps.length ? (
            <Panel title={`Sitemaps (${parsed.sitemaps.length})`}>
              <ul className="space-y-1 text-sm">
                {parsed.sitemaps.map((s) => (
                  <li key={s}>{/^https?:\/\//i.test(s) ? <ExternalLink href={s} /> : <span className="break-all">{s}</span>}</li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {result.content ? (
            <Panel title="robots.txt" actions={<DownloadTextButton text={result.content} filename={`${host}-robots.txt`} />}>
              {result.truncated ? (
                <p className="mb-2 text-xs text-muted">The file is larger than 500 KB. Google ignores everything after that point.</p>
              ) : null}
              <pre className="max-h-[28rem] overflow-auto rounded-lg border border-line bg-paper py-2 font-mono text-[13px] leading-relaxed">
                {lines.slice(0, MAX_LINES_SHOWN).map((line, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex gap-3 px-3",
                      verdict?.rule?.line === i + 1 && (verdict.allowed ? "bg-emerald-100 dark:bg-emerald-950" : "bg-red-100 dark:bg-red-950"),
                    )}
                  >
                    <span className="w-10 shrink-0 text-right text-muted select-none">{i + 1}</span>
                    <span className="break-all whitespace-pre-wrap text-ink">{line || " "}</span>
                  </div>
                ))}
              </pre>
              {lines.length > MAX_LINES_SHOWN ? (
                <p className="mt-2 text-xs text-muted">Showing the first {MAX_LINES_SHOWN} lines. Download the file to see all of it.</p>
              ) : null}
            </Panel>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
