"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FlipHorizontal2, FlipVertical2, RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, FileDropzone, Panel, RangeField, Spinner, ToolColumns } from "@/components/tool-ui";
import { createCanvas, downloadBlob, MIME_EXTENSION, renameExtension, withSuffix } from "@/lib/files";
import { useTool } from "@/tools/context";
import {
  assertCanvasSize,
  context2d,
  errorMessage,
  exportCanvas,
  fitWithin,
  formatLabel,
  openImage,
  outputTypeFor,
  RASTER_ACCEPT,
  type SourceImage,
} from "@/tools/lib/image";
import { PreviewFrame } from "@/tools/lib/image-ui";

interface Transform {
  angle: number;
  flipH: boolean;
  flipV: boolean;
}

const IDENTITY: Transform = { angle: 0, flipH: false, flipV: false };
const PREVIEW_MAX = 900;

/** Keep an angle within −180…180. */
function normaliseAngle(angle: number): number {
  const a = ((((angle + 180) % 360) + 360) % 360) - 180;
  return a === -180 && angle > 0 ? 180 : a;
}

/** Size of the canvas that fits the whole image after rotation. */
function rotatedSize(width: number, height: number, angle: number) {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    width: Math.max(1, Math.round(width * cos + height * sin)),
    height: Math.max(1, Math.round(width * sin + height * cos)),
  };
}

/** Draw the transformed image onto `canvas` at `scale` (1 = full resolution). */
function render(canvas: HTMLCanvasElement, source: SourceImage, t: Transform, scale: number) {
  const w = source.width * scale;
  const h = source.height * scale;
  const size = rotatedSize(w, h, t.angle);
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = context2d(canvas);
  ctx.imageSmoothingQuality = "high";
  ctx.translate(size.width / 2, size.height / 2);
  ctx.rotate((t.angle * Math.PI) / 180);
  ctx.scale(t.flipH ? -1 : 1, t.flipV ? -1 : 1);
  ctx.drawImage(source.image, -w / 2, -h / 2, w, h);
}

export default function RotateFlipImage() {
  const { track } = useTool();
  const [source, setSource] = useState<SourceImage | null>(null);
  const [transform, setTransform] = useState<Transform>(IDENTITY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const type = outputTypeFor(source?.file.type ?? "");
  const output = source ? rotatedSize(source.width, source.height, transform.angle) : null;
  const straight = transform.angle % 90 === 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !source) return;
    render(canvas, source, transform, fitWithin(source.width, source.height, PREVIEW_MAX).scale);
  }, [source, transform]);

  async function open(files: File[]) {
    setError("");
    try {
      setSource(await openImage(files[0]));
      setTransform(IDENTITY);
    } catch (e) {
      setError(errorMessage(e, "This image could not be opened."));
    }
  }

  function rotateBy(delta: number) {
    setTransform((t) => ({ ...t, angle: normaliseAngle(t.angle + delta) }));
  }

  async function download() {
    if (!source || !output) return;
    setBusy(true);
    setError("");
    try {
      assertCanvasSize(output.width, output.height);
      const canvas = createCanvas(output.width, output.height);
      render(canvas, source, transform, 1);
      const blob = await exportCanvas(canvas, type);
      downloadBlob(blob, withSuffix(renameExtension(source.file.name, MIME_EXTENSION[type]), "-rotated"));
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

      {source && output ? (
        <ToolColumns>
          <Panel title="Rotate & flip">
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => rotateBy(-90)}>
                  <RotateCcw aria-hidden />
                  Rotate left
                </Button>
                <Button variant="outline" onClick={() => rotateBy(90)}>
                  <RotateCw aria-hidden />
                  Rotate right
                </Button>
                <Button
                  variant={transform.flipH ? "secondary" : "outline"}
                  aria-pressed={transform.flipH}
                  onClick={() => setTransform((t) => ({ ...t, flipH: !t.flipH }))}
                >
                  <FlipHorizontal2 aria-hidden />
                  Flip horizontal
                </Button>
                <Button
                  variant={transform.flipV ? "secondary" : "outline"}
                  aria-pressed={transform.flipV}
                  onClick={() => setTransform((t) => ({ ...t, flipV: !t.flipV }))}
                >
                  <FlipVertical2 aria-hidden />
                  Flip vertical
                </Button>
              </div>

              <RangeField
                label="Angle"
                value={transform.angle}
                min={-180}
                max={180}
                onChange={(angle) => setTransform((t) => ({ ...t, angle }))}
                format={(v) => `${v}°`}
              />

              <p className="text-sm text-muted">
                Output: {output.width} × {output.height} px {formatLabel(type)}.
                {straight
                  ? null
                  : type === "image/jpeg"
                    ? " The corners uncovered by the rotation are filled with white, because JPG has no transparency."
                    : " The corners uncovered by the rotation stay transparent."}
              </p>

              <ErrorText>{error}</ErrorText>

              <div className="flex flex-wrap gap-3">
                <Button onClick={download} disabled={busy}>
                  {busy ? <Spinner /> : <Download aria-hidden />}
                  {busy ? "Saving…" : "Download image"}
                </Button>
                <Button variant="ghost" onClick={() => setTransform(IDENTITY)}>
                  Reset
                </Button>
              </div>
            </div>
          </Panel>

          <Panel title="Preview">
            <PreviewFrame className="min-h-64">
              <canvas
                ref={canvasRef}
                role="img"
                aria-label={`Preview of ${source.file.name} rotated ${transform.angle} degrees`}
                className="max-h-[28rem] max-w-full"
              />
            </PreviewFrame>
          </Panel>
        </ToolColumns>
      ) : (
        <ErrorText>{error}</ErrorText>
      )}
    </div>
  );
}
