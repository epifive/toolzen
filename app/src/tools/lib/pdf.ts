/**
 * PDF helpers shared by the PDF tools. Browser only.
 *
 * pdf-lib edits documents (merge, split, rotate, stamp, metadata) and pdf.js renders pages
 * (thumbnails, previews, PDF to image). Both are loaded on demand so they only download when a
 * visitor actually opens a PDF.
 */

import type { PDFDocument, PDFFont, PDFPage } from "pdf-lib";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

/* ───────────────────────── Constants ───────────────────────── */

/** `accept` value for PDF dropzones. */
export const PDF_ACCEPT = "application/pdf,.pdf";

/** Largest canvas area every major browser can allocate (Safari's limit is the lowest). */
const MAX_CANVAS_PIXELS = 16_777_216;
const MAX_CANVAS_SIDE = 16_384;

/* ───────────────────────── Library loading ───────────────────────── */

type PdfJs = typeof import("pdfjs-dist");

let pdfJsPromise: Promise<PdfJs> | null = null;

/**
 * Loads pdf.js once and connects it to a single, locally bundled worker. The legacy build is
 * used because the modern build relies on JavaScript features that only the newest browsers ship.
 */
export function loadPdfJs(): Promise<PdfJs> {
  pdfJsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs")
    .then((pdfjs) => {
      if (!pdfjs.GlobalWorkerOptions.workerPort) {
        pdfjs.GlobalWorkerOptions.workerPort = new Worker(
          new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url),
          { type: "module" },
        );
      }
      return pdfjs;
    })
    .catch((error: unknown) => {
      // Allow a retry (e.g. after a flaky network) instead of caching the failure.
      pdfJsPromise = null;
      throw error;
    });
  return pdfJsPromise;
}

export function loadPdfLib(): Promise<typeof import("pdf-lib")> {
  return import("pdf-lib");
}

/* ───────────────────────── Errors ───────────────────────── */

export const ENCRYPTED_PDF_MESSAGE =
  "This PDF is password-protected or encrypted. Remove the protection in your PDF reader, then try again.";

const INVALID_PDF_MESSAGE = "This file isn't a valid PDF, or it is damaged.";

function isEncryptionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "PasswordException" || /encrypt|password/i.test(error.message);
}

/** Turns any error thrown while reading or writing a PDF into a message for visitors. */
export function pdfErrorMessage(error: unknown, fallback = "Something went wrong while processing this PDF."): string {
  if (isEncryptionError(error)) return ENCRYPTED_PDF_MESSAGE;
  if (error instanceof Error) {
    if (error.name === "InvalidPDFException" || /invalid pdf|failed to parse|no pdf header/i.test(error.message)) {
      return INVALID_PDF_MESSAGE;
    }
    if (error.name === "PdfUserError") return error.message;
  }
  return fallback;
}

/** An error whose message is already written for visitors and is shown as is. */
export class PdfUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfUserError";
  }
}

/* ───────────────────────── Opening documents ───────────────────────── */

/**
 * Parses a PDF with pdf-lib. Encrypted files are rejected: pdf-lib cannot decrypt them, so any
 * page it copied or changed would come out unreadable.
 */
export async function openPdf(
  data: ArrayBuffer | Uint8Array,
  options: { updateMetadata?: boolean } = {},
): Promise<PDFDocument> {
  const { PDFDocument } = await loadPdfLib();
  try {
    const doc = await PDFDocument.load(data, { updateMetadata: options.updateMetadata ?? true });
    if (doc.getPageCount() === 0) throw new PdfUserError("This PDF has no pages.");
    return doc;
  } catch (error) {
    throw new PdfUserError(pdfErrorMessage(error, INVALID_PDF_MESSAGE));
  }
}

/** Opens a PDF with pdf.js for rendering. The bytes are copied because pdf.js takes ownership of them. */
export async function openPdfPreview(data: ArrayBuffer | Uint8Array): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({
    data: data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array(data.slice(0)),
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });
  try {
    return await task.promise;
  } catch (error) {
    void task.destroy();
    throw new PdfUserError(pdfErrorMessage(error, INVALID_PDF_MESSAGE));
  }
}

