"use client";

/**
 * Page picker for the PDF tools: a grid of lazily rendered page thumbnails that can be selected
 * with the mouse or keyboard (Shift selects a run of pages), plus selection controls with a
 * "pages" text field such as "1-3, 8".
 */

import { useCallback, useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { Check, X } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Spinner } from "@/components/tool-ui";
import { cn } from "@/lib/utils";
import { PreviewImage } from "@/tools/lib/image-ui";
import { formatPageRanges, parsePageSelection, pdfErrorMessage, renderThumbnail } from "@/tools/lib/pdf";

/** Width, in CSS pixels, that thumbnails are rendered at. */
const THUMB_WIDTH = 160;

/** Rendered thumbnails per document, so re-mounting a grid doesn't render pages again. */
const thumbnailCache = new WeakMap<PDFDocumentProxy, Map<number, string>>();

export type Enqueue = (task: () => Promise<void>) => Promise<void>;

/** Runs thumbnail renders one at a time so a long document doesn't flood the pdf.js worker. */
export function useRenderQueue(): Enqueue {
  const queue = useRef<Promise<void>>(Promise.resolve());
  return useCallback<Enqueue>((task) => {
    const run = queue.current.then(task);
    queue.current = run.catch(() => undefined);
    return run;
  }, []);
}

/** Lazily rendered page image, shown once the page scrolls near the viewport. */
export function PageThumbnail({
  doc,
  pageNumber,
  rotation,
  enqueue,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  rotation: number;
  enqueue: Enqueue;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string | null>(() => thumbnailCache.get(doc)?.get(pageNumber) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (src || !element) return;
    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        void enqueue(async () => {
          if (cancelled) return;
          try {
            const url = await renderThumbnail(doc, pageNumber, THUMB_WIDTH);
            let cache = thumbnailCache.get(doc);
            if (!cache) {
              cache = new Map();
              thumbnailCache.set(doc, cache);
            }
            cache.set(pageNumber, url);
            if (!cancelled) setSrc(url);
          } catch {
            if (!cancelled) setFailed(true);
          }
        });
      },
      { rootMargin: "300px" },
    );
    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [doc, pageNumber, src, enqueue]);

  return (
    <div ref={ref} className="flex aspect-square items-center justify-center overflow-hidden p-2">
      {src ? (
        <PreviewImage
          src={src}
          alt=""
          className="max-h-full max-w-full bg-white shadow-sm ring-1 ring-black/10 transition-transform duration-200"
          style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}
        />
      ) : failed ? (
        <span className="text-center text-xs text-muted">Preview unavailable</span>
      ) : (
        <Spinner className="text-muted" />
      )}
    </div>
  );
}

export interface PdfPageGridProps {
  doc: PDFDocumentProxy;
  /** Zero-based indexes of the selected pages. */
  selected: ReadonlySet<number>;
  onSelectedChange: (next: Set<number>) => void;
  /** Extra clockwise rotation to show per page, in degrees (indexed by zero-based page). */
  rotations?: readonly number[];
  /** "keep" marks selected pages with a tick, "remove" crosses them out. */
  tone?: "keep" | "remove";
  /** Accessible name of the grid, e.g. "Pages to extract". */
  label: string;
  disabled?: boolean;
}

