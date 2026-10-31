"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Grid3x3, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { ErrorText, FileDropzone, FileRow, Panel, RangeField, Spinner, ToolColumns } from "@/components/tool-ui";
import { createCanvas, downloadBlob, downloadZip, MIME_EXTENSION, renameExtension, withSuffix } from "@/lib/files";
import { cn, formatBytes, uid } from "@/lib/utils";
import { useTool } from "@/tools/context";
import {
  assertCanvasSize,
  context2d,
  errorMessage,
  exportCanvas,
  fitWithin,
  openImage,
  outputTypeFor,
  RASTER_ACCEPT,
  type SourceImage,
} from "@/tools/lib/image";
import { ColorField, ImageThumb, PreviewFrame } from "@/tools/lib/image-ui";

type Vertical = "top" | "middle" | "bottom";
type Horizontal = "left" | "center" | "right";
type Position = `${Vertical}-${Horizontal}` | "tile";

interface Settings {
  text: string;
  /** Font size as a percentage of the image width. */
  size: number;
  color: string;
  /** 0–100. */
  opacity: number;
  position: Position;
  /** Distance from the edges (or spacing between tiles) as a percentage of the image width. */
  margin: number;
  bold: boolean;
  shadow: boolean;
}

interface Item {
  id: string;
  file: File;
  result?: { blob: Blob; name: string };
  error?: string;
}

const VERTICALS: Vertical[] = ["top", "middle", "bottom"];
const HORIZONTALS: Horizontal[] = ["left", "center", "right"];
const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const PREVIEW_MAX = 900;

const DEFAULTS: Settings = {
  text: "© Your Name",
  size: 5,
  color: "#ffffff",
  opacity: 70,
  position: "bottom-right",
  margin: 3,
  bold: true,
  shadow: true,
};

/** Draws the watermark over a canvas that already contains the image. All sizes scale with the width. */
function drawWatermark(ctx: CanvasRenderingContext2D, s: Settings) {
  const { width: w, height: h } = ctx.canvas;
  const text = s.text.trim();
  if (!text) return;

  let fontPx = Math.max(1, (w * s.size) / 100);
  const marginPx = (w * s.margin) / 100;
  const setFont = () => {
    ctx.font = `${s.bold ? 700 : 400} ${fontPx}px ${FONT_STACK}`;
  };

  ctx.save();
  setFont();
  ctx.fillStyle = s.color;
  ctx.globalAlpha = s.opacity / 100;
  if (s.shadow) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = fontPx * 0.15;
    ctx.shadowOffsetY = fontPx * 0.04;
  }

  if (s.position === "tile") {
    const textW = ctx.measureText(text).width;
    const stepX = Math.max(1, textW + fontPx * 2 + marginPx);
    const stepY = Math.max(1, fontPx * 3 + marginPx);
    const reach = Math.hypot(w, h) / 2 + stepX;
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let y = -reach, row = 0; y <= reach; y += stepY, row++) {
      const offset = row % 2 ? stepX / 2 : 0;
      for (let x = -reach + offset; x <= reach; x += stepX) ctx.fillText(text, x, y);
    }
  } else {
    // Shrink long text so it always fits between the margins.
    const room = Math.max(1, w - marginPx * 2);
    const textW = ctx.measureText(text).width;
    if (textW > room) {
      fontPx *= room / textW;
      setFont();
    }
    const [vertical, horizontal] = s.position.split("-") as [Vertical, Horizontal];
    ctx.textAlign = horizontal;
    ctx.textBaseline = vertical;
    const x = horizontal === "left" ? marginPx : horizontal === "right" ? w - marginPx : w / 2;
    const y = vertical === "top" ? marginPx : vertical === "bottom" ? h - marginPx : h / 2;
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}

async function watermark(file: File, settings: Settings) {
  const { image, width, height } = await openImage(file);
  assertCanvasSize(width, height);
  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas);
  ctx.drawImage(image, 0, 0);
  drawWatermark(ctx, settings);
  const type = outputTypeFor(file.type);
  const blob = await exportCanvas(canvas, type);
  return { blob, name: withSuffix(renameExtension(file.name, MIME_EXTENSION[type]), "-watermarked") };
}

function PositionPicker({ value, onChange }: { value: Position; onChange: (p: Position) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink">Position</p>
      <div role="radiogroup" aria-label="Position" className="flex flex-wrap items-start gap-3">
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-paper p-1">
          {VERTICALS.flatMap((v) =>
            HORIZONTALS.map((hz) => {
              const pos: Position = `${v}-${hz}`;
              const selected = value === pos;
              return (
                <button
                  key={pos}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={v === "middle" && hz === "center" ? "Centre" : `${v.charAt(0).toUpperCase()}${v.slice(1)} ${hz}`}
                  onClick={() => onChange(pos)}
                  className={cn(
                    "grid size-9 place-items-center rounded-md transition-colors",
                    selected ? "bg-surface ring-1 ring-line" : "hover:bg-surface",
                  )}
                >
                  <span className={cn("size-2.5 rounded-full", selected ? "bg-primary" : "bg-line")} />
                </button>
              );
            }),
          )}
        </div>
        <Button
          role="radio"
          aria-checked={value === "tile"}
          variant={value === "tile" ? "secondary" : "outline"}
          onClick={() => onChange("tile")}
        >
          <Grid3x3 aria-hidden />
          Tiled pattern
        </Button>
      </div>
    </div>
  );
}