/** Serialises a pdf-lib document into a downloadable Blob. */
export async function savePdf(doc: PDFDocument): Promise<Blob> {
  const bytes = await doc.save();
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
}

/** Lets the browser paint between pages of a long job so the UI stays responsive. */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/* ───────────────────────── Rendering ───────────────────────── */

/**
 * Renders a page onto a new canvas. The scale is reduced automatically when the result would be
 * larger than browsers can hold; the scale actually used is returned.
 */
export async function renderPageToCanvas(
  page: PDFPageProxy,
  scale: number,
): Promise<{ canvas: HTMLCanvasElement; scale: number }> {
  const base = page.getViewport({ scale: 1 });
  const limit = Math.min(
    Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, base.width * base.height)),
    MAX_CANVAS_SIDE / Math.max(base.width, base.height),
  );
  const used = Math.max(0.01, Math.min(scale, limit));
  const viewport = page.getViewport({ scale: used });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  await page.render({ canvas, viewport }).promise;
  return { canvas, scale: used };
}

/** Renders page `pageNumber` (1-based) as a JPEG data URL that is `width` CSS pixels wide. */
export async function renderThumbnail(doc: PDFDocumentProxy, pageNumber: number, width: number): Promise<string> {
  const page = await doc.getPage(pageNumber);
  try {
    const pixelRatio = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
    const natural = page.getViewport({ scale: 1 });
    const { canvas } = await renderPageToCanvas(page, (width * pixelRatio) / natural.width);
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally {
    page.cleanup();
  }
}

/* ───────────────────────── Page ranges ───────────────────────── */

/**
 * Parses page ranges such as "1-3, 5, 8-10" into zero-based page indexes, one group per
 * comma-separated part. "7-" means "page 7 to the end". Throws a `PdfUserError` that explains
 * exactly what is wrong.
 */
export function parsePageRanges(input: string, pageCount: number): number[][] {
  const parts = input
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) throw new PdfUserError("Enter at least one page number or range, for example 1-3, 5.");

  const check = (page: number) => {
    if (page < 1) throw new PdfUserError("Page numbers start at 1.");
    if (page > pageCount) {
      throw new PdfUserError(`Page ${page} doesn't exist. This PDF has ${pageCount} page${pageCount === 1 ? "" : "s"}.`);
    }
  };

  return parts.map((part) => {
    const match = /^(\d+)\s*(?:-\s*(\d*))?$/.exec(part);
    if (!match) throw new PdfUserError(`"${part}" isn't a page or range. Use numbers like 4 or 2-6.`);
    const from = Number(match[1]);
    const to = match[2] === undefined ? from : match[2] === "" ? pageCount : Number(match[2]);
    check(from);
    check(to);
    if (to < from) throw new PdfUserError(`The range "${part}" runs backwards. Write it as ${to}-${from}.`);
    return Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i);
  });
}

/** Parses page ranges into a sorted list of unique zero-based page indexes. */
export function parsePageSelection(input: string, pageCount: number): number[] {
  return [...new Set(parsePageRanges(input, pageCount).flat())].sort((a, b) => a - b);
}

/** Formats zero-based page indexes as compact 1-based ranges, e.g. [0, 1, 2, 4] → "1-3, 5". */
export function formatPageRanges(indexes: Iterable<number>): string {
  const sorted = [...new Set(indexes)].sort((a, b) => a - b);
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let end = i;
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end++;
    parts.push(end === i ? `${sorted[i] + 1}` : `${sorted[i] + 1}-${sorted[end] + 1}`);
    i = end + 1;
  }
  return parts.join(", ");
}

/** Readable label for a group of zero-based page indexes, used in file names. */
export function pageLabel(indexes: number[]): string {
  const first = indexes[0] + 1;
  const last = indexes[indexes.length - 1] + 1;
  return indexes.length === 1 ? `page-${first}` : `pages-${first}-${last}`;
}

/* ───────────────────────── Drawing on pages ───────────────────────── */

