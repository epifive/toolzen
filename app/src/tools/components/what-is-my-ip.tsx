"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { CopyButton, ErrorText, Panel, Spinner, Stat, StatGrid } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import type { MyIpResult } from "@/tools/lib/server-types";
import { DetailList, useServerTool } from "@/tools/lib/server-ui";

export default function WhatIsMyIp() {
  const { result, error, loading, run } = useServerTool<MyIpResult>("what-is-my-ip");

  useEffect(() => {
    void run({});
  }, [run]);

  return (
    <div className="space-y-4">
      <Panel
        title="Your public IP address"
        actions={
          <Button size="sm" variant="ghost" onClick={() => run({})} disabled={loading}>
            {loading ? <Spinner /> : <RefreshCw aria-hidden />}
            Refresh
          </Button>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3" aria-live="polite">
          <p className="min-w-0 font-mono text-2xl font-semibold break-all text-ink sm:text-3xl">
            {result?.ip ?? (loading ? "Detecting…" : "Unknown")}
          </p>
          {result?.ip ? <CopyButton text={result.ip} variant="primary" size="md" /> : null}
        </div>
      </Panel>

      <ErrorText>{error}</ErrorText>

      {result ? (
        <>
          <StatGrid>
            <Stat label="IP version" value={result.version ? `IPv${result.version}` : "–"} emphasis />
            <Stat label="Address type" value={result.ip ? (result.isPublic ? "Public" : "Private") : "–"} />
            <Stat label="Hostnames" value={result.hostnames.length} />
          </StatGrid>

          <Panel title="Connection details">
            <DetailList
              items={[
                { label: "Reverse DNS", value: result.hostnames.length ? result.hostnames.join(", ") : "No PTR record" },
                { label: "Browser user agent", value: <span className="font-mono text-xs break-all">{result.userAgent || "–"}</span> },
                { label: "Accepted languages", value: result.language || "–" },
              ]}
            />
            <p className="mt-4 text-xs text-muted">
              This is the address websites see when you visit them. On a VPN, proxy or mobile network it belongs to that provider.
              {result.ip && !result.isPublic
                ? " A private address means the site is running on your local network or behind a proxy that doesn't forward the original address."
                : ""}
            </p>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
