"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { diffChars, diffLines, diffWords, type Change } from "diff";
import { ErrorText, FileDropzone, Panel, Segmented, Spinner, Stat, StatGrid, TextInput, ToolColumns } from "@/components/tool-ui";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { charCount, useDebouncedValue } from "@/tools/lib/text";
import { useTool } from "@/tools/context";

type DiffMode = "lines" | "words" | "chars";

const MODES: Array<{ value: DiffMode; label: string }> = [
  { value: "lines", label: "Lines" },
  { value: "words", label: "Words" },
  { value: "chars", label: "Characters" },
];

const UNIT_LABEL: Record<DiffMode, string> = { lines: "lines", words: "words", chars: "characters" };

/** Give up on pathological inputs instead of freezing the tab. */
const DIFF_TIMEOUT_MS = 3000;
/** Rendering more rows than this makes the page sluggish; the counts still cover everything. */
const MAX_ROWS = 5000;

interface DiffResult {
  changes: Change[];
  added: number;
  removed: number;
}

interface Row {
  kind: "added" | "removed" | "same";
  text: string;
  oldNo: number | null;
  newNo: number | null;
}

function splitChangeLines(value: string): string[] {
  const lines = value.split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function unitCount(value: string, mode: DiffMode): number {
  if (mode === "lines") return splitChangeLines(value).length;
  if (mode === "words") return value.match(/[\p{L}\p{N}_]+/gu)?.length ?? 0;
  return charCount(value);
}

function computeDiff(left: string, right: string, mode: DiffMode): DiffResult | null {
  const options = { timeout: DIFF_TIMEOUT_MS };
  const changes =
    mode === "lines"
      ? diffLines(left, right, { ...options, stripTrailingCr: true, ignoreNewlineAtEof: true })
      : mode === "words"
        ? diffWords(left, right, options)
        : diffChars(left, right, options);
  if (!changes) return null;

  let added = 0;
  let removed = 0;
  for (const c of changes) {
    if (c.added) added += unitCount(c.value, mode);
    else if (c.removed) removed += unitCount(c.value, mode);
  }
  return { changes, added, removed };
}

function toRows(changes: Change[]): Row[] {
  const rows: Row[] = [];
  let oldNo = 1;
  let newNo = 1;
  for (const c of changes) {
    for (const text of splitChangeLines(c.value)) {
      if (c.added) rows.push({ kind: "added", text, oldNo: null, newNo: newNo++ });
      else if (c.removed) rows.push({ kind: "removed", text, oldNo: oldNo++, newNo: null });
      else rows.push({ kind: "same", text, oldNo: oldNo++, newNo: newNo++ });
    }
  }
  return rows;
}

const ADDED = "bg-emerald-100 text-emerald-950 dark:bg-emerald-900/45 dark:text-emerald-50";
const REMOVED = "bg-red-100 text-red-950 dark:bg-red-900/45 dark:text-red-50";

function LineDiff({ changes, changedOnly }: { changes: Change[]; changedOnly: boolean }) {
  const all = useMemo(() => toRows(changes), [changes]);
  const rows = changedOnly ? all.filter((r) => r.kind !== "same") : all;
  const shown = rows.slice(0, MAX_ROWS);

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-line bg-paper font-mono text-[13px] leading-relaxed">
        {shown.map((row, i) => {
          const Content = row.kind === "added" ? "ins" : row.kind === "removed" ? "del" : "span";
          return (
            <div
              key={i}
              className={cn(
                "grid grid-cols-[2.75rem_2.75rem_1.5rem_1fr] sm:grid-cols-[3.5rem_3.5rem_1.5rem_1fr]",
                row.kind === "added" && ADDED,
                row.kind === "removed" && REMOVED,
              )}
            >
              <span className="select-none border-r border-line px-2 text-right text-muted" aria-hidden>
                {row.oldNo ?? ""}
              </span>
              <span className="select-none border-r border-line px-2 text-right text-muted" aria-hidden>
                {row.newNo ?? ""}
              </span>
              <span className="select-none text-center font-semibold" aria-hidden>
                {row.kind === "added" ? "+" : row.kind === "removed" ? "−" : ""}
              </span>
              <Content className="min-w-0 whitespace-pre-wrap break-words pr-3 no-underline">{row.text || " "}</Content>
            </div>
          );
        })}
      </div>
      {rows.length > shown.length ? (
        <p className="mt-2 text-sm text-muted">
          Showing the first {MAX_ROWS.toLocaleString()} of {rows.length.toLocaleString()} lines.
        </p>
      ) : null}
    </>
  );
}

