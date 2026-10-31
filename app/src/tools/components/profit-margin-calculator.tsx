"use client";

import { useState } from "react";
import { Panel, Segmented, Stat, ToolColumns } from "@/components/tool-ui";
import { checkNumber, formatAmount, formatNumber, type CheckedNumber } from "@/tools/lib/calc";
import { EmptyResult, NumberField, useTrackResult } from "@/tools/lib/calc-ui";
import { marginFromPrices, priceForMargin, priceForMarkup, type MarginResult } from "@/tools/lib/finance";

type Mode = "prices" | "margin" | "markup";

const SECOND_INPUT: Record<Mode, { label: string; unit?: string; placeholder: string }> = {
  prices: { label: "Revenue (selling price)", placeholder: "75" },
  margin: { label: "Target profit margin", unit: "%", placeholder: "40" },
  markup: { label: "Target markup", unit: "%", placeholder: "50" },
};

function percent(value: number | null): string {
  return value === null ? "–" : `${formatNumber(value, 2)}%`;
}

function checkSecond(mode: Mode, input: string): CheckedNumber {
  if (mode === "prices") return checkNumber(input, { min: 0, max: 1e12 });
  if (mode === "markup") return checkNumber(input, { min: 0, max: 100_000 });
  const check = checkNumber(input, { min: 0, max: 100 });
  // A 100% margin would need an infinite price.
  return check.value === 100 ? { value: null, error: "A margin must be below 100%." } : check;
}

export default function ProfitMarginCalculator() {
  const [mode, setMode] = useState<Mode>("prices");
  const [cost, setCost] = useState("");
  const [second, setSecond] = useState("");

  const costCheck = checkNumber(cost, { min: 0, max: 1e12 });
  const secondCheck = checkSecond(mode, second);
  const c = costCheck.value;
  const s = secondCheck.value;

  let result: MarginResult | null = null;
  if (c !== null && s !== null) {
    if (mode === "prices") result = marginFromPrices(c, s);
    else if (mode === "margin") result = priceForMargin(c, s);
    else result = priceForMarkup(c, s);
  }

  useTrackResult(result ? `${mode}-${result.revenue}-${result.cost}` : null);

  const input = SECOND_INPUT[mode];

  return (
    <ToolColumns>
      <Panel title="Calculate">
        <div className="space-y-4">
          <Segmented<Mode>
            label="What do you know?"
            value={mode}
            onChange={(next) => {
              setMode(next);
              setSecond("");
            }}
            options={[
              { value: "prices", label: "Cost & revenue" },
              { value: "margin", label: "Price from margin" },
              { value: "markup", label: "Price from markup" },
            ]}
          />
          <NumberField
            id="pm-cost"
            label="Cost"
            value={cost}
            onChange={setCost}
            error={costCheck.error}
            hint="What the product costs you to make or buy."
            placeholder="45"
            min={0}
          />
          <NumberField
            id="pm-second"
            label={input.label}
            unit={input.unit}
            value={second}
            onChange={setSecond}
            error={secondCheck.error}
            placeholder={input.placeholder}
            min={0}
            max={mode === "margin" ? 99.99 : undefined}
          />
        </div>
      </Panel>

      <div className="space-y-4">
        {result ? (
          <>
            <dl className="grid gap-3 sm:grid-cols-2">
              {mode === "prices" ? (
                <>
                  <Stat label="Gross profit margin" value={percent(result.marginPercent)} emphasis />
                  <Stat label={result.profit >= 0 ? "Gross profit" : "Loss"} value={formatAmount(Math.abs(result.profit))} emphasis />
                </>
              ) : (
                <>
                  <Stat label="Selling price" value={formatAmount(result.revenue)} emphasis />
                  <Stat label="Profit per unit" value={formatAmount(result.profit)} emphasis />
                </>
              )}
              <Stat label="Markup" value={percent(result.markupPercent)} />
              {mode === "prices" ? (
                <Stat label="Revenue" value={formatAmount(result.revenue)} />
              ) : (
                <Stat label="Margin" value={percent(result.marginPercent)} />
              )}
            </dl>
            <Panel title="Margin vs markup">
              <ul className="space-y-1 text-sm text-ink">
                <li>Gross profit = revenue − cost</li>
                <li>Margin = gross profit ÷ revenue × 100</li>
                <li>Markup = gross profit ÷ cost × 100</li>
              </ul>
              <p className="mt-2 text-xs text-muted">
                Margin is measured against the selling price and markup against the cost, so the same sale always has a
                higher markup than margin.
              </p>
            </Panel>
          </>
        ) : (
          <EmptyResult>Enter the cost and {mode === "prices" ? "the revenue" : `a target ${mode}`}.</EmptyResult>
        )}
      </div>
    </ToolColumns>
  );
}
