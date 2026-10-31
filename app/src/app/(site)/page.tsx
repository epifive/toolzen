import Link from "next/link";
import { ArrowRight, Infinity as InfinityIcon, Lock, Zap } from "lucide-react";
import { PostCard } from "@/components/site/post-card";
import { FileFinder } from "@/components/site/file-finder";
import { JsonLd } from "@/components/site/json-ld";
import { ToolCard } from "@/components/site/tool-card";
import { ButtonLink } from "@/components/ui/button";
import { getLatestPosts } from "@/lib/blog";
import { getT, localizeCategory, localSetting } from "@/lib/i18n/server";
import { getActivePlans } from "@/lib/plans";
import { getSiteContext } from "@/lib/site";
import { formatMoney } from "@/lib/utils";
import { CATEGORIES } from "@/tools/categories";

export default async function HomePage() {
  const { settings, tools, toolSummaries, entitlements, blogVisible } = await getSiteContext();
  const [t, heroTitle, heroSubtitle, metaDescription, plans, categories, posts] = await Promise.all([
    getT(),
    localSetting(settings, "home_hero_title"),
    localSetting(settings, "home_hero_subtitle"),
    localSetting(settings, "meta_description"),
    getActivePlans(),
    Promise.all(CATEGORIES.map(async (c) => (await localizeCategory(c.slug))!)),
    blogVisible ? getLatestPosts(3) : Promise.resolve([]),
  ]);
  const featured = tools.filter((tool) => tool.featured).slice(0, 8);
  const popular = [...tools].sort((a, b) => b.uses - a.uses).slice(0, 8);
  const highlight = featured.length >= 4 ? featured : popular;
  const pro = plans.find((p) => !p.is_free && p.is_featured) ?? plans.find((p) => !p.is_free);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: settings.site_name,
    description: metaDescription,
    potentialAction: {
      "@type": "SearchAction",
      target: "/tools?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <JsonLd data={jsonLd} />

      {/* Hero: the workspace itself is the first thing visitors see. */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="mat-grid mat-grid-fade absolute inset-0" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div>
            <h1 className="max-w-[16ch] text-4xl leading-[1.05] font-bold sm:text-5xl lg:text-6xl">{heroTitle}</h1>
            <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-muted">{heroSubtitle}</p>
            <ul className="mt-8 flex flex-wrap gap-2" aria-label={t("home.categoriesLabel")}>
              {categories.map((c) => {
                const count = tools.filter((tool) => tool.category === c.slug).length;
                if (!count) return null;
                return (
                  <li key={c.slug}>
                    <Link
                      href={`/category/${c.slug}`}
                      className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium transition-colors hover:border-primary-line"
                    >
                      <span className={`size-2 rounded-full bg-cat-${c.slug}`} aria-hidden />
                      {c.name}
                      <span className="text-muted">{count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
          <FileFinder tools={toolSummaries} />
        </div>
      </section>

      {settings.show_stats_on_home ? (
        <section className="border-b border-line bg-surface">
          <ul className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6">
            <li className="flex gap-3">
              <Lock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <p className="text-sm text-muted">
                <span className="block font-semibold text-ink">{t("home.benefitPrivateTitle")}</span>
                {t("home.benefitPrivateText")}
              </p>
            </li>
            <li className="flex gap-3">
              <Zap className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <p className="text-sm text-muted">
                <span className="block font-semibold text-ink">{t("home.benefitFastTitle")}</span>
                {t("home.benefitFastText")}
              </p>
            </li>
            <li className="flex gap-3">
              <InfinityIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <p className="text-sm text-muted">
                <span className="block font-semibold text-ink">{t("home.benefitFreeTitle", { count: tools.length })}</span>
                {t("home.benefitFreeText")}
              </p>
            </li>
          </ul>
        </section>
      ) : null}

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {highlight.length ? (
          <section className="pt-16" aria-labelledby="popular-heading">
            <h2 id="popular-heading" className="text-2xl font-bold sm:text-3xl">
              {featured.length >= 4 ? t("home.popular") : t("home.mostUsed")}
            </h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {highlight.map((tool) => (
                <li key={tool.slug}>
                  <ToolCard tool={tool} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {categories.map((category) => {
          const list = tools.filter((tool) => tool.category === category.slug);
          if (!list.length) return null;
          return (
            <section key={category.slug} className="pt-16" aria-labelledby={`cat-${category.slug}`}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id={`cat-${category.slug}`} className="flex items-center gap-3 text-2xl font-bold">
                    <span className={`h-6 w-1.5 rounded-full bg-cat-${category.slug}`} aria-hidden />
                    {category.name}
                  </h2>
                  <p className="mt-1 text-muted">{category.summary}</p>
                </div>
                <Link href={`/category/${category.slug}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  {t("home.allInCategory", { category: category.name.toLowerCase() })}
                  <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                </Link>
              </div>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.slice(0, 6).map((tool) => (
                  <li key={tool.slug}>
                    <ToolCard tool={tool} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {posts.length ? (
          <section className="pt-16" aria-labelledby="blog-heading">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="blog-heading" className="text-2xl font-bold sm:text-3xl">
                {t("home.latestPosts")}
              </h2>
              <Link href="/blog" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                {t("blog.back")}
                <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </Link>
            </div>
            <ul className="mt-6 grid gap-5 md:grid-cols-3">
              {posts.map((post) => (
                <li key={post.id}>
                  <PostCard post={post} readMore={t("blog.readMore")} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {pro && !entitlements.isPremium ? (
          <section className="mt-20 overflow-hidden rounded-2xl bg-primary text-white">
            <div className="grid gap-8 p-8 sm:p-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
              <div>
                <h2 className="text-3xl font-bold">{t("home.proTitle")}</h2>
                <p className="mt-3 max-w-[52ch] text-white/80">
                  {t("home.proText", { plan: pro.name, mb: pro.max_file_mb, batch: pro.max_batch })}
                  {pro.ad_free ? ` ${t("home.proAdFree")}` : ""}
                  {pro.premium_tools ? ` ${t("home.proTools")}` : ""}
                </p>
              </div>
              <div className="flex flex-col items-start gap-3 lg:items-end">
                <p className="font-display text-4xl font-bold">
                  {formatMoney(pro.price_monthly, settings.currency)}
                  <span className="text-base font-normal text-white/70"> {t("home.perMonth")}</span>
                </p>
                <ButtonLink href="/pricing" variant="outline" size="lg" className="border-transparent bg-white text-primary hover:text-primary-strong">
                  {t("home.seePlans")}
                </ButtonLink>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
