"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { CopyButton, ErrorText, Panel, Segmented, Stat, StatGrid, TextInput } from "@/components/tool-ui";
import { downloadText } from "@/lib/files";
import { useTool } from "@/tools/context";
import { cellText, extractRecords, parseJsonStrict, recordsToTable, stringifyCsv, type CsvDelimiter, type Table } from "@/tools/lib/dev";
import { OpenFileButton } from "@/tools/lib/dev-ui";

const PREVIEW_ROWS = 10;
const BOM = String.fromCharCode(0xfeff);

type Conversion = { ok: true; table: Table; csv: string } | { ok: false; error: string };

function convert(text: string, delimiter: CsvDelimiter, includeHeader: boolean): Conversion {
  try {
    const records = extractRecords(parseJsonStrict(text));
    if (!records.length) return { ok: false, error: "The JSON array is empty, so there is nothing to convert." };
    const table = recordsToTable(records);
    return { ok: true, table, csv: stringifyCsv(table, delimiter, includeHeader) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "The JSON could not be converted." };
  }
}

export default function JsonToCsv() {
  const { track } = useTool();
  const [input, setInput] = useState("");
  const [delimiter, setDelimiter] = useState<CsvDelimiter>(",");
  const [includeHeader, setIncludeHeader] = useState(true);
  const [excelBom, setExcelBom] = useState(true);
  const [fileError, setFileError] = useState("");
  const source = useDeferredValue(input);

  const result = useMemo(
    () => (source.trim() ? convert(source, delimiter, includeHeader) : null),
    [source, delimiter, includeHeader],
  );

  useEffect(() => {
    if (result?.ok) track();
  }, [result, track]);

  const csv = result?.ok ? result.csv : "";

  return (
    <div className="space-y-4">
      <TextInput
        value={input}
        onChange={setInput}
        label="JSON input"
        placeholder={'[\n  { "name": "Ada", "address": { "city": "London" } },\n  { "name": "Linus", "address": { "city": "Helsinki" } }\n]'}
        rows={10}
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
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-ink">Delimiter</span>
            <Segmented
              label="Delimiter"
              value={delimiter}
              onChange={setDelimiter}
              options={[
                { value: ",", label: "Comma" },
                { value: ";", label: "Semicolon" },
                { value: "\t", label: "Tab" },
              ]}
            />
          </div>
          <Checkbox label="Include header row" checked={includeHeader} onChange={(e) => setIncludeHeader(e.target.checked)} />
          <Checkbox label="Excel-friendly download (UTF-8 BOM)" checked={excelBom} onChange={(e) => setExcelBom(e.target.checked)} />
        </div>
      </Panel>

      {result && !result.ok ? <ErrorText>{result.error}</ErrorText> : null}

      {result?.ok ? (
        <>
          <StatGrid>
            <Stat label="Rows" value={result.table.rows.length.toLocaleString()} emphasis />
            <Stat label="Columns" value={result.table.headers.length.toLocaleString()} emphasis />
          </StatGrid>

          <Panel title={`Preview (first ${Math.min(PREVIEW_ROWS, result.table.rows.length)} rows)`}>
            <div className="overflow-x-auto rounded-lg border border-line" tabIndex={0} role="region" aria-label="CSV preview">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-paper">
                  <tr>
                    {result.table.headers.map((h) => (
                      <th key={h} scope="col" className="border-b border-line px-3 py-2 font-mono text-xs font-semibold whitespace-nowrap text-ink">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.table.rows.slice(0, PREVIEW_ROWS).map((row, r) => (
                    <tr key={r} className="border-b border-line last:border-0">
                      {row.map((cell, c) => (
                        <td key={c} className="max-w-64 truncate px-3 py-2 text-ink" title={cellText(cell)}>
                          {cell === null ? <span className="text-muted">—</span> : cellText(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      ) : null}

      <Panel
        title="CSV output"
        actions={
          <>
            <CopyButton text={csv} />
            <Button
              size="sm"
              variant="outline"
              disabled={!csv}
              onClick={() => downloadText(excelBom ? BOM + csv : csv, "data.csv", "text/csv;charset=utf-8")}
            >
              <Download aria-hidden />
              Download .csv
            </Button>
          </>
        }
      >
        <textarea
          readOnly
          value={csv}
          rows={10}
          aria-label="CSV output"
          placeholder="The CSV will appear here."
          className="w-full resize-y rounded-lg border border-line bg-paper px-3 py-2.5 font-mono text-[13px] text-ink focus:outline-none"
        />
      </Panel>
    </div>
  );
}
