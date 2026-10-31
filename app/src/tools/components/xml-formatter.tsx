"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/field";
import { ErrorText, OutputBox, Panel, Segmented, Stat, StatGrid, TextInput } from "@/components/tool-ui";
import { formatBytes } from "@/lib/utils";
import { useTool } from "@/tools/context";
import { errorMessage, utf8Length } from "@/tools/lib/dev";
import { OpenFileButton } from "@/tools/lib/dev-ui";
import { SourceExcerpt } from "@/tools/lib/source-excerpt";
import { formatXml, minifyXml, parseXml, XmlSyntaxError, type XmlErrorInfo, type XmlIndent } from "@/tools/lib/xml";

type Mode = "format" | "minify" | "validate";

type Result = { ok: true; output: string; elements: number } | { ok: false; error: XmlErrorInfo };

const PLACEHOLDER = '<note priority="high"><to>Ada</to><from>Linus</from><body>Ship it!</body></note>';

function run(text: string, mode: Mode, indent: XmlIndent, removeComments: boolean): Result {
  const parsed = parseXml(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const elements = parsed.doc.getElementsByTagName("*").length;
  try {
    const output =
      mode === "validate" ? "" : mode === "minify" ? minifyXml(text, { removeComments }) : formatXml(text, { indent, removeComments });
    return { ok: true, output, elements };
  } catch (error) {
    if (error instanceof XmlSyntaxError) return { ok: false, error: { message: error.reason, ...error.position } };
    return { ok: false, error: { message: errorMessage(error, "The XML could not be processed") } };
  }
}

export default function XmlFormatter() {
  const { track } = useTool();
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("format");
  const [indent, setIndent] = useState<XmlIndent>("2");
  const [removeComments, setRemoveComments] = useState(false);
  const [fileError, setFileError] = useState("");
  const source = useDeferredValue(input);

  const result = useMemo<Result | null>(
    () => (source.trim() ? run(source, mode, indent, removeComments) : null),
    [source, mode, indent, removeComments],
  );

  useEffect(() => {
    if (result?.ok) track();
  }, [result, track]);

  const output = result?.ok ? result.output : "";

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
            accept=".xml,.svg,.rss,.atom,.xsd,.xsl,.xslt,.plist,.config,.csproj,.wsdl,application/xml,text/xml"
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
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Action</p>
            <Segmented
              label="Action"
              value={mode}
              onChange={setMode}
              options={[
                { value: "format", label: "Format" },
                { value: "minify", label: "Minify" },
                { value: "validate", label: "Validate only" },
              ]}
            />
          </div>
          {mode === "format" ? (
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Indentation</p>
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
          ) : null}
          {mode !== "validate" ? (
            <Checkbox label="Remove comments" checked={removeComments} onChange={(e) => setRemoveComments(e.target.checked)} className="pb-2" />
          ) : null}
        </div>
        <p className="mt-3 text-sm text-muted">
          {mode === "minify"
            ? "Removes whitespace between tags and indentation around text. Text, CDATA and xml:space=\"preserve\" elements are kept."
            : "Text-only elements stay on one line, and elements with xml:space=\"preserve\" are copied exactly as written."}
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

      {result?.ok ? (
        <Alert tone="success" title="Well-formed XML">
          {result.elements.toLocaleString()} element{result.elements === 1 ? "" : "s"}, {formatBytes(utf8Length(source))}.
        </Alert>
      ) : null}

      {result?.ok && mode === "minify" && output ? (
        <StatGrid>
          <Stat label="Original size" value={formatBytes(utf8Length(source))} />
          <Stat label="Minified size" value={formatBytes(utf8Length(output))} />
          <Stat label="Saved" value={`${(Math.max(0, 1 - utf8Length(output) / utf8Length(source)) * 100).toFixed(1)}%`} emphasis />
        </StatGrid>
      ) : null}

      {mode !== "validate" ? (
        <OutputBox
          value={output}
          label={mode === "minify" ? "Minified XML" : "Formatted XML"}
          filename={mode === "minify" ? "minified.xml" : "formatted.xml"}
          mimeType="application/xml;charset=utf-8"
          mono
          rows={14}
        />
      ) : null}
    </div>
  );
}
