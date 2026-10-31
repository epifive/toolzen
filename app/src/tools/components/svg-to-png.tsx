"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/field";
import { ErrorText, FileDropzone, Panel, Spinner, TextInput, ToolColumns } from "@/components/tool-ui";
import { canvasToBlob, createCanvas, downloadBlob, renameExtension } from "@/lib/files";
import { formatBytes } from "@/lib/utils";
import { useTool } from "@/tools/context";
import {
  assertCanvasSize,
  context2d,
  errorMessage,
  fitWithin,
  loadSvg,
  MAX_CANVAS_SIDE,
  paintBackground,
  readSvgInfo,
  type SvgInfo,
} from "@/tools/lib/image";
import { ColorField, NumberField, PreviewFrame } from "@/tools/lib/image-ui";

const PREVIEW_MAX = 800;
const SCALES = [1, 2, 4];

type Parsed = { ok: true; info: SvgInfo } | { ok: false; error: string };

function parse(code: string): Parsed | null {
  if (!code.trim()) return null;
  try {
    return { ok: true, info: readSvgInfo(code) };
  } catch (e) {
    return { ok: false, error: errorMessage(e, "This is not valid SVG.") };
  }
}

/** Draw a decoded SVG image onto a canvas, optionally over a solid background. */
function paint(canvas: HTMLCanvasElement, image: HTMLImageElement, background: string | null) {
  const ctx = context2d(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (background) paintBackground(ctx, background);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
}

export default function SvgToPng() {
  const { track } = useTool();
  const [code, setCode] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [transparent, setTransparent] = useState(true);
  const [background, setBackground] = useState("#ffffff");
  const [renderError, setRenderError] = useState<{ code: string; message: string } | null>(null);
  const [result, setResult] = useState<{ size: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const parsed = useMemo(() => parse(code), [code]);
  const info = parsed?.ok ? parsed.info : null;
  const outW = info ? (width ?? Math.max(1, Math.round(info.width))) : 0;
  const outH = info ? Math.max(1, Math.round((outW * info.height) / info.width)) : 0;
  const preview = fitWithin(Math.max(1, outW), Math.max(1, outH), PREVIEW_MAX);
  const fill = transparent ? null : background;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !info) return;
    let cancelled = false;
    loadSvg(code, preview.width, preview.height)
      .then((image) => {
        if (cancelled) return;
        canvas.width = preview.width;
        canvas.height = preview.height;
        paint(canvas, image, fill);
      })
      .catch((e: unknown) => {
        if (!cancelled) setRenderError({ code, message: errorMessage(e, "This SVG could not be rendered.") });
      });
    return () => {
      cancelled = true;
    };
  }, [code, info, preview.width, preview.height, fill]);

  async function openFile(files: File[]) {
    setError("");
    setResult(null);
    try {
      setCode(await files[0].text());
      setFileName(files[0].name);
      setWidth(null);
    } catch (e) {
      setError(errorMessage(e, "The file could not be read."));
    }
  }

  async function download() {
    if (!info) return;
    setBusy(true);
    setError("");
    try {
      assertCanvasSize(outW, outH);
      const image = await loadSvg(code, outW, outH);
      const canvas = createCanvas(outW, outH);
      paint(canvas, image, fill);
      const blob = await canvasToBlob(canvas, "image/png");
      downloadBlob(blob, renameExtension(fileName ?? "image.svg", "png"));
      setResult({ size: blob.size });
      track();
    } catch (e) {
      setError(errorMessage(e, "The PNG could not be created."));
    } finally {
      setBusy(false);
    }
  }

  const shownError = parsed && !parsed.ok ? parsed.error : renderError?.code === code ? renderError.message : "";

  return (
    <ToolColumns>
      <div className="space-y-4">
        <FileDropzone
          accept="image/svg+xml,.svg"
          onFiles={openFile}
          compact={!!code}
          label={code ? "Open a different SVG file" : "Drop an SVG file here or click to choose"}
          hint={code ? undefined : "Or paste SVG code below."}
        />
        <TextInput
          label="SVG code"
          value={code}
          onChange={(v) => {
            setCode(v);
            setResult(null);
            if (!v) setFileName(null);
          }}
          placeholder={'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">…</svg>'}
          rows={10}
          mono
        />
      </div>

      <Panel title="PNG output">
        {info ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                id="svg-width"
                label="Width"
                value={outW}
                min={1}
                max={MAX_CANVAS_SIDE}
                suffix="px"
                onChange={(v) => {
                  setWidth(v);
                  setResult(null);
                }}
                hint={`Height: ${outH} px (keeps the aspect ratio)`}
              />
              <div>
                <p className="mb-1.5 text-sm font-medium text-ink">Quick size</p>
                <div className="flex flex-wrap gap-2">
                  {SCALES.map((s) => {
                    const w = Math.max(1, Math.round(info.width * s));
                    return (
                      <Button
                        key={s}
                        size="sm"
                        variant={outW === w ? "secondary" : "outline"}
                        aria-pressed={outW === w}
                        onClick={() => {
                          setWidth(w);
                          setResult(null);
                        }}
                      >
                        {s}×
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
            {!info.hasIntrinsicSize ? (
              <p className="text-sm text-muted">
                This SVG has no width, height or viewBox, so the default size of 300 × 150 px is assumed.
              </p>
            ) : null}

            <Switch
              label="Transparent background"
              checked={transparent}
              onChange={(e) => setTransparent(e.target.checked)}
            />
            {!transparent ? (
              <ColorField id="svg-background" label="Background colour" value={background} onChange={setBackground} />
            ) : null}

            <PreviewFrame className="min-h-48">
              <canvas
                ref={canvasRef}
                role="img"
                aria-label="Preview of the PNG"
                className="max-h-80 max-w-full"
                style={{ aspectRatio: `${outW} / ${outH}` }}
              />
            </PreviewFrame>

            <ErrorText>{shownError || error}</ErrorText>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={download} disabled={busy || !!shownError}>
                {busy ? <Spinner /> : <Download aria-hidden />}
                {busy ? "Converting…" : `Download PNG (${outW} × ${outH})`}
              </Button>
              {result ? (
                <p className="text-sm text-muted" role="status">
                  PNG saved, {formatBytes(result.size)}.
                </p>
              ) : null}
            </div>
          </div>
        ) : parsed && !parsed.ok ? (
          <ErrorText>{parsed.error}</ErrorText>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted">Open an SVG file or paste SVG code to see the preview here.</p>
            <ErrorText>{error}</ErrorText>
          </div>
        )}
      </Panel>
    </ToolColumns>
  );
}
