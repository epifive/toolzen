"use client";

import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import { OutputBox, Panel, Segmented, TextInput, ToolColumns } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import { Checkbox, Hint, Input, Label, Select } from "@/components/ui/field";
import { useTool } from "@/tools/context";

type Mode = "add" | "remove";
type Padding = "none" | "zeros" | "spaces";

const SEPARATORS = [
  { value: ". ", label: "1. Dot" },
  { value: ") ", label: "1) Parenthesis" },
  { value: ": ", label: "1: Colon" },
  { value: " - ", label: "1 - Dash" },
  { value: " | ", label: "1 | Pipe" },
  { value: "\t", label: "1 → Tab" },
  { value: " ", label: "1 Space" },
  { value: "custom", label: "Custom…" },
];

interface NumberOptions {
  start: number;
  step: number;
  separator: string;
  padding: Padding;
  skipEmpty: boolean;
}

function addLineNumbers(text: string, { start, step, separator, padding, skipEmpty }: NumberOptions): string {
  const lines = text.split(/\r\n|\r|\n/);
  const numbered = lines.filter((line) => !skipEmpty || line.trim()).length;
  const last = start + step * Math.max(0, numbered - 1);
  const width = Math.max(String(start).length, String(last).length);
  let n = start;
  return lines
    .map((line) => {
      if (skipEmpty && !line.trim()) return line;
      const raw = String(Math.abs(n));
      const sign = n < 0 ? "-" : "";
      const label =
        padding === "zeros"
          ? sign + raw.padStart(width - sign.length, "0")
          : padding === "spaces"
            ? (sign + raw).padStart(width, " ")
            : sign + raw;
      n += step;
      return label + separator + line;
    })
    .join("\n");
}

/** Leading number with an optional bracket and separator: "12. ", "(3) ", "004 | ", "7\t". */
const LEADING_NUMBER = /^[ \t]*[([]?\d+(?:[)\].:|-]+[ \t]*|[ \t]+|$)/;

function removeLineNumbers(text: string): { output: string; removed: number } {
  let removed = 0;
  const output = text
    .split(/\r\n|\r|\n/)
    .map((line) =>
      line.replace(LEADING_NUMBER, () => {
        removed++;
        return "";
      }),
    )
    .join("\n");
  return { output, removed };
}

export default function AddLineNumbers() {
  const { track } = useTool();
  const startId = useId();
  const stepId = useId();
  const separatorId = useId();
  const customId = useId();
  const paddingId = useId();
  const [mode, setMode] = useState<Mode>("add");
  const [text, setText] = useState("");
  const [start, setStart] = useState(1);
  const [step, setStep] = useState(1);
  const [separatorChoice, setSeparatorChoice] = useState(". ");
  const [custom, setCustom] = useState(" → ");
  const [padding, setPadding] = useState<Padding>("none");
  const [skipEmpty, setSkipEmpty] = useState(false);
  const source = useDeferredValue(text);

  const validStart = Number.isInteger(start);
  const validStep = Number.isInteger(step) && step !== 0;
  const separator = separatorChoice === "custom" ? custom : separatorChoice;

  const result = useMemo(() => {
    if (!source) return { output: "", removed: 0 };
    if (mode === "remove") return removeLineNumbers(source);
    if (!validStart || !validStep) return { output: "", removed: 0 };
    return { output: addLineNumbers(source, { start, step, separator, padding, skipEmpty }), removed: 0 };
  }, [source, mode, start, step, separator, padding, skipEmpty, validStart, validStep]);

  useEffect(() => {
    if (result.output) track();
  }, [result.output, track]);

  return (
    <div className="space-y-4">
      <Panel title="Options">
        <Segmented
          label="Mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "add", label: "Add line numbers" },
            { value: "remove", label: "Remove line numbers" },
          ]}
        />

        {mode === "add" ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <Label htmlFor={startId}>Start at</Label>
                <Input
                  id={startId}
                  type="number"
                  value={Number.isNaN(start) ? "" : start}
                  onChange={(e) => setStart(e.target.valueAsNumber)}
                  aria-invalid={!validStart}
                />
              </div>
              <div>
                <Label htmlFor={stepId}>Step</Label>
                <Input
                  id={stepId}
                  type="number"
                  value={Number.isNaN(step) ? "" : step}
                  onChange={(e) => setStep(e.target.valueAsNumber)}
                  aria-invalid={!validStep}
                />
              </div>
              <div>
                <Label htmlFor={separatorId}>Separator</Label>
                <Select id={separatorId} value={separatorChoice} onChange={(e) => setSeparatorChoice(e.target.value)}>
                  {SEPARATORS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor={paddingId}>Padding</Label>
                <Select id={paddingId} value={padding} onChange={(e) => setPadding(e.target.value as Padding)}>
                  <option value="none">None (1, 10)</option>
                  <option value="zeros">Zeros (01, 10)</option>
                  <option value="spaces">Spaces ( 1, 10)</option>
                </Select>
              </div>
            </div>
            {separatorChoice === "custom" ? (
              <div className="mt-4 max-w-xs">
                <Label htmlFor={customId}>Custom separator</Label>
                <Input id={customId} value={custom} onChange={(e) => setCustom(e.target.value)} className="font-mono" />
              </div>
            ) : null}
            <div className="mt-4">
              <Checkbox label="Skip empty lines" checked={skipEmpty} onChange={(e) => setSkipEmpty(e.target.checked)} />
            </div>
            {!validStart || !validStep ? (
              <Hint className="text-red-600 dark:text-red-400">Start must be a whole number and step a whole number other than 0.</Hint>
            ) : null}
          </>
        ) : (
          <Hint className="mt-3">
            Removes a number at the start of each line, with separators such as &quot;1.&quot;, &quot;(2)&quot;, &quot;3:&quot;,
            &quot;04 |&quot; or a tab.
          </Hint>
        )}
      </Panel>

      <ToolColumns>
        <TextInput value={text} onChange={setText} label="Your text" placeholder="Paste the lines you want to number…" rows={12} />
        <div className="space-y-2">
          <OutputBox
            value={result.output}
            label={mode === "add" ? "Numbered text" : "Text without numbers"}
            filename={mode === "add" ? "numbered.txt" : "unnumbered.txt"}
            mono
            rows={12}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {mode === "remove" && source ? (
              <p className="text-sm text-muted">
                Removed numbers from {result.removed.toLocaleString()} line{result.removed === 1 ? "" : "s"}.
              </p>
            ) : (
              <span />
            )}
            <Button size="sm" variant="ghost" disabled={!result.output} onClick={() => setText(result.output)}>
              Use result as input
            </Button>
          </div>
        </div>
      </ToolColumns>
    </div>
  );
}
