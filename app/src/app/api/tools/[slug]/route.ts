import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { getEntitlements } from "@/lib/plans";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { SERVER_TOOL_HANDLERS } from "@/lib/server-tools";
import { ToolInputError } from "@/lib/server-tools/net";
import { getSettings } from "@/lib/settings";
import { getTool } from "@/lib/tools";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Runs a server-side tool (DNS lookup, header checker, …) for the tool's client component. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const handler = Object.hasOwn(SERVER_TOOL_HANDLERS, slug) ? SERVER_TOOL_HANDLERS[slug] : undefined;
  const tool = handler ? await getTool(slug) : undefined;
  if (!handler || !tool || !tool.enabled) return Response.json({ error: "This tool is not available." }, { status: 404 });

  const ip = await clientIp();
  if (!rateLimit(`server-tool:${ip}`, 30, 60_000)) {
    return Response.json({ error: "Too many requests. Wait a minute and try again." }, { status: 429 });
  }

  const [settings, user] = await Promise.all([getSettings(), getCurrentUser()]);
  if (settings.login_required_for_tools && !user) {
    return Response.json({ error: "Sign in to use this tool." }, { status: 401 });
  }
  if (tool.premium && !(await getEntitlements(user)).premiumTools) {
    return Response.json({ error: "This is a Pro tool. Upgrade your plan to use it." }, { status: 403 });
  }

  let input: Record<string, unknown>;
  try {
    const body = await request.json();
    input = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const result = await handler(input, { ip, headers: await headers() });
    return Response.json({ result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ToolInputError) return Response.json({ error: error.message }, { status: 422 });
    console.error(`Server tool ${slug} failed:`, error);
    return Response.json({ error: "Something went wrong while running the tool. Try again." }, { status: 500 });
  }
}
