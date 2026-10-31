"use client";

import { useMemo, useState } from "react";
import { CopyButton, DownloadTextButton, ErrorText, Panel, Segmented, Stat, StatGrid } from "@/components/tool-ui";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import type { ExtractedLink, LinkResult } from "@/tools/lib/server-types";
import { ExternalLink, LookupForm, useServerTool } from "@/tools/lib/server-ui";

type Filter = "all" | "internal" | "external" | "nofollow" | "contact";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "internal", label: "Internal" },
  { value: "external", label: "External" },
  { value: "nofollow", label: "Nofollow" },
  { value: "contact", label: "Email & phone" },
];

const isNofollow = (link: ExtractedLink) => link.rel.some((r) => r === "nofollow" || r === "sponsored" || r === "ugc");

function matchesFilter(link: ExtractedLink, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "nofollow") return isNofollow(link);
  if (filter === "contact") return link.kind === "email" || link.kind === "phone";
  return link.kind === filter;
}

/** RFC 4180 field; a leading =, +, - or @ is prefixed so spreadsheets don't run it as a formula. */
function csvField(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function toCsv(links: ExtractedLink[]): string {
  const rows = links.map((l) => [l.url, l.text, l.kind, l.rel.join(" "), l.newTab ? "yes" : "no"].map(csvField).join(","));
  return ["URL,Anchor text,Type,Rel,New tab", ...rows].join("\r\n");
}

export default function LinkExtractor() {
  const [url, setUrl] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const { result, error, loading, run } = useServerTool<LinkResult>("link-extractor");

  const visible = useMemo(() => {
    if (!result) return [];
    const q = query.trim().toLowerCase();
    return result.links.filter(
      (l) => matchesFilter(l, filter) && (!q || l.url.toLowerCase().includes(q) || l.text.toLowerCase().includes(q)),
    );
  }, [result, filter, query]);

  const counts = useMemo(() => {
    const links = result?.links ?? [];
    return {
      internal: links.filter((l) => l.kind === "internal").length,
      external: links.filter((l) => l.kind === "external").length,
      nofollow: links.filter(isNofollow).length,
    };
  }, [result]);

  const host = result ? new URL(result.finalUrl).hostname : "page";

  return (
    <div className="space-y-4">
      <LookupForm
        id="links-url"
        label="Page URL"
        value={url}
        onChange={setUrl}
        onSubmit={() => run({ url })}
        loading={loading}
        placeholder="https://example.com"
        submitLabel="Extract links"
      />

      <ErrorText>{error}</ErrorText>

      {result ? (
        <>
          <StatGrid>
            <Stat label="Links found" value={result.total.toLocaleString()} emphasis />
            <Stat label="Unique URLs" value={result.unique.toLocaleString()} />
            <Stat label="Internal" value={counts.internal} />
            <Stat label="External" value={counts.external} />
            <Stat label="Nofollow / sponsored / UGC" value={counts.nofollow} />
          </StatGrid>

          {result.limited ? (
            <Alert tone="info">The page has {result.total.toLocaleString()} links; the first {result.links.length} are listed.</Alert>
          ) : null}

          <Panel
            title={`Links (${visible.length})`}
            actions={
              <>
                <CopyButton text={visible.map((l) => l.url).join("\n")} label="Copy URLs" />
                <DownloadTextButton
                  text={visible.length ? toCsv(visible) : ""}
                  filename={`${host}-links.csv`}
                  label="CSV"
                  type="text/csv;charset=utf-8"
                />
              </>
            }
          >
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <Segmented label="Filter links" value={filter} onChange={setFilter} options={FILTERS} />
              <Input
                type="search"
                aria-label="Search links"
                placeholder="Search URL or text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="md:max-w-xs"
              />
            </div>

            {visible.length ? (
              <ul className="divide-y divide-line">
                {visible.map((link, i) => (
                  <li key={`${link.url}-${i}`} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium break-words text-ink">{link.text || <span className="text-muted">(no text)</span>}</span>
                      <Badge tone={link.kind === "internal" ? "primary" : "neutral"}>{link.kind}</Badge>
                      {link.rel.map((r) => (
                        <Badge key={r} tone={r === "nofollow" || r === "sponsored" || r === "ugc" ? "warning" : "neutral"}>
                          {r}
                        </Badge>
                      ))}
                      {link.newTab ? <Badge>new tab</Badge> : null}
                    </div>
                    <p className="mt-0.5 font-mono text-xs">
                      <ExternalLink href={link.url} />
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted">No links match the current filter.</p>
            )}
          </Panel>
        </>
      ) : null}
    </div>
  );
}
