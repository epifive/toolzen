"use client";

import { useMemo, useState } from "react";
import { CopyButton, Panel, Stat, StatGrid, TextInput } from "@/components/tool-ui";
import { Alert } from "@/components/ui/alert";
import { formatSignificant } from "@/tools/lib/calc";
import { useTrackResult } from "@/tools/lib/calc-ui";
import { parseNumberList, summarize } from "@/tools/lib/stats";

const MAX_VALUES = 100_000;
const SHOWN_INVALID = 5;

const fmt = (value: number) => formatSignificant(value, 10);

export default function AverageCalculator() {
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseNumberList(text), [text]);
  const tooMany = parsed.values.length > MAX_VALUES;
  const summary = useMemo(
    () => (parsed.values.length && !tooMany ? summarize(parsed.values) : null),
    [parsed.values, tooMany],
  );

  useTrackResult(summary ? `${summary.count}-${summary.sum}` : null);

  const modeText = !summary
    ? ""
    : summary.modes.length === 0
      ? "None (no value repeats more often)"
      : summary.modes.length > 10
        ? `${summary.modes.length} values (each ${summary.modeCount}×)`
        : `${summary.modes.map(fmt).join(", ")}${summary.modeCount > 1 ? ` (${summary.modeCount}×)` : ""}`;

  return (
    <div className="space-y-4">
      <TextInput
        label="Numbers"
        value={text}
        onChange={setText}
        rows={6}
        placeholder="Paste or type numbers separated by commas, spaces or new lines, e.g. 4, 8, 15, 16, 23, 42"
      />

      {parsed.invalid.length ? (
        <Alert tone="warning" title={`${parsed.invalid.length} ${parsed.invalid.length === 1 ? "entry was" : "entries were"} ignored`}>
          Not a number: {parsed.invalid.slice(0, SHOWN_INVALID).map((t) => `“${t}”`).join(", ")}
          {parsed.invalid.length > SHOWN_INVALID ? " …" : ""}. Use a dot as the decimal separator.
        </Alert>
      ) : null}
      {tooMany ? (
        <Alert tone="error">Enter at most {MAX_VALUES.toLocaleString()} numbers.</Alert>
      ) : null}

      {summary ? (
        <>
          <StatGrid className="lg:grid-cols-4">
            <Stat label="Mean (average)" value={fmt(summary.mean)} emphasis />
            <Stat label="Median" value={fmt(summary.median)} emphasis />
            <Stat label="Count" value={fmt(summary.count)} />
            <Stat label="Sum" value={fmt(summary.sum)} />
            <Stat label="Minimum" value={fmt(summary.min)} />
            <Stat label="Maximum" value={fmt(summary.max)} />
            <Stat label="Range" value={fmt(summary.range)} />
            <Stat label="Geometric mean" value={summary.geometricMean === null ? "Positive values only" : fmt(summary.geometricMean)} />
            <Stat label="Standard deviation (population)" value={fmt(summary.populationSd)} />
            <Stat label="Standard deviation (sample)" value={summary.sampleSd === null ? "Needs 2+ values" : fmt(summary.sampleSd)} />
            <Stat label="Variance (population)" value={fmt(summary.populationVariance)} />
            <Stat label="Variance (sample)" value={summary.sampleVariance === null ? "Needs 2+ values" : fmt(summary.sampleVariance)} />
          </StatGrid>
          <dl>
            <Stat label="Mode" value={<span className="text-base break-words">{modeText}</span>} />
          </dl>
          <Panel title="Sorted values" actions={<CopyButton text={summary.sorted.join(", ")} />}>
            <p className="max-h-48 overflow-y-auto font-mono text-[13px] break-words text-ink">
              {summary.sorted.map(fmt).join(", ")}
            </p>
          </Panel>
          <p className="text-xs text-muted">
            Use the population standard deviation when your numbers are the whole group, and the sample standard deviation
            (divided by n − 1) when they are a sample from a larger group.
          </p>
        </>
      ) : null}
    </div>
  );
}
