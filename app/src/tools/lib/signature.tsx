"use client";

/**
 * Signature creator for the signing tools: draw with a mouse, pen or finger, type a name in a
 * handwriting-style system font, or upload a picture of a handwritten signature. Every mode
 * produces a transparent PNG trimmed to the ink.
 */

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Eraser, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { ErrorText, FileDropzone, RangeField, Segmented } from "@/components/tool-ui";
import { createCanvas } from "@/lib/files";
import { cn } from "@/lib/utils";
import { CHECKERBOARD, context2d, errorMessage, fitWithin, hexToRgb, openImage, RASTER_ACCEPT, type SourceImage } from "@/tools/lib/image";
import { PreviewImage } from "@/tools/lib/image-ui";

export interface Signature {
  /** Transparent PNG as a data URL (pdf-lib can embed it directly). */
  dataUrl: string;
  width: number;
  height: number;
}

type Mode = "draw" | "type" | "upload";
type FontKey = "segoe" | "brush" | "lucida" | "cursive";

interface Point {
  x: number;
  y: number;
}

interface PadState {
  mode: Mode;
  color: string;
  /** Pen width in drawing-pad pixels. */
  penWidth: number;
  strokes: Point[][];
  typed: string;
  font: FontKey;
  upload: SourceImage | null;
  removeBackground: boolean;
}

/** Drawing pad resolution. It is displayed smaller, so strokes stay sharp when the signature is enlarged. */
const PAD_WIDTH = 1200;
const PAD_HEIGHT = 400;
const TYPED_SIZE = 140;
const UPLOAD_MAX = 1200;

/** Handwriting-style fonts that ship with Windows, macOS or most Linux desktops. Nothing is downloaded. */
const FONTS: Record<FontKey, { label: string; stack: string }> = {
  segoe: { label: "Script", stack: '"Segoe Script", "Snell Roundhand", "Brush Script MT", cursive' },
  brush: { label: "Brush", stack: '"Brush Script MT", "Brush Script Std", "Segoe Script", cursive' },
  lucida: { label: "Calligraphy", stack: '"Lucida Handwriting", "Apple Chancery", "Segoe Script", cursive' },
  cursive: { label: "Casual", stack: '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive' },
};

const INK_COLORS = [
  { value: "#111827", label: "Black" },
  { value: "#1d4ed8", label: "Blue" },
  { value: "#b91c1c", label: "Red" },
];

/* ───────────────────────── Rendering ───────────────────────── */

/** Strokes are drawn as quadratic curves through the midpoints between samples, which smooths jitter. */
function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Point[][], color: string, width: number) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const points of strokes) {
    if (!points.length) continue;
    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const mid = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 };
      ctx.quadraticCurveTo(points[i].x, points[i].y, mid.x, mid.y);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }
}

/** Crops a canvas to its visible pixels plus a small margin. Returns null when it is empty. */
export function trimCanvas(canvas: HTMLCanvasElement): Signature | null {
  const { width, height } = canvas;
  const data = context2d(canvas).getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const pad = 4;
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  const w = Math.min(width, maxX + pad + 1) - x;
  const h = Math.min(height, maxY + pad + 1) - y;
  const out = createCanvas(w, h);
  context2d(out).drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return { dataUrl: out.toDataURL("image/png"), width: out.width, height: out.height };
}

function renderDrawn(s: PadState): Signature | null {
  if (!s.strokes.length) return null;
  const canvas = createCanvas(PAD_WIDTH, PAD_HEIGHT);
  drawStrokes(context2d(canvas), s.strokes, s.color, s.penWidth);
  return trimCanvas(canvas);
}

function renderTyped(s: PadState): Signature | null {
  const text = s.typed.trim();
  if (!text) return null;
  const font = `${TYPED_SIZE}px ${FONTS[s.font].stack}`;
  const measure = context2d(createCanvas(1, 1));
  measure.font = font;
  // Script fonts have long swashes, so leave generous room before trimming.
  const canvas = createCanvas(measure.measureText(text).width + TYPED_SIZE, TYPED_SIZE * 2);
  const ctx = context2d(canvas);
  ctx.font = font;
  ctx.fillStyle = s.color;
  ctx.textBaseline = "middle";
  ctx.fillText(text, TYPED_SIZE / 2, TYPED_SIZE);
  return trimCanvas(canvas);
}

