"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { Marked } from "marked";
import { Checkbox } from "@/components/ui/field";
import { CopyButton, DownloadTextButton, ErrorText, Panel, Segmented, Spinner, TextInput, ToolColumns } from "@/components/tool-ui";
import { useTool } from "@/tools/context";
import { escapeHtml, sanitizeHtml } from "@/tools/lib/dev";
import { CodeBlock, OpenFileButton } from "@/tools/lib/dev-ui";

type View = "preview" | "html";

const DOCUMENT_STYLES = `body{max-width:46rem;margin:2rem auto;padding:0 1rem;font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1f2328}
pre{background:#f6f8fa;padding:1rem;border-radius:6px;overflow:auto}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em}
table{border-collapse:collapse}th,td{border:1px solid #d0d7de;padding:.4rem .75rem}blockquote{margin:0;padding-left:1rem;border-left:4px solid #d0d7de;color:#59636e}
img{max-width:100%}`;

function firstHeading(markdown: string): string {
  const match = /^#{1,6}\s+(.+?)\s*#*\s*$/m.exec(markdown);
  return match ? match[1] : "Document";
}

function toDocument(body: string, title: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${DOCUMENT_STYLES}
</style>
</head>
<body>
${body}
</body>
</html>
`;
}

export default function MarkdownToHtml() {
  const { track } = useTool();
  const [markdown, setMarkdown] = useState("");
  const [view, setView] = useState<View>("preview");
  const [breaks, setBreaks] = useState(false);
  const [safeOutput, setSafeOutput] = useState(true);
  const [fullDocument, setFullDocument] = useState(false);
  const [parser, setParser] = useState<Marked | null>(null);
  const [loadError, setLoadError] = useState("");
  const [fileError, setFileError] = useState("");
  const source = useDeferredValue(markdown);

  const needsParser = source.trim() !== "" && !parser;

  useEffect(() => {
    if (!needsParser) return;
    let cancelled = false;
    import("marked")
      .then(({ Marked }) => {
        if (!cancelled) setParser(new Marked({ gfm: true }));
      })
      .catch(() => {
        if (!cancelled) setLoadError("The Markdown converter could not be loaded. Check your connection and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [needsParser]);

  const rawHtml = useMemo(
    () => (parser && source.trim() ? parser.parse(source, { async: false, gfm: true, breaks }) : ""),
    [parser, source, breaks],
  );
  // The preview is always sanitised; the exported HTML is sanitised unless the user opts out.
  const previewHtml = useMemo(() => (rawHtml ? sanitizeHtml(rawHtml, { externalLinks: true }) : ""), [rawHtml]);
  const bodyHtml = useMemo(() => (safeOutput && rawHtml ? sanitizeHtml(rawHtml) : rawHtml).trim(), [rawHtml, safeOutput]);
  const outputHtml = bodyHtml && fullDocument ? toDocument(bodyHtml, firstHeading(source)) : bodyHtml;

  useEffect(() => {
    if (outputHtml) track();
  }, [outputHtml, track]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Checkbox label="Line breaks become <br>" checked={breaks} onChange={(e) => setBreaks(e.target.checked)} />
        <Checkbox label="Remove unsafe HTML from output" checked={safeOutput} onChange={(e) => setSafeOutput(e.target.checked)} />
        <Checkbox label="Full HTML document" checked={fullDocument} onChange={(e) => setFullDocument(e.target.checked)} />
      </div>

      <ErrorText>{fileError || loadError}</ErrorText>

      <ToolColumns>
        <TextInput
          value={markdown}
          onChange={setMarkdown}
          label="Markdown"
          placeholder={"# Hello\n\nWrite **Markdown** here.\n\n- [x] Task lists\n- Tables and `code`"}
          rows={20}
          mono
          actions={
            <OpenFileButton
              accept=".md,.markdown,.txt,text/markdown,text/plain"
              onText={(text) => {
                setFileError("");
                setMarkdown(text);
              }}
              onError={setFileError}
            />
          }
        />

        <Panel
          className="min-w-0"
          title="Output"
          actions={
            <>
              <CopyButton text={outputHtml} label="Copy HTML" />
              <DownloadTextButton text={outputHtml} filename="document.html" type="text/html;charset=utf-8" />
            </>
          }
        >
          <Segmented
            label="Output view"
            className="mb-3"
            value={view}
            onChange={setView}
            options={[
              { value: "preview", label: "Preview" },
              { value: "html", label: "HTML source" },
            ]}
          />
          {needsParser && !loadError ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Spinner />
              Loading…
            </p>
          ) : !previewHtml ? (
            <p className="text-sm text-muted">The {view === "preview" ? "preview" : "HTML"} will appear here as you type.</p>
          ) : view === "preview" ? (
            <div
              className="prose-tz max-h-[36rem] max-w-none overflow-auto break-words"
              // Safe: previewHtml has been through sanitizeHtml (allow-listed tags and attributes, no scripts or event handlers).
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          ) : (
            <CodeBlock code={outputHtml} label="Generated HTML" className="max-h-[36rem]" />
          )}
        </Panel>
      </ToolColumns>
    </div>
  );
}
