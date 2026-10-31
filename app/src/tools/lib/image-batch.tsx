"use client";

/**
 * Shared state and UI for image tools that process a list of files with the same settings:
 * the file list with per-file results, the run button and "Download all as ZIP".
 */

import { useCallback, useState, type ReactNode } from "react";
import { Download, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, FileDropzone, FileRow, Spinner } from "@/components/tool-ui";
import { downloadBlob, downloadZip } from "@/lib/files";
import { formatBytes, uid } from "@/lib/utils";
import { useTool } from "@/tools/context";
import { errorMessage } from "@/tools/lib/image";
import { ImageThumb } from "@/tools/lib/image-ui";

export interface BatchResult {
  blob: Blob;
  name: string;
}

export interface BatchItem {
  id: string;
  file: File;
  result?: BatchResult;
  error?: string;
}

export interface ImageBatch {
  items: BatchItem[];
  busy: boolean;
  error: string;
  add: (files: File[]) => void;
  remove: (id: string) => void;
  /** Clears earlier results, e.g. after a setting changed. */
  invalidate: () => void;
  /** Processes every file in turn. Failures are reported per file. */
  run: (process: (file: File) => Promise<BatchResult>, failure: string) => Promise<void>;
}

export function useImageBatch(): ImageBatch {
  const { track } = useTool();
  const [items, setItems] = useState<BatchItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const add = useCallback((files: File[]) => {
    setItems((prev) => [...prev, ...files.map((file) => ({ id: uid(), file }))]);
    setError("");
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const invalidate = useCallback(() => {
    setItems((prev) => prev.map((i) => ({ ...i, result: undefined, error: undefined })));
    setError("");
  }, []);

  async function run(process: (file: File) => Promise<BatchResult>, failure: string) {
    setBusy(true);
    setError("");
    let succeeded = 0;
    for (const item of items) {
      let patch: Partial<BatchItem>;
      try {
        patch = { result: await process(item.file), error: undefined };
        succeeded++;
      } catch (e) {
        patch = { result: undefined, error: errorMessage(e, failure) };
      }
      // Functional update, so files removed while the batch runs stay removed.
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
    }
    setBusy(false);
    if (succeeded) track();
    else setError("None of the images could be processed. Try a different file.");
  }

  return { items, busy, error, add, remove, invalidate, run };
}

/** Dropzone that becomes a compact "add more" box once files are chosen. */
export function BatchDropzone({ batch, accept, hint }: { batch: ImageBatch; accept: string; hint?: ReactNode }) {
  const count = batch.items.length;
  return (
    <FileDropzone
      accept={accept}
      multiple
      currentCount={count}
      compact={count > 0}
      label={count ? "Add more images" : undefined}
      hint={hint}
      onFiles={batch.add}
    />
  );
}

/** The chosen files with their result (or error) and a download button per finished file. */
export function BatchFileList({ batch }: { batch: ImageBatch }) {
  return (
    <ul className="space-y-2">
      {batch.items.map((item) => (
        <FileRow
          key={item.id}
          name={item.file.name}
          size={item.file.size}
          thumbnail={<ImageThumb file={item.file} />}
          meta={
            item.error ? (
              <span className="text-red-600 dark:text-red-400">{item.error}</span>
            ) : item.result ? (
              <span>
                → <span className="font-medium text-primary">{item.result.name}</span> ({formatBytes(item.result.blob.size)})
              </span>
            ) : null
          }
          actions={
            item.result ? (
              <Button
                size="sm"
                variant="outline"
                aria-label={`Download ${item.result.name}`}
                onClick={() => item.result && downloadBlob(item.result.blob, item.result.name)}
              >
                <Download aria-hidden />
                <span className="hidden sm:inline">Download</span>
              </Button>
            ) : null
          }
          onRemove={() => batch.remove(item.id)}
        />
      ))}
    </ul>
  );
}

/** Error message, the run button and, once several files are done, "Download all as ZIP". */
export function BatchActions({
  batch,
  onRun,
  verb,
  busyLabel,
  zipName,
  disabled = false,
}: {
  batch: ImageBatch;
  onRun: () => void;
  /** Button text before the count, e.g. "Convert" gives "Convert 3 images". */
  verb: string;
  busyLabel: string;
  zipName: string;
  disabled?: boolean;
}) {
  const count = batch.items.length;
  const done = batch.items.flatMap((i) => (i.result ? [{ name: i.result.name, data: i.result.blob }] : []));
  return (
    <>
      <ErrorText>{batch.error}</ErrorText>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onRun} disabled={batch.busy || disabled || count === 0}>
          {batch.busy ? <Spinner /> : null}
          {batch.busy ? busyLabel : `${verb} ${count} image${count === 1 ? "" : "s"}`}
        </Button>
        {done.length > 1 ? (
          <Button variant="outline" disabled={batch.busy} onClick={() => void downloadZip(done, zipName)}>
            <Package aria-hidden />
            Download all as ZIP
          </Button>
        ) : null}
      </div>
    </>
  );
}
