import Link from "next/link";
import { Card, PageHeader, Table, Td, Th } from "@/components/admin/ui";
import { getAllTools } from "@/lib/tools";
import { CATEGORIES } from "@/tools/categories";
import { ToolIcon } from "@/tools/icons";
import { ToolFlag } from "./tool-flag";

export const metadata = { title: "Tools" };

export default async function AdminToolsPage() {
  const tools = await getAllTools();
  const enabled = tools.filter((t) => t.enabled).length;
  return (
    <>
      <PageHeader
        title="Tools"
        description={`${enabled} of ${tools.length} tools are live. Switch tools on or off, mark them Pro, or feature them on the home page.`}
      />
      <div className="space-y-6">
        {CATEGORIES.map((category) => {
          const list = tools.filter((t) => t.category === category.slug);
          if (!list.length) return null;
          return (
            <Card key={category.slug} title={category.name} padded={false}>
              <Table minWidth={720}>
                <thead>
                  <tr>
                    <Th>Tool</Th>
                    <Th className="w-24 text-center">Live</Th>
                    <Th className="w-24 text-center">Pro only</Th>
                    <Th className="w-24 text-center">Featured</Th>
                    <Th className="w-24 text-right">Uses</Th>
                    <Th className="w-20" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((t) => (
                    <tr key={t.slug} className={t.enabled ? undefined : "opacity-60"}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <span className={`grid size-8 shrink-0 place-items-center rounded-md bg-cat-${t.category}/10 text-cat-${t.category}`}>
                            <ToolIcon name={t.icon} className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium">{t.title}</p>
                            <p className="truncate text-xs text-muted">/tools/{t.slug}</p>
                          </div>
                        </div>
                      </Td>
                      <Td className="text-center">
                        <ToolFlag slug={t.slug} field="enabled" value={t.enabled} label={`${t.title} live`} />
                      </Td>
                      <Td className="text-center">
                        <ToolFlag slug={t.slug} field="premium" value={t.premium} label={`${t.title} Pro only`} />
                      </Td>
                      <Td className="text-center">
                        <ToolFlag slug={t.slug} field="featured" value={t.featured} label={`${t.title} featured`} />
                      </Td>
                      <Td className="text-right tabular-nums">{t.uses.toLocaleString()}</Td>
                      <Td className="text-right">
                        <Link href={`/admin/tools/${t.slug}`} className="text-sm font-medium text-primary hover:underline">
                          Edit
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          );
        })}
      </div>
    </>
  );
}
