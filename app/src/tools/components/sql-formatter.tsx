"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { KeywordCase, SqlLanguage } from "sql-formatter";
import { Label, Select } from "@/components/ui/field";
import { ErrorText, OutputBox, Panel, Segmented, Spinner, TextInput } from "@/components/tool-ui";
import { useTool } from "@/tools/context";
import { errorMessage, minifySql } from "@/tools/lib/dev";
import { OpenFileButton } from "@/tools/lib/dev-ui";

type FormatFn = (typeof import("sql-formatter"))["format"];
type Mode = "format" | "minify";
type Indent = "2" | "4" | "tab";

const DIALECTS: Array<{ value: SqlLanguage; label: string }> = [
  { value: "sql", label: "Standard SQL" },
  { value: "mysql", label: "MySQL" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "sqlite", label: "SQLite" },
  { value: "mariadb", label: "MariaDB" },
  { value: "tsql", label: "SQL Server (T-SQL)" },
  { value: "plsql", label: "Oracle PL/SQL" },
  { value: "bigquery", label: "Google BigQuery" },
];

type Result = { ok: true; value: string } | { ok: false; error: string };

export default function SqlFormatter() {
  const { track } = useTool();
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("format");
  const [dialect, setDialect] = useState<SqlLanguage>("sql");
  const [keywordCase, setKeywordCase] = useState<KeywordCase>("upper");
  const [indent, setIndent] = useState<Indent>("2");
  const [formatter, setFormatter] = useState<FormatFn | null>(null);
  const [loadError, setLoadError] = useState("");
  const [fileError, setFileError] = useState("");
  const source = useDeferredValue(input);

  const needsFormatter = mode === "format" && source.trim() !== "" && !formatter;

  useEffect(() => {
    if (!needsFormatter) return;
    let cancelled = false;
    import("sql-formatter")
      .then((mod) => {
        if (!cancelled) setFormatter(() => mod.format);
      })
      .catch(() => {
        if (!cancelled) setLoadError("The SQL formatter could not be loaded. Check your connection and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [needsFormatter]);

  const result = useMemo<Result | null>(() => {
    if (!source.trim()) return null;
    if (mode === "minify") return { ok: true, value: minifySql(source) };
    if (!formatter) return null;
    try {
      return {
        ok: true,
        value: formatter(source, {
          language: dialect,
          keywordCase,
          tabWidth: indent === "4" ? 4 : 2,
          useTabs: indent === "tab",
        }),
      };
    } catch (error) {
      return { ok: false, error: errorMessage(error, "This query could not be formatted.") };
    }
  }, [source, mode, formatter, dialect, keywordCase, indent]);

  useEffect(() => {
    if (result?.ok) track();
  }, [result, track]);

  return (
    <div className="space-y-4">
      <TextInput
        value={input}
        onChange={setInput}
        label="SQL query"
        placeholder="select id, name from users where active = 1 order by name"
        rows={10}
        mono
        actions={
          <OpenFileButton
            accept=".sql,.txt,text/plain"
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
        <div className="space-y-4">
          <Segmented
            label="Action"
            value={mode}
            onChange={setMode}
            options={[
              { value: "format", label: "Format" },
              { value: "minify", label: "Minify" },
            ]}
          />
          {mode === "format" ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="sql-dialect">Dialect</Label>
                <Select id="sql-dialect" value={dialect} onChange={(e) => setDialect(e.target.value as SqlLanguage)}>
                  {DIALECTS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="sql-keyword-case">Keyword case</Label>
                <Select id="sql-keyword-case" value={keywordCase} onChange={(e) => setKeywordCase(e.target.value as KeywordCase)}>
                  <option value="upper">UPPERCASE</option>
                  <option value="lower">lowercase</option>
                  <option value="preserve">Keep as typed</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="sql-indent">Indentation</Label>
                <Select id="sql-indent" value={indent} onChange={(e) => setIndent(e.target.value as Indent)}>
                  <option value="2">2 spaces</option>
                  <option value="4">4 spaces</option>
                  <option value="tab">Tab</option>
                </Select>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Removes comments and line breaks and puts the query on a single line. Strings are left untouched.</p>
          )}
        </div>
      </Panel>

      <ErrorText>{loadError}</ErrorText>
      {result && !result.ok ? <ErrorText>{result.error}</ErrorText> : null}
      {needsFormatter && !loadError ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner />
          Loading the formatter…
        </p>
      ) : null}

      <OutputBox
        value={result?.ok ? result.value : ""}
        label={mode === "format" ? "Formatted SQL" : "Minified SQL"}
        filename={mode === "format" ? "formatted.sql" : "minified.sql"}
        mono
        rows={14}
      />
    </div>
  );
}
