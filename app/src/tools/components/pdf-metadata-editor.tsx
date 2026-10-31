"use client";

import { useEffect, useState } from "react";
import { Eraser, Save, Undo2 } from "lucide-react";
import type { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch } from "@/components/ui/field";
import { ErrorText, Panel, Stat, StatGrid } from "@/components/tool-ui";
import { downloadBlob, withSuffix } from "@/lib/files";
import { formatBytes } from "@/lib/utils";
import { useTool } from "@/tools/context";
import { loadPdfLib, openPdf, pdfErrorMessage, savePdf } from "@/tools/lib/pdf";
import { DownloadResult, PdfFilePicker, Progress, usePdfFile, type LoadedPdf, type OutputFile } from "@/tools/lib/pdf-file";

type FieldName = "title" | "author" | "subject" | "keywords" | "creator" | "producer";

type Fields = Record<FieldName, string>;

interface PdfInfo {
  fields: Fields;
  created?: Date;
  modified?: Date;
  hasXmp: boolean;
}

const FIELDS: Array<{ name: FieldName; label: string; hint?: string }> = [
  { name: "title", label: "Title" },
  { name: "author", label: "Author" },
  { name: "subject", label: "Subject" },
  { name: "keywords", label: "Keywords", hint: "Separate keywords with commas." },
  { name: "creator", label: "Creator", hint: "The application the document was originally made in." },
  { name: "producer", label: "Producer", hint: "The software that produced the PDF file." },
];

const EMPTY: Fields = { title: "", author: "", subject: "", keywords: "", creator: "", producer: "" };

/** pdf-lib throws on malformed date strings; treat those as missing. */
function safeDate(read: () => Date | undefined): Date | undefined {
  try {
    const date = read();
    return date && !Number.isNaN(date.getTime()) ? date : undefined;
  } catch {
    return undefined;
  }
}

async function readInfo(doc: PDFDocument): Promise<PdfInfo> {
  const { PDFName } = await loadPdfLib();
  return {
    fields: {
      title: doc.getTitle() ?? "",
      author: doc.getAuthor() ?? "",
      subject: doc.getSubject() ?? "",
      keywords: doc.getKeywords() ?? "",
      creator: doc.getCreator() ?? "",
      producer: doc.getProducer() ?? "",
    },
    created: safeDate(() => doc.getCreationDate()),
    modified: safeDate(() => doc.getModificationDate()),
    hasXmp: doc.catalog.has(PDFName.of("Metadata")),
  };
}

function formatDate(date: Date | undefined): string {
  return date ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Not set";
}

function MetadataForm({ pdf, info }: { pdf: LoadedPdf; info: PdfInfo }) {
  const { track } = useTool();
  const [fields, setFields] = useState<Fields>(info.fields);
  const [touchModified, setTouchModified] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OutputFile | null>(null);

  function update(next: Fields) {
    setFields(next);
    setResult(null);
    setError("");
  }

  async function save() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const { PDFName } = await loadPdfLib();
      // updateMetadata: false stops pdf-lib from overwriting the producer and dates itself.
      const doc = await openPdf(pdf.bytes, { updateMetadata: false });
      doc.setTitle(fields.title.trim());
      doc.setAuthor(fields.author.trim());
      doc.setSubject(fields.subject.trim());
      doc.setKeywords([fields.keywords.trim()]);
      doc.setCreator(fields.creator.trim());
      doc.setProducer(fields.producer.trim());
      if (touchModified) doc.setModificationDate(new Date());
      // The XMP stream would still hold the old values, and many readers prefer it. Removing it
      // makes every reader show the properties entered here.
      doc.catalog.delete(PDFName.of("Metadata"));
      const output = { blob: await savePdf(doc), name: withSuffix(pdf.file.name, "-edited") };
      setResult(output);
      downloadBlob(output.blob, output.name);
      track();
    } catch (e) {
      setError(pdfErrorMessage(e, "The metadata could not be saved. Check that the PDF opens in a PDF reader."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <StatGrid className="sm:grid-cols-4">
        <Stat label="Pages" value={pdf.pageCount} />
        <Stat label="File size" value={formatBytes(pdf.file.size)} />
        <Stat label="Created" value={<span className="text-sm">{formatDate(info.created)}</span>} />
        <Stat label="Modified" value={<span className="text-sm">{formatDate(info.modified)}</span>} />
      </StatGrid>

      <Panel
        title="Document properties"
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => update(info.fields)} disabled={busy}>
              <Undo2 aria-hidden />
              Reset
            </Button>
            <Button size="sm" variant="ghost" onClick={() => update(EMPTY)} disabled={busy}>
              <Eraser aria-hidden />
              Clear all
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <Field key={field.name} label={field.label} htmlFor={`pdf-meta-${field.name}`} hint={field.hint}>
              <Input
                id={`pdf-meta-${field.name}`}
                value={fields[field.name]}
                disabled={busy}
                maxLength={1000}
                onChange={(e) => update({ ...fields, [field.name]: e.target.value })}
              />
            </Field>
          ))}
        </div>
        <Switch
          className="mt-5"
          label="Update the modification date"
          description="Set the modified date to now. Turn off to keep the original date."
          checked={touchModified}
          disabled={busy}
          onChange={(e) => setTouchModified(e.target.checked)}
        />
        {info.hasXmp ? (
          <p className="mt-4 text-xs text-muted">
            This PDF also stores an XMP metadata copy. It will be removed so every PDF reader shows the properties above.
          </p>
        ) : null}
      </Panel>

      <ErrorText>{error}</ErrorText>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={busy}>
          <Save aria-hidden />
          Save and download
        </Button>
        {busy ? <Progress>Saving the PDF…</Progress> : null}
      </div>

      {result ? <DownloadResult result={result} /> : null}
    </>
  );
}

function MetadataWorkspace({ pdf }: { pdf: LoadedPdf }) {
  const [info, setInfo] = useState<PdfInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    openPdf(pdf.bytes, { updateMetadata: false })
      .then(readInfo)
      .then((result) => {
        if (!cancelled) setInfo(result);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(pdfErrorMessage(e, "The document properties could not be read."));
      });
    return () => {
      cancelled = true;
    };
  }, [pdf.bytes]);

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!info) return <Progress>Reading document properties…</Progress>;
  return <MetadataForm pdf={pdf} info={info} />;
}

export default function PdfMetadataEditor() {
  const state = usePdfFile();
  return (
    <div className="space-y-4">
      <PdfFilePicker state={state} />
      {state.pdf ? <MetadataWorkspace key={state.pdf.id} pdf={state.pdf} /> : null}
    </div>
  );
}
