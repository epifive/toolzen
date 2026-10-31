"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { CopyButton, OutputBox, Panel, RangeField, Segmented, TextInput, ToolColumns } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTool } from "@/tools/context";

type Mode = "encode" | "decode";

/** Shift every A–Z and a–z letter by `shift` places, wrapping around. Other characters are kept. */
function caesar(text: string, shift: number): string {
  const s = ((shift % 26) + 26) % 26;
  return text.replace(/[a-z]/gi, (char) => {
    const base = char <= "Z" ? 65 : 97;
    return String.fromCharCode(((char.charCodeAt(0) - base + s) % 26) + base);
  });
}

/** Relative frequency of each letter in English text (A–Z), in percent. */
const ENGLISH = [
  8.2, 1.5, 2.8, 4.3, 12.7, 2.2, 2.0, 6.1, 7.0, 0.15, 0.77, 4.0, 2.4, 6.7, 7.5, 1.9, 0.095, 6.0, 6.3, 9.1, 2.8, 0.98, 2.4, 0.15,
  2.0, 0.074,
];

/** Chi-squared distance from English letter frequencies; lower means more English-like. */
function englishScore(text: string): number {
  const counts = new Array<number>(26).fill(0);
  let total = 0;
  for (const char of text.toUpperCase()) {
    const i = char.charCodeAt(0) - 65;
    if (i >= 0 && i < 26) {
      counts[i]++;
      total++;
    }
  }
  if (!total) return Infinity;
  return counts.reduce((sum, count, i) => {
    const expected = (ENGLISH[i] / 100) * total;
    return sum + (count - expected) ** 2 / expected;
  }, 0);
}

const PREVIEW = 160;

export default function CaesarCipher() {
  const { track } = useTool();
  const [mode, setMode] = useState<Mode>("encode");
  const [shift, setShift] = useState(3);
  const [input, setInput] = useState("");
  const source = useDeferredValue(input);

  const output = useMemo(() => (source ? caesar(source, mode === "encode" ? shift : -shift) : ""), [source, mode, shift]);

  const bruteForce = useMemo(() => {
    if (!/[a-z]/i.test(source)) return null;
    const rows = Array.from({ length: 25 }, (_, i) => {
      const key = i + 1;
      const text = caesar(source, -key);
      return { key, text, score: englishScore(text) };
    });
    const best = rows.reduce((a, b) => (b.score < a.score ? b : a));
    return { rows, best: best.key };
  }, [source]);

  useEffect(() => {
    if (output) track();
  }, [output, track]);

  function swap() {
    setMode(mode === "encode" ? "decode" : "encode");
    setInput(output);
  }

  return (
    <div className="space-y-4">
      <Panel title="Settings">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Segmented
            label="Mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "encode", label: "Encode" },
              { value: "decode", label: "Decode" },
            ]}
          />
          <Button size="sm" variant={shift === 13 ? "secondary" : "outline"} onClick={() => setShift(13)}>
            ROT13
          </Button>
        </div>
        <div className="mt-4 max-w-md">
          <RangeField label="Shift" value={shift} min={1} max={25} onChange={setShift} format={(v) => `${v} (A → ${String.fromCharCode(65 + v)})`} />
        </div>
      </Panel>

      <ToolColumns>
        <TextInput
          value={input}
          onChange={setInput}
          label={mode === "encode" ? "Plain text" : "Encrypted text"}
          placeholder={mode === "encode" ? "Type a secret message…" : "Paste the encrypted text…"}
          rows={8}
          actions={
            <Button size="sm" variant="ghost" onClick={swap} disabled={!output}>
              <ArrowUpDown aria-hidden />
              Swap
            </Button>
          }
        />
        <OutputBox value={output} label={mode === "encode" ? "Encrypted text" : "Decrypted text"} filename="caesar-cipher.txt" rows={8} />
      </ToolColumns>

      {bruteForce ? (
        <Panel title="All 25 shifts (brute force)">
          <p className="mb-3 text-sm text-muted">
            Don&apos;t know the shift? Every possible decryption of your text is listed below. The most English-looking one is highlighted.
          </p>
          <ol className="divide-y divide-line rounded-lg border border-line">
            {bruteForce.rows.map((row) => (
              <li
                key={row.key}
                className={cn("flex items-start gap-3 px-3 py-2", row.key === bruteForce.best && "bg-primary-soft")}
              >
                <span className="w-16 shrink-0 pt-0.5 text-xs text-muted tabular-nums">
                  Shift {row.key}
                  {row.key === bruteForce.best ? <span className="block font-medium text-primary">Best match</span> : null}
                </span>
                <span className="min-w-0 flex-1 font-mono text-[13px] break-words text-ink">
                  {row.text.length > PREVIEW ? `${Array.from(row.text).slice(0, PREVIEW).join("")}…` : row.text}
                </span>
                <CopyButton text={row.text} />
              </li>
            ))}
          </ol>
        </Panel>
      ) : null}
    </div>
  );
}
