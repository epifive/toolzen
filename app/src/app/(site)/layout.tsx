import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/site/logo";
import { BrandStyle } from "@/components/site/brand-style";
import { CookieConsent } from "@/components/site/cookie-consent";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { RawHtml } from "@/components/site/raw-html";
import { ThemeScript, type ThemeChoice } from "@/components/site/theme";
import { AdSlot } from "@/components/site/ad-slot";
import { fillPlaceholders } from "@/lib/settings";
import { I18nProvider } from "@/lib/i18n/client";
import { getClientMessages, getT, localSetting } from "@/lib/i18n/server";
import { absoluteUrl, getSiteContext, showAds, uploadUrl } from "@/lib/site";

// Every page reads settings from the database at request time.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getSiteContext();
  const [metaTitle, metaDescription] = await Promise.all([localSetting(settings, "meta_title"), localSetting(settings, "meta_description")]);
  const favicon = uploadUrl(settings.favicon);
  const ogImage = uploadUrl(settings.og_image);
  return {
    metadataBase: new URL(absoluteUrl(settings)),
    title: {
      default: metaTitle || settings.site_name,
      template: `%s${settings.title_separator}${settings.site_name}`,
    },
    description: metaDescription,
    keywords: settings.meta_keywords || undefined,
    applicationName: settings.site_name,
    icons: favicon ? { icon: favicon, apple: favicon } : { icon: "/icon.svg" },
    openGraph: {
      type: "website",
      siteName: settings.site_name,
      title: metaTitle || settings.site_name,
      description: metaDescription,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: { card: ogImage ? "summary_large_image" : "summary" },
    verification: {
      google: settings.google_site_verification || undefined,
      other: settings.bing_site_verification ? { "msvalidate.01": settings.bing_site_verification } : undefined,
    },
  };
}

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const { settings, user, entitlements, locale } = await getSiteContext();
  const t = await getT();
  const langScript = `document.documentElement.lang=${JSON.stringify(locale.code)};document.documentElement.dir=${JSON.stringify(locale.dir)};`;

  if (settings.maintenance_mode && user?.role !== "admin") {
    return (
      <>
        <ThemeScript defaultTheme={settings.default_theme as ThemeChoice} />
        <script dangerouslySetInnerHTML={{ __html: langScript }} />
        <BrandStyle color={settings.primary_color} />
        <main dir={locale.dir} lang={locale.code} className="mat-grid grid min-h-dvh place-items-center px-6 text-center">
          <div className="max-w-md">
            <BrandMark className="mx-auto size-12" />
            <h1 className="mt-6 text-3xl font-bold">{t("maintenance.title", { site: settings.site_name })}</h1>
            <p className="mt-3 text-muted">{fillPlaceholders(await localSetting(settings, "maintenance_message"), settings)}</p>
          </div>
        </main>
      </>
    );
  }

  const ads = showAds(settings, entitlements.adFree);
  const privacy = "/p/privacy-policy";

  const [messages, cookieText] = await Promise.all([getClientMessages(), localSetting(settings, "cookie_consent_text")]);

  return (
    <I18nProvider messages={messages}>
      <ThemeScript defaultTheme={settings.default_theme as ThemeChoice} />
      <script dangerouslySetInnerHTML={{ __html: langScript }} />
      <BrandStyle color={settings.primary_color} />
      <div dir={locale.dir} lang={locale.code}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
      >
        {t("nav.skipToContent")}
      </a>
      {settings.maintenance_mode ? (
        <p className="bg-marker px-4 py-1.5 text-center text-sm font-medium text-[#3d2e00]">
          {t("maintenance.adminNotice")}
        </p>
      ) : null}
      <SiteHeader />
      <AdSlot slot="ad_header" className="mx-auto max-w-7xl px-4 pt-4" />
      <main id="main">{children}</main>
      <AdSlot slot="ad_footer" className="mx-auto max-w-7xl px-4 pt-12" />
      <SiteFooter />
      {settings.cookie_consent_enabled ? (
        <CookieConsent text={fillPlaceholders(cookieText, settings)} privacyHref={privacy} />
      ) : null}
      </div>
      {ads && settings.ads_head_code ? <RawHtml html={settings.ads_head_code} /> : null}
      {settings.custom_head_code ? <RawHtml html={settings.custom_head_code} /> : null}
      {settings.custom_body_code ? <RawHtml html={settings.custom_body_code} /> : null}
    </I18nProvider>
  );
}
