"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ErrorText, FileDropzone, Panel, RangeField, Spinner, ToolColumns } from "@/components/tool-ui";
import { createCanvas, downloadBlob, MIME_EXTENSION, renameExtension, withSuffix } from "@/lib/files";
import { cn } from "@/lib/utils";
import { useTool } from "@/tools/context";
import {
  assertCanvasSize,
  context2d,
  drawScaled,
  errorMessage,
  exportCanvas,
  fitWithin,
  openImage,
  outputTypeFor,
  RASTER_ACCEPT,
  type SourceImage,
} from "@/tools/lib/image";
import { PreviewFrame } from "@/tools/lib/image-ui";

interface Filters {
  brightness: number;
  contrast: number;
  saturate: number;
  grayscale: number;
  sepia: number;
  /** Blur radius in pixels of the full-size image. */
  blur: number;
  /** Colour cast blended in with soft-light, used by the Cool and Warm presets. */
  tint: { color: string; strength: number } | null;
}

const ORIGINAL: Filters = { brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, blur: 0, tint: null };

const PRESETS: Array<{ name: string; filters: Filters }> = [
  { name: "Original", filters: ORIGINAL },
  { name: "Grayscale", filters: { ...ORIGINAL, grayscale: 100 } },
  { name: "Sepia", filters: { ...ORIGINAL, sepia: 100 } },
  { name: "Vintage", filters: { ...ORIGINAL, brightness: 108, contrast: 85, saturate: 85, sepia: 45 } },
  { name: "Cool", filters: { ...ORIGINAL, brightness: 102, saturate: 105, tint: { color: "#3b82f6", strength: 0.35 } } },
  { name: "Warm", filters: { ...ORIGINAL, brightness: 103, saturate: 110, tint: { color: "#f59e0b", strength: 0.35 } } },
  { name: "High contrast", filters: { ...ORIGINAL, brightness: 105, contrast: 160, saturate: 115 } },
];

const SLIDERS: Array<{ key: Exclude<keyof Filters, "tint">; label: string; max: number; unit: string }> = [
  { key: "brightness", label: "Brightness", max: 200, unit: "%" },
  { key: "contrast", label: "Contrast", max: 200, unit: "%" },
  { key: "saturate", label: "Saturation", max: 200, unit: "%" },
  { key: "grayscale", label: "Grayscale", max: 100, unit: "%" },
  { key: "sepia", label: "Sepia", max: 100, unit: "%" },
  { key: "blur", label: "Blur", max: 40, unit: " px" },
];

const PREVIEW_MAX = 900;
const THUMB_MAX = 160;

function sameFilters(a: Filters, b: Filters): boolean {
  return (
    SLIDERS.every(({ key }) => a[key] === b[key]) &&
    a.tint?.color === b.tint?.color &&
    a.tint?.strength === b.tint?.strength
  );
}

function filterString(f: Filters, blurScale: number): string {
  const blur = f.blur * blurScale;
  return [
    `brightness(${f.brightness}%)`,
    `contrast(${f.contrast}%)`,
    `saturate(${f.saturate}%)`,
    `grayscale(${f.grayscale}%)`,
    `sepia(${f.sepia}%)`,
    blur > 0 ? `blur(${blur}px)` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Draw `image` into `canvas` at the canvas size with the filters applied. `blurScale` converts the
 * full-size blur radius to this canvas's resolution, so previews match the downloaded file.
 */
function render(canvas: HTMLCanvasElement, image: CanvasImageSource, f: Filters, blurScale: number) {
  const ctx = context2d(canvas);
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.filter = filterString(f, blurScale);
  ctx.drawImage(image, 0, 0, width, height);
  if (f.tint) {
    ctx.filter = "none";
    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = f.tint.strength;
    ctx.fillStyle = f.tint.color;
    ctx.fillRect(0, 0, width, height);
    // Restore the image's own transparency, which the colour fill painted over.
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "destination-in";
    ctx.filter = f.blur > 0 ? `blur(${f.blur * blurScale}px)` : "none";
    ctx.drawImage(image, 0, 0, width, height);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
}

function PresetButton({
  name,
  filters,
  thumb,
  active,
  onSelect,
}: {
  name: string;
  filters: Filters;
  thumb: { canvas: HTMLCanvasElement; scale: number };
  active: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = thumb.canvas.width;
    canvas.height = thumb.canvas.height;
    render(canvas, thumb.canvas, filters, thumb.scale);
  }, [thumb, filters]);

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-lg border p-1.5 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary-soft text-primary" : "border-line text-muted hover:border-primary-line hover:text-ink",
      )}
    >
      <canvas ref={ref} aria-hidden className="aspect-square w-full rounded-md bg-paper object-cover" />
      {name}
    </button>
  );
}

