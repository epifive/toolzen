"use client";

/**
 * Building blocks shared by every tool. Keeping tools on these components gives
 * the whole site one consistent look and one place to fix behaviour.
 */

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Copy, Download, FileUp, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatBytes } from "@/lib/utils";
import { copyToClipboard, downloadText } from "@/lib/files";
import { detectFileKind, takePendingFiles } from "@/lib/pending-files";
import { useT } from "@/lib/i18n/client";
import { useTool } from "@/tools/context";

/* ───────────────────────── Layout ───────────────────────── */

/** A titled section inside the tool workspace. */
export function Panel({
  title,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-line bg-surface", className)}>
      {title || actions ? (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          {title ? <h2 className="font-sans text-sm font-semibold tracking-normal text-ink">{title}</h2> : <span />}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Two columns on large screens: settings on one side, result on the other. */
export function ToolColumns({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 lg:grid-cols-2", className)}>{children}</div>;
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn("size-4 animate-spin", className)} aria-hidden />;
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
      {children}
    </p>
  );
}

/* ───────────────────────── Inputs ───────────────────────── */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: ReactNode }>;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex flex-wrap gap-1 rounded-lg border border-line bg-paper p-1", className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === o.value ? "bg-surface text-primary shadow-sm ring-1 ring-line" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format = (v) => String(v),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  const id = useId();
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <label htmlFor={id} className="font-medium text-ink">
          {label}
        </label>
        <span className="tabular-nums text-muted">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--primary)]"
      />
    </div>
  );
}

/* ───────────────────────── Files ───────────────────────── */

function matchesAccept(file: File, accept: string): boolean {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  return accept.split(",").some((rule) => {
    const r = rule.trim().toLowerCase();
    if (!r) return false;
    if (r.startsWith(".")) return name.endsWith(r);
    if (r.endsWith("/*")) return file.type.startsWith(r.slice(0, -1));
    return file.type === r;
  });
}

/**
 * Drag-and-drop file picker that enforces the visitor's plan limits
 * (max file size and number of files) and the accepted file types.
 */
