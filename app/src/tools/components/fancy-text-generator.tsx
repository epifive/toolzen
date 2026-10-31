"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { CopyButton, Panel, TextInput } from "@/components/tool-ui";
import { cn } from "@/lib/utils";
import { useTool } from "@/tools/context";
import { FANCY_STYLES } from "@/tools/lib/fancy-text";

const SAMPLE = "Fancy Text 123";
/** Longer input is still converted, but only the start is previewed on each card. */
const PREVIEW_LIMIT = 500;

function preview(value: string): string {
  if (value.length <= PREVIEW_LIMIT) return value;
  return `${Array.from(value).slice(0, PREVIEW_LIMIT).join("")}…`;
}

export default function FancyTextGenerator() {
  const { track } = useTool();
  const [text, setText] = useState("");
  const source = useDeferredValue(text);
  const isSample = !source.trim();

  const results = useMemo(
    () => FANCY_STYLES.map((style) => ({ ...style, value: style.convert(isSample ? SAMPLE : source) })),
    [source, isSample],
  );

  useEffect(() => {
    if (!isSample) track();
  }, [isSample, source, track]);

  return (
    <div className="space-y-4">
      <TextInput value={text} onChange={setText} label="Your text" placeholder="Type something to see it in every style…" rows={3} />

      <Panel title={`${FANCY_STYLES.length} styles`}>
        {isSample ? <p className="mb-3 text-sm text-muted">Showing a preview. Type above to convert your own text.</p> : null}
        <ul className="divide-y divide-line">
          {results.map((style) => (
            <li key={style.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">{style.name}</p>
                <p className={cn("mt-0.5 text-lg leading-relaxed break-words whitespace-pre-wrap", isSample ? "text-muted" : "text-ink")}>
                  {preview(style.value)}
                </p>
              </div>
              <CopyButton text={isSample ? "" : style.value} label="Copy" />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
