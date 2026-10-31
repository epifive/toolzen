"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, FileDropzone, Panel, RangeField, Segmented, Spinner } from "@/components/tool-ui";
import { createCanvas, downloadBlob, MIME_EXTENSION, renameExtension, withSuffix } from "@/lib/files";
import { useTool } from "@/tools/context";
import {
  assertCanvasSize,
  CHECKERBOARD,
  clamp,
  context2d,
  drawScaled,
  errorMessage,
  exportCanvas,
  fitWithin,
  formatLabel,
  openImage,
  outputTypeFor,
  RASTER_ACCEPT,
  type SourceImage,
} from "@/tools/lib/image";
import { NumberField } from "@/tools/lib/image-ui";

type Mode = "whole" | "area";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Drag {
  kind: "move" | "draw";
  /** Pointer position where the drag started, in image pixels. */
  originX: number;
  originY: number;
  start: Rect;
}

const PREVIEW_MAX = 900;
const MAX_BLOCK = 200;

function maxBlockFor(source: SourceImage): number {
  return clamp(Math.round(Math.min(source.width, source.height) / 4), 4, MAX_BLOCK);
}

function defaultSelection(width: number, height: number): Rect {
  const w = Math.max(1, Math.round(width * 0.4));
  const h = Math.max(1, Math.round(height * 0.4));
  return { x: Math.round((width - w) / 2), y: Math.round((height - h) / 2), width: w, height: h };
}

/** Replaces a region of the canvas with blocks of roughly `block` pixels, each the average colour of its area. */
function pixelate(ctx: CanvasRenderingContext2D, region: Rect, block: number) {
  const cols = Math.max(1, Math.round(region.width / block));
  const rows = Math.max(1, Math.round(region.height / block));
  const small = drawScaled(ctx.canvas, region, cols, rows);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, cols, rows, region.x, region.y, region.width, region.height);
  ctx.restore();
}

/**
 * Draws the image at `scale` (canvas pixels per image pixel) and pixelates the selected area, or
 * the whole image when `area` is null. The canvas must already have the scaled size.
 */
function render(canvas: HTMLCanvasElement, source: SourceImage, scale: number, block: number, area: Rect | null) {
  const ctx = context2d(canvas);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source.image, 0, 0, canvas.width, canvas.height);
  const region = area
    ? {
        x: Math.round(area.x * scale),
        y: Math.round(area.y * scale),
        width: Math.max(1, Math.round(area.width * scale)),
        height: Math.max(1, Math.round(area.height * scale)),
      }
    : { x: 0, y: 0, width: canvas.width, height: canvas.height };
  region.width = Math.min(region.width, canvas.width - region.x);
  region.height = Math.min(region.height, canvas.height - region.y);
  if (region.width > 0 && region.height > 0) pixelate(ctx, region, Math.max(1, block * scale));
}

