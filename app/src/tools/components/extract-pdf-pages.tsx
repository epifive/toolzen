"use client";

import { useState } from "react";
import { FileOutput } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { ErrorText, Panel } from "@/components/tool-ui";
import { downloadBlob, withSuffix } from "@/lib/files";
import { useTool } from "@/tools/context";
import { copyPagesToNewPdf, openPdf, pdfErrorMessage, savePdf } from "@/tools/lib/pdf";
import { DownloadResult, PdfFilePicker, Progress, usePdfFile, type LoadedPdf, type OutputFile } from "@/tools/lib/pdf-file";
import { PageSelectionControls, PdfPageGrid } from "@/tools/lib/pdf-page-grid";

function ExtractWorkspace({ pdf, preview }: { pdf: LoadedPdf; preview: PDFDocumentProxy }) {
  const { track } = useTool();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OutputFile | null>(null);

  function select(next: Set<number>) {
    setSelected(next);
    setResult(null);
    setError("");
  }

  async function extract() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const source = await openPdf(pdf.bytes);
      const doc = await copyPagesToNewPdf(source, [...selected].sort((a, b) => a - b));
      const output = { blob: await savePdf(doc), name: withSuffix(pdf.file.name, "-extracted") };
      setResult(output);
      downloadBlob(output.blob, output.name);
      track();
    } catch (e) {
      setError(pdfErrorMessage(e, "The pages could not be extracted. Check that the PDF opens in a PDF reader."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Panel title="Choose the pages to keep">
        <div className="space-y-4">
          <PageSelectionControls
            pageCount={pdf.pageCount}
            selected={selected}
            onSelectedChange={select}
            disabled={busy}
          />
          <PdfPageGrid doc={preview} selected={selected} onSelectedChange={select} label="Pages to extract" disabled={busy} />
        </div>
      </Panel>

      <ErrorText>{error}</ErrorText>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={extract} disabled={busy || selected.size === 0}>
          <FileOutput aria-hidden />
          {selected.size
            ? `Extract ${selected.size} page${selected.size === 1 ? "" : "s"}`
            : "Select the pages to extract"}
        </Button>
        {busy ? <Progress>Creating the new PDF…</Progress> : null}
      </div>

      {result ? <DownloadResult result={result} /> : null}
    </>
  );
}

export default function ExtractPdfPages() {
  const state = usePdfFile({ preview: true });
  const { pdf } = state;
  return (
    <div className="space-y-4">
      <PdfFilePicker state={state} />
      {pdf?.preview ? <ExtractWorkspace key={pdf.id} pdf={pdf} preview={pdf.preview} /> : null}
    </div>
  );
}
