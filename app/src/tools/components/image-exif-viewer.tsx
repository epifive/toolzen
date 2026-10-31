"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { CopyButton, ErrorText, FileDropzone, FileRow, Panel, Spinner, Stat, StatGrid } from "@/components/tool-ui";
import { createCanvas, downloadBlob, MIME_EXTENSION, renameExtension, withSuffix } from "@/lib/files";
import { useTool } from "@/tools/context";
import { assertCanvasSize, context2d, errorMessage, exportCanvas, formatLabel, openImage, outputTypeFor } from "@/tools/lib/image";
import { ImageThumb } from "@/tools/lib/image-ui";

/** Formats that commonly carry metadata. HEIC and TIFF can be read even where browsers can't display them. */
const EXIF_ACCEPT =
  "image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/tiff,.jpg,.jpeg,.png,.webp,.avif,.heic,.heif,.tif,.tiff";

const MAX_VALUE_LENGTH = 300;

type Tags = Record<string, unknown>;

interface Metadata {
  /** Tags per metadata block (EXIF, GPS, XMP…). */
  groups: Array<{ key: string; tags: Tags }>;
  /** Every tag in one object; the first block that has a tag wins. */
  merged: Tags;
  /** Everything as readable JSON, for copying. */
  json: string;
}

const GROUP_LABEL: Record<string, string> = {
  ifd0: "Image",
  ifd1: "Thumbnail",
  exif: "EXIF",
  gps: "GPS",
  interop: "Interoperability",
  iptc: "IPTC",
  xmp: "XMP",
  icc: "Colour profile (ICC)",
  ihdr: "PNG header",
  jfif: "JFIF",
  other: "Other",
};

