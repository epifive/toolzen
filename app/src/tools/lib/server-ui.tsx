"use client";

/**
 * Hooks and UI pieces shared by the server-side SEO & web tools
 * (DNS lookup, SSL checker, header checker, …).
 */

import { useCallback, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CircleCheck, CircleX, Search, TriangleAlert } from "lucide-react";
import { Panel, Spinner } from "@/components/tool-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Hint, Input, Label } from "@/components/ui/field";
import { useTool } from "@/tools/context";
import { callServerTool } from "./server-client";
import type { CheckStatus } from "./server-types";

/** Calls a server tool, keeping only the latest response, and records a use on success. */
export function useServerTool<T>(slug: string) {
  const { track } = useTool();
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);

  const run = useCallback(
    async (input: Record<string, unknown>): Promise<T | null> => {
      const id = ++latest.current;
      setLoading(true);
      setError("");
      try {
        const data = await callServerTool<T>(slug, input);
        if (id !== latest.current) return null;
        setResult(data);
        track();
        return data;
      } catch (e) {
        if (id === latest.current) {
          setResult(null);
          setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
        }
        return null;
      } finally {
        if (id === latest.current) setLoading(false);
      }
    },
    [slug, track],
  );

  return { result, error, loading, run };
}

/** Single text field with a submit button, plus optional extra options below. */
export function LookupForm({
  id,
  label,
  value,
  onChange,
  onSubmit,
  loading,
  placeholder,
  submitLabel = "Check",
  inputMode = "url",
  hint,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  placeholder?: string;
  submitLabel?: string;
  inputMode?: "url" | "text" | "decimal";
  hint?: ReactNode;
  children?: ReactNode;
}) {
  function submit(event: FormEvent) {
    event.preventDefault();
    if (value.trim() && !loading) onSubmit();
  }

  return (
    <Panel>
      <form onSubmit={submit} aria-busy={loading}>
        <Label htmlFor={id}>{label}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            inputMode={inputMode}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={2000}
            className="min-w-0 flex-1"
          />
          <Button type="submit" disabled={loading || !value.trim()} className="shrink-0">
            {loading ? <Spinner /> : <Search aria-hidden />}
            {loading ? "Checking…" : submitLabel}
          </Button>
        </div>
        {hint ? <Hint>{hint}</Hint> : null}
        {children ? <div className="mt-4">{children}</div> : null}
        <p className="sr-only" aria-live="polite">
          {loading ? "Checking, please wait." : ""}
        </p>
      </form>
    </Panel>
  );
}

const CHECK_BADGES: Record<CheckStatus, { tone: "success" | "warning" | "danger"; label: string; icon: ReactNode }> = {
  pass: { tone: "success", label: "Pass", icon: <CircleCheck aria-hidden /> },
  warn: { tone: "warning", label: "Warning", icon: <TriangleAlert aria-hidden /> },
  fail: { tone: "danger", label: "Fail", icon: <CircleX aria-hidden /> },
};

/** Pass / Warning / Fail badge with an icon, so the status doesn't rely on colour alone. */
export function CheckBadge({ status, label }: { status: CheckStatus; label?: string }) {
  const badge = CHECK_BADGES[status];
  return (
    <Badge tone={badge.tone} className="shrink-0 [&_svg]:size-3.5">
      {badge.icon}
      {label ?? badge.label}
    </Badge>
  );
}

/** Label / value rows, stacked on phones and side by side on wider screens. */
export function DetailList({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="divide-y divide-line text-sm">
      {items.map((item) => (
        <div key={item.label} className="grid gap-0.5 py-2 first:pt-0 last:pb-0 sm:grid-cols-[11rem_1fr] sm:gap-4">
          <dt className="text-muted">{item.label}</dt>
          <dd className="min-w-0 break-words text-ink">{item.value ?? "–"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Link to a third-party page found by a tool. Opens in a new tab without passing referrer or opener. */
export function ExternalLink({ href, children }: { href: string; children?: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-primary underline-offset-2 hover:underline">
      {children ?? href}
    </a>
  );
}

export function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "–";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "–" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Badge colour for an HTTP status code. */
export function statusTone(status: number | null): "success" | "primary" | "warning" | "danger" {
  if (status === null || status >= 500) return "danger";
  if (status >= 400) return "warning";
  if (status >= 300) return "primary";
  return "success";
}
