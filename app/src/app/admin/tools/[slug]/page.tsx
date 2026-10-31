import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { getTool } from "@/lib/tools";
import { ToolDetailsForm } from "./tool-form";

export const metadata = { title: "Edit tool" };

export default async function EditToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const tool = await getTool((await params).slug);
  if (!tool) notFound();
  return (
    <>
      <PageHeader
        title={tool.name}
        description={
          <>
            Customise how this tool appears in search results.{" "}
            <Link href={`/tools/${tool.slug}`} target="_blank" className="text-primary hover:underline">
              Open the tool
            </Link>
          </>
        }
      />
      <ToolDetailsForm
        slug={tool.slug}
        defaults={{
          name: tool.name,
          description: tool.description,
          customTitle: tool.title === tool.name ? "" : tool.title,
          customDescription: tool.metaDescription === tool.description ? "" : tool.metaDescription,
          sortOrder: tool.sortOrder,
          enabled: tool.enabled,
          premium: tool.premium,
          featured: tool.featured,
        }}
      />
    </>
  );
}
