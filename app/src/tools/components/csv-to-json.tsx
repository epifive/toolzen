"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Checkbox, Label, Select } from "@/components/ui/field";
import { ErrorText, OutputBox, Panel, Segmented, Stat, StatGrid, TextInput } from "@/components/tool-ui";
import { useTool } from "@/tools/context";
import { CSV_DELIMITERS, csvRowsToJson, detectDelimiter, errorMessage, parseCsv, type CsvDelimiter } from "@/tools/lib/dev";
import { OpenFileButton } from "@/tools/lib/dev-ui";

type DelimiterChoice = "auto" | CsvDelimiter;
type Shape = "objects" | "arrays";

const DELIMITER_NAMES: Record<CsvDelimiter, string> = { ",": "comma", ";": "semicolon", "\t": "tab", "|": "pipe" };

type Conversion =
  | { ok: true; json: string; rows: number; columns: number; delimiter: CsvDelimiter }
  | { ok: false; error: string };

export default function CsvToJson() {
  const { track } = useTool();
  const [input, setInput] = useState("");
  const [delimiterChoice, setDelimiterChoice] = useState<DelimiterChoice>("auto");
  const [header, setHeader] = useState(true);
  const [infer, setInfer] = useState(true);
  const [shape, setShape] = useState<Shape>("objects");
  const [fileError, setFileError] = useState("");
  const source = useDeferredValue(input);

  const result = useMemo<Conversion | null>(() => {
    if (!source.trim()) return null;
    const delimiter = delimiterChoice === "auto" ? detectDelimiter(source) : delimiterChoice;
    try {
      const rows = parseCsv(source, delimiter);
      const data = csvRowsToJson(rows, { header, infer, shape });
      return {
        ok: true,
        json: JSON.stringify(data, null, 2),
        rows: header ? Math.max(0, rows.length - 1) : rows.length,
        columns: rows.reduce((max, r) => Math.max(max, r.length), 0),
        delimiter,
      };
    } catch (error) {
      return { ok: false, error: errorMessage(error, "The CSV could not be read.") };
    }
  }, [source, delimiterChoice, header, infer, shape]);

  useEffect(() => {
    if (result?.ok && result.rows) track();
  }, [result, track]);

  return (
    <div className="space-y-4">
      <TextInput
        value={input}
        onChange={setInput}
        label="CSV input"
        placeholder={'name,age,city\nAda,36,London\n"Torvalds, Linus",54,Helsinki'}
        rows={10}
        mono
        actions={
          <OpenFileButton
            accept=".csv,.tsv,.txt,text/csv,text/plain"
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="csv-delimiter">Delimiter</Label>
            <Select id="csv-delimiter" value={delimiterChoice} onChange={(e) => setDelimiterChoice(e.target.value as DelimiterChoice)}>
              <option value="auto">
                {result?.ok && delimiterChoice === "auto" ? `Auto-detect (${DELIMITER_NAMES[result.delimiter]})` : "Auto-detect"}
              </option>
              {CSV_DELIMITERS.map((d) => (
                <option key={d.label} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Output</p>
            <Segmented
              label="Output shape"
              value={shape}
              onChange={setShape}
              options={[
                { value: "objects", label: "Array of objects" },
                { value: "arrays", label: "Array of arrays" },
              ]}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          <Checkbox label="First row is the header" checked={header} onChange={(e) => setHeader(e.target.checked)} />
          <Checkbox label="Convert numbers, true/false and null" checked={infer} onChange={(e) => setInfer(e.target.checked)} />
        </div>
      </Panel>

      {result && !result.ok ? <ErrorText>{result.error}</ErrorText> : null}

      {result?.ok ? (
        <StatGrid>
          <Stat label="Records" value={result.rows.toLocaleString()} emphasis />
          <Stat label="Columns" value={result.columns.toLocaleString()} emphasis />
        </StatGrid>
      ) : null}

      <OutputBox value={result?.ok ? result.json : ""} label="JSON output" filename="data.json" mono rows={14} />
    </div>
  );
}
