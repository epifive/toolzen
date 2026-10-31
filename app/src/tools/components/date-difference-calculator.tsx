"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { ErrorText, Panel, Segmented, Stat, StatGrid, ToolColumns } from "@/components/tool-ui";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch } from "@/components/ui/field";
import { useTool } from "@/tools/context";
import {
  addDays,
  addToDate,
  calendarDifference,
  checkNumber,
  countBusinessDays,
  formatLongDate,
  formatNumber,
  parseIsoDate,
  plural,
  todayIso,
  toIsoDate,
  type CheckedNumber,
  type DateUnit,
} from "@/tools/lib/calc";
import { NumberField } from "@/tools/lib/calc-ui";

type Mode = "difference" | "add";

const UNITS: Array<{ unit: DateUnit; label: string }> = [
  { unit: "years", label: "Years" },
  { unit: "months", label: "Months" },
  { unit: "weeks", label: "Weeks" },
  { unit: "days", label: "Days" },
];

const AMOUNT_RULE = { min: 0, max: 100_000, integer: true };

function DifferenceCalculator({ onResult }: { onResult: () => void }) {
  const [start, setStart] = useState(todayIso);
  const [end, setEnd] = useState("");
  const [includeEnd, setIncludeEnd] = useState(false);

  const result = useMemo(() => {
    const a = parseIsoDate(start);
    const b = parseIsoDate(end);
    if (!a || !b) return null;
    const reversed = b.getTime() < a.getTime();
    const from = reversed ? b : a;
    // Counting the end date means the range runs to the start of the following day.
    const to = includeEnd ? addDays(reversed ? a : b, 1) : reversed ? a : b;
    const diff = calendarDifference(from, to);
    return { reversed, diff, businessDays: countBusinessDays(from, to) };
  }, [start, end, includeEnd]);

  useEffect(() => {
    if (result) onResult();
  }, [result, onResult]);

  return (
    <ToolColumns>
      <Panel title="Dates">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <Field label="Start date" htmlFor="dd-start">
              <Input id="dd-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Button
              variant="ghost"
              className="justify-self-start px-2.5"
              aria-label="Swap start and end dates"
              onClick={() => {
                setStart(end);
                setEnd(start);
              }}
            >
              <ArrowLeftRight aria-hidden />
            </Button>
            <Field label="End date" htmlFor="dd-end">
              <Input id="dd-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
          <Switch
            label="Include the end date"
            description="Counts both the first and the last day, e.g. Monday to Friday = 5 days."
            checked={includeEnd}
            onChange={(e) => setIncludeEnd(e.target.checked)}
          />
          {result?.reversed ? (
            <Alert tone="warning">The end date is before the start date, so the dates are counted the other way round.</Alert>
          ) : null}
        </div>
      </Panel>

      <div className="space-y-4">
        {result ? (
          <>
            <dl className="grid gap-3">
              <Stat
                label="Difference"
                value={`${plural(result.diff.years, "year")}, ${plural(result.diff.months, "month")}, ${plural(result.diff.days, "day")}`}
                emphasis
              />
            </dl>
            <StatGrid>
              <Stat label="Total days" value={formatNumber(result.diff.totalDays, 0)} />
              <Stat
                label="Weeks"
                value={`${formatNumber(Math.floor(result.diff.totalDays / 7), 0)}${result.diff.totalDays % 7 ? ` + ${plural(result.diff.totalDays % 7, "day")}` : ""}`}
              />
              <Stat label="Total months" value={formatNumber(result.diff.totalMonths, 0)} />
              <Stat label="Business days" value={formatNumber(result.businessDays, 0)} />
              <Stat label="Hours" value={formatNumber(result.diff.totalDays * 24, 0)} />
              <Stat label="Minutes" value={formatNumber(result.diff.totalDays * 1440, 0)} />
            </StatGrid>
            <p className="text-xs text-muted">Business days are Monday to Friday; public holidays are not excluded.</p>
          </>
        ) : (
          <Panel>
            <p className="py-10 text-center text-sm text-muted">Pick a start and an end date.</p>
          </Panel>
        )}
      </div>
    </ToolColumns>
  );
}

function AddCalculator({ onResult }: { onResult: () => void }) {
  const [start, setStart] = useState(todayIso);
  const [operation, setOperation] = useState<"add" | "subtract">("add");
  const [amounts, setAmounts] = useState<Record<DateUnit, string>>({ years: "", months: "", weeks: "", days: "" });

  const checks = Object.fromEntries(UNITS.map(({ unit }) => [unit, checkNumber(amounts[unit], AMOUNT_RULE)])) as Record<
    DateUnit,
    CheckedNumber
  >;
  const hasError = UNITS.some(({ unit }) => checks[unit].error);
  const hasAmount = UNITS.some(({ unit }) => checks[unit].value);
  const base = parseIsoDate(start);

  let result: Date | null = null;
  if (base && !hasError && hasAmount) {
    const sign = operation === "add" ? 1 : -1;
    // Years and months first (with month-end clamping), then weeks and days.
    result = UNITS.reduce((date, { unit }) => addToDate(date, sign * (checks[unit].value ?? 0), unit), base);
  }
  const resultIso = result && !Number.isNaN(result.getTime()) ? toIsoDate(result) : "";

  useEffect(() => {
    if (resultIso) onResult();
  }, [resultIso, onResult]);

  return (
    <ToolColumns>
      <Panel title="Start date and amount">
        <div className="space-y-4">
          <Field label="Start date" htmlFor="da-start">
            <Input id="da-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Segmented
            label="Add or subtract"
            value={operation}
            onChange={setOperation}
            options={[
              { value: "add", label: "Add" },
              { value: "subtract", label: "Subtract" },
            ]}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {UNITS.map(({ unit, label }) => (
              <NumberField
                key={unit}
                id={`da-${unit}`}
                label={label}
                value={amounts[unit]}
                onChange={(value) => setAmounts((prev) => ({ ...prev, [unit]: value }))}
                error={checks[unit].error}
                placeholder="0"
                min={0}
                step={1}
              />
            ))}
          </div>
          {!start ? <ErrorText>Pick a start date.</ErrorText> : null}
        </div>
      </Panel>

      <div className="space-y-4">
        {result && resultIso ? (
          <>
            <dl className="grid gap-3">
              <Stat label="Resulting date" value={formatLongDate(result)} emphasis />
            </dl>
            <p className="text-sm text-muted">
              {formatLongDate(base ?? result)} {operation === "add" ? "+" : "−"}{" "}
              {UNITS.filter(({ unit }) => checks[unit].value)
                .map(({ unit }) => plural(checks[unit].value ?? 0, unit.slice(0, -1)))
                .join(", ")}
            </p>
            <p className="text-xs text-muted">
              When the target month is shorter, the date moves to its last day (31 January + 1 month = 28 or 29 February).
            </p>
          </>
        ) : (
          <Panel>
            <p className="py-10 text-center text-sm text-muted">Enter a number of years, months, weeks or days.</p>
          </Panel>
        )}
      </div>
    </ToolColumns>
  );
}

export default function DateDifferenceCalculator() {
  const { track } = useTool();
  const [mode, setMode] = useState<Mode>("difference");

  return (
    <div className="space-y-4">
      <Segmented<Mode>
        label="Calculator"
        value={mode}
        onChange={setMode}
        options={[
          { value: "difference", label: "Days between dates" },
          { value: "add", label: "Add or subtract from a date" },
        ]}
      />
      {mode === "difference" ? <DifferenceCalculator onResult={track} /> : <AddCalculator onResult={track} />}
    </div>
  );
}
