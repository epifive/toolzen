/**
 * Time zone maths on top of the browser's IANA database (Intl). Offsets are
 * looked up for a specific instant, so daylight-saving time is always correct.
 */

/** Used when the browser can't list its time zones (older engines). */
const FALLBACK_ZONES = [
  "UTC",
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Phoenix",
  "America/Chicago",
  "America/New_York",
  "America/Toronto",
  "America/Mexico_City",
  "America/Bogota",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Atlantic/Reykjavik",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Lisbon",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Warsaw",
  "Europe/Athens",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Africa/Nairobi",
  "Asia/Dubai",
  "Asia/Tehran",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Manila",
  "Asia/Seoul",
  "Asia/Tokyo",
  "Australia/Perth",
  "Australia/Adelaide",
  "Australia/Brisbane",
  "Australia/Sydney",
  "Pacific/Auckland",
];

/** Every IANA time zone the browser knows, plus UTC, sorted by name. */
export function listTimeZones(): string[] {
  let zones: string[];
  try {
    zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : FALLBACK_ZONES;
  } catch {
    zones = FALLBACK_ZONES;
  }
  return [...new Set(["UTC", ...zones])].sort((a, b) => a.localeCompare(b));
}

/** The visitor's own time zone, or UTC when the browser doesn't report one. */
export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** "America/Argentina/Buenos_Aires" → "Buenos Aires (America/Argentina)". */
export function zoneLabel(zone: string): string {
  const slash = zone.lastIndexOf("/");
  if (slash === -1) return zone;
  return `${zone.slice(slash + 1).replace(/_/g, " ")} (${zone.slice(0, slash).replace(/_/g, " ")})`;
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(zone: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    partsFormatters.set(zone, f);
  }
  return f;
}

export interface WallTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/** The wall-clock time in `zone` at the given instant. */
export function wallTimeAt(instant: number, zone: string): WallTime & { second: number } {
  const values: Record<string, number> = {};
  for (const part of partsFormatter(zone).formatToParts(new Date(instant))) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour % 24,
    minute: values.minute,
    second: values.second,
  };
}

/** UTC offset of `zone` at the given instant, in minutes (east of UTC is positive). */
export function offsetMinutes(instant: number, zone: string): number {
  const w = wallTimeAt(instant, zone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  const flooredInstant = Math.floor(instant / 1000) * 1000;
  return Math.round((asUtc - flooredInstant) / 60_000);
}

export interface ZonedInstant {
  instant: number;
  /** True when the wall time doesn't exist in the zone (skipped by a forward DST change). */
  skipped: boolean;
  /** True when the wall time occurs twice (a backward DST change); the earlier one is used. */
  ambiguous: boolean;
}

/** Convert a wall-clock time in `zone` to an instant. */
export function zonedToInstant(wall: WallTime, zone: string): ZonedInstant {
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  // Offsets a few hours either side cover every DST transition in the database.
  const before = offsetMinutes(asUtc - 12 * 3_600_000, zone);
  const after = offsetMinutes(asUtc + 12 * 3_600_000, zone);
  const candidates = [...new Set([before, after])]
    .map((offset) => asUtc - offset * 60_000)
    .filter((instant) => {
      const w = wallTimeAt(instant, zone);
      return w.year === wall.year && w.month === wall.month && w.day === wall.day && w.hour === wall.hour && w.minute === wall.minute;
    })
    .sort((a, b) => a - b);

  if (candidates.length) return { instant: candidates[0], skipped: false, ambiguous: candidates.length > 1 };
  // The time falls in a gap: interpret it with the offset in force before the change, like most calendars do.
  return { instant: asUtc - before * 60_000, skipped: true, ambiguous: false };
}

/** "UTC+5:30", "UTC−4", "UTC". */
export function formatOffset(minutes: number): string {
  if (minutes === 0) return "UTC";
  const sign = minutes > 0 ? "+" : "−";
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const rest = abs % 60;
  return `UTC${sign}${hours}${rest ? `:${String(rest).padStart(2, "0")}` : ""}`;
}

/**
 * Whether daylight-saving (summer) time is in effect: the offset is larger than
 * the zone's smaller offset of that year (January vs July).
 */
export function isDaylightSaving(instant: number, zone: string): boolean {
  const year = new Date(instant).getUTCFullYear();
  const january = offsetMinutes(Date.UTC(year, 0, 1), zone);
  const july = offsetMinutes(Date.UTC(year, 6, 1), zone);
  return january !== july && offsetMinutes(instant, zone) > Math.min(january, july);
}

/** Short zone name such as "EST" or "GMT+5:30", as the browser reports it. */
export function zoneAbbreviation(instant: number, zone: string): string {
  const part = new Intl.DateTimeFormat(undefined, { timeZone: zone, timeZoneName: "short" })
    .formatToParts(new Date(instant))
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? "";
}

/** Whole calendar days between two wall-clock dates (e.g. +1 when the target is already "tomorrow"). */
export function dayShift(from: WallTime, to: WallTime): number {
  return Math.round(
    (Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day)) / 86_400_000,
  );
}
