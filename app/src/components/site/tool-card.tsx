import Link from "next/link";
import { ProBadge } from "@/components/ui/badge";
import { ToolIcon } from "@/tools/icons";

/** The fields a tool tile needs (satisfied by both `Tool` and mapped `ToolSummary`). */
export interface CardTool {
  slug: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  premium: boolean;
}

/** Tile linking to a tool. Used in grids on the home, category and all-tools pages. */
export function ToolCard({ tool }: { tool: CardTool }) {
  return (
    <Link
      href={`/tools/${tool.slug}`}
      // Pages are rendered per request; prefetching dozens of tiles would hit the server needlessly.
      prefetch={false}
      className="group flex h-full gap-3.5 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-primary-line"
    >
      <span className={`grid size-10 shrink-0 place-items-center rounded-lg bg-cat-${tool.category}/10 text-cat-${tool.category}`}>
        <ToolIcon name={tool.icon} className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink group-hover:text-primary">{tool.title}</span>
          {tool.premium ? <ProBadge /> : null}
        </span>
        <span className="mt-1 line-clamp-2 block text-sm leading-snug text-muted">{tool.description}</span>
      </span>
    </Link>
  );
}

/** Compact one-line link, used for long lists and "related tools". */
export function ToolLink({ tool }: { tool: CardTool }) {
  return (
    <Link
      href={`/tools/${tool.slug}`}
      // Pages are rendered per request; prefetching dozens of tiles would hit the server needlessly.
      prefetch={false}
      className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-ink transition-colors hover:bg-primary-soft"
    >
      <span className={`grid size-8 shrink-0 place-items-center rounded-md bg-cat-${tool.category}/10 text-cat-${tool.category}`}>
        <ToolIcon name={tool.icon} className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate">{tool.title}</span>
      {tool.premium ? <ProBadge /> : null}
    </Link>
  );
}
