"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { OutputBox, Panel, Segmented, TextInput, ToolColumns } from "@/components/tool-ui";
import { useTool } from "@/tools/context";
import { errorMessage } from "@/tools/lib/dev";
import { convertAddress } from "@/tools/lib/punycode";

type Mode = "toAscii" | "toUnicode";

interface LineError {
  line: number;
  input: string;
  message: string;
}

function convertLines(text: string, mode: Mode): { output: string; errors: LineError[] } {
  const errors: LineError[] = [];
  const output = text
    .split(/\r\n|\r|\n/)
    .map((line, index) => {
      if (!line.trim()) return "";
      try {
        return convertAddress(line, mode);
      } catch (error) {
        errors.push({ line: index + 1, input: line.trim(), message: errorMessage(error, "This domain cannot be converted.") });
        return "";
      }
    })
    .join("\n");
  return { output: errors.length && !output.trim() ? "" : output, errors };
}

const EXAMPLES: Record<Mode, string> = {
  toAscii: "bücher.de\nmünchen.example\nhttps://例え.テスト/path\ninfo@пример.рф",
  toUnicode: "xn--bcher-kva.de\nxn--mnchen-3ya.example\nhttps://xn--r8jz45g.xn--zckzah/path\ninfo@xn--e1afmkfd.xn--p1ai",
};

export default function PunycodeConverter() {
  const { track } = useTool();
  const [mode, setMode] = useState<Mode>("toAscii");
  const [input, setInput] = useState("");
  const source = useDeferredValue(input);

  const result = useMemo(() => (source.trim() ? convertLines(source, mode) : null), [source, mode]);
  const output = result?.output ?? "";

  useEffect(() => {
    if (output.trim()) track();
  }, [output, track]);

  function swap() {
    setMode(mode === "toAscii" ? "toUnicode" : "toAscii");
    setInput(output);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Direction"
          value={mode}
          onChange={setMode}
          options={[
            { value: "toAscii", label: "Unicode → Punycode" },
            { value: "toUnicode", label: "Punycode → Unicode" },
          ]}
        />
        <Button size="sm" variant="ghost" onClick={() => setInput(EXAMPLES[mode])}>
          Load example
        </Button>
      </div>

      <ToolColumns>
        <TextInput
          value={input}
          onChange={setInput}
          label={mode === "toAscii" ? "Domains (one per line)" : "Punycode domains (one per line)"}
          placeholder={EXAMPLES[mode]}
          rows={8}
          mono
          actions={
            <Button size="sm" variant="ghost" onClick={swap} disabled={!output.trim()}>
              <ArrowUpDown aria-hidden />
              Swap
            </Button>
          }
        />
        <OutputBox
          value={output}
          label={mode === "toAscii" ? "Punycode (ASCII)" : "Unicode"}
          filename={mode === "toAscii" ? "punycode-domains.txt" : "unicode-domains.txt"}
          mono
          rows={8}
        />
      </ToolColumns>

      {result?.errors.length ? (
        <Alert tone="error" title={`${result.errors.length} line${result.errors.length === 1 ? "" : "s"} could not be converted`}>
          <ul className="mt-1 space-y-1">
            {result.errors.slice(0, 20).map((e) => (
              <li key={e.line}>
                Line {e.line} (<span className="font-mono break-all">{e.input}</span>): {e.message}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <Panel title="How it works">
        <p className="text-sm text-muted">
          Domain names can only contain the letters a–z, digits and hyphens. Internationalized domain names (IDNs) such as
          bücher.de are stored as Punycode: each label with other characters is encoded per RFC 3492 and prefixed with xn--.
          URLs and email addresses are supported too; only the domain part is converted.
        </p>
      </Panel>
    </div>
  );
}
