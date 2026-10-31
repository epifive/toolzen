"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Eraser, FileInput, Plus, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, Label, Textarea } from "@/components/ui/field";
import { OutputBox, Panel, Segmented } from "@/components/tool-ui";
import { cn, uid } from "@/lib/utils";
import { useTool } from "@/tools/context";
import { detectDelimiter, parseCsv } from "@/tools/lib/dev";
import { toHtmlTable, toMarkdownTable, type ColumnAlign, type TableData } from "@/tools/lib/markdown-table";

interface Column {
  id: string;
  header: string;
  align: ColumnAlign;
}

interface Row {
  id: string;
  cells: string[];
}

type Output = "markdown" | "html";

const MAX_COLUMNS = 30;
const MAX_ROWS = 500;

const ALIGN_LABELS: Record<ColumnAlign, string> = { none: "Default", left: "Left", center: "Center", right: "Right" };
const ALIGN_CLASSES: Record<ColumnAlign, string> = { none: "text-left", left: "text-left", center: "text-center", right: "text-right" };

const SAMPLE_HEADERS = ["Tool", "Category", "Price"];
const SAMPLE_ROWS = [
  ["JSON Formatter", "Developer", "Free"],
  ["Image Compressor", "Image", "Free"],
  ["PDF Merge", "PDF", "Pro"],
];

const makeColumns = (headers: string[]): Column[] => headers.map((header) => ({ id: uid(), header, align: "none" }));
const makeRows = (rows: string[][], width: number): Row[] =>
  rows.map((cells) => ({ id: uid(), cells: Array.from({ length: width }, (_, i) => cells[i] ?? "") }));

