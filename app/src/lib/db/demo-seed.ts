import "server-only";
import type { Insertable, Kysely } from "kysely";
import type { Database, PaymentsTable } from "./schema";

/**
 * Sample users, payments, tool usage and messages so a public demo's admin
 * panel looks like a real, busy site. Runs only once per database and uses
 * multi-row inserts so it stays fast on remote (cloud) databases.
 */

const DAY = 86_400_000;
const FIRST = ["Emma", "Liam", "Olivia", "Noah", "Ava", "Arjun", "Priya", "Lucas", "Mia", "Ethan", "Sofia", "Yuki", "Mateo", "Aisha", "Daniel", "Chloe", "Rahul", "Fatima", "Leo", "Hannah", "Omar", "Grace", "Kenji", "Isabella", "Samuel", "Zara", "Diego", "Nora", "Ravi", "Elena"];
const LAST = ["Johnson", "Patel", "Garcia", "Kim", "Rossi", "Silva", "Khan", "Nguyen", "Smith", "Tanaka", "Haddad", "Brown", "Sharma", "Lopez", "Novak", "Okafor", "Dubois"];
const DOMAINS = ["gmail.com", "outlook.com", "studio.io", "agency.co", "mail.com", "proton.me"];
const POPULAR: Record<string, number> = {
  "image-compressor": 9, "merge-pdf": 8, "qr-code-generator": 7, "json-formatter": 7, "word-counter": 6, "image-converter": 6,
  "split-pdf": 5, "images-to-pdf": 5, "password-generator": 5, "pdf-to-images": 4, "image-resizer": 4, "case-converter": 3,
  "loan-emi-calculator": 3, "age-calculator": 3, "base64-encoder-decoder": 3, "meta-tag-generator": 2, "text-diff-checker": 2,
  "favicon-generator": 2, "uuid-generator": 2, "unit-converter": 2, "percentage-calculator": 2, "remove-pdf-pages": 2,
};

type PaymentRow = Insertable<PaymentsTable>;

