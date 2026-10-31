"use client";

/**
 * One component behind the Text to Binary, Binary to Text, Text to Hex and Hex
 * to Text tools. Each tool page renders it with a fixed format and direction.
 */

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { ErrorText, OutputBox, Panel, Segmented, Stat, StatGrid, TextInput, ToolColumns } from "@/components/tool-ui";
import { useTool } from "@/tools/context";
import { decodeBytes, encodeText, type ByteFormat, type ByteSeparator } from "./encoding-core";

type Direction = "encode" | "decode";

const SLUGS: Record<ByteFormat, Record<Direction, string>> = {
  binary: { encode: "text-to-binary", decode: "binary-to-text" },
  hex: { encode: "text-to-hex", decode: "hex-to-text" },
};

const NAMES: Record<ByteFormat, string> = { binary: "Binary", hex: "Hex" };

const PLACEHOLDERS: Record<ByteFormat, string> = {
  binary: "01001000 01101001 00100001",
  hex: "48 65 6c 6c 6f",
};

const SEPARATOR_OPTIONS: Array<{ value: ByteSeparator; label: string }> = [
  { value: "space", label: "Space" },
  { value: "none", label: "None" },
  { value: "comma", label: "Comma" },
];

/** Carries the current result to the opposite tool when the visitor presses Swap. */
const HANDOFF_KEY = "toolzen:encoding-handoff";

function readHandoff(slug: string): string {
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) return "";
    const data = JSON.parse(raw) as { slug?: unknown; text?: unknown };
    return data.slug === slug && typeof data.text === "string" ? data.text : "";
  } catch {
    return "";
  }
}

function writeHandoff(slug: string, text: string): void {
  try {
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ slug, text }));
  } catch {
    // Storage can be unavailable (private mode, quota). The swap still opens the other tool.
  }
}

export function EncodingTool({ format, direction }: { format: ByteFormat; direction: Direction }) {
  const { track } = useTool();
  const router = useRouter();
  const slug = SLUGS[format][direction];
  const oppositeSlug = SLUGS[format][direction === "encode" ? "decode" : "encode"];
  const [input, setInput] = useState(() => readHandoff(slug));
  const [separator, setSeparator] = useState<ByteSeparator>("space");
  const [uppercase, setUppercase] = useState(false);
  const [prefix, setPrefix] = useState(false);
  const source = useDeferredValue(input);

  useEffect(() => {
    try {
      sessionStorage.removeItem(HANDOFF_KEY);
    } catch {
      // Nothing to clean up when storage is unavailable.
    }
  }, []);

  const result = useMemo(() => {
    if (!source) return null;
    if (direction === "encode") {
      return {
        ok: true as const,
        text: encodeText(source, format, { separator, uppercase, prefix }),
        bytes: new TextEncoder().encode(source).length,
        validUtf8: true,
      };
    }
    return source.trim() ? decodeBytes(source, format) : null;
  }, [source, direction, format, separator, uppercase, prefix]);

  const output = result?.ok ? result.text : "";

  useEffect(() => {
    if (output) track();
  }, [output, track]);

  const textName = "Text";
  const bytesName = NAMES[format];
  const inputLabel = direction === "encode" ? textName : bytesName;
  const outputLabel = direction === "encode" ? bytesName : textName;

  function swap() {
    writeHandoff(oppositeSlug, output);
    router.push(`/tools/${oppositeSlug}`);
  }

  return (
    <div className="space-y-4">
      {direction === "encode" ? (
        <Panel title="Options">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Segmented label="Byte separator" value={separator} onChange={setSeparator} options={SEPARATOR_OPTIONS} />
            {format === "hex" ? (
              <>
                <Checkbox label="Uppercase (A–F)" checked={uppercase} onChange={(e) => setUppercase(e.target.checked)} />
                <Checkbox label="0x prefix" checked={prefix} onChange={(e) => setPrefix(e.target.checked)} />
              </>
            ) : null}
          </div>
        </Panel>
      ) : null}

      <ToolColumns>
        <TextInput
          value={input}
          onChange={setInput}
          label={inputLabel}
          placeholder={direction === "encode" ? "Type or paste any text, including emoji and accents…" : PLACEHOLDERS[format]}
          rows={10}
          mono={direction === "decode"}
          actions={
            <Button size="sm" variant="ghost" onClick={swap} disabled={!output}>
              <ArrowLeftRight aria-hidden />
              Swap
            </Button>
          }
        />
        <OutputBox
          value={output}
          label={outputLabel}
          filename={direction === "encode" ? `${format}.txt` : "decoded-text.txt"}
          mono={direction === "encode"}
          rows={10}
        />
      </ToolColumns>

      {result && !result.ok ? <ErrorText>{result.error}</ErrorText> : null}

      {result?.ok && !result.validUtf8 ? (
        <Alert tone="warning" title="These bytes are not valid UTF-8 text">
          Characters that could not be decoded are shown as �. Check that no digits are missing and that every byte is complete.
        </Alert>
      ) : null}

      {result?.ok ? (
        <StatGrid>
          <Stat label="Characters" value={Array.from(direction === "encode" ? source : result.text).length.toLocaleString()} />
          <Stat label="Bytes (UTF-8)" value={result.bytes.toLocaleString()} />
          <Stat label="Bits" value={(result.bytes * 8).toLocaleString()} />
        </StatGrid>
      ) : null}
    </div>
  );
}