export function PdfPageGrid({
  doc,
  selected,
  onSelectedChange,
  rotations,
  tone = "keep",
  label,
  disabled = false,
}: PdfPageGridProps) {
  const anchor = useRef<number | null>(null);
  const enqueue = useRenderQueue();

  function handleClick(index: number, event: MouseEvent<HTMLButtonElement>) {
    const next = new Set(selected);
    if (event.shiftKey && anchor.current !== null) {
      const [from, to] = anchor.current < index ? [anchor.current, index] : [index, anchor.current];
      const select = !selected.has(index);
      for (let i = from; i <= to; i++) {
        if (select) next.add(i);
        else next.delete(i);
      }
    } else if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    anchor.current = index;
    onSelectedChange(next);
  }

  return (
    <ul aria-label={label} className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6">
      {Array.from({ length: doc.numPages }, (_, index) => {
        const isSelected = selected.has(index);
        const rotation = rotations?.[index] ?? 0;
        return (
          <li key={index}>
            <button
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={`Page ${index + 1}${rotation ? `, rotated ${rotation} degrees` : ""}`}
              onClick={(e) => handleClick(index, e)}
              className={cn(
                "group relative block w-full rounded-lg border bg-paper text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed",
                isSelected
                  ? tone === "remove"
                    ? "border-red-500 ring-1 ring-red-500 dark:border-red-400 dark:ring-red-400"
                    : "border-primary ring-1 ring-primary"
                  : "border-line hover:border-primary-line",
              )}
            >
              <div className={cn("transition-opacity", isSelected && tone === "remove" && "opacity-40")}>
                <PageThumbnail doc={doc} pageNumber={index + 1} rotation={rotation} enqueue={enqueue} />
              </div>
              <span className="flex items-center justify-between border-t border-line px-2 py-1 text-xs font-medium text-muted">
                <span className="tabular-nums">{index + 1}</span>
                <span
                  aria-hidden
                  className={cn(
                    "grid size-4 place-items-center rounded-sm border [&_svg]:size-3",
                    isSelected
                      ? tone === "remove"
                        ? "border-red-600 bg-red-600 text-white"
                        : "border-primary bg-primary text-white"
                      : "border-line bg-surface text-transparent",
                  )}
                >
                  {tone === "remove" ? <X strokeWidth={3} /> : <Check strokeWidth={3} />}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * "Select all / none" buttons, a live count and a pages field. Typing "1-3, 8" and pressing
 * Enter (or Apply) replaces the selection.
 */
export function PageSelectionControls({
  pageCount,
  selected,
  onSelectedChange,
  noun = "selected",
  disabled = false,
}: {
  pageCount: number;
  selected: ReadonlySet<number>;
  onSelectedChange: (next: Set<number>) => void;
  /** Word after the count, e.g. "selected" or "to remove". */
  noun?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState("");
  const value = draft ?? formatPageRanges(selected);

  function apply() {
    if (draft === null) return;
    if (!draft.trim()) {
      onSelectedChange(new Set());
      setDraft(null);
      setError("");
      return;
    }
    try {
      onSelectedChange(new Set(parsePageSelection(draft, pageCount)));
      setDraft(null);
      setError("");
    } catch (e) {
      setError(pdfErrorMessage(e, "Those page numbers couldn't be read."));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => {
            onSelectedChange(new Set(Array.from({ length: pageCount }, (_, i) => i)));
            setDraft(null);
            setError("");
          }}
        >
          Select all
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || selected.size === 0}
          onClick={() => {
            onSelectedChange(new Set());
            setDraft(null);
            setError("");
          }}
        >
          Select none
        </Button>
        <p className="text-sm text-muted" aria-live="polite">
          <span className="font-medium tabular-nums text-ink">{selected.size}</span> of {pageCount} {noun}
        </p>
      </div>
      <div>
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          Pages
        </label>
        <div className="flex gap-2">
          <Input
            id={id}
            value={value}
            disabled={disabled}
            placeholder="e.g. 1-3, 5, 8-"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${id}-hint`}
            onChange={(e) => {
              setDraft(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              }
            }}
            onBlur={apply}
          />
          <Button variant="outline" disabled={disabled || draft === null} onClick={apply}>
            Apply
          </Button>
        </div>
        <p id={`${id}-hint`} className={cn("mt-1.5 text-xs", error ? "text-red-600 dark:text-red-400" : "text-muted")}>
          {error || "Click pages below, Shift-click to select a run, or type page numbers and ranges."}
        </p>
      </div>
    </div>
  );
}
