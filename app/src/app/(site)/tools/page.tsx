import type { Metadata } from "next";
import { ToolsBrowser } from "@/components/site/tools-browser";
import { getT, localizeCategory } from "@/lib/i18n/server";
import { getSiteContext } from "@/lib/site";
import { CATEGORIES } from "@/tools/categories";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("tools.title"),
    description: "Browse every free online tool: image, PDF, text, developer, SEO tools, converters and calculators.",
    alternates: { canonical: "/tools" },
  };
}

export default async function AllToolsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ toolSummaries }, { q }, t, categories] = await Promise.all([
    getSiteContext(),
    searchParams,
    getT(),
    Promise.all(CATEGORIES.map(async (c) => (await localizeCategory(c.slug))!)),
  ]);
  return (
    <div className="mx-auto max-w-7xl px-4 pt-12 sm:px-6">
      <h1 className="text-4xl font-bold">{t("tools.title")}</h1>
      <p className="mt-2 max-w-[60ch] text-lg text-muted">{t("tools.subtitle", { count: toolSummaries.length })}</p>
      <div className="mt-8">
        <ToolsBrowser
          tools={toolSummaries}
          categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
          initialQuery={typeof q === "string" ? q.slice(0, 100) : ""}
        />
      </div>
    </div>
  );
}
