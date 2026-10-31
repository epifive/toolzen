/**
 * Canvas, SVG and colour helpers shared by the image tools. Browser only.
 */

import type { CSSProperties } from "react";
import { canvasToBlob, createCanvas, loadImage } from "@/lib/files";

/* ───────────────────────── Constants ───────────────────────── */

/** Raster formats every modern browser can decode. */
export const RASTER_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/bmp,image/avif";

/** Raster formats plus SVG. */
export const IMAGE_ACCEPT = `${RASTER_ACCEPT},image/svg+xml,.svg`;

/** Largest side and area we ask a browser canvas to hold (beyond this, browsers fail silently). */
export const MAX_CANVAS_SIDE = 16_384;
export const MAX_CANVAS_PIXELS = 100_000_000;

/** Default quality for lossy re-encoding when the tool has no quality setting. */
export const DEFAULT_QUALITY = 0.92;

/** Transparency checkerboard built from theme tokens, so it works in light and dark mode. */
export const CHECKERBOARD: CSSProperties = {
  backgroundImage:
    "conic-gradient(var(--line) 25%, var(--surface) 0 50%, var(--line) 0 75%, var(--surface) 0)",
  backgroundSize: "16px 16px",
};

export type RasterType = "image/jpeg" | "image/png" | "image/webp";

const FORMAT_LABEL: Record<RasterType, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WebP",
};

/* ───────────────────────── General ───────────────────────── */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Readable message from an unknown thrown value. */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/* ───────────────────────── Formats ───────────────────────── */

/** The output type that keeps the original format, falling back to PNG for formats canvases can't encode. */
export function outputTypeFor(mime: string): RasterType {
  return mime === "image/jpeg" || mime === "image/webp" ? mime : "image/png";
}

export function formatLabel(type: RasterType): string {
  return FORMAT_LABEL[type];
}

export function isSvgFile(file: File): boolean {
  return file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
}

/* ───────────────────────── Canvas ───────────────────────── */

/** Throws a friendly error when a canvas of this size would exceed browser limits. */
export function assertCanvasSize(width: number, height: number): void {
  const w = Math.round(width);
  const h = Math.round(height);
  if (w > MAX_CANVAS_SIDE || h > MAX_CANVAS_SIDE || w * h > MAX_CANVAS_PIXELS) {
    throw new Error(
      `The result would be ${w.toLocaleString()} × ${h.toLocaleString()} px, which is larger than browsers can handle. Choose a smaller size.`,
    );
  }
}

/** 2D context of a canvas, or a clear error when the browser can't provide one. */
export function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not create a drawing surface for this image.");
  return ctx;
}

