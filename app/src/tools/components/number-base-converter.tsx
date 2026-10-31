"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Checkbox, Hint, Input, Label } from "@/components/ui/field";
import { CopyButton, Panel, Stat, StatGrid } from "@/components/tool-ui";
import { useTool } from "@/tools/context";
import { errorMessage, formatBigIntInBase, groupDigits, parseBigIntInBase } from "@/tools/lib/dev";

type FieldKey = "bin" | "oct" | "dec" | "hex" | "custom";

interface FieldDef {
  key: FieldKey;
  label: string;
  base: number;
  group: { size: number; separator: string } | null;
  placeholder: string;
}

const STANDARD_FIELDS: FieldDef[] = [
  { key: "dec", label: "Decimal (base 10)", base: 10, group: { size: 3, separator: "," }, placeholder: "255" },
  { key: "hex", label: "Hexadecimal (base 16)", base: 16, group: { size: 4, separator: " " }, placeholder: "FF" },
  { key: "bin", label: "Binary (base 2)", base: 2, group: { size: 4, separator: " " }, placeholder: "1111 1111" },
  { key: "oct", label: "Octal (base 8)", base: 8, group: { size: 3, separator: " " }, placeholder: "377" },
];

type Parsed = { ok: true; value: bigint } | { ok: false; error: string };

function NumberField({
  field,
  text,
  error,
  copyText,
  onChange,
}: {
  field: FieldDef;
  text: string;
  error?: string;
  copyText: string;
  onChange: (text: string) => void;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div>
      <Label htmlFor={id}>{field.label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="min-w-0 flex-1 font-mono"
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

export default function NumberBaseConverter() {
  const { track } = useTool();
  const customBaseId = useId();
  const [edit, setEdit] = useState<{ key: FieldKey; text: string }>({ key: "dec", text: "" });
  const [customBase, setCustomBase] = useState(36);
  const [grouping, setGrouping] = useState(true);
  const [uppercase, setUppercase] = useState(true);

  const customValid = Number.isInteger(customBase) && customBase >= 2 && customBase <= 36;
  const fields = useMemo<FieldDef[]>(
    () => [
      ...STANDARD_FIELDS,
      {
        key: "custom",
        label: `Base ${customValid ? customBase : "?"}`,
        base: customValid ? customBase : 36,
        group: null,
        placeholder: customValid ? formatBigIntInBase(BigInt(255), customBase, uppercase) : "",
      },
    ],
    [customBase, customValid, uppercase],
  );

  const editedField = fields.find((f) => f.key === edit.key)!;
  const parsed = useMemo<Parsed | null>(() => {
    if (!edit.text.trim()) return null;
    try {
      return { ok: true, value: parseBigIntInBase(edit.text, editedField.base) };
    } catch (error) {
      return { ok: false, error: errorMessage(error, "This is not a valid number.") };
    }
  }, [edit.text, editedField.base]);

  const value = parsed?.ok ? parsed.value : null;

  useEffect(() => {
    if (value !== null) track();
  }, [value, track]);

  const plain = (field: FieldDef) => (value === null ? "" : formatBigIntInBase(value, field.base, uppercase));
  const shown = (field: FieldDef) => {
    const digits = plain(field);
    return grouping && field.group ? groupDigits(digits, field.group.size, field.group.separator) : digits;
  };

  const magnitude = value === null ? null : value < BigInt(0) ? -value : value;
  const bits = magnitude === null ? 0 : magnitude === BigInt(0) ? 1 : magnitude.toString(2).length;

  return (
    <div className="space-y-4">
      <Panel>
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map((field) => (
            <NumberField
              key={field.key}
              field={field}
              text={field.key === edit.key ? edit.text : shown(field)}
              error={field.key === edit.key && parsed && !parsed.ok ? parsed.error : undefined}
              copyText={plain(field)}
              onChange={(text) => setEdit({ key: field.key, text })}
            />
          ))}
        </div>
      </Panel>

      <Panel title="Options">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <div className="w-36">
            <Label htmlFor={customBaseId}>Custom base</Label>
            <Input
              id={customBaseId}
              type="number"
              min={2}
              max={36}
              value={Number.isNaN(customBase) ? "" : customBase}
              onChange={(e) => setCustomBase(e.target.valueAsNumber)}
              aria-invalid={!customValid}
            />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 pb-2.5">
            <Checkbox label="Group digits" checked={grouping} onChange={(e) => setGrouping(e.target.checked)} />
            <Checkbox label="Uppercase letters" checked={uppercase} onChange={(e) => setUppercase(e.target.checked)} />
          </div>
        </div>
        <Hint className={customValid ? undefined : "text-red-600 dark:text-red-400"}>
          {customValid
            ? "Type in any field; the others update instantly. Numbers of any size and negative numbers are supported."
            : "The custom base must be a whole number from 2 to 36."}
        </Hint>
      </Panel>

      {value !== null ? (
        <StatGrid>
          <Stat label="Bits" value={bits.toLocaleString()} emphasis />
          <Stat label="Bytes" value={Math.ceil(bits / 8).toLocaleString()} />
          <Stat label="Decimal digits" value={(magnitude ?? BigInt(0)).toString().length.toLocaleString()} />
        </StatGrid>
      ) : null}
    </div>
  );
}
