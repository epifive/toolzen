import "server-only";
import { getDb, today } from "./db";
import { CATEGORIES, type CategorySlug } from "@/tools/categories";
import { TOOLS, type ToolDefinition } from "@/tools/registry";

/** A tool definition merged with the admin's settings for it. */
export interface Tool extends ToolDefinition {
  enabled: boolean;
  premium: boolean;
  featured: boolean;
  sortOrder: number;
  /** Admin overrides (fall back to the registry values). */
  title: string;
  metaDescription: string;
  uses: number;
}

export async function getAllTools(): Promise<Tool[]> {
  const db = await getDb();
  const rows = await db.selectFrom("tool_settings").selectAll().execute();
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  return TOOLS.map((def, index) => {
    const row = bySlug.get(def.slug);
    return {
      ...def,
      enabled: row ? row.enabled === 1 : true,
      premium: row ? row.premium === 1 : Boolean(def.premium),
      featured: row ? row.featured === 1 : Boolean(def.featured),
      sortOrder: row ? row.sort_order : index,
      title: row?.custom_title || def.name,
      metaDescription: row?.custom_description || def.description,
      uses: row?.uses ?? 0,
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getEnabledTools(): Promise<Tool[]> {
  return (await getAllTools()).filter((t) => t.enabled);
}

export async function getTool(slug: string): Promise<Tool | undefined> {
  return (await getAllTools()).find((t) => t.slug === slug);
}

export async function getToolsByCategory(): Promise<Array<{ category: (typeof CATEGORIES)[number]; tools: Tool[] }>> {
  const tools = await getEnabledTools();
  return CATEGORIES.map((category) => ({
    category,
    tools: tools.filter((t) => t.category === category.slug),
  })).filter((group) => group.tools.length > 0);
}

export async function getToolsInCategory(slug: CategorySlug): Promise<Tool[]> {
  return (await getEnabledTools()).filter((t) => t.category === slug);
}

export async function upsertToolSetting(
  slug: string,
  values: Partial<{
    enabled: number;
    premium: number;
    featured: number;
    sort_order: number;
    custom_title: string | null;
    custom_description: string | null;
  }>,
): Promise<void> {
  const db = await getDb();
  const existing = await db.selectFrom("tool_settings").select("slug").where("slug", "=", slug).executeTakeFirst();
  if (existing) {
    if (Object.keys(values).length) await db.updateTable("tool_settings").set(values).where("slug", "=", slug).execute();
    return;
  }
  const def = TOOLS.find((t) => t.slug === slug);
  if (!def) throw new Error(`Unknown tool: ${slug}`);
  await db
    .insertInto("tool_settings")
    .values({
      slug,
      enabled: 1,
      premium: def.premium ? 1 : 0,
      featured: def.featured ? 1 : 0,
      sort_order: TOOLS.indexOf(def),
      custom_title: null,
      custom_description: null,
      uses: 0,
      ...values,
    })
    .execute();
}

/** Increment the all-time and daily usage counters for a tool. */
export async function recordToolUse(slug: string): Promise<void> {
  if (!TOOLS.some((t) => t.slug === slug)) return;
  const db = await getDb();
  await upsertToolSetting(slug, {});
  await db
    .updateTable("tool_settings")
    .set((eb) => ({ uses: eb("uses", "+", 1) }))
    .where("slug", "=", slug)
    .execute();

  const day = today();
  const updated = await db
    .updateTable("tool_usage_daily")
    .set((eb) => ({ count: eb("count", "+", 1) }))
    .where("day", "=", day)
    .where("slug", "=", slug)
    .executeTakeFirst();
  if (Number(updated.numUpdatedRows) === 0) {
    try {
      await db.insertInto("tool_usage_daily").values({ day, slug, count: 1 }).execute();
    } catch {
      // Another request inserted the row first; count this use on it.
      await db
        .updateTable("tool_usage_daily")
        .set((eb) => ({ count: eb("count", "+", 1) }))
        .where("day", "=", day)
        .where("slug", "=", slug)
        .execute();
    }
  }
}
