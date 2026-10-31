"use client";

import { useState } from "react";
import { ErrorText, OutputBox, Panel, Stat, StatGrid } from "@/components/tool-ui";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/field";
import { formatDate } from "@/lib/utils";
import type { WhoisResult } from "@/tools/lib/server-types";
import { DetailList, ExternalLink, LookupForm, useServerTool } from "@/tools/lib/server-ui";

function formatAge(days: number | null): string {
  if (days === null || days < 0) return "–";
  const years = Math.floor(days / 365.25);
  const rest = Math.floor(days - years * 365.25);
  if (!years) return `${days} day${days === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"}, ${rest} day${rest === 1 ? "" : "s"}`;
}

function expiryText(days: number | null): string {
  if (days === null) return "–";
  if (days < 0) return `Expired ${Math.abs(days)} days ago`;
  return `${days.toLocaleString()} days`;
}

export default function WhoisLookup() {
  const [domain, setDomain] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const { result, error, loading, run } = useServerTool<WhoisResult>("whois-lookup");

  return (
    <div className="space-y-4">
      <LookupForm
        id="whois-domain"
        label="Domain name"
        value={domain}
        onChange={setDomain}
        onSubmit={() => run({ domain })}
        loading={loading}
        placeholder="example.com"
        submitLabel="Look up"
      />

      <ErrorText>{error}</ErrorText>

      {result ? (
        <>
          {result.daysToExpiry !== null && result.daysToExpiry < 30 ? (
            <Alert tone={result.daysToExpiry < 0 ? "error" : "warning"} title="Expiry is close">
              {result.daysToExpiry < 0
                ? "The registration expiry date has passed. The domain may be in a grace or redemption period."
                : `The registration expires in ${result.daysToExpiry} days.`}
            </Alert>
          ) : null}

          <StatGrid>
            <Stat label="Domain age" value={formatAge(result.ageDays)} emphasis />
            <Stat label="Expires in" value={expiryText(result.daysToExpiry)} />
            <Stat label="DNSSEC" value={result.dnssec === null ? "Unknown" : result.dnssec ? "Signed" : "Unsigned"} />
          </StatGrid>

          <Panel title={`Registration data for ${result.domain}`}>
            <DetailList
              items={[
                { label: "Registrar", value: result.registrar ?? "Not published" },
                { label: "Registrar IANA ID", value: result.registrarIanaId ?? "–" },
                { label: "Registrar website", value: result.registrarUrl ? <ExternalLink href={result.registrarUrl} /> : "–" },
                { label: "Registered on", value: formatDate(result.created) },
                { label: "Last updated", value: formatDate(result.updated) },
                { label: "Expires on", value: formatDate(result.expires) },
                {
                  label: "Abuse contact",
                  value: [result.abuseEmail, result.abusePhone].filter(Boolean).join(" · ") || "–",
                },
              ]}
            />
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Status codes">
              {result.status.length ? (
                <ul className="flex flex-wrap gap-2">
                  {result.status.map((s) => (
                    <li key={s}>
                      <Badge tone={/prohibited|lock/i.test(s) ? "primary" : "neutral"}>{s}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No status codes published.</p>
              )}
              <p className="mt-3 text-xs text-muted">&ldquo;Transfer prohibited&rdquo; locks protect the domain from unauthorised transfers.</p>
            </Panel>
            <Panel title="Name servers">
              {result.nameservers.length ? (
                <ul className="space-y-1 font-mono text-[13px] text-ink">
                  {result.nameservers.map((ns) => (
                    <li key={ns} className="break-all">
                      {ns}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No name servers published.</p>
              )}
            </Panel>
          </div>

          <Panel>
            <Switch
              label="Show raw RDAP response"
              description={`Source: ${result.rdapServer}`}
              checked={showRaw}
              onChange={(e) => setShowRaw(e.target.checked)}
            />
          </Panel>
          {showRaw ? (
            result.raw ? (
              <OutputBox
                value={result.raw}
                label="Raw RDAP data"
                filename={`${result.domain}-rdap.json`}
                mimeType="application/json"
                mono
                rows={16}
              />
            ) : (
              <p className="text-sm text-muted">The raw response is too large to display.</p>
            )
          ) : null}
        </>
      ) : null}
    </div>
  );
}
