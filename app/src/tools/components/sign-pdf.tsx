"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { PenLine } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { ErrorText, Panel, Spinner, useObjectUrl } from "@/components/tool-ui";
import { canvasToBlob, downloadBlob, withSuffix } from "@/lib/files";
import { useTool } from "@/tools/context";
import { clamp } from "@/tools/lib/image";
import { PreviewImage } from "@/tools/lib/image-ui";
import {
  assertStandardFontText,
  loadPdfLib,
  openPdf,
  pageFrame,
  pdfErrorMessage,
  renderPageToCanvas,
  savePdf,
} from "@/tools/lib/pdf";
import { DownloadResult, PdfFilePicker, Progress, usePdfFile, type LoadedPdf, type OutputFile } from "@/tools/lib/pdf-file";
import { SignaturePad, type Signature } from "@/tools/lib/signature";

/** Signature position as fractions of the visible page: top-left corner and width. */
interface Placement {
  x: number;
  y: number;
  width: number;
}

interface PagePreview {
  index: number;
  blob: Blob;
  /** Visible page size in points, after the page's own rotation. */
  width: number;
  height: number;
}

interface Drag {
  kind: "move" | "resize";
  pointerX: number;
  pointerY: number;
  start: Placement;
  frameWidth: number;
  frameHeight: number;
}

const PREVIEW_WIDTH = 800;
const MIN_WIDTH = 0.05;
const DEFAULT_PLACEMENT: Placement = { x: 0.58, y: 0.78, width: 0.3 };
const DATE_FONT_STACK = "Helvetica, Arial, sans-serif";
const DATE_COLOR = "#1f2937";

/** Date font size in points, scaled to the signature height. */
function dateSize(signatureHeight: number): number {
  return clamp(signatureHeight * 0.28, 7, 14);
}

/** Geometry of the placed signature in page points. */
function layout(p: Placement, signature: Signature, pageWidth: number, withDate: boolean) {
  const width = p.width * pageWidth;
  const height = (width * signature.height) / signature.width;
  const size = dateSize(height);
  return { width, height, dateSize: size, dateBlock: withDate ? size * 1.4 : 0 };
}

/** Keeps the signature (and the date under it) inside the page. */
function constrain(p: Placement, signature: Signature, pageWidth: number, pageHeight: number, withDate: boolean): Placement {
  const aspect = signature.height / signature.width;
  // The widest the signature can be while its height (plus the date) still fits the page.
  const maxWidth = Math.min(1, (pageHeight * 0.95) / aspect / pageWidth);
  const width = clamp(p.width, Math.min(MIN_WIDTH, maxWidth), maxWidth);
  const box = layout({ ...p, width }, signature, pageWidth, withDate);
  const maxY = Math.max(0, 1 - (box.height + box.dateBlock) / pageHeight);
  return { width, x: clamp(p.x, 0, 1 - width), y: clamp(p.y, 0, maxY) };
}

async function renderPreview(doc: PDFDocumentProxy, index: number): Promise<PagePreview> {
  const page = await doc.getPage(index + 1);
  try {
    const natural = page.getViewport({ scale: 1 });
    const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    const { canvas } = await renderPageToCanvas(page, (PREVIEW_WIDTH * pixelRatio) / natural.width);
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.85);
    return { index, blob, width: natural.width, height: natural.height };
  } finally {
    page.cleanup();
  }
}

