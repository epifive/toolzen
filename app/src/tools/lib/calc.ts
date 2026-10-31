/**
 * Pure helpers shared by the calculator tools. Nothing here touches the DOM,
 * so every function can be reasoned about (and tested) in isolation.
 */

/* ───────────────────────── Numbers ───────────────────────── */

/** Parse the value of a numeric input. Returns null for empty or invalid input. */
export function parseNumber(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = JSON.stringify(options);
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(undefined, options);
    formatters.set(key, f);
  }
  return f;
}

/** Locale-aware number with a fixed range of decimals, e.g. 1,234.5 */
export function formatNumber(value: number, maxDecimals = 2, minDecimals = 0): string {
  if (!Number.isFinite(value)) return "–";
  return formatter({ minimumFractionDigits: minDecimals, maximumFractionDigits: maxDecimals }).format(value);
}

/** Locale-aware amount of money without a currency symbol, always with two decimals. */
export function formatAmount(value: number): string {
  return formatNumber(value, 2, 2);
}

/**
 * Up to `digits` significant digits. Very large and very small values switch to
 * scientific notation so they stay readable.
 */
export function formatSignificant(value: number, digits = 10): string {
  if (!Number.isFinite(value)) return "–";
  const abs = Math.abs(value);
  const scientific = abs !== 0 && (abs >= 1e15 || abs < 1e-6);
  return formatter({
    maximumSignificantDigits: digits,
    notation: scientific ? "scientific" : "standard",
  }).format(value);
}

/* ───────────────────────── Dates ───────────────────────── */

const DAY_MS = 86_400_000;

/**
 * Dates are handled as UTC midnights so that daylight-saving changes never
 * add or remove an hour from a day count.
 */
export function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

