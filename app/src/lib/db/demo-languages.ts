import "server-only";
import type { Kysely } from "kysely";
import type { Database } from "./schema";

/** Translations of the default site texts, so the demo's home page is fully translated. */
const SITE_TEXTS: Record<string, Record<string, string>> = {
  ar: {
    "setting.site_tagline": "أدوات مجانية على الإنترنت للجميع",
    "setting.home_hero_title": "كل أداة تحتاجها في مكان واحد",
    "setting.home_hero_subtitle":
      "اضغط الصور، ودمج ملفات PDF، ونسّق JSON، وأنشئ رموز QR والمزيد. كل شيء يعمل في متصفحك، لذا تبقى ملفاتك على جهازك.",
    "setting.footer_text": "أدوات سريعة ومجانية وخاصة على الإنترنت. ملفاتك لا تغادر جهازك أبداً.",
    "setting.copyright_text": "© {year} {site_name}. جميع الحقوق محفوظة.",
  },
  hi: {
    "setting.site_tagline": "सभी के लिए फ़्री ऑनलाइन टूल्स",
    "setting.home_hero_title": "आपको जिस टूल की ज़रूरत है, सब एक ही जगह",
    "setting.home_hero_subtitle":
      "इमेज कंप्रेस करें, PDF जोड़ें, JSON फ़ॉर्मैट करें, QR कोड बनाएँ और बहुत कुछ। सब कुछ आपके ब्राउज़र में चलता है, इसलिए आपकी फ़ाइलें आपके डिवाइस पर ही रहती हैं।",
    "setting.footer_text": "तेज़, फ़्री और प्राइवेट ऑनलाइन टूल्स। आपकी फ़ाइलें कभी आपके डिवाइस से बाहर नहीं जातीं।",
    "setting.copyright_text": "© {year} {site_name}. सर्वाधिकार सुरक्षित।",
  },
};

interface LanguagePack {
  language: { code: string; name: string; native_name: string; direction: "ltr" | "rtl" };
  translations: Record<string, string>;
}

/** Install the bundled Hindi and Arabic packs on a demo site (once, guarded by a settings row). */
export async function seedDemoLanguages(db: Kysely<Database>): Promise<void> {
  try {
    await db.insertInto("settings").values({ key: "demo_languages_seeded_at", value: new Date().toISOString() }).execute();
  } catch {
    return;
  }
  const packs = [(await import("../../../languages/hi.json")).default, (await import("../../../languages/ar.json")).default] as LanguagePack[];
  for (const [index, pack] of packs.entries()) {
    const { code, name, native_name, direction } = pack.language;
    const exists = await db.selectFrom("languages").select("code").where("code", "=", code).executeTakeFirst();
    if (exists) continue;
    const rows = Object.entries({ ...pack.translations, ...SITE_TEXTS[code] }).map(([key, value]) => ({ lang: code, key, value }));
    await db.transaction().execute(async (trx) => {
      await trx.insertInto("languages").values({ code, name, native_name, direction, is_active: 1, sort_order: (index + 1) * 10 }).execute();
      for (let i = 0; i < rows.length; i += 200) await trx.insertInto("translations").values(rows.slice(i, i + 200)).execute();
    });
  }
}
