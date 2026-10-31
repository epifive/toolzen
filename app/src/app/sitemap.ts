import type { MetadataRoute } from "next";
import { getDb, now } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { absoluteUrl } from "@/lib/site";
import { getEnabledTools } from "@/lib/tools";
import { CATEGORIES } from "@/tools/categories";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getSettings();
  const tools = await getEnabledTools();
  const db = await getDb();
  const [pages, posts] = await Promise.all([
    db.selectFrom("pages").select(["slug", "updated_at"]).where("is_published", "=", 1).execute(),
    settings.blog_enabled
      ? db
          .selectFrom("posts")
          .select(["slug", "updated_at"])
          .where("status", "=", "published")
          .where("published_at", "<=", now())
          .orderBy("published_at", "desc")
          .limit(5000)
          .execute()
      : Promise.resolve([]),
  ]);
  const url = (path: string) => absoluteUrl(settings, path);

  return [
    { url: url("/"), changeFrequency: "daily", priority: 1 },
    { url: url("/tools"), changeFrequency: "weekly", priority: 0.9 },
    ...CATEGORIES.filter((c) => tools.some((t) => t.category === c.slug)).map((c) => ({
      url: url(`/category/${c.slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...tools.map((t) => ({ url: url(`/tools/${t.slug}`), changeFrequency: "monthly" as const, priority: 0.8 })),
    { url: url("/pricing"), changeFrequency: "monthly", priority: 0.5 },
    ...(settings.contact_enabled ? [{ url: url("/contact"), changeFrequency: "yearly" as const, priority: 0.3 }] : []),
    ...(posts.length ? [{ url: url("/blog"), changeFrequency: "weekly" as const, priority: 0.6 }] : []),
    ...posts.map((p) => ({ url: url(`/blog/${p.slug}`), lastModified: p.updated_at, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...pages.map((p) => ({ url: url(`/p/${p.slug}`), lastModified: p.updated_at, changeFrequency: "yearly" as const, priority: 0.3 })),
  ];
}
