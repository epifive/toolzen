"use client";

import { useState, type ReactNode } from "react";
import { ErrorText, Panel, Stat } from "@/components/tool-ui";
import { Alert } from "@/components/ui/alert";
import type { MetaResult } from "@/tools/lib/server-types";
import { CheckBadge, DetailList, ExternalLink, formatMs, LookupForm, useServerTool } from "@/tools/lib/server-ui";

function scoreClass(score: number): string {
  if (score >= 85) return "text-emerald-700 dark:text-emerald-400";
  if (score >= 60) return "text-amber-700 dark:text-amber-400";
  return "text-red-700 dark:text-red-400";
}

function TagTable({ rows, keyLabel }: { rows: Array<{ key: string; value: string }>; keyLabel: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th scope="col" className="w-2/5 py-2 pr-3 font-medium">
              {keyLabel}
            </th>
            <th scope="col" className="py-2 font-medium">
              Content
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${row.key}-${i}`} className="border-b border-line align-top last:border-0">
              <td className="py-2 pr-3 font-mono text-[13px] break-all text-ink">{row.key}</td>
              <td className="py-2 break-words text-muted">{row.value || "(empty)"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function withLength(value: string | null): ReactNode {
  if (!value) return <span className="text-muted">Missing</span>;
  return (
    <>
      {value} <span className="text-xs whitespace-nowrap text-muted">({value.length} characters)</span>
    </>
  );
}

function HeadingList({ items, total, tag }: { items: string[]; total: number; tag: string }) {
  if (!total) return <p className="text-sm text-muted">No {tag} headings.</p>;
  return (
    <>
      <ul className="space-y-1 text-sm text-ink">
        {items.map((text, i) => (
          <li key={`${text}-${i}`} className="break-words">
            <span className="mr-2 font-mono text-xs text-muted uppercase">{tag}</span>
            {text || <span className="text-muted">(empty)</span>}
          </li>
        ))}
      </ul>
      {total > items.length ? <p className="mt-2 text-xs text-muted">and {total - items.length} more</p> : null}
    </>
  );
}

export default function MetaTagsAnalyzer() {
  const [url, setUrl] = useState("");
  const { result, error, loading, run } = useServerTool<MetaResult>("meta-tags-analyzer");

  const counts = result
    ? {
        pass: result.checks.filter((c) => c.status === "pass").length,
        warn: result.checks.filter((c) => c.status === "warn").length,
        fail: result.checks.filter((c) => c.status === "fail").length,
      }
    : null;

  return (
    <div className="space-y-4">
      <LookupForm
        id="meta-url"
        label="Page URL"
        value={url}
        onChange={setUrl}
        onSubmit={() => run({ url })}
        loading={loading}
        placeholder="https://example.com/page"
        submitLabel="Analyze"
      />

      <ErrorText>{error}</ErrorText>

      {result && counts ? (
        <>
          {result.truncated ? (
            <Alert tone="warning">The page is larger than 1.5 MB; only the first part was analyzed.</Alert>
          ) : null}

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="SEO score"
              value={
                <span className={scoreClass(result.score)}>
                  {result.score}
                  <span className="text-base text-muted">/100</span>
                </span>
              }
              emphasis
            />
            <Stat label="Passed" value={counts.pass} />
            <Stat label="Warnings" value={counts.warn} />
            <Stat label="Failed" value={counts.fail} />
          </dl>

          <Panel title="Recommendations">
            <ul className="divide-y divide-line">
              {result.checks.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{c.label}</p>
                    <p className="text-sm text-muted">{c.message}</p>
                  </div>
                  <CheckBadge status={c.status} />
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Meta tags">
            <DetailList
              items={[
                { label: "Title", value: withLength(result.title) },
                { label: "Description", value: withLength(result.description) },
                { label: "Canonical", value: result.canonical ? <ExternalLink href={result.canonical} /> : "Missing" },
                { label: "Robots", value: result.robots ?? "Not set (index, follow)" },
                { label: "Viewport", value: result.viewport ?? "Missing" },
                { label: "Language", value: result.lang ?? "Missing" },
                { label: "Character set", value: result.charset ?? "Missing" },
                { label: "Favicon", value: result.favicon ? <ExternalLink href={result.favicon} /> : "Not declared" },
                { label: "Images", value: `${result.images} total, ${result.imagesWithoutAlt} without alt text` },
                { label: "Words", value: result.wordCount.toLocaleString() },
                {
                  label: "Fetched",
                  value: (
                    <>
                      <ExternalLink href={result.finalUrl} /> · HTTP {result.status} · {formatMs(result.timeMs)}
                    </>
                  ),
                },
              ]}
            />
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={`H1 headings (${result.h1Count})`}>
              <HeadingList items={result.h1} total={result.h1Count} tag="h1" />
            </Panel>
            <Panel title={`H2 headings (${result.h2Count})`}>
              <HeadingList items={result.h2} total={result.h2Count} tag="h2" />
            </Panel>
          </div>

          <Panel title={`Open Graph (${result.openGraph.length})`}>
            {result.openGraph.length ? (
              <TagTable keyLabel="Property" rows={result.openGraph.map((t) => ({ key: t.property, value: t.content }))} />
            ) : (
              <p className="text-sm text-muted">No Open Graph tags found.</p>
            )}
          </Panel>

          <Panel title={`Twitter / X card (${result.twitter.length})`}>
            {result.twitter.length ? (
              <TagTable keyLabel="Name" rows={result.twitter.map((t) => ({ key: t.name, value: t.content }))} />
            ) : (
              <p className="text-sm text-muted">No Twitter card tags found.</p>
            )}
          </Panel>

          {result.hreflang.length ? (
            <Panel title={`hreflang alternates (${result.hreflang.length})`}>
              <TagTable keyLabel="Language" rows={result.hreflang.map((h) => ({ key: h.lang, value: h.href }))} />
            </Panel>
          ) : null}

          <p className="text-xs text-muted">
            The score is a quick on-page checklist. Rankings also depend on content quality, links and page speed.
          </p>
        </>
      ) : null}
    </div>
  );
}
