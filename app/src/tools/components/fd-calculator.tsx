"use client";

import { useState } from "react";
import { Panel, Stat, ToolColumns } from "@/components/tool-ui";
import { Field, Select } from "@/components/ui/field";
import { addDays, addMonths, checkNumber, formatAmount, formatLongDate, formatNumber, parseIsoDate, todayIso } from "@/tools/lib/calc";
import { BAR_TONES, EmptyResult, NumberField, SplitBar, useTrackResult } from "@/tools/lib/calc-ui";
import { effectiveAnnualRate, fdMaturity, type FdCompounding } from "@/tools/lib/finance";

const COMPOUNDING: Array<{ value: FdCompounding; label: string }> = [
  { value: 4, label: "Quarterly (most banks)" },
  { value: 12, label: "Monthly" },
  { value: 2, label: "Half-yearly" },
  { value: 1, label: "Yearly" },
  { value: "simple", label: "Simple interest (no compounding)" },
];

const MAX_YEARS = 30;

export default function FdCalculator() {
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [years, setYears] = useState("");
  const [months, setMonths] = useState("");
  const [days, setDays] = useState("");
  const [compounding, setCompounding] = useState<FdCompounding>(4);
  const [today] = useState(todayIso);

  const principalCheck = checkNumber(principal, { min: 0, exclusiveMin: true, max: 1e12 });
  const rateCheck = checkNumber(rate, { min: 0, max: 50 });
  const yearsCheck = checkNumber(years, { min: 0, max: MAX_YEARS, integer: true });
  const monthsCheck = checkNumber(months, { min: 0, max: 11, integer: true });
  const daysCheck = checkNumber(days, { min: 0, max: 365, integer: true });

  const tenureValid = !yearsCheck.error && !monthsCheck.error && !daysCheck.error;
  const y = yearsCheck.value ?? 0;
  const m = monthsCheck.value ?? 0;
  const d = daysCheck.value ?? 0;
  const tenureYears = y + m / 12 + d / 365;
  const tenureEntered = Boolean(years.trim() || months.trim() || days.trim());
  const tenureError = tenureEntered && tenureValid && tenureYears === 0 ? "Enter a tenure longer than zero." : "";

  const p = principalCheck.value;
  const r = rateCheck.value;
  const ready = p !== null && r !== null && tenureValid && tenureYears > 0;
  const maturity = ready ? fdMaturity(p, r, tenureYears, compounding) : null;
  const start = parseIsoDate(today);
  const maturityDate = start ? addDays(addMonths(start, y * 12 + m), d) : null;

  useTrackResult(maturity);

  return (
    <ToolColumns>
      <Panel title="Deposit details">
        <div className="space-y-4">
          <NumberField
            id="fd-principal"
            label="Deposit amount"
            value={principal}
            onChange={setPrincipal}
            error={principalCheck.error}
            placeholder="100000"
            min={0}
          />
          <NumberField
            id="fd-rate"
            label="Annual interest rate"
            unit="%"
            value={rate}
            onChange={setRate}
            error={rateCheck.error}
            placeholder="7"
            min={0}
            max={50}
            step={0.05}
          />
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink">Tenure</legend>
            <div className="grid grid-cols-3 gap-2">
              <NumberField id="fd-years" label="Years" value={years} onChange={setYears} error={yearsCheck.error} placeholder="5" min={0} step={1} />
              <NumberField
                id="fd-months"
                label="Months"
                value={months}
                onChange={setMonths}
                error={monthsCheck.error}
                placeholder="0"
                min={0}
                max={11}
                step={1}
              />
              <NumberField id="fd-days" label="Days" value={days} onChange={setDays} error={daysCheck.error} placeholder="0" min={0} step={1} />
            </div>
            {tenureError ? <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{tenureError}</p> : null}
          </fieldset>
          <Field label="Interest compounding" htmlFor="fd-compounding">
            <Select
              id="fd-compounding"
              value={String(compounding)}
              onChange={(e) => setCompounding(e.target.value === "simple" ? "simple" : (Number(e.target.value) as FdCompounding))}
            >
              {COMPOUNDING.map((o) => (
                <option key={o.value} value={String(o.value)}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Panel>

      <div className="space-y-4">
        {maturity !== null && p !== null && r !== null ? (
          <>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Stat label="Maturity amount" value={formatAmount(maturity)} emphasis />
              <Stat label="Interest earned" value={formatAmount(maturity - p)} emphasis />
              <Stat
                label="Effective annual yield"
                value={`${formatNumber(compounding === "simple" ? r : effectiveAnnualRate(r, compounding), 2)}%`}
              />
              <Stat label="Matures on (if opened today)" value={maturityDate ? formatLongDate(maturityDate) : "–"} />
            </dl>
            <Panel title="Deposit vs interest">
              <SplitBar
                segments={[
                  { label: "Deposit", value: p, tone: BAR_TONES[0] },
                  { label: "Interest", value: maturity - p, tone: BAR_TONES[1] },
                ]}
              />
            </Panel>
            <p className="text-xs text-muted">
              {compounding === "simple"
                ? "Maturity = P × (1 + r × t)."
                : "Maturity = P × (1 + r ÷ n)^(n × t), where n is the number of compounding periods per year."}{" "}
              Banks may round interest or count days slightly differently, and tax deducted at source is not included.
            </p>
          </>
        ) : (
          <EmptyResult>Enter the deposit amount, interest rate and tenure.</EmptyResult>
        )}
      </div>
    </ToolColumns>
  );
}
