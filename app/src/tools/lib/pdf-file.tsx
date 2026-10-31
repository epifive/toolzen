"use client";

/**
 * Loading a single PDF for the one-file PDF tools: the dropzone, the "reading…" state, the
 * selected-file row and clear errors for damaged or password-protected files.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Download } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ErrorText, FileDropzone, FileRow, Spinner } from "@/components/tool-ui";
import { downloadBlob } from "@/lib/files";
import { formatBytes, uid } from "@/lib/utils";
import { openPdf, openPdfPreview, PDF_ACCEPT, pdfErrorMessage } from "@/tools/lib/pdf";

export interface LoadedPdf {
  /** Unique per load: use it as a React key so per-file tool state resets with a new file. */
  id: string;
  file: File;
  bytes: ArrayBuffer;
  pageCount: number;
  /** pdf.js document for thumbnails and previews (only when requested). */
  preview: PDFDocumentProxy | null;
}

export interface PdfFileState {
  pdf: LoadedPdf | null;
  loading: boolean;
  error: string;
  open: (file: File) => Promise<void>;
  clear: () => void;
}

/**
 * Reads a PDF, validates it with pdf-lib (rejecting encrypted files up front) and, with
 * `preview`, also opens it in pdf.js. Superseded loads are discarded, and pdf.js documents are
 * destroyed once they are replaced or the tool unmounts.
 */
export function usePdfFile({ preview = false }: { preview?: boolean } = {}): PdfFileState {
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);

  useEffect(() => {
    const doc = pdf?.preview;
    return () => {
      void doc?.loadingTask.destroy();
    };
  }, [pdf]);

  const open = useCallback(
    async (file: File) => {
      const id = ++request.current;
      setLoading(true);
      setError("");
      setPdf(null);
      try {
        const bytes = await file.arrayBuffer();
        const doc = await openPdf(bytes);
        const previewDoc = preview ? await openPdfPreview(bytes) : null;
        if (id !== request.current) {
          void previewDoc?.loadingTask.destroy();
          return;
        }
        setPdf({ id: uid(), file, bytes, pageCount: doc.getPageCount(), preview: previewDoc });
      } catch (e) {
        if (id === request.current) setError(`${file.name}: ${pdfErrorMessage(e)}`);
      } finally {
        if (id === request.current) setLoading(false);
      }
    },
    [preview],
  );

  const clear = useCallback(() => {
    request.current++;
    setPdf(null);
    setError("");
    setLoading(false);
  }, []);

  return { pdf, loading, error, open, clear };
}

/** Dropzone while nothing is loaded, then a row for the chosen PDF with a remove button. */
export function PdfFilePicker({ state }: { state: PdfFileState }) {
  const { pdf, loading, error, open, clear } = state;

  if (pdf) {
    return (
      <ul>
        <FileRow
          name={pdf.file.name}
          size={pdf.file.size}
          meta={`${pdf.pageCount} page${pdf.pageCount === 1 ? "" : "s"}`}
          onRemove={clear}
        />
      </ul>
    );
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <p className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-6 text-sm text-muted" role="status">
          <Spinner />
          Reading PDF…
        </p>
      ) : (
        <FileDropzone accept={PDF_ACCEPT} onFiles={(files) => void open(files[0])} />
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

export interface OutputFile {
  blob: Blob;
  name: string;
}

/** Success message for a finished file with a button to download it (again). */
export function DownloadResult({ result, children }: { result: OutputFile; children?: ReactNode }) {
  return (
    <Alert tone="success" title="Your file is ready and has been downloaded.">
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-0 break-all">
          {result.name} ({formatBytes(result.blob.size)})
        </span>
        <Button size="sm" variant="outline" onClick={() => downloadBlob(result.blob, result.name)}>
          <Download aria-hidden />
          Download again
        </Button>
      </div>
      {children}
    </Alert>
  );
}

/** Spinner with a progress message for long jobs, announced to screen readers. */
export function Progress({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-muted">
      <Spinner />
      {children}
    </p>
  );
}
