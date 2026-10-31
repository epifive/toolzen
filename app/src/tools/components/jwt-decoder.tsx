"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorText, Panel, TextInput } from "@/components/tool-ui";
import { useTool } from "@/tools/context";
import { decodeJwt, errorMessage, formatRelativeTime, type DecodedJwt } from "@/tools/lib/dev";
import { CodeBlock, useNow } from "@/tools/lib/dev-ui";

const TIME_CLAIMS: Array<{ claim: string; label: string }> = [
  { claim: "iat", label: "Issued at" },
  { claim: "nbf", label: "Not before" },
  { claim: "exp", label: "Expires" },
  { claim: "auth_time", label: "Authenticated at" },
];

const TEXT_CLAIMS: Array<{ claim: string; label: string }> = [
  { claim: "iss", label: "Issuer" },
  { claim: "sub", label: "Subject" },
  { claim: "aud", label: "Audience" },
  { claim: "jti", label: "Token ID" },
];

type Decoded = { ok: true; token: DecodedJwt } | { ok: false; error: string };

function claimsOf(payload: unknown): Record<string, unknown> {
  return typeof payload === "object" && payload !== null && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
}

function claimText(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(", ");
  return typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
}

function TimeClaim({ label, claim, seconds, now }: { label: string; claim: string; seconds: number; now: number }) {
  const ms = seconds * 1000;
  const date = new Date(ms);
  let status: ReactNode = null;
  if (claim === "exp") {
    status = ms <= now ? <Badge tone="danger">Expired</Badge> : <Badge tone="success">Not expired</Badge>;
  } else if (claim === "nbf" && ms > now) {
    status = <Badge tone="warning">Not valid yet</Badge>;
  } else if (claim === "iat" && ms > now + 60_000) {
    status = <Badge tone="warning">In the future</Badge>;
  }

  return (
    <div className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-4">
      <dt className="shrink-0 text-sm text-muted sm:w-36">
        {label} <span className="font-mono text-xs">({claim})</span>
      </dt>
      <dd className="min-w-0 flex-1 text-sm text-ink">
        {Number.isNaN(date.getTime()) ? (
          <span className="font-mono">{seconds}</span>
        ) : (
          <>
            <span className="flex flex-wrap items-center gap-2">
              <span>{date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })}</span>
              {status}
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              {formatRelativeTime(ms, now)} · <span className="font-mono">{seconds}</span>
            </span>
          </>
        )}
      </dd>
    </div>
  );
}

export default function JwtDecoder() {
  const { track } = useTool();
  const [input, setInput] = useState("");
  const now = useNow(1000);

  const decoded = useMemo<Decoded | null>(() => {
    if (!input.trim()) return null;
    try {
      return { ok: true, token: decodeJwt(input) };
    } catch (error) {
      return { ok: false, error: errorMessage(error, "This is not a valid JWT.") };
    }
  }, [input]);

  useEffect(() => {
    if (decoded?.ok) track();
  }, [decoded, track]);

  const token = decoded?.ok ? decoded.token : null;
  const claims = claimsOf(token?.payload);
  const headerJson = token ? JSON.stringify(token.header, null, 2) : "";
  const payloadJson = token ? JSON.stringify(token.payload, null, 2) : "";
  const timeClaims = TIME_CLAIMS.filter(({ claim }) => typeof claims[claim] === "number");
  const textClaims = TEXT_CLAIMS.filter(({ claim }) => claims[claim] !== undefined);

  return (
    <div className="space-y-4">
      <TextInput
        value={input}
        onChange={setInput}
        label="JSON Web Token"
        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature"
        rows={5}
        mono
      />

      <Alert tone="warning" title="The signature is not verified">
        This tool only decodes the token. Anyone can create a token with any contents, so always verify the signature on
        your server before trusting it.
      </Alert>

      {decoded && !decoded.ok ? <ErrorText>{decoded.error}</ErrorText> : null}

      {token ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge tone="primary">alg: {claimText(token.header.alg ?? "none")}</Badge>
            {token.header.typ !== undefined ? <Badge tone="neutral">typ: {claimText(token.header.typ)}</Badge> : null}
            {token.header.kid !== undefined ? <Badge tone="neutral">kid: {claimText(token.header.kid)}</Badge> : null}
            {String(token.header.alg).toLowerCase() === "none" ? <Badge tone="danger">Unsigned token</Badge> : null}
          </div>

          {timeClaims.length || textClaims.length ? (
            <Panel title="Claims">
              <dl className="divide-y divide-line">
                {timeClaims.map(({ claim, label }) => (
                  <TimeClaim key={claim} claim={claim} label={label} seconds={claims[claim] as number} now={now} />
                ))}
                {textClaims.map(({ claim, label }) => (
                  <div key={claim} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:gap-4">
                    <dt className="shrink-0 text-sm text-muted sm:w-36">
                      {label} <span className="font-mono text-xs">({claim})</span>
                    </dt>
                    <dd className="min-w-0 flex-1 font-mono text-[13px] break-all text-ink">{claimText(claims[claim])}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Header" actions={<CopyButton text={headerJson} />}>
              <CodeBlock code={headerJson} label="Decoded header" />
            </Panel>
            <Panel title="Payload" actions={<CopyButton text={payloadJson} />}>
              <CodeBlock code={payloadJson} label="Decoded payload" />
            </Panel>
          </div>

          <Panel title="Signature" actions={<CopyButton text={token.signature} />}>
            <CodeBlock code={token.signature || "(empty)"} label="Signature (Base64URL)" className="break-all" />
          </Panel>
        </>
      ) : null}
    </div>
  );
}
