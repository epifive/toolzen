"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Download, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { ErrorText, FileDropzone, Panel, RangeField, Segmented, Spinner, ToolColumns } from "@/components/tool-ui";
import { createCanvas, downloadBlob, MIME_EXTENSION, renameExtension, withSuffix } from "@/lib/files";
import { useTool } from "@/tools/context";
import {
  assertCanvasSize,
  clamp,
  context2d,
  errorMessage,
  exportCanvas,
  fitWithin,
  formatLabel,
  openImage,
  RASTER_ACCEPT,
  type SourceImage,
} from "@/tools/lib/image";
import { ColorField, PreviewFrame } from "@/tools/lib/image-ui";

type Block = "top" | "bottom";
type OutputType = "image/png" | "image/jpeg";

interface Caption {
  text: string;
  /** Horizontal centre of the caption, as a fraction of the image width. */
  x: number;
  /** Top edge (top caption) or bottom edge (bottom caption), as a fraction of the image height. */
  y: number;
}

interface Style {
  /** Font size as a percentage of the image width. */
  size: number;
  fill: string;
  outline: string;
  uppercase: boolean;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Impact where available, then the heaviest look-alike system fonts. Nothing is downloaded. */
const MEME_FONT = 'Impact, Haettenschweiler, "Arial Narrow Bold", "Arial Black", "Helvetica Neue", Arial, sans-serif';
const PREVIEW_MAX = 900;
const BLOCKS: Block[] = ["top", "bottom"];

const DEFAULT_POSITION: Record<Block, Pick<Caption, "x" | "y">> = {
  top: { x: 0.5, y: 0.03 },
  bottom: { x: 0.5, y: 0.97 },
};

/** Splits text into lines that fit `maxWidth`, breaking between words. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** Draws one caption in the classic outlined style and returns the area it covers. */
function drawCaption(ctx: CanvasRenderingContext2D, caption: Caption, block: Block, style: Style): Box | null {
  const raw = caption.text.trim();
  if (!raw) return null;
  const text = style.uppercase ? raw.toUpperCase() : raw;
  const { width: w, height: h } = ctx.canvas;
  const maxWidth = w * 0.94;
  let size = Math.max(1, (w * style.size) / 100);
  const setFont = () => {
    ctx.font = `700 ${size}px ${MEME_FONT}`;
  };

  ctx.save();
  setFont();
  const lines = wrapText(ctx, text, maxWidth);
  let widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
  // A single very long word can't wrap, so the whole caption shrinks to fit instead.
  if (widest > maxWidth) {
    size *= maxWidth / widest;
    setFont();
    widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
  }

  const lineHeight = size * 1.1;
  const height = lines.length * lineHeight;
  const cx = caption.x * w;
  const top = block === "top" ? caption.y * h : caption.y * h - height;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = Math.max(1, size * 0.14);
  ctx.strokeStyle = style.outline;
  ctx.fillStyle = style.fill;
  lines.forEach((line, i) => {
    const y = top + lineHeight * (i + 0.5);
    ctx.strokeText(line, cx, y);
    ctx.fillText(line, cx, y);
  });
  ctx.restore();

  return { x: cx - widest / 2, y: top, width: widest, height };
}

function drawMeme(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  captions: Record<Block, Caption>,
  style: Style,
): Record<Block, Box | null> {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, width, height);
  return {
    top: drawCaption(ctx, captions.top, "top", style),
    bottom: drawCaption(ctx, captions.bottom, "bottom", style),
  };
}

interface Drag {
  block: Block;
  pointerX: number;
  pointerY: number;
  start: Pick<Caption, "x" | "y">;
  frameWidth: number;
  frameHeight: number;
}

