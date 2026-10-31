"use client";

import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Label, Select } from "@/components/ui/field";
import { ErrorText, OutputBox, Panel, Spinner, TextInput } from "@/components/tool-ui";
import { useTool } from "@/tools/context";
import { errorMessage, sortJsonKeys, stringifyJson, type JsonIndent } from "@/tools/lib/dev";
import { OpenFileButton } from "@/tools/lib/dev-ui";
import { SourceExcerpt } from "@/tools/lib/source-excerpt";

type YamlModule = typeof import("yaml");
type Indent = JsonIndent | "none";
type Version = "1.2" | "1.1";

interface YamlProblem {
  message: string;
  line?: number;
  column?: number;
}

type Result = { ok: true; json: string; documents: number } | { ok: false; error: YamlProblem };

const PLACEHOLDER = `# Application settings
name: Toolzen
version: 1.2
features:
  - fast
  - private
database:
  host: localhost
  port: 3306`;

/** yaml's messages end with " at line N, column M:" and a code frame; keep only the sentence. */
function tidyYamlMessage(message: string): string {
  const first = message.split("\n")[0].replace(/ at line \d+, column \d+:?$/, "").trim();
  return first || "The YAML could not be parsed";
}

function convert(yaml: YamlModule, text: string, version: Version, indent: Indent, sortKeys: boolean): Result {
  const docs = yaml.parseAllDocuments(text, { version, merge: true, prettyErrors: true });
  for (const doc of docs) {
    const problem = doc.errors[0];
    if (problem) {
      const position = problem.linePos?.[0];
      return { ok: false, error: { message: tidyYamlMessage(problem.message), line: position?.line, column: position?.col } };
    }
  }
  try {
    const values = docs.map((doc) => doc.toJS({ maxAliasCount: 1000 }) as unknown);
    // A file with only comments has no documents; an empty document is null.
    let value: unknown = values.length > 1 ? values : (values[0] ?? null);
    if (sortKeys) value = sortJsonKeys(value);
    return { ok: true, json: stringifyJson(value, indent), documents: values.length };
  } catch (error) {
    return { ok: false, error: { message: errorMessage(error, "The YAML could not be converted") } };
  }
}

export default function YamlToJson() {
  const { track } = useTool();
  const indentId = useId();
  const versionId = useId();
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState<Indent>("2");
  const [version, setVersion] = useState<Version>("1.2");
  const [sortKeys, setSortKeys] = useState(false);
  const [yaml, setYaml] = useState<YamlModule | null>(null);
  const [loadError, setLoadError] = useState("");
  const [fileError, setFileError] = useState("");
  const source = useDeferredValue(input);

  const needsParser = source.trim() !== "" && !yaml;

  useEffect(() => {
    if (!needsParser) return;
    let cancelled = false;
    import("yaml")
      .then((mod) => {
        if (!cancelled) setYaml(mod);
      })
      .catch(() => {
        if (!cancelled) setLoadError("The YAML parser could not be loaded. Check your connection and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [needsParser]);

  const result = useMemo<Result | null>(
    () => (yaml && source.trim() ? convert(yaml, source, version, indent, sortKeys) : null),
    [yaml, source, version, indent, sortKeys],
  );

  useEffect(() => {
    if (result?.ok) track();
  }, [result, track]);

  return (
    <div className="space-y-4">
      <TextInput
        value={input}
        onChange={setInput}
        label="YAML input"
        placeholder={PLACEHOLDER}
        rows={12}
        mono
        actions={
          <OpenFileButton
            accept=".yaml,.yml,.txt,application/yaml,text/yaml,text/plain"
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
            <Label htmlFor={indentId}>JSON indentation</Label>
            <Select id={indentId} value={indent} onChange={(e) => setIndent(e.target.value as Indent)}>
              <option value="2">2 spaces</option>
              <option value="4">4 spaces</option>
              <option value="tab">Tab</option>
              <option value="none">None (minified)</option>
            </Select>
          </div>
          <div>
            <Label htmlFor={versionId}>YAML version</Label>
            <Select id={versionId} value={version} onChange={(e) => setVersion(e.target.value as Version)}>
              <option value="1.2">YAML 1.2 (default)</option>
              <option value="1.1">YAML 1.1 (yes/no and on/off are booleans)</option>
            </Select>
          </div>
        </div>
        <Checkbox className="mt-4" label="Sort keys A–Z" checked={sortKeys} onChange={(e) => setSortKeys(e.target.checked)} />
        <p className="mt-3 text-sm text-muted">
          Anchors, aliases and merge keys (&lt;&lt;) are resolved. A file with several documents (separated by ---) becomes a JSON array.
        </p>
      </Panel>

      {needsParser && !loadError ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner />
          Loading the YAML parser…
        </p>
      ) : null}

      {result && !result.ok ? (
        <Alert tone="error" title="Invalid YAML">
          <p>
            {result.error.message}
            {result.error.line ? ` (line ${result.error.line}${result.error.column ? `, column ${result.error.column}` : ""}).` : "."}
          </p>
          {result.error.line ? <SourceExcerpt text={source} line={result.error.line} column={result.error.column} /> : null}
        </Alert>
      ) : null}

      {result?.ok && result.documents > 1 ? (
        <Alert tone="info">{result.documents} YAML documents were combined into one JSON array.</Alert>
      ) : null}

      <OutputBox
        value={result?.ok ? result.json : ""}
        label="JSON"
        filename="data.json"
        mimeType="application/json;charset=utf-8"
        mono
        rows={14}
      />
    </div>
  );
}
