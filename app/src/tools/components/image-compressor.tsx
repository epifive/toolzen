"use client";

import { useState } from "react";
import { Download, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { ErrorText, FileDropzone, FileRow, Panel, RangeField, Spinner } from "@/components/tool-ui";
import { canvasToBlob, createCanvas, downloadBlob, downloadZip, loadImage, MIME_EXTENSION, renameExtension } from "@/lib/files";
import { formatBytes, uid } from "@/lib/utils";
import { useTool } from "@/tools/context";

type OutputFormat = "same" | "image/jpeg" | "image/webp" | "image/png";

interface Item {
  id: string;
  file: File;
  result?: { blob: Blob; name: string };
  error?: string;
}

async function compress(file: File, quality: number, maxWidth: number, format: OutputFormat) {
  const img = await loadImage(file);
  const scale = maxWidth > 0 && img.naturalWidth > maxWidth ? maxWidth / img.naturalWidth : 1;
  const canvas = createCanvas(img.naturalWidth * scale, img.naturalHeight * scale);
  const ctx = canvas.getContext("2d")!;
  const type = format === "same" ? (["image/jpeg", "image/png", "image/webp"].includes(file.type) ? file.type : "image/jpeg") : format;
  if (type === "image/jpeg") {
    // JPG has no alpha channel: paint transparent areas white instead of black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  let blob = await canvasToBlob(canvas, type, quality / 100);
  // Never hand back a bigger file than the user started with.
  if (blob.size >= file.size && type === file.type && scale === 1) blob = file;
  return { blob, name: renameExtension(file.name, MIME_EXTENSION[type] ?? "jpg") };
}

export default function ImageCompressor() {
  const { track } = useTool();
  const [items, setItems] = useState<Item[]>([]);
  const [quality, setQuality] = useState(75);
  const [maxWidth, setMaxWidth] = useState(0);
  const [format, setFormat] = useState<OutputFormat>("same");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const done = items.filter((i) => i.result);
  const before = done.reduce((s, i) => s + i.file.size, 0);
  const after = done.reduce((s, i) => s + (i.result?.blob.size ?? 0), 0);

  async function run() {
    setBusy(true);
    setError("");
    const next: Item[] = [];
    for (const item of items) {
      try {
        next.push({ ...item, result: await compress(item.file, quality, maxWidth, format), error: undefined });
      } catch (e) {
        next.push({ ...item, result: undefined, error: e instanceof Error ? e.message : "Compression failed." });
      }
    }
    setItems(next);
    setBusy(false);
    if (next.some((i) => i.result)) track();
    else setError("None of the images could be compressed. Try a different file.");
  }

  return (
    <div className="space-y-4">
      <FileDropzone
        accept="image/jpeg,image/png,image/webp"
        multiple
        currentCount={items.length}
        compact={items.length > 0}
        label={items.length ? "Add more images" : undefined}
        onFiles={(files) =>
          setItems((prev) => [...prev, ...files.map((file) => ({ id: uid(), file }))])
        }
      />

      {items.length ? (
        <>
          <Panel title="Settings">
            <div className="grid gap-4 sm:grid-cols-3">
              <RangeField label="Quality" value={quality} min={10} max={100} onChange={setQuality} format={(v) => `${v}%`} />
              <div>
                <label htmlFor="max-width" className="mb-1.5 block text-sm font-medium">
                  Maximum width
                </label>
                <Select id="max-width" value={maxWidth} onChange={(e) => setMaxWidth(Number(e.target.value))}>
                  <option value={0}>Keep original</option>
                  {[3840, 2560, 1920, 1280, 1024, 800, 640].map((w) => (
                    <option key={w} value={w}>
                      {w} px
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label htmlFor="format" className="mb-1.5 block text-sm font-medium">
                  Output format
                </label>
                <Select id="format" value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)}>
                  <option value="same">Same as original</option>
                  <option value="image/jpeg">JPG</option>
                  <option value="image/webp">WebP (smallest)</option>
                  <option value="image/png">PNG</option>
                </Select>
              </div>
            </div>
          </Panel>

          <ul className="space-y-2">
            {items.map((item) => {
              const saved = item.result ? 1 - item.result.blob.size / item.file.size : 0;
              return (
                <FileRow
                  key={item.id}
                  name={item.file.name}
                  size={item.file.size}
                  meta={
                    item.error ? (
                      <span className="text-red-600">{item.error}</span>
                    ) : item.result ? (
                      <span>
                        {formatBytes(item.result.blob.size)}{" "}
                        <span className="font-medium text-primary">
                          {saved > 0 ? `(${Math.round(saved * 100)}% smaller)` : "(already optimised)"}
                        </span>
                      </span>
                    ) : null
                  }
                  actions={
                    item.result ? (
                      <Button size="sm" variant="outline" onClick={() => downloadBlob(item.result!.blob, item.result!.name)}>
                        <Download aria-hidden />
                        Download
                      </Button>
                    ) : null
                  }
                  onRemove={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                />
              );
            })}
          </ul>

          <ErrorText>{error}</ErrorText>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={run} disabled={busy}>
              {busy ? <Spinner /> : null}
              {busy ? "Compressing…" : `Compress ${items.length} image${items.length > 1 ? "s" : ""}`}
            </Button>
            {done.length > 1 ? (
              <Button
                variant="outline"
                onClick={() => downloadZip(done.map((i) => ({ name: i.result!.name, data: i.result!.blob })), "compressed-images.zip")}
              >
                <Package aria-hidden />
                Download all as ZIP
              </Button>
            ) : null}
            {done.length ? (
              <p className="text-sm text-muted">
                {formatBytes(before)} → {formatBytes(after)}{" "}
                {before > after ? (
                  <span className="font-medium text-primary">saved {Math.round((1 - after / before) * 100)}%</span>
                ) : null}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
