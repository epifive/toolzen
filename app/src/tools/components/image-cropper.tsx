"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, FileDropzone, Panel, Segmented, Spinner, useObjectUrl } from "@/components/tool-ui";
import { createCanvas, downloadBlob, MIME_EXTENSION, renameExtension, withSuffix } from "@/lib/files";
import { cn } from "@/lib/utils";
import { useTool } from "@/tools/context";
import {
  CHECKERBOARD,
  clamp,
  context2d,
  errorMessage,
  exportCanvas,
  formatLabel,
  openImage,
  outputTypeFor,
  RASTER_ACCEPT,
  type SourceImage,
} from "@/tools/lib/image";
import { NumberField, PreviewImage } from "@/tools/lib/image-ui";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Aspect = "free" | "1:1" | "4:3" | "16:9" | "3:2" | "9:16";
type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type Handle = "move" | ResizeHandle;

const ASPECTS: Array<{ value: Aspect; label: string; ratio: number | null }> = [
  { value: "free", label: "Free", ratio: null },
  { value: "1:1", label: "1:1", ratio: 1 },
  { value: "4:3", label: "4:3", ratio: 4 / 3 },
  { value: "16:9", label: "16:9", ratio: 16 / 9 },
  { value: "3:2", label: "3:2", ratio: 3 / 2 },
  { value: "9:16", label: "9:16", ratio: 9 / 16 },
];

const EDGE_HANDLES: ResizeHandle[] = ["n", "s", "e", "w"];
const CORNER_HANDLES: ResizeHandle[] = ["nw", "ne", "sw", "se"];

const HANDLE_POSITION: Record<ResizeHandle, string> = {
  nw: "left-0 top-0 cursor-nwse-resize",
  n: "left-1/2 top-0 cursor-ns-resize",
  ne: "left-full top-0 cursor-nesw-resize",
  e: "left-full top-1/2 cursor-ew-resize",
  se: "left-full top-full cursor-nwse-resize",
  s: "left-1/2 top-full cursor-ns-resize",
  sw: "left-0 top-full cursor-nesw-resize",
  w: "left-0 top-1/2 cursor-ew-resize",
};

const HANDLE_LABEL: Record<ResizeHandle, string> = {
  nw: "top-left corner",
  n: "top edge",
  ne: "top-right corner",
  e: "right edge",
  se: "bottom-right corner",
  s: "bottom edge",
  sw: "bottom-left corner",
  w: "left edge",
};

interface Drag {
  handle: Handle;
  pointerX: number;
  pointerY: number;
  start: Rect;
  /** Image pixels per screen pixel. */
  scale: number;
}

/** Largest rectangle with the given ratio that fits the image, centred. */
function centeredRect(imageW: number, imageH: number, ratio: number | null): Rect {
  if (!ratio) {
    const width = Math.round(imageW * 0.8);
    const height = Math.round(imageH * 0.8);
    return { x: Math.round((imageW - width) / 2), y: Math.round((imageH - height) / 2), width, height };
  }
  let width = imageW;
  let height = width / ratio;
  if (height > imageH) {
    height = imageH;
    width = height * ratio;
  }
  width = Math.max(1, Math.round(width));
  height = Math.max(1, Math.round(height));
  return { x: Math.round((imageW - width) / 2), y: Math.round((imageH - height) / 2), width, height };
}

