"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileQuestion, FileUp } from "lucide-react";
import { ProBadge } from "@/components/ui/badge";
import type { ToolSummary } from "@/lib/site";
import { useT } from "@/lib/i18n/client";
import { detectFileKind, setPendingFiles, type DroppedKind } from "@/lib/pending-files";
import { cn, formatBytes } from "@/lib/utils";
import { ToolIcon } from "@/tools/icons";

/**
 * The home page hero: drop any file and see which tools can open it. Picking a
 * tool opens it with the file already loaded.
 */
export function FileFinder({ tools }: { tools: ToolSummary[] }) {
  const t = useT();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [kind, setKind] = useState<DroppedKind | null>(null);
  const [dragging, setDragging] = useState(false);

  const matches = kind ? tools.filter((t) => t.fileKinds.includes(kind)) : [];

  function accept(list: FileList | null) {
    if (!list?.length) return;
    const all = Array.from(list);
    const first = detectFileKind(all[0]);
    setKind(first);
    setFiles(first ? all.filter((f) => detectFileKind(f) === first) : all.slice(0, 1));
  }

  function open(tool: ToolSummary) {
    setPendingFiles(files);
    router.push(`/tools/${tool.slug}`);
  }

  function reset() {
    setFiles([]);
    setKind(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (files.length) {
    const total = files.reduce((s, f) => s + f.size, 0);
    return (
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_0_var(--line),0_24px_48px_-24px_rgb(0_0_0/0.18)]">
        <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {t("finder.another")}
        </button>
        <p className="mt-3 text-sm text-muted">
          {files.length === 1 ? files[0].name : t("finder.files", { count: files.length })} – {formatBytes(total)}
        </p>
        {kind && matches.length ? (
          <>
            <h2 className="mt-1 font-display text-xl font-semibold">
              {t("finder.question", { kind: t(`finder.kind.${kind}`) })}
            </h2>
            <ul className="mt-4 grid max-h-80 gap-1.5 overflow-y-auto pe-1 sm:grid-cols-2">
              {matches.map((tool) => (
                <li key={tool.slug}>
                  <button
                    type="button"
                    onClick={() => open(tool)}
                    className="flex w-full items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-start text-sm font-medium transition-colors hover:border-primary hover:bg-primary-soft"
                  >
                    <span className={`grid size-8 shrink-0 place-items-center rounded-md bg-cat-${tool.category}/10 text-cat-${tool.category}`}>
                      <ToolIcon name={tool.icon} className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{tool.name}</span>
                    {tool.premium ? <ProBadge /> : null}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted">{t("finder.private")}</p>
          </>
        ) : (
          <div className="mt-4 flex gap-3 rounded-lg bg-paper p-4 text-sm">
            <FileQuestion className="size-5 shrink-0 text-muted" aria-hidden />
            <p>
              {t("finder.unsupported")}{" "}
              <Link href="/tools" className="font-medium text-primary underline underline-offset-2">
                {t("nav.browseAllTools")}
              </Link>
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        accept(e.dataTransfer.files);
      }}
      className={cn(
        "group flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-surface/70 p-8 text-center backdrop-blur-sm transition-colors",
        dragging ? "border-primary bg-primary-soft" : "border-primary-line hover:border-primary",
      )}
    >
      <input ref={inputRef} type="file" multiple className="sr-only" onChange={(e) => accept(e.target.files)} />
      <span className="grid size-14 place-items-center rounded-2xl bg-primary text-white transition-transform group-hover:-translate-y-0.5">
        <FileUp className="size-6" aria-hidden />
      </span>
      <span className="mt-5 font-display text-xl font-semibold">{t("finder.title")}</span>
      <span className="mt-2 max-w-xs text-sm text-muted">{t("finder.text")}</span>
      <span className="mt-5 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink">{t("finder.choose")}</span>
    </label>
  );
}
