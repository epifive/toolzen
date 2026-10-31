"use client";

/**
 * Shows the lines around a syntax error with the failing line highlighted and
 * a caret under the column. Used by the XML and YAML tools.
 */

const CONTEXT_LINES = 2;
/** Long lines (e.g. minified input) are shown as a window around the error column. */
const EXCERPT_WIDTH = 120;

export function SourceExcerpt({ text, line, column }: { text: string; line: number; column?: number }) {
  const lines = text.split("\n");
  if (line < 1 || line > lines.length) return null;
  const col = Math.max(1, column ?? 1);
  const first = Math.max(1, line - CONTEXT_LINES);
  const last = Math.min(lines.length, line + CONTEXT_LINES);
  const gutter = String(last).length;
  const start = col > EXCERPT_WIDTH * 0.75 ? col - 1 - EXCERPT_WIDTH / 2 : 0;
  const clip = (content: string) => {
    // Tabs become single spaces so the caret lines up with the column.
    const piece = content.replace(/\r$/, "").slice(start, start + EXCERPT_WIDTH).replace(/\t/g, " ");
    return `${start > 0 ? "…" : ""}${piece}${content.length > start + EXCERPT_WIDTH ? "…" : ""}`;
  };
  const caret = col - 1 - start + (start > 0 ? 1 : 0);

  return (
    <pre
      aria-label={`Source around line ${line}`}
      tabIndex={0}
      className="mt-3 overflow-x-auto rounded-lg border border-line bg-paper py-2 font-mono text-[13px] leading-relaxed text-ink"
    >
      {lines.slice(first - 1, last).map((content, i) => {
        const number = first + i;
        const isError = number === line;
        return (
          <span key={number} className={isError ? "block bg-red-100 dark:bg-red-950/50" : "block"}>
            <span className="inline-block select-none px-3 text-right text-muted" style={{ minWidth: `${gutter + 2}ch` }}>
              {number}
            </span>
            <span>{clip(content) || " "}</span>
            {isError && column ? (
              <span aria-hidden className="block text-red-600 dark:text-red-400">
                <span className="inline-block px-3" style={{ minWidth: `${gutter + 2}ch` }} />
                {" ".repeat(Math.max(0, caret))}^
              </span>
            ) : null}
          </span>
        );
      })}
    </pre>
  );
}
