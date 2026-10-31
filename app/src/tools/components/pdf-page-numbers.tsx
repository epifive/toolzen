"use client";

import { useId, useMemo, useState } from "react";
import { ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Select, Switch } from "@/components/ui/field";
import { ErrorText, Panel, RangeField, ToolColumns } from "@/components/tool-ui";
import { downloadBlob, withSuffix } from "@/lib/files";
import { cn } from "@/lib/utils";
import { useTool } from "@/tools/context";
import { NumberField } from "@/tools/lib/image-ui";
import { centredTextOrigin, loadPdfLib, nextFrame, openPdf, pageFrame, pdfErrorMessage, savePdf } from "@/tools/lib/pdf";
import { DownloadResult, PdfFilePicker, Progress, usePdfFile, type LoadedPdf, type OutputFile } from "@/tools/lib/pdf-file";
import { PagePreviewPanel, transformPdf, usePagePreview, type PageTransform } from "@/tools/lib/pdf-preview";

type Vertical = "top" | "bottom";
type Horizontal = "left" | "center" | "right";
type Position = `${Vertical}-${Horizontal}`;
type Format = "n" | "page-n" | "page-n-of-total" | "n-slash-total";

const FORMATS: Array<{ value: Format; label: string }> = [
  { value: "n", label: "1" },
  { value: "page-n", label: "Page 1" },
  { value: "page-n-of-total", label: "Page 1 of N" },
  { value: "n-slash-total", label: "1 / N" },
];

const POSITION_LABEL: Record<Position, string> = {
  "top-left": "Top left",
  "top-center": "Top centre",
  "top-right": "Top right",
  "bottom-left": "Bottom left",
  "bottom-center": "Bottom centre",
  "bottom-right": "Bottom right",
};

interface NumberingSettings {
  position: Position;
  format: Format;
  start: number;
  size: number;
  margin: number;
  skipFirst: boolean;
  pageCount: number;
}

function formatNumber(format: Format, n: number, last: number): string {
  switch (format) {
    case "page-n":
      return `Page ${n}`;
    case "page-n-of-total":
      return `Page ${n} of ${last}`;
    case "n-slash-total":
      return `${n} / ${last}`;
    default:
      return String(n);
  }
}

function numberingTransform({ position, format, start, size, margin, skipFirst, pageCount }: NumberingSettings): PageTransform {
  return async (doc, pageIndexes) => {
    const { StandardFonts, degrees, rgb } = await loadPdfLib();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const [vertical, horizontal] = position.split("-") as [Vertical, Horizontal];
    const skipped = skipFirst && pageCount > 1 ? 1 : 0;
    const last = start + pageCount - skipped - 1;

    doc.getPages().forEach((page, i) => {
      const original = pageIndexes[i];
      if (original < skipped) return;
      const label = formatNumber(format, start + original - skipped, last);
      const frame = pageFrame(page);
      const width = font.widthOfTextAtSize(label, size);
      const height = font.heightAtSize(size, { descender: false });
      const cx =
        horizontal === "left" ? margin + width / 2 : horizontal === "right" ? frame.width - margin - width / 2 : frame.width / 2;
      const cy = vertical === "top" ? frame.height - margin - height / 2 : margin + height / 2;
      const origin = centredTextOrigin(frame, font, label, size, cx, cy, 0);
      page.drawText(label, { x: origin.x, y: origin.y, size, font, color: rgb(0, 0, 0), rotate: degrees(origin.rotate) });
    });
  };
}

/** Six-spot picker drawn like a page, so the choice is obvious at a glance. */
function PositionPicker({
  value,
  onChange,
  labelledBy,
}: {
  value: Position;
  onChange: (value: Position) => void;
  labelledBy: string;
}) {
  const spot = (position: Position) => {
    const [, horizontal] = position.split("-") as [Vertical, Horizontal];
    const active = value === position;
    return (
      <button
        key={position}
        type="button"
        role="radio"
        aria-checked={active}
        aria-label={POSITION_LABEL[position]}
        title={POSITION_LABEL[position]}
        onClick={() => onChange(position)}
        className={cn(
          "flex h-8 items-center rounded-md px-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          horizontal === "left" ? "justify-start" : horizontal === "right" ? "justify-end" : "justify-center",
          active ? "bg-primary-soft" : "hover:bg-primary-soft/60",
        )}
      >
        <span className={cn("h-1.5 w-4 rounded-full", active ? "bg-primary" : "bg-line")} />
      </button>
    );
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="grid aspect-[3/4] w-32 grid-cols-3 grid-rows-[auto_1fr_auto] gap-1 rounded-lg border border-line bg-surface p-1.5 shadow-sm"
    >
      {(["top-left", "top-center", "top-right"] as const).map(spot)}
      <div aria-hidden className="col-span-3 mx-2 space-y-1.5 py-2">
        {[100, 85, 92, 70, 88, 60].map((w, i) => (
          <span key={i} className="block h-1 rounded-full bg-line/70" style={{ width: `${w}%` }} />
        ))}
      </div>
      {(["bottom-left", "bottom-center", "bottom-right"] as const).map(spot)}
    </div>
  );
}

