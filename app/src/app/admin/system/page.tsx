import type { ReactNode } from "react";
import { sql } from "kysely";
import { Card, PageHeader } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { isDemoMode, storageDir } from "@/lib/config";
import { dbDriver, getDb } from "@/lib/db";
import { mailConfigured } from "@/lib/mail";
import { getSettings } from "@/lib/settings";
import { APP_VERSION } from "@/lib/version";
import { ClearCacheForm, PruneSessionsForm, TestEmailForm } from "./system-forms";

export const metadata = { title: "System" };

export default async function SystemPage() {
  const db = await getDb();
  const settings = await getSettings();
  const migrations = await sql<{ name: string; timestamp: string }>`select name, timestamp from kysely_migration order by name`
    .execute(db)
    .then((r) => r.rows)
    .catch(() => []);
  const driver = dbDriver();

  const info: Array<[string, ReactNode]> = [
    ["Application version", APP_VERSION],
    ["Node.js", process.versions.node],
    ["Database", driver === "mysql" ? "MySQL / MariaDB" : "SQLite"],
    ["Storage folder", <code key="s" className="font-mono text-xs">{storageDir()}</code>],
    ["Environment", process.env.NODE_ENV],
    ["Demo mode", isDemoMode() ? <Badge key="d" tone="warning">On</Badge> : "Off"],
    ["Email", mailConfigured(settings) ? <Badge key="e" tone="success">Configured</Badge> : <Badge key="e">Not configured</Badge>],
  ];

  return (
    <>
      <PageHeader title="System" description="Server information and maintenance tools." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Server">
          <dl className="divide-y divide-line text-sm">
            {info.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-2.5">
                <dt className="text-muted">{label}</dt>
                <dd className="text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card title="Database migrations">
          <p className="mb-3 text-sm text-muted">Migrations run automatically after an update. These have been applied:</p>
          <ul className="space-y-1.5 font-mono text-xs">
            {migrations.map((m) => (
              <li key={m.name} className="flex justify-between gap-3">
                <span>{m.name}</span>
                <span className="text-muted">{String(m.timestamp).slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Maintenance">
          <div className="space-y-6">
            <div>
              <p className="mb-3 text-sm text-muted">Reload settings from the database if you edited them directly.</p>
              <ClearCacheForm />
            </div>
            <div className="border-t border-line pt-6">
              <p className="mb-3 text-sm text-muted">Delete expired sign-in sessions and password reset links.</p>
              <PruneSessionsForm />
            </div>
          </div>
        </Card>
        <Card title="Email test">
          <TestEmailForm defaultTo={settings.site_email} />
        </Card>
      </div>
    </>
  );
}
