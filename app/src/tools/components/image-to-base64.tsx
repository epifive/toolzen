"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { ErrorText, FileDropzone, OutputBox, Panel, Segmented, Stat, StatGrid, ToolColumns } from "@/components/tool-ui";
import { loadImage, readAsDataUrl, renameExtension, withSuffix } from "@/lib/files";
import { formatBytes } from "@/lib/utils";
import { useTool } from "@/tools/context";
import { errorMessage, IMAGE_ACCEPT, isSvgFile } from "@/tools/lib/image";
import { PreviewFrame, PreviewImage } from "@/tools/lib/image-ui";

type Mode = "data-uri" | "base64" | "html" | "css";

interface Encoded {
  file: File;
  dataUrl: string;
  mime: string;
  width: number | null;
  height: number | null;
}

const MODES: Array<{ value: Mode; label: string; ext: string }> = [
  { value: "data-uri", label: "Data URI", ext: "txt" },
  { value: "base64", label: "Base64", ext: "txt" },
  { value: "html", label: "HTML <img>", ext: "html" },
  { value: "css", label: "CSS background", ext: "css" },
];

/** Files larger than this rarely belong inline in HTML or CSS. */
const INLINE_WARNING_BYTES = 100 * 1024;

async function encode(file: File): Promise<Encoded> {
  let dataUrl = await readAsDataUrl(file);
  // Some systems report SVG files without a MIME type; give the data URI the right one.
  if (isSvgFile(file) && !dataUrl.startsWith("data:image/svg+xml")) {
    dataUrl = `data:image/svg+xml;base64,${dataUrl.slice(dataUrl.indexOf(",") + 1)}`;
  }
  const mime = dataUrl.slice(5, dataUrl.indexOf(";"));
  try {
    const img = await loadImage(dataUrl);
    return { file, dataUrl, mime, width: img.naturalWidth || null, height: img.naturalHeight || null };
  } catch {
    throw new Error("This file could not be opened as an image.");
  }
}

function output(encoded: Encoded, mode: Mode): string {
  const { dataUrl, width, height } = encoded;
  switch (mode) {
    case "base64":
      return dataUrl.slice(dataUrl.indexOf(",") + 1);
    case "html": {
      const size = width && height ? ` width="${width}" height="${height}"` : "";
      return `<img src="${dataUrl}" alt=""${size}>`;
    }
    case "css":
      return `.image {\n  background-image: url("${dataUrl}");\n}`;
    default:
      return dataUrl;
  }
}

export default function ImageToBase64() {
  const { track } = useTool();
  const [encoded, setEncoded] = useState<Encoded | null>(null);
  const [mode, setMode] = useState<Mode>("data-uri");
  const [error, setError] = useState("");

  const value = encoded ? output(encoded, mode) : "";
  const ext = MODES.find((m) => m.value === mode)?.ext ?? "txt";

  async function open(files: File[]) {
    setError("");
    try {
      setEncoded(await encode(files[0]));
      track();
    } catch (e) {
      setError(errorMessage(e, "This image could not be encoded."));
    }
  }

  return (
    <div className="space-y-4">
      <FileDropzone
        accept={IMAGE_ACCEPT}
        onFiles={open}
        compact={!!encoded}
        label={encoded ? "Choose a different image" : undefined}
      />
      <ErrorText>{error}</ErrorText>

      {encoded ? (
        <>
          <ToolColumns>
            <Panel title="Image">
              <PreviewFrame className="min-h-48">
                <PreviewImage src={encoded.dataUrl} alt={encoded.file.name} className="max-h-72 max-w-full object-contain" />
              </PreviewFrame>
            </Panel>
            <div className="space-y-4">
              <StatGrid className="sm:grid-cols-2">
                <Stat label="Type" value={encoded.mime.replace("image/", "").replace("svg+xml", "svg").toUpperCase()} />
                <Stat label="Dimensions" value={encoded.width && encoded.height ? `${encoded.width} × ${encoded.height}` : "—"} />
                <Stat label="Original size" value={formatBytes(encoded.file.size)} />
                <Stat label="Output size" value={formatBytes(value.length)} emphasis />
              </StatGrid>
              {encoded.file.size > INLINE_WARNING_BYTES ? (
                <Alert tone="warning" title="This is a large image to inline">
                  Base64 is about a third larger than the file and cannot be cached separately. Inline only small images
                  such as icons and logos.
                </Alert>
              ) : null}
            </div>
          </ToolColumns>

          <Segmented label="Output format" value={mode} onChange={setMode} options={MODES} />

          <OutputBox
            label={MODES.find((m) => m.value === mode)?.label ?? "Result"}
            value={value}
            filename={withSuffix(renameExtension(encoded.file.name, ext), "-base64")}
            mono
            rows={8}
          />
        </>
      ) : null}
    </div>
  );
}
