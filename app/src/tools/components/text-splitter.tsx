"use client";

import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import { CopyButton, DownloadTextButton, ErrorText, Panel, Segmented, TextInput } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label } from "@/components/ui/field";
import { useTool } from "@/tools/context";
import { graphemes } from "@/tools/lib/text";

type SplitBy = "characters" | "words" | "lines" | "delimiter";

const SPLIT_OPTIONS: Array<{ value: SplitBy; label: string }> = [
  { value: "characters", label: "Characters" },
  { value: "words", label: "Words" },
  { value: "lines", label: "Lines" },
  { value: "delimiter", label: "Delimiter" },
];

const PRESETS: Array<{ label: string; size: number }> = [
  { label: "X post (280)", size: 280 },
  { label: "SMS (160)", size: 160 },
  { label: "Meta description (160)", size: 160 },
];

/** Only this many parts are drawn on the page; copy or download gets all of them. */
const RENDER_LIMIT = 200;

interface SplitOptions {
  by: SplitBy;
  size: number;
  delimiter: string;
  keepWords: boolean;
  numbered: boolean;
}

function group<T>(items: T[], size: number, join: (part: T[]) => string): string[] {
  const out: string[] = [];
  for (let i = 0; i < items.length; i += size) out.push(join(items.slice(i, i + size)));
  return out;
}

function splitCharacters(text: string, size: number, keepWords: boolean): string[] {
  const chars = graphemes(text);
  const isSpace = (c: string | undefined) => c !== undefined && /^\s+$/.test(c);
  const chunks: string[] = [];
  let i = 0;
  while (keepWords && isSpace(chars[i])) i++;
  while (i < chars.length) {
    let end = Math.min(i + size, chars.length);
    if (keepWords && end < chars.length) {
      // Cut at the last space that fits; a single word longer than the limit is split anyway.
      for (let j = end; j > i; j--) {
        if (isSpace(chars[j])) {
          end = j;
          break;
        }
      }
    }
    const piece = chars.slice(i, end).join("");
    chunks.push(keepWords ? piece.trimEnd() : piece);
    i = end;
    while (keepWords && isSpace(chars[i])) i++;
  }
  return chunks;
}

function splitOnce(text: string, { by, size, delimiter, keepWords }: SplitOptions): string[] {
  switch (by) {
    case "characters":
      return splitCharacters(text, size, keepWords);
    case "words":
      return group(text.split(/\s+/).filter(Boolean), size, (part) => part.join(" "));
    case "lines":
      return group(text.split(/\r\n|\r|\n/), size, (part) => part.join("\n"));
    case "delimiter":
      return group(text.split(delimiter), size, (part) => part.join(delimiter));
  }
}

type SplitResult = { ok: true; chunks: string[] } | { ok: false; error: string };

function splitText(text: string, options: SplitOptions): SplitResult {
  const { by, size, delimiter, numbered } = options;
  if (!Number.isInteger(size) || size < 1) return { ok: false, error: "The part size must be a whole number of 1 or more." };
  if (by === "delimiter" && !delimiter) return { ok: false, error: "Enter the delimiter to split on." };

  let chunks = splitOnce(text, options);
  if (numbered && by === "characters" && chunks.length > 1) {
    // Leave room for the " 3/12" label so every numbered part still fits the limit.
    for (let attempt = 0; attempt < 4; attempt++) {
      const reserve = ` ${chunks.length}/${chunks.length}`.length;
      if (size - reserve < 1) return { ok: false, error: "The part size is too small to fit the numbering." };
      const next = splitOnce(text, { ...options, size: size - reserve });
      const stable = String(next.length).length === String(chunks.length).length;
      chunks = next;
      if (stable) break;
    }
  }
  if (numbered && chunks.length > 1) chunks = chunks.map((chunk, i) => `${chunk} ${i + 1}/${chunks.length}`);
  return { ok: true, chunks };
}

export default function TextSplitter() {
  const { track } = useTool();
  const sizeId = useId();
  const delimiterId = useId();
  const [text, setText] = useState("");
  const [by, setBy] = useState<SplitBy>("characters");
  const [size, setSize] = useState(280);
  const [delimiter, setDelimiter] = useState(",");
  const [keepWords, setKeepWords] = useState(true);
  const [numbered, setNumbered] = useState(false);
  const source = useDeferredValue(text);

  const result = useMemo<SplitResult | null>(
    () => (source ? splitText(source, { by, size, delimiter, keepWords, numbered }) : null),
    [source, by, size, delimiter, keepWords, numbered],
  );
  const chunks = result?.ok ? result.chunks : [];
  const all = useMemo(() => (result?.ok ? result.chunks.join("\n\n") : ""), [result]);

  useEffect(() => {
    if (chunks.length) track();
  }, [chunks.length, track]);

  const unit = { characters: "characters", words: "words", lines: "lines", delimiter: "items" }[by];

  return (
    <div className="space-y-4">
      <Panel title="Split by">
        <Segmented label="Split by" value={by} onChange={setBy} options={SPLIT_OPTIONS} />
        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-4">
          <div className="w-40">
            <Label htmlFor={sizeId}>Max {unit} per part</Label>
            <Input
              id={sizeId}
              type="number"
              inputMode="numeric"
              min={1}
              value={Number.isNaN(size) ? "" : size}
              onChange={(e) => setSize(e.target.valueAsNumber)}
              aria-invalid={result?.ok === false}
            />
          </div>
          {by === "delimiter" ? (
            <div className="w-40">
              <Label htmlFor={delimiterId}>Delimiter</Label>
              <Input id={delimiterId} value={delimiter} onChange={(e) => setDelimiter(e.target.value)} className="font-mono" />
            </div>
          ) : null}
          {by === "characters" ? (
            <div className="flex flex-wrap items-center gap-2 pb-1">
              {PRESETS.map((preset) => (
                <Button key={preset.label} size="sm" variant="outline" onClick={() => setSize(preset.size)}>
                  {preset.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          {by === "characters" ? (
            <Checkbox label="Don't break words" checked={keepWords} onChange={(e) => setKeepWords(e.target.checked)} />
          ) : null}
          <Checkbox label="Number the parts (1/3, 2/3…)" checked={numbered} onChange={(e) => setNumbered(e.target.checked)} />
        </div>
      </Panel>

      <TextInput value={text} onChange={setText} label="Your text" placeholder="Paste the long text you want to split…" rows={8} />

      {result && !result.ok ? <ErrorText>{result.error}</ErrorText> : null}

      {chunks.length ? (
        <Panel
          title={`${chunks.length.toLocaleString()} part${chunks.length === 1 ? "" : "s"}`}
          actions={
            <>
              <CopyButton text={all} label="Copy all" />
              <DownloadTextButton text={all} filename="split-text.txt" />
            </>
          }
        >
          <ol className="space-y-3">
            {chunks.slice(0, RENDER_LIMIT).map((chunk, i) => (
              <li key={i} className="rounded-lg border border-line bg-paper">
                <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5">
                  <span className="text-xs text-muted">
                    Part {i + 1} · {graphemes(chunk).length.toLocaleString()} characters
                  </span>
                  <CopyButton text={chunk} />
                </div>
                <p className="px-3 py-2 text-sm break-words whitespace-pre-wrap text-ink">{chunk}</p>
              </li>
            ))}
          </ol>
          {chunks.length > RENDER_LIMIT ? (
            <p className="mt-3 text-sm text-muted">
              Showing the first {RENDER_LIMIT} parts. Use Copy all or Download to get all {chunks.length.toLocaleString()}.
            </p>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}
