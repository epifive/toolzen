"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Download, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, FileDropzone, Panel, RangeField, Segmented, Spinner, ToolColumns } from "@/components/tool-ui";
import { canvasToBlob, createCanvas, downloadBlob, renameExtension, withSuffix } from "@/lib/files";
import { useTool } from "@/tools/context";
import {
  CHECKERBOARD,
  clamp,
  context2d,
  drawScaled,
  errorMessage,
  openImage,
  RASTER_ACCEPT,
  type SourceImage,
} from "@/tools/lib/image";
import { ColorField } from "@/tools/lib/image-ui";

type OutputSize = "256" | "512" | "1024";

interface View {
  /** 1 fills the circle with the image's shorter side. */
  zoom: number;
  /** Offset of the image centre from the circle centre, as a fraction of the circle diameter. */
  x: number;
  y: number;
}

interface Ring {
  /** Ring thickness as a percentage of the diameter. 0 means no ring. */
  width: number;
  color: string;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const PREVIEW_SIZE = 640;
const INITIAL_VIEW: View = { zoom: 1, x: 0, y: 0 };

/** Keeps the image covering the whole circle at the current zoom. */
function constrain(view: View, width: number, height: number): View {
  const zoom = clamp(view.zoom, MIN_ZOOM, MAX_ZOOM);
  const short = Math.min(width, height);
  const maxX = ((width / short) * zoom - 1) / 2;
  const maxY = ((height / short) * zoom - 1) / 2;
  return { zoom, x: clamp(view.x, -maxX, maxX), y: clamp(view.y, -maxY, maxY) };
}

function drawRing(ctx: CanvasRenderingContext2D, size: number, ring: Ring) {
  if (ring.width <= 0) return;
  const lineWidth = (size * ring.width) / 100;
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - lineWidth / 2, 0, Math.PI * 2);
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = ring.color;
  ctx.stroke();
  ctx.restore();
}

/** Editor preview: the full image dimmed, the circle at full strength and the ring on top. */
function drawPreview(canvas: HTMLCanvasElement, source: SourceImage, view: View, ring: Ring) {
  const ctx = context2d(canvas);
  const size = canvas.width;
  const scale = (size / Math.min(source.width, source.height)) * view.zoom;
  const w = source.width * scale;
  const h = source.height * scale;
  const left = size / 2 + view.x * size - w / 2;
  const top = size / 2 + view.y * size - h / 2;

  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingQuality = "high";
  ctx.globalAlpha = 0.35;
  ctx.drawImage(source.image, left, top, w, h);
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(source.image, left, top, w, h);
  ctx.restore();
  drawRing(ctx, size, ring);
}

/** Final image: a square crop scaled to `size`, masked to a circle, with transparent corners. */
function renderCircle(source: SourceImage, view: View, ring: Ring, size: number): HTMLCanvasElement {
  const side = Math.min(source.width, source.height) / view.zoom;
  const x = clamp(source.width / 2 - view.x * side - side / 2, 0, source.width - side);
  const y = clamp(source.height / 2 - view.y * side - side / 2, 0, source.height - side);
  const square = drawScaled(source.image, { x, y, width: side, height: side }, size, size);

  const out = createCanvas(size, size);
  const ctx = context2d(out);
  ctx.drawImage(square, 0, 0);
  ctx.globalCompositeOperation = "destination-in";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  drawRing(ctx, size, ring);
  return out;
}

interface Drag {
  pointerX: number;
  pointerY: number;
  start: View;
  frameSize: number;
}

