/**
 * Standard 5-field cron expressions (minute hour day-of-month month day-of-week):
 * parsing, plain-English descriptions, next run times and a small builder.
 *
 * Semantics follow Vixie cron, the cron used by most Linux distributions:
 * names (JAN, MON) are accepted, 0 and 7 both mean Sunday, and when both the
 * day-of-month and day-of-week fields are restricted a day matches if EITHER
 * matches. Plain TypeScript, no DOM needed.
 */

export type CronFieldName = "minute" | "hour" | "dayOfMonth" | "month" | "dayOfWeek";

interface FieldSpec {
  name: CronFieldName;
  label: string;
  min: number;
  max: number;
  /** Accepted names, the first one being worth `min`. */
  aliases?: string[];
}

export const CRON_FIELDS: readonly FieldSpec[] = [
  { name: "minute", label: "Minute", min: 0, max: 59 },
  { name: "hour", label: "Hour", min: 0, max: 23 },
  { name: "dayOfMonth", label: "Day of month", min: 1, max: 31 },
  {
    name: "month",
    label: "Month",
    min: 1,
    max: 12,
    aliases: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
  },
  { name: "dayOfWeek", label: "Day of week", min: 0, max: 7, aliases: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] },
];

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const CRON_MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

/** One comma-separated item of a field, e.g. "1-5", "*\/15" or "MON". */
export interface CronPart {
  start: number;
  end: number;
  step: number;
  /** The item was "*" (or "?"), optionally with a step. */
  wildcard: boolean;
  /** The item was "a/n": from a to the field maximum. */
  open: boolean;
}

export interface CronField {
  name: CronFieldName;
  source: string;
  parts: CronPart[];
  /** Every value the field matches, sorted. Day of week 7 is stored as 0. */
  values: number[];
  /** The field starts with "*" — used for the day-of-month / day-of-week rule. */
  star: boolean;
  /** The field matches every possible value. */
  full: boolean;
}

export interface CronSchedule {
  /** The 5 fields, with any @macro expanded. */
  expression: string;
  minute: CronField;
  hour: CronField;
  dayOfMonth: CronField;
  month: CronField;
  dayOfWeek: CronField;
}

export class CronError extends Error {
  readonly field?: CronFieldName;

  constructor(message: string, field?: CronFieldName) {
    super(message);
    this.name = "CronError";
    this.field = field;
  }
}

