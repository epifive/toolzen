import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/site/ad-slot";
import { JsonLd } from "@/components/site/json-ld";
import { ToolCard } from "@/components/site/tool-card";
import { getT, localizeCategory } from "@/lib/i18n/server";
import { absoluteUrl, getSiteContext } from "@/lib/site";
import { CATEGORIES } from "@/tools/categories";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const category = await localizeCategory((await params).slug);
  if (!category) return {};
  const t = await getT();
  return {
    title: t("category.metaTitle", { category: category.name.toLowerCase() }),
    description: category.description,
    alternates: { canonical: `/category/${category.slug}` },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const category = await localizeCategory((await params).slug);
  if (!category) notFound();
  const [{ tools, settings }, t, others] = await Promise.all([
    getSiteContext(),
    getT(),
    Promise.all(CATEGORIES.filter((c) => c.slug !== category.slug).map(async (c) => (await localizeCategory(c.slug))!)),
  ]);
  const list = tools.filter((tool) => tool.category === category.slug);
  if (!list.length) notFound();

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: category.name,
          itemListElement: list.map((tool, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: absoluteUrl(settings, `/tools/${tool.slug}`),
            name: tool.title,
          })),
        }}
      />
      <section className="relative overflow-hidden border-b border-line">
        <div className="mat-grid mat-grid-fade absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <p className="flex items-center gap-2 text-sm font-medium text-muted">
            <span className={`size-2.5 rounded-full bg-cat-${category.slug}`} aria-hidden />
            {t("category.toolCount", { count: list.length })}
          </p>
          <h1 className="mt-3 text-4xl font-bold sm:text-5xl">{category.name}</h1>
          <p className="mt-4 max-w-[62ch] text-lg leading-relaxed text-muted">{category.description}</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <AdSlot slot="ad_tool_top" className="mt-8" />
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((tool) => (
            <li key={tool.slug}>
              <ToolCard tool={tool} />
            </li>
          ))}
        </ul>

        <nav aria-label={t("category.others")} className="mt-16">
          <h2 className="text-xl font-bold">{t("category.others")}</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {others
              .filter((c) => tools.some((tool) => tool.category === c.slug))
              .map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/category/${c.slug}`}
                    className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium hover:border-primary-line"
                  >
                    <span className={`size-2 rounded-full bg-cat-${c.slug}`} aria-hidden />
                    {c.name}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
