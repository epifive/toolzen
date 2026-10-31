"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch } from "@/components/ui/field";
import { ErrorText, FileDropzone, OutputBox, Panel, Segmented, Spinner, ToolColumns } from "@/components/tool-ui";
import { canvasToBlob, createCanvas, downloadBlob, downloadZip } from "@/lib/files";
import { cn } from "@/lib/utils";
import { useTool } from "@/tools/context";
import {
  CHECKERBOARD,
  context2d,
  drawScaled,
  errorMessage,
  IMAGE_ACCEPT,
  openImage,
  paintBackground,
  type SourceImage,
} from "@/tools/lib/image";
import { ColorField } from "@/tools/lib/image-ui";

type Fit = "contain" | "cover";

const MASTER_SIZE = 512;
const PREVIEW_SIZES = [16, 32, 48, 180, 192, 512] as const;
type IconSize = (typeof PREVIEW_SIZES)[number];
type Icons = Record<IconSize, HTMLCanvasElement>;

const ICO_SIZES: IconSize[] = [16, 32, 48];
const PNG_FILES: Array<{ size: IconSize; name: string }> = [
  { size: 16, name: "favicon-16x16.png" },
  { size: 32, name: "favicon-32x32.png" },
  { size: 180, name: "apple-touch-icon.png" },
  { size: 192, name: "android-chrome-192x192.png" },
  { size: 512, name: "android-chrome-512x512.png" },
];

/** Renders the source onto a square master canvas, then derives every icon size from it. */
function buildIcons(source: SourceImage, fit: Fit, background: string | null): Icons {
  const master = createCanvas(MASTER_SIZE, MASTER_SIZE);
  const ctx = context2d(master);
  if (background) paintBackground(ctx, background);

  const { width: w, height: h } = source;
  if (fit === "cover") {
    const side = Math.min(w, h);
    const region = { x: (w - side) / 2, y: (h - side) / 2, width: side, height: side };
    ctx.drawImage(drawScaled(source.image, region, MASTER_SIZE, MASTER_SIZE), 0, 0);
  } else {
    const scale = MASTER_SIZE / Math.max(w, h);
    const dw = Math.max(1, Math.round(w * scale));
    const dh = Math.max(1, Math.round(h * scale));
    const scaled = drawScaled(source.image, { x: 0, y: 0, width: w, height: h }, dw, dh);
    ctx.drawImage(scaled, Math.round((MASTER_SIZE - dw) / 2), Math.round((MASTER_SIZE - dh) / 2));
  }

  const full = { x: 0, y: 0, width: MASTER_SIZE, height: MASTER_SIZE };
  return Object.fromEntries(
    PREVIEW_SIZES.map((size) => [size, size === MASTER_SIZE ? master : drawScaled(master, full, size, size)]),
  ) as Icons;
}

/** Writes an ICO file with PNG-encoded entries (supported by all current browsers and Windows Vista or later). */
function buildIco(entries: Array<{ size: number; data: Uint8Array }>): Uint8Array<ArrayBuffer> {
  const headerSize = 6 + 16 * entries.length;
  const total = entries.reduce((sum, e) => sum + e.data.length, headerSize);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);

  // ICONDIR: reserved, type (1 = icon), image count.
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, entries.length, true);

  let offset = headerSize;
  entries.forEach((entry, i) => {
    const at = 6 + i * 16;
    const dimension = entry.size >= 256 ? 0 : entry.size; // 0 means 256 px
    view.setUint8(at, dimension); // width
    view.setUint8(at + 1, dimension); // height
    view.setUint8(at + 2, 0); // palette size
    view.setUint8(at + 3, 0); // reserved
    view.setUint16(at + 4, 1, true); // colour planes
    view.setUint16(at + 6, 32, true); // bits per pixel
    view.setUint32(at + 8, entry.data.length, true); // image data size
    view.setUint32(at + 12, offset, true); // image data offset
    out.set(entry.data, offset);
    offset += entry.data.length;
  });
  return out;
}

async function pngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Uint8Array(await (await canvasToBlob(canvas, "image/png")).arrayBuffer());
}

function webManifest(name: string, themeColor: string): string {
  return JSON.stringify(
    {
      name,
      short_name: name,
      icons: [
        { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      ],
      theme_color: themeColor,
      background_color: themeColor,
      display: "standalone",
    },
    null,
    2,
  );
}

function htmlSnippet(themeColor: string): string {
  return [
    '<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
    '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
    `<meta name="theme-color" content="${themeColor}">`,
  ].join("\n");
}

/** Shows an icon canvas at its real pixel size (capped by `display`). */
function IconCanvas({ icon, display, className }: { icon: HTMLCanvasElement; display: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = icon.width;
    canvas.height = icon.height;
    context2d(canvas).drawImage(icon, 0, 0);
  }, [icon]);
  return <canvas ref={ref} aria-hidden className={className} style={{ width: display, height: display }} />;
}

