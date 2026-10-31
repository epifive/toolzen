"use client";

import { useState } from "react";
import { Panel, Segmented, Stat, ToolColumns } from "@/components/tool-ui";
import { checkNumber, formatAmount, formatNumber } from "@/tools/lib/calc";
import { EmptyResult, NumberField, useTrackResult } from "@/tools/lib/calc-ui";
import { cagrPercent, roiPercent } from "@/tools/lib/finance";

type PeriodUnit = "years" | "months" | "days";

const UNIT_YEARS: Record<PeriodUnit, number> = { years: 1, months: 1 / 12, days: 1 / 365.25 };

/** Signed percentage, e.g. "+12.5%" or "−3%". */
function signedPercent(value: number): string {
  if (!Number.isFinite(value)) return "Too large to show";
  const text = `${formatNumber(Math.abs(value), 2)}%`;
  if (Math.abs(value) < 0.005) return text;
  return value > 0 ? `+${text}` : `−${text}`;
}

export default function RoiCalculator() {
  const [invested, setInvested] = useState("");
  const [returned, setReturned] = useState("");
  const [period, setPeriod] = useState("");
  const [unit, setUnit] = useState<PeriodUnit>("years");

  const investedCheck = checkNumber(invested, { min: 0, exclusiveMin: true, max: 1e13 });
  const returnedCheck = checkNumber(returned, { min: 0, max: 1e13 });
  const periodCheck = checkNumber(period, { min: 0, exclusiveMin: true, max: 100 / UNIT_YEARS[unit] });

  const start = investedCheck.value;
  const end = returnedCheck.value;
  const roi = start !== null && end !== null ? roiPercent(start, end) : null;
  const years = periodCheck.value === null ? null : periodCheck.value * UNIT_YEARS[unit];
  const annualized = start !== null && end !== null && years !== null ? cagrPercent(start, end, years) : null;

  useTrackResult(roi === null ? null : `${roi}-${annualized}`);

  return (
    <ToolColumns>
      <Panel title="Investment">
        <div className="space-y-4">
          <NumberField
            id="roi-invested"
            label="Amount invested"
            value={invested}
            onChange={setInvested}
            error={investedCheck.error}
            placeholder="10000"
            min={0}
          />
          <NumberField
            id="roi-returned"
            label="Amount returned (final value)"
            value={returned}
            onChange={setReturned}
            error={returnedCheck.error}
            hint="What the investment is worth now or what you sold it for, after costs."
            placeholder="14500"
            min={0}
          />
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
            <NumberField
              id="roi-period"
              label="Investment period (optional)"
              unit={unit}
              value={period}
              onChange={setPeriod}
              error={periodCheck.error}
              placeholder={unit === "years" ? "3" : unit === "months" ? "36" : "1095"}
              min={0}
            />
            <Segmented<PeriodUnit>
              label="Period unit"
              value={unit}
              onChange={setUnit}
              options={[
                { value: "years", label: "Years" },
                { value: "months", label: "Months" },
                { value: "days", label: "Days" },
              ]}
              className="sm:mt-7"
            />
          </div>
        </div>
      </Panel>

      <div className="space-y-4">
        {roi !== null && start !== null && end !== null ? (
          <>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Stat label="Return on investment (ROI)" value={signedPercent(roi)} emphasis />
              <Stat
                label="Annualized ROI (CAGR)"
                value={annualized === null ? "Add a period" : signedPercent(annualized)}
                emphasis={annualized !== null}
              />
              <Stat label={end >= start ? "Net profit" : "Net loss"} value={formatAmount(Math.abs(end - start))} />
              <Stat label="Investment multiple" value={`${formatNumber(end / start, 2)}×`} />
            </dl>
            <Panel title="Formulas">
              <ul className="space-y-1 text-sm text-ink">
                <li>ROI = (final value − amount invested) ÷ amount invested × 100</li>
                <li>Annualized ROI = (final value ÷ amount invested)^(1 ÷ years) − 1</li>
              </ul>
              <p className="mt-2 text-xs text-muted">
                Annualized ROI makes investments held for different lengths of time comparable. For periods shorter than a
                year it extrapolates the return to a full year.
              </p>
            </Panel>
          </>
        ) : (
          <EmptyResult>Enter the amount invested and the amount returned.</EmptyResult>
        )}
      </div>
    </ToolColumns>
  );
}
