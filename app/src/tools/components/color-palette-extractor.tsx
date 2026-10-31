"use client";

import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { CopyButton, ErrorText, FileDropzone, Panel, ToolColumns, useObjectUrl } from "@/components/tool-ui";
import { createCanvas } from "@/lib/files";
import { useTool } from "@/tools/context";
import {
  clamp,
  context2d,
  errorMessage,
  fitWithin,
  openImage,
  RASTER_ACCEPT,
  rgbString,
  rgbToHex,
  type Rgb,
  type SourceImage,
} from "@/tools/lib/image";
import { PreviewImage } from "@/tools/lib/image-ui";

interface Swatch {
  rgb: Rgb;
  hex: string;
  /** Share of the (opaque) image covered by this colour, 0–1. */
  share?: number;
}

interface Cluster {
  r: number;
  g: number;
  b: number;
  count: number;
}

const SAMPLE_SIZE = 100;
const MAX_COLORS = 10;
const MIN_COLORS = 6;
const MAX_PICKED = 12;
/** Merge thresholds tried in order until enough distinct colours are found. */
const THRESHOLDS = [80, 60, 42, 28, 16];

/** Perceptually weighted RGB distance ("redmean" approximation). */
function distance(a: Rgb, b: Rgb): number {
  const rMean = (a.r + b.r) / 2;
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt((2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db);
}

const mean = (c: Cluster): Rgb => ({ r: c.r / c.count, g: c.g / c.count, b: c.b / c.count });

/** Greedy clustering of colour buckets (most frequent first) into at most MAX_COLORS colours. */
function cluster(buckets: Cluster[], threshold: number): Cluster[] {
  const clusters: Cluster[] = [];
  for (const bucket of buckets) {
    const colour = mean(bucket);
    let nearest: Cluster | null = null;
    let best = Infinity;
    for (const c of clusters) {
      const d = distance(colour, mean(c));
      if (d < best) {
        best = d;
        nearest = c;
      }
    }
    if (nearest && (best < threshold || clusters.length >= MAX_COLORS)) {
      nearest.r += bucket.r;
      nearest.g += bucket.g;
      nearest.b += bucket.b;
      nearest.count += bucket.count;
    } else {
      clusters.push({ ...bucket });
    }
  }
  return clusters;
}

/** Dominant colours of an image, most frequent first. */
function extractPalette(source: SourceImage): Swatch[] {
  const size = fitWithin(source.width, source.height, SAMPLE_SIZE);
  const canvas = createCanvas(size.width, size.height);
  const ctx = context2d(canvas);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source.image, 0, 0, size.width, size.height);
  const { data } = ctx.getImageData(0, 0, size.width, size.height);

  // Bucket pixels by their top 5 bits per channel, keeping exact sums for accurate averages.
  const buckets = new Map<number, Cluster>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.count++;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
  }
  const sorted = [...buckets.values()].sort((a, b) => b.count - a.count);
  const total = sorted.reduce((sum, c) => sum + c.count, 0);
  if (!total) return [];

  let clusters: Cluster[] = [];
  for (const threshold of THRESHOLDS) {
    clusters = cluster(sorted, threshold);
    if (clusters.length >= MIN_COLORS) break;
  }

  return clusters
    .sort((a, b) => b.count - a.count)
    .map((c) => {
      const rgb = mean(c);
      const rounded = { r: Math.round(rgb.r), g: Math.round(rgb.g), b: Math.round(rgb.b) };
      return { rgb: rounded, hex: rgbToHex(rounded), share: c.count / total };
    });
}

/** Exact colour of one pixel of the full-resolution image. */
function samplePixel(source: SourceImage, x: number, y: number): Swatch {
  const canvas = createCanvas(1, 1);
  const ctx = context2d(canvas);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source.image, x, y, 1, 1, 0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  const rgb = { r, g, b };
  return { rgb, hex: rgbToHex(rgb) };
}

function SwatchRow({ swatch }: { swatch: Swatch }) {
  const rgb = rgbString(swatch.rgb);
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-2">
      <span className="size-10 shrink-0 rounded-md border border-line" style={{ backgroundColor: swatch.hex }} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm font-medium uppercase text-ink">{swatch.hex}</p>
        <p className="text-xs text-muted">
          {rgb}
          {swatch.share !== undefined ? ` · ${(swatch.share * 100).toFixed(1)}%` : null}
        </p>
      </div>
      <div className="flex gap-1.5">
        <CopyButton text={swatch.hex.toUpperCase()} label="HEX" />
        <CopyButton text={rgb} label="RGB" />
      </div>
    </li>
  );
}

