"use client";

import { useState } from "react";
import { ErrorText, Panel, Segmented, Stat, ToolColumns } from "@/components/tool-ui";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import { addDays, checkNumber, formatLongDate, parseIsoDate, plural, todayIso } from "@/tools/lib/calc";
import { DataTable, EmptyResult, NumberField, useTrackResult } from "@/tools/lib/calc-ui";
import { dueDate, PREGNANCY_DAYS, PREGNANCY_MILESTONES, pregnancyProgress, type DueDateMethod } from "@/tools/lib/health";

const DATE_LABEL: Record<DueDateMethod, string> = {
  lmp: "First day of your last period",
  conception: "Conception date",
  ivf: "Embryo transfer date",
};

/** Beyond this the date can't belong to a current pregnancy. */
const MAX_GESTATION_DAYS = 44 * 7;

const ORDINAL = ["", "First", "Second", "Third"];

export default function PregnancyDueDateCalculator() {
  const [method, setMethod] = useState<DueDateMethod>("lmp");
  const [date, setDate] = useState("");
  const [cycle, setCycle] = useState("28");
  const [embryoDays, setEmbryoDays] = useState<"3" | "5">("5");
  const [today] = useState(todayIso);

  const cycleCheck = checkNumber(cycle, { min: 20, max: 45, integer: true });
  const start = parseIsoDate(date);
  const now = parseIsoDate(today);

  let error = "";
  if (date && !start) error = "Enter a valid date.";
  else if (start && now && start.getTime() > now.getTime()) error = "The date can't be in the future.";

  const due =
    start && !error && (method !== "lmp" || cycleCheck.value !== null)
      ? dueDate(method, start, { cycleLength: cycleCheck.value ?? 28, embryoDays: Number(embryoDays) })
      : null;
  const progress = due && now ? pregnancyProgress(due, now) : null;
  const tooOld = progress !== null && progress.gestationDays > MAX_GESTATION_DAYS;
  /** The latest milestone already reached, highlighted in the table. */
  const reachedWeek = progress
    ? PREGNANCY_MILESTONES.filter((m) => m.week <= progress.weeks).map((m) => m.week).pop()
    : undefined;
  const share = progress ? Math.min(100, Math.max(0, (progress.gestationDays / PREGNANCY_DAYS) * 100)) : 0;

  useTrackResult(due?.getTime());

  return (
    <div className="space-y-4">
      <ToolColumns>
        <Panel title="Calculate from">
          <div className="space-y-4">
            <Segmented<DueDateMethod>
              label="Calculation method"
              value={method}
              onChange={setMethod}
              options={[
                { value: "lmp", label: "Last period" },
                { value: "conception", label: "Conception date" },
                { value: "ivf", label: "IVF transfer" },
              ]}
            />
            <Field label={DATE_LABEL[method]} htmlFor="preg-date">
              <Input id="preg-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
            </Field>
            {method === "lmp" ? (
              <NumberField
                id="preg-cycle"
                label="Average cycle length"
                unit="days"
                value={cycle}
                onChange={setCycle}
                error={cycleCheck.error}
                hint="Usually 28 days. Longer or shorter cycles move the due date."
                min={20}
                max={45}
                step={1}
              />
            ) : null}
            {method === "ivf" ? (
              <div>
                <p aria-hidden className="mb-1.5 text-sm font-medium text-ink">
                  Embryo age at transfer
                </p>
                <Segmented<"3" | "5">
                  label="Embryo age at transfer"
                  value={embryoDays}
                  onChange={setEmbryoDays}
                  options={[
                    { value: "3", label: "3-day embryo" },
                    { value: "5", label: "5-day blastocyst" },
                  ]}
                />
              </div>
            ) : null}
            <ErrorText>{error}</ErrorText>
          </div>
        </Panel>

        <div className="space-y-4">
          {due && progress ? (
            <>
              <dl className="grid gap-3 sm:grid-cols-2">
                <Stat label="Estimated due date" value={formatLongDate(due)} emphasis />
                <Stat
                  label="How far along"
                  value={tooOld ? "–" : `${plural(progress.weeks, "week")}, ${plural(progress.days, "day")}`}
                  emphasis
                />
                <Stat label="Trimester" value={tooOld ? "–" : `${ORDINAL[progress.trimester]} trimester`} />
                <Stat
                  label={progress.daysToGo >= 0 ? "Days to go" : "Due date passed"}
                  value={progress.daysToGo >= 0 ? plural(progress.daysToGo, "day") : `${plural(-progress.daysToGo, "day")} ago`}
                />
                {method === "lmp" ? (
                  <Stat label="Estimated conception" value={formatLongDate(progress.estimatedConception)} />
                ) : null}
              </dl>
              {tooOld ? (
                <Alert tone="warning">This date is more than 44 weeks ago, so it doesn&apos;t match a current pregnancy.</Alert>
              ) : (
                <Panel title="Progress">
                  <div
                    role="progressbar"
                    aria-label="Pregnancy progress"
                    aria-valuemin={0}
                    aria-valuemax={40}
                    aria-valuenow={Math.min(40, progress.weeks)}
                    aria-valuetext={`Week ${progress.weeks} of 40`}
                    className="h-3 overflow-hidden rounded-full bg-line"
                  >
                    <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                  </div>
                  <p className="mt-2 text-sm text-muted">Week {progress.weeks} of 40</p>
                </Panel>
              )}
            </>
          ) : (
            <EmptyResult>Pick a date to estimate the due date.</EmptyResult>
          )}
        </div>
      </ToolColumns>

      {due && progress ? (
        <Panel title="Milestones">
          <DataTable
            caption="Pregnancy milestones with their estimated dates"
            minWidth={420}
            rows={PREGNANCY_MILESTONES}
            rowKey={(m) => m.week}
            highlight={(m) => !tooOld && m.week === reachedWeek}
            columns={[
              { header: "Week", cell: (m) => `Week ${m.week}` },
              { header: "Milestone", align: "left", cell: (m) => m.label },
              { header: "Date", cell: (m) => formatLongDate(addDays(progress.start, m.week * 7)) },
            ]}
          />
        </Panel>
      ) : null}

      <Alert tone="info" title="Not medical advice">
        This calculator gives an estimate only. Most babies are not born on their due date, and an ultrasound dating scan is
        more accurate. Always follow the advice of your doctor or midwife.
      </Alert>
    </div>
  );
}
