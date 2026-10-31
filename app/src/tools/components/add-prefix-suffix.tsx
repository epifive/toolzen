"use client";

import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import { OutputBox, Panel, TextInput, ToolColumns } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import { Checkbox, Hint, Input, Label } from "@/components/ui/field";
import { useTool } from "@/tools/context";

interface AffixOptions {
  prefix: string;
  suffix: string;
  skipEmpty: boolean;
  trim: boolean;
}

/** In the prefix and suffix, \t means a tab and \n a new line. */
function unescape(value: string): string {
  return value.replace(/\\t/g, "\t").replace(/\\n/g, "\n");
}

function addAffixes(text: string, { prefix, suffix, skipEmpty, trim }: AffixOptions): { output: string; changed: number } {
  let changed = 0;
  const output = text
    .split(/\r\n|\r|\n/)
    .map((raw) => {
      const line = trim ? raw.trim() : raw;
      if (skipEmpty && !line.trim()) return line;
      changed++;
      return prefix + line + suffix;
    })
    .join("\n");
  return { output, changed };
}

const PRESETS: Array<{ label: string; prefix: string; suffix: string }> = [
  { label: "Quotes", prefix: '"', suffix: '",' },
  { label: "Bullets", prefix: "• ", suffix: "" },
  { label: "HTML list items", prefix: "<li>", suffix: "</li>" },
  { label: "Markdown list", prefix: "- ", suffix: "" },
  { label: "SQL values", prefix: "('", suffix: "')," },
];

export default function AddPrefixSuffix() {
  const { track } = useTool();
  const prefixId = useId();
  const suffixId = useId();
  const [text, setText] = useState("");
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [skipEmpty, setSkipEmpty] = useState(true);
  const [trim, setTrim] = useState(false);
  const source = useDeferredValue(text);

  const result = useMemo(() => {
    if (!source || (!prefix && !suffix && !trim)) return { output: "", changed: 0 };
    return addAffixes(source, { prefix: unescape(prefix), suffix: unescape(suffix), skipEmpty, trim });
  }, [source, prefix, suffix, skipEmpty, trim]);

  useEffect(() => {
    if (result.output) track();
  }, [result.output, track]);

  return (
    <div className="space-y-4">
      <Panel title="Add to every line">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={prefixId}>Prefix (start of line)</Label>
            <Input id={prefixId} value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="e.g. - " className="font-mono" />
          </div>
          <div>
            <Label htmlFor={suffixId}>Suffix (end of line)</Label>
            <Input id={suffixId} value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="e.g. ," className="font-mono" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
          <Checkbox label="Skip empty lines" checked={skipEmpty} onChange={(e) => setSkipEmpty(e.target.checked)} />
          <Checkbox label="Trim spaces from each line first" checked={trim} onChange={(e) => setTrim(e.target.checked)} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">Presets:</span>
          {PRESETS.map((preset) => (
            <Button
              key={preset.label}
              size="sm"
              variant="outline"
              onClick={() => {
                setPrefix(preset.prefix);
                setSuffix(preset.suffix);
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <Hint>Use \t for a tab and \n for a new line inside the prefix or suffix.</Hint>
      </Panel>

      <ToolColumns>
        <TextInput value={text} onChange={setText} label="Your lines" placeholder="Paste one item per line…" rows={12} />
        <div className="space-y-2">
          <OutputBox value={result.output} label="Result" filename="lines.txt" rows={12} />
          {result.output ? (
            <p className="text-sm text-muted">
              Changed {result.changed.toLocaleString()} line{result.changed === 1 ? "" : "s"}.
            </p>
          ) : null}
        </div>
      </ToolColumns>
    </div>
  );
}
