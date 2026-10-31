"use client";

import { useState } from "react";
import { ErrorText, Panel, Stat, StatGrid } from "@/components/tool-ui";
import { Alert } from "@/components/ui/alert";
import type { CheckStatus, SslResult } from "@/tools/lib/server-types";
import { CheckBadge, DetailList, formatDateTime, LookupForm, useServerTool } from "@/tools/lib/server-ui";

const EXPIRY_WARNING_DAYS = 30;

function verdict(result: SslResult): { tone: "success" | "warning" | "error"; title: string; text: string } {
  const days = result.daysRemaining ?? -1;
  if (days < 0) return { tone: "error", title: "The certificate has expired", text: "Visitors will see a security warning until it is renewed." };
  if (!result.hostnameMatch) {
    return { tone: "error", title: "The certificate doesn't cover this name", text: `${result.host} is not listed in the certificate's names.` };
  }
  if (!result.chainTrusted) {
    return {
      tone: "error",
      title: "The certificate is not trusted",
      text: `Browsers will show a warning (${result.authorizationError ?? "untrusted chain"}). Check that intermediate certificates are installed.`,
    };
  }
  if (days < EXPIRY_WARNING_DAYS) {
    return { tone: "warning", title: "The certificate expires soon", text: `Renew it within ${days} day${days === 1 ? "" : "s"}.` };
  }
  return { tone: "success", title: "The certificate is valid and trusted", text: `It is valid for another ${days} days.` };
}

export default function SslChecker() {
  const [host, setHost] = useState("");
  const { result, error, loading, run } = useServerTool<SslResult>("ssl-checker");

  const summary = result ? verdict(result) : null;
  const days = result?.daysRemaining ?? null;
  const checks: Array<{ label: string; status: CheckStatus }> = result
    ? [
        { label: "Trusted by browsers", status: result.chainTrusted ? "pass" : "fail" },
        { label: "Matches the domain", status: result.hostnameMatch ? "pass" : "fail" },
        { label: "Not expired", status: days !== null && days >= 0 ? "pass" : "fail" },
        { label: `More than ${EXPIRY_WARNING_DAYS} days left`, status: days !== null && days >= EXPIRY_WARNING_DAYS ? "pass" : "warn" },
        {
          label: "Modern protocol (TLS 1.2+)",
          status: result.protocol === "TLSv1.3" || result.protocol === "TLSv1.2" ? "pass" : "fail",
        },
      ]
    : [];

  return (
    <div className="space-y-4">
      <LookupForm
        id="ssl-host"
        label="Domain name"
        value={host}
        onChange={setHost}
        onSubmit={() => run({ host })}
        loading={loading}
        placeholder="example.com"
        hint="We connect to port 443 of the domain and read its certificate."
      />

      <ErrorText>{error}</ErrorText>

      {result && summary ? (
        <>
          <Alert tone={summary.tone} title={summary.title}>
            {summary.text}
          </Alert>

          <StatGrid>
            <Stat label="Days remaining" value={days === null ? "–" : days.toLocaleString()} emphasis />
            <Stat label="Protocol" value={result.protocol ?? "–"} />
            <Stat label="Key" value={result.keyInfo ?? "–"} />
          </StatGrid>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Checks">
              <ul className="space-y-2">
                {checks.map((c) => (
                  <li key={c.label} className="flex items-center justify-between gap-3 text-sm text-ink">
                    {c.label}
                    <CheckBadge status={c.status} />
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title="Certificate chain">
              <ol className="space-y-3">
                {result.chain.map((cert, i) => (
                  <li key={`${cert.subject}-${i}`} className="border-l-2 border-primary-line pl-3 text-sm">
                    <p className="font-medium break-words text-ink">{cert.subject || "(no subject)"}</p>
                    <p className="text-xs text-muted">
                      {i === 0 ? "Server certificate" : cert.selfSigned ? "Root certificate" : "Intermediate"} · expires{" "}
                      {formatDateTime(cert.validTo)}
                    </p>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>

          <Panel title={`Certificate for ${result.host}`}>
            <DetailList
              items={[
                { label: "Subject", value: result.subject },
                { label: "Issuer", value: result.issuer },
                { label: "Valid from", value: formatDateTime(result.validFrom) },
                { label: "Valid until", value: formatDateTime(result.validTo) },
                { label: "Server IP", value: <span className="font-mono">{result.ip}</span> },
                { label: "Cipher", value: result.cipher ?? "–" },
                { label: "Serial number", value: <span className="font-mono break-all">{result.serialNumber}</span> },
                {
                  label: "SHA-256 fingerprint",
                  value: <span className="font-mono text-xs break-all">{result.fingerprint256}</span>,
                },
              ]}
            />
          </Panel>

          <Panel title={`Names covered (${result.sans.length})`}>
            {result.sans.length ? (
              <ul className="flex max-h-64 flex-wrap gap-2 overflow-y-auto">
                {result.sans.map((name) => (
                  <li key={name} className="rounded-md bg-paper px-2 py-1 font-mono text-xs break-all text-ink">
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">The certificate lists no subject alternative names.</p>
            )}
          </Panel>
        </>
      ) : null}
    </div>
  );
}