export default function PixelateImage() {
  const { track } = useTool();
  const [source, setSource] = useState<SourceImage | null>(null);
  const [mode, setMode] = useState<Mode>("whole");
  const [block, setBlock] = useState(12);
  const [selection, setSelection] = useState<Rect>({ x: 0, y: 0, width: 1, height: 1 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<Drag | null>(null);

  const imageW = source?.width ?? 1;
  const imageH = source?.height ?? 1;
  const area = mode === "area" ? selection : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !source) return;
    const size = fitWithin(source.width, source.height, PREVIEW_MAX);
    canvas.width = size.width;
    canvas.height = size.height;
    render(canvas, source, size.scale, block, area);
  }, [source, block, area]);

  async function open(files: File[]) {
    setError("");
    try {
      const next = await openImage(files[0]);
      setSource(next);
      setSelection(defaultSelection(next.width, next.height));
      setBlock(clamp(Math.round(Math.min(next.width, next.height) / 40), 4, maxBlockFor(next)));
    } catch (e) {
      setError(errorMessage(e, "This image could not be opened."));
    }
  }

  /* ── Selecting an area ── */

  function imagePoint(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: clamp(((e.clientX - rect.left) / rect.width) * imageW, 0, imageW),
      y: clamp(((e.clientY - rect.top) / rect.height) * imageH, 0, imageH),
    };
  }

  function startDrag(e: PointerEvent<HTMLDivElement>) {
    if (mode !== "area" || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = imagePoint(e);
    const inside =
      p.x >= selection.x &&
      p.x <= selection.x + selection.width &&
      p.y >= selection.y &&
      p.y <= selection.y + selection.height;
    dragRef.current = { kind: inside ? "move" : "draw", originX: p.x, originY: p.y, start: selection };
  }

  function moveDrag(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const p = imagePoint(e);
    if (drag.kind === "move") {
      setSelection({
        ...drag.start,
        x: Math.round(clamp(drag.start.x + p.x - drag.originX, 0, imageW - drag.start.width)),
        y: Math.round(clamp(drag.start.y + p.y - drag.originY, 0, imageH - drag.start.height)),
      });
      return;
    }
    const x = Math.round(Math.min(p.x, drag.originX));
    const y = Math.round(Math.min(p.y, drag.originY));
    setSelection({
      x,
      y,
      width: Math.max(1, Math.round(Math.max(p.x, drag.originX)) - x),
      height: Math.max(1, Math.round(Math.max(p.y, drag.originY)) - y),
    });
  }

  function endDrag() {
    const drag = dragRef.current;
    dragRef.current = null;
    // A click without dragging would leave a 1-pixel area; keep the previous selection instead.
    if (drag?.kind === "draw" && (selection.width < 4 || selection.height < 4)) setSelection(drag.start);
  }

  function handleKey(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 10 : 1;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    setSelection((s) => ({
      ...s,
      x: clamp(s.x + move[0], 0, imageW - s.width),
      y: clamp(s.y + move[1], 0, imageH - s.height),
    }));
  }

  function patchSelection(patch: Partial<Rect>) {
    setSelection((s) => {
      const next = { ...s, ...patch };
      const x = clamp(next.x, 0, imageW - 1);
      const y = clamp(next.y, 0, imageH - 1);
      return { x, y, width: clamp(next.width, 1, imageW - x), height: clamp(next.height, 1, imageH - y) };
    });
  }

  async function download() {
    if (!source) return;
    setBusy(true);
    setError("");
    try {
      assertCanvasSize(source.width, source.height);
      const canvas = createCanvas(source.width, source.height);
      render(canvas, source, 1, block, area);
      const type = outputTypeFor(source.file.type);
      const blob = await exportCanvas(canvas, type);
      downloadBlob(blob, withSuffix(renameExtension(source.file.name, MIME_EXTENSION[type]), "-pixelated"));
      track();
    } catch (e) {
      setError(errorMessage(e, "The image could not be pixelated."));
    } finally {
      setBusy(false);
    }
  }

  const pct = (value: number, total: number) => `${(value / total) * 100}%`;
  const type = outputTypeFor(source?.file.type ?? "");

  return (
    <div className="space-y-4">
      <FileDropzone
        accept={RASTER_ACCEPT}
        onFiles={open}
        compact={!!source}
        label={source ? "Choose a different image" : undefined}
      />

      {source ? (
        <>
          <Panel title="Pixelate">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-sm font-medium text-ink">Apply to</p>
                  <Segmented<Mode>
                    label="Apply to"
                    value={mode}
                    onChange={setMode}
                    options={[
                      { value: "whole", label: "Whole image" },
                      { value: "area", label: "Selected area" },
                    ]}
                  />
                </div>
                <RangeField
                  label="Pixel size"
                  value={block}
                  min={2}
                  max={maxBlockFor(source)}
                  onChange={setBlock}
                  format={(v) => `${v} px`}
                />
              </div>

              <div className="flex justify-center rounded-lg border border-line p-4" style={CHECKERBOARD}>
                <div
                  className={mode === "area" ? "relative min-w-0 max-w-full cursor-crosshair touch-none select-none" : "relative min-w-0 max-w-full"}
                  onPointerDown={startDrag}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  <canvas
                    ref={canvasRef}
                    role="img"
                    aria-label={`Preview of ${source.file.name}, pixelated`}
                    className="block max-h-[70vh] max-w-full"
                  />
                  {mode === "area" ? (
                    <div
                      role="group"
                      tabIndex={0}
                      aria-label={`Area to pixelate, ${selection.width} by ${selection.height} pixels. Use the arrow keys to move it; hold Shift to move faster.`}
                      onKeyDown={handleKey}
                      className="absolute cursor-move outline-2 outline-dashed outline-white shadow-[0_0_0_1px_rgb(0_0_0/0.6)] focus-visible:outline-primary"
                      style={{
                        left: pct(selection.x, imageW),
                        top: pct(selection.y, imageH),
                        width: pct(selection.width, imageW),
                        height: pct(selection.height, imageH),
                      }}
                    />
                  ) : null}
                </div>
              </div>

              {mode === "area" ? (
                <>
                  <p className="text-sm text-muted">Drag on the image to draw a new area, or drag inside the box to move it.</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <NumberField id="pixelate-x" label="X" value={selection.x} min={0} max={imageW - 1} suffix="px" onChange={(x) => patchSelection({ x })} />
                    <NumberField id="pixelate-y" label="Y" value={selection.y} min={0} max={imageH - 1} suffix="px" onChange={(y) => patchSelection({ y })} />
                    <NumberField
                      id="pixelate-width"
                      label="Width"
                      value={selection.width}
                      min={1}
                      max={imageW}
                      suffix="px"
                      onChange={(width) => patchSelection({ width })}
                    />
                    <NumberField
                      id="pixelate-height"
                      label="Height"
                      value={selection.height}
                      min={1}
                      max={imageH}
                      suffix="px"
                      onChange={(height) => patchSelection({ height })}
                    />
                  </div>
                </>
              ) : null}
            </div>
          </Panel>

          <ErrorText>{error}</ErrorText>

          <Button onClick={download} disabled={busy}>
            {busy ? <Spinner /> : <Download aria-hidden />}
            {busy ? "Pixelating…" : `Download pixelated ${formatLabel(type)}`}
          </Button>
        </>
      ) : (
        <ErrorText>{error}</ErrorText>
      )}
    </div>
  );
}
