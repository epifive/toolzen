"use client";

import { useMemo, useState } from "react";
import { Clock, Plus, X } from "lucide-react";
import { CopyButton, ErrorText, Panel, Segmented } from "@/components/tool-ui";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { useTrackResult } from "@/tools/lib/calc-ui";
import {
  dayShift,
  formatOffset,
  isDaylightSaving,
  listTimeZones,
  localTimeZone,
  offsetMinutes,
  wallTimeAt,
  zoneAbbreviation,
  zoneLabel,
  zonedToInstant,
  type WallTime,
} from "@/tools/lib/timezones";

type HourCycle = "h12" | "h23";

const DEFAULT_TARGETS = ["UTC", "America/New_York", "Europe/London", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney"];
const MAX_ZONES = 20;

const pad = (n: number) => String(n).padStart(2, "0");

function toInputs(wall: WallTime): { date: string; time: string } {
  return { date: `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`, time: `${pad(wall.hour)}:${pad(wall.minute)}` };
}

function parseInputs(date: string, time: string): WallTime | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})/.exec(time);
  if (!d || !t) return null;
  const wall = { year: Number(d[1]), month: Number(d[2]), day: Number(d[3]), hour: Number(t[1]), minute: Number(t[2]) };
  const check = new Date(Date.UTC(wall.year, wall.month - 1, wall.day));
  if (check.getUTCMonth() !== wall.month - 1 || wall.hour > 23 || wall.minute > 59) return null;
  return wall;
}

function formatInZone(instant: number, zone: string, hourCycle: HourCycle): { date: string; time: string } {
  const date = new Intl.DateTimeFormat(undefined, {
    timeZone: zone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(instant);
  const time = new Intl.DateTimeFormat(undefined, { timeZone: zone, hour: "numeric", minute: "2-digit", hourCycle }).format(
    instant,
  );
  return { date, time };
}

export default function TimeZoneConverter() {
  const [zones] = useState(listTimeZones);
  const [source, setSource] = useState(localTimeZone);
  const [inputs, setInputs] = useState(() => toInputs(wallTimeAt(Date.now(), localTimeZone())));
  const [targets, setTargets] = useState<string[]>(() => DEFAULT_TARGETS.filter((z) => z !== localTimeZone()));
  const [toAdd, setToAdd] = useState("");
  const [hourCycle, setHourCycle] = useState<HourCycle>("h23");

  const wall = parseInputs(inputs.date, inputs.time);
  const converted = wall ? zonedToInstant(wall, source) : null;
  const instant = converted?.instant ?? null;

  useTrackResult(instant);

  const rows = useMemo(() => {
    if (instant === null) return [];
    const sourceWall = wallTimeAt(instant, source);
    return [source, ...targets].map((zone) => ({
      zone,
      offset: offsetMinutes(instant, zone),
      dst: isDaylightSaving(instant, zone),
      abbreviation: zoneAbbreviation(instant, zone),
      shift: dayShift(sourceWall, wallTimeAt(instant, zone)),
      ...formatInZone(instant, zone, hourCycle),
    }));
  }, [instant, source, targets, hourCycle]);

  const available = zones.filter((z) => z !== source && !targets.includes(z));
  const addValue = available.includes(toAdd) ? toAdd : (available[0] ?? "");
  const summary = rows.map((r) => `${zoneLabel(r.zone)}: ${r.date} ${r.time} (${formatOffset(r.offset)})`).join("\n");

  function setNow() {
    setInputs(toInputs(wallTimeAt(Date.now(), source)));
  }

  return (
    <div className="space-y-4">
      <Panel title="Date and time">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr]">
            <Field label="Date" htmlFor="tz-date">
              <Input
                id="tz-date"
                type="date"
                value={inputs.date}
                onChange={(e) => setInputs((prev) => ({ ...prev, date: e.target.value }))}
              />
            </Field>
            <Field label="Time" htmlFor="tz-time">
              <div className="flex gap-2">
                <Input
                  id="tz-time"
                  type="time"
                  value={inputs.time}
                  onChange={(e) => setInputs((prev) => ({ ...prev, time: e.target.value }))}
                />
                <Button variant="outline" onClick={setNow}>
                  <Clock aria-hidden />
                  Now
                </Button>
              </div>
            </Field>
            <Field label="In time zone" htmlFor="tz-source" className="sm:col-span-2 lg:col-span-1">
              <Select
                id="tz-source"
                value={source}
                onChange={(e) => {
                  const next = e.target.value;
                  setSource(next);
                  setTargets((prev) => prev.filter((z) => z !== next));
                }}
              >
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {zoneLabel(z)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {!wall ? <ErrorText>Enter a valid date and time.</ErrorText> : null}
          {converted?.skipped ? (
            <Alert tone="warning">
              This time doesn&apos;t exist in {zoneLabel(source)} because the clocks move forward for daylight saving. It is
              shown as if the change hadn&apos;t happened yet.
            </Alert>
          ) : null}
          {converted?.ambiguous ? (
            <Alert>
              This time happens twice in {zoneLabel(source)} because the clocks go back. The first occurrence is used.
            </Alert>
          ) : null}
        </div>
      </Panel>

      <Panel
        title="Converted times"
        actions={
          <>
            <Segmented<HourCycle>
              label="Clock format"
              value={hourCycle}
              onChange={setHourCycle}
              options={[
                { value: "h23", label: "24 h" },
                { value: "h12", label: "12 h" },
              ]}
            />
            <CopyButton text={summary} label="Copy all" />
          </>
        }
      >
        <ul className="divide-y divide-line">
          {rows.map((row, index) => (
            <li
              key={row.zone}
              className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-3", index === 0 && "rounded-lg bg-primary-soft")}
            >
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate font-medium text-ink">{zoneLabel(row.zone)}</p>
                <p className="text-xs text-muted">
                  {formatOffset(row.offset)}
                  {row.abbreviation && row.abbreviation !== formatOffset(row.offset) ? ` · ${row.abbreviation}` : ""}
                  {row.dst ? " · Daylight saving time" : ""}
                  {index === 0 ? " · Source" : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-xl font-semibold text-ink tabular-nums">{row.time}</p>
                <p className="text-xs text-muted">
                  {row.date}
                  {row.shift !== 0 ? (
                    <span className="ml-1 font-medium text-primary">
                      ({row.shift > 0 ? "+" : "−"}
                      {Math.abs(row.shift)} {Math.abs(row.shift) === 1 ? "day" : "days"})
                    </span>
                  ) : null}
                </p>
              </div>
              {index > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2"
                  aria-label={`Remove ${zoneLabel(row.zone)}`}
                  onClick={() => setTargets((prev) => prev.filter((z) => z !== row.zone))}
                >
                  <X aria-hidden />
                </Button>
              ) : (
                <span aria-hidden className="w-8" />
              )}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-end">
          <Field label="Add a time zone" htmlFor="tz-add" className="min-w-0 flex-1">
            <Select id="tz-add" value={addValue} onChange={(e) => setToAdd(e.target.value)} disabled={!available.length}>
              {available.map((z) => (
                <option key={z} value={z}>
                  {zoneLabel(z)}
                </option>
              ))}
            </Select>
          </Field>
          <Button
            variant="secondary"
            disabled={!addValue || targets.length >= MAX_ZONES}
            onClick={() => setTargets((prev) => [...prev, addValue])}
          >
            <Plus aria-hidden />
            Add
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted">
          Offsets and daylight saving time come from your browser&apos;s time zone database for the chosen date.
        </p>
      </Panel>
    </div>
  );
}
