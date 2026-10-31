"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ErrorText, Panel } from "@/components/tool-ui";
import { downloadBlob, withSuffix } from "@/lib/files";
import { useTool } from "@/tools/context";
import { copyPagesToNewPdf, openPdf, pdfErrorMessage, savePdf } from "@/tools/lib/pdf";
import { DownloadResult, PdfFilePicker, Progress, usePdfFile, type LoadedPdf, type OutputFile } from "@/tools/lib/pdf-file";
import { PageSelectionControls, PdfPageGrid } from "@/tools/lib/pdf-page-grid";

function RemoveWorkspace({ pdf, preview }: { pdf: LoadedPdf; preview: PDFDocumentProxy }) {
  const { track } = useTool();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OutputFile | null>(null);

  const removingAll = selected.size >= pdf.pageCount;
  const remaining = pdf.pageCount - selected.size;

  function select(next: Set<number>) {
    setSelected(next);
    setResult(null);
    setError("");
  }

  async function remove() {
    if (removingAll) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const source = await openPdf(pdf.bytes);
      // Copying the kept pages (rather than deleting the others) also drops the removed pages'
      // images and fonts, so the file actually gets smaller.
      const kept = source.getPageIndices().filter((index) => !selected.has(index));
      const doc = await copyPagesToNewPdf(source, kept);
      const output = { blob: await savePdf(doc), name: withSuffix(pdf.file.name, "-pages-removed") };
      setResult(output);
      downloadBlob(output.blob, output.name);
      track();
    } catch (e) {
      setError(pdfErrorMessage(e, "The pages could not be removed. Check that the PDF opens in a PDF reader."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Panel title="Choose the pages to remove">
        <div className="space-y-4">
          <PageSelectionControls
            pageCount={pdf.pageCount}
            selected={selected}
            onSelectedChange={select}
            noun="marked for removal"
            disabled={busy}
          />
          <PdfPageGrid
            doc={preview}
            selected={selected}
            onSelectedChange={select}
            tone="remove"
            label="Pages to remove"
            disabled={busy}
          />
        </div>
      </Panel>

      {removingAll ? (
        <Alert tone="warning" title="A PDF needs at least one page.">
          Unselect at least one page to keep.
        </Alert>
      ) : null}

      <ErrorText>{error}</ErrorText>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={remove} disabled={busy || selected.size === 0 || removingAll}>
          <Trash2 aria-hidden />
          {selected.size
            ? `Remove ${selected.size} page${selected.size === 1 ? "" : "s"}`
            : "Select the pages to remove"}
        </Button>
        {selected.size && !removingAll ? (
          <p className="text-sm text-muted">
            {remaining} page{remaining === 1 ? "" : "s"} will remain.
          </p>
        ) : null}
        {busy ? <Progress>Saving the PDF…</Progress> : null}
      </div>

      {result ? <DownloadResult result={result} /> : null}
    </>
  );
}

export default function RemovePdfPages() {
  const state = usePdfFile({ preview: true });
  const { pdf } = state;
  return (
    <div className="space-y-4">
      <PdfFilePicker state={state} />
      {pdf?.preview ? <RemoveWorkspace key={pdf.id} pdf={pdf} preview={pdf.preview} /> : null}
    </div>
  );
}
