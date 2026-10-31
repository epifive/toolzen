"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Minimize2, ShieldCheck, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { ErrorText, OutputBox, Panel, Segmented, TextInput } from "@/components/tool-ui";
import { formatBytes } from "@/lib/utils";
import { useTool } from "@/tools/context";
import { describeJsonError, sortJsonKeys, stringifyJson, utf8Length, type JsonErrorInfo, type JsonIndent } from "@/tools/lib/dev";
import { OpenFileButton } from "@/tools/lib/dev-ui";

type Action = "format" | "minify" | "validate";

type Result =
  | { ok: true; output: string; summary: string }
  | { ok: false; error: JsonErrorInfo };

const CONTEXT_LINES = 2;
/** Long lines (e.g. minified JSON) are shown as a window around the error column. */
const EXCERPT_WIDTH = 120;

function describeValue(value: unknown): string {
  if (Array.isArray(value)) return `an array with ${value.length.toLocaleString()} item${value.length === 1 ? "" : "s"}`;
  if (value === null) return "null";
  if (typeof value === "object") {
    const keys = Object.keys(value).length;
    return `an object with ${keys.toLocaleString()} key${keys === 1 ? "" : "s"}`;
  }
  return `a ${typeof value}`;
}

function run(text: string, action: Action, indent: JsonIndent, sortKeys: boolean): Result {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { ok: false, error: describeJsonError(text, error) };
  }
  if (sortKeys) value = sortJsonKeys(value);
  const output = action === "validate" ? "" : stringifyJson(value, action === "minify" ? "none" : indent);
  return { ok: true, output, summary: `Valid JSON: ${describeValue(value)}.` };
}

/** The lines around a syntax error, with the failing line and column marked. */
function ErrorExcerpt({ text, line, column }: { text: string; line: number; column: number }) {
  const lines = text.split("\n");
  const first = Math.max(1, line - CONTEXT_LINES);
  const last = Math.min(lines.length, line + CONTEXT_LINES);
  const gutter = String(last).length;
  const start = column > EXCERPT_WIDTH * 0.75 ? column - 1 - EXCERPT_WIDTH / 2 : 0;
  const clip = (content: string) => {
    // Tabs become single spaces so the caret lines up with the column.
    const piece = content.slice(start, start + EXCERPT_WIDTH).replace(/\t/g, " ");
    return `${start > 0 ? "…" : ""}${piece}${content.length > start + EXCERPT_WIDTH ? "…" : ""}`;
  };
  const caret = column - 1 - start + (start > 0 ? 1 : 0);

  return (
    <pre
      aria-label={`Source around line ${line}`}
      tabIndex={0}
      className="mt-3 overflow-x-auto rounded-lg border border-line bg-paper py-2 font-mono text-[13px] leading-relaxed text-ink"
    >
      {lines.slice(first - 1, last).map((content, i) => {
        const number = first + i;
        const isError = number === line;
        return (
          <span key={number} className={isError ? "block bg-red-100 dark:bg-red-950/50" : "block"}>
            <span className="inline-block select-none px-3 text-right text-muted" style={{ minWidth: `${gutter + 2}ch` }}>
              {number}
            </span>
            <span>{clip(content) || " "}</span>
            {isError ? (
              <span aria-hidden className="block text-red-600 dark:text-red-400">
                <span className="inline-block px-3" style={{ minWidth: `${gutter + 2}ch` }} />
                {" ".repeat(Math.max(0, caret))}^
              </span>
            ) : null}
          </span>
        );
      })}
    </pre>
  );
}

export default function JsonFormatter() {
  const { track } = useTool();
  const [input, setInput] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const [indent, setIndent] = useState<JsonIndent>("2");
  const [sortKeys, setSortKeys] = useState(false);
  const [fileError, setFileError] = useState("");

  const source = useDeferredValue(input);

  const result = useMemo(
    () => (action && source.trim() ? run(source, action, indent, sortKeys) : null),
    [source, action, indent, sortKeys],
  );

  useEffect(() => {
    if (result?.ok) track();
  }, [result, track]);

  const filename = action === "minify" ? "minified.json" : "formatted.json";

  return (
    <div className="space-y-4">
      <TextInput
        value={input}
        onChange={setInput}
        label="JSON input"
        placeholder='{"name": "Toolzen", "tags": ["fast", "private"]}'
        rows={12}
        mono
        actions={
          <OpenFileButton
            accept=".json,application/json"
            onText={(text) => {
              setFileError("");
              setInput(text);
              setAction((current) => current ?? "format");
            }}
            onError={setFileError}
          />
        }
      />
      <ErrorText>{fileError}</ErrorText>

      <Panel>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">
              Indentation
            </p>
            <Segmented
              label="Indentation"
              value={indent}
              onChange={setIndent}
              options={[
                { value: "2", label: "2 spaces" },
                { value: "4", label: "4 spaces" },
                { value: "tab", label: "Tab" },
              ]}
            />
          </div>
          <Checkbox label="Sort keys A–Z" checked={sortKeys} onChange={(e) => setSortKeys(e.target.checked)} className="pb-2" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => setAction("format")} disabled={!input.trim()}>
            <Sparkles aria-hidden />
            Format
          </Button>
          <Button variant="outline" onClick={() => setAction("minify")} disabled={!input.trim()}>
            <Minimize2 aria-hidden />
            Minify
          </Button>
          <Button variant="outline" onClick={() => setAction("validate")} disabled={!input.trim()}>
            <ShieldCheck aria-hidden />
            Validate
          </Button>
        </div>
      </Panel>

      {result && !result.ok ? (
        <Alert tone="error" title="Invalid JSON">
          <p>
            {result.error.message}
            {result.error.line ? ` at line ${result.error.line}, column ${result.error.column}.` : "."}
          </p>
          {result.error.line && result.error.column ? (
            <ErrorExcerpt text={source} line={result.error.line} column={result.error.column} />
          ) : null}
        </Alert>
      ) : null}

      {result?.ok ? (
        <Alert tone="success" title={result.summary}>
          {result.output
            ? `${formatBytes(utf8Length(source))} in, ${formatBytes(utf8Length(result.output))} out.`
            : `${formatBytes(utf8Length(source))} checked.`}
        </Alert>
      ) : null}

      {result?.ok && result.output ? (
        <OutputBox value={result.output} label={action === "minify" ? "Minified JSON" : "Formatted JSON"} filename={filename} mono rows={14} />
      ) : null}
    </div>
  );
}