export default function CircleCropImage() {
  const { track } = useTool();
  const [source, setSource] = useState<SourceImage | null>(null);
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const [ring, setRing] = useState<Ring>({ width: 0, color: "#ffffff" });
  const [size, setSize] = useState<OutputSize>("512");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<Drag | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && source) drawPreview(canvas, source, view, ring);
  }, [source, view, ring]);

  async function open(files: File[]) {
    setError("");
    try {
      setSource(await openImage(files[0]));
      setView(INITIAL_VIEW);
    } catch (e) {
      setError(errorMessage(e, "This image could not be opened."));
    }
  }

  function updateView(next: View) {
    if (source) setView(constrain(next, source.width, source.height));
  }

  function startDrag(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      start: view,
      frameSize: e.currentTarget.getBoundingClientRect().width,
    };
  }

  function moveDrag(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    updateView({
      ...drag.start,
      x: drag.start.x + (e.clientX - drag.pointerX) / drag.frameSize,
      y: drag.start.y + (e.clientY - drag.pointerY) / drag.frameSize,
    });
  }

  function endDrag() {
    dragRef.current = null;
  }

  function handleKey(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 0.05 : 0.01;
    const actions: Record<string, () => View> = {
      ArrowLeft: () => ({ ...view, x: view.x - step }),
      ArrowRight: () => ({ ...view, x: view.x + step }),
      ArrowUp: () => ({ ...view, y: view.y - step }),
      ArrowDown: () => ({ ...view, y: view.y + step }),
      "+": () => ({ ...view, zoom: view.zoom + 0.1 }),
      "=": () => ({ ...view, zoom: view.zoom + 0.1 }),
      "-": () => ({ ...view, zoom: view.zoom - 0.1 }),
    };
    const action = actions[e.key];
    if (!action) return;
    e.preventDefault();
    updateView(action());
  }

  async function download() {
    if (!source) return;
    setBusy(true);
    setError("");
    try {
      const canvas = renderCircle(source, view, ring, Number(size));
      const blob = await canvasToBlob(canvas, "image/png");
      downloadBlob(blob, withSuffix(renameExtension(source.file.name, "png"), `-circle-${size}`));
      track();
    } catch (e) {
      setError(errorMessage(e, "The image could not be cropped."));
    } finally {
      setBusy(false);
    }
  }

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
          <ToolColumns>
            <Panel
              title="Position"
              actions={
                <Button size="sm" variant="ghost" onClick={() => setView(INITIAL_VIEW)}>
                  <Undo2 aria-hidden />
                  Reset
                </Button>
              }
            >
              <div className="space-y-4">
                <div
                  role="group"
                  tabIndex={0}
                  aria-label="Circle crop. Drag the photo or use the arrow keys to move it; press plus or minus to zoom."
                  onPointerDown={startDrag}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onKeyDown={handleKey}
                  className="mx-auto aspect-square w-full max-w-[20rem] cursor-grab touch-none overflow-hidden rounded-lg border border-line active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  style={CHECKERBOARD}
                >
                  <canvas ref={canvasRef} width={PREVIEW_SIZE} height={PREVIEW_SIZE} aria-hidden className="block size-full" />
                </div>
                <RangeField
                  label="Zoom"
                  value={view.zoom}
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={0.05}
                  onChange={(zoom) => updateView({ ...view, zoom })}
                  format={(v) => `${Math.round(v * 100)}%`}
                />
              </div>
            </Panel>

            <Panel title="Output">
              <div className="space-y-4">
                <div>
                  <p className="mb-1.5 text-sm font-medium text-ink">Size</p>
                  <Segmented<OutputSize>
                    label="Output size"
                    value={size}
                    onChange={setSize}
                    options={[
                      { value: "256", label: "256 px" },
                      { value: "512", label: "512 px" },
                      { value: "1024", label: "1024 px" },
                    ]}
                  />
                </div>
                <RangeField
                  label="Border ring"
                  value={ring.width}
                  min={0}
                  max={12}
                  step={0.5}
                  onChange={(width) => setRing((r) => ({ ...r, width }))}
                  format={(v) => (v ? `${v}% of size` : "None")}
                />
                {ring.width > 0 ? (
                  <ColorField
                    id="circle-ring-color"
                    label="Ring colour"
                    value={ring.color}
                    onChange={(color) => setRing((r) => ({ ...r, color }))}
                  />
                ) : null}
                <p className="text-sm text-muted">
                  The result is a {size} × {size} px PNG with transparent corners, ready for profile pictures and avatars.
                </p>
              </div>
            </Panel>
          </ToolColumns>

          <ErrorText>{error}</ErrorText>

          <Button onClick={download} disabled={busy}>
            {busy ? <Spinner /> : <Download aria-hidden />}
            {busy ? "Creating…" : "Download circle PNG"}
          </Button>
        </>
      ) : (
        <ErrorText>{error}</ErrorText>
      )}
    </div>
  );
}
