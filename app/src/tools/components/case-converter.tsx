"use client";

import { useEffect, useMemo, useState } from "react";
import { OutputBox, Panel, Segmented, TextInput, ToolColumns } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import { convertCase, type CaseMode } from "@/tools/lib/text";
import { useTool } from "@/tools/context";

const CASES: Array<{ value: CaseMode; label: string }> = [
  { value: "upper", label: "UPPER CASE" },
  { value: "lower", label: "lower case" },
  { value: "title", label: "Title Case" },
  { value: "sentence", label: "Sentence case" },
  { value: "camel", label: "camelCase" },
  { value: "pascal", label: "PascalCase" },
  { value: "snake", label: "snake_case" },
  { value: "kebab", label: "kebab-case" },
  { value: "constant", label: "CONSTANT_CASE" },
  { value: "alternating", label: "aLtErNaTiNg" },
  { value: "inverse", label: "InVeRsE" },
];

export default function CaseConverter() {
  const { track } = useTool();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<CaseMode>("title");

  const output = useMemo(() => convertCase(text, mode), [text, mode]);

  useEffect(() => {
    if (output) track();
  }, [output, track]);

  return (
    <div className="space-y-4">
      <Panel title="Convert to">
        <Segmented label="Convert to" value={mode} onChange={setMode} options={CASES} className="w-full" />
      </Panel>

      <ToolColumns>
        <TextInput value={text} onChange={setText} label="Your text" placeholder="Type or paste your text here…" rows={12} />
        <div className="space-y-2">
          <OutputBox value={output} label="Converted text" filename="converted-text.txt" rows={12} />
          <Button size="sm" variant="ghost" disabled={!output || output === text} onClick={() => setText(output)}>
            Use result as input
          </Button>
        </div>
      </ToolColumns>
    </div>
  );
}
