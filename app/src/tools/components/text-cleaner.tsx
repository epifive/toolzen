"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ErrorText, FileDropzone, OutputBox, Panel, Stat, StatGrid, TextInput, ToolColumns } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { charCount, cleanText, type CleanOptions } from "@/tools/lib/text";
import { useTool } from "@/tools/context";

type OptionKey = keyof CleanOptions;

const GROUPS: Array<{ title: string; options: Array<{ key: OptionKey; label: string }> }> = [
  {
    title: "Spaces and lines",
    options: [
      { key: "trimLines", label: "Trim spaces at the start and end of lines" },
      { key: "collapseSpaces", label: "Collapse multiple spaces into one" },
      { key: "removeEmptyLines", label: "Remove empty lines" },
      { key: "removeLineBreaks", label: "Remove all line breaks (join with a space)" },
    ],
  },
  {
    title: "Content",
    options: [
      { key: "stripHtml", label: "Remove HTML tags" },
      { key: "straightQuotes", label: "Convert smart quotes to straight quotes" },
      { key: "removeEmoji", label: "Remove emoji" },
      { key: "removeNonAscii", label: "Remove non-ASCII characters (é becomes e)" },
      { key: "removeNumbers", label: "Remove numbers" },
      { key: "removePunctuation", label: "Remove punctuation" },
    ],
  },
];

const DEFAULTS: CleanOptions = {
  trimLines: true,
  collapseSpaces: true,
  removeEmptyLines: false,
  removeLineBreaks: false,
  stripHtml: false,
  straightQuotes: false,
  removeEmoji: false,
  removeNonAscii: false,
  removeNumbers: false,
  removePunctuation: false,
};

const NONE = Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, false])) as Record<OptionKey, boolean>;

export default function TextCleaner() {
  const { track } = useTool();
  const [text, setText] = useState("");
  const [options, setOptions] = useState<CleanOptions>(DEFAULTS);
  const [fileError, setFileError] = useState("");

  const deferredText = useDeferredValue(text);
  const output = useMemo(() => cleanText(deferredText, options), [deferredText, options]);
  const before = useMemo(() => charCount(deferredText), [deferredText]);
  const after = useMemo(() => charCount(output), [output]);

  useEffect(() => {
    if (output) track();
  }, [output, track]);

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
      <Panel
        title="Clean-up actions"
        actions={
          <Button size="sm" variant="ghost" onClick={() => setOptions(NONE)}>
            Untick all
          </Button>
        }
      >
        <div className="grid gap-6 md:grid-cols-2">
          {GROUPS.map((group) => (
            <fieldset key={group.title} className="space-y-2">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{group.title}</legend>
              {group.options.map((o) => (
                <div key={o.key}>
                  <Checkbox
                    label={o.label}
                    checked={options[o.key]}
                    onChange={(e) => setOptions((prev) => ({ ...prev, [o.key]: e.target.checked }))}
                  />
                </div>
              ))}
            </fieldset>
          ))}
        </div>
      </Panel>

      <ToolColumns>
        <div className="space-y-2">
          <TextInput value={text} onChange={setText} label="Your text" placeholder="Paste the text to clean…" rows={14} />
          <FileDropzone compact accept=".txt,.html,.htm,.md,text/plain,text/html" label="Open a text or HTML file" onFiles={openFile} />
          <ErrorText>{fileError}</ErrorText>
        </div>
        <OutputBox value={output} label="Cleaned text" filename="cleaned-text.txt" rows={14} />
      </ToolColumns>

      <StatGrid>
        <Stat label="Characters before" value={before.toLocaleString()} />
        <Stat label="Characters after" value={after.toLocaleString()} />
        <Stat label="Characters removed" value={Math.max(0, before - after).toLocaleString()} emphasis />
      </StatGrid>
    </div>
  );
}
