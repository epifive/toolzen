"use client";

import { useState } from "react";
import { Download, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, FileDropzone, FileRow, Panel, RangeField, Segmented, Spinner } from "@/components/tool-ui";
import { createCanvas, downloadBlob, downloadZip, MIME_EXTENSION, renameExtension } from "@/lib/files";
import { formatBytes, uid } from "@/lib/utils";
import { useTool } from "@/tools/context";
import { assertCanvasSize, context2d, errorMessage, exportCanvas, openImage, RASTER_ACCEPT, type RasterType } from "@/tools/lib/image";
import { ColorField, ImageThumb } from "@/tools/lib/image-ui";

interface Item {
  id: string;
  file: File;
  result?: { blob: Blob; name: string };
  error?: string;
}

interface Settings {
  format: RasterType;
  quality: number;
  background: string;
}

async function convert(file: File, { format, quality, background }: Settings) {
  const { image, width, height } = await openImage(file);
  assertCanvasSize(width, height);
  const canvas = createCanvas(width, height);
  context2d(canvas).drawImage(image, 0, 0);
  const blob = await exportCanvas(canvas, format, quality / 100, background);
  return { blob, name: renameExtension(file.name, MIME_EXTENSION[format]) };
}

export default function ImageConverter() {
  const { track } = useTool();
  const [items, setItems] = useState<Item[]>([]);
  const [settings, setSettings] = useState<Settings>({ format: "image/jpeg", quality: 90, background: "#ffffff" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const done = items.filter((i) => i.result);
  const lossy = settings.format !== "image/png";

  /** Changing a setting makes earlier results stale, so they are cleared. */
  function update(patch: Partial<Settings>) {
    setSettings((prev) => ({ ...prev, ...patch }));
    setItems((prev) => prev.map((i) => ({ ...i, result: undefined, error: undefined })));
  }

  async function run() {
    setBusy(true);
    setError("");
    const next: Item[] = [];
    for (const item of items) {
      try {
        next.push({ ...item, result: await convert(item.file, settings), error: undefined });
      } catch (e) {
        next.push({ ...item, result: undefined, error: errorMessage(e, "Conversion failed.") });
      }
    }
    setItems(next);
    setBusy(false);
    if (next.some((i) => i.result)) track();
    else setError("None of the images could be converted. Try a different file.");
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
          <Panel title="Settings">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="mb-1.5 text-sm font-medium text-ink">
                  Convert to
                </p>
                <Segmented
                  label="Convert to"
                  value={settings.format}
                  onChange={(format) => update({ format })}
                  options={[
                    { value: "image/jpeg", label: "JPG" },
                    { value: "image/png", label: "PNG" },
                    { value: "image/webp", label: "WebP" },
                  ]}
                />
              </div>
              {lossy ? (
                <RangeField
                  label="Quality"
                  value={settings.quality}
                  min={10}
                  max={100}
                  onChange={(quality) => update({ quality })}
                  format={(v) => `${v}%`}
                />
              ) : (
                <p className="self-center text-sm text-muted">PNG is lossless, so there is no quality setting.</p>
              )}
              {settings.format === "image/jpeg" ? (
                <ColorField
                  id="convert-background"
                  label="Background for transparent areas"
                  value={settings.background}
                  onChange={(background) => update({ background })}
                />
              ) : null}
            </div>
          </Panel>

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
                    <span>
                      → <span className="font-medium text-primary">{item.result.name}</span> ({formatBytes(item.result.blob.size)})
                    </span>
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
              {busy ? "Converting…" : `Convert ${items.length} image${items.length > 1 ? "s" : ""}`}
            </Button>
            {done.length > 1 ? (
              <Button
                variant="outline"
                onClick={() =>
                  downloadZip(
                    done.flatMap((i) => (i.result ? [{ name: i.result.name, data: i.result.blob }] : [])),
                    "converted-images.zip",
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