export default function ImageWatermark() {
  const { track } = useTool();
  const [items, setItems] = useState<Item[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [preview, setPreview] = useState<SourceImage | null>(null);
  const [previewError, setPreviewError] = useState<{ file: File; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const first = items[0]?.file ?? null;
  const previewSource = preview && preview.file === first ? preview : null;
  const done = items.filter((i) => i.result);

  // Decode the first image for the live preview.
  useEffect(() => {
    if (!first) return;
    let cancelled = false;
    openImage(first)
      .then((img) => {
        if (!cancelled) setPreview(img);
      })
      .catch((e: unknown) => {
        if (!cancelled) setPreviewError({ file: first, message: errorMessage(e, "This image could not be previewed.") });
      });
    return () => {
      cancelled = true;
    };
  }, [first]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !previewSource) return;
    const size = fitWithin(previewSource.width, previewSource.height, PREVIEW_MAX);
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = context2d(canvas);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(previewSource.image, 0, 0, size.width, size.height);
    drawWatermark(ctx, settings);
  }, [previewSource, settings]);

  /** Changing a setting makes earlier results stale, so they are cleared. */
  function update(patch: Partial<Settings>) {
    setSettings((prev) => ({ ...prev, ...patch }));
    setItems((prev) => prev.map((i) => ({ ...i, result: undefined, error: undefined })));
  }

  async function run() {
    if (!settings.text.trim()) {
      setError("Type the watermark text first.");
      return;
    }
    setBusy(true);
    setError("");
    const next: Item[] = [];
    for (const item of items) {
      try {
        next.push({ ...item, result: await watermark(item.file, settings), error: undefined });
      } catch (e) {
        next.push({ ...item, result: undefined, error: errorMessage(e, "The watermark could not be added.") });
      }
    }
    setItems(next);
    setBusy(false);
    if (next.some((i) => i.result)) track();
    else setError("None of the images could be watermarked. Try a different file.");
  }

  return (
    <div className="space-y-4">
      <FileDropzone
        accept={RASTER_ACCEPT}
        multiple
        currentCount={items.length}
        compact={items.length > 0}
        label={items.length ? "Add more images" : undefined}
        onFiles={(files) => setItems((prev) => [...prev, ...files.map((file) => ({ id: uid(), file }))])}
      />

      {items.length ? (
        <>
          <ToolColumns>
            <Panel title="Watermark">
              <div className="space-y-4">
                <Field label="Text" htmlFor="watermark-text">
                  <Input
                    id="watermark-text"
                    value={settings.text}
                    maxLength={200}
                    placeholder="© Your Name"
                    onChange={(e) => update({ text: e.target.value })}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <RangeField
                    label="Font size"
                    value={settings.size}
                    min={1}
                    max={30}
                    step={0.5}
                    onChange={(size) => update({ size })}
                    format={(v) => `${v}% of width`}
                  />
                  <RangeField
                    label="Opacity"
                    value={settings.opacity}
                    min={5}
                    max={100}
                    onChange={(opacity) => update({ opacity })}
                    format={(v) => `${v}%`}
                  />
                  <RangeField
                    label={settings.position === "tile" ? "Spacing" : "Margin"}
                    value={settings.margin}
                    min={0}
                    max={20}
                    step={0.5}
                    onChange={(margin) => update({ margin })}
                    format={(v) => `${v}%`}
                  />
                  <ColorField id="watermark-color" label="Colour" value={settings.color} onChange={(color) => update({ color })} />
                </div>
                <PositionPicker value={settings.position} onChange={(position) => update({ position })} />
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <Checkbox label="Bold" checked={settings.bold} onChange={(e) => update({ bold: e.target.checked })} />
                  <Checkbox label="Drop shadow" checked={settings.shadow} onChange={(e) => update({ shadow: e.target.checked })} />
                </div>
              </div>
            </Panel>

            <Panel title={items.length > 1 ? "Preview (first image)" : "Preview"}>
              <PreviewFrame className="min-h-64">
                {previewSource ? (
                  <canvas
                    ref={canvasRef}
                    role="img"
                    aria-label={`Preview of ${previewSource.file.name} with the watermark`}
                    className="max-h-[28rem] max-w-full"
                  />
                ) : previewError && previewError.file === first ? (
                  <p className="text-sm text-muted">{previewError.message}</p>
                ) : (
                  <Spinner />
                )}
              </PreviewFrame>
            </Panel>
          </ToolColumns>

          <ul className="space-y-2">
            {items.map((item) => (
              <FileRow
                key={item.id}
                name={item.file.name}
                size={item.file.size}
                thumbnail={<ImageThumb file={item.file} />}
                meta={
                  item.error ? (
                    <span className="text-red-600 dark:text-red-400">{item.error}</span>
                  ) : item.result ? (
                    <span>Watermarked ({formatBytes(item.result.blob.size)})</span>
                  ) : null
                }
                actions={
                  item.result ? (
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Download ${item.result.name}`}
                      onClick={() => item.result && downloadBlob(item.result.blob, item.result.name)}
                    >
                      <Download aria-hidden />
                      <span className="hidden sm:inline">Download</span>
                    </Button>
                  ) : null
                }
                onRemove={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
              />
            ))}
          </ul>

          <ErrorText>{error}</ErrorText>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={run} disabled={busy}>
              {busy ? <Spinner /> : null}
              {busy ? "Adding watermark…" : `Watermark ${items.length} image${items.length > 1 ? "s" : ""}`}
            </Button>
            {done.length > 1 ? (
              <Button
                variant="outline"
                onClick={() =>
                  downloadZip(
                    done.flatMap((i) => (i.result ? [{ name: i.result.name, data: i.result.blob }] : [])),
                    "watermarked-images.zip",
                  )
                }
              >
                <Package aria-hidden />
                Download all as ZIP
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
