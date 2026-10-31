"use client";

/**
 * One-way image format converter used by the dedicated "PNG to JPG", "WebP to PNG", … pages.
 * Each page is a thin wrapper that fixes the source and target formats.
 */

import { useState } from "react";
import { Panel, RangeField } from "@/components/tool-ui";
import { createCanvas, MIME_EXTENSION, renameExtension } from "@/lib/files";
import { useTool } from "@/tools/context";
import { assertCanvasSize, context2d, exportCanvas, formatLabel, openImage, type RasterType } from "@/tools/lib/image";
import { BatchActions, BatchDropzone, BatchFileList, useImageBatch, type BatchResult } from "@/tools/lib/image-batch";
import { ColorField } from "@/tools/lib/image-ui";

/** `accept` rules per source format. JPG also matches the ".jpeg" spelling. */
const SOURCE_ACCEPT: Record<RasterType, string> = {
  "image/jpeg": "image/jpeg,.jpg,.jpeg",
  "image/png": "image/png,.png",
  "image/webp": "image/webp,.webp",
};

const SOURCE_HINT: Record<RasterType, string> = {
  "image/jpeg": ".jpg and .jpeg files",
  "image/png": ".png files",
  "image/webp": ".webp files",
};

interface Settings {
  /** 10–100. Only used for lossy targets. */
  quality: number;
  /** Fills transparent areas when the target is JPG. */
  background: string;
}

async function convert(file: File, to: RasterType, { quality, background }: Settings): Promise<BatchResult> {
  const { image, width, height } = await openImage(file);
  assertCanvasSize(width, height);
  const canvas = createCanvas(width, height);
  context2d(canvas).drawImage(image, 0, 0);
  const blob = await exportCanvas(canvas, to, quality / 100, background);
  // Browsers that can't encode a format silently fall back to PNG.
  if (blob.type !== to) {
    throw new Error(`Your browser can't create ${formatLabel(to)} images. Try a recent version of Chrome, Edge or Firefox.`);
  }
  return { blob, name: renameExtension(file.name, MIME_EXTENSION[to]) };
}

export function FormatConverter({ from, to }: { from: RasterType; to: RasterType }) {
  const { limits } = useTool();
  const batch = useImageBatch();
  const [settings, setSettings] = useState<Settings>({ quality: to === "image/webp" ? 80 : 90, background: "#ffffff" });
  const fromLabel = formatLabel(from);
  const toLabel = formatLabel(to);
  const lossy = to !== "image/png";

  function update(patch: Partial<Settings>) {
    setSettings((prev) => ({ ...prev, ...patch }));
    batch.invalidate();
  }

  return (
    <div className="space-y-4">
      <BatchDropzone
        batch={batch}
        accept={SOURCE_ACCEPT[from]}
        hint={
          batch.items.length
            ? undefined
            : `${fromLabel} images only (${SOURCE_HINT[from]}), up to ${limits.maxFileMb} MB each, ${limits.maxBatch} at once`
        }
      />

      {batch.items.length ? (
        <>
          {lossy ? (
            <Panel title={`${toLabel} settings`}>
              <div className="grid gap-4 sm:grid-cols-2">
                <RangeField
                  label="Quality"
                  value={settings.quality}
                  min={10}
                  max={100}
                  onChange={(quality) => update({ quality })}
                  format={(v) => `${v}%`}
                />
                {to === "image/jpeg" ? (
                  <ColorField
                    id="format-background"
                    label="Background for transparent areas"
                    value={settings.background}
                    onChange={(background) => update({ background })}
                  />
                ) : null}
              </div>
            </Panel>
          ) : (
            <p className="text-sm text-muted">
              PNG is lossless: every pixel of your {fromLabel} image is kept exactly, so there is nothing to set.
            </p>
          )}

          <BatchFileList batch={batch} />

          <BatchActions
            batch={batch}
            verb="Convert"
            busyLabel="Converting…"
            zipName={`${fromLabel}-to-${toLabel}.zip`.toLowerCase()}
            onRun={() => void batch.run((file) => convert(file, to, settings), "Conversion failed.")}
          />
        </>
      ) : null}
    </div>
  );
}
