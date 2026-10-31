"use client";

import { useId, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Hint, Input, Label } from "@/components/ui/field";
import { OutputBox, Panel } from "@/components/tool-ui";
import { useTool } from "@/tools/context";
import { formatUuid, inspectUuid, randomUuid } from "@/tools/lib/dev";
import { ValueList, ValueRow } from "@/tools/lib/dev-ui";

const MAX_COUNT = 1000;

function generate(count: number): string[] {
  return Array.from({ length: count }, randomUuid);
}

function UuidValidator() {
  const id = useId();
  const [value, setValue] = useState("");
  const info = useMemo(() => (value.trim() ? inspectUuid(value) : null), [value]);

  return (
    <Panel title="Validate a UUID">
      <Label htmlFor={id}>UUID</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="f47ac10b-58cc-4372-a567-0e02b2c3d479"
        spellCheck={false}
        className="font-mono"
      />
      <Hint>Accepts hyphenated, plain, {"{braced}"} and urn:uuid: forms.</Hint>

      {value.trim() ? (
        <div className="mt-4" role="status">
          {info ? (
            <>
              <Badge tone="success">Valid UUID</Badge>
              <ValueList className="mt-3">
                <ValueRow label="Canonical form" value={info.canonical} />
                <ValueRow label="Version" value={info.versionLabel} mono={false} />
                <ValueRow label="Variant" value={info.variant} mono={false} />
                {info.timestamp ? (
                  <ValueRow
                    label="Created"
                    value={info.timestamp.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })}
                    copyValue={info.timestamp.toISOString()}
                    mono={false}
                  />
                ) : null}
              </ValueList>
            </>
          ) : (
            <Badge tone="danger">Not a valid UUID</Badge>
          )}
        </div>
      ) : null}
    </Panel>
  );
}

export default function UuidGenerator() {
  const { track } = useTool();
  const countId = useId();
  const [count, setCount] = useState(5);
  const [uppercase, setUppercase] = useState(false);
  const [hyphens, setHyphens] = useState(true);
  const [braces, setBraces] = useState(false);
  const [uuids, setUuids] = useState<string[]>(() => generate(5));

  const output = useMemo(
    () => uuids.map((u) => formatUuid(u, { uppercase, hyphens, braces })).join("\n"),
    [uuids, uppercase, hyphens, braces],
  );

  const validCount = Number.isInteger(count) && count >= 1 && count <= MAX_COUNT;

  function run() {
    if (!validCount) return;
    setUuids(generate(count));
    track();
  }

  return (
    <div className="space-y-4">
      <Panel title="Settings">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <div className="w-40">
            <Label htmlFor={countId}>How many</Label>
            <Input
              id={countId}
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_COUNT}
              value={Number.isNaN(count) ? "" : count}
              onChange={(e) => setCount(e.target.valueAsNumber)}
              onKeyDown={(e) => {
                if (e.key === "Enter") run();
              }}
              aria-invalid={!validCount}
            />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 pb-2.5">
            <Checkbox label="Uppercase" checked={uppercase} onChange={(e) => setUppercase(e.target.checked)} />
            <Checkbox label="Hyphens" checked={hyphens} onChange={(e) => setHyphens(e.target.checked)} />
            <Checkbox label="Braces { }" checked={braces} onChange={(e) => setBraces(e.target.checked)} />
          </div>
        </div>
        {!validCount ? <Hint className="text-red-600 dark:text-red-400">Enter a whole number from 1 to {MAX_COUNT}.</Hint> : null}
        <Button className="mt-4" onClick={run} disabled={!validCount}>
          <RefreshCw aria-hidden />
          Generate
        </Button>
      </Panel>

      <OutputBox
        value={output}
        label={`${uuids.length.toLocaleString()} UUID${uuids.length === 1 ? "" : "s"} (version 4)`}
        filename="uuids.txt"
        mono
        rows={Math.min(12, Math.max(3, uuids.length))}
      />

      <UuidValidator />
    </div>
  );
}
