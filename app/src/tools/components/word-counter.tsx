"use client";

import { useEffect, useMemo, useState } from "react";
import { Panel, Stat, StatGrid, TextInput } from "@/components/tool-ui";
import { useTool } from "@/tools/context";

const READ_WPM = 238;
const SPEAK_WPM = 140;

function minutes(words: number, wpm: number): string {
  if (!words) return "0 sec";
  const totalSeconds = Math.max(1, Math.round((words / wpm) * 60));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m ? `${m} min${s ? ` ${s} sec` : ""}` : `${s} sec`;
}

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "word" }) : null;

function countWords(text: string): string[] {
  if (segmenter) {
    return Array.from(segmenter.segment(text))
      .filter((s) => s.isWordLike)
      .map((s) => s.segment);
  }
  return text.split(/\s+/).filter(Boolean);
}

export default function WordCounter() {
  const { track } = useTool();
  const [text, setText] = useState("");

  const stats = useMemo(() => {
    const words = countWords(text);
    const trimmed = text.trim();
    return {
      words: words.length,
      characters: [...text].length,
      charactersNoSpaces: [...text.replace(/\s/g, "")].length,
      sentences: trimmed ? (trimmed.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) ?? []).length : 0,
      paragraphs: trimmed ? trimmed.split(/\n\s*\n/).filter((p) => p.trim()).length : 0,
      lines: text ? text.split("\n").length : 0,
      topWords: Object.entries(
        words.reduce<Record<string, number>>((acc, w) => {
          const k = w.toLowerCase();
          if (k.length > 2) acc[k] = (acc[k] ?? 0) + 1;
          return acc;
        }, {}),
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8),
    };
  }, [text]);

  useEffect(() => {
    if (stats.words > 0) track();
  }, [stats.words, track]);

  return (
    <div className="space-y-4">
      <TextInput value={text} onChange={setText} label="Your text" placeholder="Start typing or paste your text here…" rows={12} />

      <StatGrid>
        <Stat label="Words" value={stats.words.toLocaleString()} emphasis />
        <Stat label="Characters" value={stats.characters.toLocaleString()} emphasis />
        <Stat label="Characters without spaces" value={stats.charactersNoSpaces.toLocaleString()} />
        <Stat label="Sentences" value={stats.sentences.toLocaleString()} />
        <Stat label="Paragraphs" value={stats.paragraphs.toLocaleString()} />
        <Stat label="Lines" value={stats.lines.toLocaleString()} />
        <Stat label="Reading time" value={minutes(stats.words, READ_WPM)} />
        <Stat label="Speaking time" value={minutes(stats.words, SPEAK_WPM)} />
      </StatGrid>

      {stats.topWords.length ? (
        <Panel title="Most frequent words">
          <ul className="flex flex-wrap gap-2">
            {stats.topWords.map(([word, count]) => (
              <li key={word} className="rounded-full border border-line px-3 py-1 text-sm">
                {word} <span className="tabular-nums text-muted">× {count}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
