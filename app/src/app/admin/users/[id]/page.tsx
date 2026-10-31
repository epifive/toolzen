import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { GATEWAY_LABELS } from "@/lib/payments";
import { getAllPlans } from "@/lib/plans";
import { formatDate, formatMoney } from "@/lib/utils";
import { UserForm } from "../user-form";

export const metadata = { title: "Edit user" };

export default async function EditUserPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const [{ id }, { created }] = await Promise.all([params, searchParams]);
  const db = await getDb();
  const user = await db.selectFrom("users").selectAll().where("id", "=", Number(id)).executeTakeFirst();
  if (!user) notFound();
  const [me, plans, payments] = await Promise.all([
    getCurrentUser(),
    getAllPlans(),
    db.selectFrom("payments").selectAll().where("user_id", "=", user.id).orderBy("id", "desc").limit(20).execute(),
  ]);

  return (
    <>
      <PageHeader
        title={user.name}
        description={
          <>
            Joined {formatDate(user.created_at)}.{" "}
            <Link href="/admin/users" className="text-primary hover:underline">
              Back to users
            </Link>
          </>
        }
      />
      {created ? <Alert tone="success" className="mb-4">User created.</Alert> : null}
      <UserForm
        isSelf={me?.id === user.id}
        plans={plans.filter((p) => !p.is_free).map((p) => ({ id: p.id, name: p.name }))}
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          planId: user.plan_id ?? 0,
          planExpires: user.plan_expires_at ? user.plan_expires_at.slice(0, 10) : "",
        }}
      />
      <Card title="Payments" padded={false} className="mt-6 max-w-3xl">
        {payments.length ? (
          <Table minWidth={520}>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Method</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <Td>{formatDate(p.created_at)}</Td>
                  <Td>{GATEWAY_LABELS[p.provider]}</Td>
                  <Td className="tabular-nums">{formatMoney(p.amount, p.currency)}</Td>
                  <Td>
                    <Badge tone={p.status === "paid" ? "success" : p.status === "pending" ? "warning" : "danger"} className="capitalize">
                      {p.status}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="p-5 text-sm text-muted">No payments.</p>
        )}
      </Card>
    </>
  );
}
