"use client";

import { useEffect, useRef, useState } from "react";
import { Panel, Spinner, ToolColumns } from "@/components/tool-ui";
import { createCanvas, MIME_EXTENSION, renameExtension, withSuffix } from "@/lib/files";
import {
  assertCanvasSize,
  context2d,
  errorMessage,
  exportCanvas,
  fitWithin,
  openImage,
  outputTypeFor,
  RASTER_ACCEPT,
  type RasterType,
  type SourceImage,
} from "@/tools/lib/image";
import { BatchActions, BatchDropzone, BatchFileList, useImageBatch, type BatchResult } from "@/tools/lib/image-batch";
import { ColorField, NumberField, PreviewFrame } from "@/tools/lib/image-ui";

interface Settings {
  /** All sizes are in image pixels. */
  border: number;
  borderColor: string;
  padding: number;
  paddingColor: string;
  radius: number;
}

const DEFAULTS: Settings = { border: 20, borderColor: "#111827", padding: 0, paddingColor: "#ffffff", radius: 0 };
const PREVIEW_MAX = 900;
const MAX_SIZE = 2000;

/** Adds a rounded rectangle to the current path (works in browsers without CanvasRenderingContext2D.roundRect). */
function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Output size for an image of `width` × `height`, with every setting multiplied by `scale`. */
function framedSize(width: number, height: number, s: Settings, scale = 1) {
  const extra = 2 * (s.border + s.padding) * scale;
  return { width: Math.round(width * scale + extra), height: Math.round(height * scale + extra) };
}

/**
 * Draws the framed image onto `canvas`, which must already have the framed size. `scale` maps
 * image pixels to canvas pixels so the same code renders the preview and the final file.
 */
function drawFramed(canvas: HTMLCanvasElement, source: SourceImage, s: Settings, scale = 1) {
  const ctx = context2d(canvas);
  const { width: w, height: h } = canvas;
  const border = s.border * scale;
  const padding = s.padding * scale;
  const radius = s.radius * scale;

  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";

  roundedRect(ctx, 0, 0, w, h, radius);
  ctx.fillStyle = s.borderColor;
  ctx.fill();

  roundedRect(ctx, border, border, w - border * 2, h - border * 2, Math.max(0, radius - border));
  if (padding > 0) {
    ctx.fillStyle = s.paddingColor;
    ctx.fill();
  }

  const inset = border + padding;
  ctx.save();
  roundedRect(ctx, inset, inset, w - inset * 2, h - inset * 2, Math.max(0, radius - inset));
  ctx.clip();
  // Remove the frame fill behind the image so its transparent pixels stay transparent.
  ctx.clearRect(inset, inset, w - inset * 2, h - inset * 2);
  ctx.drawImage(source.image, inset, inset, w - inset * 2, h - inset * 2);
  ctx.restore();
}

/** Rounded corners need transparency, which JPG can't store. */
function outputType(file: File, s: Settings): RasterType {
  const type = outputTypeFor(file.type);
  return s.radius > 0 && type === "image/jpeg" ? "image/png" : type;
}

async function addBorder(file: File, settings: Settings): Promise<BatchResult> {
  const source = await openImage(file);
  const size = framedSize(source.width, source.height, settings);
  assertCanvasSize(size.width, size.height);
  const canvas = createCanvas(size.width, size.height);
  drawFramed(canvas, source, settings);
  const type = outputType(file, settings);
  const blob = await exportCanvas(canvas, type);
  return { blob, name: withSuffix(renameExtension(file.name, MIME_EXTENSION[type]), "-border") };
}

export default function AddBorderToImage() {
  const batch = useImageBatch();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [preview, setPreview] = useState<SourceImage | null>(null);
  const [previewError, setPreviewError] = useState<{ file: File; message: string } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const first = batch.items[0]?.file ?? null;
  const previewSource = preview && preview.file === first ? preview : null;

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
    const full = framedSize(previewSource.width, previewSource.height, settings);
    const { scale } = fitWithin(full.width, full.height, PREVIEW_MAX);
    const size = framedSize(previewSource.width, previewSource.height, settings, scale);
    canvas.width = size.width;
    canvas.height = size.height;
    drawFramed(canvas, previewSource, settings, scale);
  }, [previewSource, settings]);

  function update(patch: Partial<Settings>) {
    setSettings((prev) => ({ ...prev, ...patch }));
    batch.invalidate();
  }

  return (
    <div className="space-y-4">
      <BatchDropzone batch={batch} accept={RASTER_ACCEPT} />

      {batch.items.length ? (
        <>
          <ToolColumns>
            <Panel title="Border">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberField
                    id="border-width"
                    label="Border width"
                    value={settings.border}
                    min={0}
                    max={MAX_SIZE}
                    suffix="px"
                    onChange={(border) => update({ border })}
                  />
                  <ColorField
                    id="border-color"
                    label="Border colour"
                    value={settings.borderColor}
                    onChange={(borderColor) => update({ borderColor })}
                  />
                  <NumberField
                    id="border-padding"
                    label="Padding"
                    value={settings.padding}
                    min={0}
                    max={MAX_SIZE}
                    suffix="px"
                    hint="Space between the border and the image."
                    onChange={(padding) => update({ padding })}
                  />
                  {settings.padding > 0 ? (
                    <ColorField
                      id="border-padding-color"
                      label="Padding colour"
                      value={settings.paddingColor}
                      onChange={(paddingColor) => update({ paddingColor })}
                    />
                  ) : null}
                  <NumberField
                    id="border-radius"
                    label="Corner radius"
                    value={settings.radius}
                    min={0}
                    max={MAX_SIZE}
                    suffix="px"
                    hint={settings.radius > 0 ? "JPG images are saved as PNG to keep the rounded corners transparent." : "0 keeps square corners."}
                    onChange={(radius) => update({ radius })}
                  />
                </div>
                <p className="text-sm text-muted">Sizes are in image pixels and applied the same way to every image.</p>
              </div>
            </Panel>

            <Panel title={batch.items.length > 1 ? "Preview (first image)" : "Preview"}>
              <PreviewFrame className="min-h-64">
                {previewSource ? (
                  <canvas
                    ref={canvasRef}
                    role="img"
                    aria-label={`Preview of ${previewSource.file.name} with the border`}
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

          <BatchFileList batch={batch} />

          <BatchActions
            batch={batch}
            verb="Add border to"
            busyLabel="Adding borders…"
            zipName="images-with-border.zip"
            disabled={settings.border === 0 && settings.padding === 0 && settings.radius === 0}
            onRun={() => void batch.run((file) => addBorder(file, settings), "The border could not be added.")}
          />
        </>
      ) : null}
    </div>
  );
}