function InlineDiff({ changes }: { changes: Change[] }) {
  return (
    <p className="max-h-[36rem] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-paper px-3 py-2.5 font-mono text-[13px] leading-relaxed text-ink">
      {changes.map((c, i) =>
        c.added ? (
          <ins key={i} className={cn("rounded-sm underline decoration-emerald-600/70 underline-offset-2", ADDED)}>
            {c.value}
          </ins>
        ) : c.removed ? (
          <del key={i} className={cn("rounded-sm line-through decoration-red-600/70", REMOVED)}>
            {c.value}
          </del>
        ) : (
          <span key={i}>{c.value}</span>
        ),
      )}
    </p>
  );
}

function OpenFile({ onText }: { onText: (text: string) => void }) {
  const [error, setError] = useState("");
  return (
    <div className="space-y-2">
      <FileDropzone
        compact
        accept=".txt,.md,.csv,.json,.html,.css,.js,.ts,text/*"
        label="Open a text file"
        onFiles={async ([file]) => {
          try {
            onText(await file.text());
            setError("");
          } catch {
            setError(`${file.name} could not be read as text.`);
          }
        }}
      />
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

export default function TextDiffChecker() {
  const { track } = useTool();
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [mode, setMode] = useState<DiffMode>("lines");
  const [changedOnly, setChangedOnly] = useState(false);

  // Diffing large texts on every keystroke is wasteful; wait until typing pauses.
  const debouncedLeft = useDebouncedValue(left, 300);
  const debouncedRight = useDebouncedValue(right, 300);
  const pending = left !== debouncedLeft || right !== debouncedRight;
  const hasInput = Boolean(debouncedLeft || debouncedRight);

  const result = useMemo(
    () => (hasInput ? computeDiff(debouncedLeft, debouncedRight, mode) : null),
    [debouncedLeft, debouncedRight, mode, hasInput],
  );
  const identical = result !== null && result.added === 0 && result.removed === 0;

  useEffect(() => {
    if (result) track();
  }, [result, track]);

  return (
    <div className="space-y-4">
      <ToolColumns>
        <div className="space-y-2">
          <TextInput value={left} onChange={setLeft} label="Original text" placeholder="Paste the original text…" rows={12} mono />
          <OpenFile onText={setLeft} />
        </div>
        <div className="space-y-2">
          <TextInput value={right} onChange={setRight} label="Changed text" placeholder="Paste the changed text…" rows={12} mono />
          <OpenFile onText={setRight} />
        </div>
      </ToolColumns>

      <div className="flex flex-wrap items-center gap-3">
        <Segmented label="Compare by" value={mode} onChange={setMode} options={MODES} />
        <Button
          variant="outline"
          size="sm"
          disabled={!left && !right}
          onClick={() => {
            setLeft(right);
            setRight(left);
          }}
        >
          <ArrowLeftRight aria-hidden />
          Swap
        </Button>
        {mode === "lines" ? (
          <Checkbox label="Only show changed lines" checked={changedOnly} onChange={(e) => setChangedOnly(e.target.checked)} />
        ) : null}
      </div>

      {hasInput ? (
        <>
          <StatGrid>
            <Stat label={`Added ${UNIT_LABEL[mode]}`} value={result ? `+${result.added.toLocaleString()}` : "–"} emphasis />
            <Stat label={`Removed ${UNIT_LABEL[mode]}`} value={result ? `−${result.removed.toLocaleString()}` : "–"} emphasis />
          </StatGrid>

          <Panel
            title="Differences"
            actions={
              <div className="flex items-center gap-3 text-xs text-muted">
                {pending ? (
                  <span className="inline-flex items-center gap-1.5" role="status">
                    <Spinner className="size-3.5" />
                    Updating…
                  </span>
                ) : null}
                <span className={cn("rounded px-1.5 py-0.5 font-medium", ADDED)}>+ Added</span>
                <span className={cn("rounded px-1.5 py-0.5 font-medium", REMOVED)}>− Removed</span>
              </div>
            }
          >
            {!result ? (
              <Alert tone="warning" title="These texts are too large or too different to compare quickly.">
                {mode === "lines"
                  ? "Try comparing smaller sections of the texts."
                  : "Try the Lines mode, which is much faster for long texts."}
              </Alert>
            ) : identical ? (
              <Alert tone="success" title="No differences found.">
                {mode === "lines" ? "The two texts are identical line by line." : "The two texts are identical."}
              </Alert>
            ) : mode === "lines" ? (
              <LineDiff changes={result.changes} changedOnly={changedOnly} />
            ) : (
              <InlineDiff changes={result.changes} />
            )}
          </Panel>
        </>
      ) : null}
    </div>
  );
}
