import { getT } from "@/lib/i18n/server";
import { getSiteContext, showAds } from "@/lib/site";
import type { Settings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { RawHtml } from "./raw-html";

type SlotKey = Extract<keyof Settings, "ad_header" | "ad_tool_top" | "ad_tool_bottom" | "ad_sidebar" | "ad_footer">;

/** An advertising slot configured in Admin → Ads. Hidden for ad-free plans. */
export async function AdSlot({ slot, className }: { slot: SlotKey; className?: string }) {
  const { settings, entitlements } = await getSiteContext();
  const html = settings[slot];
  if (!html || !showAds(settings, entitlements.adFree)) return null;
  const t = await getT();
  return (
    <aside aria-label={t("ads.label")} className={cn("text-center", className)}>
      <p className="mb-1 text-[11px] text-muted">{t("ads.label")}</p>
      <RawHtml html={html} />
    </aside>
  );
}
