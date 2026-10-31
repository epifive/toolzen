/**
 * Pure money maths for the finance calculators. Rates are passed as annual
 * percentages (8.5 means 8.5%) and amounts in any single currency.
 */

/* ───────────────────────── CSV ───────────────────────── */

function csvCell(value: string | number): string {
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Build a CSV document (RFC 4180, CRLF line endings). Non-integer numbers get two decimals. */
export function toCsv(header: string[], rows: Array<Array<string | number>>): string {
  return `${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

/* ───────────────────────── Compound interest ───────────────────────── */

export interface CompoundingOption {
  /** Compounding periods per year. */
  perYear: number;
  label: string;
}

export const COMPOUNDING_OPTIONS: CompoundingOption[] = [
  { perYear: 1, label: "Yearly" },
  { perYear: 2, label: "Half-yearly" },
  { perYear: 4, label: "Quarterly" },
  { perYear: 12, label: "Monthly" },
  { perYear: 365, label: "Daily" },
];

export interface GrowthYear {
  year: number;
  /** Money added during this year (the principal counts in year 1). */
  deposits: number;
  /** Interest earned during this year. */
  interest: number;
  totalDeposits: number;
  totalInterest: number;
  balance: number;
}

export interface GrowthResult {
  futureValue: number;
  totalDeposits: number;
  totalInterest: number;
  years: GrowthYear[];
}

/**
 * Monthly rate equivalent to an annual rate compounded `perYear` times a year,
 * so monthly contributions can be added without changing the effective yield.
 */
export function equivalentMonthlyRate(annualRatePercent: number, perYear: number): number {
  return (1 + annualRatePercent / 100 / perYear) ** (perYear / 12) - 1;
}

/**
 * Compound growth of a lump sum plus optional monthly contributions made at the
 * end of each month. Without contributions this equals P × (1 + r/n)^(n × t).
 */
export function compoundGrowth(
  principal: number,
  annualRatePercent: number,
  years: number,
  perYear: number,
  monthlyContribution = 0,
): GrowthResult {
  const monthlyRate = equivalentMonthlyRate(annualRatePercent, perYear);
  const rows: GrowthYear[] = [];
  let balance = principal;
  let totalDeposits = principal;
  let totalInterest = 0;

  for (let year = 1; year <= years; year++) {
    let interest = 0;
    for (let month = 0; month < 12; month++) {
      const earned = balance * monthlyRate;
      interest += earned;
      balance += earned + monthlyContribution;
    }
    const deposits = monthlyContribution * 12 + (year === 1 ? principal : 0);
    totalDeposits += monthlyContribution * 12;
    totalInterest += interest;
    rows.push({ year, deposits, interest, totalDeposits, totalInterest, balance });
  }

  return { futureValue: balance, totalDeposits, totalInterest, years: rows };
}

/* ───────────────────────── Simple interest ───────────────────────── */

/** Simple interest: I = P × r × t, with t in years. */
export function simpleInterest(principal: number, annualRatePercent: number, years: number): number {
  return principal * (annualRatePercent / 100) * years;
}

/* ───────────────────────── SIP ───────────────────────── */

export interface SipYear {
  year: number;
  /** Monthly instalment paid during this year. */
  monthlyAmount: number;
  invested: number;
  value: number;
}

export interface SipResult {
  invested: number;
  returns: number;
  futureValue: number;
  years: SipYear[];
}

/**
 * Systematic investment plan with instalments at the start of each month and
 * monthly compounding at r ÷ 12. Without a step-up this equals
 * P × ((1 + i)^n − 1) ÷ i × (1 + i). The instalment rises by `stepUpPercent`
 * at the start of every year after the first.
 */
export function sipGrowth(monthly: number, annualRatePercent: number, years: number, stepUpPercent = 0): SipResult {
  const i = annualRatePercent / 100 / 12;
  const rows: SipYear[] = [];
  let value = 0;
  let invested = 0;
  let instalment = monthly;

  for (let year = 1; year <= years; year++) {
    if (year > 1) instalment *= 1 + stepUpPercent / 100;
    for (let month = 0; month < 12; month++) {
      value = (value + instalment) * (1 + i);
      invested += instalment;
    }
    rows.push({ year, monthlyAmount: instalment, invested, value });
  }

  return { invested, returns: value - invested, futureValue: value, years: rows };
}

/* ───────────────────────── Fixed deposit ───────────────────────── */

/** Compounding periods per year, or "simple" for simple interest. */
export type FdCompounding = 1 | 2 | 4 | 12 | "simple";

/**
 * Fixed deposit maturity value. Compound: A = P × (1 + r/n)^(n × t);
 * simple: A = P × (1 + r × t). Tenure `t` is in years.
 */
export function fdMaturity(principal: number, annualRatePercent: number, years: number, compounding: FdCompounding): number {
  const r = annualRatePercent / 100;
  if (compounding === "simple") return principal * (1 + r * years);
  return principal * (1 + r / compounding) ** (compounding * years);
}

/** Effective annual yield of a nominal rate compounded `perYear` times a year, in percent. */
export function effectiveAnnualRate(annualRatePercent: number, perYear: number): number {
  return ((1 + annualRatePercent / 100 / perYear) ** perYear - 1) * 100;
}

/* ───────────────────────── Returns ───────────────────────── */

/** Return on investment in percent. Null when nothing was invested. */
export function roiPercent(invested: number, finalValue: number): number | null {
  return invested === 0 ? null : ((finalValue - invested) / invested) * 100;
}

/**
 * Compound annual growth rate in percent: (end ÷ start)^(1 ÷ years) − 1.
 * Null when it is undefined (no start value, a negative end value or no time).
 */
export function cagrPercent(startValue: number, endValue: number, years: number): number | null {
  if (startValue <= 0 || endValue < 0 || years <= 0) return null;
  return ((endValue / startValue) ** (1 / years) - 1) * 100;
}

/* ───────────────────────── Inflation ───────────────────────── */

export interface InflationYear {
  year: number;
  /** What today's amount will cost after this many years. */
  futureCost: number;
  /** What the amount will be worth in today's money after this many years. */
  purchasingPower: number;
}

export function inflationTable(amount: number, ratePercent: number, years: number): InflationYear[] {
  const rows: InflationYear[] = [];
  for (let year = 1; year <= years; year++) {
    const factor = (1 + ratePercent / 100) ** year;
    rows.push({ year, futureCost: amount * factor, purchasingPower: amount / factor });
  }
  return rows;
}

/* ───────────────────────── Margins ───────────────────────── */

export interface MarginResult {
  cost: number;
  revenue: number;
  profit: number;
  /** Profit as a share of revenue, in percent. Null when revenue is zero. */
  marginPercent: number | null;
  /** Profit as a share of cost, in percent. Null when cost is zero. */
  markupPercent: number | null;
}

export function marginFromPrices(cost: number, revenue: number): MarginResult {
  const profit = revenue - cost;
  return {
    cost,
    revenue,
    profit,
    marginPercent: revenue === 0 ? null : (profit / revenue) * 100,
    markupPercent: cost === 0 ? null : (profit / cost) * 100,
  };
}

/** Selling price that gives the target margin: price = cost ÷ (1 − margin). Margin must be below 100%. */
export function priceForMargin(cost: number, marginPercent: number): MarginResult {
  return marginFromPrices(cost, cost / (1 - marginPercent / 100));
}

/** Selling price that gives the target markup: price = cost × (1 + markup). */
export function priceForMarkup(cost: number, markupPercent: number): MarginResult {
  return marginFromPrices(cost, cost * (1 + markupPercent / 100));
}

/* ───────────────────────── Salary ───────────────────────── */

export type PayPeriod = "hourly" | "daily" | "weekly" | "biweekly" | "semimonthly" | "monthly" | "quarterly" | "yearly";

export const PAY_PERIODS: Array<{ id: PayPeriod; label: string }> = [
  { id: "hourly", label: "Hourly" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "Bi-weekly" },
  { id: "semimonthly", label: "Semi-monthly" },
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly" },
  { id: "yearly", label: "Yearly" },
];

export interface WorkSchedule {
  hoursPerWeek: number;
  daysPerWeek: number;
  weeksPerYear: number;
}

/** How many of each pay period fit in a working year. */
export function periodsPerYear(period: PayPeriod, schedule: WorkSchedule): number {
  switch (period) {
    case "hourly":
      return schedule.hoursPerWeek * schedule.weeksPerYear;
    case "daily":
      return schedule.daysPerWeek * schedule.weeksPerYear;
    case "weekly":
      return schedule.weeksPerYear;
    case "biweekly":
      return schedule.weeksPerYear / 2;
    case "semimonthly":
      return 24;
    case "monthly":
      return 12;
    case "quarterly":
      return 4;
    case "yearly":
      return 1;
  }
}

/* ───────────────────────── Tips ───────────────────────── */

export type TipRounding = "none" | "total" | "share";

export interface TipResult {
  tip: number;
  total: number;
  tipPerPerson: number;
  totalPerPerson: number;
  /** Tip as a percentage of the bill after rounding. */
  effectivePercent: number;
}

/**
 * Tip and split. Rounding goes up to the next whole unit, either for the whole
 * bill or for each person's share, and the difference is added to the tip.
 */
export function calculateTip(bill: number, tipPercent: number, people: number, rounding: TipRounding): TipResult {
  let total = bill * (1 + tipPercent / 100);
  // Tolerance for floating-point noise, so 25.000000001 isn't rounded up to 26.
  const ceil = (value: number) => Math.ceil(value - 1e-9);
  if (rounding === "total") total = ceil(total);
  if (rounding === "share") total = ceil(total / people) * people;
  const tip = total - bill;
  return {
    tip,
    total,
    tipPerPerson: tip / people,
    totalPerPerson: total / people,
    effectivePercent: bill === 0 ? 0 : (tip / bill) * 100,
  };
}
