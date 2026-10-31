"use client";

import { useState } from "react";
import { CopyButton, ErrorText, Panel } from "@/components/tool-ui";
import { Alert } from "@/components/ui/alert";
import type { ReverseDnsResult } from "@/tools/lib/server-types";
import { CheckBadge, formatMs, LookupForm, useServerTool } from "@/tools/lib/server-ui";

export default function ReverseDnsLookup() {
  const [ip, setIp] = useState("");
  const { result, error, loading, run } = useServerTool<ReverseDnsResult>("reverse-dns-lookup");

  return (
    <div className="space-y-4">
      <LookupForm
        id="rdns-ip"
        label="IP address"
        value={ip}
        onChange={setIp}
        onSubmit={() => run({ ip })}
        loading={loading}
        placeholder="8.8.8.8 or 2001:4860:4860::8888"
        submitLabel="Look up"
        inputMode="text"
      />

      <ErrorText>{error}</ErrorText>

      {result ? (
        result.hostnames.length ? (
          <Panel
            title={`PTR records for ${result.ip}`}
            actions={<CopyButton text={result.hostnames.map((h) => h.hostname).join("\n")} label="Copy" />}
          >
            <ul className="divide-y divide-line">
              {result.hostnames.map((h) => (
                <li key={h.hostname} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-sm font-medium break-all text-ink">{h.hostname}</span>
                    <CheckBadge status={h.forwardConfirmed ? "pass" : "warn"} label={h.forwardConfirmed ? "Forward-confirmed" : "Not confirmed"} />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {h.addresses.length
                      ? `Resolves back to ${h.addresses.join(", ")}`
                      : `The hostname has no IPv${result.version} address.`}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted">
              IPv{result.version} · looked up in {formatMs(result.timeMs)}. Forward-confirmed reverse DNS (FCrDNS) means the
              hostname resolves back to the same IP, which mail servers use to judge senders.
            </p>
          </Panel>
        ) : (
          <Alert tone="info" title="No reverse DNS record">
            {result.ip} has no PTR record. The owner of the IP range (usually the hosting provider or ISP) sets it.
          </Alert>
        )
      ) : null}
    </div>
  );
}
