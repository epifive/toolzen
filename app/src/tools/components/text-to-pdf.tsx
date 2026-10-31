"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import type { PDFFont } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { ErrorText, FileDropzone, Panel, RangeField, Segmented, TextInput, ToolColumns } from "@/components/tool-ui";
import { downloadBlob, renameExtension } from "@/lib/files";
import { useTool } from "@/tools/context";
import { assertStandardFontText, loadPdfLib, nextFrame, pdfErrorMessage, PdfUserError, savePdf } from "@/tools/lib/pdf";
import { DownloadResult, Progress, type OutputFile } from "@/tools/lib/pdf-file";

type PageSize = "a4" | "letter";
type FontName = "helvetica" | "times" | "courier";

interface Settings {
  pageSize: PageSize;
  /** Millimetres on every side. */
  margin: number;
  font: FontName;
  /** Points. */
  fontSize: number;
  /** Multiple of the font size. */
  lineHeight: number;
}

/** Page sizes in PDF points (1/72 inch). */
const PAGE_SIZES: Record<PageSize, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

const FONT_LABEL: Record<FontName, string> = {
  helvetica: "Helvetica (sans-serif)",
  times: "Times (serif)",
  courier: "Courier (monospace)",
};

const MM_TO_PT = 72 / 25.4;
const TAB = "    ";
const FORM_FEED = String.fromCharCode(12);

/**
 * Normalises line endings, expands tabs and drops invisible control characters that the
 * standard fonts can't encode. Form feeds are kept: they start a new page.
 */
function cleanText(input: string): string {
  const normalised = input.replace(/\r\n?/g, "\n").replace(/\t/g, TAB);
  return Array.from(normalised)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return char === "\n" || char === FORM_FEED || code >= 32;
    })
    .join("");
}

/** Breaks a word that is wider than the line into pieces that fit. */
function splitLongWord(word: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const parts: string[] = [];
  let current = "";
  for (const char of Array.from(word)) {
    if (current && font.widthOfTextAtSize(current + char, size) > maxWidth) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
  return parts;
}

/** Word-wraps one paragraph. Leading spaces are kept so indented and monospaced text lines up. */
function wrapParagraph(paragraph: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!paragraph.trim()) return [""];
  const lines: string[] = [];
  let line = "";
  for (const token of paragraph.match(/\s+|\S+/g) ?? []) {
    const candidate = line + token;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (/^\s+$/.test(token)) {
      // Spaces at a line break are dropped rather than carried to the next line.
      lines.push(line.trimEnd());
      line = "";
      continue;
    }
    if (line.trim()) lines.push(line.trimEnd());
    if (font.widthOfTextAtSize(token, size) > maxWidth) {
      const pieces = splitLongWord(token, font, size, maxWidth);
      lines.push(...pieces.slice(0, -1));
      line = pieces[pieces.length - 1] ?? "";
    } else {
      line = token;
    }
  }
  if (line.trim() || !lines.length) lines.push(line.trimEnd());
  return lines;
}

async function buildPdf(input: string, s: Settings, title: string): Promise<Blob> {
  const { PDFDocument, StandardFonts } = await loadPdfLib();
  const doc = await PDFDocument.create();
  const fontKey = { helvetica: StandardFonts.Helvetica, times: StandardFonts.TimesRoman, courier: StandardFonts.Courier }[s.font];
  const font = await doc.embedFont(fontKey);
  const text = cleanText(input);
  assertStandardFontText(font, text.replaceAll("\n", " ").replaceAll(FORM_FEED, " "));

  const [pageWidth, pageHeight] = PAGE_SIZES[s.pageSize];
  const margin = s.margin * MM_TO_PT;
  const maxWidth = pageWidth - margin * 2;
  const leading = s.fontSize * s.lineHeight;
  const ascent = font.heightAtSize(s.fontSize, { descender: false });
  const linesPerPage = Math.floor((pageHeight - margin * 2 - ascent) / leading) + 1;
  if (maxWidth < s.fontSize * 2 || linesPerPage < 1) {
    throw new PdfUserError("The margins leave no room for text. Make the margins or the font size smaller.");
  }

  const sections = text.split(FORM_FEED);
  for (const [index, section] of sections.entries()) {
    // A form feed at the very end of the file shouldn't add an empty page.
    if (index > 0 && index === sections.length - 1 && !section.trim()) break;
    const lines = section.split("\n").flatMap((p) => wrapParagraph(p, font, s.fontSize, maxWidth));
    for (let start = 0; start < lines.length; start += linesPerPage) {
      const page = doc.addPage([pageWidth, pageHeight]);
      lines.slice(start, start + linesPerPage).forEach((line, i) => {
        if (!line) return;
        page.drawText(line, {
          x: margin,
          y: pageHeight - margin - ascent - i * leading,
          size: s.fontSize,
          font,
        });
      });
    }
  }

  if (title) doc.setTitle(title);
  return savePdf(doc);
}

