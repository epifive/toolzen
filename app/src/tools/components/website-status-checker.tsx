"use client";

import { useState } from "react";
import { CircleCheck, CircleX, ShieldAlert, TriangleAlert, type LucideIcon } from "lucide-react";
import { ErrorText, Panel, Stat, StatGrid } from "@/components/tool-ui";
import { cn } from "@/lib/utils";
import type { SiteVerdict, StatusResult } from "@/tools/lib/server-types";
import { DetailList, ExternalLink, formatDateTime, formatMs, LookupForm, useServerTool } from "@/tools/lib/server-ui";

const VERDICTS: Record<SiteVerdict, { title: (host: string) => string; text: string; icon: LucideIcon; className: string }> = {
  up: {
    title: (host) => `${host} is up`,
    text: "The site responded normally to our server.",
    icon: CircleCheck,
    className: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  },
  restricted: {
    title: (host) => `${host} is up but refused the request`,
    text: "The server is online but blocks automated checks or requires sign-in.",
    icon: ShieldAlert,
    className: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  },
  error: {
    title: (host) => `${host} returned an error`,
    text: "The server is reachable but the page responded with an error status.",
    icon: TriangleAlert,
    className: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  },
  down: {
    title: (host) => `${host} looks down`,
    text: "Our server could not get a response.",
    icon: CircleX,
    className: "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
  },
};

export default function WebsiteStatusChecker() {
  const [url, setUrl] = useState("");
  const { result, error, loading, run } = useServerTool<StatusResult>("website-status-checker");

  const verdict = result ? VERDICTS[result.verdict] : null;
  const Icon = verdict?.icon;

  return (
    <div className="space-y-4">
      <LookupForm
        id="status-url"
        label="Website address"
        value={url}
        onChange={setUrl}
        onSubmit={() => run({ url })}
        loading={loading}
        placeholder="example.com"
        submitLabel="Check status"
      />

      <ErrorText>{error}</ErrorText>

      {result && verdict && Icon ? (
        <>
          <section className={cn("flex items-start gap-4 rounded-xl border p-5", verdict.className)} aria-live="polite">
            <Icon aria-hidden className="mt-0.5 size-8 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-display text-xl font-semibold break-words">{verdict.title(new URL(result.url).hostname)}</h2>
              <p className="mt-1 text-sm opacity-90">{result.message ?? verdict.text}</p>
            </div>
          </section>

          <StatGrid>
            <Stat label="Status code" value={result.status ?? "–"} emphasis />
            <Stat label="Response time" value={formatMs(result.timeMs)} />
            <Stat label="Redirects" value={result.redirects} />
          </StatGrid>

          <Panel title="Details">
            <DetailList
              items={[
                { label: "Page title", value: result.title ?? "–" },
                { label: "Final URL", value: <ExternalLink href={result.finalUrl} /> },
                { label: "Status text", value: result.statusText || "–" },
                { label: "Checked at", value: formatDateTime(result.checkedAt) },
              ]}
            />
            <p className="mt-4 text-xs text-muted">
              If the site is up here but not for you, the problem is likely your connection, DNS cache or a regional outage.
            </p>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
