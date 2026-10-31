import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { getT, localizeCategory } from "@/lib/i18n/server";
import { getSiteContext, uploadUrl } from "@/lib/site";
import { CATEGORIES } from "@/tools/categories";
import { Logo } from "./logo";
import { LanguageSwitcher } from "./language-switcher";
import { MobileMenu, ToolsMenu, UserMenu } from "./header-menus";
import { ThemeToggle, type ThemeChoice } from "./theme";
import { ToolSearch } from "./tool-search";

export async function SiteHeader() {
  const { settings, user, toolSummaries, entitlements, languages, locale, blogVisible } = await getSiteContext();
  const t = await getT();
  const categories = (
    await Promise.all(
      CATEGORIES.map(async (c) => {
        const local = (await localizeCategory(c.slug))!;
        return { slug: c.slug, name: local.name, summary: local.summary, count: toolSummaries.filter((tool) => tool.category === c.slug).length };
      }),
    )
  ).filter((c) => c.count > 0);
  const navLink = "rounded-lg px-3 py-2 text-muted transition-colors hover:text-ink";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <MobileMenu
          categories={categories}
          signedIn={Boolean(user)}
          isAdmin={user?.role === "admin"}
          showPricing={!entitlements.isPremium}
          showBlog={blogVisible}
          showContact={settings.contact_enabled}
        />
        <Logo siteName={settings.site_name} logo={uploadUrl(settings.logo)} logoDark={uploadUrl(settings.logo_dark)} />

        <nav aria-label="Main" className="ms-4 hidden items-center gap-1 text-sm font-medium lg:flex">
          <ToolsMenu categories={categories} />
          <Link href="/pricing" className={navLink}>
            {t("nav.pricing")}
          </Link>
          {blogVisible ? (
            <Link href="/blog" className={navLink}>
              {t("nav.blog")}
            </Link>
          ) : null}
          {settings.contact_enabled ? (
            <Link href="/contact" className={navLink}>
              {t("nav.contact")}
            </Link>
          ) : null}
        </nav>

        <div className="ms-auto flex items-center gap-2">
          <ToolSearch tools={toolSummaries} categoryNames={Object.fromEntries(categories.map((c) => [c.slug, c.name]))} />
          {languages.length > 1 ? (
            <LanguageSwitcher
              current={locale.code}
              languages={languages.map((l) => ({ code: l.code, name: l.native_name }))}
            />
          ) : null}
          <ThemeToggle defaultTheme={settings.default_theme as ThemeChoice} />
          {user ? (
            <UserMenu name={user.name} email={user.email} isAdmin={user.role === "admin"} isPremium={entitlements.isPremium} />
          ) : (
            <>
              <Link href="/login" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-ink sm:block">
                {t("nav.signIn")}
              </Link>
              <ButtonLink href="/pricing" size="sm" className="hidden sm:inline-flex">
                {t("nav.getPro")}
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