export default function TextToPdf() {
  const { track } = useTool();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [settings, setSettings] = useState<Settings>({
    pageSize: "a4",
    margin: 20,
    font: "helvetica",
    fontSize: 11,
    lineHeight: 1.4,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OutputFile | null>(null);

  function update(patch: Partial<Settings>) {
    setSettings((prev) => ({ ...prev, ...patch }));
    setResult(null);
    setError("");
  }

  function changeText(value: string) {
    setText(value);
    setResult(null);
    setError("");
  }

  async function openFile(files: File[]) {
    try {
      changeText(await files[0].text());
      setFileName(files[0].name);
    } catch {
      setError(`${files[0].name} could not be read.`);
    }
  }

  async function create() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      await nextFrame();
      const title = fileName ? fileName.replace(/\.[^.]+$/, "") : "";
      const blob = await buildPdf(text, settings, title);
      const output = { blob, name: fileName ? renameExtension(fileName, "pdf") : "document.pdf" };
      setResult(output);
      downloadBlob(output.blob, output.name);
      track();
    } catch (e) {
      setError(pdfErrorMessage(e, "The PDF could not be created."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <ToolColumns>
        <div className="space-y-4">
          <TextInput
            label="Text"
            value={text}
            onChange={(value) => {
              changeText(value);
              if (!value) setFileName("");
            }}
            rows={16}
            mono={settings.font === "courier"}
            placeholder="Paste or type your text here…"
          />
          <FileDropzone
            accept="text/plain,.txt"
            compact
            onFiles={openFile}
            label={fileName ? `Loaded ${fileName}. Open another .txt file` : "Or open a .txt file"}
          />
        </div>

        <Panel title="Page layout">
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Page size</p>
              <Segmented<PageSize>
                label="Page size"
                value={settings.pageSize}
                onChange={(pageSize) => update({ pageSize })}
                options={[
                  { value: "a4", label: "A4" },
                  { value: "letter", label: "US Letter" },
                ]}
              />
            </div>
            <Field label="Font" htmlFor="text-pdf-font">
              <Select id="text-pdf-font" value={settings.font} onChange={(e) => update({ font: e.target.value as FontName })}>
                {(Object.keys(FONT_LABEL) as FontName[]).map((f) => (
                  <option key={f} value={f}>
                    {FONT_LABEL[f]}
                  </option>
                ))}
              </Select>
            </Field>
            <RangeField
              label="Font size"
              value={settings.fontSize}
              min={6}
              max={36}
              step={0.5}
              onChange={(fontSize) => update({ fontSize })}
              format={(v) => `${v} pt`}
            />
            <RangeField
              label="Line spacing"
              value={settings.lineHeight}
              min={1}
              max={3}
              step={0.05}
              onChange={(lineHeight) => update({ lineHeight })}
              format={(v) => `${v.toFixed(2)}×`}
            />
            <RangeField
              label="Margins"
              value={settings.margin}
              min={5}
              max={50}
              onChange={(margin) => update({ margin })}
              format={(v) => `${v} mm`}
            />
          </div>
        </Panel>
      </ToolColumns>

      <ErrorText>{error}</ErrorText>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={create} disabled={busy || !text.trim()}>
          <FileDown aria-hidden />
          Create PDF
        </Button>
        {busy ? <Progress>Laying out pages…</Progress> : null}
      </div>

      {result ? <DownloadResult result={result} /> : null}
    </div>
  );
}