function isRecord(value: unknown): value is Tags {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function truncate(text: string): string {
  return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text;
}

/** Human-readable version of any value exifr returns. */
function formatValue(value: unknown): string {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toLocaleString();
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
  if (typeof value === "string") return truncate(value.trim());
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (ArrayBuffer.isView(value)) return `Binary data (${value.byteLength.toLocaleString()} bytes)`;
  if (Array.isArray(value)) return truncate(value.map(formatValue).join(", "));
  if (isRecord(value)) return truncate(JSON.stringify(value, jsonReplacer));
  return value === null || value === undefined ? "" : truncate(String(value));
}

function jsonReplacer(_key: string, value: unknown): unknown {
  return ArrayBuffer.isView(value) ? `Binary data (${value.byteLength} bytes)` : value;
}

async function readMetadata(file: File): Promise<Metadata | null> {
  const { parse } = await import("exifr");
  let output: unknown;
  try {
    output = await parse(file, {
      tiff: true,
      ifd1: false,
      exif: true,
      gps: true,
      interop: true,
      xmp: true,
      iptc: true,
      icc: true,
      ihdr: true,
      jfif: false,
      makerNote: false,
      userComment: true,
      translateValues: true,
      reviveValues: true,
      sanitize: true,
      mergeOutput: false,
    });
  } catch {
    throw new Error("The metadata of this file could not be read. It may be damaged or in an unsupported format.");
  }
  if (!isRecord(output)) return null;

  const groups: Metadata["groups"] = [];
  const other: Tags = {};
  for (const [key, value] of Object.entries(output)) {
    if (isRecord(value)) groups.push({ key, tags: value });
    else other[key] = value;
  }
  if (Object.keys(other).length) groups.push({ key: "other", tags: other });
  const populated = groups.filter((g) => Object.keys(g.tags).length > 0);
  if (!populated.length) return null;

  const merged: Tags = {};
  for (const { tags } of populated) {
    for (const [name, value] of Object.entries(tags)) if (!(name in merged)) merged[name] = value;
  }
  return { groups: populated, merged, json: JSON.stringify(output, jsonReplacer, 2) };
}

/* ───────────────────────── Highlights ───────────────────────── */

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function num(value: unknown): number | null {
  const n = Array.isArray(value) ? value[0] : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** Degrees/minutes/seconds plus a hemisphere reference to signed decimal degrees. */
function dmsToDecimal(dms: unknown, ref: unknown): number | null {
  if (typeof dms === "number") return dms;
  if (!Array.isArray(dms) || !dms.every((n) => typeof n === "number")) return null;
  const [d = 0, m = 0, s = 0] = dms as number[];
  const value = d + m / 60 + s / 3600;
  return /^[SW]/i.test(text(ref)) ? -value : value;
}

function readGps(tags: Tags): { lat: number; lon: number } | null {
  const lat = num(tags.latitude) ?? dmsToDecimal(tags.GPSLatitude, tags.GPSLatitudeRef);
  const lon = num(tags.longitude) ?? dmsToDecimal(tags.GPSLongitude, tags.GPSLongitudeRef);
  if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  if (lat === 0 && lon === 0) return null;
  return { lat, lon };
}

function formatExposure(seconds: number): string {
  return seconds >= 1 ? `${Number(seconds.toFixed(1))} s` : `1/${Math.round(1 / seconds)} s`;
}

function highlights(tags: Tags): Array<{ label: string; value: string }> {
  const make = text(tags.Make);
  const model = text(tags.Model);
  const camera = model.toLowerCase().startsWith(make.toLowerCase()) ? model : [make, model].filter(Boolean).join(" ");
  const date = tags.DateTimeOriginal ?? tags.CreateDate ?? tags.DateCreated ?? tags.ModifyDate;
  const exposure = num(tags.ExposureTime);
  const aperture = num(tags.FNumber);
  const iso = num(tags.ISO) ?? num(tags.ISOSpeedRatings);
  const focal = num(tags.FocalLength);
  const focal35 = num(tags.FocalLengthIn35mmFormat);
  const width = num(tags.ExifImageWidth) ?? num(tags.ImageWidth);
  const height = num(tags.ExifImageHeight) ?? num(tags.ImageHeight);
  const altitude = num(tags.GPSAltitude);

  const rows = [
    { label: "Camera", value: camera },
    { label: "Lens", value: text(tags.LensModel) || text(tags.Lens) || text(tags.LensMake) },
    { label: "Date taken", value: date === undefined ? "" : formatValue(date) },
    { label: "Exposure", value: exposure ? formatExposure(exposure) : "" },
    { label: "Aperture", value: aperture ? `f/${Number(aperture.toFixed(1))}` : "" },
    { label: "ISO", value: iso ? String(iso) : "" },
    {
      label: "Focal length",
      value: focal ? `${Number(focal.toFixed(1))} mm${focal35 && focal35 !== focal ? ` (${focal35} mm full-frame)` : ""}` : "",
    },
    { label: "Flash", value: text(tags.Flash) },
    { label: "Dimensions", value: width && height ? `${width} × ${height} px` : "" },
    { label: "Software", value: text(tags.Software) },
    { label: "Altitude", value: altitude !== null ? `${Math.round(altitude)} m` : "" },
  ];
  return rows.filter((r) => r.value);
}

/* ───────────────────────── UI ───────────────────────── */

function TagTable({ metadata }: { metadata: Metadata }) {
  const [filter, setFilter] = useState("");
  const query = filter.trim().toLowerCase();
  const groups = metadata.groups
    .map(({ key, tags }) => ({
      key,
      rows: Object.entries(tags)
        .map(([name, value]) => ({ name, value: formatValue(value) }))
        .filter((r) => !query || r.name.toLowerCase().includes(query) || r.value.toLowerCase().includes(query)),
    }))
    .filter((g) => g.rows.length);
  const total = metadata.groups.reduce((sum, g) => sum + Object.keys(g.tags).length, 0);

  return (
    <Panel title={`All tags (${total})`} actions={<CopyButton text={metadata.json} label="Copy as JSON" />}>
      <div className="space-y-4">
        <Input
          type="search"
          aria-label="Filter tags"
          placeholder="Filter tags, e.g. GPS or Date"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {groups.length ? (
          groups.map((group) => (
            <div key={group.key} className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-left text-sm">
                <caption className="border-b border-line bg-paper px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted uppercase">
                  {GROUP_LABEL[group.key] ?? group.key}
                </caption>
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Tag</th>
                    <th scope="col">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr key={row.name} className="border-b border-line last:border-0">
                      <th scope="row" className="w-2/5 px-3 py-2 align-top font-medium break-all text-ink">
                        {row.name}
                      </th>
                      <td className="px-3 py-2 align-top break-all text-muted">{row.value || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted">No tags match “{filter}”.</p>
        )}
      </div>
    </Panel>
  );
}

function Summary({ metadata }: { metadata: Metadata }) {
  const rows = useMemo(() => highlights(metadata.merged), [metadata]);
  const gps = useMemo(() => readGps(metadata.merged), [metadata]);

  let location: ReactNode = null;
  if (gps) {
    const lat = gps.lat.toFixed(6);
    const lon = gps.lon.toFixed(6);
    location = (
      <Alert tone="warning" title="This photo contains its GPS location">
        <p className="tabular-nums">
          {lat}, {lon}
        </p>
        <a
          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 font-medium underline underline-offset-2"
        >
          View on OpenStreetMap
          <ExternalLink aria-hidden className="size-3.5" />
        </a>
        <p className="mt-1">Anyone you send the original file to can see where it was taken. Remove the metadata before sharing.</p>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {location}
      {rows.length ? (
        <StatGrid>
          {rows.map((r) => (
            <Stat key={r.label} label={r.label} value={<span className="text-base break-words">{r.value}</span>} />
          ))}
        </StatGrid>
      ) : (
        <p className="text-sm text-muted">No camera details were found, but the file has other metadata listed below.</p>
      )}
    </div>
  );
}

export default function ImageExifViewer() {
  const { track } = useTool();
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cleaning, setCleaning] = useState(false);
  const [cleanError, setCleanError] = useState("");
  const request = useRef(0);

  async function open(files: File[]) {
    const next = files[0];
    const id = ++request.current;
    setFile(next);
    setMetadata(null);
    setError("");
    setCleanError("");
    setLoading(true);
    try {
      const result = await readMetadata(next);
      if (id !== request.current) return;
      setMetadata(result);
      track();
    } catch (e) {
      if (id === request.current) setError(errorMessage(e, "The metadata could not be read."));
    } finally {
      if (id === request.current) setLoading(false);
    }
  }

  async function removeMetadata() {
    if (!file) return;
    setCleaning(true);
    setCleanError("");
    try {
      const { image, width, height } = await openImage(file);
      assertCanvasSize(width, height);
      const canvas = createCanvas(width, height);
      context2d(canvas).drawImage(image, 0, 0);
      const type = outputTypeFor(file.type);
      const blob = await exportCanvas(canvas, type);
      downloadBlob(blob, withSuffix(renameExtension(file.name, MIME_EXTENSION[type]), "-no-metadata"));
      track();
    } catch (e) {
      setCleanError(
        errorMessage(e, "A clean copy could not be created.") +
          " Your browser may not be able to open this format; try a JPG, PNG or WebP image.",
      );
    } finally {
      setCleaning(false);
    }
  }

  const cleanType = formatLabel(outputTypeFor(file?.type ?? ""));

  return (
    <div className="space-y-4">
      <FileDropzone
        accept={EXIF_ACCEPT}
        onFiles={open}
        compact={!!file}
        label={file ? "Choose a different photo" : undefined}
        hint={file ? undefined : "JPG, PNG, WebP, AVIF, HEIC or TIFF"}
      />

      {file ? (
        <>
          <ul>
            <FileRow name={file.name} size={file.size} thumbnail={<ImageThumb file={file} />} meta={file.type || undefined} />
          </ul>

          {loading ? (
            <p role="status" className="flex items-center gap-2 text-sm text-muted">
              <Spinner />
              Reading metadata…
            </p>
          ) : error ? (
            <ErrorText>{error}</ErrorText>
          ) : metadata ? (
            <>
              <Panel title="Summary">
                <Summary metadata={metadata} />
              </Panel>
              <TagTable metadata={metadata} />
            </>
          ) : (
            <Alert tone="success" title="No metadata found">
              This image has no EXIF, GPS, IPTC or XMP data, so it is already safe to share.
            </Alert>
          )}

          <ErrorText>{cleanError}</ErrorText>

          {!loading ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={removeMetadata} disabled={cleaning} variant={metadata ? "primary" : "outline"}>
                {cleaning ? <Spinner /> : <ShieldCheck aria-hidden />}
                {cleaning ? "Removing…" : "Remove metadata"}
              </Button>
              <p className="text-sm text-muted">Downloads a clean {cleanType} copy that contains only the pixels.</p>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
