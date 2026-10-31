"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { ErrorText, Panel, RangeField, Segmented, Spinner, ToolColumns } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch } from "@/components/ui/field";
import { canvasToBlob, downloadBlob, downloadText } from "@/lib/files";
import { useTool } from "@/tools/context";

type Format = "CODE128" | "CODE39" | "EAN13" | "EAN8" | "UPC" | "ITF14" | "MSI" | "pharmacode" | "codabar";

const FORMATS: Record<Format, { label: string; example: string; rule: string }> = {
  CODE128: {
    label: "CODE128 (any text)",
    example: "TOOLZEN-12345",
    rule: "Any letters, digits and symbols from the ASCII character set.",
  },
  CODE39: { label: "CODE39", example: "TOOLZEN 39", rule: "Uppercase A–Z, digits 0–9, spaces and - . $ / + %" },
  EAN13: {
    label: "EAN-13",
    example: "590123412345",
    rule: "12 digits, or 13 digits where the last one is a correct check digit.",
  },
  EAN8: { label: "EAN-8", example: "9638507", rule: "7 digits, or 8 digits where the last one is a correct check digit." },
  UPC: { label: "UPC-A", example: "03600029145", rule: "11 digits, or 12 digits where the last one is a correct check digit." },
  ITF14: {
    label: "ITF-14",
    example: "1540014128876",
    rule: "13 digits, or 14 digits where the last one is a correct check digit.",
  },
  MSI: { label: "MSI Plessey", example: "1234567", rule: "Digits 0–9 only." },
  pharmacode: { label: "Pharmacode", example: "1234", rule: "A whole number from 3 to 131070." },
  codabar: { label: "Codabar", example: "A40156B", rule: "Digits and - $ : / . + with optional start/stop letters A–D." },
};

type Scale = "1" | "2" | "4";

interface Status {
  key: string;
  valid: boolean;
}

