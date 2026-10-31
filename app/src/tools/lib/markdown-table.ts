/**
 * Markdown (GitHub-flavoured) and HTML table output for the Markdown table
 * generator. Plain TypeScript, no DOM needed.
 */

import { escapeHtml } from "./dev";

export type ColumnAlign = "none" | "left" | "center" | "right";

export interface TableData {
  headers: string[];
  aligns: ColumnAlign[];
  rows: string[][];
}

/** Pipes would end the cell and line breaks would end the row, so both are escaped. */
export function escapeMarkdownCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>").trim();
}

/** Width of a cell as it appears in a monospace editor (wide CJK and emoji count as two columns). */
export function displayWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    const wide =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe4f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x1f300 && code <= 0x1faff) ||
      (code >= 0x20000 && code <= 0x3fffd);
    width += wide ? 2 : 1;
  }
  return width;
}

function padCell(text: string, width: number, align: ColumnAlign): string {
  const space = Math.max(0, width - displayWidth(text));
  if (align === "right") return " ".repeat(space) + text;
  if (align === "center") return " ".repeat(Math.floor(space / 2)) + text + " ".repeat(Math.ceil(space / 2));
  return text + " ".repeat(space);
}

function separator(width: number, align: ColumnAlign): string {
  const dashes = Math.max(3, width);
  if (align === "left") return `:${"-".repeat(dashes - 1)}`;
  if (align === "right") return `${"-".repeat(dashes - 1)}:`;
  if (align === "center") return `:${"-".repeat(Math.max(1, dashes - 2))}:`;
  return "-".repeat(dashes);
}

/** A Markdown table. With `pad`, columns are padded so the source lines up in a monospace font. */
export function toMarkdownTable({ headers, aligns, rows }: TableData, pad: boolean): string {
  const header = headers.map(escapeMarkdownCell);
  const body = rows.map((row) => headers.map((_, i) => escapeMarkdownCell(row[i] ?? "")));
  const widths = header.map((h, i) => (pad ? Math.max(3, displayWidth(h), ...body.map((row) => displayWidth(row[i]))) : 3));
  const line = (cells: string[]) => `| ${cells.map((cell, i) => (pad ? padCell(cell, widths[i], aligns[i]) : cell)).join(" | ")} |`;
  return [line(header), `| ${widths.map((w, i) => separator(w, aligns[i])).join(" | ")} |`, ...body.map(line)].join("\n") + "\n";
}

/** An HTML table with a <thead>, escaped cell text and text-align styles. */
export function toHtmlTable({ headers, aligns, rows }: TableData): string {
  const attr = (i: number) => (aligns[i] && aligns[i] !== "none" ? ` style="text-align: ${aligns[i]}"` : "");
  const cell = (tag: "th" | "td", text: string, i: number) =>
    `<${tag}${attr(i)}>${escapeHtml(text).replace(/\r?\n/g, "<br>")}</${tag}>`;
  const lines = [
    "<table>",
    "  <thead>",
    `    <tr>${headers.map((h, i) => cell("th", h, i)).join("")}</tr>`,
    "  </thead>",
    "  <tbody>",
    ...rows.map((row) => `    <tr>${headers.map((_, i) => cell("td", row[i] ?? "", i)).join("")}</tr>`),
    "  </tbody>",
    "</table>",
  ];
  return lines.join("\n") + "\n";
}
