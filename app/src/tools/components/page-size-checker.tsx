"use client";

import { useState } from "react";
import { ErrorText, Panel, Stat, StatGrid } from "@/components/tool-ui";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/utils";
import type { PageSizeResult } from "@/tools/lib/server-types";
import { DetailList, ExternalLink, formatMs, LookupForm, useServerTool } from "@/tools/lib/server-ui";

const HTML_WARNING_BYTES = 500 * 1024;

export default function PageSizeChecker() {
  const [url, setUrl] = useState("");
  const { result, error, loading, run } = useServerTool<PageSizeResult>("page-size-checker");

  const assets = result ? [...result.assets].sort((a, b) => (b.bytes ?? -1) - (a.bytes ?? -1)) : [];
  const measured = result?.assets.filter((a) => a.bytes !== null).length ?? 0;

  return (
    <div className="space-y-4">
      <LookupForm
        id="size-url"
        label="Page URL"
        value={url}
        onChange={setUrl}
        onSubmit={() => run({ url })}
        loading={loading}
        placeholder="https://example.com"
        hint="We download the HTML and check the size of up to 25 files hosted on the same site."
      />

      <ErrorText>{error}</ErrorText>

      {result ? (
        <>
          <StatGrid>
            <Stat
              label="HTML size"
              value={`${result.htmlTruncated ? "> " : ""}${formatBytes(result.htmlBytes)}`}
              emphasis
            />
            <Stat label="Transferred" value={result.transferBytes !== null ? formatBytes(result.transferBytes) : "–"} />
            <Stat label="Response time" value={formatMs(result.timeMs)} />
            <Stat label="Compression" value={result.contentEncoding ?? "None"} />
            <Stat label="Measured files" value={formatBytes(result.assetBytes)} />
            <Stat label="HTML + measured files" value={formatBytes(result.htmlBytes + result.assetBytes)} />
          </StatGrid>

          {!result.contentEncoding ? (
            <Alert tone="warning" title="The page isn't compressed">
              Enable gzip or Brotli on your server to cut the HTML transfer size by 60–80%.
            </Alert>
          ) : null}
          {result.htmlBytes > HTML_WARNING_BYTES ? (
            <Alert tone="warning" title="Large HTML document">
              Over 500 KB of HTML slows down the first render. Move inline data, SVGs and scripts into cached files.
            </Alert>
          ) : null}

          <Panel title="Resources referenced by the page">
            <DetailList
              items={[
                { label: "Scripts", value: `${result.counts.scripts} files, ${result.counts.inlineScripts} inline` },
                { label: "Stylesheets", value: `${result.counts.stylesheets} files, ${result.counts.inlineStyles} inline` },
                { label: "Images", value: result.counts.images },
                { label: "Iframes", value: result.counts.iframes },
                { label: "Final URL", value: <ExternalLink href={result.finalUrl} /> },
              ]}
            />
          </Panel>

          <Panel title={`Same-site files (${measured} of ${result.assets.length} measured)`}>
            {assets.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        File
                      </th>
                      <th scope="col" className="w-24 py-2 pr-3 font-medium">
                        Type
                      </th>
                      <th scope="col" className="w-24 py-2 text-right font-medium">
                        Size
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((asset) => (
                      <tr key={asset.url} className="border-b border-line last:border-0">
                        <td className="max-w-0 truncate py-2 pr-3 font-mono text-[13px] text-ink" title={asset.url}>
                          {asset.url.replace(/^https?:\/\/[^/]+/, "")}
                        </td>
                        <td className="py-2 pr-3">
                          <Badge>{asset.kind}</Badge>
                        </td>
                        <td className="py-2 text-right tabular-nums text-muted">
                          {asset.bytes !== null ? formatBytes(asset.bytes) : asset.status !== null ? `HTTP ${asset.status}` : "Unknown"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted">The page doesn&apos;t reference scripts, stylesheets or images on the same site.</p>
            )}
            {result.assetsPartial ? (
              <p className="mt-3 text-xs text-muted">
                Some files weren&apos;t measured: only 25 are checked, within a few seconds, and some servers don&apos;t report a size.
              </p>
            ) : null}
            <p className="mt-2 text-xs text-muted">Files on other domains (CDNs, analytics, fonts) are counted above but not measured.</p>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
