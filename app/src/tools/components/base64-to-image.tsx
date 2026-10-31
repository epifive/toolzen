"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ErrorText, Panel, Stat, StatGrid, TextInput, ToolColumns, useObjectUrl } from "@/components/tool-ui";
import { downloadBlob } from "@/lib/files";
import { formatBytes } from "@/lib/utils";
import { useTool } from "@/tools/context";
import { PreviewFrame, PreviewImage } from "@/tools/lib/image-ui";

interface ImageType {
  mime: string;
  ext: string;
  label: string;
}

type Decoded =
  | { ok: true; blob: Blob; type: ImageType; declared: string | null }
  | { ok: false; error: string };

const TYPES = {
  png: { mime: "image/png", ext: "png", label: "PNG" },
  jpeg: { mime: "image/jpeg", ext: "jpg", label: "JPEG" },
  gif: { mime: "image/gif", ext: "gif", label: "GIF" },
  webp: { mime: "image/webp", ext: "webp", label: "WebP" },
  svg: { mime: "image/svg+xml", ext: "svg", label: "SVG" },
} satisfies Record<string, ImageType>;

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((b, i) => bytes[offset + i] === b);
}

/** Identify the image format from its first bytes ("magic numbers"). */
function detectType(bytes: Uint8Array): ImageType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return TYPES.png;
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return TYPES.jpeg;
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) {
    return TYPES.gif;
  }
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return TYPES.webp;
  // TextDecoder drops a leading byte-order mark by default.
  const head = new TextDecoder().decode(bytes.subarray(0, 4096));
  if (/^\s*</.test(head) && /<svg[\s>]/i.test(head)) return TYPES.svg;
  return null;
}

function base64ToBytes(input: string): Uint8Array<ArrayBuffer> | null {
  const clean = input
    .replace(/\s+/g, "")
    .replace(/%3D/gi, "=")
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .replace(/=+$/, "");
  if (!clean || !/^[A-Za-z0-9+/]+$/.test(clean) || clean.length % 4 === 1) return null;
  const binary = atob(clean + "=".repeat((4 - (clean.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decode(raw: string): Decoded | null {
  // Accept values copied from CSS (url("…")) or code (quoted strings) as well.
  const text = raw
    .trim()
    .replace(/^url\(\s*(['"]?)([\s\S]*)\1\s*\)$/i, "$2")
    .replace(/^(['"])([\s\S]*)\1$/, "$2")
    .trim();
  if (!text) return null;

  let payload = text;
  let declared: string | null = null;
  let isBase64 = true;
  const dataUri = /^data:([^,]*),([\s\S]*)$/i.exec(text);
  if (dataUri) {
    const params = dataUri[1].split(";").map((p) => p.trim().toLowerCase());
    declared = params[0] || null;
    isBase64 = params.includes("base64");
    payload = dataUri[2];
  }

  let bytes: Uint8Array<ArrayBuffer> | null;
  if (isBase64) {
    bytes = base64ToBytes(payload);
    if (!bytes) {
      return {
        ok: false,
        error: "This is not valid Base64. It may be incomplete or contain characters that don't belong in Base64.",
      };
    }
  } else {
    try {
      bytes = new TextEncoder().encode(decodeURIComponent(payload));
    } catch {
      return { ok: false, error: "This data URI is not correctly URL-encoded." };
    }
  }

  const type = detectType(bytes);
  if (!type) {
    return {
      ok: false,
      error:
        declared?.startsWith("image/")
          ? `The data is labelled ${declared}, but its content is not a PNG, JPEG, GIF, WebP or SVG image.`
          : "The decoded data is not a PNG, JPEG, GIF, WebP or SVG image.",
    };
  }
  return { ok: true, blob: new Blob([bytes], { type: type.mime }), type, declared };
}

export default function Base64ToImage() {
  const { track } = useTool();
  const [input, setInput] = useState("");
  const [loaded, setLoaded] = useState<{ url: string; width: number; height: number } | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const decoded = useMemo(() => decode(input), [input]);
  const result = decoded?.ok ? decoded : null;
  const url = useObjectUrl(result?.blob);
  const dims = loaded && loaded.url === url ? loaded : null;
  const failed = url !== null && failedUrl === url;

  useEffect(() => {
    if (dims) track();
  }, [dims, track]);

  return (
    <ToolColumns>
      <TextInput
        label="Base64 or data URI"
        value={input}
        onChange={setInput}
        placeholder="data:image/png;base64,iVBORw0KGgo… or just the Base64 text"
        rows={14}
        mono
      />

      <Panel title="Image">
        {decoded && !decoded.ok ? (
          <ErrorText>{decoded.error}</ErrorText>
        ) : result && url ? (
          <div className="space-y-4">
            {failed ? (
              <ErrorText>
                The data looks like a {result.type.label} image, but your browser could not display it. The file may be
                damaged or incomplete.
              </ErrorText>
            ) : (
              <PreviewFrame className="min-h-48">
                <PreviewImage
                  src={url}
                  alt="Decoded image"
                  className="max-h-80 max-w-full object-contain"
                  onLoad={(e) =>
                    setLoaded({ url, width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })
                  }
                  onError={() => setFailedUrl(url)}
                />
              </PreviewFrame>
            )}
            {result.declared && result.declared !== result.type.mime ? (
              <Alert tone="info">
                The data URI says <code className="font-mono">{result.declared}</code>, but the content is a{" "}
                {result.type.label} image. The file is saved as {result.type.label}.
              </Alert>
            ) : null}
            <StatGrid>
              <Stat label="Type" value={result.type.label} />
              <Stat label="Dimensions" value={dims ? `${dims.width} × ${dims.height}` : "—"} />
              <Stat label="File size" value={formatBytes(result.blob.size)} />
            </StatGrid>
            <Button onClick={() => downloadBlob(result.blob, `image.${result.type.ext}`)} disabled={failed}>
              <Download aria-hidden />
              Download {result.type.label}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted">Paste a Base64 string or a data URI to see the image here.</p>
        )}
      </Panel>
    </ToolColumns>
  );
}
