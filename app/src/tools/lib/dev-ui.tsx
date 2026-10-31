"use client";

/**
 * Small UI pieces and hooks shared by the developer tools.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { FolderOpen } from "lucide-react";
import { CopyButton } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import { cn, formatBytes } from "@/lib/utils";
import { useTool } from "@/tools/context";

/** The value, `delay` ms after it last changed. Use it to keep heavy work off every keystroke. */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Current time in milliseconds, refreshed every `intervalMs`. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function acceptsFile(file: File, accept: string): boolean {
  const name = file.name.toLowerCase();
  return accept
    .split(",")
    .map((rule) => rule.trim().toLowerCase())
    .some((rule) => (rule.startsWith(".") ? name.endsWith(rule) : rule.endsWith("/*") ? file.type.startsWith(rule.slice(0, -1)) : file.type === rule));
}

/**
 * "Open file" button that reads a text file into a tool's input. It enforces the
 * visitor's plan file-size limit and the accepted extensions, just like FileDropzone.
 */
export function OpenFileButton({
  accept,
  onText,
  onError,
  label = "Open file",
}: {
  /** Comma-separated extensions or MIME types, e.g. ".json,application/json". */
  accept: string;
  onText: (text: string, file: File) => void;
  onError: (message: string) => void;
  label?: string;
}) {
  const { limits } = useTool();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handle(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    if (!acceptsFile(file, accept)) {
      onError(`${file.name} is not a supported file type.`);
      return;
    }
    if (file.size > limits.maxFileMb * 1024 * 1024) {
      onError(`${file.name} is ${formatBytes(file.size)}. Your plan allows files up to ${limits.maxFileMb} MB.`);
      return;
    }
    try {
      onText(await file.text(), file);
    } catch {
      onError(`${file.name} could not be read.`);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void handle(e.target.files?.[0])}
      />
      <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
        <FolderOpen aria-hidden />
        {label}
      </Button>
    </>
  );
}

/** Definition list wrapper for ValueRow. */
export function ValueList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("divide-y divide-line", className)}>{children}</dl>;
}

/** A labelled, copyable value. Long values wrap instead of overflowing on small screens. */
export function ValueRow({
  label,
  value,
  copyValue,
  mono = true,
  extra,
}: {
  label: ReactNode;
  value: string;
  /** Text to copy when it differs from what is shown. */
  copyValue?: string;
  mono?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4">
      <dt className="shrink-0 text-sm text-muted sm:w-36">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center gap-2">
        <span className={cn("min-w-0 flex-1 break-all text-ink", mono ? "font-mono text-[13px]" : "text-sm")}>
          {value || <span className="text-muted">—</span>}
        </span>
        {extra}
        <CopyButton text={copyValue ?? value} />
      </dd>
    </div>
  );
}

/** Read-only, scrollable code block. */
export function CodeBlock({ code, label, className }: { code: string; label: string; className?: string }) {
  return (
    <pre
      aria-label={label}
      tabIndex={0}
      className={cn(
        "max-h-[28rem] overflow-auto rounded-lg border border-line bg-paper px-3 py-2.5 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words text-ink",
        className,
      )}
    >
      {code}
    </pre>
  );
}
