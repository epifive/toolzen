"use server";

import { z } from "zod";
import { guardAdmin } from "@/lib/admin";
import { upsertToolSetting } from "@/lib/tools";
import { TOOL_SLUGS } from "@/tools/registry";
import type { FormState } from "@/app/actions/types";

const flagSchema = z.object({
  slug: z.enum(TOOL_SLUGS as [string, ...string[]]),
  field: z.enum(["enabled", "premium", "featured"]),
  value: z.boolean(),
});

export async function setToolFlag(slug: string, field: "enabled" | "premium" | "featured", value: boolean): Promise<FormState> {
  const guard = await guardAdmin();
  if (!guard.ok) return { error: guard.error };
  const parsed = flagSchema.safeParse({ slug, field, value });
  if (!parsed.success) return { error: "Invalid request." };
  await upsertToolSetting(slug, { [field]: value ? 1 : 0 });
  return { success: "Saved." };
}

export async function saveToolDetails(_prev: FormState, formData: FormData): Promise<FormState> {
  const slug = String(formData.get("slug") ?? "");
  const guard = await guardAdmin();
  if (!guard.ok) return { error: guard.error };
  if (!TOOL_SLUGS.includes(slug)) return { error: "Unknown tool." };
  const parsed = z
    .object({
      custom_title: z.string().trim().max(255),
      custom_description: z.string().trim().max(500),
      sort_order: z.coerce.number().int().min(0).max(9999),
    })
    .safeParse({
      custom_title: formData.get("custom_title") ?? "",
      custom_description: formData.get("custom_description") ?? "",
      sort_order: formData.get("sort_order") ?? 0,
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await upsertToolSetting(slug, {
    custom_title: parsed.data.custom_title || null,
    custom_description: parsed.data.custom_description || null,
    sort_order: parsed.data.sort_order,
    enabled: formData.get("enabled") === "on" ? 1 : 0,
    premium: formData.get("premium") === "on" ? 1 : 0,
    featured: formData.get("featured") === "on" ? 1 : 0,
  });
  return { success: "Tool saved." };
}
