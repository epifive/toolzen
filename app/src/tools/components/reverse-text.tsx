"use client";

import { useEffect, useMemo, useState } from "react";
import { OutputBox, Panel, Segmented, TextInput, ToolColumns } from "@/components/tool-ui";
import { reverseText, type ReverseMode } from "@/tools/lib/text";
import { useTool } from "@/tools/context";

const MODES: Array<{ value: ReverseMode; label: string; example: string }> = [
  { value: "characters", label: "Characters", example: "Hello world → dlrow olleH" },
  { value: "words", label: "Word order", example: "Hello big world → world big Hello" },
  { value: "each-word", label: "Each word", example: "Hello world → olleH dlrow" },
  { value: "lines", label: "Line order", example: "The last line becomes the first." },
  { value: "upside-down", label: "Upside down", example: "Hello → ollǝH" },
];

export default function ReverseText() {
  const { track } = useTool();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ReverseMode>("characters");

  const output = useMemo(() => reverseText(text, mode), [text, mode]);
  const example = MODES.find((m) => m.value === mode)?.example;

  useEffect(() => {
    if (output) track();
  }, [output, track]);

  return (
    <div className="space-y-4">
      <Panel title="Reverse">
        <Segmented label="Reverse" value={mode} onChange={setMode} options={MODES} />
        <p className="mt-3 text-sm text-muted">{example}</p>
      </Panel>

      <ToolColumns>
        <TextInput value={text} onChange={setText} label="Your text" placeholder="Type or paste your text here…" rows={12} />
        <OutputBox value={output} label="Reversed text" filename="reversed-text.txt" rows={12} />
      </ToolColumns>
    </div>
  );
}
