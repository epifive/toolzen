"use client";

import { useState } from "react";
import { FilePlus } from "lucide-react";
import type { PDFDocument, PDFImage } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { ErrorText, FileDropzone, Panel, Segmented } from "@/components/tool-ui";
import { canvasToBlob, createCanvas, downloadBlob, loadImage, renameExtension } from "@/lib/files";
import { uid } from "@/lib/utils";
import { useTool } from "@/tools/context";
import { RASTER_ACCEPT } from "@/tools/lib/image";
import { ImageThumb } from "@/tools/lib/image-ui";
import { loadPdfLib, nextFrame, PdfUserError, pdfErrorMessage, savePdf } from "@/tools/lib/pdf";
import { DownloadResult, Progress, type OutputFile } from "@/tools/lib/pdf-file";
import { moveItem, SortableFileList } from "@/tools/lib/sortable-file-list";

type PageSize = "fit" | "a4" | "letter";
type Orientation = "auto" | "portrait" | "landscape";
type Margin = "none" | "small" | "large";

interface Item {
  id: string;
  file: File;
}

/** Portrait page sizes in PDF points (1/72 inch). */
const PAGE_SIZES: Record<Exclude<PageSize, "fit">, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

/** Margins in points: none, a quarter inch and half an inch. */
const MARGINS: Record<Margin, number> = { none: 0, small: 18, large: 36 };

/** Images are treated as 96 DPI, so a 960 px wide picture becomes a 10 inch wide page. */
const POINTS_PER_PIXEL = 72 / 96;

/** Largest page side the PDF format allows (200 inches). */
const MAX_PAGE_SIDE = 14_400;

/**
 * Reads the EXIF orientation of a JPEG (1 = upright). Phone photos are often stored sideways
 * with this flag set; PDF readers ignore it, so such photos must be redrawn upright first.
 */
function jpegOrientation(buffer: ArrayBuffer): number {
  try {
    const view = new DataView(buffer);
    if (view.getUint16(0) !== 0xffd8) return 1;
    let offset = 2;
    while (offset + 10 < view.byteLength) {
      const marker = view.getUint16(offset);
      if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return 1;
      const length = view.getUint16(offset + 2);
      // APP1 segment starting with "Exif".
      if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966) {
        const tiff = offset + 10;
        const little = view.getUint16(tiff) === 0x4949;
        const ifd = tiff + view.getUint32(tiff + 4, little);
        const entries = view.getUint16(ifd, little);
        for (let i = 0; i < entries; i++) {
          const entry = ifd + 2 + i * 12;
          if (view.getUint16(entry, little) === 0x0112) return view.getUint16(entry + 8, little);
        }
        return 1;
      }
      offset += 2 + length;
    }
  } catch {
    // Truncated or unusual metadata: treat the image as upright.
  }
  return 1;
}