function NumbersWorkspace({ pdf }: { pdf: LoadedPdf }) {
  const { track } = useTool();
  const positionLabel = useId();
  const [position, setPosition] = useState<Position>("bottom-center");
  const [format, setFormat] = useState<Format>("n");
  const [start, setStart] = useState(1);
  const [size, setSize] = useState(11);
  const [margin, setMargin] = useState(28);
  const [skipFirst, setSkipFirst] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OutputFile | null>(null);

  const transform = useMemo(
    () => numberingTransform({ position, format, start, size, margin, skipFirst, pageCount: pdf.pageCount }),
    [position, format, start, size, margin, skipFirst, pdf.pageCount],
  );
  const previewIndex = skipFirst && pdf.pageCount > 1 ? 1 : 0;
  const preview = usePagePreview(pdf, previewIndex, transform);

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
      const output = { blob: await savePdf(doc), name: withSuffix(pdf.file.name, "-numbered") };
      setResult(output);
      downloadBlob(output.blob, output.name);
      track();
    } catch (e) {
      setError(pdfErrorMessage(e, "Page numbers could not be added. Check that the PDF opens in a PDF reader."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ToolColumns>
        <Panel title="Page numbers">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-x-6 gap-y-4">
              <div>
                <p id={positionLabel} className="mb-1.5 text-sm font-medium text-ink">
                  Position
                </p>
                <PositionPicker value={position} onChange={change(setPosition)} labelledBy={positionLabel} />
                <p className="mt-1.5 text-xs text-muted">{POSITION_LABEL[position]}</p>
              </div>
              <div className="min-w-40 flex-1 space-y-4">
                <div>
                  <Label htmlFor="page-number-format">Format</Label>
                  <Select
                    id="page-number-format"
                    value={format}
                    onChange={(e) => change(setFormat)(e.target.value as Format)}
                  >
                    {FORMATS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <NumberField id="page-number-start" label="Start at" value={start} min={0} max={99_999} onChange={change(setStart)} />
              </div>
            </div>
            <RangeField label="Font size" value={size} min={6} max={36} onChange={change(setSize)} format={(v) => `${v} pt`} />
            <RangeField
              label="Distance from edge"
              value={margin}
              min={6}
              max={96}
              step={2}
              onChange={change(setMargin)}
              format={(v) => `${v} pt (${((v / 72) * 2.54).toFixed(1)} cm)`}
            />
            <Switch
              label="Skip the first page"
              description="Leave a cover page unnumbered. Numbering starts on page 2 with your start number."
              checked={skipFirst}
              disabled={pdf.pageCount < 2}
              onChange={(e) => change(setSkipFirst)(e.target.checked)}
            />
          </div>
        </Panel>
        <PagePreviewPanel
          title={`Preview (page ${previewIndex + 1})`}
          alt={`Page ${previewIndex + 1} with its page number`}
          blob={preview.blob}
          error={preview.error}
          rendering={preview.rendering}
        />
      </ToolColumns>

      <ErrorText>{error}</ErrorText>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={apply} disabled={busy}>
          <ListOrdered aria-hidden />
          Add page numbers
        </Button>
        {busy ? <Progress>Numbering pages…</Progress> : null}
      </div>

      {result ? <DownloadResult result={result} /> : null}
    </>
  );
}

export default function PdfPageNumbers() {
  const state = usePdfFile();
  return (
    <div className="space-y-4">
      <PdfFilePicker state={state} />
      {state.pdf ? <NumbersWorkspace key={state.pdf.id} pdf={state.pdf} /> : null}
    </div>
  );
}
