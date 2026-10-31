"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { setToolFlag } from "../actions/tools";

/** Inline on/off switch for a tool flag that saves immediately. */
export function ToolFlag({
  slug,
  field,
  value,
  label,
}: {
  slug: string;
  field: "enabled" | "premium" | "featured";
  value: boolean;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(value);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimistic}
      aria-label={label}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!optimistic);
          const result = await setToolFlag(slug, field, !optimistic);
          if (result.error) alert(result.error);
          router.refresh();
        })
      }
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-60",
        optimistic ? "bg-primary" : "bg-line",
      )}
    >
      <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform", optimistic && "translate-x-4")} />
    </button>
  );
}
