"use client";

import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Input, Label, Select } from "@/components/ui/field";
import { ErrorText, OutputBox, Panel, TextInput } from "@/components/tool-ui";
import { useTool } from "@/tools/context";
import { stringifyJson, type JsonIndent } from "@/tools/lib/dev";
import { OpenFileButton } from "@/tools/lib/dev-ui";
import { SourceExcerpt } from "@/tools/lib/source-excerpt";
import { parseXml, xmlToJson, type XmlErrorInfo, type XmlToJsonOptions } from "@/tools/lib/xml";

type Indent = JsonIndent | "none";

type Result = { ok: true; json: string } | { ok: false; error: XmlErrorInfo };

const PLACEHOLDER = `<catalog version="2">
  <book id="b1">
    <title>Dune</title>
    <price>9.99</price>
  </book>
  <book id="b2">
    <title>Emma</title>
    <price>7.50</price>
  </book>
</catalog>`;

function convert(text: string, options: XmlToJsonOptions, indent: Indent): Result {
  const parsed = parseXml(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  return { ok: true, json: stringifyJson(xmlToJson(parsed.doc, options), indent) };
}

export default function XmlToJson() {
  const { track } = useTool();
  const prefixId = useId();
  const textKeyId = useId();
  const indentId = useId();
  const [input, setInput] = useState("");
  const [compact, setCompact] = useState(true);
  const [includeAttributes, setIncludeAttributes] = useState(true);
  const [inferTypes, setInferTypes] = useState(false);
  const [attributePrefix, setAttributePrefix] = useState("@");
  const [textKey, setTextKey] = useState("#text");
  const [indent, setIndent] = useState<Indent>("2");
  const [fileError, setFileError] = useState("");
  const source = useDeferredValue(input);

  const result = useMemo<Result | null>(
    () =>
      source.trim()
        ? convert(source, { compact, includeAttributes, inferTypes, attributePrefix, textKey: textKey || "#text" }, indent)
        : null,
    [source, compact, includeAttributes, inferTypes, attributePrefix, textKey, indent],
  );

  useEffect(() => {
    if (result?.ok) track();
  }, [result, track]);

  return (
    <div className="space-y-4">
      <TextInput
        value={input}
        onChange={setInput}
        label="XML input"
        placeholder={PLACEHOLDER}
        rows={12}
        mono
        actions={
          <OpenFileButton
            accept=".xml,.svg,.rss,.atom,.xsd,.xsl,.plist,.config,application/xml,text/xml"
            onText={(text) => {
              setFileError("");
              setInput(text);
            }}
            onError={setFileError}
          />
        }
      />
      <ErrorText>{fileError}</ErrorText>

      <Panel title="Options">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor={prefixId}>Attribute prefix</Label>
            <Input
              id={prefixId}
              value={attributePrefix}
              onChange={(e) => setAttributePrefix(e.target.value)}
              disabled={!includeAttributes}
              spellCheck={false}
              className="font-mono"
              maxLength={8}
            />
          </div>
          <div>
            <Label htmlFor={textKeyId}>Text key</Label>
            <Input
              id={textKeyId}
              value={textKey}
              onChange={(e) => setTextKey(e.target.value)}
              spellCheck={false}
              className="font-mono"
              maxLength={16}
            />
          </div>
          <div>
            <Label htmlFor={indentId}>Indentation</Label>
            <Select id={indentId} value={indent} onChange={(e) => setIndent(e.target.value as Indent)}>
              <option value="2">2 spaces</option>
              <option value="4">4 spaces</option>
              <option value="tab">Tab</option>
              <option value="none">None (minified)</option>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
          <Checkbox label="Compact (text-only elements become values)" checked={compact} onChange={(e) => setCompact(e.target.checked)} />
          <Checkbox label="Include attributes" checked={includeAttributes} onChange={(e) => setIncludeAttributes(e.target.checked)} />
          <Checkbox label="Detect numbers and booleans" checked={inferTypes} onChange={(e) => setInferTypes(e.target.checked)} />
        </div>
        <p className="mt-3 text-sm text-muted">
          {compact
            ? "Repeated elements become arrays and single elements stay objects, which reads naturally but can change shape between documents."
            : "Every child element is an array and text is always under the text key, so the shape is predictable for code."}
        </p>
      </Panel>

      {result && !result.ok ? (
        <Alert tone="error" title="Invalid XML">
          <p>
            {result.error.message}
            {result.error.line ? ` (line ${result.error.line}${result.error.column ? `, column ${result.error.column}` : ""}).` : "."}
          </p>
          {result.error.line ? <SourceExcerpt text={source} line={result.error.line} column={result.error.column} /> : null}
        </Alert>
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
