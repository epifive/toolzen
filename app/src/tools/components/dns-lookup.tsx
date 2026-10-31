"use client";

import { useState } from "react";
import { CopyButton, DownloadTextButton, ErrorText, Panel } from "@/components/tool-ui";
import { Field, Select } from "@/components/ui/field";
import { DNS_RECORD_TYPES, type DnsLookupResult, type DnsRecordType } from "@/tools/lib/server-types";
import { formatMs, LookupForm, useServerTool } from "@/tools/lib/server-ui";

type TypeChoice = DnsRecordType | "ALL";

const TYPE_HELP: Record<DnsRecordType, string> = {
  A: "IPv4 addresses",
  AAAA: "IPv6 addresses",
  CNAME: "Alias of another name",
  MX: "Mail servers",
  TXT: "Text records (SPF, verification)",
  NS: "Name servers",
  SOA: "Start of authority",
  CAA: "Allowed certificate authorities",
  SRV: "Service locations",
};

function asZoneText(result: DnsLookupResult): string {
  return result.results
    .flatMap((r) =>
      r.records.map((rec) => {
        const value = r.type === "TXT" ? `"${rec.value.replace(/"/g, '\\"')}"` : rec.value;
        return `${result.domain}.\t${rec.ttl ?? ""}\tIN\t${r.type}\t${value}`;
      }),
    )
    .join("\n");
}

export default function DnsLookup() {
  const [domain, setDomain] = useState("");
  const [type, setType] = useState<TypeChoice>("ALL");
  const { result, error, loading, run } = useServerTool<DnsLookupResult>("dns-lookup");

  const withRecords = result?.results.filter((r) => r.records.length || r.error) ?? [];
  const empty = result?.results.filter((r) => !r.records.length && !r.error).map((r) => r.type) ?? [];
  const zoneText = result ? asZoneText(result) : "";

  return (
    <div className="space-y-4">
      <LookupForm
        id="dns-domain"
        label="Domain name"
        value={domain}
        onChange={setDomain}
        onSubmit={() => run({ domain, type })}
        loading={loading}
        placeholder="example.com"
        submitLabel="Look up"
        hint="Service names such as _dmarc.example.com work too."
      >
        <Field label="Record type" htmlFor="dns-type" className="sm:max-w-xs">
          <Select id="dns-type" value={type} onChange={(e) => setType(e.target.value as TypeChoice)}>
            <option value="ALL">All record types</option>
            {DNS_RECORD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t} – {TYPE_HELP[t]}
              </option>
            ))}
          </Select>
        </Field>
      </LookupForm>

      <ErrorText>{error}</ErrorText>

      {result ? (
        <>
          <Panel
            title={`DNS records for ${result.domain}`}
            actions={
              zoneText ? (
                <>
                  <CopyButton text={zoneText} label="Copy all" />
                  <DownloadTextButton text={zoneText} filename={`${result.domain}-dns.txt`} />
                </>
              ) : null
            }
          >
            <p className="text-sm text-muted">
              Answered by public resolvers {result.resolvers.join(" and ")} in {formatMs(result.timeMs)}. TTL is shown for A
              and AAAA records.
            </p>
            {empty.length ? (
              <p className="mt-2 text-sm text-muted">
                No records found for: <span className="font-mono text-ink">{empty.join(", ")}</span>
              </p>
            ) : null}
          </Panel>

          {withRecords.map((r) => (
            <Panel key={r.type} title={`${r.type} – ${TYPE_HELP[r.type]}`}>
              {r.error ? (
                <p className="text-sm text-amber-700 dark:text-amber-400">{r.error}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs text-muted">
                        <th scope="col" className="py-2 pr-3 font-medium">
                          Value
                        </th>
                        <th scope="col" className="w-20 py-2 text-right font-medium">
                          TTL
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.records.map((rec, i) => (
                        <tr key={`${rec.value}-${i}`} className="border-b border-line last:border-0">
                          <td className="py-2 pr-3 font-mono text-[13px] break-all text-ink">{rec.value}</td>
                          <td className="py-2 text-right tabular-nums text-muted">{rec.ttl ?? "–"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          ))}
        </>
      ) : null}
    </div>
  );
}