export default function BarcodeGenerator() {
  const { track } = useTool();
  const svgRef = useRef<SVGSVGElement>(null);
  const [format, setFormat] = useState<Format>("CODE128");
  const [value, setValue] = useState(FORMATS.CODE128.example);
  const [barWidth, setBarWidth] = useState(2);
  const [height, setHeight] = useState(100);
  const [displayValue, setDisplayValue] = useState(true);
  const [fontSize, setFontSize] = useState(20);
  const [lineColor, setLineColor] = useState("#000000");
  const [background, setBackground] = useState("#ffffff");
  const [scale, setScale] = useState<Scale>("2");
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const options = useMemo(
    () => ({ format, width: barWidth, height, displayValue, fontSize, lineColor, background, margin: 10 }),
    [format, barWidth, height, displayValue, fontSize, lineColor, background],
  );
  const key = JSON.stringify([value, options]);
  const current = status?.key === key ? status : null;
  const empty = !value.trim();

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || empty) return;
    let cancelled = false;
    (async () => {
      const { default: JsBarcode } = await import("jsbarcode");
      let valid = false;
      try {
        JsBarcode(svg, value, { ...options, valid: (ok: boolean) => (valid = ok) });
      } catch {
        valid = false;
      }
      if (!cancelled) setStatus({ key, valid });
    })();
    return () => {
      cancelled = true;
    };
  }, [value, options, key, empty]);

  useEffect(() => {
    if (current?.valid) track();
  }, [current, track]);

  function changeFormat(next: Format) {
    // Swap in the new format's example if the visitor hasn't typed their own value.
    if (!value.trim() || value === FORMATS[format].example) setValue(FORMATS[next].example);
    setFormat(next);
  }

  function downloadSvg() {
    const svg = svgRef.current;
    if (!svg) return;
    const markup = new XMLSerializer().serializeToString(svg);
    downloadText(`<?xml version="1.0" encoding="UTF-8"?>\n${markup}`, `barcode-${format.toLowerCase()}.svg`, "image/svg+xml");
  }

  async function downloadPng() {
    setBusy(true);
    setDownloadError("");
    try {
      const { default: JsBarcode } = await import("jsbarcode");
      const factor = Number(scale);
      const canvas = document.createElement("canvas");
      JsBarcode(canvas, value, {
        ...options,
        width: barWidth * factor,
        height: height * factor,
        fontSize: fontSize * factor,
        margin: options.margin * factor,
        textMargin: 2 * factor,
      });
      downloadBlob(await canvasToBlob(canvas), `barcode-${format.toLowerCase()}.png`);
    } catch {
      setDownloadError("The PNG could not be created. Check the value and try again.");
    } finally {
      setBusy(false);
    }
  }

  const invalid = !empty && current !== null && !current.valid;
  // While a new value renders, keep the previous valid barcode on screen so typing doesn't flicker.
  const visible = !empty && !invalid && status?.valid === true;
  const ready = visible && current !== null;

  return (
    <ToolColumns>
      <Panel title="Barcode settings">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Format" htmlFor="bc-format">
              <Select id="bc-format" value={format} onChange={(e) => changeFormat(e.target.value as Format)}>
                {(Object.keys(FORMATS) as Format[]).map((f) => (
                  <option key={f} value={f}>
                    {FORMATS[f].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Value" htmlFor="bc-value" hint={FORMATS[format].rule}>
              <Input
                id="bc-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="font-mono"
                spellCheck={false}
                aria-invalid={invalid}
                aria-describedby="bc-error"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <RangeField label="Bar width" value={barWidth} min={1} max={5} onChange={setBarWidth} format={(v) => `${v} px`} />
            <RangeField
              label="Height"
              value={height}
              min={20}
              max={200}
              step={5}
              onChange={setHeight}
              format={(v) => `${v} px`}
            />
          </div>
          <Switch label="Show text below the bars" checked={displayValue} onChange={(e) => setDisplayValue(e.target.checked)} />
          {displayValue ? (
            <RangeField label="Font size" value={fontSize} min={8} max={36} onChange={setFontSize} format={(v) => `${v} px`} />
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bar colour" htmlFor="bc-line">
              <input
                id="bc-line"
                type="color"
                value={lineColor}
                onChange={(e) => setLineColor(e.target.value)}
                className="h-10 w-full cursor-pointer rounded-lg border border-line bg-surface p-1"
              />
            </Field>
            <Field label="Background" htmlFor="bc-bg">
              <input
                id="bc-bg"
                type="color"
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                className="h-10 w-full cursor-pointer rounded-lg border border-line bg-surface p-1"
              />
            </Field>
          </div>
        </div>
      </Panel>

      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Panel title="Preview">
          <div id="bc-error">
            {empty ? <ErrorText>Enter a value to encode.</ErrorText> : null}
            {invalid ? (
              <ErrorText>
                “{value}” is not a valid {FORMATS[format].label} value. {FORMATS[format].rule}
              </ErrorText>
            ) : null}
          </div>
          {!empty && !status ? (
            <div className="grid place-items-center py-10">
              <Spinner className="size-6 text-muted" />
            </div>
          ) : null}
          <div className={visible ? "overflow-x-auto rounded-lg border border-line" : "hidden"}>
            <svg ref={svgRef} role="img" aria-label={`${FORMATS[format].label} barcode for ${value}`} className="mx-auto block" />
          </div>
          {visible ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted">PNG resolution</span>
                <Segmented<Scale>
                  label="PNG resolution"
                  value={scale}
                  onChange={setScale}
                  options={[
                    { value: "1", label: "1×" },
                    { value: "2", label: "2×" },
                    { value: "4", label: "4×" },
                  ]}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={downloadPng} disabled={busy || !ready}>
                  {busy ? <Spinner /> : <Download aria-hidden />}
                  Download PNG
                </Button>
                <Button variant="outline" onClick={downloadSvg} disabled={!ready}>
                  <Download aria-hidden />
                  Download SVG
                </Button>
              </div>
            </div>
          ) : null}
          {downloadError ? (
            <div className="mt-3">
              <ErrorText>{downloadError}</ErrorText>
            </div>
          ) : null}
        </Panel>
      </div>
    </ToolColumns>
  );
}