export default function FaviconGenerator() {
  const { track } = useTool();
  const [source, setSource] = useState<SourceImage | null>(null);
  const [fit, setFit] = useState<Fit>("contain");
  const [fillBackground, setFillBackground] = useState(false);
  const [background, setBackground] = useState("#ffffff");
  const [appName, setAppName] = useState("");
  const [themeColor, setThemeColor] = useState("#ffffff");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const square = source ? source.width === source.height : true;
  const built = useMemo(() => {
    if (!source) return null;
    try {
      return { icons: buildIcons(source, fit, fillBackground ? background : null), error: "" };
    } catch (e) {
      return { icons: null, error: errorMessage(e, "The icons could not be drawn from this image.") };
    }
  }, [source, fit, fillBackground, background]);
  const icons = built?.icons ?? null;
  const snippet = htmlSnippet(themeColor);
  const name = appName.trim() || "My Website";

  async function open(files: File[]) {
    setError("");
    try {
      setSource(await openImage(files[0], { svgMinSize: MASTER_SIZE }));
    } catch (e) {
      setError(errorMessage(e, "This image could not be opened."));
    }
  }

  async function buildFiles() {
    if (!icons) throw new Error("Choose an image first.");
    const ico = buildIco(await Promise.all(ICO_SIZES.map(async (size) => ({ size, data: await pngBytes(icons[size]) }))));
    const pngs = await Promise.all(
      PNG_FILES.map(async (f) => ({ name: f.name, data: await canvasToBlob(icons[f.size], "image/png") })),
    );
    return { ico, pngs };
  }

  async function downloadAll() {
    setBusy(true);
    setError("");
    try {
      const { ico, pngs } = await buildFiles();
      await downloadZip(
        [{ name: "favicon.ico", data: ico }, ...pngs, { name: "site.webmanifest", data: webManifest(name, themeColor) }],
        "favicon.zip",
      );
      track();
    } catch (e) {
      setError(errorMessage(e, "The favicon package could not be created."));
    } finally {
      setBusy(false);
    }
  }

  async function downloadIco() {
    setError("");
    try {
      const { ico } = await buildFiles();
      downloadBlob(new Blob([ico], { type: "image/x-icon" }), "favicon.ico");
      track();
    } catch (e) {
      setError(errorMessage(e, "favicon.ico could not be created."));
    }
  }

  return (
    <div className="space-y-4">
      <FileDropzone
        accept={IMAGE_ACCEPT}
        onFiles={open}
        compact={!!source}
        label={source ? "Choose a different image" : undefined}
        hint={source ? undefined : "PNG, JPG, WebP or SVG. A square image of at least 512 × 512 px works best."}
      />

      {source && icons ? (
        <>
          <ToolColumns>
            <Panel title="Settings">
              <div className="space-y-4">
                {!square ? (
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-ink">Your image is not square</p>
                    <Segmented
                      label="How to make it square"
                      value={fit}
                      onChange={setFit}
                      options={[
                        { value: "contain", label: "Fit whole image" },
                        { value: "cover", label: "Crop to square" },
                      ]}
                    />
                  </div>
                ) : null}
                {Math.min(source.width, source.height) < MASTER_SIZE ? (
                  <p className="text-sm text-muted">
                    Your image is {source.width} × {source.height} px. Large icons will look sharper from an image of at least{" "}
                    {MASTER_SIZE} × {MASTER_SIZE} px.
                  </p>
                ) : null}
                <Switch
                  label="Fill the background"
                  description="Recommended for the Apple touch icon, which iOS shows on black when it is transparent."
                  checked={fillBackground}
                  onChange={(e) => setFillBackground(e.target.checked)}
                />
                {fillBackground ? (
                  <ColorField id="favicon-background" label="Background colour" value={background} onChange={setBackground} />
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Site name" htmlFor="favicon-name" hint="Used in site.webmanifest.">
                    <Input
                      id="favicon-name"
                      value={appName}
                      maxLength={60}
                      placeholder="My Website"
                      onChange={(e) => setAppName(e.target.value)}
                    />
                  </Field>
                  <ColorField id="favicon-theme" label="Theme colour" value={themeColor} onChange={setThemeColor} />
                </div>
              </div>
            </Panel>

            <Panel title="Preview">
              <div className="space-y-5">
                <div className="overflow-hidden rounded-lg border border-line bg-paper pt-2">
                  <div className="ml-2 flex w-56 max-w-[85%] items-center gap-2 rounded-t-lg border border-b-0 border-line bg-surface px-3 py-2">
                    <IconCanvas icon={icons[16]} display={16} className="shrink-0" />
                    <span className="truncate text-xs text-ink">{name}</span>
                  </div>
                  <div className="h-3 border-t border-line bg-surface" />
                </div>

                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {PREVIEW_SIZES.map((size) => (
                    <li key={size} className="flex flex-col items-center gap-2 rounded-lg border border-line p-2 text-center">
                      <div className="grid size-24 place-items-center rounded-md" style={CHECKERBOARD}>
                        <IconCanvas
                          icon={icons[size]}
                          display={size > 48 ? 80 : size}
                          className={cn(size === 180 && "rounded-[22%]")}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-muted">
                        {size} × {size}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
          </ToolColumns>

          <ErrorText>{error}</ErrorText>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={downloadAll} disabled={busy}>
              {busy ? <Spinner /> : <Package aria-hidden />}
              {busy ? "Creating ZIP…" : "Download favicon package (ZIP)"}
            </Button>
            <Button variant="outline" onClick={downloadIco} disabled={busy}>
              <Download aria-hidden />
              favicon.ico only
            </Button>
          </div>

          <OutputBox label="HTML for your <head>" value={snippet} mono rows={6} />
          <p className="text-sm text-muted">
            Upload the files from the ZIP to the root folder of your website, then paste this code inside the{" "}
            <code className="font-mono text-ink">&lt;head&gt;</code> of every page.
          </p>
        </>
      ) : (
        <ErrorText>{error || built?.error}</ErrorText>
      )}
    </div>
  );
}
