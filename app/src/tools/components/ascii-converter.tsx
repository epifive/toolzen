"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { ErrorText, OutputBox, Panel, Segmented, TextInput, ToolColumns } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import { useTool } from "@/tools/context";

type Mode = "encode" | "decode";
type Base = "dec" | "hex" | "bin" | "oct";
type Separator = "space" | "comma" | "newline";

const BASES: Array<{ value: Base; label: string; radix: number; pattern: RegExp; prefix: RegExp }> = [
  { value: "dec", label: "Decimal", radix: 10, pattern: /^\d+$/, prefix: /^&#/ },
  { value: "hex", label: "Hex", radix: 16, pattern: /^[0-9a-f]+$/i, prefix: /^(?:0x|&#x|U\+)/i },
  { value: "bin", label: "Binary", radix: 2, pattern: /^[01]+$/, prefix: /^0b/i },
  { value: "oct", label: "Octal", radix: 8, pattern: /^[0-7]+$/, prefix: /^0o/i },
];

const SEPARATORS: Record<Separator, string> = { space: " ", comma: ", ", newline: "\n" };

const CONTROL_NAMES = [
  "NUL", "SOH", "STX", "ETX", "EOT", "ENQ", "ACK", "BEL", "BS", "TAB", "LF", "VT", "FF", "CR", "SO", "SI",
  "DLE", "DC1", "DC2", "DC3", "DC4", "NAK", "SYN", "ETB", "CAN", "EM", "SUB", "ESC", "FS", "GS", "RS", "US",
];

/** Rows drawn in the character table; longer text is still converted in full. */
const TABLE_LIMIT = 500;

function formatCode(code: number, base: Base): string {
  switch (base) {
    case "dec":
      return String(code);
    case "hex":
      return code.toString(16).toUpperCase().padStart(2, "0");
    case "bin":
      return code.toString(2).padStart(8, "0");
    case "oct":
      return code.toString(8).padStart(3, "0");
  }
}

function describe(code: number): string {
  if (code < 32) return `Control (${CONTROL_NAMES[code]})`;
  if (code === 32) return "Space";
  if (code === 127) return "Control (DEL)";
  if (code < 128) return "Printable";
  return "Not ASCII (Unicode)";
}

function displayChar(code: number): string {
  if (code < 32) return CONTROL_NAMES[code];
  if (code === 32) return "SP";
  if (code === 127) return "DEL";
  return String.fromCodePoint(code);
}

type DecodeResult = { ok: true; text: string } | { ok: false; error: string };

function decodeCodes(input: string, base: Base): DecodeResult {
  const spec = BASES.find((b) => b.value === base) ?? BASES[0];
  const tokens = input
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map((token) => token.replace(spec.prefix, "").replace(/;$/, ""));
  const codes: number[] = [];
  for (const token of tokens) {
    if (!spec.pattern.test(token)) return { ok: false, error: `"${token}" is not a valid ${spec.label.toLowerCase()} character code.` };
    const code = parseInt(token, spec.radix);
    if (code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
      return { ok: false, error: `${token} is outside the range of valid Unicode characters.` };
    }
    codes.push(code);
  }
  return { ok: true, text: String.fromCodePoint(...codes) };
}

export default function AsciiConverter() {
  const { track } = useTool();
  const [mode, setMode] = useState<Mode>("encode");
  const [base, setBase] = useState<Base>("dec");
  const [separator, setSeparator] = useState<Separator>("space");
  const [input, setInput] = useState("");
  const source = useDeferredValue(input);

  const result = useMemo<DecodeResult | null>(() => {
    if (!source) return null;
    if (mode === "decode") return source.trim() ? decodeCodes(source, base) : null;
    const codes = Array.from(source, (c) => formatCode(c.codePointAt(0) ?? 0, base));
    return { ok: true, text: codes.join(SEPARATORS[separator]) };
  }, [source, mode, base, separator]);

  const output = result?.ok ? result.text : "";
  const plainText = mode === "encode" ? source : output;
  const characters = useMemo(() => Array.from(plainText).slice(0, TABLE_LIMIT), [plainText]);
  const total = useMemo(() => Array.from(plainText).length, [plainText]);
  const nonAscii = characters.some((c) => (c.codePointAt(0) ?? 0) > 127);

  useEffect(() => {
    if (output) track();
  }, [output, track]);

  function swap() {
    setMode(mode === "encode" ? "decode" : "encode");
    setInput(output);
  }

  const baseLabel = BASES.find((b) => b.value === base)?.label ?? "Decimal";

  return (
    <div className="space-y-4">
      <Panel title="Options">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Segmented
            label="Direction"
            value={mode}
            onChange={setMode}
            options={[
              { value: "encode", label: "Text → codes" },
              { value: "decode", label: "Codes → text" },
            ]}
          />
          <Segmented label="Number base" value={base} onChange={setBase} options={BASES.map(({ value, label }) => ({ value, label }))} />
          {mode === "encode" ? (
            <Segmented
              label="Separator"
              value={separator}
              onChange={setSeparator}
              options={[
                { value: "space", label: "Space" },
                { value: "comma", label: "Comma" },
                { value: "newline", label: "New line" },
              ]}
            />
          ) : null}
        </div>
      </Panel>

      <ToolColumns>
        <TextInput
          value={input}
          onChange={setInput}
          label={mode === "encode" ? "Text" : `${baseLabel} codes`}
          placeholder={mode === "encode" ? "Type or paste text…" : base === "dec" ? "72 101 108 108 111" : "Separate codes with spaces or commas"}
          rows={8}
          mono={mode === "decode"}
          actions={
            <Button size="sm" variant="ghost" onClick={swap} disabled={!output}>
              <ArrowUpDown aria-hidden />
              Swap
            </Button>
          }
        />
        <OutputBox
          value={output}
          label={mode === "encode" ? `${baseLabel} codes` : "Text"}
          filename={mode === "encode" ? "character-codes.txt" : "text.txt"}
          mono={mode === "encode"}
          rows={8}
        />
      </ToolColumns>

      {result && !result.ok ? <ErrorText>{result.error}</ErrorText> : null}

      {characters.length ? (
        <Panel title="Character table">
          {nonAscii ? (
            <p className="mb-3 text-sm text-muted">
              Characters above 127 are not ASCII; their Unicode code point is shown instead.
            </p>
          ) : null}
          <div className="max-h-[28rem] overflow-auto rounded-lg border border-line">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="sticky top-0 bg-paper text-xs text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Char</th>
                  <th scope="col" className="px-3 py-2 font-medium">Decimal</th>
                  <th scope="col" className="px-3 py-2 font-medium">Hex</th>
                  <th scope="col" className="px-3 py-2 font-medium">Binary</th>
                  <th scope="col" className="px-3 py-2 font-medium">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-mono text-[13px] text-ink">
                {characters.map((char, i) => {
                  const code = char.codePointAt(0) ?? 0;
                  return (
                    <tr key={i}>
                      <td className="px-3 py-1.5">{displayChar(code)}</td>
                      <td className="px-3 py-1.5 tabular-nums">{code}</td>
                      <td className="px-3 py-1.5">{formatCode(code, "hex")}</td>
                      <td className="px-3 py-1.5">{formatCode(code, "bin")}</td>
                      <td className="px-3 py-1.5 font-sans text-xs text-muted">{describe(code)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {total > TABLE_LIMIT ? (
            <p className="mt-2 text-sm text-muted">
              Showing the first {TABLE_LIMIT} of {total.toLocaleString()} characters.
            </p>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}
