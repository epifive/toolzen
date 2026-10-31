"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { ToolSummary } from "@/lib/site";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { ToolCard } from "./tool-card";
import { scoreTool } from "./tool-search";

/** Searchable, filterable grid of every tool (the /tools page). */
export function ToolsBrowser({
  tools,
  categories,
  initialQuery = "",
}: {
  tools: ToolSummary[];
  categories: Array<{ slug: string; name: string }>;
  initialQuery?: string;
}) {
  const t = useT();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<string>("all");

  const visible = useMemo(() => {
    const inCategory = category === "all" ? tools : tools.filter((tool) => tool.category === category);
    if (!query.trim()) return inCategory;
    return inCategory
      .map((tool) => ({ tool, score: scoreTool(tool, query) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.tool);
  }, [tools, query, category]);

  const filters = [{ slug: "all", name: t("tools.filterAll") }, ...categories.filter((c) => tools.some((tool) => tool.category === c.slug))];

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 start-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.label")}
            aria-label={t("search.label")}
            className="h-11 w-full rounded-lg border border-line bg-surface pe-3 ps-10 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
          />
        </div>
        <div role="tablist" aria-label={t("tools.filterLabel")} className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.slug}
              type="button"
              role="tab"
              aria-selected={category === f.slug}
              onClick={() => setCategory(f.slug)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                category === f.slug ? "border-primary bg-primary text-white" : "border-line bg-surface text-muted hover:text-ink",
              )}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-6 text-sm text-muted" aria-live="polite">
        {visible.length === 1 ? t("tools.countOne") : t("tools.count", { count: visible.length })}
      </p>
      {visible.length ? (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((tool) => (
            <li key={tool.slug}>
              <ToolCard tool={{ ...tool, title: tool.name }} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-line px-6 py-16 text-center">
          <p className="font-medium">{t("tools.noMatch", { query })}</p>
          <button type="button" onClick={() => setQuery("")} className="mt-2 text-sm font-medium text-primary hover:underline">
            {t("tools.clearSearch")}
          </button>
        </div>
      )}
    </div>
  );
}
