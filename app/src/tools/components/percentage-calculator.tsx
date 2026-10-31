"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Panel, Segmented } from "@/components/tool-ui";
import { useTool } from "@/tools/context";
import { applyPercent, checkNumber, formatNumber, percentChange, percentOf, percentageOf } from "@/tools/lib/calc";
import { NumberField } from "@/tools/lib/calc-ui";

const DECIMALS = 4;

/** One calculator card: inputs on top, the answer and how it was worked out below. */
function CalculatorCard({ title, children, result }: { title: string; children: ReactNode; result: Answer | null }) {
  return (
    <Panel title={title}>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
      <div className="mt-4 rounded-lg border border-primary-line bg-primary-soft px-4 py-3" aria-live="polite">
        <p className="text-xs text-muted">Answer</p>
        <p className="mt-0.5 font-display text-2xl font-semibold break-words text-ink tabular-nums">{result?.answer ?? "–"}</p>
        {result ? <p className="mt-1 text-sm break-words text-muted">{result.explanation}</p> : null}
      </div>
    </Panel>
  );
}

interface Answer {
  answer: string;
  explanation: string;
}

const n = (value: number) => formatNumber(value, DECIMALS);

/** Runs `calculate` once both inputs hold valid numbers. */
function withBoth(x: number | null, y: number | null, calculate: (x: number, y: number) => Answer | null): Answer | null {
  return x === null || y === null ? null : calculate(x, y);
}

function usePair() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  return { a, setA, b, setB, x: checkNumber(a), y: checkNumber(b) };
}

export default function PercentageCalculator() {
  const { track } = useTool();
  const of = usePair();
  const what = usePair();
  const change = usePair();
  const adjust = usePair();
  const [direction, setDirection] = useState<"increase" | "decrease">("increase");

  const ofAnswer = withBoth(of.x.value, of.y.value, (x, y) => {
    const r = percentOf(x, y);
    return { answer: n(r), explanation: `${n(x)}% of ${n(y)} = ${n(r)}` };
  });

  const whatAnswer = withBoth(what.x.value, what.y.value, (x, y) => {
    const r = percentageOf(x, y);
    return r === null ? null : { answer: `${n(r)}%`, explanation: `${n(x)} ÷ ${n(y)} × 100 = ${n(r)}%` };
  });
  const whatError = what.y.value === 0 ? "The total can't be zero." : what.y.error;

  const changeAnswer = withBoth(change.x.value, change.y.value, (x, y) => {
    const r = percentChange(x, y);
    if (r === null) return null;
    return {
      answer: r === 0 ? "No change" : `${n(Math.abs(r))}% ${r > 0 ? "increase" : "decrease"}`,
      explanation: `(${n(y)} − ${n(x)}) ÷ |${n(x)}| × 100 = ${n(r)}%`,
    };
  });
  const changeError = change.x.value === 0 ? "The starting value can't be zero." : change.x.error;

  const adjustAnswer = withBoth(adjust.x.value, adjust.y.value, (x, y) => {
    const r = applyPercent(x, y, direction);
    return {
      answer: n(r),
      explanation: `${n(x)} ${direction === "increase" ? "+" : "−"} ${n(y)}% = ${n(r)} (a difference of ${n(Math.abs(r - x))})`,
    };
  });

  const results = [ofAnswer, whatAnswer, changeAnswer, adjustAnswer];
  const hasAnswer = results.some(Boolean);
  const answerKey = results.map((r) => r?.answer ?? "").join("|");
  useEffect(() => {
    if (hasAnswer) track();
  }, [hasAnswer, answerKey, track]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CalculatorCard title="What is X% of Y?" result={ofAnswer}>
        <NumberField
          id="pc-of-x"
          label="Percentage"
          unit="%"
          value={of.a}
          onChange={of.setA}
          error={of.x.error}
          placeholder="15"
        />
        <NumberField id="pc-of-y" label="Of value" value={of.b} onChange={of.setB} error={of.y.error} placeholder="200" />
      </CalculatorCard>

      <CalculatorCard title="X is what percent of Y?" result={whatAnswer}>
        <NumberField id="pc-what-x" label="Value" value={what.a} onChange={what.setA} error={what.x.error} placeholder="30" />
        <NumberField id="pc-what-y" label="Total" value={what.b} onChange={what.setB} error={whatError} placeholder="200" />
      </CalculatorCard>

      <CalculatorCard title="Percentage change from X to Y" result={changeAnswer}>
        <NumberField id="pc-change-x" label="From" value={change.a} onChange={change.setA} error={changeError} placeholder="80" />
        <NumberField
          id="pc-change-y"
          label="To"
          value={change.b}
          onChange={change.setB}
          error={change.y.error}
          placeholder="100"
        />
      </CalculatorCard>

      <CalculatorCard title={`X ${direction === "increase" ? "increased" : "decreased"} by Y%`} result={adjustAnswer}>
        <div className="sm:col-span-2">
          <Segmented
            label="Increase or decrease"
            value={direction}
            onChange={setDirection}
            options={[
              { value: "increase", label: "Increase" },
              { value: "decrease", label: "Decrease" },
            ]}
          />
        </div>
        <NumberField
          id="pc-adjust-x"
          label="Value"
          value={adjust.a}
          onChange={adjust.setA}
          error={adjust.x.error}
          placeholder="250"
        />
        <NumberField
          id="pc-adjust-y"
          label="By"
          unit="%"
          value={adjust.b}
          onChange={adjust.setB}
          error={adjust.y.error}
          placeholder="20"
        />
      </CalculatorCard>
    </div>
  );
}
