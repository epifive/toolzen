"use client";

import { useId, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { OutputBox, Panel, Segmented } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { generateLorem, type LoremUnit } from "@/tools/lib/text";
import { useTool } from "@/tools/context";

const UNITS: Array<{ value: LoremUnit; label: string }> = [
  { value: "paragraphs", label: "Paragraphs" },
  { value: "sentences", label: "Sentences" },
  { value: "words", label: "Words" },
];

const MIN = 1;
const MAX = 100;

function clampCount(raw: string): number {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? Math.min(MAX, Math.max(MIN, n)) : MIN;
}

export default function LoremIpsumGenerator() {
  const { track } = useTool();
  const countId = useId();
  const [unit, setUnit] = useState<LoremUnit>("paragraphs");
  const [countInput, setCountInput] = useState("3");
  const [startWithLorem, setStartWithLorem] = useState(true);
  const [html, setHtml] = useState(false);
  // The seed makes the text stable while options change; "Regenerate" picks a new one.
  const [seed, setSeed] = useState(1);

  const count = clampCount(countInput);
  const output = useMemo(
    () => generateLorem({ unit, count, startWithLorem, html }, seed),
    [unit, count, startWithLorem, html, seed],
  );

  function regenerate() {
    setSeed(crypto.getRandomValues(new Uint32Array(1))[0]);
    track();
  }

  return (
    <div className="space-y-4">
      <Panel title="Options">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink">Generate</span>
            <Segmented
              label="Generate"
              value={unit}
              options={UNITS}
              onChange={(value) => {
                setUnit(value);
                track();
              }}
            />
          </div>
          <Field label="How many" htmlFor={countId} className="w-32">
            <Input
              id={countId}
              type="number"
              inputMode="numeric"
              min={MIN}
              max={MAX}
              value={countInput}
              onChange={(e) => {
                setCountInput(e.target.value);
                track();
              }}
              onBlur={() => setCountInput(String(count))}
            />
          </Field>
          <Button variant="outline" onClick={regenerate}>
            <RefreshCw aria-hidden />
            Regenerate
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          <Checkbox
            label="Start with “Lorem ipsum dolor sit amet…”"
            checked={startWithLorem}
            onChange={(e) => {
              setStartWithLorem(e.target.checked);
              track();
            }}
          />
          <Checkbox
            label="Wrap paragraphs in <p> tags"
            checked={html}
            onChange={(e) => {
              setHtml(e.target.checked);
              track();
            }}
          />
        </div>
      </Panel>

      <OutputBox
        value={output}
        label="Placeholder text"
        filename={html ? "lorem-ipsum.html" : "lorem-ipsum.txt"}
        mono={html}
        rows={14}
      />
    </div>
  );
}