function parseValue(token: string, spec: FieldSpec): number {
  const upper = token.toUpperCase();
  const alias = spec.aliases?.indexOf(upper) ?? -1;
  if (alias >= 0) return spec.min + alias;
  if (!/^\d+$/.test(token)) {
    if (/[LW#]/i.test(token)) {
      throw new CronError(`${spec.label}: "${token}" uses a Quartz extension (L, W or #) that standard cron does not support.`, spec.name);
    }
    throw new CronError(`${spec.label}: "${token}" is not a number${spec.aliases ? " or name" : ""}.`, spec.name);
  }
  const value = Number(token);
  if (value < spec.min || value > spec.max) {
    throw new CronError(`${spec.label}: ${value} is out of range (${spec.min}–${spec.max}).`, spec.name);
  }
  return value;
}

function parsePart(item: string, spec: FieldSpec): CronPart {
  const [range, stepText, extra] = item.split("/");
  if (extra !== undefined || range === "") throw new CronError(`${spec.label}: "${item}" is not valid.`, spec.name);
  let step = 1;
  if (stepText !== undefined) {
    if (!/^\d+$/.test(stepText) || Number(stepText) < 1) {
      throw new CronError(`${spec.label}: the step in "${item}" must be a whole number of 1 or more.`, spec.name);
    }
    step = Number(stepText);
  }
  const max = spec.name === "dayOfWeek" ? 6 : spec.max;

  if (range === "*" || range === "?") {
    if (range === "?" && spec.name !== "dayOfMonth" && spec.name !== "dayOfWeek") {
      throw new CronError(`${spec.label}: "?" is only allowed in the day fields.`, spec.name);
    }
    return { start: spec.min, end: max, step, wildcard: true, open: false };
  }

  const bounds = range.split("-");
  if (bounds.length > 2) throw new CronError(`${spec.label}: "${item}" is not a valid range.`, spec.name);
  const start = parseValue(bounds[0], spec);
  if (bounds.length === 2) {
    const end = parseValue(bounds[1], spec);
    if (end < start) throw new CronError(`${spec.label}: the range "${range}" must go from low to high.`, spec.name);
    return { start, end, step, wildcard: false, open: false };
  }
  // "a/n" means from a to the end of the range.
  return stepText === undefined
    ? { start, end: start, step: 1, wildcard: false, open: false }
    : { start, end: spec.max, step, wildcard: false, open: true };
}

function parseField(source: string, spec: FieldSpec): CronField {
  const parts = source.split(",").map((item) => parsePart(item, spec));
  const values = new Set<number>();
  for (const part of parts) {
    for (let v = part.start; v <= part.end; v += part.step) values.add(spec.name === "dayOfWeek" && v === 7 ? 0 : v);
  }
  const sorted = [...values].sort((a, b) => a - b);
  const possible = (spec.name === "dayOfWeek" ? 6 : spec.max) - spec.min + 1;
  return { name: spec.name, source, parts, values: sorted, star: source.startsWith("*") || source.startsWith("?"), full: sorted.length === possible };
}

/** Parse a cron expression or @macro. Throws a CronError with a readable message. */
export function parseCron(input: string): CronSchedule {
  const trimmed = input.trim();
  if (!trimmed) throw new CronError("Enter a cron expression.");
  let expression = trimmed;
  if (trimmed.startsWith("@")) {
    const macro = CRON_MACROS[trimmed.toLowerCase()];
    if (!macro) {
      throw new CronError(
        trimmed.toLowerCase() === "@reboot"
          ? "@reboot runs once when the system starts, so it has no schedule."
          : `Unknown shortcut "${trimmed}". Use @yearly, @monthly, @weekly, @daily or @hourly.`,
      );
    }
    expression = macro;
  }
  const fields = expression.split(/\s+/);
  if (fields.length !== 5) {
    throw new CronError(
      fields.length === 6 || fields.length === 7
        ? `Found ${fields.length} fields. Standard cron uses 5 (minute, hour, day of month, month, day of week); seconds and years are not supported.`
        : `Found ${fields.length} field${fields.length === 1 ? "" : "s"}, but a cron expression needs exactly 5: minute, hour, day of month, month and day of week.`,
    );
  }
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields.map((field, i) => parseField(field, CRON_FIELDS[i]));
  return { expression: fields.join(" "), minute, hour, dayOfMonth, month, dayOfWeek };
}

/** Validate without throwing. */
export function tryParseCron(input: string): { ok: true; schedule: CronSchedule } | { ok: false; error: CronError } {
  try {
    return { ok: true, schedule: parseCron(input) };
  } catch (error) {
    return { ok: false, error: error instanceof CronError ? error : new CronError("This cron expression is not valid.") };
  }
}

/* ───────────────────────── Next runs ───────────────────────── */

/** How far ahead to look before deciding a schedule never runs (covers leap-day schedules). */
const SEARCH_YEARS = 30;

function matchesDay(schedule: CronSchedule, date: Date): boolean {
  const dom = schedule.dayOfMonth.values.includes(date.getDate());
  const dow = schedule.dayOfWeek.values.includes(date.getDay());
  if (schedule.dayOfMonth.star || schedule.dayOfWeek.star) return dom && dow;
  return dom || dow;
}

/** The next `count` run times strictly after `from`, in the local time zone. */
export function nextCronRuns(schedule: CronSchedule, from: Date, count: number): Date[] {
  const runs: Date[] = [];
  const date = new Date(from.getTime());
  date.setSeconds(0, 0);
  date.setMinutes(date.getMinutes() + 1);
  const lastYear = from.getFullYear() + SEARCH_YEARS;
  const months = new Set(schedule.month.values);
  const hours = new Set(schedule.hour.values);
  const minutes = new Set(schedule.minute.values);

  while (runs.length < count && date.getFullYear() <= lastYear) {
    const before = date.getTime();
    if (!months.has(date.getMonth() + 1)) {
      date.setMonth(date.getMonth() + 1, 1);
      date.setHours(0, 0, 0, 0);
    } else if (!matchesDay(schedule, date)) {
      date.setDate(date.getDate() + 1);
      date.setHours(0, 0, 0, 0);
    } else if (!hours.has(date.getHours())) {
      date.setHours(date.getHours() + 1, 0, 0, 0);
    } else if (!minutes.has(date.getMinutes())) {
      date.setMinutes(date.getMinutes() + 1, 0, 0);
    } else {
      runs.push(new Date(date.getTime()));
      date.setMinutes(date.getMinutes() + 1, 0, 0);
    }
    // Daylight-saving changes can move local time backwards; always make progress.
    if (date.getTime() <= before) date.setTime(before + 60_000);
  }
  return runs;
}

/* ───────────────────────── Description ───────────────────────── */

const pad2 = (n: number) => String(n).padStart(2, "0");
const time = (hour: number, minute: number) => `${pad2(hour)}:${pad2(minute)}`;

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** "a", "a and b", "a, b and c". */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const isSingle = (field: CronField) => field.parts.every((p) => !p.wildcard && p.start === p.end);

interface Wording {
  singular: string;
  plural: string;
  format: (value: number) => string;
  /** Named values (months, weekdays) read without the unit: "Monday" rather than "day 1". */
  named?: boolean;
  /** "every 2nd day" instead of "every 2 days". */
  ordinalSteps?: boolean;
}

function stepPhrase(step: number, w: Wording): string {
  return w.ordinalSteps ? `every ${ordinal(step)} ${w.singular}` : `every ${step} ${w.plural}`;
}

function describePart(part: CronPart, w: Wording): string {
  const value = (v: number) => (w.named ? w.format(v) : `${w.singular} ${w.format(v)}`);
  if (part.wildcard) return part.step === 1 ? `every ${w.singular}` : stepPhrase(part.step, w);
  if (part.open) return `${stepPhrase(part.step, w)} starting ${w.named ? "in" : "at"} ${value(part.start)}`;
  if (part.start === part.end) return value(part.start);
  const range = w.named
    ? `${w.format(part.start)} through ${w.format(part.end)}`
    : `${w.plural} ${w.format(part.start)} through ${w.format(part.end)}`;
  return part.step === 1 ? range : `${stepPhrase(part.step, w)} from ${range.replace(`${w.plural} `, "")}`;
}

function describeField(field: CronField, w: Wording): string {
  if (isSingle(field)) {
    const items = field.parts.map((p) => w.format(p.start));
    if (w.named) return joinList(items);
    return `${items.length === 1 ? w.singular : w.plural} ${joinList(items)}`;
  }
  return joinList(field.parts.map((part) => describePart(part, w)));
}

const MINUTE_WORDS: Wording = { singular: "minute", plural: "minutes", format: String };
const DAY_WORDS: Wording = { singular: "day", plural: "days", format: String, ordinalSteps: true };
const MONTH_WORDS: Wording = {
  singular: "month",
  plural: "months",
  format: (v) => MONTH_NAMES[v - 1],
  named: true,
  ordinalSteps: true,
};
const WEEKDAY_WORDS: Wording = {
  singular: "day of the week",
  plural: "days of the week",
  format: (v) => WEEKDAY_NAMES[v % 7],
  named: true,
  ordinalSteps: true,
};

function describeHours(field: CronField): string {
  if (field.full && field.parts.every((p) => p.step === 1)) return "";
  if (isSingle(field)) {
    const hours = field.parts.map((p) => p.start);
    return hours.length === 1
      ? `between ${time(hours[0], 0)} and ${time(hours[0], 59)}`
      : `during the ${joinList(hours.map((h) => time(h, 0)))} hours`;
  }
  return joinList(
    field.parts.map((part) => {
      if (part.wildcard) return part.step === 1 ? "every hour" : `every ${part.step} hours`;
      if (part.open) return `every ${part.step} hours starting at ${time(part.start, 0)}`;
      if (part.start === part.end) return `between ${time(part.start, 0)} and ${time(part.start, 59)}`;
      return part.step === 1
        ? `between ${time(part.start, 0)} and ${time(part.end, 59)}`
        : `every ${part.step} hours from ${time(part.start, 0)} through ${time(part.end, 0)}`;
    }),
  );
}

function describeTime(schedule: CronSchedule): string {
  const { minute, hour } = schedule;
  if (isSingle(minute) && isSingle(hour) && minute.values.length * hour.values.length <= 12) {
    const times = hour.values.flatMap((h) => minute.values.map((m) => time(h, m)));
    return `At ${joinList(times)}`;
  }
  const everyHour = hour.full && hour.parts.every((p) => p.step === 1);
  if (isSingle(minute) && everyHour) {
    return `At ${minute.values.length === 1 ? "minute" : "minutes"} ${joinList(minute.values.map(String))} of every hour`;
  }
  const minutes = minute.full && minute.parts.every((p) => p.step === 1) ? "every minute" : describeField(minute, MINUTE_WORDS);
  const minutePhrase = isSingle(minute) ? `at ${minutes}` : minutes;
  const hours = describeHours(hour);
  const text = hours ? `${minutePhrase}, ${hours}` : minutePhrase;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function describeDays(schedule: CronSchedule): string {
  const { dayOfMonth, dayOfWeek } = schedule;
  const dom = dayOfMonth.full ? "" : `on ${describeField(dayOfMonth, DAY_WORDS)} of the month`;
  const dow = dayOfWeek.full ? "" : `on ${describeField(dayOfWeek, WEEKDAY_WORDS)}`;
  if (dom && dow) return dayOfMonth.star || dayOfWeek.star ? `${dom}, but only ${dow}` : `${dom} or ${dow}`;
  return dom || dow;
}

function describeMonths(field: CronField): string {
  if (field.full) return "";
  const text = describeField(field, MONTH_WORDS);
  return text.startsWith("every") ? text : `in ${text}`;
}

/** Plain-English description, e.g. "At 09:30, on Monday through Friday." */
export function describeCron(schedule: CronSchedule): string {
  const parts = [describeTime(schedule), describeDays(schedule), describeMonths(schedule.month)].filter(Boolean);
  return `${parts.join(", ")}.`;
}

/** What one field matches, for the field-by-field breakdown. */
export function describeCronField(field: CronField): string {
  if (field.full && field.parts.every((p) => p.step === 1)) return "Any";
  const format =
    field.name === "month"
      ? (v: number) => MONTH_NAMES[v - 1].slice(0, 3)
      : field.name === "dayOfWeek"
        ? (v: number) => WEEKDAY_NAMES[v].slice(0, 3)
        : String;
  const shown = field.values.slice(0, 16).map(format).join(", ");
  return field.values.length > 16 ? `${shown} … (${field.values.length} values)` : shown;
}

/* ───────────────────────── Builder ───────────────────────── */

/** "1,2,3,5" → "1-3,5". */
export function compressList(values: number[]): string {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  const groups: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    groups.push(j - i >= 2 ? `${sorted[i]}-${sorted[j]}` : sorted.slice(i, j + 1).join(","));
    i = j;
  }
  return groups.join(",");
}

export type CronPreset =
  | { kind: "minutes"; interval: number }
  | { kind: "hourly"; minute: number; interval: number }
  | { kind: "daily"; hour: number; minute: number }
  | { kind: "weekly"; days: number[]; hour: number; minute: number }
  | { kind: "monthly"; day: number; hour: number; minute: number };

const every = (interval: number) => (interval <= 1 ? "*" : `*/${interval}`);

/** Build a 5-field expression from one of the simple schedule presets. */
export function buildCronExpression(preset: CronPreset): string {
  switch (preset.kind) {
    case "minutes":
      return `${every(preset.interval)} * * * *`;
    case "hourly":
      return `${preset.minute} ${every(preset.interval)} * * *`;
    case "daily":
      return `${preset.minute} ${preset.hour} * * *`;
    case "weekly":
      return `${preset.minute} ${preset.hour} * * ${preset.days.length ? compressList(preset.days) : "*"}`;
    case "monthly":
      return `${preset.minute} ${preset.hour} ${preset.day} * *`;
  }
}