/** Light paper turns transparent and the ink is recoloured, with a soft edge so strokes stay smooth. */
function removePaper(ctx: CanvasRenderingContext2D, color: string) {
  const { width, height } = ctx.canvas;
  const image = ctx.getImageData(0, 0, width, height);
  const px = image.data;
  const ink = hexToRgb(color) ?? { r: 0, g: 0, b: 0 };
  for (let i = 0; i < px.length; i += 4) {
    const light = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    const strength = Math.min(1, Math.max(0, (210 - light) / 90));
    px[i] = ink.r;
    px[i + 1] = ink.g;
    px[i + 2] = ink.b;
    px[i + 3] = Math.round(px[i + 3] * strength);
  }
  ctx.putImageData(image, 0, 0);
}

function renderUpload(s: PadState): Signature | null {
  if (!s.upload) return null;
  const size = fitWithin(s.upload.width, s.upload.height, UPLOAD_MAX);
  const canvas = createCanvas(size.width, size.height);
  const ctx = context2d(canvas);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(s.upload.image, 0, 0, size.width, size.height);
  if (s.removeBackground) removePaper(ctx, s.color);
  return trimCanvas(canvas);
}

function renderSignature(s: PadState): Signature | null {
  if (s.mode === "draw") return renderDrawn(s);
  if (s.mode === "type") return renderTyped(s);
  return renderUpload(s);
}

/* ───────────────────────── UI ───────────────────────── */

function DrawPad({
  strokes,
  color,
  penWidth,
  onStroke,
}: {
  strokes: Point[][];
  color: string;
  penWidth: number;
  onStroke: (points: Point[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const current = useRef<Point[] | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) drawStrokes(context2d(canvas), strokes, color, penWidth);
  }, [strokes, color, penWidth]);

  function pointsFrom(e: PointerEvent<HTMLCanvasElement>): Point[] {
    const rect = e.currentTarget.getBoundingClientRect();
    const native = e.nativeEvent;
    // Coalesced events carry the samples between frames, which keeps fast strokes smooth.
    const samples = typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];
    return (samples.length ? samples : [native]).map((s) => ({
      x: ((s.clientX - rect.left) * PAD_WIDTH) / rect.width,
      y: ((s.clientY - rect.top) * PAD_HEIGHT) / rect.height,
    }));
  }

  function start(e: PointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    current.current = pointsFrom(e).slice(-1);
    drawStrokes(context2d(e.currentTarget), [...strokes, current.current], color, penWidth);
  }

  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (!current.current) return;
    current.current.push(...pointsFrom(e));
    drawStrokes(context2d(e.currentTarget), [...strokes, current.current], color, penWidth);
  }

  function end() {
    const points = current.current;
    current.current = null;
    if (points?.length) onStroke(points);
  }

  return (
    <canvas
      ref={canvasRef}
      width={PAD_WIDTH}
      height={PAD_HEIGHT}
      role="img"
      aria-label="Signature drawing area. Draw with a mouse, pen or finger. Keyboard users can type their signature instead."
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className="block aspect-[3/1] w-full cursor-crosshair touch-none rounded-lg border border-line bg-white"
    />
  );
}

