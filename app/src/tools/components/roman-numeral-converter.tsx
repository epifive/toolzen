"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { CopyButton, Panel } from "@/components/tool-ui";
import { Hint, Input, Label } from "@/components/ui/field";
import { useTool } from "@/tools/context";
import { errorMessage } from "@/tools/lib/dev";
import { fromRoman, romanParts, ROMAN_MAX, ROMAN_MIN, type RomanPart } from "@/tools/lib/roman";

type Field = "number" | "roman";

type Parsed = { ok: true; value: number; parts: RomanPart[] } | { ok: false; error: string };

function parse(field: Field, text: string): Parsed | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    if (field === "roman") {
      const value = fromRoman(trimmed);
      return { ok: true, value, parts: romanParts(value) };
    }
    const cleaned = trimmed.replace(/[,\s_]/g, "");
    if (!/^\d+$/.test(cleaned)) throw new Error("Enter a whole number such as 2024.");
    const value = Number(cleaned);
    return { ok: true, value, parts: romanParts(value) };
  } catch (error) {
    return { ok: false, error: errorMessage(error, "This value cannot be converted.") };
  }
}

const REFERENCE: Array<[string, number]> = [
  ["I", 1],
  ["V", 5],
  ["X", 10],
  ["L", 50],
  ["C", 100],
  ["D", 500],
  ["M", 1000],
];

function ConverterField({
  label,
  value,
  error,
  placeholder,
  copyText,
  mono,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  placeholder: string;
  copyText: string;
  mono?: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          inputMode={mono ? "text" : "numeric"}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={mono ? "h-12 min-w-0 flex-1 font-mono text-lg uppercase" : "h-12 min-w-0 flex-1 text-lg tabular-nums"}
        />
        <CopyButton text={copyText} size="md" />
      </div>
      {error ? (
        <Hint id={errorId} className="text-red-600 dark:text-red-400">
          {error}
        </Hint>
      ) : null}
    </div>
  );
}

export default function RomanNumeralConverter() {
  const { track } = useTool();
  const [edit, setEdit] = useState<{ field: Field; text: string }>({ field: "number", text: "" });

  const parsed = useMemo(() => parse(edit.field, edit.text), [edit]);
  const value = parsed?.ok ? parsed.value : null;
  const roman = parsed?.ok ? parsed.parts.map((p) => p.symbol).join("") : "";

  useEffect(() => {
    if (value !== null) track();
  }, [value, track]);

  const error = parsed && !parsed.ok ? parsed.error : undefined;

  return (
    <div className="space-y-4">
      <Panel>
        <div className="grid gap-4 md:grid-cols-2">
          <ConverterField
            label="Number"
            value={edit.field === "number" ? edit.text : value === null ? "" : String(value)}
            error={edit.field === "number" ? error : undefined}
            placeholder="1994"
            copyText={value === null ? "" : String(value)}
            onChange={(text) => setEdit({ field: "number", text })}
          />
          <ConverterField
            label="Roman numeral"
            value={edit.field === "roman" ? edit.text : roman}
            error={edit.field === "roman" ? error : undefined}
            placeholder="MCMXCIV"
            copyText={roman}
            mono
            onChange={(text) => setEdit({ field: "roman", text })}
          />
        </div>
        <Hint>
          Type in either box. Standard Roman numerals cover {ROMAN_MIN} to {ROMAN_MAX.toLocaleString("en-US")}.
        </Hint>
      </Panel>

      {parsed?.ok ? (
        <Panel title="Breakdown">
          <ol className="flex flex-wrap gap-2" aria-label="Symbols, largest first">
            {parsed.parts.map((part, i) => (
              <li key={i} className="rounded-lg border border-primary-line bg-primary-soft px-3 py-1.5 text-center">
                <span className="block font-mono text-lg font-semibold text-ink">{part.symbol}</span>
                <span className="block text-xs text-muted tabular-nums">{part.value.toLocaleString("en-US")}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 font-mono text-sm break-words text-muted">
            {parsed.parts.map((p) => p.value).join(" + ")} = <span className="font-semibold text-ink">{parsed.value}</span>
          </p>
        </Panel>
      ) : null}

      <Panel title="Roman numeral symbols">
        <dl className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {REFERENCE.map(([symbol, amount]) => (
            <div key={symbol} className="rounded-lg border border-line px-2 py-2 text-center">
              <dt className="font-mono text-lg font-semibold text-ink">{symbol}</dt>
              <dd className="text-xs text-muted tabular-nums">{amount.toLocaleString("en-US")}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-muted">
          A smaller symbol before a larger one is subtracted: IV = 4, IX = 9, XL = 40, XC = 90, CD = 400, CM = 900.
        </p>
      </Panel>
    </div>
  );
}
