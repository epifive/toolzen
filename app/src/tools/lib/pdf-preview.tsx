"use client";

/**
 * Live preview of a single page after an edit (watermark, page numbers). The edit runs on a
 * one-page copy of the document, so previews stay fast even for long PDFs, and pdf.js renders
 * the result exactly as a reader would show it.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocument } from "pdf-lib";
import { Panel, Spinner, useObjectUrl } from "@/components/tool-ui";
import { canvasToBlob } from "@/lib/files";
import { PreviewImage } from "@/tools/lib/image-ui";
import { copyPagesToNewPdf, openPdf, openPdfPreview, pdfErrorMessage, renderPageToCanvas } from "@/tools/lib/pdf";
import type { LoadedPdf } from "@/tools/lib/pdf-file";
import { useDebouncedValue } from "@/tools/lib/text";

/**
 * Changes a document in place. `pageIndexes[i]` is the position that page `i` of `doc` has in
 * the original file, so an edit can number or skip pages correctly on a one-page preview copy.
 */
export type PageTransform = (doc: PDFDocument, pageIndexes: number[]) => Promise<void>;

/** Applies `transform` to a whole document. */
export async function transformPdf(doc: PDFDocument, transform: PageTransform): Promise<void> {
  await transform(doc, doc.getPageIndices());
}

const PREVIEW_WIDTH = 640;

/**
 * Renders page `pageIndex` with `transform` applied, waiting until the settings have stopped
 * changing for a moment. Pass a memoised `transform` (e.g. from useMemo) so the preview only
 * re-renders when the settings really change.
 */
export function usePagePreview(pdf: LoadedPdf, pageIndex: number, transform: PageTransform) {
  const [output, setOutput] = useState<{ for: unknown; blob: Blob | null; error: string } | null>(null);
  const pages = useRef(new Map<number, Promise<Uint8Array>>());
  const latest = useMemo(() => ({ pageIndex, transform }), [pageIndex, transform]);
  const request = useDebouncedValue(latest, 300);

  useEffect(() => {
    let cancelled = false;
    const { pageIndex: index, transform: apply } = request;

    async function render() {
      let single = pages.current.get(index);
      if (!single) {
        single = openPdf(pdf.bytes).then(async (source) => (await copyPagesToNewPdf(source, [index])).save());
        pages.current.set(index, single);
      }
      const doc = await openPdf(await single);
      await apply(doc, [index]);
      const preview = await openPdfPreview(await doc.save());
      try {
        const page = await preview.getPage(1);
        const scale = (PREVIEW_WIDTH * Math.min(2, window.devicePixelRatio || 1)) / page.getViewport({ scale: 1 }).width;
        const { canvas } = await renderPageToCanvas(page, scale);
        return await canvasToBlob(canvas, "image/jpeg", 0.85);
      } finally {
        void preview.loadingTask.destroy();
      }
    }

    render()
      .then((blob) => {
        if (!cancelled) setOutput({ for: request, blob, error: "" });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setOutput((prev) => ({ for: request, blob: prev?.blob ?? null, error: pdfErrorMessage(e, "The preview could not be rendered.") }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pdf.bytes, request]);

  return {
    blob: output?.blob ?? null,
    error: output?.error ?? "",
    /** True while the settings are settling or the latest preview is still being rendered. */
    rendering: output?.for !== latest,
  };
}

/** Panel showing a page preview produced by `usePagePreview`. */
export function PagePreviewPanel({
  title,
  blob,
  error,
  rendering,
  alt,
}: {
  title: string;
  blob: Blob | null;
  error: string;
  rendering: boolean;
  alt: string;
}) {
  const url = useObjectUrl(blob);
  return (
    <Panel
      title={title}
      actions={rendering && url ? <Spinner className="text-muted" /> : null}
    >
      <div className="flex min-h-64 items-center justify-center rounded-lg bg-paper p-3">
        {error ? (
          <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : url ? (
          <PreviewImage src={url} alt={alt} className="max-h-[70vh] max-w-full bg-white shadow-sm ring-1 ring-black/10" />
        ) : (
          <span className="flex items-center gap-2 text-sm text-muted">
            <Spinner />
            Rendering preview…
          </span>
        )}
      </div>
    </Panel>
  );
}
