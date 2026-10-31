"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { Panel, Segmented, Stat, ToolColumns } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import { downloadText } from "@/lib/files";
import { useTool } from "@/tools/context";
import { calculateLoan, checkNumber, formatAmount, formatNumber, groupByYear, scheduleToCsv } from "@/tools/lib/calc";
import { NumberField } from "@/tools/lib/calc-ui";

type TenureUnit = "years" | "months";

const MAX_MONTHS = 600;

/** Number as an input value: no grouping separators and at most 4 decimals. */
function formatPlain(value: number): string {
  return String(Math.round(value * 10_000) / 10_000);
}

export default function LoanEmiCalculator() {
  const { track } = useTool();
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [tenure, setTenure] = useState("");
  const [unit, setUnit] = useState<TenureUnit>("years");
  const [openYears, setOpenYears] = useState<Set<number>>(() => new Set());

  const amountCheck = checkNumber(amount, { min: 0, exclusiveMin: true, max: 1e12 });
  const rateCheck = checkNumber(rate, { min: 0, max: 100 });
  const tenureCheck = checkNumber(tenure, {
    min: 1,
    max: unit === "years" ? MAX_MONTHS / 12 : MAX_MONTHS,
    integer: unit === "months",
  });
  const months = tenureCheck.value === null ? null : unit === "years" ? Math.round(tenureCheck.value * 12) : tenureCheck.value;

  const loan = useMemo(
    () =>
      amountCheck.value !== null && rateCheck.value !== null && months
        ? calculateLoan(amountCheck.value, rateCheck.value, months)
        : null,
    [amountCheck.value, rateCheck.value, months],
  );
  const years = useMemo(() => (loan ? groupByYear(loan.schedule) : []), [loan]);

  useEffect(() => {
    if (loan) track();
  }, [loan, track]);

  function toggleYear(year: number) {
    setOpenYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }

  const principalShare = loan && loan.totalPayment > 0 ? (amountCheck.value ?? 0) / loan.totalPayment : 1;

  return (
    <div className="space-y-4">
      <ToolColumns>
        <Panel title="Loan details">
          <div className="space-y-4">
            <NumberField
              id="emi-amount"
              label="Loan amount"
              value={amount}
              onChange={setAmount}
              error={amountCheck.error}
              placeholder="250000"
              min={0}
            />
            <NumberField
              id="emi-rate"
              label="Annual interest rate"
              unit="%"
              value={rate}
              onChange={setRate}
              error={rateCheck.error}
              placeholder="8.5"
              min={0}
              max={100}
              step={0.05}
            />
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <NumberField
                id="emi-tenure"
                label="Loan term"
                unit={unit}
                value={tenure}
                onChange={setTenure}
                error={tenureCheck.error}
                placeholder={unit === "years" ? "20" : "240"}
                min={1}
              />
              <Segmented<TenureUnit>
                label="Loan term unit"
                value={unit}
                onChange={(next) => {
                  // Convert the current term so switching units doesn't change the loan.
                  if (tenureCheck.value !== null) {
                    setTenure(
                      next === "months" ? String(Math.round(tenureCheck.value * 12)) : formatPlain(tenureCheck.value / 12),
                    );
                  }
                  setUnit(next);
                }}
                options={[
                  { value: "years", label: "Years" },
                  { value: "months", label: "Months" },
                ]}
                className="self-end"
              />
            </div>
          </div>
        </Panel>

        <div className="space-y-4">
          {loan ? (
            <>
              <dl className="grid gap-3 sm:grid-cols-3">
                <Stat label="Monthly payment (EMI)" value={formatAmount(loan.emi)} emphasis />
                <Stat label="Total interest" value={formatAmount(loan.totalInterest)} />
                <Stat label="Total payment" value={formatAmount(loan.totalPayment)} />
              </dl>
              <Panel title="Principal vs interest">
                <div
                  role="img"
                  aria-label={`Principal ${formatNumber(principalShare * 100, 1)}%, interest ${formatNumber((1 - principalShare) * 100, 1)}% of the total payment.`}
                  className="flex h-4 overflow-hidden rounded-full bg-line"
                >
                  <span className="bg-primary" style={{ width: `${principalShare * 100}%` }} />
                  <span className="bg-amber-400 dark:bg-amber-500" style={{ width: `${(1 - principalShare) * 100}%` }} />
                </div>
                <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <li className="flex items-center gap-2">
                    <span aria-hidden className="size-2.5 rounded-full bg-primary" />
                    Principal {formatNumber(principalShare * 100, 1)}%
                  </li>
                  <li className="flex items-center gap-2">
                    <span aria-hidden className="size-2.5 rounded-full bg-amber-400 dark:bg-amber-500" />
                    Interest {formatNumber((1 - principalShare) * 100, 1)}%
                  </li>
                </ul>
              </Panel>
            </>
          ) : (
            <Panel>
              <p className="py-10 text-center text-sm text-muted">Enter the loan amount, interest rate and term.</p>
            </Panel>
          )}
        </div>
      </ToolColumns>

      {loan ? (
        <Panel
          title="Amortization schedule"
          actions={
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadText(scheduleToCsv(loan.schedule), "amortization-schedule.csv", "text/csv;charset=utf-8")}
            >
              <Download aria-hidden />
              Download CSV
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm tabular-nums">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Period
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Principal
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Interest
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Total paid
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {years.map((y) => {
                  const open = openYears.has(y.year);
                  return (
                    <Fragment key={y.year}>
                      <tr className="border-b border-line">
                        <th scope="row" className="py-1.5 pr-3 text-left font-medium">
                          <button
                            type="button"
                            onClick={() => toggleYear(y.year)}
                            aria-expanded={open}
                            className="inline-flex items-center gap-1 rounded-md py-0.5 pr-1.5 text-ink hover:text-primary"
                          >
                            {open ? (
                              <ChevronDown className="size-4" aria-hidden />
                            ) : (
                              <ChevronRight className="size-4" aria-hidden />
                            )}
                            Year {y.year}
                          </button>
                        </th>
                        <td className="py-1.5 pr-3 text-right">{formatAmount(y.principal)}</td>
                        <td className="py-1.5 pr-3 text-right">{formatAmount(y.interest)}</td>
                        <td className="py-1.5 pr-3 text-right">{formatAmount(y.payment)}</td>
                        <td className="py-1.5 text-right">{formatAmount(y.balance)}</td>
                      </tr>
                      {open
                        ? y.rows.map((row) => (
                            <tr key={row.month} className="border-b border-line bg-paper text-muted">
                              <th scope="row" className="py-1.5 pr-3 pl-7 text-left font-normal">
                                Month {row.month}
                              </th>
                              <td className="py-1.5 pr-3 text-right">{formatAmount(row.principal)}</td>
                              <td className="py-1.5 pr-3 text-right">{formatAmount(row.interest)}</td>
                              <td className="py-1.5 pr-3 text-right">{formatAmount(row.payment)}</td>
                              <td className="py-1.5 text-right">{formatAmount(row.balance)}</td>
                            </tr>
                          ))
                        : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
