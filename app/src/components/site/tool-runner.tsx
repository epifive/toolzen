"use client";

import { useT } from "@/lib/i18n/client";
import { ToolProvider, type ToolLimits } from "@/tools/context";
import { TOOL_COMPONENTS } from "@/tools/loader";

/** Loads the tool's client component and provides the visitor's plan limits to it. */
export function ToolRunner({ slug, limits, isPremium }: { slug: string; limits: ToolLimits; isPremium: boolean }) {
  const t = useT();
  const Component = TOOL_COMPONENTS[slug];
  return (
    <ToolProvider slug={slug} limits={limits} isPremium={isPremium}>
      <div data-tool-runner={slug}>
        {Component ? <Component /> : <p className="py-10 text-center text-sm text-muted">{t("tool.unavailable")}</p>}
      </div>
    </ToolProvider>
  );
}