export function FileDropzone({
  accept,
  multiple = false,
  onFiles,
  label,
  hint,
  compact = false,
  currentCount = 0,
}: {
  /** Same syntax as <input accept>, e.g. "image/*,.svg" or "application/pdf". Pass "" to allow any file. */
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  label?: ReactNode;
  hint?: ReactNode;
  /** Smaller variant for "add more files" once files are loaded. */
  compact?: boolean;
  /** Files already selected, counted against the batch limit. */
  currentCount?: number;
}) {
  const { limits } = useTool();
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const maxBytes = limits.maxFileMb * 1024 * 1024;

  function handle(list: FileList | null) {
    if (!list?.length) return;
    const problems: string[] = [];
    let files = Array.from(list).filter((f) => {
      if (!matchesAccept(f, accept)) {
        problems.push(t("ui.errorType", { name: f.name }));
        return false;
      }
      if (f.size > maxBytes) {
        problems.push(t("ui.errorSize", { name: f.name, size: formatBytes(f.size), mb: limits.maxFileMb }));
        return false;
      }
      return true;
    });
    if (!multiple) files = files.slice(0, 1);
    const room = multiple ? Math.max(0, limits.maxBatch - currentCount) : 1;
    if (files.length > room) {
      problems.push(t("ui.errorBatch", { batch: limits.maxBatch, skipped: files.length - room }));
      files = files.slice(0, room);
    }
    setErrors(problems);
    if (files.length) onFiles(files);
    if (inputRef.current) inputRef.current.value = "";
  }

  // Pick up files the visitor dropped on the home page before choosing this tool.
  const handleRef = useRef(handle);
  useEffect(() => {
    handleRef.current = handle;
  });
  useEffect(() => {
    const waiting = takePendingFiles();
    if (!waiting.length) return;
    const transfer = new DataTransfer();
    waiting.forEach((f) => transfer.items.add(f));
    handleRef.current(transfer.files);
  }, []);

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          // Ignore leave events fired when moving over child elements.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handle(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition-colors",
          compact ? "gap-1 px-4 py-4" : "mat-grid gap-3 px-6 py-12",
          dragging ? "border-primary bg-primary-soft" : "border-primary-line hover:border-primary",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handle(e.target.files)}
        />
        {!compact ? (
          <span className="grid size-12 place-items-center rounded-full bg-primary text-white [&_svg]:size-5">
            <FileUp aria-hidden />
          </span>
        ) : null}
        <span className={cn("font-medium text-ink", compact ? "text-sm" : "text-base")}>
          {label ?? (multiple ? t("ui.dropFiles") : t("ui.dropFile"))}
        </span>
        <span className="text-xs text-muted">
          {hint ?? (multiple ? t("ui.upToMbBatch", { mb: limits.maxFileMb, batch: limits.maxBatch }) : t("ui.upToMb", { mb: limits.maxFileMb }))}
        </span>
      </label>
      {errors.length ? (
        <ul className="mt-2 space-y-1">
          {errors.map((e) => (
            <li key={e} className="text-sm text-red-600 dark:text-red-400">
              {e}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** One row in a list of selected files. */
export function FileRow({
  name,
  size,
  meta,
  onRemove,
  actions,
  thumbnail,
}: {
  name: string;
  size?: number;
  meta?: ReactNode;
  onRemove?: () => void;
  actions?: ReactNode;
  thumbnail?: ReactNode;
}) {
  const t = useT();
  return (
    <li className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2">
      {thumbnail ? <div className="size-10 shrink-0 overflow-hidden rounded-md bg-paper">{thumbnail}</div> : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{name}</p>
        <p className="text-xs text-muted">
          {size !== undefined ? formatBytes(size) : null}
          {size !== undefined && meta ? " – " : null}
          {meta}
        </p>
      </div>
      {actions}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md p-1.5 text-muted hover:bg-primary-soft hover:text-ink"
          aria-label={t("ui.remove", { name })}
        >
          <X className="size-4" />
        </button>
      ) : null}
    </li>
  );
}

/** Object URL for a Blob that is revoked automatically. */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);
  return url;
}

/* ───────────────────────── Output ───────────────────────── */

export function CopyButton({
  text,
  label,
  size = "sm",
  variant = "outline",
  disabled,
}: {
  text: string;
  label?: string;
  size?: "sm" | "md";
  variant?: "outline" | "primary" | "secondary";
  disabled?: boolean;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size={size}
      variant={variant}
      disabled={disabled || !text}
      onClick={async () => {
        if (await copyToClipboard(text)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      }}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {copied ? t("ui.copied") : (label ?? t("ui.copy"))}
    </Button>
  );
}

export function DownloadTextButton({
  text,
  filename,
  label,
  type,
}: {
  text: string;
  filename: string;
  label?: string;
  type?: string;
}) {
  const t = useT();
  return (
    <Button size="sm" variant="outline" disabled={!text} onClick={() => downloadText(text, filename, type)}>
      <Download aria-hidden />
      {label ?? t("ui.download")}
    </Button>
  );
}

/** Read-only result box with Copy and (optionally) Download actions. */
export function OutputBox({
  value,
  label: labelProp,
  filename,
  mimeType,
  mono = false,
  rows = 10,
  placeholder,
}: {
  value: string;
  label?: string;
  filename?: string;
  /** MIME type for the downloaded file, e.g. "application/json". Defaults to plain text. */
  mimeType?: string;
  mono?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  const t = useT();
  const label = labelProp ?? t("ui.result");
  return (
    <Panel
      title={label}
      actions={
        <>
          <CopyButton text={value} />
          {filename ? <DownloadTextButton text={value} filename={filename} type={mimeType} /> : null}
        </>
      }
    >
      <textarea
        readOnly
        value={value}
        rows={rows}
        placeholder={placeholder ?? t("ui.resultPlaceholder")}
        aria-label={label}
        className={cn(
          "w-full resize-y rounded-lg border border-line bg-paper px-3 py-2.5 text-sm text-ink focus:outline-none",
          mono && "font-mono text-[13px]",
        )}
      />
    </Panel>
  );
}

/** Plain textarea styled for tool input. */
export function TextInput({
  value,
  onChange,
  label: labelProp,
  placeholder,
  rows = 10,
  mono = false,
  actions,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  rows?: number;
  mono?: boolean;
  actions?: ReactNode;
}) {
  const t = useT();
  const label = labelProp ?? t("ui.input");

  // Load a text file the visitor dropped on the home page before choosing this tool.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    const [file] = takePendingFiles();
    if (!file || !["text", "csv", "json", "svg"].includes(detectFileKind(file) ?? "") || file.size > 5 * 1024 * 1024) return;
    file.text().then((text) => onChangeRef.current(text));
  }, []);

  return (
    <Panel
      title={label}
      actions={
        <>
          {actions}
          {value ? (
            <Button size="sm" variant="ghost" onClick={() => onChange("")}>
              {t("ui.clear")}
            </Button>
          ) : null}
        </>
      }
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        aria-label={label}
        spellCheck={!mono}
        className={cn(
          "w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
          mono && "font-mono text-[13px]",
        )}
      />
    </Panel>
  );
}

/** A labelled number, used for counters and calculator results. */
export function Stat({ label, value, emphasis = false }: { label: ReactNode; value: ReactNode; emphasis?: boolean }) {
  return (
    <div className={cn("rounded-lg border px-4 py-3", emphasis ? "border-primary-line bg-primary-soft" : "border-line bg-surface")}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cn("mt-1 font-display font-semibold tabular-nums text-ink", emphasis ? "text-2xl" : "text-xl")}>{value}</dd>
    </div>
  );
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", className)}>{children}</dl>;
}
