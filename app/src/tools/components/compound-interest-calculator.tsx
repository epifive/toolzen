"use client";

import { useMemo, useState } from "react";
import { DownloadTextButton, Panel, Stat, ToolColumns } from "@/components/tool-ui";
import { Field, Select } from "@/components/ui/field";
import { checkNumber, formatAmount } from "@/tools/lib/calc";
import { BAR_TONES, DataTable, EmptyResult, NumberField, SplitBar, useTrackResult } from "@/tools/lib/calc-ui";
import { COMPOUNDING_OPTIONS, compoundGrowth, toCsv, type GrowthResult } from "@/tools/lib/finance";

function growthCsv(result: GrowthResult): string {
  return toCsv(
    ["Year", "Deposits", "Interest", "Total deposits", "Total interest", "Balance"],
    result.years.map((y) => [y.year, y.deposits, y.interest, y.totalDeposits, y.totalInterest, y.balance]),
  );
}

export default function CompoundInterestCalculator() {
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [years, setYears] = useState("");
  const [perYear, setPerYear] = useState(12);
  const [contribution, setContribution] = useState("");

  const principalCheck = checkNumber(principal, { min: 0, max: 1e12 });
  const rateCheck = checkNumber(rate, { min: 0, max: 100 });
  const yearsCheck = checkNumber(years, { min: 1, max: 100, integer: true });
  const contributionCheck = checkNumber(contribution, { min: 0, max: 1e10 });
  const monthly = contribution.trim() ? contributionCheck.value : 0;

  const result = useMemo(() => {
    if (principalCheck.value === null || rateCheck.value === null || yearsCheck.value === null || monthly === null) return null;
    if (principalCheck.value === 0 && monthly === 0) return null;
    return compoundGrowth(principalCheck.value, rateCheck.value, yearsCheck.value, perYear, monthly);
  }, [principalCheck.value, rateCheck.value, yearsCheck.value, perYear, monthly]);

  useTrackResult(result?.futureValue);

  const maxBalance = result ? Math.max(...result.years.map((y) => y.balance)) : 0;
  const nothingToGrow = principalCheck.value === 0 && monthly === 0;

  return (
    <div className="space-y-4">
      <ToolColumns>
        <Panel title="Investment">
          <div className="space-y-4">
            <NumberField
              id="ci-principal"
              label="Initial investment"
              value={principal}
              onChange={setPrincipal}
              error={nothingToGrow ? "Enter an initial investment or a monthly contribution." : principalCheck.error}
              placeholder="10000"
              min={0}
            />
            <NumberField
              id="ci-rate"
              label="Annual interest rate"
              unit="%"
              value={rate}
              onChange={setRate}
              error={rateCheck.error}
              placeholder="7"
              min={0}
              max={100}
              step={0.1}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField
                id="ci-years"
                label="Years"
                unit="yrs"
                value={years}
                onChange={setYears}
                error={yearsCheck.error}
                placeholder="10"
                min={1}
                max={100}
                step={1}
              />
              <Field label="Compounding" htmlFor="ci-frequency">
                <Select id="ci-frequency" value={perYear} onChange={(e) => setPerYear(Number(e.target.value))}>
                  {COMPOUNDING_OPTIONS.map((o) => (
                    <option key={o.perYear} value={o.perYear}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <NumberField
              id="ci-contribution"
              label="Monthly contribution (optional)"
              value={contribution}
              onChange={setContribution}
              error={contributionCheck.error}
              hint="Added at the end of every month."
              placeholder="0"
              min={0}
            />
          </div>
        </Panel>

        <div className="space-y-4">
          {result ? (
            <>
              <dl className="grid gap-3 sm:grid-cols-3">
                <Stat label="Future value" value={formatAmount(result.futureValue)} emphasis />
                <Stat label="Total deposits" value={formatAmount(result.totalDeposits)} />
                <Stat label="Total interest" value={formatAmount(result.totalInterest)} />
              </dl>
              <Panel title="Deposits vs interest">
                <SplitBar
                  segments={[
                    { label: "Initial investment", value: principalCheck.value ?? 0, tone: BAR_TONES[0] },
                    { label: "Contributions", value: result.totalDeposits - (principalCheck.value ?? 0), tone: BAR_TONES[2] },
                    { label: "Interest", value: result.totalInterest, tone: BAR_TONES[1] },
                  ]}
                />
              </Panel>
            </>
          ) : (
            <EmptyResult>Enter the investment, interest rate and number of years.</EmptyResult>
          )}
        </div>
      </ToolColumns>

      {result ? (
        <Panel
          title="Growth by year"
          actions={
            <DownloadTextButton
              text={growthCsv(result)}
              filename="compound-interest.csv"
              type="text/csv;charset=utf-8"
              label="Download CSV"
            />
          }
        >
          <DataTable
            caption="Balance at the end of each year"
            minWidth={640}
            rows={result.years}
            rowKey={(y) => y.year}
            columns={[
              { header: "Year", cell: (y) => `Year ${y.year}` },
              { header: "Deposits", cell: (y) => formatAmount(y.deposits) },
              { header: "Interest", cell: (y) => formatAmount(y.interest) },
              { header: "Total interest", cell: (y) => formatAmount(y.totalInterest) },
              { header: "Balance", cell: (y) => <span className="font-medium">{formatAmount(y.balance)}</span> },
              {
                header: <span className="sr-only">Growth chart</span>,
                align: "left",
                cell: (y) => (
                  <span aria-hidden className="flex h-2.5 w-24 overflow-hidden rounded-full bg-line sm:w-40">
                    <span
                      className={BAR_TONES[0]}
                      style={{ width: `${(y.totalDeposits / maxBalance) * 100}%` }}
                    />
                    <span
                      className={BAR_TONES[1]}
                      style={{ width: `${(Math.max(0, y.totalInterest) / maxBalance) * 100}%` }}
                    />
                  </span>
                ),
              },
            ]}
          />
          <p className="mt-3 text-xs text-muted">
            Each bar shows the balance relative to the final balance, split into money deposited and interest earned.
          </p>
        </Panel>
      ) : null}
    </div>
  );
}
