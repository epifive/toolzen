"use client";

import { useState } from "react";
import { Download, RotateCcw, RotateCw, Undo2 } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { ErrorText, Panel, Segmented } from "@/components/tool-ui";
import { downloadBlob, withSuffix } from "@/lib/files";
import { useTool } from "@/tools/context";
import { loadPdfLib, openPdf, pageRotation, pdfErrorMessage, savePdf } from "@/tools/lib/pdf";
import { DownloadResult, PdfFilePicker, Progress, usePdfFile, type LoadedPdf, type OutputFile } from "@/tools/lib/pdf-file";
import { PageSelectionControls, PdfPageGrid } from "@/tools/lib/pdf-page-grid";

type Scope = "all" | "selected";

const normalise = (angle: number) => ((angle % 360) + 360) % 360;

function RotateWorkspace({ pdf, preview }: { pdf: LoadedPdf; preview: PDFDocumentProxy }) {
  const { track } = useTool();
  const [scope, setScope] = useState<Scope>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  /** Clockwise rotation to add to each page, in degrees. */
  const [rotations, setRotations] = useState<number[]>(() => Array.from({ length: pdf.pageCount }, () => 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OutputFile | null>(null);

  const changed = rotations.filter(Boolean).length;
  const targetCount = scope === "all" ? pdf.pageCount : selected.size;

  function select(next: Set<number>) {
    setSelected(next);
    // Picking pages implies the visitor wants to rotate just those.
    if (next.size) setScope("selected");
  }

  function rotate(by: number) {
    setRotations((prev) => prev.map((angle, index) => (scope === "all" || selected.has(index) ? normalise(angle + by) : angle)));
    setResult(null);
    setError("");
  }

  function reset() {
    setRotations((prev) => prev.map(() => 0));
    setResult(null);
    setError("");
  }

  async function save() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const { degrees } = await loadPdfLib();
      const doc = await openPdf(pdf.bytes);
      doc.getPages().forEach((page, index) => {
        if (rotations[index]) page.setRotation(degrees(normalise(pageRotation(page) + rotations[index])));
      });
      const output = { blob: await savePdf(doc), name: withSuffix(pdf.file.name, "-rotated") };
      setResult(output);
      downloadBlob(output.blob, output.name);
      track();
    } catch (e) {
      setError(pdfErrorMessage(e, "The PDF could not be rotated. Check that it opens in a PDF reader."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Panel title="Rotate pages">
        <div className="space-y-4">
          <Segmented<Scope>
            label="Pages to rotate"
            value={scope}
            onChange={setScope}
            options={[
              { value: "all", label: "All pages" },
              { value: "selected", label: `Selected pages (${selected.size})` },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => rotate(-90)} disabled={busy || targetCount === 0}>
              <RotateCcw aria-hidden />
              Left 90°
            </Button>
            <Button variant="outline" onClick={() => rotate(90)} disabled={busy || targetCount === 0}>
              <RotateCw aria-hidden />
              Right 90°
            </Button>
            <Button variant="outline" onClick={() => rotate(180)} disabled={busy || targetCount === 0}>
              <RotateCw aria-hidden />
              180°
            </Button>
            <Button variant="ghost" onClick={reset} disabled={busy || changed === 0}>
              <Undo2 aria-hidden />
              Reset
            </Button>
          </div>
          {scope === "selected" ? (
            <PageSelectionControls pageCount={pdf.pageCount} selected={selected} onSelectedChange={select} disabled={busy} />
          ) : (
            <p className="text-sm text-muted">Rotation applies to every page. Click pages to rotate only some of them.</p>
          )}
          <PdfPageGrid
            doc={preview}
            selected={selected}
            onSelectedChange={select}
            rotations={rotations}
            label="Pages, click to select for rotation"
            disabled={busy}
          />
        </div>
      </Panel>

      <ErrorText>{error}</ErrorText>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={busy || changed === 0}>
          <Download aria-hidden />
          {changed ? `Save PDF (${changed} page${changed === 1 ? "" : "s"} rotated)` : "Rotate pages to continue"}
        </Button>
        {busy ? <Progress>Saving the PDF…</Progress> : null}
      </div>

      {result ? <DownloadResult result={result} /> : null}
    </>
  );
}

export default function RotatePdf() {
  const state = usePdfFile({ preview: true });
  const { pdf } = state;
  return (
    <div className="space-y-4">
      <PdfFilePicker state={state} />
      {pdf?.preview ? <RotateWorkspace key={pdf.id} pdf={pdf} preview={pdf.preview} /> : null}
    </div>
  );
}
