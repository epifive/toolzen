"use client";

import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Hint, Input, Label, Select } from "@/components/ui/field";
import { CopyButton, Panel, Segmented } from "@/components/tool-ui";
import { useTool } from "@/tools/context";
import {
  buildCronExpression,
  CRON_FIELDS,
  CRON_MACROS,
  describeCron,
  describeCronField,
  nextCronRuns,
  tryParseCron,
  WEEKDAY_NAMES,
  type CronPreset,
} from "@/tools/lib/cron";
import { formatRelativeTime } from "@/tools/lib/dev";
import { CodeBlock, useNow } from "@/tools/lib/dev-ui";

type Mode = "minutes" | "hourly" | "daily" | "weekly" | "monthly" | "custom";

interface Builder {
  minuteInterval: number;
  hourInterval: number;
  minute: number;
  time: string;
  days: number[];
  day: number;
}

const DEFAULT_BUILDER: Builder = { minuteInterval: 15, hourInterval: 1, minute: 0, time: "09:00", days: [1, 2, 3, 4, 5], day: 1 };

const MINUTE_INTERVALS = [1, 2, 5, 10, 15, 20, 30];
const HOUR_INTERVALS = [1, 2, 3, 4, 6, 8, 12];
/** Monday first, as most people read a week. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const RUN_COUNT = 5;

const FIELD_HINTS = ["0–59", "0–23", "1–31", "1–12 or JAN–DEC", "0–7 or SUN–SAT"];

const EXAMPLES: Array<{ expression: string; label: string }> = [
  { expression: "*/5 * * * *", label: "Every 5 minutes" },
  { expression: "0 * * * *", label: "Every hour" },
  { expression: "0 0 * * *", label: "Every day at midnight" },
  { expression: "30 8 * * 1-5", label: "Weekdays at 08:30" },
  { expression: "0 0 * * 0", label: "Every Sunday" },
  { expression: "0 3 1 * *", label: "Monthly on the 1st at 03:00" },
  { expression: "0 0 1 1 *", label: "Every New Year" },
  { expression: "*/15 9-17 * * 1-5", label: "Every 15 min in office hours" },
];

function toPreset(mode: Exclude<Mode, "custom">, b: Builder): CronPreset {
  const [hour, minute] = b.time.split(":").map(Number);
  switch (mode) {
    case "minutes":
      return { kind: "minutes", interval: b.minuteInterval };
    case "hourly":
      return { kind: "hourly", minute: b.minute, interval: b.hourInterval };
    case "daily":
      return { kind: "daily", hour, minute };
    case "weekly":
      return { kind: "weekly", days: b.days, hour, minute };
    case "monthly":
      return { kind: "monthly", day: b.day, hour, minute };
  }
}

/** The five fields of an expression for the custom editor, expanding @macros and padding missing fields. */
function splitFields(expression: string): string[] {
  const trimmed = expression.trim();
  const source = CRON_MACROS[trimmed.toLowerCase()] ?? trimmed;
  const parts = source.split(/\s+/).filter(Boolean);
  return CRON_FIELDS.map((_, i) => parts[i] ?? "*");
}

function TimeField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>Time</Label>
      <Input
        id={id}
        type="time"
        value={value}
        required
        onChange={(e) => {
          if (/^\d{2}:\d{2}$/.test(e.target.value)) onChange(e.target.value);
        }}
        className="w-36"
      />
    </div>
  );
}

