/**
 * Hands files dropped on the home page to the tool the visitor picks next.
 * Lives in memory only: files never leave the browser and are forgotten on reload.
 */

let pending: File[] = [];

export function setPendingFiles(files: File[]): void {
  pending = files;
}

/** Returns (and clears) any waiting files. */
export function takePendingFiles(): File[] {
  const files = pending;
  pending = [];
  return files;
}

export type DroppedKind = "image" | "svg" | "pdf" | "csv" | "json" | "text";

export function detectFileKind(file: File): DroppedKind | null {
  const name = file.name.toLowerCase();
  if (file.type === "image/svg+xml" || name.endsWith(".svg")) return "svg";
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (file.type === "text/csv" || name.endsWith(".csv")) return "csv";
  if (file.type === "application/json" || name.endsWith(".json")) return "json";
  if (file.type.startsWith("text/") || /\.(txt|md|log|sql|html?|css|js|xml)$/.test(name)) return "text";
  return null;
}

