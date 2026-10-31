"use client";

import { useMemo, useState } from "react";
import { Stamp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { ErrorText, Panel, RangeField, Segmented, ToolColumns } from "@/components/tool-ui";
import { downloadBlob, withSuffix } from "@/lib/files";
import { useTool } from "@/tools/context";
import { hexToRgb } from "@/tools/lib/image";
import { ColorField } from "@/tools/lib/image-ui";
import {
  assertStandardFontText,
  centredTextOrigin,
  loadPdfLib,
  nextFrame,
  openPdf,
  pageFrame,
  pdfErrorMessage,
  savePdf,
} from "@/tools/lib/pdf";
import { DownloadResult, PdfFilePicker, Progress, usePdfFile, type LoadedPdf, type OutputFile } from "@/tools/lib/pdf-file";
import { PagePreviewPanel, transformPdf, usePagePreview, type PageTransform } from "@/tools/lib/pdf-preview";

type Position = "center" | "tiled";

interface WatermarkSettings {
  text: string;
  size: number;
  color: string;
  /** 0 to 1. */
  opacity: number;
  /** Degrees, counter-clockwise. */
  angle: number;
  position: Position;
}

/** Safety cap so a tiny font on a huge page can't produce thousands of stamps. */
const MAX_TILES_PER_PAGE = 400;

function watermarkTransform({ text, size, color, opacity, angle, position }: WatermarkSettings): PageTransform {
  return async (doc) => {
    const label = text.trim();
    if (!label) return;
    const { StandardFonts, degrees, rgb } = await loadPdfLib();
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    assertStandardFontText(font, label);
    const { r, g, b } = hexToRgb(color) ?? { r: 0, g: 0, b: 0 };
    const fill = rgb(r / 255, g / 255, b / 255);

    const textWidth = font.widthOfTextAtSize(label, size);
    const textHeight = font.heightAtSize(size, { descender: false });
    const rad = (angle * Math.PI) / 180;
    // Size of the rotated text's bounding box, plus breathing room, gives the tile spacing.
    const gap = size * 1.5;
    const stepX = Math.abs(textWidth * Math.cos(rad)) + Math.abs(textHeight * Math.sin(rad)) + gap;
    const stepY = Math.abs(textWidth * Math.sin(rad)) + Math.abs(textHeight * Math.cos(rad)) + gap;

    for (const page of doc.getPages()) {
      const frame = pageFrame(page);
      const centres: Array<[number, number]> = [];
      if (position === "center") {
        centres.push([frame.width / 2, frame.height / 2]);
      } else {
        // A brick pattern centred on the page: every other row is shifted by half a step.
        const rows = Math.ceil(frame.height / 2 / stepY) + 1;
        const cols = Math.ceil(frame.width / 2 / stepX) + 1;
        for (let row = -rows; row <= rows; row++) {
          const offset = Math.abs(row) % 2 ? stepX / 2 : 0;
          for (let col = -cols; col <= cols; col++) {
            const x = frame.width / 2 + offset + col * stepX;
            const y = frame.height / 2 + row * stepY;
            const visible = x > -stepX / 2 && x < frame.width + stepX / 2 && y > -stepY / 2 && y < frame.height + stepY / 2;
            if (visible && centres.length < MAX_TILES_PER_PAGE) centres.push([x, y]);
          }
        }
      }
      centres.forEach(([cx, cy]) => {
        const origin = centredTextOrigin(frame, font, label, size, cx, cy, angle);
        page.drawText(label, {
          x: origin.x,
          y: origin.y,
          size,
          font,
          color: fill,
          opacity,
          rotate: degrees(origin.rotate),
        });
      });
    }
  };
}

function WatermarkWorkspace({ pdf }: { pdf: LoadedPdf }) {
  const { track } = useTool();
  const [text, setText] = useState("CONFIDENTIAL");
  const [size, setSize] = useState(60);
  const [color, setColor] = useState("#dc2626");
  const [opacity, setOpacity] = useState(25);
  const [angle, setAngle] = useState(45);
  const [position, setPosition] = useState<Position>("center");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OutputFile | null>(null);

  const transform = useMemo(
    () => watermarkTransform({ text, size, color, opacity: opacity / 100, angle, position }),
    [text, size, color, opacity, angle, position],
  );
  const preview = usePagePreview(pdf, 0, transform);

  function change<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setResult(null);
      setError("");
    };
  }

  async function apply() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      await nextFrame();
      const doc = await openPdf(pdf.bytes);
      await transformPdf(doc, transform);
      const output = { blob: await savePdf(doc), name: withSuffix(pdf.file.name, "-watermarked") };
      setResult(output);
      downloadBlob(output.blob, output.name);
      track();
    } catch (e) {
      setError(pdfErrorMessage(e, "The watermark could not be added. Check that the PDF opens in a PDF reader."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ToolColumns>
        <Panel title="Watermark">
          <div className="space-y-4">
            <div>
              <Label htmlFor="watermark-text">Text</Label>
              <Input
                id="watermark-text"
                value={text}
                maxLength={100}
                onChange={(e) => change(setText)(e.target.value)}
                placeholder="e.g. CONFIDENTIAL"
              />
            </div>
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-ink">Position</legend>
              <Segmented<Position>
                label="Position"
                value={position}
                onChange={change(setPosition)}
                options={[
                  { value: "center", label: "Centre" },
                  { value: "tiled", label: "Tiled" },
                ]}
              />
            </fieldset>
            <RangeField label="Font size" value={size} min={12} max={160} onChange={change(setSize)} format={(v) => `${v} pt`} />
            <RangeField label="Opacity" value={opacity} min={5} max={100} onChange={change(setOpacity)} format={(v) => `${v}%`} />
            <RangeField label="Rotation" value={angle} min={-90} max={90} step={5} onChange={change(setAngle)} format={(v) => `${v}°`} />
            <ColorField id="watermark-color" label="Colour" value={color} onChange={change(setColor)} />
          </div>
        </Panel>
        <PagePreviewPanel
          title="Preview (page 1)"
          alt="First page with the watermark applied"
          blob={preview.blob}
          error={preview.error}
          rendering={preview.rendering}
        />
      </ToolColumns>

      <ErrorText>{error}</ErrorText>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={apply} disabled={busy || !text.trim() || !!preview.error}>
          <Stamp aria-hidden />
          Add watermark to {pdf.pageCount} page{pdf.pageCount === 1 ? "" : "s"}
        </Button>
        {busy ? <Progress>Stamping pages…</Progress> : null}
      </div>

      {result ? <DownloadResult result={result} /> : null}
    </>
  );
}

export default function WatermarkPdf() {
  const state = usePdfFile();
  return (
    <div className="space-y-4">
      <PdfFilePicker state={state} />
      {state.pdf ? <WatermarkWorkspace key={state.pdf.id} pdf={state.pdf} /> : null}
    </div>
  );
}