export default function MemeGenerator() {
  const { track } = useTool();
  const [source, setSource] = useState<SourceImage | null>(null);
  const [captions, setCaptions] = useState<Record<Block, Caption>>({
    top: { text: "When the code works", ...DEFAULT_POSITION.top },
    bottom: { text: "On the first try", ...DEFAULT_POSITION.bottom },
  });
  const [style, setStyle] = useState<Style>({ size: 9, fill: "#ffffff", outline: "#000000", uppercase: true });
  const [active, setActive] = useState<Block>("top");
  const [format, setFormat] = useState<OutputType>("image/png");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxesRef = useRef<Record<Block, Box | null>>({ top: null, bottom: null });
  const dragRef = useRef<Drag | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !source) return;
    const size = fitWithin(source.width, source.height, PREVIEW_MAX);
    canvas.width = size.width;
    canvas.height = size.height;
    boxesRef.current = drawMeme(context2d(canvas), source.image, captions, style);
  }, [source, captions, style]);

  async function open(files: File[]) {
    setError("");
    try {
      setSource(await openImage(files[0]));
    } catch (e) {
      setError(errorMessage(e, "This image could not be opened."));
    }
  }

  function setCaption(block: Block, patch: Partial<Caption>) {
    setCaptions((prev) => ({ ...prev, [block]: { ...prev[block], ...patch } }));
  }

  function resetPositions() {
    setCaptions((prev) => ({
      top: { ...prev.top, ...DEFAULT_POSITION.top },
      bottom: { ...prev.bottom, ...DEFAULT_POSITION.bottom },
    }));
  }

  /* ── Dragging captions ── */

  function captionAt(e: PointerEvent<HTMLCanvasElement>): Block | null {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * canvas.width) / rect.width;
    const y = ((e.clientY - rect.top) * canvas.height) / rect.height;
    const pad = canvas.width * 0.01;
    return (
      BLOCKS.find((block) => {
        const box = boxesRef.current[block];
        return box && x >= box.x - pad && x <= box.x + box.width + pad && y >= box.y - pad && y <= box.y + box.height + pad;
      }) ?? null
    );
  }

  function startDrag(e: PointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    const block = captionAt(e);
    if (!block) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      block,
      pointerX: e.clientX,
      pointerY: e.clientY,
      start: { x: captions[block].x, y: captions[block].y },
      frameWidth: rect.width,
      frameHeight: rect.height,
    };
    setActive(block);
  }

  function moveDrag(e: PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) {
      e.currentTarget.style.cursor = captionAt(e) ? "move" : "default";
      return;
    }
    setCaption(drag.block, {
      x: clamp(drag.start.x + (e.clientX - drag.pointerX) / drag.frameWidth, 0, 1),
      y: clamp(drag.start.y + (e.clientY - drag.pointerY) / drag.frameHeight, 0, 1),
    });
  }

  function endDrag() {
    dragRef.current = null;
  }

  function handleKey(e: KeyboardEvent<HTMLCanvasElement>) {
    const step = e.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    setCaptions((prev) => ({
      ...prev,
      [active]: { ...prev[active], x: clamp(prev[active].x + move[0], 0, 1), y: clamp(prev[active].y + move[1], 0, 1) },
    }));
  }

  async function download() {
    if (!source) return;
    if (!captions.top.text.trim() && !captions.bottom.text.trim()) {
      setError("Type a top or bottom caption first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      assertCanvasSize(source.width, source.height);
      const canvas = createCanvas(source.width, source.height);
      drawMeme(context2d(canvas), source.image, captions, style);
      const blob = await exportCanvas(canvas, format);
      downloadBlob(blob, withSuffix(renameExtension(source.file.name, MIME_EXTENSION[format]), "-meme"));
      track();
    } catch (e) {
      setError(errorMessage(e, "The meme could not be created."));
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
        <>
          <ToolColumns>
            <Panel title="Captions">
              <div className="space-y-4">
                <Field label="Top text" htmlFor="meme-top">
                  <Input
                    id="meme-top"
                    value={captions.top.text}
                    maxLength={200}
                    placeholder="Top text"
                    onChange={(e) => setCaption("top", { text: e.target.value })}
                  />
                </Field>
                <Field label="Bottom text" htmlFor="meme-bottom">
                  <Input
                    id="meme-bottom"
                    value={captions.bottom.text}
                    maxLength={200}
                    placeholder="Bottom text"
                    onChange={(e) => setCaption("bottom", { text: e.target.value })}
                  />
                </Field>
                <RangeField
                  label="Text size"
                  value={style.size}
                  min={3}
                  max={20}
                  step={0.5}
                  onChange={(size) => setStyle((s) => ({ ...s, size }))}
                  format={(v) => `${v}% of width`}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <ColorField id="meme-fill" label="Text colour" value={style.fill} onChange={(fill) => setStyle((s) => ({ ...s, fill }))} />
                  <ColorField
                    id="meme-outline"
                    label="Outline colour"
                    value={style.outline}
                    onChange={(outline) => setStyle((s) => ({ ...s, outline }))}
                  />
                </div>
                <Checkbox
                  label="All capital letters"
                  checked={style.uppercase}
                  onChange={(e) => setStyle((s) => ({ ...s, uppercase: e.target.checked }))}
                />
              </div>
            </Panel>

            <Panel
              title="Preview"
              actions={
                <Button size="sm" variant="ghost" onClick={resetPositions}>
                  <Undo2 aria-hidden />
                  Reset positions
                </Button>
              }
            >
              <div className="space-y-3">
                <PreviewFrame className="min-h-64">
                  <canvas
                    ref={canvasRef}
                    tabIndex={0}
                    role="group"
                    aria-label={`Meme preview. Drag a caption to move it, or use the arrow keys to move the ${active} caption.`}
                    onPointerDown={startDrag}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onKeyDown={handleKey}
                    className="max-h-[32rem] max-w-full touch-none focus-visible:outline-2 focus-visible:outline-primary"
                  />
                </PreviewFrame>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span>Arrow keys move:</span>
                  <Segmented<Block>
                    label="Caption moved by the arrow keys"
                    value={active}
                    onChange={setActive}
                    options={[
                      { value: "top", label: "Top" },
                      { value: "bottom", label: "Bottom" },
                    ]}
                  />
                </div>
              </div>
            </Panel>
          </ToolColumns>

          <ErrorText>{error}</ErrorText>

          <div className="flex flex-wrap items-center gap-3">
            <Segmented<OutputType>
              label="File format"
              value={format}
              onChange={setFormat}
              options={[
                { value: "image/png", label: "PNG" },
                { value: "image/jpeg", label: "JPG" },
              ]}
            />
            <Button onClick={download} disabled={busy}>
              {busy ? <Spinner /> : <Download aria-hidden />}
              {busy ? "Creating…" : `Download meme (${formatLabel(format)})`}
            </Button>
          </div>
        </>
      ) : (
        <ErrorText>{error}</ErrorText>
      )}
    </div>
  );
}
