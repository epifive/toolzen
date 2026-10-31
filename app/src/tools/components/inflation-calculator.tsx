"use client";

import { useMemo, useState } from "react";
import { DownloadTextButton, Panel, Stat, ToolColumns } from "@/components/tool-ui";
import { checkNumber, formatAmount, formatNumber } from "@/tools/lib/calc";
import { DataTable, EmptyResult, NumberField, useTrackResult } from "@/tools/lib/calc-ui";
import { inflationTable, toCsv } from "@/tools/lib/finance";

export default function InflationCalculator() {
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [years, setYears] = useState("");

  const amountCheck = checkNumber(amount, { min: 0, exclusiveMin: true, max: 1e12 });
  const rateCheck = checkNumber(rate, { min: -50, max: 100 });
  const yearsCheck = checkNumber(years, { min: 1, max: 100, integer: true });

  const rows = useMemo(
    () =>
      amountCheck.value !== null && rateCheck.value !== null && yearsCheck.value !== null
        ? inflationTable(amountCheck.value, rateCheck.value, yearsCheck.value)
        : null,
    [amountCheck.value, rateCheck.value, yearsCheck.value],
  );
  const last = rows?.[rows.length - 1];
  const a = amountCheck.value ?? 0;

  useTrackResult(last?.futureCost);

  return (
    <div className="space-y-4">
      <ToolColumns>
        <Panel title="Amount and inflation">
          <div className="space-y-4">
            <NumberField
              id="infl-amount"
              label="Amount today"
              value={amount}
              onChange={setAmount}
              error={amountCheck.error}
              placeholder="1000"
              min={0}
            />
            <NumberField
              id="infl-rate"
              label="Average annual inflation"
              unit="%"
              value={rate}
              onChange={setRate}
              error={rateCheck.error}
              hint="Long-run inflation in many economies is 2–6% a year."
              placeholder="4"
              min={-50}
              max={100}
              step={0.1}
            />
            <NumberField
              id="infl-years"
              label="Number of years"
              unit="yrs"
              value={years}
              onChange={setYears}
              error={yearsCheck.error}
              placeholder="10"
              min={1}
              max={100}
              step={1}
            />
          </div>
        </Panel>

        <div className="space-y-4">
          {last && yearsCheck.value !== null ? (
            <>
              <dl className="grid gap-3 sm:grid-cols-2">
                <Stat label={`Cost of the same things in ${yearsCheck.value} years`} value={formatAmount(last.futureCost)} emphasis />
                <Stat label="Future value in today's money" value={formatAmount(last.purchasingPower)} emphasis />
                <Stat label="Total price change" value={`${formatNumber((last.futureCost / a - 1) * 100, 2)}%`} />
                <Stat
                  label={last.purchasingPower > a ? "Purchasing power gained" : "Purchasing power lost"}
                  value={`${formatNumber(Math.abs(1 - last.purchasingPower / a) * 100, 2)}%`}
                />
              </dl>
              <p className="text-sm text-muted">
                What costs {formatAmount(a)} today will cost about {formatAmount(last.futureCost)} in {yearsCheck.value}{" "}
                {yearsCheck.value === 1 ? "year" : "years"}, and {formatAmount(a)} kept as cash will only buy what{" "}
                {formatAmount(last.purchasingPower)} buys today.
              </p>
            </>
          ) : (
            <EmptyResult>Enter an amount, an inflation rate and a number of years.</EmptyResult>
          )}
        </div>
      </ToolColumns>

      {rows ? (
        <Panel
          title="Year by year"
          actions={
            <DownloadTextButton
              text={toCsv(
                ["Year", "Future cost", "Purchasing power"],
                rows.map((r) => [r.year, r.futureCost, r.purchasingPower]),
              )}
              filename="inflation.csv"
              type="text/csv;charset=utf-8"
              label="Download CSV"
            />
          }
        >
          <DataTable
            caption="Future cost and purchasing power by year"
            minWidth={360}
            rows={rows}
            rowKey={(r) => r.year}
            columns={[
              { header: "Year", cell: (r) => `Year ${r.year}` },
              { header: "Future cost", cell: (r) => formatAmount(r.futureCost) },
              { header: "Purchasing power", cell: (r) => formatAmount(r.purchasingPower) },
            ]}
          />
        </Panel>
      ) : null}
    </div>
  );
}