/** A page's rotation normalised to 0, 90, 180 or 270 degrees. */
export function pageRotation(page: PDFPage): number {
  const angle = page.getRotation().angle;
  return (((Math.round(angle / 90) * 90) % 360) + 360) % 360;
}

/**
 * The page as the reader sees it. Rotated pages keep their original coordinate system, so text
 * meant to look upright must be placed and turned to compensate; this frame does that mapping.
 */
export interface PageFrame {
  /** Visible width and height, after the page's rotation. */
  width: number;
  height: number;
  /** Converts a point measured from the visible bottom-left corner into PDF user space. */
  toPdf: (x: number, y: number) => { x: number; y: number };
  /** Angle to add to a visual angle so text appears at that angle on screen. */
  angleOffset: number;
}

export function pageFrame(page: PDFPage): PageFrame {
  const box = page.getCropBox();
  const rotation = pageRotation(page);
  const { x: bx, y: by, width: w, height: h } = box;
  const sideways = rotation === 90 || rotation === 270;
  const toPdf = (vx: number, vy: number) => {
    switch (rotation) {
      case 90:
        return { x: bx + w - vy, y: by + vx };
      case 180:
        return { x: bx + w - vx, y: by + h - vy };
      case 270:
        return { x: bx + vy, y: by + h - vx };
      default:
        return { x: bx + vx, y: by + vy };
    }
  };
  return { width: sideways ? h : w, height: sideways ? w : h, toPdf, angleOffset: rotation };
}

/**
 * Where to start drawing `text` so that its centre lands on the visual point (cx, cy) and it
 * reads at `angle` degrees (counter-clockwise) on screen. Returns PDF coordinates and the
 * rotation to pass to pdf-lib's `drawText`.
 */
export function centredTextOrigin(
  frame: PageFrame,
  font: PDFFont,
  text: string,
  size: number,
  cx: number,
  cy: number,
  angle: number,
): { x: number; y: number; rotate: number } {
  const width = font.widthOfTextAtSize(text, size);
  const height = font.heightAtSize(size, { descender: false });
  const rotate = angle + frame.angleOffset;
  const rad = (rotate * Math.PI) / 180;
  const centre = frame.toPdf(cx, cy);
  return {
    x: centre.x - ((width / 2) * Math.cos(rad) - (height / 2) * Math.sin(rad)),
    y: centre.y - ((width / 2) * Math.sin(rad) + (height / 2) * Math.cos(rad)),
    rotate,
  };
}

/**
 * Throws a clear error when `text` uses characters that the 14 standard PDF fonts cannot show
 * (they only cover the Western European character set).
 */
export function assertStandardFontText(font: PDFFont, text: string): void {
  try {
    font.encodeText(text);
  } catch {
    const unsupported = [...new Set(Array.from(text).filter((char) => !canEncode(font, char)))].slice(0, 5);
    throw new PdfUserError(
      `Standard PDF fonts can't display ${unsupported.map((c) => `"${c}"`).join(", ") || "some of these characters"}. Use Latin letters, numbers and common symbols.`,
    );
  }
}

function canEncode(font: PDFFont, char: string): boolean {
  try {
    font.encodeText(char);
    return true;
  } catch {
    return false;
  }
}

/* ───────────────────────── Building documents ───────────────────────── */

/**
 * Creates a new PDF from some pages of `source`, in the given order. Only what those pages use
 * is copied, so the result is as small as possible. The title, author, subject and keywords
 * are carried over.
 */
export async function copyPagesToNewPdf(source: PDFDocument, indexes: number[]): Promise<PDFDocument> {
  const { PDFDocument } = await loadPdfLib();
  const doc = await PDFDocument.create();
  const pages = await doc.copyPages(source, indexes);
  pages.forEach((page) => doc.addPage(page));
  const title = source.getTitle();
  const author = source.getAuthor();
  const subject = source.getSubject();
  const keywords = source.getKeywords();
  if (title) doc.setTitle(title);
  if (author) doc.setAuthor(author);
  if (subject) doc.setSubject(subject);
  if (keywords) doc.setKeywords([keywords]);
  return doc;
}