export default function ColorPaletteExtractor() {
  const { track } = useTool();
  const [data, setData] = useState<{ source: SourceImage; palette: Swatch[] } | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number; swatch: Swatch } | null>(null);
  const [picked, setPicked] = useState<Swatch[]>([]);
  const [error, setError] = useState("");
  const previewUrl = useObjectUrl(data?.source.file);

  async function open(files: File[]) {
    setError("");
    try {
      const source = await openImage(files[0]);
      const palette = extractPalette(source);
      if (!palette.length) throw new Error("This image is fully transparent, so it has no colours to extract.");
      setData({ source, palette });
      setCursor(null);
      track();
    } catch (e) {
      setError(errorMessage(e, "Colours could not be read from this image."));
    }
  }

  function moveCursor(x: number, y: number) {
    if (!data) return null;
    const px = clamp(Math.floor(x), 0, data.source.width - 1);
    const py = clamp(Math.floor(y), 0, data.source.height - 1);
    const next = { x: px, y: py, swatch: samplePixel(data.source, px, py) };
    setCursor(next);
    return next;
  }

  /** Moves the marker to the pixel under a pointer or mouse event. */
  function cursorFromEvent(e: MouseEvent<HTMLElement>) {
    if (!data) return null;
    const rect = e.currentTarget.getBoundingClientRect();
    return moveCursor(
      ((e.clientX - rect.left) / rect.width) * data.source.width,
      ((e.clientY - rect.top) / rect.height) * data.source.height,
    );
  }

  function pick(swatch: Swatch) {
    setPicked((prev) => [swatch, ...prev.filter((p) => p.hex !== swatch.hex)].slice(0, MAX_PICKED));
  }

  function handleKey(e: KeyboardEvent<HTMLDivElement>) {
    if (!data) return;
    const { width, height } = data.source;
    const current = cursor ?? { x: width / 2, y: height / 2 };
    const step = e.shiftKey ? 10 : 1;
    const dx = Math.max(1, Math.round(width / 100)) * step;
    const dy = Math.max(1, Math.round(height / 100)) * step;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-dx, 0],
      ArrowRight: [dx, 0],
      ArrowUp: [0, -dy],
      ArrowDown: [0, dy],
    };
    if (moves[e.key]) {
      e.preventDefault();
      moveCursor(current.x + moves[e.key][0], current.y + moves[e.key][1]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const next = cursor ?? moveCursor(current.x, current.y);
      if (next) pick(next.swatch);
    }
  }

  return (
    <div className="space-y-4">
      <FileDropzone
        accept={RASTER_ACCEPT}
        onFiles={open}
        compact={!!data}
        label={data ? "Choose a different image" : undefined}
      />
      <ErrorText>{error}</ErrorText>

      {data && previewUrl ? (
        <>
          <div className="flex h-12 overflow-hidden rounded-lg border border-line" aria-hidden>
            {data.palette.map((s, i) => (
              <span key={`${s.hex}-${i}`} style={{ backgroundColor: s.hex, flexGrow: s.share }} className="min-w-2" />
            ))}
          </div>

          <ToolColumns>
            <Panel title="Click the image to pick a colour">
              <div className="space-y-3">
                <div className="flex justify-center">
                  <div
                    role="application"
                    tabIndex={0}
                    aria-label="Image colour picker. Use the arrow keys to move the marker and Enter to pick the colour under it."
                    onKeyDown={handleKey}
                    onPointerMove={cursorFromEvent}
                    onPointerLeave={() => setCursor(null)}
                    onClick={(e) => {
                      const next = cursorFromEvent(e);
                      if (next) pick(next.swatch);
                    }}
                    className="relative max-w-full cursor-crosshair rounded-md"
                  >
                    <PreviewImage src={previewUrl} alt={data.source.file.name} className="block max-h-[28rem] max-w-full rounded-md" />
                    {cursor ? (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.5)]"
                        style={{
                          left: `${((cursor.x + 0.5) / data.source.width) * 100}%`,
                          top: `${((cursor.y + 0.5) / data.source.height) * 100}%`,
                          backgroundColor: cursor.swatch.hex,
                        }}
                      />
                    ) : null}
                  </div>
                </div>
                <p className="text-sm text-muted" aria-live="polite">
                  {cursor ? (
                    <>
                      Pixel {cursor.x}, {cursor.y}:{" "}
                      <span className="font-mono font-medium uppercase text-ink">{cursor.swatch.hex}</span>
                    </>
                  ) : (
                    "Move over the image to preview a colour; click to keep it."
                  )}
                </p>
              </div>
            </Panel>

            <Panel
              title="Dominant colours"
              actions={<CopyButton text={data.palette.map((s) => s.hex.toUpperCase()).join("\n")} label="Copy all" />}
            >
              <ul className="space-y-2">
                {data.palette.map((s, i) => (
                  <SwatchRow key={`${s.hex}-${i}`} swatch={s} />
                ))}
              </ul>
            </Panel>
          </ToolColumns>

          {picked.length ? (
            <Panel
              title="Picked colours"
              actions={
                <Button size="sm" variant="ghost" onClick={() => setPicked([])}>
                  Clear
                </Button>
              }
            >
              <ul className="grid gap-2 md:grid-cols-2">
                {picked.map((s) => (
                  <SwatchRow key={s.hex} swatch={s} />
                ))}
              </ul>
            </Panel>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
