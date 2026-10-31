"use client";

import { useEffect, useMemo, useState } from "react";
import { ErrorText, Panel, Stat, StatGrid, ToolColumns } from "@/components/tool-ui";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useTool } from "@/tools/context";
import {
  ageDetails,
  formatLongDate,
  formatNumber,
  parseIsoDate,
  plural,
  todayIso,
  weekdayName,
  type AgeDetails,
} from "@/tools/lib/calc";

type AgeResult = { ok: true; birthDate: Date; details: AgeDetails } | { ok: false; error: string };

export default function AgeCalculator() {
  const { track } = useTool();
  const [birth, setBirth] = useState("");
  const [on, setOn] = useState(todayIso);

  const result = useMemo<AgeResult | null>(() => {
    if (!birth || !on) return null;
    const birthDate = parseIsoDate(birth);
    const onDate = parseIsoDate(on);
    if (!birthDate) return { ok: false, error: "Enter a valid date of birth." };
    if (!onDate) return { ok: false, error: "Enter a valid date to calculate the age on." };
    if (birthDate.getTime() > onDate.getTime()) {
      return { ok: false, error: "The date of birth must be on or before the “age on” date." };
    }
    return { ok: true, birthDate, details: ageDetails(birthDate, onDate) };
  }, [birth, on]);

  const details = result?.ok ? result.details : null;
  const leapling = result?.ok === true && result.birthDate.getUTCMonth() === 1 && result.birthDate.getUTCDate() === 29;

  useEffect(() => {
    if (details) track();
  }, [details, track]);

  return (
    <ToolColumns>
      <Panel title="Dates">
        <div className="space-y-4">
          <Field label="Date of birth" htmlFor="age-birth">
            <Input id="age-birth" type="date" value={birth} max={on || undefined} onChange={(e) => setBirth(e.target.value)} />
          </Field>
          <Field
            label="Age on"
            htmlFor="age-on"
            hint="Defaults to today. Change it to find someone's age on a past or future date."
          >
            <div className="flex gap-2">
              <Input id="age-on" type="date" value={on} onChange={(e) => setOn(e.target.value)} />
              <Button variant="outline" onClick={() => setOn(todayIso())}>
                Today
              </Button>
            </div>
          </Field>
          {result && !result.ok ? <ErrorText>{result.error}</ErrorText> : null}
          {leapling ? <Alert>Born on 29 February: in common years the birthday is counted on 28 February.</Alert> : null}
        </div>
      </Panel>

      <div className="space-y-4">
        {result?.ok && details ? (
          <>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Stat
                label="Age"
                value={`${plural(details.years, "year")}, ${plural(details.months, "month")}, ${plural(details.days, "day")}`}
                emphasis
              />
              <Stat
                label="Next birthday"
                value={
                  details.daysUntilBirthday === 0 ? "Today – happy birthday!" : `in ${plural(details.daysUntilBirthday, "day")}`
                }
                emphasis
              />
            </dl>
            <StatGrid>
              <Stat label="Total months" value={formatNumber(details.totalMonths, 0)} />
              <Stat label="Total weeks" value={formatNumber(details.totalWeeks, 0)} />
              <Stat label="Total days" value={formatNumber(details.totalDays, 0)} />
              <Stat label="Total hours" value={formatNumber(details.totalHours, 0)} />
              <Stat label="Born on a" value={weekdayName(result.birthDate)} />
              <Stat label={`Turns ${details.nextAge} on`} value={formatLongDate(details.nextBirthday)} />
            </StatGrid>
          </>
        ) : (
          <Panel>
            <p className="py-10 text-center text-sm text-muted">Enter a date of birth to see the exact age.</p>
          </Panel>
        )}
      </div>
    </ToolColumns>
  );
}
