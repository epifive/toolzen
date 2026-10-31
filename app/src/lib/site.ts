import "server-only";
import { cache } from "react";
import { getCurrentUser } from "./auth/session";
import { getDb } from "./db";
import { getEntitlements } from "./plans";
import { getSettings, type Settings } from "./settings";
import { getActiveLanguages, getLocale, localizeTool } from "./i18n/server";
import { getEnabledTools } from "./tools";

/** Minimal tool data for client components (search, menus). */
export interface ToolSummary {
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  premium: boolean;
  keywords: string[];
  fileKinds: string[];
}

/** Everything the public layout needs, loaded once per request. */
export const getSiteContext = cache(async () => {
  const [settings, user, locale] = await Promise.all([getSettings(), getCurrentUser(), getLocale()]);
  const [entitlements, rawTools, footerPages, languages, hasPosts] = await Promise.all([
    getEntitlements(user),
    getEnabledTools(),
    getDb().then((db) =>
      db
        .selectFrom("pages")
        .select(["slug", "title"])
        .where("is_published", "=", 1)
        .where("show_in_footer", "=", 1)
        .orderBy("id")
        .execute(),
    ),
    getActiveLanguages(),
    settings.blog_enabled
      ? getDb().then((db) =>
          db
            .selectFrom("posts")
            .select("id")
            .where("status", "=", "published")
            .where("published_at", "<=", new Date().toISOString())
            .limit(1)
            .executeTakeFirst()
            .then(Boolean),
        )
      : Promise.resolve(false),
  ]);
  const tools = await Promise.all(rawTools.map((t) => localizeTool(t)));
  const toolSummaries: ToolSummary[] = tools.map((t) => ({
    slug: t.slug,
    name: t.title,
    description: t.description,
    category: t.category,
    icon: t.icon,
    premium: t.premium,
    keywords: t.keywords,
    fileKinds: t.fileKinds ?? [],
  }));
  return { settings, user, entitlements, tools, toolSummaries, footerPages, locale, languages, blogVisible: hasPosts };
});

/** Ads are shown when enabled and the visitor's plan is not ad-free. */
export function showAds(settings: Settings, adFree: boolean): boolean {
  return settings.ads_enabled && !adFree;
}

export function absoluteUrl(settings: Settings, path = "/"): string {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "";
  const base = (settings.site_url || process.env.SITE_URL || vercel || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function uploadUrl(path: string): string {
  if (!path) return "";
  if (/^https?:\/\//.test(path) || path.startsWith("/")) return path;
  return `/uploads/${path}`;
}
