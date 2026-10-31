"use client";

import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import { ErrorText, OutputBox, Panel, Segmented, TextInput, ToolColumns } from "@/components/tool-ui";
import { Checkbox, Hint, Input, Label } from "@/components/ui/field";
import { useTool } from "@/tools/context";

type SeparatorMode = "newline" | "space" | "comma" | "none" | "custom";

const SEPARATORS: Array<{ value: SeparatorMode; label: string }> = [
  { value: "newline", label: "New line" },
  { value: "space", label: "Space" },
  { value: "comma", label: "Comma" },
  { value: "none", label: "None" },
  { value: "custom", label: "Custom" },
];

const SEPARATOR_TEXT: Record<Exclude<SeparatorMode, "custom">, string> = { newline: "\n", space: " ", comma: ", ", none: "" };

const MAX_COUNT = 10_000;
/** Keeps the page responsive and the result copyable. */
const MAX_OUTPUT_CHARS = 5_000_000;

type Result = { ok: true; value: string } | { ok: false; error: string };

function repeat(text: string, count: number, separator: string, numbered: boolean): Result {
  if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
    return { ok: false, error: `Enter a whole number of repetitions from 1 to ${MAX_COUNT.toLocaleString()}.` };
  }
  const numberWidth = numbered ? String(count).length + 2 : 0;
  const size = (text.length + numberWidth) * count + separator.length * (count - 1);
  if (size > MAX_OUTPUT_CHARS) {
    return {
      ok: false,
      error: `The result would be about ${size.toLocaleString()} characters. Reduce the text or the count to stay under ${MAX_OUTPUT_CHARS.toLocaleString()}.`,
    };
  }
  const parts = Array.from({ length: count }, (_, i) => (numbered ? `${i + 1}. ${text}` : text));
  return { ok: true, value: parts.join(separator) };
}

export default function TextRepeater() {
  const { track } = useTool();
  const countId = useId();
  const customId = useId();
  const [text, setText] = useState("");
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState<SeparatorMode>("newline");
  const [custom, setCustom] = useState(" | ");
  const [numbered, setNumbered] = useState(false);

  const separator = mode === "custom" ? custom.replace(/\\n/g, "\n").replace(/\\t/g, "\t") : SEPARATOR_TEXT[mode];
  const source = useDeferredValue(text);

  const result = useMemo<Result | null>(
    () => (source ? repeat(source, count, separator, numbered) : null),
    [source, count, separator, numbered],
  );
  const output = result?.ok ? result.value : "";
  const outputLength = useMemo(() => Array.from(output).length, [output]);

  useEffect(() => {
    if (output) track();
  }, [output, track]);

  return (
    <div className="space-y-4">
      <Panel title="Options">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <div className="w-40">
            <Label htmlFor={countId}>Repeat</Label>
            <Input
              id={countId}
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_COUNT}
              value={Number.isNaN(count) ? "" : count}
              onChange={(e) => setCount(e.target.valueAsNumber)}
              aria-invalid={result?.ok === false}
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Separator</p>
            <Segmented label="Separator" value={mode} onChange={setMode} options={SEPARATORS} />
          </div>
          {mode === "custom" ? (
            <div className="w-40">
              <Label htmlFor={customId}>Custom separator</Label>
              <Input id={customId} value={custom} onChange={(e) => setCustom(e.target.value)} className="font-mono" />
            </div>
          ) : null}
        </div>
        <div className="mt-4">
          <Checkbox label="Number each copy (1. 2. 3.)" checked={numbered} onChange={(e) => setNumbered(e.target.checked)} />
        </div>
        <Hint>Up to {MAX_COUNT.toLocaleString()} copies. In a custom separator, \n is a new line and \t is a tab.</Hint>
      </Panel>

      <ToolColumns>
        <TextInput value={text} onChange={setText} label="Text to repeat" placeholder="Type a word, sentence or emoji…" rows={10} />
        <div className="space-y-2">
          <OutputBox value={output} label="Repeated text" filename="repeated-text.txt" rows={10} />
          {output ? <p className="text-sm text-muted">{outputLength.toLocaleString()} characters</p> : null}
        </div>
      </ToolColumns>

      {result && !result.ok ? <ErrorText>{result.error}</ErrorText> : null}
    </div>
  );
}
