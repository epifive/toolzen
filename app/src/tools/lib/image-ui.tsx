"use client";

/**
 * Small UI pieces shared by the image tools.
 */

import { useState, type ComponentProps, type KeyboardEvent, type ReactNode } from "react";
import { Field, Input } from "@/components/ui/field";
import { useObjectUrl } from "@/components/tool-ui";
import { cn } from "@/lib/utils";
import { CHECKERBOARD, clamp, hexToRgb, rgbToHex } from "@/tools/lib/image";

/**
 * Plain <img> for local previews. Previews point at blob: and data: URLs that next/image cannot
 * optimise, so the native element is the right tool here.
 */
export function PreviewImage({ alt, ...props }: ComponentProps<"img"> & { alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- local blob:/data: preview, nothing to optimise
  return <img alt={alt} draggable={false} {...props} />;
}

/** Square thumbnail for a file row. */
export function ImageThumb({ file }: { file: File }) {
  const url = useObjectUrl(file);
  return url ? <PreviewImage src={url} alt="" className="size-full object-cover" /> : null;
}

/** Bordered area with a transparency checkerboard that centres its content. */
export function PreviewFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("flex items-center justify-center overflow-hidden rounded-lg border border-line p-3", className)}
      style={CHECKERBOARD}
    >
      {children}
    </div>
  );
}

/**
 * Numeric text field that lets people type freely (including clearing the field) and only
 * reports valid, in-range values. Arrow keys step the value; Shift steps by ten.
 */
export function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  hint,
  disabled,
  className,
}: {
  id: string;
  label: ReactNode;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const normalise = (n: number) => clamp(step >= 1 ? Math.round(n) : n, min, max);

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const delta = (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
    setDraft(null);
    onChange(normalise(value + delta));
  }

  return (
    <Field label={label} htmlFor={id} hint={hint} className={className}>
      <div className="relative">
        <Input
          id={id}
          type="text"
          inputMode={step >= 1 ? "numeric" : "decimal"}
          autoComplete="off"
          disabled={disabled}
          value={draft ?? String(value)}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            const n = Number(raw);
            if (raw.trim() !== "" && Number.isFinite(n) && n >= min && n <= max) onChange(normalise(n));
          }}
          onBlur={() => {
            const n = Number(draft);
            if (draft !== null && draft.trim() !== "" && Number.isFinite(n)) onChange(normalise(n));
            setDraft(null);
          }}
          onKeyDown={handleKey}
          className={cn("tabular-nums", suffix && "pr-10")}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">{suffix}</span>
        ) : null}
      </div>
    </Field>
  );
}

/** Native colour picker paired with an editable HEX value. */
export function ColorField({
  id,
  label,
  value,
  onChange,
  disabled,
  className,
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Field label={label} htmlFor={id} className={className}>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-surface p-1 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <Input
          aria-label="HEX value"
          autoComplete="off"
          spellCheck={false}
          maxLength={7}
          disabled={disabled}
          value={draft ?? value}
          onChange={(e) => {
            setDraft(e.target.value);
            const rgb = hexToRgb(e.target.value);
            if (rgb && /^#?[0-9a-f]{6}$/i.test(e.target.value.trim())) onChange(rgbToHex(rgb));
          }}
          onBlur={() => {
            const rgb = draft === null ? null : hexToRgb(draft);
            if (rgb) onChange(rgbToHex(rgb));
            setDraft(null);
          }}
          className="font-mono uppercase"
        />
      </div>
    </Field>
  );
}