export default function ImageFilters() {
  const { track } = useTool();
  const [source, setSource] = useState<SourceImage | null>(null);
  const [filters, setFilters] = useState<Filters>(ORIGINAL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const type = outputTypeFor(source?.file.type ?? "");
  const supported = typeof CanvasRenderingContext2D !== "undefined" && "filter" in CanvasRenderingContext2D.prototype;

  const thumb = useMemo(() => {
    if (!source) return null;
    const size = fitWithin(source.width, source.height, THUMB_MAX);
    try {
      const region = { x: 0, y: 0, width: source.width, height: source.height };
      return { canvas: drawScaled(source.image, region, size.width, size.height), scale: size.scale };
    } catch {
      return null;
    }
  }, [source]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !source) return;
    const size = fitWithin(source.width, source.height, PREVIEW_MAX);
    canvas.width = size.width;
    canvas.height = size.height;
    render(canvas, source.image, filters, size.scale);
  }, [source, filters]);

  async function open(files: File[]) {
    setError("");
    try {
      setSource(await openImage(files[0]));
    } catch (e) {
      setError(errorMessage(e, "This image could not be opened."));
    }
  }

  async function download() {
    if (!source) return;
    setBusy(true);
    setError("");
    try {
      assertCanvasSize(source.width, source.height);
      const canvas = createCanvas(source.width, source.height);
      render(canvas, source.image, filters, 1);
      const blob = await exportCanvas(canvas, type);
      downloadBlob(blob, withSuffix(renameExtension(source.file.name, MIME_EXTENSION[type]), "-edited"));
      track();
    } catch (e) {
      setError(errorMessage(e, "The image could not be saved."));
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

      {source && thumb ? (
        <>
          {!supported ? (
            <Alert tone="warning" title="Filters are not supported in this browser">
              Your browser cannot apply filters to images. Please use a recent version of Chrome, Edge, Firefox or Safari.
            </Alert>
          ) : null}

          <ToolColumns>
            <div className="space-y-4">
              <Panel title="Presets">
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {PRESETS.map((p) => (
                    <PresetButton
                      key={p.name}
                      name={p.name}
                      filters={p.filters}
                      thumb={thumb}
                      active={sameFilters(filters, p.filters)}
                      onSelect={() => setFilters(p.filters)}
                    />
                  ))}
                </div>
              </Panel>

              <Panel title="Adjustments">
                <div className="grid gap-4 sm:grid-cols-2">
                  {SLIDERS.map((s) => (
                    <RangeField
                      key={s.key}
                      label={s.label}
                      value={filters[s.key]}
                      min={0}
                      max={s.max}
                      onChange={(v) => setFilters((f) => ({ ...f, [s.key]: v }))}
                      format={(v) => `${v}${s.unit}`}
                    />
                  ))}
                </div>
              </Panel>
            </div>

            <Panel title="Preview">
              <div className="space-y-4">
                <PreviewFrame className="min-h-64">
                  <canvas
                    ref={canvasRef}
                    role="img"
                    aria-label={`Preview of ${source.file.name} with the filters applied`}
                    className="max-h-[28rem] max-w-full"
                  />
                </PreviewFrame>

                <ErrorText>{error}</ErrorText>

                <div className="flex flex-wrap gap-3">
                  <Button onClick={download} disabled={busy}>
                    {busy ? <Spinner /> : <Download aria-hidden />}
                    {busy ? "Saving…" : "Download image"}
                  </Button>
                  <Button variant="ghost" onClick={() => setFilters(ORIGINAL)} disabled={sameFilters(filters, ORIGINAL)}>
                    Reset
                  </Button>
                </div>
              </div>
            </Panel>
          </ToolColumns>
        </>
      ) : (
        <ErrorText>{error || (source ? "This image could not be prepared for editing." : "")}</ErrorText>
      )}
    </div>
  );
}
