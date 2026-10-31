"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { CopyButton, ErrorText, Panel, ToolColumns } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { copyToClipboard } from "@/lib/files";
import { useTool } from "@/tools/context";
import { buildUtmUrl, UTM_FIELDS, type UtmField, type UtmParams } from "@/tools/lib/seo";

const HISTORY_KEY = "toolzen:utm-history";
const HISTORY_SIZE = 5;

const EMPTY: UtmParams = { utm_source: "", utm_medium: "", utm_campaign: "", utm_term: "", utm_content: "" };

const FIELD_INFO: Record<UtmField, { label: string; placeholder: string; hint: string; required?: boolean }> = {
  utm_source: {
    label: "Campaign source",
    placeholder: "facebook",
    hint: "Where the traffic comes from: google, newsletter, facebook…",
    required: true,
  },
  utm_medium: {
    label: "Campaign medium",
    placeholder: "social",
    hint: "The marketing channel: cpc, email, social, banner…",
    required: true,
  },
  utm_campaign: { label: "Campaign name", placeholder: "spring_sale", hint: "Product, promo code or slogan.", required: true },
  utm_term: { label: "Campaign term", placeholder: "running shoes", hint: "Optional. Paid search keywords." },
  utm_content: {
    label: "Campaign content",
    placeholder: "header_banner",
    hint: "Optional. Tells apart ads or links that point to the same URL.",
  },
};

const PRESETS: Array<{ label: string; source: string; medium: string }> = [
  { label: "Facebook", source: "facebook", medium: "social" },
  { label: "Instagram", source: "instagram", medium: "social" },
  { label: "LinkedIn", source: "linkedin", medium: "social" },
  { label: "X (Twitter)", source: "x", medium: "social" },
  { label: "Google Ads", source: "google", medium: "cpc" },
  { label: "Microsoft Ads", source: "bing", medium: "cpc" },
  { label: "Newsletter", source: "newsletter", medium: "email" },
  { label: "QR code", source: "qr_code", medium: "offline" },
];

function readHistory(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string").slice(0, HISTORY_SIZE) : [];
  } catch {
    return [];
  }
}

function writeHistory(history: string[]): void {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Storage can be full or disabled (private mode); history is a convenience only.
  }
}

export default function UtmBuilder() {
  const { track } = useTool();
  const [url, setUrl] = useState("");
  const [params, setParams] = useState<UtmParams>(EMPTY);
  const [history, setHistory] = useState<string[]>(readHistory);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => buildUtmUrl(url, params), [url, params]);
  const missing = UTM_FIELDS.filter((f) => FIELD_INFO[f].required && !params[f].trim());
  const link = result.ok && params.utm_source.trim() ? result.url : "";

  useEffect(() => {
    if (link) track();
  }, [link, track]);

  async function copyAndSave() {
    if (!link || !(await copyToClipboard(link))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    const next = [link, ...history.filter((h) => h !== link)].slice(0, HISTORY_SIZE);
    setHistory(next);
    writeHistory(next);
  }

  function clearHistory() {
    setHistory([]);
    writeHistory([]);
  }

  return (
    <ToolColumns>
      <Panel title="Link details">
        <div className="space-y-4">
          <Field
            label="Website URL"
            htmlFor="utm-url"
            hint={
              result.ok && result.addedScheme
                ? "https:// was added because the URL had no scheme."
                : "Existing query parameters are kept."
            }
          >
            <Input
              id="utm-url"
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/landing-page"
              aria-invalid={Boolean(url.trim() && !result.ok)}
            />
          </Field>
          {url.trim() && !result.ok ? <ErrorText>{result.error}</ErrorText> : null}

          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Quick presets</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const active = params.utm_source === p.source && params.utm_medium === p.medium;
                return (
                  <Button
                    key={p.label}
                    size="sm"
                    variant={active ? "primary" : "secondary"}
                    aria-pressed={active}
                    onClick={() => setParams((prev) => ({ ...prev, utm_source: p.source, utm_medium: p.medium }))}
                  >
                    {p.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {UTM_FIELDS.map((field) => {
            const info = FIELD_INFO[field];
            return (
              <Field
                key={field}
                label={
                  <>
                    {info.label} <span className="font-mono text-xs font-normal text-muted">{field}</span>
                    {info.required ? <span className="text-xs font-normal text-muted"> · recommended</span> : null}
                  </>
                }
                htmlFor={`utm-${field}`}
                hint={info.hint}
              >
                <Input
                  id={`utm-${field}`}
                  value={params[field]}
                  onChange={(e) => setParams((prev) => ({ ...prev, [field]: e.target.value }))}
                  placeholder={info.placeholder}
                />
              </Field>
            );
          })}
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel title="Tracked link">
          {link ? (
            <div className="space-y-3">
              <p className="rounded-lg border border-line bg-paper px-3 py-2.5 font-mono text-[13px] break-all text-ink">
                {link}
              </p>
              {missing.length ? (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Add {missing.join(", ")} so the visits are grouped correctly in Google Analytics.
                </p>
              ) : null}
              <Button onClick={copyAndSave}>
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted">Enter a URL and at least the campaign source to build your link.</p>
          )}
        </Panel>

        <Panel
          title="Recent links"
          actions={
            history.length ? (
              <Button size="sm" variant="ghost" onClick={clearHistory}>
                Clear
              </Button>
            ) : null
          }
        >
          {history.length ? (
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h} className="flex items-start gap-2 rounded-lg border border-line px-3 py-2">
                  <span className="min-w-0 flex-1 font-mono text-xs break-all text-ink">{h}</span>
                  <CopyButton text={h} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">The last {HISTORY_SIZE} links you copy are saved in this browser.</p>
          )}
        </Panel>
      </div>
    </ToolColumns>
  );
}
