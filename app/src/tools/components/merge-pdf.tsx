"use client";

import { useState } from "react";
import { Combine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, FileDropzone } from "@/components/tool-ui";
import { downloadBlob } from "@/lib/files";
import { uid } from "@/lib/utils";
import { useTool } from "@/tools/context";
import { loadPdfLib, nextFrame, openPdf, PDF_ACCEPT, pdfErrorMessage, savePdf } from "@/tools/lib/pdf";
import { DownloadResult, Progress, type OutputFile } from "@/tools/lib/pdf-file";
import { moveItem, SortableFileList } from "@/tools/lib/sortable-file-list";

interface Item {
  id: string;
  file: File;
  /** Undefined while the file is being read. */
  pageCount?: number;
  error?: string;
}

export default function MergePdf() {
  const { track } = useTool();
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<OutputFile | null>(null);

  const ready = items.filter((i) => i.pageCount !== undefined && !i.error);
  const reading = items.some((i) => i.pageCount === undefined && !i.error);
  const totalPages = ready.reduce((sum, i) => sum + (i.pageCount ?? 0), 0);

  function update(next: (prev: Item[]) => Item[]) {
    setItems(next);
    setResult(null);
    setError("");
  }

  async function addFiles(files: File[]) {
    const added = files.map((file) => ({ id: uid(), file }));
    update((prev) => [...prev, ...added]);
    for (const item of added) {
      let patch: Partial<Item>;
      try {
        const doc = await openPdf(await item.file.arrayBuffer());
        patch = { pageCount: doc.getPageCount() };
      } catch (e) {
        patch = { error: pdfErrorMessage(e) };
      }
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
    }
  }

  async function merge() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const { PDFDocument } = await loadPdfLib();
      const merged = await PDFDocument.create();
      for (const [index, item] of ready.entries()) {
        setProgress(`Adding ${item.file.name} (${index + 1} of ${ready.length})…`);
        await nextFrame();
        const source = await openPdf(await item.file.arrayBuffer());
        const pages = await merged.copyPages(source, source.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
      }
      setProgress("Saving the merged PDF…");
      await nextFrame();
      const output = { blob: await savePdf(merged), name: "merged.pdf" };
      setResult(output);
      downloadBlob(output.blob, output.name);
      track();
    } catch (e) {
      setError(pdfErrorMessage(e, "The PDFs could not be merged. Check that every file opens in a PDF reader."));
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <div className="space-y-4">
      <FileDropzone
        accept={PDF_ACCEPT}
        multiple
        currentCount={items.length}
        compact={items.length > 0}
        label={items.length ? "Add more PDF files" : "Drop PDF files here or click to choose"}
        onFiles={(files) => void addFiles(files)}
      />

      {items.length ? (
        <>
          <SortableFileList
            label="Files to merge, in order"
            disabled={busy}
            items={items.map((item) => ({
              id: item.id,
              name: item.file.name,
              size: item.file.size,
              meta: item.error ? (
                <span className="text-red-600 dark:text-red-400">{item.error}</span>
              ) : item.pageCount === undefined ? (
                "Reading…"
              ) : (
                `${item.pageCount} page${item.pageCount === 1 ? "" : "s"}`
              ),
            }))}
            onMove={(from, to) => update((prev) => moveItem(prev, from, to))}
            onRemove={(id) => update((prev) => prev.filter((i) => i.id !== id))}
          />

          <p className="text-sm text-muted">
            Drag the files, or use the arrows, to set the order. Files are merged from top to bottom.
            {items.some((i) => i.error) ? " Files that can't be read are skipped." : null}
          </p>

          <ErrorText>{error}</ErrorText>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={merge} disabled={busy || reading || ready.length < 2}>
              <Combine aria-hidden />
              {ready.length < 2 ? "Add at least two PDFs" : `Merge ${ready.length} PDFs (${totalPages} pages)`}
            </Button>
            {busy ? <Progress>{progress}</Progress> : null}
          </div>

          {result ? <DownloadResult result={result} /> : null}
        </>
      ) : null}
    </div>
  );
}
