"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Download } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { ErrorText, FileDropzone, FileRow, OutputBox, Panel, Segmented, Spinner, TextInput } from "@/components/tool-ui";
import { downloadBlob, readAsDataUrl } from "@/lib/files";
import { formatBytes } from "@/lib/utils";
import { useTool } from "@/tools/context";
import { base64ToBytes, decodeUtf8, encodeBase64Text, errorMessage, toUrlSafeBase64 } from "@/tools/lib/dev";

type Mode = "encode" | "decode";

type Result =
  | { kind: "text"; value: string }
  | { kind: "binary"; bytes: Uint8Array }
  | { kind: "error"; message: string };

function convert(text: string, mode: Mode, urlSafe: boolean): Result {
  if (mode === "encode") return { kind: "text", value: encodeBase64Text(text, urlSafe) };
  try {
    const bytes = base64ToBytes(text);
    const decoded = decodeUtf8(bytes);
    return decoded === null ? { kind: "binary", bytes } : { kind: "text", value: decoded };
  } catch (error) {
    return { kind: "error", message: errorMessage(error, "This is not valid Base64.") };
  }
}

interface EncodedFile {
  file: File;
  base64: string;
}

export default function Base64EncoderDecoder() {
  const { track } = useTool();
  const [mode, setMode] = useState<Mode>("encode");
  const [input, setInput] = useState("");
  const [urlSafe, setUrlSafe] = useState(false);
  const [encodedFile, setEncodedFile] = useState<EncodedFile | null>(null);
  const [dataUri, setDataUri] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [fileError, setFileError] = useState("");
  const source = useDeferredValue(input);

  const result = useMemo(() => (source ? convert(source, mode, urlSafe) : null), [source, mode, urlSafe]);
  const output = result?.kind === "text" ? result.value : "";

  useEffect(() => {
    if (output) track();
  }, [output, track]);

  const fileOutput = useMemo(() => {
    if (!encodedFile) return "";
    const { base64, file } = encodedFile;
    if (dataUri) return `data:${file.type || "application/octet-stream"};base64,${base64}`;
    return urlSafe ? toUrlSafeBase64(base64) : base64;
  }, [encodedFile, dataUri, urlSafe]);

  async function encodeFile(file: File) {
    setFileBusy(true);
    setFileError("");
    try {
      const url = await readAsDataUrl(file);
      setEncodedFile({ file, base64: url.slice(url.indexOf(",") + 1) });
      track();
    } catch (error) {
      setEncodedFile(null);
      setFileError(errorMessage(error, "The file could not be read."));
    } finally {
      setFileBusy(false);
    }
  }

  function swap() {
    setMode(mode === "encode" ? "decode" : "encode");
    setInput(output);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Segmented
          label="Mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "encode", label: "Encode" },
            { value: "decode", label: "Decode" },
          ]}
        />
        <Checkbox
          label="URL-safe (- and _ instead of + and /, no padding)"
          checked={urlSafe}
          onChange={(e) => setUrlSafe(e.target.checked)}
        />
      </div>

      <TextInput
        value={input}
        onChange={setInput}
        label={mode === "encode" ? "Text to encode" : "Base64 to decode"}
        placeholder={mode === "encode" ? "Type or paste any text, including emoji and accents…" : "SGVsbG8sIHdvcmxkIQ=="}
        rows={8}
        mono={mode === "decode"}
        actions={
          <Button size="sm" variant="ghost" onClick={swap} disabled={!output}>
            <ArrowUpDown aria-hidden />
            Swap
          </Button>
        }
      />

      {result?.kind === "error" ? <ErrorText>{result.message}</ErrorText> : null}

      {result?.kind === "binary" ? (
        <Alert tone="warning" title="This Base64 decodes to binary data, not text">
          <p>
            The {formatBytes(result.bytes.length)} of decoded data are not valid UTF-8 text. It is probably a file such as an
            image or archive.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => downloadBlob(new Blob([new Uint8Array(result.bytes)]), "decoded.bin")}
          >
            <Download aria-hidden />
            Download decoded file
          </Button>
        </Alert>
      ) : null}

      <OutputBox
        value={output}
        label={mode === "encode" ? "Base64" : "Decoded text"}
        filename={mode === "encode" ? "encoded.txt" : "decoded.txt"}
        mono={mode === "encode"}
        rows={8}
      />

      <Panel title="Encode a file">
        <div className="space-y-3">
          <FileDropzone accept="" compact onFiles={(files) => void encodeFile(files[0])} label="Drop any file to encode it as Base64" />
          {fileBusy ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Spinner />
              Reading file…
            </p>
          ) : null}
          <ErrorText>{fileError}</ErrorText>
          {encodedFile ? (
            <>
              <ul>
                <FileRow
                  name={encodedFile.file.name}
                  size={encodedFile.file.size}
                  meta={`${formatBytes(fileOutput.length)} as Base64`}
                  onRemove={() => setEncodedFile(null)}
                />
              </ul>
              <Checkbox label="Output as a data: URI" checked={dataUri} onChange={(e) => setDataUri(e.target.checked)} />
            </>
          ) : null}
        </div>
      </Panel>

      {encodedFile ? (
        <OutputBox value={fileOutput} label="File as Base64" filename={`${encodedFile.file.name}.b64.txt`} mono rows={6} />
      ) : null}
    </div>
  );
}
