"use client";

import { useMemo, useState } from "react";
import { DownloadTextButton, Panel, Stat, ToolColumns } from "@/components/tool-ui";
import { checkNumber, formatAmount } from "@/tools/lib/calc";
import { BAR_TONES, DataTable, EmptyResult, NumberField, SplitBar, useTrackResult } from "@/tools/lib/calc-ui";
import { sipGrowth, toCsv, type SipResult } from "@/tools/lib/finance";

function sipCsv(result: SipResult): string {
  return toCsv(
    ["Year", "Monthly SIP", "Total invested", "Value", "Gain"],
    result.years.map((y) => [y.year, y.monthlyAmount, y.invested, y.value, y.value - y.invested]),
  );
}

export default function SipCalculator() {
  const [monthly, setMonthly] = useState("");
  const [rate, setRate] = useState("");
  const [years, setYears] = useState("");
  const [stepUp, setStepUp] = useState("");

  const monthlyCheck = checkNumber(monthly, { min: 0, exclusiveMin: true, max: 1e10 });
  const rateCheck = checkNumber(rate, { min: 0, max: 50 });
  const yearsCheck = checkNumber(years, { min: 1, max: 50, integer: true });
  const stepUpCheck = checkNumber(stepUp, { min: 0, max: 100 });
  const stepUpValue = stepUp.trim() ? stepUpCheck.value : 0;

  const result = useMemo(
    () =>
      monthlyCheck.value !== null && rateCheck.value !== null && yearsCheck.value !== null && stepUpValue !== null
        ? sipGrowth(monthlyCheck.value, rateCheck.value, yearsCheck.value, stepUpValue)
        : null,
    [monthlyCheck.value, rateCheck.value, yearsCheck.value, stepUpValue],
  );

  useTrackResult(result?.futureValue);

  return (
    <div className="space-y-4">
      <ToolColumns>
        <Panel title="SIP details">
          <div className="space-y-4">
            <NumberField
              id="sip-amount"
              label="Monthly investment"
              value={monthly}
              onChange={setMonthly}
              error={monthlyCheck.error}
              placeholder="5000"
              min={0}
            />
            <NumberField
              id="sip-rate"
              label="Expected annual return"
              unit="%"
              value={rate}
              onChange={setRate}
              error={rateCheck.error}
              placeholder="12"
              min={0}
              max={50}
              step={0.5}
            />
            <NumberField
              id="sip-years"
              label="Investment period"
              unit="yrs"
              value={years}
              onChange={setYears}
              error={yearsCheck.error}
              placeholder="10"
              min={1}
              max={50}
              step={1}
            />
            <NumberField
              id="sip-stepup"
              label="Annual step-up (optional)"
              unit="%"
              value={stepUp}
              onChange={setStepUp}
              error={stepUpCheck.error}
              hint="Increase the monthly amount by this percentage every year, e.g. in line with your salary."
              placeholder="0"
              min={0}
              max={100}
            />
          </div>
        </Panel>

        <div className="space-y-4">
          {result ? (
            <>
              <dl className="grid gap-3 sm:grid-cols-3">
                <Stat label="Total value" value={formatAmount(result.futureValue)} emphasis />
                <Stat label="Invested amount" value={formatAmount(result.invested)} />
                <Stat label="Estimated returns" value={formatAmount(result.returns)} />
              </dl>
              <Panel title="Invested vs returns">
                <SplitBar
                  segments={[
                    { label: "Invested", value: result.invested, tone: BAR_TONES[0] },
                    { label: "Returns", value: result.returns, tone: BAR_TONES[1] },
                  ]}
                />
              </Panel>
              <p className="text-xs text-muted">
                Assumes each instalment is invested at the start of the month and returns compound monthly. Actual mutual
                fund returns vary and are not guaranteed.
              </p>
            </>
          ) : (
            <EmptyResult>Enter the monthly amount, expected return and period.</EmptyResult>
          )}
        </div>
      </ToolColumns>

      {result ? (
        <Panel
          title="Year by year"
          actions={
            <DownloadTextButton text={sipCsv(result)} filename="sip-plan.csv" type="text/csv;charset=utf-8" label="Download CSV" />
          }
        >
          <DataTable
            caption="SIP value at the end of each year"
            minWidth={520}
            rows={result.years}
            rowKey={(y) => y.year}
            columns={[
              { header: "Year", cell: (y) => `Year ${y.year}` },
              { header: "Monthly SIP", cell: (y) => formatAmount(y.monthlyAmount) },
              { header: "Total invested", cell: (y) => formatAmount(y.invested) },
              { header: "Gain", cell: (y) => formatAmount(y.value - y.invested) },
              { header: "Value", cell: (y) => <span className="font-medium">{formatAmount(y.value)}</span> },
            ]}
          />
        </Panel>
      ) : null}
    </div>
  );
}
