/**
 * Browser-side file helpers shared by the tools. Client components only.
 */

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function downloadText(text: string, filename: string, type = "text/plain;charset=utf-8"): void {
  downloadBlob(new Blob([text], { type }), filename);
}

export function readAsText(file: File): Promise<string> {
  return file.text();
}

export async function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

/** Decode an image file (or URL) into an HTMLImageElement that is ready to draw. */
export function loadImage(source: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = typeof source === "string" ? source : URL.createObjectURL(source);
    img.onload = () => {
      if (typeof source !== "string") URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      if (typeof source !== "string") URL.revokeObjectURL(url);
      reject(new Error("This file could not be opened as an image."));
    };
    img.decoding = "async";
    img.src = url;
  });
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Your browser could not create the image."))),
      type,
      quality,
    );
  });
}

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

/** Replace the extension of a file name, e.g. ("photo.png", "webp") → "photo.webp". */
export function renameExtension(name: string, ext: string): string {
  const base = name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name;
  return `${base}.${ext.replace(/^\./, "")}`;
}

/** Add a suffix before the extension, e.g. ("photo.png", "-small") → "photo-small.png". */
export function withSuffix(name: string, suffix: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? `${name.slice(0, dot)}${suffix}${name.slice(dot)}` : `${name}${suffix}`;
}

export const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
};

/** Bundle several files into a ZIP and download it. */
export async function downloadZip(files: Array<{ name: string; data: Blob | Uint8Array | string }>, zipName: string) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const used = new Set<string>();
  for (const f of files) {
    let name = f.name;
    let i = 1;
    while (used.has(name)) name = withSuffix(f.name, `-${i++}`);
    used.add(name);
    zip.file(name, f.data);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, zipName);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers / insecure origins.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}
