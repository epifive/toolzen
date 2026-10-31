"use client";

/**
 * A list of files the visitor can put in order: drag a row to a new position, or use the
 * up / down buttons (keyboard friendly). Used by tools whose output follows the file order.
 */

import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, GripVertical, X } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";

export interface SortableFile {
  id: string;
  name: string;
  size: number;
  meta?: ReactNode;
  thumbnail?: ReactNode;
}

/** Returns a copy of `items` with the element at `from` moved to `to`. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

const iconButton =
  "rounded-md p-1.5 text-muted hover:bg-primary-soft hover:text-ink disabled:pointer-events-none disabled:opacity-30 [&_svg]:size-4";

export function SortableFileList({
  items,
  onMove,
  onRemove,
  label,
  disabled = false,
}: {
  items: readonly SortableFile[];
  onMove: (from: number, to: number) => void;
  onRemove: (id: string) => void;
  /** Accessible name of the list, e.g. "Files to merge". */
  label: string;
  disabled?: boolean;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function endDrag() {
    setDragIndex(null);
    setOverIndex(null);
  }

  return (
    <ol aria-label={label} className="space-y-2">
      {items.map((item, index) => (
        <li
          key={item.id}
          draggable={!disabled}
          onDragStart={(e) => {
            setDragIndex(index);
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", item.id);
          }}
          onDragOver={(e) => {
            if (dragIndex === null) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (overIndex !== index) setOverIndex(index);
          }}
          onDrop={(e) => {
            if (dragIndex === null) return;
            e.preventDefault();
            if (dragIndex !== index) onMove(dragIndex, index);
            endDrag();
          }}
          onDragEnd={endDrag}
          className={cn(
            "flex items-center gap-2 rounded-lg border bg-surface px-2 py-2 transition-colors sm:gap-3 sm:px-3",
            !disabled && "cursor-grab active:cursor-grabbing",
            dragIndex === index && "opacity-50",
            overIndex === index && dragIndex !== index ? "border-primary ring-2 ring-primary/20" : "border-line",
          )}
        >
          <GripVertical aria-hidden className="hidden size-4 shrink-0 text-muted sm:block" />
          <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-muted">{index + 1}</span>
          {item.thumbnail ? (
            <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-md bg-paper">{item.thumbnail}</div>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{item.name}</p>
            <p className="text-xs text-muted">
              {formatBytes(item.size)}
              {item.meta ? <> – {item.meta}</> : null}
            </p>
          </div>
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              className={iconButton}
              disabled={disabled || index === 0}
              onClick={() => onMove(index, index - 1)}
              aria-label={`Move ${item.name} up`}
            >
              <ArrowUp />
            </button>
            <button
              type="button"
              className={iconButton}
              disabled={disabled || index === items.length - 1}
              onClick={() => onMove(index, index + 1)}
              aria-label={`Move ${item.name} down`}
            >
              <ArrowDown />
            </button>
            <button
              type="button"
              className={iconButton}
              disabled={disabled}
              onClick={() => onRemove(item.id)}
              aria-label={`Remove ${item.name}`}
            >
              <X />
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}