function SignWorkspace({ pdf, preview }: { pdf: LoadedPdf; preview: PDFDocumentProxy }) {
  const { track } = useTool();
  const [signature, setSignature] = useState<Signature | null>(null);
  const [pageIndex, setPageIndex] = useState(pdf.pageCount - 1);
  const [placement, setPlacement] = useState<Placement>(DEFAULT_PLACEMENT);
  const [withDate, setWithDate] = useState(false);
  const [dateText, setDateText] = useState(() => new Date().toLocaleDateString());
  const [page, setPage] = useState<PagePreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OutputFile | null>(null);
  const dragRef = useRef<Drag | null>(null);

  const current = page?.index === pageIndex ? page : null;
  const pageUrl = useObjectUrl(current?.blob);

  useEffect(() => {
    let cancelled = false;
    renderPreview(preview, pageIndex)
      .then((next) => {
        if (cancelled) return;
        setPage(next);
        setPreviewError("");
      })
      .catch((e: unknown) => {
        if (!cancelled) setPreviewError(pdfErrorMessage(e, "This page could not be shown."));
      });
    return () => {
      cancelled = true;
    };
  }, [preview, pageIndex]);

  const placed = signature && current ? constrain(placement, signature, current.width, current.height, withDate) : null;
  const box = signature && current && placed ? layout(placed, signature, current.width, withDate) : null;

  function invalidate() {
    setResult(null);
    setError("");
  }

  function changeSignature(next: Signature | null) {
    setSignature(next);
    invalidate();
  }

  function changePlacement(next: Placement) {
    if (!signature || !current) return;
    setPlacement(constrain(next, signature, current.width, current.height, withDate));
    invalidate();
  }

  /* ── Moving and resizing ── */

  function startDrag(e: PointerEvent<HTMLElement>, kind: Drag["kind"]) {
    const frame = e.currentTarget.closest<HTMLElement>("[data-sign-frame]");
    if (!frame || !placed || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = frame.getBoundingClientRect();
    dragRef.current = {
      kind,
      pointerX: e.clientX,
      pointerY: e.clientY,
      start: placed,
      frameWidth: rect.width,
      frameHeight: rect.height,
    };
  }

  function moveDrag(e: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (e.clientX - drag.pointerX) / drag.frameWidth;
    const dy = (e.clientY - drag.pointerY) / drag.frameHeight;
    if (drag.kind === "move") changePlacement({ ...drag.start, x: drag.start.x + dx, y: drag.start.y + dy });
    else changePlacement({ ...drag.start, width: drag.start.width + dx });
  }

  function endDrag() {
    dragRef.current = null;
  }

  function handleKey(e: KeyboardEvent<HTMLDivElement>) {
    if (!placed) return;
    const step = e.shiftKey ? 0.05 : 0.005;
    const actions: Record<string, () => Placement> = {
      ArrowLeft: () => ({ ...placed, x: placed.x - step }),
      ArrowRight: () => ({ ...placed, x: placed.x + step }),
      ArrowUp: () => ({ ...placed, y: placed.y - step }),
      ArrowDown: () => ({ ...placed, y: placed.y + step }),
      "+": () => ({ ...placed, width: placed.width + 0.01 }),
      "=": () => ({ ...placed, width: placed.width + 0.01 }),
      "-": () => ({ ...placed, width: placed.width - 0.01 }),
    };
    const action = actions[e.key];
    if (!action) return;
    e.preventDefault();
    changePlacement(action());
  }

  async function sign() {
    if (!signature || !placed) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const { StandardFonts, degrees, rgb } = await loadPdfLib();
      const doc = await openPdf(pdf.bytes);
      const target = doc.getPage(pageIndex);
      const frame = pageFrame(target);
      const geometry = layout(placed, signature, frame.width, withDate);
      const rotate = degrees(frame.angleOffset);
      const left = placed.x * frame.width;
      // Measured from the bottom of the visible page, as PDF coordinates are.
      const bottom = frame.height - placed.y * frame.height - geometry.height;

      const image = await doc.embedPng(signature.dataUrl);
      const origin = frame.toPdf(left, bottom);
      target.drawImage(image, { x: origin.x, y: origin.y, width: geometry.width, height: geometry.height, rotate });

      const date = dateText.trim();
      if (withDate && date) {
        const font = await doc.embedFont(StandardFonts.Helvetica);
        assertStandardFontText(font, date);
        const baseline = frame.toPdf(left, bottom - geometry.dateSize * 1.1);
        target.drawText(date, {
          x: baseline.x,
          y: baseline.y,
          size: geometry.dateSize,
          font,
          color: rgb(31 / 255, 41 / 255, 55 / 255),
          rotate,
        });
      }

      const output = { blob: await savePdf(doc), name: withSuffix(pdf.file.name, "-signed") };
      setResult(output);
      downloadBlob(output.blob, output.name);
      track();
    } catch (e) {
      setError(pdfErrorMessage(e, "The PDF could not be signed. Check that it opens in a PDF reader."));
    } finally {
      setBusy(false);
    }
  }

  const pct = (value: number) => `${value * 100}%`;

  return (
    <>
      <Panel title="1. Create your signature">
        <SignaturePad onChange={changeSignature} />
      </Panel>

      <Panel title="2. Place it on the page">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Page" htmlFor="sign-page">
              <Select
                id="sign-page"
                value={pageIndex}
                onChange={(e) => {
                  setPageIndex(Number(e.target.value));
                  invalidate();
                }}
              >
                {Array.from({ length: pdf.pageCount }, (_, i) => (
                  <option key={i} value={i}>
                    Page {i + 1}
                    {i === pdf.pageCount - 1 && pdf.pageCount > 1 ? " (last)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="space-y-2">
              <Checkbox
                label="Add the date below the signature"
                checked={withDate}
                onChange={(e) => {
                  setWithDate(e.target.checked);
                  invalidate();
                }}
              />
              {withDate ? (
                <Input
                  aria-label="Date text"
                  value={dateText}
                  maxLength={40}
                  onChange={(e) => {
                    setDateText(e.target.value);
                    invalidate();
                  }}
                />
              ) : null}
            </div>
          </div>

          <div className="flex justify-center rounded-lg border border-line bg-paper p-3 sm:p-4">
            {previewError ? (
              <p className="py-12 text-sm text-red-600 dark:text-red-400">{previewError}</p>
            ) : current && pageUrl ? (
              <div
                data-sign-frame
                className="@container relative w-full max-w-[40rem] select-none"
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                <PreviewImage
                  src={pageUrl}
                  alt={`Page ${pageIndex + 1}`}
                  className="block w-full bg-white shadow-sm ring-1 ring-black/10"
                />
                {signature && placed && box ? (
                  <div
                    role="group"
                    tabIndex={0}
                    aria-label="Signature position. Drag to move it, or use the arrow keys; press plus or minus to resize."
                    onKeyDown={handleKey}
                    onPointerDown={(e) => startDrag(e, "move")}
                    className="absolute cursor-move touch-none outline-1 outline-dashed outline-primary focus-visible:outline-2 focus-visible:outline-solid"
                    style={{
                      left: pct(placed.x),
                      top: pct(placed.y),
                      width: pct(placed.width),
                      height: pct(box.height / current.height),
                    }}
                  >
                    <PreviewImage src={signature.dataUrl} alt="" className="block size-full" />
                    {withDate && dateText.trim() ? (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute left-0 whitespace-nowrap"
                        style={{
                          top: "100%",
                          fontFamily: DATE_FONT_STACK,
                          color: DATE_COLOR,
                          fontSize: `${(box.dateSize / current.width) * 100}cqw`,
                          lineHeight: 1.4,
                        }}
                      >
                        {dateText.trim()}
                      </span>
                    ) : null}
                    <span
                      aria-hidden
                      title="Drag to resize"
                      onPointerDown={(e) => startDrag(e, "resize")}
                      className="absolute top-full left-full grid size-7 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize touch-none place-items-center"
                    >
                      <span className="size-3 rounded-sm border border-primary bg-white shadow" />
                    </span>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="flex items-center gap-2 py-12 text-sm text-muted">
                <Spinner />
                Rendering page…
              </p>
            )}
          </div>
          {!signature ? <p className="text-sm text-muted">Create your signature above to place it on the page.</p> : null}
        </div>
      </Panel>

      <ErrorText>{error}</ErrorText>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={sign} disabled={busy || !signature || !placed}>
          <PenLine aria-hidden />
          Sign PDF
        </Button>
        {busy ? <Progress>Signing the PDF…</Progress> : null}
      </div>

      {result ? <DownloadResult result={result} /> : null}
    </>
  );
}

export default function SignPdf() {
  const state = usePdfFile({ preview: true });
  const { pdf } = state;
  return (
    <div className="space-y-4">
      <PdfFilePicker state={state} />
      {pdf?.preview ? <SignWorkspace key={pdf.id} pdf={pdf} preview={pdf.preview} /> : null}
    </div>
  );
}
