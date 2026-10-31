"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint, Input, Label, Select } from "@/components/ui/field";
import { CopyButton, ErrorText, Panel, Segmented, ToolColumns } from "@/components/tool-ui";
import { useTool } from "@/tools/context";
import {
  detectTimestampUnit,
  formatIsoInZone,
  formatRelativeTime,
  formatRfc2822,
  TIMESTAMP_UNIT_FACTOR,
  toDateTimeLocalValue,
  zonedWallTimeToUtc,
  type TimestampUnit,
} from "@/tools/lib/dev";
import { useNow, ValueList, ValueRow } from "@/tools/lib/dev-ui";

type UnitChoice = "auto" | "s" | "ms";

const UNIT_NAMES: Record<TimestampUnit, string> = { s: "seconds", ms: "milliseconds", us: "microseconds", ns: "nanoseconds" };
const MAX_DATE_MS = 8.64e15;

function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function timeZoneList(): string[] {
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return Array.from(new Set(["UTC", localTimeZone(), ...zones])).sort((a, b) => (a === "UTC" ? -1 : b === "UTC" ? 1 : a.localeCompare(b)));
}

function longDate(date: Date, timeZone: string): string {
  return date.toLocaleString(undefined, { timeZone, dateStyle: "full", timeStyle: "long" });
}

/** Live clock in its own component so only it re-renders ten times a second. */
function CurrentTime() {
  const now = useNow(100);
  const seconds = String(Math.floor(now / 1000));
  const ms = String(now);
  return (
    <Panel title="Current Unix time">
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { label: "Seconds", value: seconds },
          { label: "Milliseconds", value: ms },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between gap-3 rounded-lg border border-primary-line bg-primary-soft px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs text-muted">{label}</p>
              <p className="font-mono text-xl font-semibold tabular-nums text-ink sm:text-2xl">{value}</p>
            </div>
            <CopyButton text={value} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

export default function TimestampConverter() {
  const { track } = useTool();
  const tsId = useId();
  const tzId = useId();
  const dateId = useId();
  const zones = useMemo(() => timeZoneList(), []);
  const localZone = useMemo(() => localTimeZone(), []);
  const [timeZone, setTimeZone] = useState(localZone);
  const [timestamp, setTimestamp] = useState("");
  const [unitChoice, setUnitChoice] = useState<UnitChoice>("auto");
  const [wallTime, setWallTime] = useState("");
  const now = useNow(1000);

  const fromTimestamp = useMemo(() => {
    const text = timestamp.trim().replace(/[\s_,]/g, "");
    if (!text) return null;
    if (!/^-?\d+(\.\d+)?$/.test(text)) return { error: "Enter a Unix timestamp made of digits, for example 1714564800." };
    const value = Number(text);
    const unit: TimestampUnit = unitChoice === "auto" ? detectTimestampUnit(value) : unitChoice;
    const ms = value * TIMESTAMP_UNIT_FACTOR[unit];
    if (!Number.isFinite(ms) || Math.abs(ms) > MAX_DATE_MS) return { error: "This timestamp is outside the range of dates JavaScript can represent." };
    return { date: new Date(ms), unit };
  }, [timestamp, unitChoice]);

  const fromDate = useMemo(() => {
    if (!wallTime) return null;
    const ms = zonedWallTimeToUtc(wallTime, timeZone);
    return ms === null || Math.abs(ms) > MAX_DATE_MS ? null : new Date(ms);
  }, [wallTime, timeZone]);

  const converted = Boolean(fromTimestamp?.date || fromDate);
  useEffect(() => {
    if (converted) track();
  }, [converted, timestamp, wallTime, track]);

  return (
    <div className="space-y-4">
      <CurrentTime />

      <Panel>
        <Label htmlFor={tzId}>Time zone</Label>
        <Select id={tzId} value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className="sm:max-w-sm">
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replace(/_/g, " ")}
              {zone === localZone ? " (your time zone)" : ""}
            </option>
          ))}
        </Select>
        <Hint>Used for the local date below and to read the date you pick.</Hint>
      </Panel>

      <ToolColumns>
        <Panel title="Timestamp to date">
          <Label htmlFor={tsId}>Unix timestamp</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id={tsId}
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              placeholder="1714564800"
              inputMode="numeric"
              spellCheck={false}
              className="min-w-0 flex-1 font-mono"
            />
            <Button variant="outline" onClick={() => setTimestamp(String(Math.floor(Date.now() / 1000)))}>
              <Clock aria-hidden />
              Now
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Segmented
              label="Timestamp unit"
              value={unitChoice}
              onChange={setUnitChoice}
              options={[
                { value: "auto", label: "Auto-detect" },
                { value: "s", label: "Seconds" },
                { value: "ms", label: "Milliseconds" },
              ]}
            />
            {fromTimestamp?.date && unitChoice === "auto" ? (
              <span className="text-sm text-muted">Read as {UNIT_NAMES[fromTimestamp.unit]}</span>
            ) : null}
          </div>

          {fromTimestamp?.error ? (
            <div className="mt-4">
              <ErrorText>{fromTimestamp.error}</ErrorText>
            </div>
          ) : null}

          {fromTimestamp?.date ? (
            <ValueList className="mt-4">
              <ValueRow label={timeZone.replace(/_/g, " ")} value={longDate(fromTimestamp.date, timeZone)} mono={false} />
              <ValueRow label="UTC" value={longDate(fromTimestamp.date, "UTC")} mono={false} />
              <ValueRow label="ISO 8601 (UTC)" value={fromTimestamp.date.toISOString()} />
              <ValueRow label="ISO 8601 (zone)" value={formatIsoInZone(fromTimestamp.date, timeZone)} />
              <ValueRow label="RFC 2822" value={formatRfc2822(fromTimestamp.date, timeZone)} />
              <ValueRow label="Relative" value={formatRelativeTime(fromTimestamp.date.getTime(), now)} mono={false} />
            </ValueList>
          ) : null}
        </Panel>

        <Panel title="Date to timestamp">
          <Label htmlFor={dateId}>Date and time ({timeZone.replace(/_/g, " ")})</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id={dateId}
              type="datetime-local"
              step={1}
              value={wallTime}
              onChange={(e) => setWallTime(e.target.value)}
              className="min-w-0 flex-1"
            />
            <Button variant="outline" onClick={() => setWallTime(toDateTimeLocalValue(new Date(), timeZone))}>
              <Clock aria-hidden />
              Now
            </Button>
          </div>

          {fromDate ? (
            <ValueList className="mt-4">
              <ValueRow label="Unix seconds" value={String(Math.floor(fromDate.getTime() / 1000))} />
              <ValueRow label="Milliseconds" value={String(fromDate.getTime())} />
              <ValueRow label="ISO 8601 (UTC)" value={fromDate.toISOString()} />
              <ValueRow label="ISO 8601 (zone)" value={formatIsoInZone(fromDate, timeZone)} />
              <ValueRow label="Relative" value={formatRelativeTime(fromDate.getTime(), now)} mono={false} />
            </ValueList>
          ) : (
            <p className="mt-4 text-sm text-muted">Pick a date and time to see its Unix timestamp.</p>
          )}
        </Panel>
      </ToolColumns>
    </div>
  );
}
