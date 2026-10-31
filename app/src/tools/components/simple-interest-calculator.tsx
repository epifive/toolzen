"use client";

import { useState } from "react";
import { Panel, Segmented, Stat, ToolColumns } from "@/components/tool-ui";
import { checkNumber, formatAmount, formatNumber } from "@/tools/lib/calc";
import { BAR_TONES, EmptyResult, NumberField, SplitBar, useTrackResult } from "@/tools/lib/calc-ui";
import { fdMaturity, simpleInterest } from "@/tools/lib/finance";

type TimeUnit = "years" | "months" | "days";

const UNIT_YEARS: Record<TimeUnit, number> = { years: 1, months: 1 / 12, days: 1 / 365 };
const MAX_YEARS = 100;

export default function SimpleInterestCalculator() {
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [time, setTime] = useState("");
  const [unit, setUnit] = useState<TimeUnit>("years");

  const principalCheck = checkNumber(principal, { min: 0, exclusiveMin: true, max: 1e12 });
  const rateCheck = checkNumber(rate, { min: 0, max: 100 });
  const timeCheck = checkNumber(time, { min: 0, exclusiveMin: true, max: MAX_YEARS / UNIT_YEARS[unit] });

  const years = timeCheck.value === null ? null : timeCheck.value * UNIT_YEARS[unit];
  const p = principalCheck.value;
  const r = rateCheck.value;
  const interest = p !== null && r !== null && years !== null ? simpleInterest(p, r, years) : null;
  const compound = p !== null && r !== null && years !== null ? fdMaturity(p, r, years, 1) - p : null;

  useTrackResult(interest);

  return (
    <ToolColumns>
      <Panel title="Loan or deposit">
        <div className="space-y-4">
          <NumberField
            id="si-principal"
            label="Principal amount"
            value={principal}
            onChange={setPrincipal}
            error={principalCheck.error}
            placeholder="5000"
            min={0}
          />
          <NumberField
            id="si-rate"
            label="Annual interest rate"
            unit="%"
            value={rate}
            onChange={setRate}
            error={rateCheck.error}
            placeholder="6"
            min={0}
            max={100}
            step={0.1}
          />
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
            <NumberField
              id="si-time"
              label="Time period"
              unit={unit}
              value={time}
              onChange={setTime}
              error={timeCheck.error}
              placeholder={unit === "years" ? "3" : unit === "months" ? "36" : "1095"}
              min={0}
            />
            <Segmented<TimeUnit>
              label="Time unit"
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
          <p className="text-xs text-muted">Days are counted on a 365-day year.</p>
        </div>
      </Panel>

      <div className="space-y-4">
        {interest !== null && p !== null && r !== null && years !== null ? (
          <>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Stat label="Simple interest" value={formatAmount(interest)} emphasis />
              <Stat label="Total amount" value={formatAmount(p + interest)} emphasis />
            </dl>
            <Panel title="Principal vs interest">
              <SplitBar
                segments={[
                  { label: "Principal", value: p, tone: BAR_TONES[0] },
                  { label: "Interest", value: interest, tone: BAR_TONES[1] },
                ]}
              />
            </Panel>
            <Panel title="How it was calculated">
              <p className="text-sm break-words text-ink tabular-nums">
                I = P × r × t = {formatAmount(p)} × {formatNumber(r, 4)}% × {formatNumber(years, 4)} years ={" "}
                <strong>{formatAmount(interest)}</strong>
              </p>
              {compound !== null ? (
                <p className="mt-2 text-sm text-muted">
                  With yearly compound interest over the same period you would earn {formatAmount(compound)}, which is{" "}
                  {formatAmount(Math.abs(compound - interest))} {compound >= interest ? "more" : "less"}.
                </p>
              ) : null}
            </Panel>
          </>
        ) : (
          <EmptyResult>Enter the principal, interest rate and time period.</EmptyResult>
        )}
      </div>
    </ToolColumns>
  );
}
