"use client";

import { useRef, useState } from "react";
import { Download, Images, Package } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ErrorText, Panel, Segmented, useObjectUrl } from "@/components/tool-ui";
import { canvasToBlob, downloadBlob, downloadZip, renameExtension, withSuffix } from "@/lib/files";
import { formatBytes } from "@/lib/utils";
import { useTool } from "@/tools/context";
import { PreviewImage } from "@/tools/lib/image-ui";
import { nextFrame, pdfErrorMessage, renderPageToCanvas } from "@/tools/lib/pdf";
import { PdfFilePicker, Progress, usePdfFile, type LoadedPdf } from "@/tools/lib/pdf-file";

type Format = "jpg" | "png";
type Dpi = "72" | "150" | "300";

interface PageImage {
  page: number;
  blob: Blob;
  name: string;
}

const MIME: Record<Format, string> = { jpg: "image/jpeg", png: "image/png" };

function PageImageCard({ image, totalPages }: { image: PageImage; totalPages: number }) {
  const url = useObjectUrl(image.blob);
  return (
    <li className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex aspect-square items-center justify-center bg-paper p-2">
        {url ? (
          <PreviewImage
            src={url}
            alt={`Page ${image.page} of ${totalPages}`}
            className="max-h-full max-w-full shadow-sm ring-1 ring-black/10"
          />
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-line px-2 py-1.5">
        <span className="min-w-0 text-xs text-muted">
          <span className="font-medium text-ink">Page {image.page}</span>
          <span className="block truncate">{formatBytes(image.blob.size)}</span>
        </span>
        <button
          type="button"
          onClick={() => downloadBlob(image.blob, image.name)}
          className="rounded-md p-1.5 text-muted hover:bg-primary-soft hover:text-primary [&_svg]:size-4"
          aria-label={`Download page ${image.page}`}
        >
          <Download />
        </button>
      </div>
    </li>
  );
}

function ConvertWorkspace({ pdf, preview }: { pdf: LoadedPdf; preview: PDFDocumentProxy }) {
  const { track } = useTool();
  const [format, setFormat] = useState<Format>("jpg");
  const [dpi, setDpi] = useState<Dpi>("150");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [images, setImages] = useState<PageImage[]>([]);
  const [reduced, setReduced] = useState(false);
  const [zipping, setZipping] = useState(false);
  const cancelled = useRef(false);

  const digits = String(pdf.pageCount).length;
  const zipName = renameExtension(withSuffix(pdf.file.name, "-images"), "zip");

  function change<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setImages([]);
      setError("");
      setReduced(false);
    };
  }

  async function convert() {
    setBusy(true);
    setError("");
    setImages([]);
    setReduced(false);
    cancelled.current = false;
    const scale = Number(dpi) / 72;
    const done: PageImage[] = [];
    try {
      for (let pageNumber = 1; pageNumber <= pdf.pageCount; pageNumber++) {
        if (cancelled.current) break;
        setProgress(`Rendering page ${pageNumber} of ${pdf.pageCount}…`);
        await nextFrame();
        const page = await preview.getPage(pageNumber);
        const { canvas, scale: used } = await renderPageToCanvas(page, scale);
        if (used < scale) setReduced(true);
        const blob = await canvasToBlob(canvas, MIME[format], 0.92);
        // Release the canvas memory right away; large pages at 300 DPI are big.
        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
        const name = renameExtension(withSuffix(pdf.file.name, `-page-${String(pageNumber).padStart(digits, "0")}`), format);
        done.push({ page: pageNumber, blob, name });
        setImages([...done]);
      }
      if (done.length) track();
    } catch (e) {
      setError(pdfErrorMessage(e, "Some pages could not be rendered. Try a lower resolution."));
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  async function downloadAll() {
    setZipping(true);
    try {
      await downloadZip(images.map((i) => ({ name: i.name, data: i.blob })), zipName);
    } finally {
      setZipping(false);
    }
  }

  return (
    <>
      <Panel title="Image settings">
        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <fieldset disabled={busy}>
            <legend className="mb-1.5 text-sm font-medium text-ink">Format</legend>
            <Segmented<Format>
              label="Format"
              value={format}
              onChange={change(setFormat)}
              options={[
                { value: "jpg", label: "JPG" },
                { value: "png", label: "PNG" },
              ]}
            />
          </fieldset>
          <fieldset disabled={busy}>
            <legend className="mb-1.5 text-sm font-medium text-ink">Resolution</legend>
            <Segmented<Dpi>
              label="Resolution"
              value={dpi}
              onChange={change(setDpi)}
              options={[
                { value: "72", label: "72 DPI" },
                { value: "150", label: "150 DPI" },
                { value: "300", label: "300 DPI" },
              ]}
            />
          </fieldset>
        </div>
        <p className="mt-3 text-sm text-muted">
          JPG files are smaller; PNG keeps text perfectly crisp. 150 DPI suits screens, 300 DPI suits printing.
        </p>
      </Panel>

      <ErrorText>{error}</ErrorText>

      <div className="flex flex-wrap items-center gap-3">
        {busy ? (
          <Button
            variant="outline"
            onClick={() => {
              cancelled.current = true;
            }}
          >
            Stop
          </Button>
        ) : (
          <Button onClick={convert}>
            <Images aria-hidden />
            Convert {pdf.pageCount} page{pdf.pageCount === 1 ? "" : "s"} to {format.toUpperCase()}
          </Button>
        )}
        {busy ? <Progress>{progress}</Progress> : null}
        {!busy && images.length > 1 ? (
          <Button variant="outline" onClick={downloadAll} disabled={zipping}>
            <Package aria-hidden />
            {zipping ? "Packing ZIP…" : `Download all as ZIP (${images.length})`}
          </Button>
        ) : null}
        {!busy && images.length === 1 ? (
          <Button variant="outline" onClick={() => downloadBlob(images[0].blob, images[0].name)}>
            <Download aria-hidden />
            Download image
          </Button>
        ) : null}
      </div>

      {reduced ? (
        <Alert tone="warning">
          Some pages are very large, so they were rendered at a lower resolution to stay within your browser&apos;s limits.
        </Alert>
      ) : null}

      {images.length ? (
        <ul aria-label="Converted pages" className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((image) => (
            <PageImageCard key={image.page} image={image} totalPages={pdf.pageCount} />
          ))}
        </ul>
      ) : null}
    </>
  );
}

export default function PdfToImages() {
  const state = usePdfFile({ preview: true });
  const { pdf } = state;
  return (
    <div className="space-y-4">
      <PdfFilePicker state={state} />
      {pdf?.preview ? <ConvertWorkspace key={pdf.id} pdf={pdf} preview={pdf.preview} /> : null}
    </div>
  );
}
