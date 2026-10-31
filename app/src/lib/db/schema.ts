import type { Generated, Insertable, Selectable, Updateable } from "kysely";

/**
 * Database schema shared by the MySQL and SQLite drivers.
 *
 * Portability rules used across the project:
 * - booleans are stored as 0 / 1 integers
 * - timestamps are ISO-8601 strings (see `now()` in ./index.ts)
 * - money is stored in the smallest currency unit (cents)
 */

export interface SettingsTable {
  key: string;
  value: string | null;
}

export interface UsersTable {
  id: Generated<number>;
  name: string;
  email: string;
  password_hash: string;
  role: "user" | "admin";
  status: "active" | "banned";
  plan_id: number | null;
  plan_expires_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionsTable {
  id: string;
  user_id: number;
  expires_at: string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface PasswordResetsTable {
  token_hash: string;
  user_id: number;
  expires_at: string;
  created_at: string;
}

export interface PlansTable {
  id: Generated<number>;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  features: string | null;
  max_file_mb: number;
  max_batch: number;
  ad_free: number;
  premium_tools: number;
  is_free: number;
  is_active: number;
  is_featured: number;
  sort_order: number;
  created_at: string;
}

export interface ToolSettingsTable {
  slug: string;
  enabled: number;
  premium: number;
  featured: number;
  sort_order: number;
  custom_title: string | null;
  custom_description: string | null;
  uses: number;
}

export interface ToolUsageDailyTable {
  day: string;
  slug: string;
  count: number;
}

export interface PaymentsTable {
  id: Generated<number>;
  user_id: number;
  plan_id: number;
  amount: number;
  currency: string;
  billing_cycle: "monthly" | "yearly";
  provider: "stripe" | "paypal" | "razorpay" | "offline";
  provider_ref: string;
  status: "pending" | "paid" | "rejected" | "refunded";
  note: string | null;
  created_at: string;
}

export interface PagesTable {
  id: Generated<number>;
  slug: string;
  title: string;
  content: string;
  meta_description: string | null;
  is_published: number;
  show_in_footer: number;
  created_at: string;
  updated_at: string;
}

export interface ContactMessagesTable {
  id: Generated<number>;
  name: string;
  email: string;
  subject: string;
  message: string;
  ip: string | null;
  is_read: number;
  created_at: string;
}

export interface LanguagesTable {
  code: string;
  name: string;
  native_name: string;
  direction: "ltr" | "rtl";
  is_active: number;
  sort_order: number;
}

export interface TranslationsTable {
  lang: string;
  key: string;
  value: string;
}

export interface PostsTable {
  id: Generated<number>;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  cover_image: string | null;
  meta_description: string | null;
  status: "draft" | "published";
  published_at: string | null;
  views: number;
  created_at: string;
  updated_at: string;
}

export interface Database {
  settings: SettingsTable;
  users: UsersTable;
  sessions: SessionsTable;
  password_resets: PasswordResetsTable;
  plans: PlansTable;
  tool_settings: ToolSettingsTable;
  tool_usage_daily: ToolUsageDailyTable;
  payments: PaymentsTable;
  pages: PagesTable;
  contact_messages: ContactMessagesTable;
  languages: LanguagesTable;
  translations: TranslationsTable;
  posts: PostsTable;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;
export type Plan = Selectable<PlansTable>;
export type Payment = Selectable<PaymentsTable>;
export type Page = Selectable<PagesTable>;
export type ToolSetting = Selectable<ToolSettingsTable>;
export type ContactMessage = Selectable<ContactMessagesTable>;
export type Language = Selectable<LanguagesTable>;
export type Post = Selectable<PostsTable>;