/** Scale (width, height) down so the longer side is at most `max`. Never scales up. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number; scale: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale };
}

/** Fill the whole canvas with a solid colour (used for formats without transparency). */
export function paintBackground(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

/**
 * Draw a region of `source` into a new canvas of the given size. Large reductions are done in
 * halving steps, which avoids the aliasing browsers produce when shrinking in a single pass.
 */
export function drawScaled(
  source: CanvasImageSource,
  region: { x: number; y: number; width: number; height: number },
  width: number,
  height: number,
): HTMLCanvasElement {
  const targetW = Math.max(1, Math.round(width));
  const targetH = Math.max(1, Math.round(height));
  assertCanvasSize(targetW, targetH);

  let current: CanvasImageSource = source;
  let { x, y, width: cw, height: ch } = region;

  while (cw / 2 >= targetW && ch / 2 >= targetH) {
    const step = createCanvas(cw / 2, ch / 2);
    const stepCtx = context2d(step);
    stepCtx.imageSmoothingQuality = "high";
    stepCtx.drawImage(current, x, y, cw, ch, 0, 0, step.width, step.height);
    current = step;
    x = 0;
    y = 0;
    cw = step.width;
    ch = step.height;
  }

  const out = createCanvas(targetW, targetH);
  const ctx = context2d(out);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(current, x, y, cw, ch, 0, 0, targetW, targetH);
  return out;
}

/** Encode a canvas, flattening it onto `background` first when the format has no alpha channel. */
export async function exportCanvas(
  canvas: HTMLCanvasElement,
  type: RasterType,
  quality = DEFAULT_QUALITY,
  background = "#ffffff",
): Promise<Blob> {
  if (type !== "image/jpeg") return canvasToBlob(canvas, type, quality);
  const flat = createCanvas(canvas.width, canvas.height);
  const ctx = context2d(flat);
  paintBackground(ctx, background);
  ctx.drawImage(canvas, 0, 0);
  return canvasToBlob(flat, type, quality);
}

/* ───────────────────────── SVG ───────────────────────── */

const SVG_NS = "http://www.w3.org/2000/svg";

const UNIT_TO_PX: Record<string, number> = {
  "": 1,
  px: 1,
  pt: 4 / 3,
  pc: 16,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
};

/** Converts an SVG length such as "24", "24px" or "2in" to pixels. Percentages and unknown units return null. */
function svgLength(value: string | null): number | null {
  if (!value) return null;
  const match = /^\s*([0-9]*\.?[0-9]+(?:e[-+]?[0-9]+)?)\s*([a-z]*)\s*$/i.exec(value);
  if (!match) return null;
  const factor = UNIT_TO_PX[match[2].toLowerCase()];
  const px = Number(match[1]) * (factor ?? NaN);
  return Number.isFinite(px) && px > 0 ? px : null;
}

function parseSvgRoot(markup: string): SVGSVGElement {
  const parse = (text: string) => new DOMParser().parseFromString(text, "image/svg+xml");
  let doc = parse(markup);
  if (doc.getElementsByTagName("parsererror").length) {
    throw new Error("This is not valid SVG. Check that the code is complete and well-formed.");
  }
  if (doc.documentElement.localName !== "svg") {
    throw new Error("The code must start with an <svg> element.");
  }
  if (doc.documentElement.namespaceURI !== SVG_NS) {
    // Inline SVG copied from HTML often omits the namespace, which image decoders require.
    doc = parse(markup.replace(/<svg\b/i, `<svg xmlns="${SVG_NS}"`));
    if (doc.getElementsByTagName("parsererror").length || doc.documentElement.namespaceURI !== SVG_NS) {
      throw new Error("This SVG could not be read. Make sure it uses the standard SVG namespace.");
    }
  }
  return doc.documentElement as unknown as SVGSVGElement;
}

export interface SvgInfo {
  /** Intrinsic size in CSS pixels. */
  width: number;
  height: number;
  /** False when neither width/height nor a viewBox was found and the browser default (300 × 150) is assumed. */
  hasIntrinsicSize: boolean;
}

/** Reads the intrinsic size of an SVG from its width/height attributes or viewBox. Throws on invalid markup. */
export function readSvgInfo(markup: string): SvgInfo {
  const root = parseSvgRoot(markup);
  const viewBox = (root.getAttribute("viewBox") ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const vb = viewBox.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0 ? viewBox : null;
  let width = svgLength(root.getAttribute("width"));
  let height = svgLength(root.getAttribute("height"));

  if (width && !height) height = vb ? (width * vb[3]) / vb[2] : width;
  if (height && !width) width = vb ? (height * vb[2]) / vb[3] : height;
  if (!width || !height) {
    if (vb) return { width: vb[2], height: vb[3], hasIntrinsicSize: true };
    return { width: 300, height: 150, hasIntrinsicSize: false };
  }
  return { width, height, hasIntrinsicSize: true };
}

/**
 * Decodes SVG markup into an image rendered at exactly `width` × `height`. Setting explicit
 * dimensions keeps vector output sharp and lets every browser draw the SVG onto a canvas.
 */
export async function loadSvg(markup: string, width: number, height: number): Promise<HTMLImageElement> {
  const info = readSvgInfo(markup);
  const root = parseSvgRoot(markup);
  if (!root.hasAttribute("viewBox")) root.setAttribute("viewBox", `0 0 ${info.width} ${info.height}`);
  root.setAttribute("width", String(Math.max(1, Math.round(width))));
  root.setAttribute("height", String(Math.max(1, Math.round(height))));
  const blob = new Blob([new XMLSerializer().serializeToString(root)], { type: "image/svg+xml" });
  try {
    return await loadImage(blob);
  } catch {
    throw new Error("Your browser could not render this SVG.");
  }
}

/* ───────────────────────── Opening files ───────────────────────── */

export interface SourceImage {
  file: File;
  image: HTMLImageElement;
  width: number;
  height: number;
}

/**
 * Decodes an image file, including SVG. `svgMinSize` renders vector files with at least that
 * many pixels on the longer side so they stay sharp when used as a large raster source.
 */
export async function openImage(file: File, options: { svgMinSize?: number } = {}): Promise<SourceImage> {
  if (isSvgFile(file)) {
    const markup = await file.text();
    const info = readSvgInfo(markup);
    const scale = Math.max(1, (options.svgMinSize ?? 0) / Math.max(info.width, info.height));
    const width = Math.round(info.width * scale);
    const height = Math.round(info.height * scale);
    return { file, image: await loadSvg(markup, width, height), width, height };
  }
  const image = await loadImage(file);
  if (!image.naturalWidth || !image.naturalHeight) throw new Error("This image has no dimensions and can't be edited.");
  return { file, image, width: image.naturalWidth, height: image.naturalHeight };
}

/* ───────────────────────── Colour ───────────────────────── */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

/** Parses "#rgb" or "#rrggbb" (the hash is optional). Returns null for anything else. */
export function hexToRgb(hex: string): Rgb | null {
  let h = hex.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(h)) h = [...h].map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbString({ r, g, b }: Rgb): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}
