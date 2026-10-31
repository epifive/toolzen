import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Crown, LogIn } from "lucide-react";
import { AdSlot } from "@/components/site/ad-slot";
import { JsonLd } from "@/components/site/json-ld";
import { ToolLink } from "@/components/site/tool-card";
import { ToolRunner } from "@/components/site/tool-runner";
import { ProBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getT, localizeCategory } from "@/lib/i18n/server";
import { absoluteUrl, getSiteContext } from "@/lib/site";
import { ToolIcon } from "@/tools/icons";

async function loadTool(slug: string) {
  const ctx = await getSiteContext();
  const tool = ctx.tools.find((item) => item.slug === slug);
  return tool ? { ctx, tool } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const found = await loadTool(slug);
  if (!found) return {};
  const { tool } = found;
  return {
    title: tool.title,
    description: tool.metaDescription,
    keywords: tool.keywords,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: { title: tool.title, description: tool.metaDescription, url: `/tools/${tool.slug}` },
  };
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await loadTool(slug);
  if (!found) notFound();
  const { ctx, tool } = found;
  const { settings, user, entitlements, tools } = ctx;
  const [category, t] = await Promise.all([localizeCategory(tool.category).then((c) => c!), getT()]);
  const related = tools.filter((item) => item.category === tool.category && item.slug !== tool.slug).slice(0, 8);

  const needsLogin = settings.login_required_for_tools && !user;
  const locked = tool.premium && !entitlements.premiumTools;
  const url = absoluteUrl(settings, `/tools/${tool.slug}`);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebApplication",
              name: tool.title,
              description: tool.metaDescription,
              url,
              applicationCategory: "UtilitiesApplication",
              operatingSystem: "Any (runs in the browser)",
              offers: { "@type": "Offer", price: "0", priceCurrency: settings.currency },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: t("nav.home"), item: absoluteUrl(settings, "/") },
                { "@type": "ListItem", position: 2, name: category.name, item: absoluteUrl(settings, `/category/${category.slug}`) },
                { "@type": "ListItem", position: 3, name: tool.title, item: url },
              ],
            },
            {
              "@type": "FAQPage",
              mainEntity: tool.faq.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            },
          ],
        }}
      />

      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
            <li>
              <Link href="/" className="hover:text-ink">
                {t("nav.home")}
              </Link>
            </li>
            <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden />
            <li>
              <Link href={`/category/${category.slug}`} className="hover:text-ink">
                {category.name}
              </Link>
            </li>
            <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden />
            <li aria-current="page" className="text-ink">
              {tool.title}
            </li>
          </ol>
        </nav>

        <header className="mt-6 flex items-start gap-4">
          <span className={`grid size-14 shrink-0 place-items-center rounded-xl bg-cat-${tool.category}/10 text-cat-${tool.category}`}>
            <ToolIcon name={tool.icon} className="size-7" />
          </span>
          <div>
            <h1 className="flex flex-wrap items-center gap-3 text-3xl font-bold sm:text-4xl">
              {tool.title}
              {tool.premium ? <ProBadge className="text-xs" /> : null}
            </h1>
            <p className="mt-2 max-w-[70ch] text-lg text-muted">{tool.description}</p>
          </div>
        </header>

        <AdSlot slot="ad_tool_top" className="mt-6" />

        <section aria-label={tool.title} className="mat-grid mt-6 -mx-2 rounded-2xl border border-line p-1.5 sm:mx-0 sm:p-5">
          {needsLogin ? (
            <Gate
              icon={<LogIn className="size-6" aria-hidden />}
              title={t("tool.loginTitle", { tool: tool.title })}
              body={t("tool.loginText")}
              primary={{ href: `/login?next=/tools/${tool.slug}`, label: t("tool.signIn") }}
              secondary={settings.registration_enabled ? { href: `/register?next=/tools/${tool.slug}`, label: t("tool.createAccount") } : undefined}
            />
          ) : locked ? (
            <Gate
              icon={<Crown className="size-6" aria-hidden />}
              title={t("tool.proTitle", { tool: tool.title })}
              body={t("tool.proText")}
              primary={{ href: "/pricing", label: t("tool.seePlans") }}
              secondary={user ? undefined : { href: `/login?next=/tools/${tool.slug}`, label: t("tool.haveProAlready") }}
            />
          ) : (
            <div className="rounded-xl bg-paper/80 p-1.5 backdrop-blur-[1px] sm:p-4">
              <ToolRunner
                slug={tool.slug}
                limits={{ maxFileMb: entitlements.maxFileMb, maxBatch: entitlements.maxBatch }}
                isPremium={entitlements.isPremium}
              />
            </div>
          )}
        </section>

        <AdSlot slot="ad_tool_bottom" className="mt-6" />

        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_320px]">
          <div className="space-y-12">
            <section aria-labelledby="how-to">
              <h2 id="how-to" className="text-2xl font-bold">
                {t("tool.howTo", { tool: tool.title })}
              </h2>
              <ol className="mt-5 space-y-4">
                {tool.steps.map((step, i) => (
                  <li key={step} className="flex gap-4">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full border border-primary-line font-display text-sm font-semibold text-primary">
                      {i + 1}
                    </span>
                    <p className="pt-1 leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section aria-labelledby="faq">
              <h2 id="faq" className="text-2xl font-bold">
                {t("tool.faq")}
              </h2>
              <div className="mt-5 divide-y divide-line rounded-xl border border-line bg-surface">
                {tool.faq.map((f) => (
                  <details key={f.q} className="group px-5 py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                      {f.q}
                      <ChevronRight className="size-4 shrink-0 text-muted transition-transform group-open:rotate-90 rtl:rotate-180 rtl:group-open:rotate-90" aria-hidden />
                    </summary>
                    <p className="mt-3 leading-relaxed text-muted">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            {related.length ? (
              <section aria-labelledby="related" className="rounded-xl border border-line bg-surface p-3">
                <h2 id="related" className="px-2 pt-1 pb-2 font-sans text-sm font-semibold tracking-normal">
                  {t("tool.more", { category: category.name.toLowerCase() })}
                </h2>
                <ul>
                  {related.map((item) => (
                    <li key={item.slug}>
                      <ToolLink tool={item} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <AdSlot slot="ad_sidebar" />
          </aside>
        </div>
      </div>
    </>
  );
}

function Gate({
  icon,
  title,
  body,
  primary,
  secondary,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <div className="rounded-xl bg-surface px-6 py-14 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-marker text-[#3d2e00]">{icon}</span>
      <h2 className="mt-5 text-2xl font-bold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-muted">{body}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <ButtonLink href={primary.href} size="lg">
          {primary.label}
        </ButtonLink>
        {secondary ? (
          <ButtonLink href={secondary.href} size="lg" variant="outline">
            {secondary.label}
          </ButtonLink>
        ) : null}
      </div>
    </div>
  );
}
