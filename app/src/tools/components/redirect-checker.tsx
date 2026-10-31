"use client";

import { useState } from "react";
import { ArrowDown } from "lucide-react";
import { CopyButton, ErrorText, Panel, Stat, StatGrid } from "@/components/tool-ui";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { RedirectResult } from "@/tools/lib/server-types";
import { ExternalLink, formatMs, LookupForm, statusTone, useServerTool } from "@/tools/lib/server-ui";

const STATUS_NAMES: Record<number, string> = {
  301: "Permanent",
  302: "Temporary",
  303: "See other",
  307: "Temporary",
  308: "Permanent",
};

function notes(result: RedirectResult): Array<{ tone: "success" | "warning" | "error" | "info"; text: string }> {
  const list: Array<{ tone: "success" | "warning" | "error" | "info"; text: string }> = [];
  if (result.loop) list.push({ tone: "error", text: "Redirect loop: the chain returns to a URL it already visited." });
  if (result.tooMany) list.push({ tone: "error", text: "Too many redirects. Browsers give up after about 20; search engines after 5–10." });
  if (result.httpsToHttp) list.push({ tone: "warning", text: "The chain downgrades from HTTPS to HTTP." });
  if (result.redirects > 2) list.push({ tone: "warning", text: `${result.redirects} redirects in a row slow pages down. Point links straight at the final URL.` });
  if (result.temporary) list.push({ tone: "info", text: "The chain uses a temporary redirect. Use 301 or 308 for permanent moves so rankings pass to the new URL." });
  if (result.httpToHttps) list.push({ tone: "success", text: "HTTP is redirected to HTTPS." });
  if (!result.redirects) list.push({ tone: "info", text: "The URL doesn't redirect." });
  return list;
}

export default function RedirectChecker() {
  const [url, setUrl] = useState("");
  const { result, error, loading, run } = useServerTool<RedirectResult>("redirect-checker");

  return (
    <div className="space-y-4">
      <LookupForm
        id="redirect-url"
        label="URL"
        value={url}
        onChange={setUrl}
        onSubmit={() => run({ url })}
        loading={loading}
        placeholder="http://example.com"
        hint="Try the http:// or non-www version of your site to check its redirects."
      />

      <ErrorText>{error}</ErrorText>

      {result ? (
        <>
          <StatGrid>
            <Stat label="Redirects" value={result.redirects} emphasis />
            <Stat
              label="Final status"
              value={
                result.finalStatus === null ? (
                  "Failed"
                ) : (
                  <Badge tone={statusTone(result.finalStatus)} className="text-base">
                    {result.finalStatus}
                  </Badge>
                )
              }
            />
            <Stat label="Total time" value={formatMs(result.totalMs)} />
          </StatGrid>

          <div className="space-y-2">
            {notes(result).map((n) => (
              <Alert key={n.text} tone={n.tone}>
                {n.text}
              </Alert>
            ))}
          </div>

          <Panel title="Redirect chain" actions={<CopyButton text={result.finalUrl} label="Copy final URL" />}>
            <ol className="space-y-1">
              {result.hops.map((hop, i) => (
                <li key={`${hop.url}-${i}`}>
                  {i > 0 ? <ArrowDown aria-hidden className="mx-auto my-1 size-4 text-muted" /> : null}
                  <div className="rounded-lg border border-line p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted">Step {i + 1}</span>
                      {hop.status !== null ? (
                        <Badge tone={statusTone(hop.status)}>
                          {hop.status} {STATUS_NAMES[hop.status] ?? hop.statusText}
                        </Badge>
                      ) : (
                        <Badge tone="danger">No response</Badge>
                      )}
                      {hop.status !== null ? <span className="ml-auto text-xs tabular-nums text-muted">{formatMs(hop.timeMs)}</span> : null}
                    </div>
                    <p className="mt-1.5 font-mono text-[13px]">
                      <ExternalLink href={hop.url} />
                    </p>
                    {hop.error ? <p className="mt-1 text-sm text-red-700 dark:text-red-400">{hop.error}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
