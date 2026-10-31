"use client";

import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import { ArrowDownUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Label, Select } from "@/components/ui/field";
import { ErrorText, OutputBox, Panel, Segmented, TextInput } from "@/components/tool-ui";
import { useTool } from "@/tools/context";
import { decodeHtmlEntities, encodeHtmlEntities, errorMessage } from "@/tools/lib/dev";
import {
  escapeCsvField,
  escapeJsonString,
  escapeJsString,
  escapeRegexLiteral,
  escapeSqlString,
  escapeXml,
  unescapeCsvField,
  unescapeJsonString,
  unescapeJsString,
  unescapeRegexLiteral,
  unescapeSqlString,
  unescapeXml,
  type JsQuote,
} from "@/tools/lib/escape";

type Format = "json" | "javascript" | "html" | "xml" | "csv" | "sql" | "regex";
type Direction = "escape" | "unescape";

interface Options {
  asciiOnly: boolean;
  quote: JsQuote;
  delimiter: string;
  alwaysQuote: boolean;
  backslashes: boolean;
}

const FORMATS: Array<{ value: Format; label: string; note: string }> = [
  { value: "json", label: "JSON string", note: 'Escapes quotes, backslashes and control characters as \\", \\\\, \\n, \\t and \\uXXXX.' },
  { value: "javascript", label: "JavaScript string", note: "Escapes the chosen quote, backslashes, line breaks and invisible characters for a JS string literal." },
  { value: "html", label: "HTML", note: "Converts & < > \" ' to entities. Unescaping decodes every named and numeric HTML entity." },
  { value: "xml", label: "XML", note: "Converts & < > \" ' to &amp; &lt; &gt; &quot; &apos;. Unescaping also decodes &#…; references." },
  { value: "csv", label: "CSV field", note: "Wraps the field in double quotes when needed and doubles any quotes inside it." },
  { value: "sql", label: "SQL string", note: "Doubles single quotes for a '…' literal. Use parameterised queries in real code." },
  { value: "regex", label: "Regular expression", note: "Escapes . * + ? ^ $ { } ( ) | [ ] \\ / so the text matches literally." },
];

function run(text: string, format: Format, direction: Direction, o: Options): string {
  const escape = direction === "escape";
  switch (format) {
    case "json":
      return escape ? escapeJsonString(text, o.asciiOnly) : unescapeJsonString(text);
    case "javascript":
      return escape ? escapeJsString(text, o.quote, o.asciiOnly) : unescapeJsString(text);
    case "html":
      return escape ? encodeHtmlEntities(text, o.asciiOnly) : decodeHtmlEntities(text);
    case "xml":
      return escape ? escapeXml(text) : unescapeXml(text);
    case "csv":
      return escape ? escapeCsvField(text, o.delimiter, o.alwaysQuote) : unescapeCsvField(text);
    case "sql":
      return escape ? escapeSqlString(text, o.backslashes) : unescapeSqlString(text, o.backslashes);
    case "regex":
      return escape ? escapeRegexLiteral(text) : unescapeRegexLiteral(text);
  }
}

type Result = { ok: true; value: string } | { ok: false; error: string };

export default function StringEscapeUnescape() {
  const { track } = useTool();
  const formatId = useId();
  const quoteId = useId();
  const delimiterId = useId();
  const [input, setInput] = useState("");
  const [format, setFormat] = useState<Format>("json");
  const [direction, setDirection] = useState<Direction>("escape");
  const [options, setOptions] = useState<Options>({ asciiOnly: false, quote: '"', delimiter: ",", alwaysQuote: false, backslashes: false });
  const source = useDeferredValue(input);

  const result = useMemo<Result | null>(() => {
    if (!source) return null;
    try {
      return { ok: true, value: run(source, format, direction, options) };
    } catch (error) {
      return { ok: false, error: errorMessage(error, "The text could not be converted.") };
    }
  }, [source, format, direction, options]);

  useEffect(() => {
    if (result?.ok) track();
  }, [result, track]);

  const update = (patch: Partial<Options>) => setOptions((current) => ({ ...current, ...patch }));
  const output = result?.ok ? result.value : "";
  const details = FORMATS.find((f) => f.value === format) ?? FORMATS[0];
  const verb = direction === "escape" ? "Escaped" : "Unescaped";

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <div className="w-full sm:w-56">
            <Label htmlFor={formatId}>Format</Label>
            <Select id={formatId} value={format} onChange={(e) => setFormat(e.target.value as Format)}>
              {FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </div>
          <Segmented
            label="Direction"
            value={direction}
            onChange={setDirection}
            options={[
              { value: "escape", label: "Escape" },
              { value: "unescape", label: "Unescape" },
            ]}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
          {format === "javascript" && direction === "escape" ? (
            <div className="w-full sm:w-52">
              <Label htmlFor={quoteId}>String quotes</Label>
              <Select id={quoteId} value={options.quote} onChange={(e) => update({ quote: e.target.value as JsQuote })}>
                <option value={'"'}>&quot;double&quot;</option>
                <option value="'">&apos;single&apos;</option>
                <option value="`">`template`</option>
              </Select>
            </div>
          ) : null}
          {format === "csv" && direction === "escape" ? (
            <>
              <div className="w-full sm:w-44">
                <Label htmlFor={delimiterId}>Delimiter</Label>
                <Select id={delimiterId} value={options.delimiter} onChange={(e) => update({ delimiter: e.target.value })}>
                  <option value=",">Comma (,)</option>
                  <option value=";">Semicolon (;)</option>
                  <option value={"\t"}>Tab</option>
                  <option value="|">Pipe (|)</option>
                </Select>
              </div>
              <Checkbox label="Always add quotes" checked={options.alwaysQuote} onChange={(e) => update({ alwaysQuote: e.target.checked })} className="pb-2.5" />
            </>
          ) : null}
          {(format === "json" || format === "javascript" || format === "html") && direction === "escape" ? (
            <Checkbox
              label={format === "html" ? "Encode non-ASCII characters as &#…;" : "Escape non-ASCII characters"}
              checked={options.asciiOnly}
              onChange={(e) => update({ asciiOnly: e.target.checked })}
              className="pb-2.5"
            />
          ) : null}
          {format === "sql" ? (
            <Checkbox
              label="MySQL backslash escapes"
              checked={options.backslashes}
              onChange={(e) => update({ backslashes: e.target.checked })}
              className="pb-2.5"
            />
          ) : null}
        </div>
        <p className="mt-3 text-sm text-muted">{details.note}</p>
      </Panel>

      <TextInput
        value={input}
        onChange={setInput}
        label={direction === "escape" ? "Text to escape" : "Text to unescape"}
        placeholder={direction === "escape" ? 'Line one\nShe said "hello" & left' : String.raw`Line one\nShe said \"hello\"`}
        rows={8}
        mono
      />

      {result && !result.ok ? <ErrorText>{result.error}</ErrorText> : null}

      <OutputBox value={output} label={`${verb} text`} filename={`${direction}d.txt`} mono rows={8} />

      <Button
        variant="outline"
        disabled={!output}
        onClick={() => {
          setInput(output);
          setDirection(direction === "escape" ? "unescape" : "escape");
        }}
      >
        <ArrowDownUp aria-hidden />
        Use output as input and {direction === "escape" ? "unescape" : "escape"}
      </Button>
    </div>
  );
}
