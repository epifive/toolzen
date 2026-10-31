"use client";

import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Label, Select } from "@/components/ui/field";
import { ErrorText, OutputBox, Panel, Spinner, TextInput } from "@/components/tool-ui";
import { useTool } from "@/tools/context";
import { describeJsonError, errorMessage, type JsonErrorInfo } from "@/tools/lib/dev";
import { OpenFileButton } from "@/tools/lib/dev-ui";
import { SourceExcerpt } from "@/tools/lib/source-excerpt";

type YamlModule = typeof import("yaml");
type Quotes = "PLAIN" | "QUOTE_DOUBLE" | "QUOTE_SINGLE";

interface Settings {
  indent: 2 | 4;
  quotes: Quotes;
  sortKeys: boolean;
  indentLists: boolean;
  foldLongLines: boolean;
}

type Result = { ok: true; yaml: string } | { ok: false; error: JsonErrorInfo };

const PLACEHOLDER = `{
  "name": "Toolzen",
  "version": 1.2,
  "features": ["fast", "private"],
  "database": { "host": "localhost", "port": 3306 }
}`;

function convert(yaml: YamlModule, text: string, settings: Settings): Result {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { ok: false, error: describeJsonError(text, error) };
  }
  try {
    const output = yaml.stringify(value, {
      indent: settings.indent,
      indentSeq: settings.indentLists,
      defaultStringType: settings.quotes,
      defaultKeyType: "PLAIN",
      sortMapEntries: settings.sortKeys,
      lineWidth: settings.foldLongLines ? 80 : 0,
    });
    return { ok: true, yaml: output };
  } catch (error) {
    return { ok: false, error: { message: errorMessage(error, "The JSON could not be converted to YAML") } };
  }
}

export default function JsonToYaml() {
  const { track } = useTool();
  const indentId = useId();
  const quotesId = useId();
  const [input, setInput] = useState("");
  const [settings, setSettings] = useState<Settings>({
    indent: 2,
    quotes: "PLAIN",
    sortKeys: false,
    indentLists: true,
    foldLongLines: false,
  });
  const [yaml, setYaml] = useState<YamlModule | null>(null);
  const [loadError, setLoadError] = useState("");
  const [fileError, setFileError] = useState("");
  const source = useDeferredValue(input);

  const needsLibrary = source.trim() !== "" && !yaml;

  useEffect(() => {
    if (!needsLibrary) return;
    let cancelled = false;
    import("yaml")
      .then((mod) => {
        if (!cancelled) setYaml(mod);
      })
      .catch(() => {
        if (!cancelled) setLoadError("The YAML converter could not be loaded. Check your connection and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [needsLibrary]);

  const result = useMemo<Result | null>(
    () => (yaml && source.trim() ? convert(yaml, source, settings) : null),
    [yaml, source, settings],
  );

  useEffect(() => {
    if (result?.ok) track();
  }, [result, track]);

  const update = (patch: Partial<Settings>) => setSettings((current) => ({ ...current, ...patch }));

  return (
    <div className="space-y-4">
      <TextInput
        value={input}
        onChange={setInput}
        label="JSON input"
        placeholder={PLACEHOLDER}
        rows={12}
        mono
        actions={
          <OpenFileButton
            accept=".json,application/json"
            onText={(text) => {
              setFileError("");
              setInput(text);
            }}
            onError={setFileError}
          />
        }
      />
      <ErrorText>{fileError || loadError}</ErrorText>

      <Panel title="Options">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={indentId}>Indentation</Label>
            <Select id={indentId} value={settings.indent} onChange={(e) => update({ indent: Number(e.target.value) === 4 ? 4 : 2 })}>
              <option value={2}>2 spaces</option>
              <option value={4}>4 spaces</option>
            </Select>
          </div>
          <div>
            <Label htmlFor={quotesId}>String quotes</Label>
            <Select id={quotesId} value={settings.quotes} onChange={(e) => update({ quotes: e.target.value as Quotes })}>
              <option value="PLAIN">Only when needed</option>
              <option value="QUOTE_DOUBLE">Always &quot;double&quot;</option>
              <option value="QUOTE_SINGLE">Always &apos;single&apos;</option>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
          <Checkbox label="Indent list items" checked={settings.indentLists} onChange={(e) => update({ indentLists: e.target.checked })} />
          <Checkbox label="Sort keys A–Z" checked={settings.sortKeys} onChange={(e) => update({ sortKeys: e.target.checked })} />
          <Checkbox
            label="Fold long strings at 80 characters"
            checked={settings.foldLongLines}
            onChange={(e) => update({ foldLongLines: e.target.checked })}
          />
        </div>
        <p className="mt-3 text-sm text-muted">YAML does not allow tabs for indentation, so only spaces are offered.</p>
      </Panel>

      {needsLibrary && !loadError ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner />
          Loading the YAML converter…
        </p>
      ) : null}

      {result && !result.ok ? (
        <Alert tone="error" title="Invalid JSON">
          <p>
            {result.error.message}
            {result.error.line ? ` at line ${result.error.line}, column ${result.error.column}.` : "."}
          </p>
          {result.error.line ? <SourceExcerpt text={source} line={result.error.line} column={result.error.column} /> : null}
        </Alert>
      ) : null}

      <OutputBox
        value={result?.ok ? result.yaml : ""}
        label="YAML"
        filename="data.yaml"
        mimeType="application/yaml;charset=utf-8"
        mono
        rows={14}
      />
    </div>
  );
}
