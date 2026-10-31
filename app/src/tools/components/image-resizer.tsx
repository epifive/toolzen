"use client";

import { useState } from "react";
import { Download, Link2, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, FileDropzone, Panel, Segmented, Spinner, Stat, StatGrid, ToolColumns, useObjectUrl } from "@/components/tool-ui";
import { downloadBlob, MIME_EXTENSION, renameExtension, withSuffix } from "@/lib/files";
import { formatBytes } from "@/lib/utils";
import { useTool } from "@/tools/context";
import {
  assertCanvasSize,
  drawScaled,
  errorMessage,
  exportCanvas,
  formatLabel,
  MAX_CANVAS_SIDE,
  openImage,
  outputTypeFor,
  RASTER_ACCEPT,
  type SourceImage,
} from "@/tools/lib/image";
import { NumberField, PreviewFrame, PreviewImage } from "@/tools/lib/image-ui";

type Mode = "pixels" | "percent";

const PERCENT_PRESETS = [25, 50, 75, 150, 200];

export default function ImageResizer() {
  const { track } = useTool();
  const [source, setSource] = useState<SourceImage | null>(null);
  const [mode, setMode] = useState<Mode>("pixels");
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [locked, setLocked] = useState(true);
  const [percent, setPercent] = useState(100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ size: number; width: number; height: number } | null>(null);
  const previewUrl = useObjectUrl(source?.file);

  const target =
    source && mode === "percent"
      ? {
          width: Math.max(1, Math.round((source.width * percent) / 100)),
          height: Math.max(1, Math.round((source.height * percent) / 100)),
        }
      : { width, height };
  const type = outputTypeFor(source?.file.type ?? "");

  async function open(files: File[]) {
    setError("");
    setResult(null);
    try {
      const next = await openImage(files[0]);
      setSource(next);
      setWidth(next.width);
      setHeight(next.height);
      setPercent(100);
    } catch (e) {
      setError(errorMessage(e, "This image could not be opened."));
    }
  }

  function changeWidth(value: number) {
    setResult(null);
    setWidth(value);
    if (locked && source) setHeight(Math.max(1, Math.round((value * source.height) / source.width)));
  }

  function changeHeight(value: number) {
    setResult(null);
    setHeight(value);
    if (locked && source) setWidth(Math.max(1, Math.round((value * source.width) / source.height)));
  }

  function toggleLock() {
    const next = !locked;
    setLocked(next);
    if (next && source) {
      setResult(null);
      setHeight(Math.max(1, Math.round((width * source.height) / source.width)));
    }
  }

  async function download() {
    if (!source) return;
    setBusy(true);
    setError("");
    try {
      assertCanvasSize(target.width, target.height);
      const canvas = drawScaled(
        source.image,
        { x: 0, y: 0, width: source.width, height: source.height },
        target.width,
        target.height,
      );
      const blob = await exportCanvas(canvas, type);
      const name = withSuffix(renameExtension(source.file.name, MIME_EXTENSION[type]), `-${target.width}x${target.height}`);
      downloadBlob(blob, name);
      setResult({ size: blob.size, ...target });
      track();
    } catch (e) {
      setError(errorMessage(e, "The image could not be resized."));
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
        <ToolColumns>
          <Panel title="New size">
            <div className="space-y-4">
              <Segmented
                label="Resize mode"
                value={mode}
                onChange={(m) => {
                  setMode(m);
                  setResult(null);
                }}
                options={[
                  { value: "pixels", label: "By pixels" },
                  { value: "percent", label: "By percentage" },
                ]}
              />

              {mode === "pixels" ? (
                <div className="flex items-end gap-2">
                  <NumberField
                    id="resize-width"
                    label="Width"
                    value={width}
                    min={1}
                    max={MAX_CANVAS_SIDE}
                    suffix="px"
                    onChange={changeWidth}
                    className="min-w-0 flex-1"
                  />
                  <Button
                    variant={locked ? "secondary" : "outline"}
                    className="w-10 shrink-0 px-0"
                    aria-pressed={locked}
                    aria-label={locked ? "Unlock aspect ratio" : "Lock aspect ratio"}
                    title={locked ? "Aspect ratio locked" : "Aspect ratio unlocked"}
                    onClick={toggleLock}
                  >
                    {locked ? <Link2 aria-hidden /> : <Link2Off aria-hidden />}
                  </Button>
                  <NumberField
                    id="resize-height"
                    label="Height"
                    value={height}
                    min={1}
                    max={MAX_CANVAS_SIDE}
                    suffix="px"
                    onChange={changeHeight}
                    className="min-w-0 flex-1"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <NumberField
                    id="resize-percent"
                    label="Scale"
                    value={percent}
                    min={1}
                    max={1000}
                    suffix="%"
                    onChange={(v) => {
                      setPercent(v);
                      setResult(null);
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    {PERCENT_PRESETS.map((p) => (
                      <Button
                        key={p}
                        size="sm"
                        variant={percent === p ? "secondary" : "outline"}
                        aria-pressed={percent === p}
                        onClick={() => {
                          setPercent(p);
                          setResult(null);
                        }}
                      >
                        {p}%
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <StatGrid className="sm:grid-cols-2">
                <Stat label="Original" value={`${source.width} × ${source.height}`} />
                <Stat label="New size" value={`${target.width} × ${target.height}`} emphasis />
              </StatGrid>
              <p className="text-sm text-muted">
                Original file: {formatBytes(source.file.size)}. Output format: {formatLabel(type)}
                {type !== source.file.type ? " (this format can't be saved by browsers, so PNG is used)" : ""}.
              </p>

              <ErrorText>{error}</ErrorText>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={download} disabled={busy}>
                  {busy ? <Spinner /> : <Download aria-hidden />}
                  {busy ? "Resizing…" : "Download resized image"}
                </Button>
                {result ? (
                  <p className="text-sm text-muted" role="status">
                    Saved {result.width} × {result.height} px, {formatBytes(result.size)}.
                  </p>
                ) : null}
              </div>
            </div>
          </Panel>

          <Panel title="Original image">
            <PreviewFrame className="min-h-48">
              {previewUrl ? (
                <PreviewImage src={previewUrl} alt={source.file.name} className="max-h-96 max-w-full object-contain" />
              ) : null}
            </PreviewFrame>
          </Panel>
        </ToolColumns>
      ) : (
        <ErrorText>{error}</ErrorText>
      )}
    </div>
  );
}
