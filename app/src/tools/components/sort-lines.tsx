"use client";

import { useEffect, useMemo, useState } from "react";
import { Shuffle } from "lucide-react";
import { OutputBox, Panel, Segmented, TextInput, ToolColumns } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { sortLines, toLines, type SortMode, type SortOptions } from "@/tools/lib/text";
import { useTool } from "@/tools/context";

const MODES: Array<{ value: SortMode; label: string }> = [
  { value: "az", label: "A → Z" },
  { value: "za", label: "Z → A" },
  { value: "natural", label: "Numeric (1, 2, 10)" },
  { value: "length", label: "By length" },
  { value: "reverse", label: "Reverse order" },
  { value: "shuffle", label: "Random" },
];

interface SortState extends SortOptions {
  text: string;
  mode: SortMode;
}

export default function SortLines() {
  const { track } = useTool();
  const [state, setState] = useState<SortState>({ text: "", mode: "az", caseSensitive: false, removeEmpty: true });
  // A shuffle is random, so it is computed in event handlers and kept until the next change.
  const [shuffled, setShuffled] = useState("");

  function update(patch: Partial<SortState>) {
    const next = { ...state, ...patch };
    setState(next);
    if (next.mode === "shuffle") setShuffled(sortLines(next.text, "shuffle", next));
  }

  const sorted = useMemo(
    () => (state.mode === "shuffle" ? "" : sortLines(state.text, state.mode, state)),
    [state],
  );
  const output = state.mode === "shuffle" ? shuffled : sorted;
  const lineCount = toLines(output).length;

  useEffect(() => {
    if (output) track();
  }, [output, track]);

  return (
    <div className="space-y-4">
      <Panel title="Sort order">
        <div className="space-y-4">
          <Segmented label="Sort order" value={state.mode} onChange={(mode) => update({ mode })} options={MODES} />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Checkbox
              label="Case-sensitive"
              checked={state.caseSensitive}
              disabled={state.mode === "reverse" || state.mode === "shuffle"}
              onChange={(e) => update({ caseSensitive: e.target.checked })}
            />
            <Checkbox
              label="Remove empty lines"
              checked={state.removeEmpty}
              onChange={(e) => update({ removeEmpty: e.target.checked })}
            />
            {state.mode === "shuffle" ? (
              <Button size="sm" variant="outline" disabled={!state.text} onClick={() => update({})}>
                <Shuffle aria-hidden />
                Shuffle again
              </Button>
            ) : null}
          </div>
        </div>
      </Panel>

      <ToolColumns>
        <TextInput
          value={state.text}
          onChange={(text) => update({ text })}
          label="Lines to sort"
          placeholder="One item per line…"
          rows={14}
          mono
        />
        <OutputBox
          value={output}
          label={output ? `Sorted lines (${lineCount.toLocaleString()})` : "Sorted lines"}
          filename="sorted-lines.txt"
          rows={14}
          mono
        />
      </ToolColumns>
    </div>
  );
}
