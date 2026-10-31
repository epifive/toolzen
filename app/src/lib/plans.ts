import "server-only";
import { getDb, now } from "./db";
import type { Plan } from "./db/schema";
import type { SessionUser } from "./auth/session";

export interface Entitlements {
  plan: Plan | null;
  /** True when the user has an active paid plan. */
  isPremium: boolean;
  maxFileMb: number;
  maxBatch: number;
  adFree: boolean;
  premiumTools: boolean;
  expiresAt: string | null;
}

/** Limits used if the free plan row was deleted. */
const FALLBACK_FREE = { maxFileMb: 10, maxBatch: 5 };

export async function getActivePlans(): Promise<Plan[]> {
  const db = await getDb();
  return db.selectFrom("plans").selectAll().where("is_active", "=", 1).orderBy("sort_order").orderBy("id").execute();
}

export async function getAllPlans(): Promise<Plan[]> {
  const db = await getDb();
  return db.selectFrom("plans").selectAll().orderBy("sort_order").orderBy("id").execute();
}

export async function getPlan(id: number): Promise<Plan | undefined> {
  const db = await getDb();
  return db.selectFrom("plans").selectAll().where("id", "=", id).executeTakeFirst();
}

export async function getFreePlan(): Promise<Plan | undefined> {
  const db = await getDb();
  return db.selectFrom("plans").selectAll().where("is_free", "=", 1).orderBy("id").executeTakeFirst();
}

export function hasActivePaidPlan(user: Pick<SessionUser, "plan_id" | "plan_expires_at"> | null): boolean {
  return Boolean(user?.plan_id && user.plan_expires_at && user.plan_expires_at > now());
}

export async function getEntitlements(user: SessionUser | null): Promise<Entitlements> {
  if (user && hasActivePaidPlan(user)) {
    const plan = await getPlan(user.plan_id!);
    if (plan && !plan.is_free) {
      return {
        plan,
        isPremium: true,
        maxFileMb: plan.max_file_mb,
        maxBatch: plan.max_batch,
        adFree: plan.ad_free === 1,
        premiumTools: plan.premium_tools === 1,
        expiresAt: user.plan_expires_at,
      };
    }
  }
  const free = await getFreePlan();
  // Administrators can open every tool (so they can test Pro tools) but keep free limits and ads.
  const isAdmin = user?.role === "admin";
  return {
    plan: free ?? null,
    isPremium: false,
    maxFileMb: free?.max_file_mb ?? FALLBACK_FREE.maxFileMb,
    maxBatch: free?.max_batch ?? FALLBACK_FREE.maxBatch,
    adFree: free?.ad_free === 1,
    premiumTools: isAdmin || free?.premium_tools === 1,
    expiresAt: null,
  };
}

export function planFeatures(plan: Pick<Plan, "features">): string[] {
  return (plan.features ?? "")
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);
}
