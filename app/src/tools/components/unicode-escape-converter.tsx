"use client";

import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { OutputBox, Panel, Segmented, TextInput, ToolColumns } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import { Checkbox, Hint, Label, Select } from "@/components/ui/field";
import { useTool } from "@/tools/context";
import { countEscapes, ESCAPE_FORMATS, escapeText, unescapeText, type EscapeFormat } from "@/tools/lib/unicode-escape";

type Mode = "escape" | "unescape";

export default function UnicodeEscapeConverter() {
  const { track } = useTool();
  const formatId = useId();
  const [mode, setMode] = useState<Mode>("escape");
  const [format, setFormat] = useState<EscapeFormat>("js");
  const [escapeAscii, setEscapeAscii] = useState(false);
  const [uppercase, setUppercase] = useState(true);
  const [input, setInput] = useState("");
  const source = useDeferredValue(input);

  const output = useMemo(() => {
    if (!source) return "";
    return mode === "escape" ? escapeText(source, format, { escapeAscii, uppercase }) : unescapeText(source);
  }, [source, mode, format, escapeAscii, uppercase]);

  const found = useMemo(() => (mode === "unescape" && source ? countEscapes(source) : 0), [mode, source]);
  const example = ESCAPE_FORMATS.find((f) => f.value === format)?.example;

  useEffect(() => {
    if (output) track();
  }, [output, track]);

  function swap() {
    setMode(mode === "escape" ? "unescape" : "escape");
    setInput(output);
  }

  return (
    <div className="space-y-4">
      <Panel title="Options">
        <Segmented
          label="Direction"
          value={mode}
          onChange={setMode}
          options={[
            { value: "escape", label: "Text → escapes" },
            { value: "unescape", label: "Escapes → text" },
          ]}
        />
        {mode === "escape" ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={formatId}>Format</Label>
              <Select id={formatId} value={format} onChange={(e) => setFormat(e.target.value as EscapeFormat)}>
                {ESCAPE_FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
              <Hint>
                Example: <span className="font-mono">{example}</span>
              </Hint>
            </div>
            <div className="flex flex-col gap-2 sm:pt-7">
              <Checkbox
                label="Escape ASCII characters too"
                checked={escapeAscii || format === "codepoint"}
                disabled={format === "codepoint"}
                onChange={(e) => setEscapeAscii(e.target.checked)}
              />
              <Checkbox
                label="Uppercase hex digits"
                checked={uppercase}
                disabled={format === "html-dec"}
                onChange={(e) => setUppercase(e.target.checked)}
              />
            </div>
          </div>
        ) : (
          <Hint className="mt-3">
            All formats are detected automatically: \uXXXX, \u{"{…}"}, \UXXXXXXXX, \xXX, &amp;#x…;, &amp;#…;, CSS \XXXX and U+XXXX.
          </Hint>
        )}
      </Panel>

      <ToolColumns>
        <TextInput
          value={input}
          onChange={setInput}
          label={mode === "escape" ? "Text" : "Escaped text"}
          placeholder={mode === "escape" ? "Type or paste text with accents, symbols or emoji…" : "Caf\\u00E9 \\u{1F600} &#x2764;"}
          rows={10}
          mono={mode === "unescape"}
          actions={
            <Button size="sm" variant="ghost" onClick={swap} disabled={!output}>
              <ArrowUpDown aria-hidden />
              Swap
            </Button>
          }
        />
        <div className="space-y-2">
          <OutputBox
            value={output}
            label={mode === "escape" ? "Escaped text" : "Text"}
            filename={mode === "escape" ? "escaped.txt" : "unescaped.txt"}
            mono={mode === "escape"}
            rows={10}
          />
          {mode === "unescape" && source.trim() ? (
            <p className="text-sm text-muted">
              {found ? `Decoded ${found.toLocaleString()} escape sequence${found === 1 ? "" : "s"}.` : "No escape sequences found."}
            </p>
          ) : null}
        </div>
      </ToolColumns>
    </div>
  );
}
