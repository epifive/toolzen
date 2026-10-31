import Link from "next/link";
import { getT, localizeCategory, localSetting } from "@/lib/i18n/server";
import { fillPlaceholders } from "@/lib/settings";
import { getSiteContext, uploadUrl } from "@/lib/site";
import { CATEGORIES } from "@/tools/categories";
import { Logo } from "./logo";

export async function SiteFooter() {
  const { settings, tools, footerPages, blogVisible } = await getSiteContext();
  const [t, footerText, copyright] = await Promise.all([getT(), localSetting(settings, "footer_text"), localSetting(settings, "copyright_text")]);
  const columns = (
    await Promise.all(
      CATEGORIES.map(async (c) => ({
        category: (await localizeCategory(c.slug))!,
        tools: tools.filter((tool) => tool.category === c.slug).slice(0, 5),
      })),
    )
  ).filter((c) => c.tools.length);

  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-14 sm:px-6">
        <div className="max-w-md">
          <Logo siteName={settings.site_name} logo={uploadUrl(settings.logo)} logoDark={uploadUrl(settings.logo_dark)} />
          <p className="mt-4 text-sm leading-relaxed text-muted">{fillPlaceholders(footerText, settings)}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4 lg:grid-cols-7">
          {columns.map(({ category, tools: list }) => (
            <div key={category.slug}>
              <h2 className="font-sans text-sm font-semibold tracking-normal">
                <Link href={`/category/${category.slug}`} prefetch={false} className="hover:text-primary">
                  {category.name}
                </Link>
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                {list.map((tool) => (
                  <li key={tool.slug}>
                    <Link href={`/tools/${tool.slug}`} prefetch={false} className="text-muted hover:text-ink">
                      {tool.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>{fillPlaceholders(copyright, settings)}</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {blogVisible ? (
              <li>
                <Link href="/blog" prefetch={false} className="hover:text-ink">
                  {t("nav.blog")}
                </Link>
              </li>
            ) : null}
            {footerPages.map((p) => (
              <li key={p.slug}>
                <Link href={`/p/${p.slug}`} prefetch={false} className="hover:text-ink">
                  {p.title}
                </Link>
              </li>
            ))}
            {settings.contact_enabled ? (
              <li>
                <Link href="/contact" className="hover:text-ink">
                  {t("nav.contact")}
                </Link>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </footer>
  );
}
