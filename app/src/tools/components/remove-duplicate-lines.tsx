"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ErrorText, FileDropzone, OutputBox, Panel, Stat, StatGrid, TextInput, ToolColumns } from "@/components/tool-ui";
import { Checkbox } from "@/components/ui/field";
import { removeDuplicateLines, type DedupeOptions } from "@/tools/lib/text";
import { useTool } from "@/tools/context";

const OPTIONS: Array<{ key: keyof DedupeOptions; label: string }> = [
  { key: "caseInsensitive", label: "Ignore case (“Apple” = “apple”)" },
  { key: "trim", label: "Ignore leading and trailing spaces" },
  { key: "removeEmpty", label: "Remove empty lines" },
  { key: "sort", label: "Sort the result A → Z" },
];

export default function RemoveDuplicateLines() {
  const { track } = useTool();
  const [text, setText] = useState("");
  const [fileError, setFileError] = useState("");
  const [options, setOptions] = useState<DedupeOptions>({
    caseInsensitive: false,
    trim: true,
    removeEmpty: false,
    sort: false,
  });

  const deferredText = useDeferredValue(text);
  const result = useMemo(() => removeDuplicateLines(deferredText, options), [deferredText, options]);

  useEffect(() => {
    if (result.output) track();
  }, [result.output, track]);

  async function openFile([file]: File[]) {
    try {
      setText(await file.text());
      setFileError("");
    } catch {
      setFileError(`${file.name} could not be read as text.`);
    }
  }

  return (
    <div className="space-y-4">
      <Panel title="Options">
        <div className="grid gap-2 sm:grid-cols-2">
          {OPTIONS.map((o) => (
            <Checkbox
              key={o.key}
              label={o.label}
              checked={options[o.key]}
              onChange={(e) => setOptions((prev) => ({ ...prev, [o.key]: e.target.checked }))}
            />
          ))}
        </div>
      </Panel>

      <ToolColumns>
        <div className="space-y-2">
          <TextInput value={text} onChange={setText} label="Your list" placeholder="One item per line…" rows={14} mono />
          <FileDropzone
            compact
            accept=".txt,.csv,text/plain,text/csv"
            label="Open a .txt or .csv file"
            onFiles={openFile}
          />
          <ErrorText>{fileError}</ErrorText>
        </div>
        <OutputBox value={result.output} label="Unique lines" filename="unique-lines.txt" rows={14} mono />
      </ToolColumns>

      <StatGrid>
        <Stat label="Lines before" value={result.before.toLocaleString()} />
        <Stat label="Lines after" value={result.after.toLocaleString()} emphasis />
        <Stat label="Duplicates removed" value={result.duplicates.toLocaleString()} emphasis />
        {options.removeEmpty ? <Stat label="Empty lines removed" value={result.emptyRemoved.toLocaleString()} /> : null}
      </StatGrid>
    </div>
  );
}
