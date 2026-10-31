"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { ProBadge } from "@/components/ui/badge";
import type { ToolSummary } from "@/lib/site";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import { ToolIcon } from "@/tools/icons";

export function scoreTool(tool: ToolSummary, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const name = tool.name.toLowerCase();
  if (name === q) return 100;
  if (name.startsWith(q)) return 80;
  if (name.includes(q)) return 60;
  if (tool.keywords.some((k) => k.includes(q))) return 40;
  const words = q.split(/\s+/);
  const haystack = `${name} ${tool.keywords.join(" ")} ${tool.description.toLowerCase()}`;
  return words.every((w) => haystack.includes(w)) ? 20 : 0;
}

export function searchTools(tools: ToolSummary[], query: string, limit = 8): ToolSummary[] {
  return tools
    .map((t) => ({ t, s: scoreTool(t, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.t);
}

/** Header search button that opens a command-palette style tool finder (Ctrl/⌘ + K). */
export function ToolSearch({ tools, categoryNames }: { tools: ToolSummary[]; categoryNames: Record<string, string> }) {
  const t = useT();
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = useMemo(() => searchTools(tools, query), [tools, query]);

  function open() {
    dialogRef.current?.showModal();
    setQuery("");
    setActive(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function go(tool: ToolSummary | undefined) {
    if (!tool) return;
    dialogRef.current?.close();
    router.push(`/tools/${tool.slug}`);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm text-muted transition-colors hover:border-primary-line hover:text-ink md:w-64"
        aria-label={t("search.label")}
      >
        <Search className="size-4" aria-hidden />
        <span className="hidden md:inline">{t("search.button", { count: tools.length })}</span>
        <kbd className="ms-auto hidden rounded border border-line px-1.5 font-sans text-[11px] md:inline">Ctrl K</kbd>
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto mt-[12vh] w-[min(560px,calc(100%-2rem))] rounded-xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-5 text-muted" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(results[active]);
              }
            }}
            placeholder={t("search.placeholder")}
            className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted/70"
            aria-label={t("search.label")}
            role="combobox"
            aria-expanded="true"
            aria-controls="tool-search-results"
            aria-activedescendant={results[active] ? `tool-result-${results[active].slug}` : undefined}
          />
        </div>
        <ul id="tool-search-results" role="listbox" className="max-h-[60vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-muted">{t("search.noResults", { query })}</li>
          ) : (
            results.map((tool, i) => (
              <li
                key={tool.slug}
                id={`tool-result-${tool.slug}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(tool)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5",
                  i === active ? "bg-primary-soft" : undefined,
                )}
              >
                <span className={`grid size-9 shrink-0 place-items-center rounded-lg bg-paper text-cat-${tool.category}`}>
                  <ToolIcon name={tool.icon} className="size-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {tool.name}
                    {tool.premium ? <ProBadge /> : null}
                  </span>
                  <span className="block truncate text-xs text-muted">{categoryNames[tool.category]}</span>
                </span>
              </li>
            ))
          )}
        </ul>
      </dialog>
    </>
  );
}