/** Redraws an image upright on a canvas (browsers apply EXIF orientation when drawing). */
async function redraw(file: File, type: "image/png" | "image/jpeg"): Promise<ArrayBuffer> {
  const image = await loadImage(file);
  const canvas = createCanvas(image.naturalWidth, image.naturalHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PdfUserError("Your browser could not prepare the image.");
  if (type === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(image, 0, 0);
  return (await canvasToBlob(canvas, type, 0.92)).arrayBuffer();
}

/**
 * Embeds an image file in `doc`. JPEG and PNG files are embedded as they are (no quality loss);
 * rotated JPEGs and every other format are converted on a canvas first.
 */
async function embedImage(doc: PDFDocument, file: File): Promise<PDFImage> {
  const buffer = await file.arrayBuffer();
  const name = file.name.toLowerCase();
  const isJpeg = file.type === "image/jpeg" || /\.jpe?g$/.test(name);
  const isPng = file.type === "image/png" || name.endsWith(".png");
  try {
    if (isJpeg) {
      return jpegOrientation(buffer) > 1
        ? await doc.embedJpg(await redraw(file, "image/jpeg"))
        : await doc.embedJpg(buffer);
    }
    if (isPng) return await doc.embedPng(buffer);
  } catch {
    // Unusual encodings (e.g. 16-bit or CMYK variants) fall through to the canvas conversion.
  }
  try {
    return await doc.embedPng(await redraw(file, "image/png"));
  } catch {
    throw new PdfUserError(`${file.name} could not be read as an image.`);
  }
}

function layout(image: PDFImage, size: PageSize, orientation: Orientation, margin: number) {
  let width = image.width * POINTS_PER_PIXEL;
  let height = image.height * POINTS_PER_PIXEL;

  if (size === "fit") {
    const shrink = Math.min(1, (MAX_PAGE_SIDE - 2 * margin) / Math.max(width, height));
    width *= shrink;
    height *= shrink;
    return { pageWidth: width + 2 * margin, pageHeight: height + 2 * margin, x: margin, y: margin, width, height };
  }

  const [short, long] = PAGE_SIZES[size];
  const landscape = orientation === "landscape" || (orientation === "auto" && image.width > image.height);
  const pageWidth = landscape ? long : short;
  const pageHeight = landscape ? short : long;
  const scale = Math.min((pageWidth - 2 * margin) / width, (pageHeight - 2 * margin) / height);
  width *= scale;
  height *= scale;
  return { pageWidth, pageHeight, x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height };
}

export default function ImagesToPdf() {
  const { track } = useTool();
  const [items, setItems] = useState<Item[]>([]);
  const [size, setSize] = useState<PageSize>("a4");
  const [orientation, setOrientation] = useState<Orientation>("auto");
  const [margin, setMargin] = useState<Margin>("small");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<OutputFile | null>(null);

  function change<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setResult(null);
      setError("");
    };
  }

  async function create() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const { PDFDocument } = await loadPdfLib();
      const doc = await PDFDocument.create();
      for (const [index, item] of items.entries()) {
        setProgress(`Adding image ${index + 1} of ${items.length}…`);
        await nextFrame();
        const image = await embedImage(doc, item.file);
        const box = layout(image, size, orientation, MARGINS[margin]);
        const page = doc.addPage([box.pageWidth, box.pageHeight]);
        page.drawImage(image, { x: box.x, y: box.y, width: box.width, height: box.height });
      }
      setProgress("Saving the PDF…");
      await nextFrame();
      const name = items.length === 1 ? renameExtension(items[0].file.name, "pdf") : "images.pdf";
      const output = { blob: await savePdf(doc), name };
      setResult(output);
      downloadBlob(output.blob, output.name);
      track();
    } catch (e) {
      setError(pdfErrorMessage(e, "The PDF could not be created. Try removing unusual image files."));
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <div className="space-y-4">
      <FileDropzone
        accept={RASTER_ACCEPT}
        multiple
        currentCount={items.length}
        compact={items.length > 0}
        label={items.length ? "Add more images" : "Drop images here or click to choose"}
        onFiles={(files) => change(setItems)([...items, ...files.map((file) => ({ id: uid(), file }))])}
      />

      {items.length ? (
        <>
          <Panel title="Page settings">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-ink">Page size</legend>
                <Segmented<PageSize>
                  label="Page size"
                  value={size}
                  onChange={change(setSize)}
                  options={[
                    { value: "fit", label: "Fit image" },
                    { value: "a4", label: "A4" },
                    { value: "letter", label: "Letter" },
                  ]}
                />
              </fieldset>
              {size === "fit" ? (
                <p className="self-end text-sm text-muted sm:pb-3">Each page takes the size of its image.</p>
              ) : (
                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium text-ink">Orientation</legend>
                  <Segmented<Orientation>
                    label="Orientation"
                    value={orientation}
                    onChange={change(setOrientation)}
                    options={[
                      { value: "auto", label: "Auto" },
                      { value: "portrait", label: "Portrait" },
                      { value: "landscape", label: "Landscape" },
                    ]}
                  />
                </fieldset>
              )}
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-ink">Margin</legend>
                <Segmented<Margin>
                  label="Margin"
                  value={margin}
                  onChange={change(setMargin)}
                  options={[
                    { value: "none", label: "None" },
                    { value: "small", label: "Small" },
                    { value: "large", label: "Large" },
                  ]}
                />
              </fieldset>
            </div>
          </Panel>

          <SortableFileList
            label="Images, in page order"
            disabled={busy}
            items={items.map((item) => ({
              id: item.id,
              name: item.file.name,
              size: item.file.size,
              thumbnail: <ImageThumb file={item.file} />,
            }))}
            onMove={(from, to) => change(setItems)(moveItem(items, from, to))}
            onRemove={(id) => change(setItems)(items.filter((i) => i.id !== id))}
          />
          <p className="text-sm text-muted">Drag the images, or use the arrows, to set the page order.</p>

          <ErrorText>{error}</ErrorText>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={create} disabled={busy}>
              <FilePlus aria-hidden />
              Create PDF ({items.length} page{items.length === 1 ? "" : "s"})
            </Button>
            {busy ? <Progress>{progress}</Progress> : null}
          </div>

          {result ? <DownloadResult result={result} /> : null}
        </>
      ) : null}
    </div>
  );
}
