"use client";

/**
 * Small UI pieces shared by the calculator tools.
 */

import { useEffect, type Key, type ReactNode } from "react";
import { Panel } from "@/components/tool-ui";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { useTool } from "@/tools/context";
import { formatNumber } from "@/tools/lib/calc";

/** Labelled numeric input with an optional unit suffix and an inline validation message. */
export function NumberField({
  id,
  label,
  value,
  onChange,
  unit,
  hint,
  error,
  min,
  max,
  step = "any",
  placeholder,
  className,
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  hint?: ReactNode;
  error?: string;
  min?: number;
  max?: number;
  step?: number | "any";
  placeholder?: string;
  className?: string;
}) {
  const errorId = `${id}-error`;
  return (
    <Field
      label={
        <>
          {label}
          {unit ? <span className="sr-only"> ({unit})</span> : null}
        </>
      }
      htmlFor={id}
      hint={error ? undefined : hint}
      className={className}
    >
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "tabular-nums",
            unit &&
              "[appearance:textfield] pr-14 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            error && "border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-700",
          )}
        />
        {unit ? (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">
            {unit}
          </span>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </Field>
  );
}

/**
 * Record a use whenever a live calculator shows a new result. Pass a value that
 * changes with the result (or null while there is none); `track()` is throttled.
 */
export function useTrackResult(result: string | number | null | undefined): void {
  const { track } = useTool();
  useEffect(() => {
    if (result !== null && result !== undefined) track();
  }, [result, track]);
}

/** Placeholder shown in the results column until the inputs are complete. */
export function EmptyResult({ children }: { children: ReactNode }) {
  return (
    <Panel>
      <p className="py-10 text-center text-sm text-muted">{children}</p>
    </Panel>
  );
}

export interface BarSegment {
  label: string;
  value: number;
  /** Tailwind background classes for the segment and its legend dot. */
  tone: string;
}

/** Tones for up to three bar segments that work in light and dark mode. */
export const BAR_TONES = ["bg-primary", "bg-amber-400 dark:bg-amber-500", "bg-sky-500 dark:bg-sky-400"] as const;

/** Horizontal stacked bar with a legend, e.g. principal vs interest. */
export function SplitBar({ segments }: { segments: BarSegment[] }) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const share = (value: number) => (total > 0 ? (Math.max(0, value) / total) * 100 : 0);
  return (
    <div>
      <div
        role="img"
        aria-label={segments.map((s) => `${s.label} ${formatNumber(share(s.value), 1)}%`).join(", ")}
        className="flex h-4 overflow-hidden rounded-full bg-line"
      >
        {segments.map((s) => (
          <span key={s.label} className={s.tone} style={{ width: `${share(s.value)}%` }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span aria-hidden className={cn("size-2.5 rounded-full", s.tone)} />
            {s.label} {formatNumber(share(s.value), 1)}%
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface TableColumn<Row> {
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** Numeric columns are right-aligned. Defaults to "right" for every column except the first. */
  align?: "left" | "right";
}

/**
 * Compact results table. The first column is the row header; the table scrolls
 * horizontally on narrow screens instead of squeezing the numbers.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  caption,
  minWidth = 480,
  highlight,
}: {
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => Key;
  /** Visually hidden caption describing the table for screen readers. */
  caption?: string;
  minWidth?: number;
  /** Rows to emphasise, e.g. the selected unit. */
  highlight?: (row: Row) => boolean;
}) {
  const alignOf = (column: TableColumn<Row>, index: number) => column.align ?? (index === 0 ? "left" : "right");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums" style={{ minWidth }}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            {columns.map((column, i) => (
              <th
                key={i}
                scope="col"
                className={cn("py-2 font-medium", i < columns.length - 1 && "pr-3", alignOf(column, i) === "right" ? "text-right" : "text-left")}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={cn("border-b border-line last:border-0", highlight?.(row) && "bg-primary-soft")}>
              {columns.map((column, i) => {
                const className = cn(
                  "py-2 text-ink",
                  i < columns.length - 1 && "pr-3",
                  alignOf(column, i) === "right" ? "text-right" : "text-left",
                );
                return i === 0 ? (
                  <th key={i} scope="row" className={cn(className, "font-normal")}>
                    {column.cell(row)}
                  </th>
                ) : (
                  <td key={i} className={className}>
                    {column.cell(row)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
