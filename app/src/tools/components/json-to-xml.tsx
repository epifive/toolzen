"use client";

import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Hint, Input, Label, Select } from "@/components/ui/field";
import { ErrorText, OutputBox, Panel, TextInput } from "@/components/tool-ui";
import { useTool } from "@/tools/context";
import { describeJsonError, type JsonErrorInfo } from "@/tools/lib/dev";
import { OpenFileButton } from "@/tools/lib/dev-ui";
import { SourceExcerpt } from "@/tools/lib/source-excerpt";
import { isValidXmlName, jsonToXml, type JsonToXmlOptions, type JsonToXmlResult, type XmlIndent } from "@/tools/lib/xml";

type Indent = XmlIndent | "none";

type Result = { ok: true; value: JsonToXmlResult } | { ok: false; error: JsonErrorInfo };

const PLACEHOLDER = `{
  "catalog": {
    "@version": "2",
    "book": [
      { "@id": "b1", "title": "Dune", "price": 9.99 },
      { "@id": "b2", "title": "Emma", "price": 7.5 }
    ]
  }
}`;

const MAX_RENAMED_SHOWN = 5;

function convert(text: string, options: JsonToXmlOptions): Result {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return { ok: false, error: describeJsonError(text, error) };
  }
  return { ok: true, value: jsonToXml(value, options) };
}

export default function JsonToXml() {
  const { track } = useTool();
  const rootId = useId();
  const itemId = useId();
  const indentId = useId();
  const [input, setInput] = useState("");
  const [rootName, setRootName] = useState("root");
  const [itemName, setItemName] = useState("item");
  const [indent, setIndent] = useState<Indent>("2");
  const [declaration, setDeclaration] = useState(true);
  const [unwrapSingleKey, setUnwrapSingleKey] = useState(true);
  const [fileError, setFileError] = useState("");
  const source = useDeferredValue(input);

  const result = useMemo<Result | null>(
    () =>
      source.trim()
        ? convert(source, { rootName, itemName, indent, declaration, unwrapSingleKey, attributePrefix: "@", textKey: "#text" })
        : null,
    [source, rootName, itemName, indent, declaration, unwrapSingleKey],
  );

  useEffect(() => {
    if (result?.ok) track();
  }, [result, track]);

  const renamed = result?.ok ? result.value.renamed : [];

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
      <ErrorText>{fileError}</ErrorText>

      <Panel title="Options">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor={rootId}>Root element</Label>
            <Input
              id={rootId}
              value={rootName}
              onChange={(e) => setRootName(e.target.value)}
              spellCheck={false}
              className="font-mono"
              aria-invalid={rootName.trim() !== "" && !isValidXmlName(rootName.trim())}
            />
            <Hint>Used when the JSON has no single top-level key.</Hint>
          </div>
          <div>
            <Label htmlFor={itemId}>Array item element</Label>
            <Input
              id={itemId}
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              spellCheck={false}
              className="font-mono"
              aria-invalid={itemName.trim() !== "" && !isValidXmlName(itemName.trim())}
            />
            <Hint>Wraps items of arrays that have no key.</Hint>
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
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          <Checkbox label="XML declaration" checked={declaration} onChange={(e) => setDeclaration(e.target.checked)} />
          <Checkbox
            label="Use a single top-level key as the root"
            checked={unwrapSingleKey}
            onChange={(e) => setUnwrapSingleKey(e.target.checked)}
          />
        </div>
        <p className="mt-3 text-sm text-muted">
          Keys starting with <code className="font-mono text-ink">@</code> become attributes, <code className="font-mono text-ink">#text</code>{" "}
          becomes the element&apos;s text, and arrays become repeated elements.
        </p>
      </Panel>

      {result && !result.ok ? (
        <Alert tone="error" title="Invalid JSON">
          <p>
            {result.error.message}
            {result.error.line ? ` at line ${result.error.line}, column ${result.error.column}.` : "."}
          </p>
          {result.error.line ? <SourceExcerpt text={source} line={result.error.line} column={result.error.column} /> : null}
        </Alert>
      ) : null}

      {renamed.length ? (
        <Alert tone="warning" title="Some keys were renamed">
          {renamed
            .slice(0, MAX_RENAMED_SHOWN)
            .map((r) => `"${r.from}" → <${r.to}>`)
            .join(", ")}
          {renamed.length > MAX_RENAMED_SHOWN ? ` and ${renamed.length - MAX_RENAMED_SHOWN} more` : ""}. XML names cannot contain spaces or
          most symbols, or start with a digit.
        </Alert>
      ) : null}

      <OutputBox
        value={result?.ok ? result.value.xml : ""}
        label="XML"
        filename="data.xml"
        mimeType="application/xml;charset=utf-8"
        mono
        rows={14}
      />
    </div>
  );
}
