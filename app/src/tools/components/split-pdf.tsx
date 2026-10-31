"use client";

import { useState } from "react";
import { Download, Package, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Hint } from "@/components/ui/field";
import { ErrorText, FileRow, Panel, Segmented } from "@/components/tool-ui";
import { downloadBlob, downloadZip, renameExtension, withSuffix } from "@/lib/files";
import { useTool } from "@/tools/context";
import { NumberField } from "@/tools/lib/image-ui";
import { copyPagesToNewPdf, nextFrame, openPdf, pageLabel, parsePageRanges, pdfErrorMessage, savePdf } from "@/tools/lib/pdf";
import { PdfFilePicker, Progress, usePdfFile, type LoadedPdf, type OutputFile } from "@/tools/lib/pdf-file";

type Mode = "ranges" | "every" | "chunks";

interface Part extends OutputFile {
  pages: number;
}

/** Zero-based page groups, one per output file. Throws a readable error for bad input. */
function planFiles(mode: Mode, ranges: string, chunkSize: number, pageCount: number): number[][] {
  const all = Array.from({ length: pageCount }, (_, i) => i);
  if (mode === "every") return all.map((i) => [i]);
  if (mode === "chunks") {
    const groups: number[][] = [];
    for (let i = 0; i < pageCount; i += chunkSize) groups.push(all.slice(i, i + chunkSize));
    return groups;
  }
  return parsePageRanges(ranges, pageCount);
}

function defaultRanges(pageCount: number): string {
  if (pageCount < 2) return "1";
  const half = Math.ceil(pageCount / 2);
  return `1-${half}, ${half + 1}${half + 1 < pageCount ? `-${pageCount}` : ""}`;
}

function SplitWorkspace({ pdf }: { pdf: LoadedPdf }) {
  const { track } = useTool();
  const [mode, setMode] = useState<Mode>("ranges");
  const [ranges, setRanges] = useState(() => defaultRanges(pdf.pageCount));
  const [chunkSize, setChunkSize] = useState(Math.min(2, pdf.pageCount));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [parts, setParts] = useState<Part[]>([]);

  let groups: number[][] = [];
  let planError = "";
  try {
    groups = planFiles(mode, ranges, chunkSize, pdf.pageCount);
  } catch (e) {
    planError = pdfErrorMessage(e);
  }

  const zipName = renameExtension(withSuffix(pdf.file.name, "-split"), "zip");

  function change<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setParts([]);
      setError("");
    };
  }

  async function split() {
    setBusy(true);
    setError("");
    setParts([]);
    try {
      const source = await openPdf(pdf.bytes);
      const output: Part[] = [];
      for (const [index, group] of groups.entries()) {
        setProgress(`Creating file ${index + 1} of ${groups.length}…`);
        await nextFrame();
        const doc = await copyPagesToNewPdf(source, group);
        output.push({
          blob: await savePdf(doc),
          name: withSuffix(pdf.file.name, `-${pageLabel(group)}`),
          pages: group.length,
        });
      }
      if (output.length === 1) {
        downloadBlob(output[0].blob, output[0].name);
      } else {
        setProgress("Packing the ZIP file…");
        await downloadZip(output.map((p) => ({ name: p.name, data: p.blob })), zipName);
      }
      setParts(output);
      track();
    } catch (e) {
      setError(pdfErrorMessage(e, "The PDF could not be split. Check that it opens in a PDF reader."));
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <>
      <Panel title="How to split">
        <div className="space-y-4">
          <Segmented<Mode>
            label="Split mode"
            value={mode}
            onChange={change(setMode)}
            options={[
              { value: "ranges", label: "Custom ranges" },
              { value: "every", label: "Every page" },
              { value: "chunks", label: "Every N pages" },
            ]}
          />

          {mode === "ranges" ? (
            <div>
              <Label htmlFor="split-ranges">Page ranges</Label>
              <Input
                id="split-ranges"
                value={ranges}
                onChange={(e) => change(setRanges)(e.target.value)}
                placeholder="e.g. 1-3, 4-6, 7-"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={planError ? true : undefined}
              />
              <Hint>Separate files with commas. Each range becomes its own PDF. &quot;7-&quot; means page 7 to the end.</Hint>
            </div>
          ) : null}

          {mode === "chunks" ? (
            <NumberField
              id="split-chunk"
              className="max-w-48"
              label="Pages per file"
              value={chunkSize}
              min={1}
              max={pdf.pageCount}
              onChange={change(setChunkSize)}
            />
          ) : null}

          {planError ? (
            <ErrorText>{planError}</ErrorText>
          ) : (
            <p className="text-sm text-muted" aria-live="polite">
              {groups.length === 1
                ? "This creates 1 PDF file."
                : `This creates ${groups.length} PDF files, downloaded together as a ZIP.`}
            </p>
          )}
        </div>
      </Panel>

      <ErrorText>{error}</ErrorText>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={split} disabled={busy || !!planError || !groups.length}>
          <Scissors aria-hidden />
          Split PDF
        </Button>
        {busy ? <Progress>{progress}</Progress> : null}
      </div>

      {parts.length ? (
        <Panel
          title={`${parts.length} file${parts.length === 1 ? "" : "s"} created`}
          actions={
            parts.length > 1 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void downloadZip(parts.map((p) => ({ name: p.name, data: p.blob })), zipName)}
              >
                <Package aria-hidden />
                Download ZIP
              </Button>
            ) : null
          }
        >
          <ul className="space-y-2">
            {parts.map((part, index) => (
              <FileRow
                key={index}
                name={part.name}
                size={part.blob.size}
                meta={`${part.pages} page${part.pages === 1 ? "" : "s"}`}
                actions={
                  <Button size="sm" variant="outline" onClick={() => downloadBlob(part.blob, part.name)}>
                    <Download aria-hidden />
                    <span className="sr-only sm:not-sr-only">Download</span>
                  </Button>
                }
              />
            ))}
          </ul>
        </Panel>
      ) : null}
    </>
  );
}

export default function SplitPdf() {
  const state = usePdfFile();
  return (
    <div className="space-y-4">
      <PdfFilePicker state={state} />
      {state.pdf ? <SplitWorkspace key={state.pdf.id} pdf={state.pdf} /> : null}
    </div>
  );
}
