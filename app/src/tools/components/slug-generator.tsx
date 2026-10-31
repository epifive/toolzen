"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { OutputBox, Panel, Segmented, TextInput, ToolColumns } from "@/components/tool-ui";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { slugLines, type SlugOptions } from "@/tools/lib/text";
import { useTool } from "@/tools/context";

const SEPARATORS: Array<{ value: SlugOptions["separator"]; label: string }> = [
  { value: "-", label: "Hyphen ( - )" },
  { value: "_", label: "Underscore ( _ )" },
];

export default function SlugGenerator() {
  const { track } = useTool();
  const maxId = useId();
  const [text, setText] = useState("");
  const [separator, setSeparator] = useState<SlugOptions["separator"]>("-");
  const [lowercase, setLowercase] = useState(true);
  const [removeStopWords, setRemoveStopWords] = useState(false);
  const [maxInput, setMaxInput] = useState("");

  const maxLength = Math.max(0, Number.parseInt(maxInput, 10) || 0);
  const output = useMemo(
    () => slugLines(text, { separator, lowercase, removeStopWords, maxLength }),
    [text, separator, lowercase, removeStopWords, maxLength],
  );

  useEffect(() => {
    if (output.trim()) track();
  }, [output, track]);

  return (
    <div className="space-y-4">
      <Panel title="Options">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink">Separator</span>
            <Segmented label="Separator" value={separator} onChange={setSeparator} options={SEPARATORS} />
          </div>
          <Field label="Maximum length" htmlFor={maxId} className="w-40">
            <Input
              id={maxId}
              type="number"
              inputMode="numeric"
              min={0}
              max={500}
              placeholder="No limit"
              value={maxInput}
              onChange={(e) => setMaxInput(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          <Checkbox label="Lowercase" checked={lowercase} onChange={(e) => setLowercase(e.target.checked)} />
          <Checkbox
            label="Remove stop words (a, the, of, and…)"
            checked={removeStopWords}
            onChange={(e) => setRemoveStopWords(e.target.checked)}
          />
        </div>
      </Panel>

      <ToolColumns>
        <TextInput
          value={text}
          onChange={setText}
          label="Titles (one per line)"
          placeholder={"10 Tips for Better Sleep\nCafé Crème: A Beginner’s Guide"}
          rows={12}
        />
        <OutputBox value={output} label="Slugs" filename="slugs.txt" rows={12} mono />
      </ToolColumns>
    </div>
  );
}
