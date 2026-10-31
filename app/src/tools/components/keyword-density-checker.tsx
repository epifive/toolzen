"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Highlighter } from "lucide-react";
import { Panel, RangeField, Segmented, Stat, StatGrid, TextInput } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import { Field, Select, Switch } from "@/components/ui/field";
import { useTool } from "@/tools/context";
import { phraseFrequency, phraseRanges, tokenize, type PhraseStat } from "@/tools/lib/seo";

type Tab = "1" | "2" | "3" | "highlight";

const LIMIT = 20;

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "1", label: "Keywords" },
  { value: "2", label: "2-word phrases" },
  { value: "3", label: "3-word phrases" },
  { value: "highlight", label: "Highlight" },
];

function formatPercent(value: number): string {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

function PhraseTable({ rows, onHighlight }: { rows: PhraseStat[]; onHighlight: (phrase: string) => void }) {
  if (!rows.length) {
    return <p className="py-6 text-center text-sm text-muted">No phrase appears more than once with the current filters.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th scope="col" className="w-10 py-2 pr-2 font-medium">
              #
            </th>
            <th scope="col" className="py-2 pr-2 font-medium">
              Phrase
            </th>
            <th scope="col" className="py-2 pr-2 text-right font-medium">
              Count
            </th>
            <th scope="col" className="py-2 pr-2 text-right font-medium">
              Density
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.phrase} className="border-b border-line last:border-0">
              <td className="py-2 pr-2 text-muted tabular-nums">{i + 1}</td>
              <td className="py-2 pr-2 font-medium break-words text-ink">{row.phrase}</td>
              <td className="py-2 pr-2 text-right tabular-nums">{row.count.toLocaleString()}</td>
              <td className="py-2 pr-2 text-right tabular-nums">{formatPercent(row.density)}</td>
              <td className="py-1 text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onHighlight(row.phrase)}
                  aria-label={`Highlight “${row.phrase}” in the text`}
                >
                  <Highlighter aria-hidden />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function KeywordDensityChecker() {
  const { track } = useTool();
  const [text, setText] = useState("");
  const [ignoreStopWords, setIgnoreStopWords] = useState(true);
  const [minLength, setMinLength] = useState(3);
  const [tab, setTab] = useState<Tab>("1");
  const [highlight, setHighlight] = useState("");

  const tokens = useMemo(() => tokenize(text), [text]);
  const tables = useMemo(() => {
    const options = { ignoreStopWords, minLength, limit: LIMIT };
    return {
      "1": phraseFrequency(tokens, { ...options, size: 1 }),
      "2": phraseFrequency(tokens, { ...options, size: 2 }),
      "3": phraseFrequency(tokens, { ...options, size: 3 }),
    };
  }, [tokens, ignoreStopWords, minLength]);

  const uniqueWords = useMemo(() => new Set(tokens.map((t) => t.word)).size, [tokens]);
  const phraseChoices = [...tables["1"], ...tables["2"], ...tables["3"]].map((r) => r.phrase);
  const activePhrase = phraseChoices.includes(highlight) ? highlight : (phraseChoices[0] ?? "");

  const highlighted = useMemo(() => {
    if (!activePhrase) return { nodes: [text] as ReactNode[], count: 0 };
    const nodes: ReactNode[] = [];
    let cursor = 0;
    let count = 0;
    for (const [start, end] of phraseRanges(tokens, activePhrase)) {
      if (start < cursor) continue; // Skip overlapping matches such as "a a" inside "a a a".
      nodes.push(text.slice(cursor, start));
      nodes.push(
        <mark key={start} className="rounded-sm bg-marker px-0.5 text-[#18201d]">
          {text.slice(start, end)}
        </mark>,
      );
      cursor = end;
      count++;
    }
    nodes.push(text.slice(cursor));
    return { nodes, count };
  }, [activePhrase, text, tokens]);

  useEffect(() => {
    if (tokens.length) track();
  }, [tokens, track]);

  function showHighlight(phrase: string) {
    setHighlight(phrase);
    setTab("highlight");
  }

  return (
    <div className="space-y-4">
      <TextInput
        value={text}
        onChange={setText}
        label="Your content"
        placeholder="Paste your article or page copy here…"
        rows={10}
      />

      <Panel title="Filters">
        <div className="grid gap-4 sm:grid-cols-2 sm:items-center">
          <Switch
            label="Ignore stop words"
            description="Skips common English words such as “the”, “and” and “of”."
            checked={ignoreStopWords}
            onChange={(e) => setIgnoreStopWords(e.target.checked)}
          />
          <RangeField
            label="Minimum word length"
            value={minLength}
            min={1}
            max={10}
            onChange={setMinLength}
            format={(v) => `${v} letters`}
          />
        </div>
      </Panel>

      <StatGrid>
        <Stat label="Total words" value={tokens.length.toLocaleString()} emphasis />
        <Stat label="Unique words" value={uniqueWords.toLocaleString()} />
        <Stat
          label="Top keyword"
          value={tables["1"][0] ? `${tables["1"][0].phrase} (${formatPercent(tables["1"][0].density)})` : "–"}
        />
      </StatGrid>

      {tokens.length ? (
        <Panel title="Results">
          <Segmented label="Result view" value={tab} onChange={setTab} options={TABS} className="mb-4" />
          {tab === "highlight" ? (
            <div className="space-y-3">
              <Field
                label="Phrase to highlight"
                htmlFor="kd-phrase"
                hint={`${highlighted.count.toLocaleString()} occurrence${highlighted.count === 1 ? "" : "s"} highlighted`}
              >
                <Select
                  id="kd-phrase"
                  value={activePhrase}
                  onChange={(e) => setHighlight(e.target.value)}
                  className="sm:max-w-sm"
                >
                  {phraseChoices.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-line bg-paper px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words text-ink">
                {highlighted.nodes}
              </div>
            </div>
          ) : (
            <>
              <PhraseTable rows={tables[tab]} onHighlight={showHighlight} />
              <p className="mt-3 text-xs text-muted">
                Showing the top {LIMIT}. Density = occurrences × words in the phrase ÷ total words.
                {tab !== "1" ? " Phrases are counted within a sentence and must appear at least twice." : null}
              </p>
            </>
          )}
        </Panel>
      ) : null}
    </div>
  );
}
