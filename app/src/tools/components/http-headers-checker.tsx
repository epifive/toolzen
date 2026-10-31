"use client";

import { useState } from "react";
import { CopyButton, ErrorText, Panel, Stat, StatGrid } from "@/components/tool-ui";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/field";
import type { HeadersResult } from "@/tools/lib/server-types";
import { CheckBadge, ExternalLink, formatMs, LookupForm, statusTone, useServerTool } from "@/tools/lib/server-ui";

export default function HttpHeadersChecker() {
  const [url, setUrl] = useState("");
  const [followRedirects, setFollowRedirects] = useState(true);
  const { result, error, loading, run } = useServerTool<HeadersResult>("http-headers-checker");

  const passed = result?.security.filter((s) => s.status === "pass").length ?? 0;
  const headerText = result ? result.headers.map((h) => `${h.name}: ${h.value}`).join("\n") : "";

  return (
    <div className="space-y-4">
      <LookupForm
        id="headers-url"
        label="URL"
        value={url}
        onChange={setUrl}
        onSubmit={() => run({ url, followRedirects })}
        loading={loading}
        placeholder="https://example.com"
      >
        <Switch
          label="Follow redirects"
          description="Show the headers of the final page instead of the first response."
          checked={followRedirects}
          onChange={(e) => setFollowRedirects(e.target.checked)}
        />
      </LookupForm>

      <ErrorText>{error}</ErrorText>

      {result ? (
        <>
          <StatGrid>
            <Stat
              label="Status"
              value={
                <Badge tone={statusTone(result.status)} className="text-base">
                  {result.status} {result.statusText}
                </Badge>
              }
              emphasis
            />
            <Stat label="Response time" value={formatMs(result.timeMs)} />
            <Stat label="Security headers" value={`${passed} of ${result.security.length}`} />
          </StatGrid>

          <p className="text-sm break-words text-muted">
            {result.method} request to <ExternalLink href={result.finalUrl} />
            {result.finalUrl !== result.url ? " (after redirects)" : ""}
          </p>

          <Panel title="Security headers">
            <ul className="divide-y divide-line">
              {result.security.map((check) => (
                <li key={check.header} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[13px] font-medium text-ink">{check.header}</span>
                    <CheckBadge
                      status={check.status}
                      label={check.status === "pass" ? "Pass" : check.value ? "Weak" : "Missing"}
                    />
                  </div>
                  <p className="mt-1 text-sm text-muted">{check.advice}</p>
                  {check.value ? (
                    <p className="mt-1 rounded-md bg-paper px-2 py-1 font-mono text-xs break-all text-ink">{check.value}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title={`Response headers (${result.headers.length})`} actions={<CopyButton text={headerText} label="Copy all" />}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th scope="col" className="w-1/3 py-2 pr-3 font-medium">
                      Header
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.headers.map((h) => (
                    <tr key={h.name} className="border-b border-line align-top last:border-0">
                      <td className="py-2 pr-3 font-mono text-[13px] break-all text-ink">{h.name}</td>
                      <td className="py-2 font-mono text-[13px] break-all text-muted">{h.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
