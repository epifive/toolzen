"use client";

import { useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CopyPlus, Download, RotateCcw, RotateCw, Trash2, Undo2 } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { ErrorText, Panel } from "@/components/tool-ui";
import { downloadBlob, withSuffix } from "@/lib/files";
import { cn, uid } from "@/lib/utils";
import { useTool } from "@/tools/context";
import { copyPagesToNewPdf, loadPdfLib, openPdf, pageRotation, pdfErrorMessage, savePdf } from "@/tools/lib/pdf";
import { DownloadResult, PdfFilePicker, Progress, usePdfFile, type LoadedPdf, type OutputFile } from "@/tools/lib/pdf-file";
import { PageThumbnail, useRenderQueue } from "@/tools/lib/pdf-page-grid";
import { moveItem } from "@/tools/lib/sortable-file-list";

interface PageItem {
  id: string;
  /** Zero-based index of the page in the original file. */
  source: number;
  /** Extra clockwise rotation in degrees. */
  rotation: number;
}

const normalise = (angle: number) => ((angle % 360) + 360) % 360;

function initialPages(count: number): PageItem[] {
  return Array.from({ length: count }, (_, source) => ({ id: uid(), source, rotation: 0 }));
}

function ToolButton({
  label,
  onClick,
  disabled,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-7 place-items-center rounded-md text-muted transition-colors disabled:pointer-events-none disabled:opacity-30 [&_svg]:size-4",
        danger ? "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400" : "hover:bg-primary-soft hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function OrganizeWorkspace({ pdf, preview }: { pdf: LoadedPdf; preview: PDFDocumentProxy }) {
  const { track } = useTool();
  const enqueue = useRenderQueue();
  const [pages, setPages] = useState<PageItem[]>(() => initialPages(pdf.pageCount));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OutputFile | null>(null);

  const changed = pages.length !== pdf.pageCount || pages.some((p, i) => p.source !== i || p.rotation !== 0);

  function edit(next: (prev: PageItem[]) => PageItem[], message: string) {
    setPages(next);
    setAnnouncement(message);
    setResult(null);
    setError("");
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= pages.length || from === to) return;
    edit((prev) => moveItem(prev, from, to), `Page moved to position ${to + 1} of ${pages.length}.`);
  }

  function rotate(id: string, by: number) {
    edit(
      (prev) => prev.map((p) => (p.id === id ? { ...p, rotation: normalise(p.rotation + by) } : p)),
      `Page rotated ${by > 0 ? "right" : "left"}.`,
    );
  }

  function duplicate(index: number) {
    edit((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, { ...prev[index], id: uid() });
      return next;
    }, `Page duplicated. The copy is at position ${index + 2}.`);
  }

  function remove(id: string) {
    edit((prev) => prev.filter((p) => p.id !== id), "Page deleted.");
  }

  function reset() {
    edit(() => initialPages(pdf.pageCount), "Original page order restored.");
  }

  function endDrag() {
    setDragIndex(null);
    setOverIndex(null);
  }

  async function save() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const { degrees } = await loadPdfLib();
      const source = await openPdf(pdf.bytes);
      const doc = await copyPagesToNewPdf(
        source,
        pages.map((p) => p.source),
      );
      doc.getPages().forEach((page, index) => {
        const extra = pages[index].rotation;
        if (extra) page.setRotation(degrees(normalise(pageRotation(page) + extra)));
      });
      const output = { blob: await savePdf(doc), name: withSuffix(pdf.file.name, "-organized") };
      setResult(output);
      downloadBlob(output.blob, output.name);
      track();
    } catch (e) {
      setError(pdfErrorMessage(e, "The PDF could not be saved. Check that it opens in a PDF reader."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Panel
        title={`Pages (${pages.length})`}
        actions={
          <Button size="sm" variant="ghost" onClick={reset} disabled={busy || !changed}>
            <Undo2 aria-hidden />
            Reset
          </Button>
        }
      >
        <p className="mb-4 text-sm text-muted">
          Drag pages to reorder them, or use the buttons under each page. Changes are only saved when you click Save PDF.
        </p>
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
        {pages.length ? (
          <ol aria-label="Pages in their new order" className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {pages.map((page, index) => (
              <li
                key={page.id}
                draggable={!busy}
                onDragStart={(e) => {
                  setDragIndex(index);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", page.id);
                }}
                onDragOver={(e) => {
                  if (dragIndex === null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (overIndex !== index) setOverIndex(index);
                }}
                onDrop={(e) => {
                  if (dragIndex === null) return;
                  e.preventDefault();
                  move(dragIndex, index);
                  endDrag();
                }}
                onDragEnd={endDrag}
                className={cn(
                  "flex flex-col rounded-lg border bg-paper transition-colors",
                  !busy && "cursor-grab active:cursor-grabbing",
                  dragIndex === index && "opacity-50",
                  overIndex === index && dragIndex !== index ? "border-primary ring-2 ring-primary/20" : "border-line",
                )}
              >
                <PageThumbnail doc={preview} pageNumber={page.source + 1} rotation={page.rotation} enqueue={enqueue} />
                <div className="border-t border-line px-2 py-1.5">
                  <p className="flex items-center justify-between text-xs text-muted">
                    <span className="font-semibold tabular-nums text-ink">{index + 1}</span>
                    <span className="tabular-nums">Original p. {page.source + 1}</span>
                  </p>
                  <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                    <ToolButton label={`Move page ${index + 1} earlier`} onClick={() => move(index, index - 1)} disabled={busy || index === 0}>
                      <ArrowLeft />
                    </ToolButton>
                    <ToolButton
                      label={`Move page ${index + 1} later`}
                      onClick={() => move(index, index + 1)}
                      disabled={busy || index === pages.length - 1}
                    >
                      <ArrowRight />
                    </ToolButton>
                    <ToolButton label={`Rotate page ${index + 1} left`} onClick={() => rotate(page.id, -90)} disabled={busy}>
                      <RotateCcw />
                    </ToolButton>
                    <ToolButton label={`Rotate page ${index + 1} right`} onClick={() => rotate(page.id, 90)} disabled={busy}>
                      <RotateCw />
                    </ToolButton>
                    <ToolButton label={`Duplicate page ${index + 1}`} onClick={() => duplicate(index)} disabled={busy}>
                      <CopyPlus />
                    </ToolButton>
                    <ToolButton label={`Delete page ${index + 1}`} onClick={() => remove(page.id)} disabled={busy} danger>
                      <Trash2 />
                    </ToolButton>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            Every page has been deleted. Click Reset to start again.
          </p>
        )}
      </Panel>

      <ErrorText>{error}</ErrorText>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={busy || !changed || pages.length === 0}>
          <Download aria-hidden />
          {changed ? `Save PDF (${pages.length} page${pages.length === 1 ? "" : "s"})` : "Make a change to save"}
        </Button>
        {busy ? <Progress>Saving the PDF…</Progress> : null}
      </div>

      {result ? <DownloadResult result={result} /> : null}
    </>
  );
}

export default function OrganizePdf() {
  const state = usePdfFile({ preview: true });
  const { pdf } = state;
  return (
    <div className="space-y-4">
      <PdfFilePicker state={state} />
      {pdf?.preview ? <OrganizeWorkspace key={pdf.id} pdf={pdf} preview={pdf.preview} /> : null}
    </div>
  );
}