export function SignaturePad({ onChange }: { onChange: (signature: Signature | null) => void }) {
  const [state, setState] = useState<PadState>({
    mode: "draw",
    color: INK_COLORS[0].value,
    penWidth: 6,
    strokes: [],
    typed: "",
    font: "segoe",
    upload: null,
    removeBackground: true,
  });
  const [output, setOutput] = useState<Signature | null>(null);
  const [error, setError] = useState("");

  /** Updates the settings and immediately re-renders the signature for the active mode. */
  function apply(patch: Partial<PadState>) {
    const next = { ...state, ...patch };
    setState(next);
    let signature: Signature | null = null;
    try {
      signature = renderSignature(next);
      setError("");
    } catch (e) {
      setError(errorMessage(e, "The signature could not be created."));
    }
    setOutput(signature);
    onChange(signature);
  }

  async function openUpload(files: File[]) {
    setError("");
    try {
      apply({ upload: await openImage(files[0]) });
    } catch (e) {
      setError(errorMessage(e, "This image could not be opened."));
    }
  }

  return (
    <div className="space-y-4">
      <Segmented<Mode>
        label="How to create your signature"
        value={state.mode}
        onChange={(mode) => apply({ mode })}
        options={[
          { value: "draw", label: "Draw" },
          { value: "type", label: "Type" },
          { value: "upload", label: "Upload" },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-ink">Ink</span>
        <div role="radiogroup" aria-label="Ink colour" className="flex gap-2">
          {INK_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={state.color === c.value}
              aria-label={c.label}
              title={c.label}
              onClick={() => apply({ color: c.value })}
              className={cn(
                "size-7 rounded-full border-2 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                state.color === c.value ? "border-surface ring-2 ring-primary" : "border-line",
              )}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>
      </div>

      {state.mode === "draw" ? (
        <div className="space-y-3">
          <DrawPad
            strokes={state.strokes}
            color={state.color}
            penWidth={state.penWidth}
            onStroke={(points) => apply({ strokes: [...state.strokes, points] })}
          />
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <RangeField
                label="Pen width"
                value={state.penWidth}
                min={2}
                max={16}
                onChange={(penWidth) => apply({ penWidth })}
              />
            </div>
            <Button size="sm" variant="outline" disabled={!state.strokes.length} onClick={() => apply({ strokes: state.strokes.slice(0, -1) })}>
              <Undo2 aria-hidden />
              Undo
            </Button>
            <Button size="sm" variant="outline" disabled={!state.strokes.length} onClick={() => apply({ strokes: [] })}>
              <Eraser aria-hidden />
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      {state.mode === "type" ? (
        <div className="space-y-3">
          <Field label="Your name" htmlFor="signature-name">
            <Input
              id="signature-name"
              value={state.typed}
              maxLength={60}
              autoComplete="name"
              placeholder="e.g. Jane Smith"
              onChange={(e) => apply({ typed: e.target.value })}
            />
          </Field>
          <Segmented<FontKey>
            label="Signature style"
            value={state.font}
            onChange={(font) => apply({ font })}
            options={(Object.keys(FONTS) as FontKey[]).map((key) => ({
              value: key,
              label: <span style={{ fontFamily: FONTS[key].stack }}>{FONTS[key].label}</span>,
            }))}
          />
          <div className="flex min-h-28 items-center overflow-hidden rounded-lg border border-line bg-white px-4">
            <p
              className="truncate text-5xl leading-normal"
              style={{ fontFamily: FONTS[state.font].stack, color: state.color }}
              aria-hidden
            >
              {state.typed || <span className="text-gray-300">Your signature</span>}
            </p>
          </div>
        </div>
      ) : null}

      {state.mode === "upload" ? (
        <div className="space-y-3">
          <FileDropzone
            accept={RASTER_ACCEPT}
            compact
            onFiles={openUpload}
            label={state.upload ? "Choose a different picture" : "Drop a picture of your signature or click to choose"}
            hint="A photo or scan of your signature on white paper works best."
          />
          {state.upload ? (
            <>
              <Checkbox
                label="Remove the paper background and use the ink colour"
                checked={state.removeBackground}
                onChange={(e) => apply({ removeBackground: e.target.checked })}
              />
              <div className="flex min-h-28 items-center justify-center rounded-lg border border-line p-3" style={CHECKERBOARD}>
                {output ? (
                  <PreviewImage src={output.dataUrl} alt="Your uploaded signature" className="max-h-32 max-w-full" />
                ) : (
                  <p className="text-sm text-muted">No signature was found in this picture.</p>
                )}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      <ErrorText>{error}</ErrorText>
    </div>
  );
}