export async function seedDemoData(db: Kysely<Database>): Promise<void> {
  // The settings row doubles as a lock: only the instance that inserts it seeds.
  try {
    await db.insertInto("settings").values({ key: "demo_seeded_at", value: new Date().toISOString() }).execute();
  } catch {
    return;
  }

  let seed = 42;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const now = Date.now();
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

  await db.transaction().execute(async (trx) => {
    const pro = await trx.selectFrom("plans").select("id").where("is_free", "=", 0).orderBy("id").executeTakeFirst();
    if (!pro) return;
    const business = await trx
      .insertInto("plans")
      .values({
        name: "Business",
        description: "For teams and agencies processing files at scale.",
        price_monthly: 2900,
        price_yearly: 24900,
        features: "Everything in Pro\nFiles up to 500 MB\nUp to 200 files at once\nCommercial use\nDedicated support",
        max_file_mb: 500,
        max_batch: 200,
        ad_free: 1,
        premium_tools: 1,
        is_free: 0,
        is_active: 1,
        is_featured: 0,
        sort_order: 3,
        created_at: iso(30 * DAY),
      })
      .executeTakeFirstOrThrow();
    const businessId = Number(business.insertId);

    // Settings that make every admin screen meaningful.
    for (const [key, value] of Object.entries({ offline_enabled: "1", currency: "USD" })) {
      const exists = await trx.selectFrom("settings").select("key").where("key", "=", key).executeTakeFirst();
      if (exists) await trx.updateTable("settings").set({ value }).where("key", "=", key).execute();
      else await trx.insertInto("settings").values({ key, value }).execute();
    }

    const userRows = Array.from({ length: 45 }, (_, i) => {
      const created = iso(Math.floor(rand() * 60) * DAY + Math.floor(rand() * DAY));
      const plan = i % 3 === 0 ? (i % 9 === 0 ? businessId : pro.id) : null;
      const first = FIRST[i % FIRST.length];
      const last = pick(LAST);
      return {
        name: `${first} ${last}`,
        email: `${first}.${last}${i}@${pick(DOMAINS)}`.toLowerCase(),
        // Not a valid hash: sample users can never sign in.
        password_hash: "disabled",
        role: "user" as const,
        status: i === 7 ? ("banned" as const) : ("active" as const),
        plan_id: plan,
        plan_expires_at: plan ? iso(-(10 + Math.floor(rand() * 300)) * DAY) : null,
        stripe_customer_id: null,
        stripe_subscription_id: null,
        created_at: created,
        updated_at: created,
      };
    });
    await trx.insertInto("users").values(userRows).execute();
    const inserted = await trx
      .selectFrom("users")
      .select(["id", "email"])
      .where("email", "in", userRows.map((u) => u.email))
      .execute();
    const idByEmail = new Map(inserted.map((u) => [u.email, u.id]));
    const users = userRows.map((u) => ({ id: idByEmail.get(u.email)!, plan: u.plan_id }));

    let ref = 1000;
    const payments: PaymentRow[] = [];
    for (const u of users) {
      if (!u.plan) continue;
      for (let n = 0; n < 2; n++) {
        const yearly = rand() < 0.3;
        payments.push({
          user_id: u.id,
          plan_id: u.plan,
          amount: u.plan === businessId ? (yearly ? 24900 : 2900) : yearly ? 7900 : 900,
          currency: "USD",
          billing_cycle: yearly ? "yearly" : "monthly",
          provider: pick(["stripe", "stripe", "paypal", "razorpay"] as const),
          provider_ref: `demo:${ref++}`,
          status: "paid",
          note: null,
          created_at: iso(Math.floor(rand() * 40) * DAY + 3_600_000),
        });
      }
    }
    const pendingTransfers = [
      { user: users[4].id, plan: pro.id, amount: 900, note: "UTR 4821 9930 1127", hoursAgo: 3 },
      { user: users[10].id, plan: businessId, amount: 2900, note: "TRX-20261015-883", hoursAgo: 9 },
    ];
    for (const t of pendingTransfers) {
      payments.push({
        user_id: t.user,
        plan_id: t.plan,
        amount: t.amount,
        currency: "USD",
        billing_cycle: "monthly",
        provider: "offline",
        provider_ref: `demo:${ref++}`,
        status: "pending",
        note: t.note,
        created_at: iso(t.hoursAgo * 3_600_000),
      });
    }
    await trx.insertInto("payments").values(payments).execute();

    const usage: Array<{ day: string; slug: string; count: number }> = [];
    const totals = new Map<string, number>();
    for (let d = 13; d >= 0; d--) {
      const date = new Date(now - d * DAY);
      const day = date.toISOString().slice(0, 10);
      const growth = 1 + (13 - d) * 0.06 + (date.getUTCDay() % 6 === 0 ? -0.25 : 0);
      for (const [slug, weight] of Object.entries(POPULAR)) {
        const count = Math.round(weight * 9 * growth * (0.8 + rand() * 0.4));
        usage.push({ day, slug, count });
        totals.set(slug, (totals.get(slug) ?? 0) + count * 4);
      }
    }
    const slugs = [...totals.keys()];
    await trx.deleteFrom("tool_usage_daily").where("slug", "in", slugs).execute();
    await trx.insertInto("tool_usage_daily").values(usage).execute();
    const existing = new Set(
      (await trx.selectFrom("tool_settings").select("slug").where("slug", "in", slugs).execute()).map((r) => r.slug),
    );
    for (const [slug, uses] of totals) {
      if (existing.has(slug)) await trx.updateTable("tool_settings").set({ uses }).where("slug", "=", slug).execute();
    }
    const missing = slugs.filter((slug) => !existing.has(slug));
    if (missing.length) {
      await trx
        .insertInto("tool_settings")
        .values(
          missing.map((slug) => ({
            slug,
            enabled: 1,
            premium: slug === "pdf-to-images" ? 1 : 0,
            featured: (POPULAR[slug] ?? 0) >= 5 ? 1 : 0,
            sort_order: 0,
            custom_title: null,
            custom_description: null,
            uses: totals.get(slug) ?? 0,
          })),
        )
        .execute();
    }

    await trx
      .insertInto("contact_messages")
      .values([
        { name: "Priya Sharma", email: "priya@studio.io", subject: "Feature request: HEIC to JPG", message: "Love the image tools! Could you add a HEIC to JPG converter? My iPhone photos are all HEIC.", ip: null, is_read: 0, created_at: iso(2 * 3_600_000) },
        { name: "Daniel Brown", email: "daniel@agency.co", subject: "Team plan question", message: "We are 6 designers. Is there a way to pay for several accounts at once?", ip: null, is_read: 0, created_at: iso(20 * 3_600_000) },
        { name: "Kenji Tanaka", email: "kenji@mail.com", subject: "Thank you", message: "The PDF merge tool saved me an hour today. Thanks for keeping it free.", ip: null, is_read: 1, created_at: iso(3 * DAY) },
      ])
      .execute();
  });
}
