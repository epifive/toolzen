"use client";

import { useActionState } from "react";
import { initialFormState } from "@/app/actions/types";
import { Field, Input, Switch, Textarea } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { saveToolDetails } from "../../actions/tools";

export function ToolDetailsForm({
  slug,
  defaults,
}: {
  slug: string;
  defaults: {
    name: string;
    description: string;
    customTitle: string;
    customDescription: string;
    sortOrder: number;
    enabled: boolean;
    premium: boolean;
    featured: boolean;
  };
}) {
  const [state, action] = useActionState(saveToolDetails, initialFormState);
  return (
    <form action={action} className="max-w-3xl space-y-6 rounded-xl border border-line bg-surface p-6">
      <FormMessage state={state} />
      <input type="hidden" name="slug" value={slug} />
      <Field label="Display name" htmlFor="custom_title" hint={`Leave empty to use “${defaults.name}”. Used as the page title and heading.`}>
        <Input id="custom_title" name="custom_title" defaultValue={defaults.customTitle} maxLength={255} placeholder={defaults.name} />
      </Field>
      <Field label="Meta description" htmlFor="custom_description" hint="Shown in search results. 120–160 characters works best. Leave empty to use the default.">
        <Textarea id="custom_description" name="custom_description" defaultValue={defaults.customDescription} maxLength={500} rows={3} placeholder={defaults.description} />
      </Field>
      <Field label="Sort order" htmlFor="sort_order" hint="Lower numbers appear first within the category.">
        <Input id="sort_order" name="sort_order" type="number" min={0} max={9999} defaultValue={defaults.sortOrder} className="max-w-32" />
      </Field>
      <div className="space-y-4 border-t border-line pt-6">
        <Switch name="enabled" label="Live" description="Visitors can find and use this tool." defaultChecked={defaults.enabled} />
        <Switch name="premium" label="Pro only" description="Only plans with Pro tools can use it." defaultChecked={defaults.premium} />
        <Switch name="featured" label="Featured" description="Show it in “Popular tools” on the home page." defaultChecked={defaults.featured} />
      </div>
      <div className="flex justify-end">
        <SubmitButton>Save tool</SubmitButton>
      </div>
    </form>
  );
}
