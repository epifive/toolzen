"use client";

import { useState } from "react";
import { Panel, Stat, ToolColumns } from "@/components/tool-ui";
import { Field, Select } from "@/components/ui/field";
import { checkNumber, formatAmount } from "@/tools/lib/calc";
import { DataTable, EmptyResult, NumberField, useTrackResult } from "@/tools/lib/calc-ui";
import { PAY_PERIODS, periodsPerYear, type PayPeriod, type WorkSchedule } from "@/tools/lib/finance";

export default function SalaryCalculator() {
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<PayPeriod>("yearly");
  const [hours, setHours] = useState("40");
  const [days, setDays] = useState("5");
  const [weeks, setWeeks] = useState("52");
  const [overtimeHours, setOvertimeHours] = useState("");
  const [overtimeRate, setOvertimeRate] = useState("1.5");

  const amountCheck = checkNumber(amount, { min: 0, exclusiveMin: true, max: 1e12 });
  const hoursCheck = checkNumber(hours, { min: 0, exclusiveMin: true, max: 168 });
  const daysCheck = checkNumber(days, { min: 0, exclusiveMin: true, max: 7 });
  const weeksCheck = checkNumber(weeks, { min: 0, exclusiveMin: true, max: 53 });
  const overtimeHoursCheck = checkNumber(overtimeHours, { min: 0, max: 100 });
  const overtimeRateCheck = checkNumber(overtimeRate, { min: 1, max: 5 });
  const otHours = overtimeHours.trim() ? overtimeHoursCheck.value : 0;
  const totalHoursError =
    hoursCheck.value !== null && otHours !== null && hoursCheck.value + otHours > 168
      ? "Regular and overtime hours together can't exceed 168 hours a week."
      : "";

  const schedule: WorkSchedule | null =
    hoursCheck.value !== null && daysCheck.value !== null && weeksCheck.value !== null
      ? { hoursPerWeek: hoursCheck.value, daysPerWeek: daysCheck.value, weeksPerYear: weeksCheck.value }
      : null;

  const ready = amountCheck.value !== null && schedule && otHours !== null && overtimeRateCheck.value !== null && !totalHoursError;
  const yearly = ready && schedule ? (amountCheck.value ?? 0) * periodsPerYear(period, schedule) : null;
  const hourly = yearly !== null && schedule ? yearly / periodsPerYear("hourly", schedule) : null;
  const overtimeYearly =
    hourly !== null && schedule && otHours !== null && overtimeRateCheck.value !== null
      ? otHours * schedule.weeksPerYear * hourly * overtimeRateCheck.value
      : 0;

  const rows =
    yearly !== null && schedule
      ? PAY_PERIODS.map((p) => {
          const n = periodsPerYear(p.id, schedule);
          return { ...p, base: yearly / n, overtime: overtimeYearly / n, total: (yearly + overtimeYearly) / n };
        })
      : [];

  useTrackResult(yearly === null ? null : `${yearly}-${overtimeYearly}`);

  return (
    <div className="space-y-4">
      <ToolColumns>
        <Panel title="Pay">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField
                id="salary-amount"
                label="Pay amount"
                value={amount}
                onChange={setAmount}
                error={amountCheck.error}
                placeholder="55000"
                min={0}
              />
              <Field label="Per" htmlFor="salary-period">
                <Select id="salary-period" value={period} onChange={(e) => setPeriod(e.target.value as PayPeriod)}>
                  {PAY_PERIODS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <NumberField
                id="salary-hours"
                label="Hours per week"
                value={hours}
                onChange={setHours}
                error={hoursCheck.error}
                min={0}
                max={168}
              />
              <NumberField
                id="salary-days"
                label="Days per week"
                value={days}
                onChange={setDays}
                error={daysCheck.error}
                min={0}
                max={7}
              />
              <NumberField
                id="salary-weeks"
                label="Weeks per year"
                value={weeks}
                onChange={setWeeks}
                error={weeksCheck.error}
                hint="52 minus unpaid weeks off."
                min={0}
                max={53}
              />
            </div>
          </div>
        </Panel>

        <Panel title="Overtime (optional)">
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              id="salary-ot-hours"
              label="Overtime hours per week"
              value={overtimeHours}
              onChange={setOvertimeHours}
              error={overtimeHoursCheck.error || totalHoursError}
              placeholder="0"
              min={0}
            />
            <NumberField
              id="salary-ot-rate"
              label="Overtime multiplier"
              unit="×"
              value={overtimeRate}
              onChange={setOvertimeRate}
              error={overtimeRateCheck.error}
              hint="1.5 is “time and a half”."
              min={1}
              max={5}
              step={0.25}
            />
          </div>
          {yearly !== null && hourly !== null ? (
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Stat label="Yearly pay" value={formatAmount(yearly + overtimeYearly)} emphasis />
              <Stat label="Hourly rate" value={formatAmount(hourly)} emphasis />
            </dl>
          ) : null}
        </Panel>
      </ToolColumns>

      {rows.length ? (
        <Panel title="Pay for every period">
          <DataTable
            caption="Pay converted to every pay period"
            minWidth={overtimeYearly > 0 ? 460 : 300}
            rows={rows}
            rowKey={(r) => r.id}
            highlight={(r) => r.id === period}
            columns={
              overtimeYearly > 0
                ? [
                    { header: "Period", cell: (r) => r.label },
                    { header: "Regular pay", cell: (r) => formatAmount(r.base) },
                    { header: "Overtime", cell: (r) => formatAmount(r.overtime) },
                    { header: "Total", cell: (r) => <span className="font-medium">{formatAmount(r.total)}</span> },
                  ]
                : [
                    { header: "Period", cell: (r) => r.label },
                    { header: "Pay", cell: (r) => <span className="font-medium">{formatAmount(r.base)}</span> },
                  ]
            }
          />
          <p className="mt-3 text-xs text-muted">
            Amounts are before tax. Semi-monthly means 24 payments a year; bi-weekly means every two weeks.
          </p>
        </Panel>
      ) : (
        <EmptyResult>Enter your pay to convert it to every pay period.</EmptyResult>
      )}
    </div>
  );
}
