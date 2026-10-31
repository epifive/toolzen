import { clientIp, rateLimit } from "@/lib/rate-limit";
import { recordToolUse } from "@/lib/tools";

export const dynamic = "force-dynamic";

/** Counts tool usage for the admin dashboard. Called with navigator.sendBeacon. */
export async function POST(request: Request) {
  const ip = await clientIp();
  if (!rateLimit(`track:${ip}`, 120, 60_000)) return new Response(null, { status: 429 });
  let slug: unknown;
  try {
    slug = ((await request.json()) as { slug?: unknown }).slug;
  } catch {
    return new Response(null, { status: 400 });
  }
  if (typeof slug === "string" && /^[a-z0-9-]{1,80}$/.test(slug)) {
    try {
      await recordToolUse(slug);
    } catch (error) {
      console.error("Failed to record tool usage:", error);
      return new Response(null, { status: 500 });
    }
  }
  return new Response(null, { status: 204 });
}
