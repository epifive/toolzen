"use client";

import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";

export interface ToolLimits {
  /** Maximum size of a single input file, in megabytes. */
  maxFileMb: number;
  /** Maximum number of files that can be processed at once. */
  maxBatch: number;
}

interface ToolContextValue {
  slug: string;
  limits: ToolLimits;
  /** True when the visitor has an active paid plan. */
  isPremium: boolean;
  /** Record one use of the tool (call it when the main action succeeds). */
  track: () => void;
}

const ToolContext = createContext<ToolContextValue | null>(null);

export function ToolProvider({
  slug,
  limits,
  isPremium,
  children,
}: {
  slug: string;
  limits: ToolLimits;
  isPremium: boolean;
  children: ReactNode;
}) {
  const lastTracked = useRef(0);

  const track = useCallback(() => {
    // Count at most one use every 10 seconds so live-updating tools don't flood the stats.
    const nowMs = Date.now();
    if (nowMs - lastTracked.current < 10_000) return;
    lastTracked.current = nowMs;
    const body = JSON.stringify({ slug });
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/track", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
    }
  }, [slug]);

  const value = useMemo(() => ({ slug, limits, isPremium, track }), [slug, limits, isPremium, track]);
  return <ToolContext.Provider value={value}>{children}</ToolContext.Provider>;
}

export function useTool(): ToolContextValue {
  const ctx = useContext(ToolContext);
  if (!ctx) {
    // Allows rendering a tool outside a tool page (e.g. in isolation) with sensible defaults.
    return { slug: "unknown", limits: { maxFileMb: 10, maxBatch: 5 }, isPremium: false, track: () => {} };
  }
  return ctx;
}
