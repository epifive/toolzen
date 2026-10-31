import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** ads.txt for AdSense and other ad networks, edited in Admin → Ads. */
export async function GET() {
  const settings = await getSettings();
  if (!settings.ads_txt.trim()) return new Response("Not found", { status: 404 });
  return new Response(`${settings.ads_txt.trim()}\n`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