export default function MarkdownTableGenerator() {
  const { track } = useTool();
  const importId = useId();
  const [columns, setColumns] = useState<Column[]>(() => makeColumns(SAMPLE_HEADERS));
  const [rows, setRows] = useState<Row[]>(() => makeRows(SAMPLE_ROWS, SAMPLE_HEADERS.length));
  const [output, setOutput] = useState<Output>("markdown");
  const [pad, setPad] = useState(true);
  const [importText, setImportText] = useState("");
  const [importHeader, setImportHeader] = useState(true);
  const [importNote, setImportNote] = useState("");

  const data = useMemo<TableData>(
    () => ({ headers: columns.map((c) => c.header), aligns: columns.map((c) => c.align), rows: rows.map((r) => r.cells) }),
    [columns, rows],
  );
  const text = useMemo(() => (output === "markdown" ? toMarkdownTable(data, pad) : toHtmlTable(data)), [data, output, pad]);

  useEffect(() => {
    track();
  }, [text, track]);

  const updateColumn = (index: number, patch: Partial<Column>) =>
    setColumns((current) => current.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  const updateCell = (rowIndex: number, columnIndex: number, value: string) =>
    setRows((current) =>
      current.map((row, r) => (r === rowIndex ? { ...row, cells: row.cells.map((cell, c) => (c === columnIndex ? value : cell)) } : row)),
    );

  function addColumn() {
    if (columns.length >= MAX_COLUMNS) return;
    setColumns((current) => [...current, { id: uid(), header: `Column ${current.length + 1}`, align: "none" }]);
    setRows((current) => current.map((row) => ({ ...row, cells: [...row.cells, ""] })));
  }

  function removeColumn(index: number) {
    if (columns.length <= 1) return;
    setColumns((current) => current.filter((_, i) => i !== index));
    setRows((current) => current.map((row) => ({ ...row, cells: row.cells.filter((_, i) => i !== index) })));
  }

  function addRow() {
    if (rows.length >= MAX_ROWS) return;
    setRows((current) => [...current, { id: uid(), cells: columns.map(() => "") }]);
  }

  function removeRow(index: number) {
    if (rows.length <= 1) return;
    setRows((current) => current.filter((_, i) => i !== index));
  }

  function clearCells() {
    setRows((current) => current.map((row) => ({ ...row, cells: row.cells.map(() => "") })));
  }

  function importData() {
    const parsed = parseCsv(importText, detectDelimiter(importText), { strict: false }).filter((row) => row.some((cell) => cell.trim()));
    if (!parsed.length) {
      setImportNote("No rows were found. Paste CSV, TSV or data copied from a spreadsheet.");
      return;
    }
    const width = Math.min(MAX_COLUMNS, Math.max(...parsed.map((row) => row.length)));
    const headers = importHeader
      ? Array.from({ length: width }, (_, i) => parsed[0][i] ?? `Column ${i + 1}`)
      : Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
    const body = (importHeader ? parsed.slice(1) : parsed).slice(0, MAX_ROWS);
    setColumns(makeColumns(headers));
    setRows(body.length ? makeRows(body, width) : makeRows([[]], width));
    const total = importHeader ? parsed.length - 1 : parsed.length;
    const clipped = total > MAX_ROWS || Math.max(...parsed.map((row) => row.length)) > MAX_COLUMNS;
    setImportNote(
      `Imported ${body.length.toLocaleString()} row${body.length === 1 ? "" : "s"} and ${width} column${width === 1 ? "" : "s"}.` +
        (clipped ? ` Tables are limited to ${MAX_ROWS} rows and ${MAX_COLUMNS} columns.` : ""),
    );
  }

  return (
    <div className="space-y-4">
      <Panel
        title="Table"
        actions={
          <Button size="sm" variant="ghost" onClick={clearCells}>
            <Eraser aria-hidden />
            Clear cells
          </Button>
        }
      >
        <div className="overflow-x-auto pb-1">
          <table className="border-separate border-spacing-1">
            <thead>
              <tr>
                {columns.map((column, ci) => (
                  <th key={column.id} scope="col" className="min-w-[9rem] align-top font-normal">
                    <div className="flex items-center gap-1">
                      <input
                        value={column.header}
                        onChange={(e) => updateColumn(ci, { header: e.target.value })}
                        aria-label={`Column ${ci + 1} header`}
                        className="h-9 w-full min-w-0 rounded-md border border-line bg-primary-soft px-2 text-sm font-semibold text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <button
                        type="button"
                        onClick={() => removeColumn(ci)}
                        disabled={columns.length <= 1}
                        aria-label={`Remove column ${ci + 1}`}
                        className="rounded-md p-1 text-muted hover:bg-primary-soft hover:text-ink disabled:opacity-40"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </div>
                    <select
                      value={column.align}
                      onChange={(e) => updateColumn(ci, { align: e.target.value as ColumnAlign })}
                      aria-label={`Column ${ci + 1} alignment`}
                      className="mt-1 h-8 w-full rounded-md border border-line bg-surface px-1.5 text-xs text-ink focus:border-primary focus:outline-none"
                    >
                      {(Object.keys(ALIGN_LABELS) as ColumnAlign[]).map((align) => (
                        <option key={align} value={align}>
                          {ALIGN_LABELS[align]}
                        </option>
                      ))}
                    </select>
                  </th>
                ))}
                <th scope="col" className="align-top">
                  <span className="sr-only">Row actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={row.id}>
                  {row.cells.map((cell, ci) => (
                    <td key={columns[ci]?.id ?? ci}>
                      <input
                        value={cell}
                        onChange={(e) => updateCell(ri, ci, e.target.value)}
                        aria-label={`Row ${ri + 1}, ${columns[ci]?.header || `column ${ci + 1}`}`}
                        className={cn(
                          "h-9 w-full min-w-[9rem] rounded-md border border-line bg-surface px-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
                          ALIGN_CLASSES[columns[ci]?.align ?? "none"],
                        )}
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      type="button"
                      onClick={() => removeRow(ri)}
                      disabled={rows.length <= 1}
                      aria-label={`Remove row ${ri + 1}`}
                      className="rounded-md p-1.5 text-muted hover:bg-primary-soft hover:text-ink disabled:opacity-40"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={addRow} disabled={rows.length >= MAX_ROWS}>
            <Plus aria-hidden />
            Add row
          </Button>
          <Button size="sm" variant="outline" onClick={addColumn} disabled={columns.length >= MAX_COLUMNS}>
            <Plus aria-hidden />
            Add column
          </Button>
        </div>
      </Panel>

      <Panel title="Import CSV or spreadsheet data">
        <Label htmlFor={importId}>Paste CSV, TSV or cells copied from Excel or Google Sheets</Label>
        <Textarea
          id={importId}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={4}
          spellCheck={false}
          className="font-mono text-[13px]"
          placeholder={"Name,Role,City\nAda,Engineer,London"}
        />
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Checkbox label="First row is the header" checked={importHeader} onChange={(e) => setImportHeader(e.target.checked)} />
          <Button size="sm" onClick={importData} disabled={!importText.trim()}>
            <FileInput aria-hidden />
            Import (replaces the table)
          </Button>
        </div>
        {importNote ? (
          <Alert tone="info" className="mt-3">
            {importNote}
          </Alert>
        ) : null}
      </Panel>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Segmented
          label="Output format"
          value={output}
          onChange={setOutput}
          options={[
            { value: "markdown", label: "Markdown" },
            { value: "html", label: "HTML" },
          ]}
        />
        {output === "markdown" ? <Checkbox label="Line up columns in the source" checked={pad} onChange={(e) => setPad(e.target.checked)} /> : null}
      </div>

      <OutputBox
        value={text}
        label={output === "markdown" ? "Markdown table" : "HTML table"}
        filename={output === "markdown" ? "table.md" : "table.html"}
        mimeType={output === "markdown" ? "text/markdown;charset=utf-8" : "text/html;charset=utf-8"}
        mono
        rows={Math.min(16, rows.length + 4)}
      />

      <Panel title="Preview">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.id} scope="col" className={cn("border border-line bg-paper px-3 py-2 font-semibold text-ink", ALIGN_CLASSES[column.align])}>
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {row.cells.map((cell, ci) => (
                    <td
                      key={columns[ci]?.id ?? ci}
                      className={cn("border border-line px-3 py-2 whitespace-pre-wrap text-ink", ALIGN_CLASSES[columns[ci]?.align ?? "none"])}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
