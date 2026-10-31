"use client";

import { useEffect, useMemo, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/field";
import { CopyButton, DownloadTextButton, ErrorText, Panel, Stat, StatGrid } from "@/components/tool-ui";
import { renameExtension } from "@/lib/files";
import { useTool } from "@/tools/context";
import { nextFrame, pdfErrorMessage } from "@/tools/lib/pdf";
import { PdfFilePicker, Progress, usePdfFile, type LoadedPdf } from "@/tools/lib/pdf-file";

/** Plain text of one page. pdf.js marks the end of each visual line with `hasEOL`. */
async function readPageText(doc: PDFDocumentProxy, pageNumber: number): Promise<string> {
  const page = await doc.getPage(pageNumber);
  try {
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      text += item.str;
      if (item.hasEOL) text += "\n";
    }
    return text
      .split("\n")
      .map((line) => line.replace(/\s+$/, ""))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } finally {
    page.cleanup();
  }
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function TextWorkspace({ pdf, preview }: { pdf: LoadedPdf; preview: PDFDocumentProxy }) {
  const { track } = useTool();
  const [pages, setPages] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [markers, setMarkers] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function extract() {
      const texts: string[] = [];
      for (let n = 1; n <= preview.numPages; n++) {
        texts.push(await readPageText(preview, n));
        if (cancelled) return;
        setPages([...texts]);
        // Let the page paint between pages so long documents show progress.
        await nextFrame();
      }
      if (cancelled) return;
      setDone(true);
      track();
    }
    extract().catch((e: unknown) => {
      if (!cancelled) setError(pdfErrorMessage(e, "The text could not be extracted from this PDF."));
    });
    return () => {
      cancelled = true;
    };
  }, [preview, track]);

  const fullText = useMemo(
    () =>
      pages
        .map((text, i) => (markers ? `--- Page ${i + 1} ---\n\n${text}` : text))
        .filter(Boolean)
        .join("\n\n"),
    [pages, markers],
  );
  const words = useMemo(() => pages.reduce((sum, text) => sum + countWords(text), 0), [pages]);
  const characters = useMemo(() => pages.reduce((sum, text) => sum + text.length, 0), [pages]);
  const empty = done && characters === 0;

  if (error) return <ErrorText>{error}</ErrorText>;

  return (
    <>
      {!done ? (
        <Progress>
          Extracting text… page {Math.min(pages.length + 1, pdf.pageCount)} of {pdf.pageCount}
        </Progress>
      ) : null}

      {empty ? (
        <Alert tone="warning" title="No text found in this PDF">
          It is probably a scanned document, which stores each page as a picture. Pictures of text can only be read with OCR
          software.
        </Alert>
      ) : null}

      {done && !empty ? (
        <>
          <StatGrid>
            <Stat label="Pages" value={pdf.pageCount.toLocaleString()} />
            <Stat label="Words" value={words.toLocaleString()} />
            <Stat label="Characters" value={characters.toLocaleString()} />
          </StatGrid>
          <div className="flex flex-wrap items-center gap-3">
            <CopyButton text={fullText} label="Copy all text" size="md" variant="primary" />
            <DownloadTextButton text={fullText} filename={renameExtension(pdf.file.name, "txt")} label="Download .txt" />
            <Checkbox label="Include page markers" checked={markers} onChange={(e) => setMarkers(e.target.checked)} />
          </div>
        </>
      ) : null}

      {!empty
        ? pages.map((text, i) => (
            <Panel key={i} title={`Page ${i + 1}`} actions={text ? <CopyButton text={text} /> : null}>
              {text ? (
                <pre className="max-h-96 overflow-auto font-sans text-sm leading-relaxed break-words whitespace-pre-wrap text-ink">
                  {text}
                </pre>
              ) : (
                <p className="text-sm text-muted">No text on this page. It may contain only images or a scanned picture.</p>
              )}
            </Panel>
          ))
        : null}
    </>
  );
}

export default function PdfToText() {
  const state = usePdfFile({ preview: true });
  const { pdf } = state;
  return (
    <div className="space-y-4">
      <PdfFilePicker state={state} />
      {pdf?.preview ? <TextWorkspace key={pdf.id} pdf={pdf} preview={pdf.preview} /> : null}
    </div>
  );
}