export function toIsoDate(date: Date): string {
  const y = String(date.getUTCFullYear()).padStart(4, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Today's date in the visitor's time zone, as YYYY-MM-DD. */
export function todayIso(): string {
  const now = new Date();
  return toIsoDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Number of days in a month; `month` is 0-based like Date#getUTCMonth. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Add calendar months. When the target month is shorter, the day is clamped
 * to its last day (31 January + 1 month = 28 or 29 February).
 */
export function addMonths(date: Date, months: number): Date {
  const total = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  const day = Math.min(date.getUTCDate(), daysInMonth(year, month));
  return new Date(Date.UTC(year, month, day));
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

export interface CalendarDifference {
  years: number;
  months: number;
  days: number;
  /** Complete months between the two dates. */
  totalMonths: number;
  totalDays: number;
}

/** Calendar difference between two dates. `start` must not be after `end`. */
export function calendarDifference(start: Date, end: Date): CalendarDifference {
  let totalMonths = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
  if (addMonths(start, totalMonths).getTime() > end.getTime()) totalMonths -= 1;
  const anchor = addMonths(start, totalMonths);
  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    days: daysBetween(anchor, end),
    totalMonths,
    totalDays: daysBetween(start, end),
  };
}

/** Monday–Friday days in the half-open range [start, end). */
export function countBusinessDays(start: Date, end: Date): number {
  const total = daysBetween(start, end);
  if (total <= 0) return 0;
  const fullWeeks = Math.floor(total / 7);
  let count = fullWeeks * 5;
  const startDay = start.getUTCDay();
  for (let i = 0; i < total % 7; i++) {
    const weekday = (startDay + i) % 7;
    if (weekday !== 0 && weekday !== 6) count++;
  }
  return count;
}

export type DateUnit = "days" | "weeks" | "months" | "years";

/** Add (or subtract, with a negative amount) a number of units to a date. */
export function addToDate(date: Date, amount: number, unit: DateUnit): Date {
  switch (unit) {
    case "days":
      return addDays(date, amount);
    case "weeks":
      return addDays(date, amount * 7);
    case "months":
      return addMonths(date, amount);
    case "years":
      return addMonths(date, amount * 12);
  }
}

/** Birthday in a given year. 29 February falls back to 28 February in common years. */
export function birthdayInYear(birth: Date, year: number): Date {
  const month = birth.getUTCMonth();
  const day = Math.min(birth.getUTCDate(), daysInMonth(year, month));
  return new Date(Date.UTC(year, month, day));
}

export interface AgeDetails extends CalendarDifference {
  totalWeeks: number;
  totalHours: number;
  nextBirthday: Date;
  daysUntilBirthday: number;
  /** Age reached on the next birthday. */
  nextAge: number;
}

export function ageDetails(birth: Date, on: Date): AgeDetails {
  const diff = calendarDifference(birth, on);
  let next = birthdayInYear(birth, on.getUTCFullYear());
  if (next.getTime() < on.getTime()) next = birthdayInYear(birth, on.getUTCFullYear() + 1);
  return {
    ...diff,
    totalWeeks: Math.floor(diff.totalDays / 7),
    totalHours: diff.totalDays * 24,
    nextBirthday: next,
    daysUntilBirthday: daysBetween(on, next),
    nextAge: next.getUTCFullYear() - birth.getUTCFullYear(),
  };
}

export function formatLongDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function weekdayName(date: Date): string {
  return date.toLocaleDateString(undefined, { timeZone: "UTC", weekday: "long" });
}

/** "1 year", "3 months", … */
export function plural(value: number, unit: string): string {
  return `${formatNumber(value, 0)} ${unit}${value === 1 ? "" : "s"}`;
}

/* ───────────────────────── Percentages ───────────────────────── */

export function percentOf(percent: number, value: number): number {
  return (percent / 100) * value;
}

/** What percent `part` is of `whole`. Null when `whole` is zero. */
export function percentageOf(part: number, whole: number): number | null {
  return whole === 0 ? null : (part / whole) * 100;
}

/** Percentage change from `from` to `to`. Null when `from` is zero. */
export function percentChange(from: number, to: number): number | null {
  return from === 0 ? null : ((to - from) / Math.abs(from)) * 100;
}

export function applyPercent(value: number, percent: number, direction: "increase" | "decrease"): number {
  return value * (1 + (direction === "increase" ? percent : -percent) / 100);
}

/* ───────────────────────── BMI ───────────────────────── */

export const INCH_M = 0.0254;
export const POUND_KG = 0.45359237;

export function calculateBmi(weightKg: number, heightM: number): number {
  return weightKg / (heightM * heightM);
}

export interface BmiCategory {
  label: string;
  /** Lower bound (inclusive). */
  min: number;
  /** Tailwind classes for the scale segment. */
  tone: string;
}

/** World Health Organization adult BMI classification. */
export const BMI_CATEGORIES: BmiCategory[] = [
  { label: "Underweight", min: 0, tone: "bg-sky-400 dark:bg-sky-500" },
  { label: "Healthy weight", min: 18.5, tone: "bg-emerald-500" },
  { label: "Overweight", min: 25, tone: "bg-amber-400 dark:bg-amber-500" },
  { label: "Obesity class I", min: 30, tone: "bg-orange-500" },
  { label: "Obesity class II", min: 35, tone: "bg-red-500" },
  { label: "Obesity class III", min: 40, tone: "bg-red-700" },
];

export function bmiCategory(bmi: number): BmiCategory {
  return [...BMI_CATEGORIES].reverse().find((c) => bmi >= c.min) ?? BMI_CATEGORIES[0];
}

/** Weight range (kg) that gives a BMI of 18.5 to 24.9 for the given height. */
export function healthyWeightRange(heightM: number): [number, number] {
  const squared = heightM * heightM;
  return [18.5 * squared, 24.9 * squared];
}

/* ───────────────────────── Loans ───────────────────────── */

export interface AmortizationRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface LoanResult {
  emi: number;
  totalInterest: number;
  totalPayment: number;
  schedule: AmortizationRow[];
}

/**
 * Equated monthly instalment and full amortization schedule.
 * EMI = P × r × (1 + r)^n ÷ ((1 + r)^n − 1); with 0% interest it is simply P ÷ n.
 */
export function calculateLoan(principal: number, annualRatePercent: number, months: number): LoanResult {
  const r = annualRatePercent / 12 / 100;
  const growth = (1 + r) ** months;
  const emi = r === 0 ? principal / months : (principal * r * growth) / (growth - 1);

  const schedule: AmortizationRow[] = [];
  let balance = principal;
  for (let month = 1; month <= months; month++) {
    const interest = balance * r;
    // The last payment clears whatever floating-point residue is left.
    const principalPart = month === months ? balance : emi - interest;
    balance = Math.max(0, balance - principalPart);
    schedule.push({ month, payment: principalPart + interest, principal: principalPart, interest, balance });
  }

  const totalPayment = schedule.reduce((sum, row) => sum + row.payment, 0);
  return { emi, totalInterest: totalPayment - principal, totalPayment, schedule };
}

export interface AmortizationYear {
  year: number;
  payment: number;
  principal: number;
  interest: number;
  /** Balance left at the end of the year. */
  balance: number;
  rows: AmortizationRow[];
}

/** Group a schedule into loan years (months 1–12 are year 1, and so on). */
export function groupByYear(schedule: AmortizationRow[]): AmortizationYear[] {
  const years: AmortizationYear[] = [];
  for (const row of schedule) {
    const year = Math.ceil(row.month / 12);
    let group = years[years.length - 1];
    if (!group || group.year !== year) {
      group = { year, payment: 0, principal: 0, interest: 0, balance: 0, rows: [] };
      years.push(group);
    }
    group.payment += row.payment;
    group.principal += row.principal;
    group.interest += row.interest;
    group.balance = row.balance;
    group.rows.push(row);
  }
  return years;
}

export function scheduleToCsv(schedule: AmortizationRow[]): string {
  const lines = ["Month,Year,Payment,Principal,Interest,Balance"];
  for (const row of schedule) {
    lines.push(
      [row.month, Math.ceil(row.month / 12), row.payment, row.principal, row.interest, row.balance]
        .map((v, i) => (i < 2 ? String(v) : v.toFixed(2)))
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}

/* ───────────────────────── Discounts & tax ───────────────────────── */

export interface DiscountInput {
  price: number;
  discount: number;
  discountType: "percent" | "amount";
  /** Optional second discount, in percent, applied after the first. */
  secondPercent: number;
  /** Optional sales tax, in percent, applied to the discounted price. */
  taxPercent: number;
}

export interface DiscountResult {
  firstDiscount: number;
  secondDiscount: number;
  subtotal: number;
  savings: number;
  effectivePercent: number;
  tax: number;
  total: number;
}

export function calculateDiscount({ price, discount, discountType, secondPercent, taxPercent }: DiscountInput): DiscountResult {
  const firstDiscount = discountType === "percent" ? price * (discount / 100) : discount;
  const afterFirst = price - firstDiscount;
  const secondDiscount = afterFirst * (secondPercent / 100);
  const subtotal = afterFirst - secondDiscount;
  const savings = price - subtotal;
  const tax = subtotal * (taxPercent / 100);
  return {
    firstDiscount,
    secondDiscount,
    subtotal,
    savings,
    effectivePercent: price === 0 ? 0 : (savings / price) * 100,
    tax,
    total: subtotal + tax,
  };
}

export interface TaxResult {
  net: number;
  tax: number;
  gross: number;
}

/**
 * Add tax to a net amount (exclusive) or extract it from a gross amount (inclusive).
 * Net = Gross ÷ (1 + rate ÷ 100).
 */
export function calculateTax(amount: number, ratePercent: number, mode: "add" | "remove"): TaxResult {
  const factor = 1 + ratePercent / 100;
  const net = mode === "add" ? amount : amount / factor;
  const gross = mode === "add" ? amount * factor : amount;
  return { net, tax: gross - net, gross };
}

/* ───────────────────────── Units ───────────────────────── */

export interface Unit {
  id: string;
  name: string;
  symbol: string;
  /** Converts a value in this unit to the category's base unit. */
  toBase: (value: number) => number;
  /** Converts a value in the base unit to this unit. */
  fromBase: (value: number) => number;
}

export interface UnitCategory {
  id: string;
  name: string;
  units: Unit[];
  defaultFrom: string;
  defaultTo: string;
}

/** A unit that is an exact multiple of the base unit. */
function linear(id: string, name: string, symbol: string, factor: number): Unit {
  return { id, name, symbol, toBase: (v) => v * factor, fromBase: (v) => v / factor };
}

const STANDARD_GRAVITY = 9.80665;
const FOOT_M = 0.3048;
/** One foot-pound force in joules. */
const FOOT_LBF_J = FOOT_M * POUND_KG * STANDARD_GRAVITY;
/** One International Table BTU in joules. */
const BTU_IT_J = 1055.05585262;

export const UNIT_CATEGORIES: UnitCategory[] = [
  {
    id: "length",
    name: "Length",
    defaultFrom: "cm",
    defaultTo: "in",
    units: [
      linear("nm", "Nanometre", "nm", 1e-9),
      linear("um", "Micrometre", "μm", 1e-6),
      linear("mm", "Millimetre", "mm", 1e-3),
      linear("cm", "Centimetre", "cm", 1e-2),
      linear("m", "Metre", "m", 1),
      linear("km", "Kilometre", "km", 1000),
      linear("in", "Inch", "in", INCH_M),
      linear("ft", "Foot", "ft", FOOT_M),
      linear("yd", "Yard", "yd", 0.9144),
      linear("mi", "Mile", "mi", 1609.344),
      linear("nmi", "Nautical mile", "nmi", 1852),
    ],
  },
  {
    id: "mass",
    name: "Weight / mass",
    defaultFrom: "kg",
    defaultTo: "lb",
    units: [
      linear("ug", "Microgram", "μg", 1e-9),
      linear("mg", "Milligram", "mg", 1e-6),
      linear("g", "Gram", "g", 1e-3),
      linear("kg", "Kilogram", "kg", 1),
      linear("t", "Tonne (metric)", "t", 1000),
      linear("ct", "Carat", "ct", 2e-4),
      linear("oz", "Ounce", "oz", POUND_KG / 16),
      linear("lb", "Pound", "lb", POUND_KG),
      linear("st", "Stone", "st", POUND_KG * 14),
      linear("ston", "Short ton (US)", "ton", POUND_KG * 2000),
      linear("lton", "Long ton (UK)", "LT", POUND_KG * 2240),
    ],
  },
  {
    id: "temperature",
    name: "Temperature",
    defaultFrom: "c",
    defaultTo: "f",
    units: [
      { id: "c", name: "Celsius", symbol: "°C", toBase: (v) => v, fromBase: (v) => v },
      { id: "f", name: "Fahrenheit", symbol: "°F", toBase: (v) => ((v - 32) * 5) / 9, fromBase: (v) => (v * 9) / 5 + 32 },
      { id: "k", name: "Kelvin", symbol: "K", toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
      {
        id: "r",
        name: "Rankine",
        symbol: "°R",
        toBase: (v) => ((v - 491.67) * 5) / 9,
        fromBase: (v) => ((v + 273.15) * 9) / 5,
      },
    ],
  },
  {
    id: "area",
    name: "Area",
    defaultFrom: "m2",
    defaultTo: "ft2",
    units: [
      linear("mm2", "Square millimetre", "mm²", 1e-6),
      linear("cm2", "Square centimetre", "cm²", 1e-4),
      linear("m2", "Square metre", "m²", 1),
      linear("ha", "Hectare", "ha", 1e4),
      linear("km2", "Square kilometre", "km²", 1e6),
      linear("in2", "Square inch", "in²", INCH_M ** 2),
      linear("ft2", "Square foot", "ft²", FOOT_M ** 2),
      linear("yd2", "Square yard", "yd²", 0.9144 ** 2),
      linear("ac", "Acre", "ac", 4046.8564224),
      linear("mi2", "Square mile", "mi²", 1609.344 ** 2),
    ],
  },
  {
    id: "volume",
    name: "Volume",
    defaultFrom: "l",
    defaultTo: "usgal",
    units: [
      linear("ml", "Millilitre", "mL", 1e-3),
      linear("l", "Litre", "L", 1),
      linear("cm3", "Cubic centimetre", "cm³", 1e-3),
      linear("m3", "Cubic metre", "m³", 1000),
      linear("in3", "Cubic inch", "in³", 0.016387064),
      linear("ft3", "Cubic foot", "ft³", 28.316846592),
      linear("ustsp", "Teaspoon (US)", "tsp", 3.785411784 / 768),
      linear("ustbsp", "Tablespoon (US)", "tbsp", 3.785411784 / 256),
      linear("usfloz", "Fluid ounce (US)", "fl oz", 3.785411784 / 128),
      linear("uscup", "Cup (US)", "cup", 3.785411784 / 16),
      linear("uspt", "Pint (US)", "pt", 3.785411784 / 8),
      linear("usqt", "Quart (US)", "qt", 3.785411784 / 4),
      linear("usgal", "Gallon (US)", "gal", 3.785411784),
      linear("ukfloz", "Fluid ounce (imperial)", "fl oz", 4.54609 / 160),
      linear("ukpt", "Pint (imperial)", "pt", 4.54609 / 8),
      linear("ukgal", "Gallon (imperial)", "gal", 4.54609),
    ],
  },
  {
    id: "speed",
    name: "Speed",
    defaultFrom: "kmh",
    defaultTo: "mph",
    units: [
      linear("ms", "Metres per second", "m/s", 1),
      linear("kmh", "Kilometres per hour", "km/h", 1 / 3.6),
      linear("mph", "Miles per hour", "mph", 0.44704),
      linear("fts", "Feet per second", "ft/s", FOOT_M),
      linear("kn", "Knot", "kn", 1852 / 3600),
    ],
  },
  {
    id: "time",
    name: "Time",
    defaultFrom: "h",
    defaultTo: "min",
    units: [
      linear("ns", "Nanosecond", "ns", 1e-9),
      linear("us", "Microsecond", "μs", 1e-6),
      linear("ms", "Millisecond", "ms", 1e-3),
      linear("s", "Second", "s", 1),
      linear("min", "Minute", "min", 60),
      linear("h", "Hour", "h", 3600),
      linear("d", "Day", "d", 86_400),
      linear("wk", "Week", "wk", 604_800),
      linear("mo", "Month (average)", "mo", 2_629_746),
      linear("yr", "Year (365.2425 days)", "yr", 31_556_952),
    ],
  },
  {
    id: "data",
    name: "Digital storage",
    defaultFrom: "GB",
    defaultTo: "GiB",
    units: [
      linear("bit", "Bit", "bit", 1 / 8),
      linear("B", "Byte", "B", 1),
      linear("kbit", "Kilobit", "kbit", 125),
      linear("Mbit", "Megabit", "Mbit", 125e3),
      linear("Gbit", "Gigabit", "Gbit", 125e6),
      linear("kB", "Kilobyte (1000 B)", "kB", 1e3),
      linear("MB", "Megabyte (1000² B)", "MB", 1e6),
      linear("GB", "Gigabyte (1000³ B)", "GB", 1e9),
      linear("TB", "Terabyte (1000⁴ B)", "TB", 1e12),
      linear("PB", "Petabyte (1000⁵ B)", "PB", 1e15),
      linear("KiB", "Kibibyte (1024 B)", "KiB", 1024),
      linear("MiB", "Mebibyte (1024² B)", "MiB", 1024 ** 2),
      linear("GiB", "Gibibyte (1024³ B)", "GiB", 1024 ** 3),
      linear("TiB", "Tebibyte (1024⁴ B)", "TiB", 1024 ** 4),
      linear("PiB", "Pebibyte (1024⁵ B)", "PiB", 1024 ** 5),
    ],
  },
  {
    id: "pressure",
    name: "Pressure",
    defaultFrom: "bar",
    defaultTo: "psi",
    units: [
      linear("pa", "Pascal", "Pa", 1),
      linear("hpa", "Hectopascal", "hPa", 100),
      linear("kpa", "Kilopascal", "kPa", 1000),
      linear("mpa", "Megapascal", "MPa", 1e6),
      linear("mbar", "Millibar", "mbar", 100),
      linear("bar", "Bar", "bar", 1e5),
      linear("atm", "Standard atmosphere", "atm", 101_325),
      linear("torr", "Torr", "Torr", 101_325 / 760),
      linear("mmhg", "Millimetre of mercury", "mmHg", 133.322387415),
      linear("inhg", "Inch of mercury", "inHg", 3386.389),
      linear("psi", "Pound per square inch", "psi", (POUND_KG * STANDARD_GRAVITY) / INCH_M ** 2),
    ],
  },
  {
    id: "energy",
    name: "Energy",
    defaultFrom: "kcal",
    defaultTo: "kj",
    units: [
      linear("ev", "Electronvolt", "eV", 1.602176634e-19),
      linear("erg", "Erg", "erg", 1e-7),
      linear("j", "Joule", "J", 1),
      linear("kj", "Kilojoule", "kJ", 1000),
      linear("mj", "Megajoule", "MJ", 1e6),
      linear("cal", "Calorie (thermochemical)", "cal", 4.184),
      linear("kcal", "Kilocalorie (food calorie)", "kcal", 4184),
      linear("wh", "Watt-hour", "Wh", 3600),
      linear("kwh", "Kilowatt-hour", "kWh", 3.6e6),
      linear("btu", "British thermal unit (IT)", "BTU", BTU_IT_J),
      linear("ftlbf", "Foot-pound force", "ft·lbf", FOOT_LBF_J),
    ],
  },
  {
    id: "power",
    name: "Power",
    defaultFrom: "hp",
    defaultTo: "kw",
    units: [
      linear("w", "Watt", "W", 1),
      linear("kw", "Kilowatt", "kW", 1000),
      linear("mw", "Megawatt", "MW", 1e6),
      linear("gw", "Gigawatt", "GW", 1e9),
      // Mechanical horsepower is defined as 550 ft·lbf/s.
      linear("hp", "Horsepower (mechanical)", "hp", 550 * FOOT_LBF_J),
      // Metric horsepower (PS, CV) is 75 kgf·m/s.
      linear("ps", "Horsepower (metric)", "PS", 75 * STANDARD_GRAVITY),
      linear("btuh", "BTU per hour", "BTU/h", BTU_IT_J / 3600),
      linear("kcalh", "Kilocalorie per hour", "kcal/h", 4184 / 3600),
      linear("ftlbfs", "Foot-pound force per second", "ft·lbf/s", FOOT_LBF_J),
    ],
  },
  {
    id: "angle",
    name: "Angle",
    defaultFrom: "deg",
    defaultTo: "rad",
    units: [
      linear("deg", "Degree", "°", 1),
      linear("rad", "Radian", "rad", 180 / Math.PI),
      linear("mrad", "Milliradian", "mrad", 0.18 / Math.PI),
      linear("grad", "Gradian", "gon", 0.9),
      linear("arcmin", "Arcminute", "′", 1 / 60),
      linear("arcsec", "Arcsecond", "″", 1 / 3600),
      linear("turn", "Turn (revolution)", "tr", 360),
    ],
  },
];

/** Look up a unit category by id. Throws for an unknown id, which is a programming error. */
export function getUnitCategory(id: string): UnitCategory {
  const category = UNIT_CATEGORIES.find((c) => c.id === id);
  if (!category) throw new Error(`Unknown unit category: ${id}`);
  return category;
}

/** Look up a unit inside a category. Throws for an unknown id, which is a programming error. */
export function getUnit(category: UnitCategory, id: string): Unit {
  const unit = category.units.find((u) => u.id === id);
  if (!unit) throw new Error(`Unknown ${category.id} unit: ${id}`);
  return unit;
}

export function convertUnit(value: number, from: Unit, to: Unit): number {
  return to.fromBase(from.toBase(value));
}

/* ───────────────────────── Validation ───────────────────────── */

export interface NumberRule {
  min?: number;
  max?: number;
  /** When true, `min` itself is not allowed (e.g. a height must be above 0). */
  exclusiveMin?: boolean;
  integer?: boolean;
}

export interface CheckedNumber {
  /** The parsed value, or null when the input is empty or invalid. */
  value: number | null;
  /** A message for the visitor; empty when the input is valid or still empty. */
  error: string;
}

/** Parse and validate a numeric input. Empty input is not an error, it simply has no value yet. */
export function checkNumber(input: string, rule: NumberRule = {}): CheckedNumber {
  if (!input.trim()) return { value: null, error: "" };
  const value = parseNumber(input);
  if (value === null) return { value: null, error: "Enter a valid number." };
  if (rule.integer && !Number.isInteger(value)) return { value: null, error: "Enter a whole number." };
  if (rule.min !== undefined && (rule.exclusiveMin ? value <= rule.min : value < rule.min)) {
    return {
      value: null,
      error: rule.exclusiveMin ? `Enter a number above ${formatNumber(rule.min)}.` : `Enter at least ${formatNumber(rule.min)}.`,
    };
  }
  if (rule.max !== undefined && value > rule.max) return { value: null, error: `Enter at most ${formatNumber(rule.max)}.` };
  return { value, error: "" };
}