export default function CronExpressionGenerator() {
  const { track } = useTool();
  const expressionId = useId();
  const commandId = useId();
  const intervalId = useId();
  const hourIntervalId = useId();
  const minuteId = useId();
  const dayId = useId();
  const [mode, setMode] = useState<Mode>("daily");
  const [builder, setBuilder] = useState<Builder>(DEFAULT_BUILDER);
  const [expression, setExpression] = useState(() => buildCronExpression(toPreset("daily", DEFAULT_BUILDER)));
  const [command, setCommand] = useState("");
  const now = useNow(30_000);
  const source = useDeferredValue(expression);

  const parsed = useMemo(() => tryParseCron(source), [source]);
  const description = parsed.ok ? describeCron(parsed.schedule) : "";
  const runs = useMemo(() => (parsed.ok ? nextCronRuns(parsed.schedule, new Date(now), RUN_COUNT) : []), [parsed, now]);
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const fields = splitFields(expression);

  useEffect(() => {
    if (parsed.ok) track();
  }, [parsed, track]);

  function changeMode(next: Mode) {
    setMode(next);
    if (next !== "custom") setExpression(buildCronExpression(toPreset(next, builder)));
  }

  function changeBuilder(patch: Partial<Builder>) {
    const next = { ...builder, ...patch };
    setBuilder(next);
    if (mode !== "custom") setExpression(buildCronExpression(toPreset(mode, next)));
  }

  function changeField(index: number, value: string) {
    const next = [...fields];
    next[index] = value.replace(/\s+/g, "");
    setExpression(next.join(" "));
  }

  function toggleDay(day: number, on: boolean) {
    const days = on ? [...builder.days, day] : builder.days.filter((d) => d !== day);
    changeBuilder({ days: [...new Set(days)].sort((a, b) => a - b) });
  }

  const crontabLine = parsed.ok ? `${expression.trim()} ${command.trim() || "/path/to/command"}` : "";
  const errorField = !parsed.ok ? parsed.error.field : undefined;

  return (
    <div className="space-y-4">
      <Panel title="Build a schedule">
        <Segmented
          label="Schedule type"
          value={mode}
          onChange={changeMode}
          options={[
            { value: "minutes", label: "Minutes" },
            { value: "hourly", label: "Hourly" },
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
            { value: "monthly", label: "Monthly" },
            { value: "custom", label: "Custom" },
          ]}
        />

        <div className="mt-4">
          {mode === "minutes" ? (
            <div className="w-48">
              <Label htmlFor={intervalId}>Run every</Label>
              <Select id={intervalId} value={builder.minuteInterval} onChange={(e) => changeBuilder({ minuteInterval: Number(e.target.value) })}>
                {MINUTE_INTERVALS.map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "minute" : `${n} minutes`}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          {mode === "hourly" ? (
            <div className="flex flex-wrap gap-4">
              <div className="w-40">
                <Label htmlFor={hourIntervalId}>Run every</Label>
                <Select id={hourIntervalId} value={builder.hourInterval} onChange={(e) => changeBuilder({ hourInterval: Number(e.target.value) })}>
                  {HOUR_INTERVALS.map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? "hour" : `${n} hours`}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-40">
                <Label htmlFor={minuteId}>At minute</Label>
                <Select id={minuteId} value={builder.minute} onChange={(e) => changeBuilder({ minute: Number(e.target.value) })}>
                  {Array.from({ length: 60 }, (_, m) => (
                    <option key={m} value={m}>
                      :{String(m).padStart(2, "0")}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          ) : null}

          {mode === "daily" ? <TimeField value={builder.time} onChange={(time) => changeBuilder({ time })} /> : null}

          {mode === "weekly" ? (
            <div className="space-y-4">
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-ink">Days</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {WEEK_ORDER.map((day) => (
                    <Checkbox
                      key={day}
                      label={WEEKDAY_NAMES[day].slice(0, 3)}
                      aria-label={WEEKDAY_NAMES[day]}
                      checked={builder.days.includes(day)}
                      onChange={(e) => toggleDay(day, e.target.checked)}
                    />
                  ))}
                </div>
                {!builder.days.length ? <Hint>No day selected, so the job runs every day.</Hint> : null}
              </fieldset>
              <TimeField value={builder.time} onChange={(time) => changeBuilder({ time })} />
            </div>
          ) : null}

          {mode === "monthly" ? (
            <div className="flex flex-wrap gap-4">
              <div className="w-40">
                <Label htmlFor={dayId}>Day of month</Label>
                <Select id={dayId} value={builder.day} onChange={(e) => changeBuilder({ day: Number(e.target.value) })}>
                  {Array.from({ length: 31 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </Select>
                {builder.day > 28 ? <Hint>Months without day {builder.day} are skipped.</Hint> : null}
              </div>
              <TimeField value={builder.time} onChange={(time) => changeBuilder({ time })} />
            </div>
          ) : null}

          {mode === "custom" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {CRON_FIELDS.map((field, i) => (
                <div key={field.name}>
                  <Label htmlFor={`${expressionId}-${field.name}`}>{field.label}</Label>
                  <Input
                    id={`${expressionId}-${field.name}`}
                    value={fields[i]}
                    onChange={(e) => changeField(i, e.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                    className="font-mono"
                    aria-invalid={errorField === field.name}
                  />
                  <Hint>{FIELD_HINTS[i]}</Hint>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel title="Cron expression" actions={<CopyButton text={parsed.ok ? expression.trim() : ""} />}>
        <Label htmlFor={expressionId} className="sr-only">
          Cron expression
        </Label>
        <Input
          id={expressionId}
          value={expression}
          onChange={(e) => {
            setExpression(e.target.value);
            setMode("custom");
          }}
          spellCheck={false}
          autoComplete="off"
          className="h-12 font-mono text-lg"
          aria-invalid={!parsed.ok}
          aria-describedby={`${expressionId}-result`}
        />
        <Hint>Five fields: minute, hour, day of month, month, day of week. Shortcuts like @daily and @hourly also work.</Hint>

        <div id={`${expressionId}-result`} className="mt-4" aria-live="polite">
          {parsed.ok ? (
            <p className="font-display text-xl font-semibold text-ink">{description}</p>
          ) : (
            <Alert tone="error" title="Invalid cron expression">
              {parsed.error.message}
            </Alert>
          )}
        </div>
      </Panel>

      {parsed.ok ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Fields">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th scope="col" className="pb-2 pr-3 font-medium">
                      Field
                    </th>
                    <th scope="col" className="pb-2 pr-3 font-medium">
                      Value
                    </th>
                    <th scope="col" className="pb-2 font-medium">
                      Matches
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(["minute", "hour", "dayOfMonth", "month", "dayOfWeek"] as const).map((name, i) => (
                    <tr key={name}>
                      <th scope="row" className="py-2 pr-3 font-medium text-ink">
                        {CRON_FIELDS[i].label}
                      </th>
                      <td className="py-2 pr-3 font-mono text-[13px] text-ink">{parsed.schedule[name].source}</td>
                      <td className="py-2 text-muted">{describeCronField(parsed.schedule[name])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title={`Next ${RUN_COUNT} runs`}>
            {runs.length ? (
              <ol className="space-y-2 text-sm">
                {runs.map((run) => (
                  <li key={run.getTime()} className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <time dateTime={run.toISOString()} className="font-medium tabular-nums text-ink">
                      {run.toLocaleString(undefined, {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    <span className="text-xs text-muted">{formatRelativeTime(run.getTime(), now)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">This schedule never runs: no date matches it (for example, 30 February).</p>
            )}
            <p className="mt-3 text-xs text-muted">Shown in your time zone ({timeZone}). Servers run cron in their own time zone.</p>
          </Panel>
        </div>
      ) : null}

      {parsed.ok ? (
        <Panel title="Crontab line" actions={<CopyButton text={crontabLine} />}>
          <Label htmlFor={commandId}>Command</Label>
          <Input
            id={commandId}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="/usr/bin/php /var/www/artisan schedule:run"
            spellCheck={false}
            className="font-mono"
          />
          <CodeBlock code={crontabLine} label="Crontab line" className="mt-3" />
          <Hint>Add the line with crontab -e. Redirect output with &gt;&gt; /path/to/log 2&gt;&amp;1 to keep a log.</Hint>
        </Panel>
      ) : null}

      <Panel title="Common schedules">
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example.expression}
              type="button"
              onClick={() => {
                setExpression(example.expression);
                setMode("custom");
              }}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-left text-sm hover:border-primary-line hover:text-primary"
            >
              <span className="block font-mono text-[13px] text-ink">{example.expression}</span>
              <span className="block text-xs text-muted">{example.label}</span>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
