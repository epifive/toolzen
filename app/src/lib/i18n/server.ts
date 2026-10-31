import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getDb } from "../db";
import type { Language } from "../db/schema";
import { getSettings, type Settings } from "../settings";
import { getCategory, type CategoryDefinition } from "@/tools/categories";
import type { ToolDefinition } from "@/tools/registry";
import { interpolate, MESSAGES, type MessageKey, type TranslatableSetting, type Translator } from "./messages";

export const LANG_COOKIE = "tz_lang";

type Dictionary = Record<string, string>;

const globalForI18n = globalThis as unknown as {
  __toolzenLanguages?: Language[];
  __toolzenDictionaries?: Map<string, Dictionary>;
  __toolzenI18nLoadedAt?: number;
};

/**
 * Translations are cached in memory. Saving in the admin clears the cache of the
 * process that handled the save; the TTL refreshes other processes (serverless
 * instances, PM2 clusters) shortly after.
 */
const CACHE_TTL_MS = 60_000;

function expireCache() {
  const loadedAt = globalForI18n.__toolzenI18nLoadedAt;
  if (loadedAt && Date.now() - loadedAt > CACHE_TTL_MS) clearI18nCache();
  globalForI18n.__toolzenI18nLoadedAt ??= Date.now();
}

export async function getLanguages(): Promise<Language[]> {
  expireCache();
  if (globalForI18n.__toolzenLanguages) return globalForI18n.__toolzenLanguages;
  const db = await getDb();
  const rows = await db.selectFrom("languages").selectAll().orderBy("sort_order").orderBy("name").execute();
  globalForI18n.__toolzenLanguages = rows;
  return rows;
}

export async function getActiveLanguages(): Promise<Language[]> {
  return (await getLanguages()).filter((l) => l.is_active === 1);
}

export async function getDictionary(code: string): Promise<Dictionary> {
  expireCache();
  const cacheMap = (globalForI18n.__toolzenDictionaries ??= new Map());
  const hit = cacheMap.get(code);
  if (hit) return hit;
  const db = await getDb();
  const rows = await db.selectFrom("translations").select(["key", "value"]).where("lang", "=", code).execute();
  const dict: Dictionary = {};
  for (const row of rows) if (row.value) dict[row.key] = row.value;
  cacheMap.set(code, dict);
  return dict;
}

export function clearI18nCache(): void {
  globalForI18n.__toolzenLanguages = undefined;
  globalForI18n.__toolzenDictionaries = undefined;
  globalForI18n.__toolzenI18nLoadedAt = undefined;
}

export interface Locale {
  code: string;
  dir: "ltr" | "rtl";
  name: string;
  dictionary: Dictionary;
}

/** The visitor's language: their saved choice, else the site default. Deduplicated per request. */
export const getLocale = cache(async (): Promise<Locale> => {
  const [settings, languages, jar] = await Promise.all([getSettings(), getActiveLanguages(), cookies()]);
  const wanted = jar.get(LANG_COOKIE)?.value;
  const language =
    languages.find((l) => l.code === wanted) ??
    languages.find((l) => l.code === settings.default_language) ??
    languages[0];
  // English can have entries too: they override the built-in wording.
  if (!language) return { code: "en", dir: "ltr", name: "English", dictionary: {} };
  return { code: language.code, dir: language.direction, name: language.native_name, dictionary: await getDictionary(language.code) };
});

export async function getT(): Promise<Translator> {
  const { dictionary } = await getLocale();
  return (key: MessageKey, vars) => interpolate(dictionary[key] ?? MESSAGES[key], vars);
}

/** Interface strings for client components (English merged with the active translation). */
export async function getClientMessages(): Promise<Record<string, string>> {
  const { dictionary } = await getLocale();
  const messages: Record<string, string> = { ...MESSAGES };
  for (const key of Object.keys(MESSAGES)) if (dictionary[key]) messages[key] = dictionary[key];
  return messages;
}

/** A setting's text in the visitor's language. */
export async function localSetting(settings: Settings, key: TranslatableSetting): Promise<string> {
  const { dictionary } = await getLocale();
  return dictionary[`setting.${key}`] || String(settings[key]);
}

/** Tool name, description, steps and FAQ in the visitor's language. */
export async function localizeTool<T extends ToolDefinition & { title?: string; metaDescription?: string }>(tool: T): Promise<T> {
  const { dictionary } = await getLocale();
  const k = (suffix: string) => dictionary[`tool.${tool.slug}.${suffix}`];
  const name = k("name");
  const description = k("description");
  return {
    ...tool,
    name: name || tool.name,
    // Admin-customised titles win over translations only for the default (untranslated) language.
    title: name || tool.title || tool.name,
    description: description || tool.description,
    metaDescription: description || tool.metaDescription || tool.description,
    steps: tool.steps.map((step, i) => k(`step${i + 1}`) || step),
    faq: tool.faq.map((f, i) => ({ q: k(`faq${i + 1}.q`) || f.q, a: k(`faq${i + 1}.a`) || f.a })),
  };
}

export async function localizeCategory(slug: string): Promise<CategoryDefinition | undefined> {
  const category = getCategory(slug);
  if (!category) return undefined;
  const { dictionary } = await getLocale();
  const k = (suffix: string) => dictionary[`category.${slug}.${suffix}`];
  return { ...category, name: k("name") || category.name, summary: k("summary") || category.summary, description: k("description") || category.description };
}
