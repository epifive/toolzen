/**
 * Health estimates used by the BMR and pregnancy calculators. These are the
 * standard population formulas, not a substitute for professional advice.
 */

import { addDays, daysBetween } from "./calc";

/* ───────────────────────── Energy ───────────────────────── */

export type Sex = "male" | "female";

/** Mifflin-St Jeor basal metabolic rate in kcal per day. */
export function mifflinStJeor(sex: Sex, weightKg: number, heightCm: number, ageYears: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + (sex === "male" ? 5 : -161);
}

export interface ActivityLevel {
  id: string;
  label: string;
  description: string;
  factor: number;
}

export const ACTIVITY_LEVELS: ActivityLevel[] = [
  { id: "sedentary", label: "Sedentary", description: "Little or no exercise", factor: 1.2 },
  { id: "light", label: "Lightly active", description: "Exercise 1–3 days a week", factor: 1.375 },
  { id: "moderate", label: "Moderately active", description: "Exercise 3–5 days a week", factor: 1.55 },
  { id: "very", label: "Very active", description: "Hard exercise 6–7 days a week", factor: 1.725 },
  { id: "extra", label: "Extra active", description: "Physical job or training twice a day", factor: 1.9 },
];

export const KCAL_TO_KJ = 4.184;

/** Approximate energy stored in body fat, used to turn a weekly weight change into a daily calorie change. */
export const KCAL_PER_KG = 7700;
export const KCAL_PER_LB = 3500;

/* ───────────────────────── Pregnancy ───────────────────────── */

/** A full-term pregnancy is counted as 280 days (40 weeks) from the first day of the last period. */
export const PREGNANCY_DAYS = 280;
/** Conception is assumed 14 days after the last period in a 28-day cycle. */
const CONCEPTION_OFFSET = 14;

export type DueDateMethod = "lmp" | "conception" | "ivf";

/**
 * Estimated due date.
 * - Last period (Naegele's rule): LMP + 280 days, shifted by (cycle length − 28).
 * - Conception: conception date + 266 days.
 * - IVF: transfer date + 266 days − embryo age in days (3 or 5).
 */
export function dueDate(method: DueDateMethod, date: Date, options: { cycleLength?: number; embryoDays?: number } = {}): Date {
  const span = PREGNANCY_DAYS - CONCEPTION_OFFSET;
  switch (method) {
    case "lmp":
      return addDays(date, PREGNANCY_DAYS + ((options.cycleLength ?? 28) - 28));
    case "conception":
      return addDays(date, span);
    case "ivf":
      return addDays(date, span - (options.embryoDays ?? 5));
  }
}

export interface PregnancyProgress {
  /** Days since the start of the (adjusted) last menstrual period. */
  gestationDays: number;
  weeks: number;
  days: number;
  trimester: 1 | 2 | 3;
  daysToGo: number;
  estimatedConception: Date;
  /** The start of week 0, i.e. the adjusted first day of the last period. */
  start: Date;
}

export function pregnancyProgress(due: Date, on: Date): PregnancyProgress {
  const start = addDays(due, -PREGNANCY_DAYS);
  const gestationDays = daysBetween(start, on);
  const weeks = Math.floor(gestationDays / 7);
  return {
    gestationDays,
    weeks,
    days: gestationDays - weeks * 7,
    trimester: weeks < 14 ? 1 : weeks < 28 ? 2 : 3,
    daysToGo: daysBetween(on, due),
    estimatedConception: addDays(start, CONCEPTION_OFFSET),
    start,
  };
}

export interface PregnancyMilestone {
  week: number;
  label: string;
}

export const PREGNANCY_MILESTONES: PregnancyMilestone[] = [
  { week: 4, label: "Pregnancy test usually positive" },
  { week: 8, label: "First prenatal visit (typical)" },
  { week: 12, label: "Nuchal translucency scan window (11–14 weeks)" },
  { week: 14, label: "Second trimester begins" },
  { week: 20, label: "Anatomy scan (18–22 weeks)" },
  { week: 24, label: "Glucose screening window (24–28 weeks)" },
  { week: 28, label: "Third trimester begins" },
  { week: 37, label: "Full term begins" },
  { week: 40, label: "Estimated due date" },
  { week: 42, label: "Post-term" },
];