/** Apply a pointer movement (in image pixels) to the rectangle the drag started with. */
function dragRect(drag: Drag, dx: number, dy: number, imageW: number, imageH: number, ratio: number | null): Rect {
  const { handle, start } = drag;
  const min = Math.max(1, Math.min(8 * drag.scale, imageW, imageH));

  if (handle === "move") {
    return {
      ...start,
      x: clamp(start.x + dx, 0, imageW - start.width),
      y: clamp(start.y + dy, 0, imageH - start.height),
    };
  }

  if (ratio) {
    // Corner drag with a fixed ratio: the opposite corner stays anchored.
    const sx = handle.includes("e") ? 1 : -1;
    const sy = handle.includes("s") ? 1 : -1;
    const anchorX = sx > 0 ? start.x : start.x + start.width;
    const anchorY = sy > 0 ? start.y : start.y + start.height;
    const maxW = Math.min(sx > 0 ? imageW - anchorX : anchorX, (sy > 0 ? imageH - anchorY : anchorY) * ratio);
    const wanted = Math.max(start.width + sx * dx, (start.height + sy * dy) * ratio);
    const width = clamp(wanted, Math.min(min, maxW), maxW);
    const height = width / ratio;
    return { x: sx > 0 ? anchorX : anchorX - width, y: sy > 0 ? anchorY : anchorY - height, width, height };
  }

  let x1 = start.x;
  let y1 = start.y;
  let x2 = start.x + start.width;
  let y2 = start.y + start.height;
  if (handle.includes("w")) x1 = clamp(start.x + dx, 0, x2 - min);
  if (handle.includes("e")) x2 = clamp(x2 + dx, x1 + min, imageW);
  if (handle.includes("n")) y1 = clamp(start.y + dy, 0, y2 - min);
  if (handle.includes("s")) y2 = clamp(y2 + dy, y1 + min, imageH);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

/** Whole-pixel version of a rectangle that still lies inside the image. */
function roundRect(r: Rect, imageW: number, imageH: number): Rect {
  const x = clamp(Math.round(r.x), 0, imageW - 1);
  const y = clamp(Math.round(r.y), 0, imageH - 1);
  return {
    x,
    y,
    width: clamp(Math.round(r.width), 1, imageW - x),
    height: clamp(Math.round(r.height), 1, imageH - y),
  };
}

export default function ImageCropper() {
  const { track } = useTool();
  const [source, setSource] = useState<SourceImage | null>(null);
  const [crop, setCrop] = useState<Rect>({ x: 0, y: 0, width: 1, height: 1 });
  const [aspect, setAspect] = useState<Aspect>("free");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const previewUrl = useObjectUrl(source?.file);

  const ratio = ASPECTS.find((a) => a.value === aspect)?.ratio ?? null;
  const imageW = source?.width ?? 1;
  const imageH = source?.height ?? 1;
  const box = roundRect(crop, imageW, imageH);
  const type = outputTypeFor(source?.file.type ?? "");

  async function open(files: File[]) {
    setError("");
    try {
      const next = await openImage(files[0]);
      setSource(next);
      setCrop(centeredRect(next.width, next.height, ratio));
    } catch (e) {
      setError(errorMessage(e, "This image could not be opened."));
    }
  }

  function chooseAspect(value: Aspect) {
    setAspect(value);
    const nextRatio = ASPECTS.find((a) => a.value === value)?.ratio ?? null;
    if (nextRatio) setCrop(centeredRect(imageW, imageH, nextRatio));
  }

  /* ── Pointer interaction ── */

  function startDrag(e: PointerEvent<HTMLElement>, handle: Handle) {
    const frame = frameRef.current;
    if (!frame || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      handle,
      pointerX: e.clientX,
      pointerY: e.clientY,
      start: crop,
      scale: imageW / frame.getBoundingClientRect().width,
    };
  }

  function moveDrag(e: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (e.clientX - drag.pointerX) * drag.scale;
    const dy = (e.clientY - drag.pointerY) * drag.scale;
    setCrop(dragRect(drag, dx, dy, imageW, imageH, ratio));
  }

  function endDrag() {
    if (!dragRef.current) return;
    dragRef.current = null;
    setCrop((c) => roundRect(c, imageW, imageH));
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
    setCrop((c) => ({
      ...c,
      x: clamp(c.x + move[0], 0, imageW - c.width),
      y: clamp(c.y + move[1], 0, imageH - c.height),
    }));
  }

  /* ── Numeric inputs ── */

  function setX(x: number) {
    setCrop((c) => ({ ...c, x: clamp(x, 0, imageW - c.width) }));
  }

  function setY(y: number) {
    setCrop((c) => ({ ...c, y: clamp(y, 0, imageH - c.height) }));
  }

  function setWidth(value: number) {
    setCrop((c) => {
      let width = clamp(value, 1, imageW);
      let height = ratio ? Math.round(width / ratio) : c.height;
      if (height > imageH) {
        height = imageH;
        width = Math.round(height * (ratio ?? 1));
      }
      height = Math.max(1, height);
      return { x: Math.min(c.x, imageW - width), y: Math.min(c.y, imageH - height), width, height };
    });
  }

  function setHeight(value: number) {
    setCrop((c) => {
      let height = clamp(value, 1, imageH);
      let width = ratio ? Math.round(height * ratio) : c.width;
      if (width > imageW) {
        width = imageW;
        height = Math.round(width / (ratio ?? 1));
      }
      width = Math.max(1, width);
      return { x: Math.min(c.x, imageW - width), y: Math.min(c.y, imageH - height), width, height };
    });
  }

  async function download() {
    if (!source) return;
    setBusy(true);
    setError("");
    try {
      const canvas = createCanvas(box.width, box.height);
      context2d(canvas).drawImage(source.image, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
      const blob = await exportCanvas(canvas, type);
      downloadBlob(blob, withSuffix(renameExtension(source.file.name, MIME_EXTENSION[type]), "-cropped"));
      track();
    } catch (e) {
      setError(errorMessage(e, "The image could not be cropped."));
    } finally {
      setBusy(false);
    }
  }

  const pct = (value: number, total: number) => `${(value / total) * 100}%`;
  const cropStyle = {
    left: pct(crop.x, imageW),
    top: pct(crop.y, imageH),
    width: pct(crop.width, imageW),
    height: pct(crop.height, imageH),
  };
  const handles = ratio ? CORNER_HANDLES : [...CORNER_HANDLES, ...EDGE_HANDLES];

  return (
    <div className="space-y-4">
      <FileDropzone
        accept={RASTER_ACCEPT}
        onFiles={open}
        compact={!!source}
        label={source ? "Choose a different image" : undefined}
      />

      {source && previewUrl ? (
        <>
          <Panel title="Crop area">
            <div className="space-y-4">
              <Segmented label="Aspect ratio" value={aspect} onChange={chooseAspect} options={ASPECTS} />

              <div className="flex justify-center rounded-lg border border-line p-4" style={CHECKERBOARD}>
                <div
                  ref={frameRef}
                  className="relative min-w-0 max-w-full select-none"
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  <PreviewImage src={previewUrl} alt={source.file.name} className="block max-h-[70vh] max-w-full" />
                  <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute shadow-[0_0_0_9999px_rgb(0_0_0/0.55)]" style={cropStyle} />
                  </div>
                  <div
                    role="group"
                    tabIndex={0}
                    aria-label={`Crop area, ${box.width} by ${box.height} pixels. Use the arrow keys to move it; hold Shift to move faster.`}
                    onKeyDown={handleKey}
                    onPointerDown={(e) => startDrag(e, "move")}
                    className="absolute cursor-move touch-none outline outline-1 outline-white/90 focus-visible:outline-2 focus-visible:outline-primary"
                    style={cropStyle}
                  >
                    <div aria-hidden className="pointer-events-none absolute inset-0">
                      <div className="absolute inset-y-0 left-1/3 border-l border-white/40" />
                      <div className="absolute inset-y-0 left-2/3 border-l border-white/40" />
                      <div className="absolute inset-x-0 top-1/3 border-t border-white/40" />
                      <div className="absolute inset-x-0 top-2/3 border-t border-white/40" />
                    </div>
                    {handles.map((h) => (
                      <span
                        key={h}
                        aria-hidden
                        title={`Drag the ${HANDLE_LABEL[h]}`}
                        onPointerDown={(e) => startDrag(e, h)}
                        className={cn(
                          "absolute grid size-7 -translate-x-1/2 -translate-y-1/2 touch-none place-items-center",
                          HANDLE_POSITION[h],
                        )}
                      >
                        <span className="size-3 rounded-sm border border-black/40 bg-white shadow" />
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <NumberField id="crop-x" label="X" value={box.x} min={0} max={imageW - 1} suffix="px" onChange={setX} />
                <NumberField id="crop-y" label="Y" value={box.y} min={0} max={imageH - 1} suffix="px" onChange={setY} />
                <NumberField
                  id="crop-width"
                  label="Width"
                  value={box.width}
                  min={1}
                  max={imageW}
                  suffix="px"
                  onChange={setWidth}
                />
                <NumberField
                  id="crop-height"
                  label="Height"
                  value={box.height}
                  min={1}
                  max={imageH}
                  suffix="px"
                  onChange={setHeight}
                />
              </div>
              <p className="text-sm text-muted">
                Original image: {source.width} × {source.height} px. Values are in real image pixels.
              </p>
            </div>
          </Panel>

          <ErrorText>{error}</ErrorText>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={download} disabled={busy}>
              {busy ? <Spinner /> : <Download aria-hidden />}
              {busy ? "Cropping…" : `Download cropped ${formatLabel(type)}`}
            </Button>
            <Button variant="outline" onClick={() => setCrop(centeredRect(imageW, imageH, ratio))}>
              Reset crop area
            </Button>
          </div>
        </>
      ) : (
        <ErrorText>{error}</ErrorText>
      )}
    </div>
  );
}
