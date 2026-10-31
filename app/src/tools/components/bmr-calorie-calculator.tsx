"use client";

import { useState } from "react";
import { Panel, Segmented, Stat, ToolColumns } from "@/components/tool-ui";
import { Alert } from "@/components/ui/alert";
import { Field, Select } from "@/components/ui/field";
import { checkNumber, formatNumber, INCH_M, POUND_KG } from "@/tools/lib/calc";
import { DataTable, EmptyResult, NumberField, useTrackResult } from "@/tools/lib/calc-ui";
import {
  ACTIVITY_LEVELS,
  KCAL_PER_KG,
  KCAL_PER_LB,
  KCAL_TO_KJ,
  mifflinStJeor,
  type Sex,
} from "@/tools/lib/health";

type Units = "metric" | "imperial";

/** Weekly weight changes offered as goals, in kg (metric) or lb (imperial). */
const GOAL_STEPS: Record<Units, number[]> = {
  metric: [-1, -0.5, -0.25, 0, 0.25, 0.5],
  imperial: [-2, -1, -0.5, 0, 0.5, 1],
};

/** Common guidance: don't go below these daily intakes without medical supervision. */
const MINIMUM_KCAL: Record<Sex, number> = { male: 1500, female: 1200 };

/** Number as an input value: no grouping separators and at most 1 decimal. */
function plain(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function goalLabel(change: number, units: Units): string {
  if (change === 0) return "Maintain weight";
  const amount = `${formatNumber(Math.abs(change), 2)} ${units === "metric" ? "kg" : "lb"}`;
  return `${change < 0 ? "Lose" : "Gain"} ${amount} a week`;
}

export default function BmrCalorieCalculator() {
  const [units, setUnits] = useState<Units>("metric");
  const [sex, setSex] = useState<Sex>("female");
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [feet, setFeet] = useState("");
  const [inches, setInches] = useState("");
  const [weight, setWeight] = useState("");
  const [activityId, setActivityId] = useState("light");

  const ageCheck = checkNumber(age, { min: 15, max: 100 });
  const cmCheck = checkNumber(heightCm, { min: 100, max: 250 });
  const feetCheck = checkNumber(feet, { min: 3, max: 8, integer: true });
  const inchesCheck = checkNumber(inches, { min: 0, max: 11.99 });
  const weightCheck = checkNumber(weight, units === "metric" ? { min: 30, max: 300 } : { min: 66, max: 660 });

  const height =
    units === "metric"
      ? cmCheck.value
      : feetCheck.value !== null && !inchesCheck.error
        ? (feetCheck.value * 12 + (inchesCheck.value ?? 0)) * INCH_M * 100
        : null;
  const weightKg = weightCheck.value === null ? null : units === "metric" ? weightCheck.value : weightCheck.value * POUND_KG;
  const activity = ACTIVITY_LEVELS.find((a) => a.id === activityId) ?? ACTIVITY_LEVELS[0];

  const bmr = ageCheck.value !== null && height !== null && weightKg !== null ? mifflinStJeor(sex, weightKg, height, ageCheck.value) : null;
  const maintenance = bmr === null ? null : bmr * activity.factor;
  const perUnit = units === "metric" ? KCAL_PER_KG : KCAL_PER_LB;
  const goals =
    maintenance === null
      ? []
      : GOAL_STEPS[units].map((change) => {
          const kcal = maintenance + (change * perUnit) / 7;
          return { change, kcal, low: kcal < MINIMUM_KCAL[sex] };
        });

  useTrackResult(maintenance);

  function changeUnits(next: Units) {
    if (next === units) return;
    if (next === "imperial") {
      if (cmCheck.value !== null) {
        const totalInches = Math.round((cmCheck.value / 100 / INCH_M) * 10) / 10;
        const ft = Math.floor(totalInches / 12);
        setFeet(String(ft));
        setInches(plain(totalInches - ft * 12));
      }
      if (weightCheck.value !== null) setWeight(plain(weightCheck.value / POUND_KG));
    } else {
      if (height !== null) setHeightCm(plain(height));
      if (weightCheck.value !== null) setWeight(plain(weightCheck.value * POUND_KG));
    }
    setUnits(next);
  }

  return (
    <div className="space-y-4">
      <ToolColumns>
        <Panel title="About you">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Segmented<Units>
                label="Units"
                value={units}
                onChange={changeUnits}
                options={[
                  { value: "metric", label: "Metric" },
                  { value: "imperial", label: "Imperial" },
                ]}
              />
              <Segmented<Sex>
                label="Sex"
                value={sex}
                onChange={setSex}
                options={[
                  { value: "female", label: "Female" },
                  { value: "male", label: "Male" },
                ]}
              />
            </div>
            <NumberField
              id="bmr-age"
              label="Age"
              unit="years"
              value={age}
              onChange={setAge}
              error={ageCheck.error}
              placeholder="30"
              min={15}
              max={100}
            />
            {units === "metric" ? (
              <NumberField
                id="bmr-height"
                label="Height"
                unit="cm"
                value={heightCm}
                onChange={setHeightCm}
                error={cmCheck.error}
                placeholder="170"
                min={100}
                max={250}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  id="bmr-feet"
                  label="Height (feet)"
                  unit="ft"
                  value={feet}
                  onChange={setFeet}
                  error={feetCheck.error}
                  placeholder="5"
                  min={3}
                  max={8}
                  step={1}
                />
                <NumberField
                  id="bmr-inches"
                  label="Inches"
                  unit="in"
                  value={inches}
                  onChange={setInches}
                  error={inchesCheck.error}
                  placeholder="7"
                  min={0}
                  max={11.99}
                />
              </div>
            )}
            <NumberField
              id="bmr-weight"
              label="Weight"
              unit={units === "metric" ? "kg" : "lb"}
              value={weight}
              onChange={setWeight}
              error={weightCheck.error}
              placeholder={units === "metric" ? "65" : "145"}
              min={0}
            />
            <Field label="Activity level" htmlFor="bmr-activity" hint={activity.description}>
              <Select id="bmr-activity" value={activity.id} onChange={(e) => setActivityId(e.target.value)}>
                {ACTIVITY_LEVELS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} – {a.description}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Panel>

        <div className="space-y-4">
          {bmr !== null && maintenance !== null ? (
            <>
              <dl className="grid gap-3 sm:grid-cols-2">
                <Stat label="Basal metabolic rate (BMR)" value={`${formatNumber(bmr, 0)} kcal`} emphasis />
                <Stat label="Maintenance calories" value={`${formatNumber(maintenance, 0)} kcal`} emphasis />
                <Stat label="BMR in kilojoules" value={`${formatNumber(bmr * KCAL_TO_KJ, 0)} kJ`} />
                <Stat label="Maintenance in kilojoules" value={`${formatNumber(maintenance * KCAL_TO_KJ, 0)} kJ`} />
              </dl>
              <p className="text-sm text-muted">
                BMR is the energy your body uses at complete rest. Maintenance calories multiply it by your activity factor (
                {formatNumber(activity.factor, 3)}) to estimate what you burn in a typical day.
              </p>
            </>
          ) : (
            <EmptyResult>Enter your age, height and weight.</EmptyResult>
          )}
        </div>
      </ToolColumns>

      {goals.length ? (
        <Panel title="Daily calories for your goal">
          <DataTable
            caption="Daily calorie targets for losing, keeping or gaining weight"
            minWidth={420}
            rows={goals}
            rowKey={(g) => g.change}
            highlight={(g) => g.change === 0}
            columns={[
              { header: "Goal", cell: (g) => goalLabel(g.change, units) },
              {
                header: "Calories per day",
                cell: (g) => (
                  <span className={g.low ? "text-amber-700 dark:text-amber-400" : undefined}>
                    {formatNumber(g.kcal, 0)} kcal{g.low ? " *" : ""}
                  </span>
                ),
              },
              { header: "Kilojoules per day", cell: (g) => `${formatNumber(g.kcal * KCAL_TO_KJ, 0)} kJ` },
            ]}
          />
          {goals.some((g) => g.low) ? (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
              * Below {formatNumber(MINIMUM_KCAL[sex], 0)} kcal a day, which is not recommended without medical supervision.
            </p>
          ) : null}
          <Alert tone="info" className="mt-4">
            Estimates use the Mifflin-St Jeor equation and about {formatNumber(perUnit, 0)} kcal per{" "}
            {units === "metric" ? "kilogram" : "pound"} of body weight. They are a starting point, not medical advice; talk to
            a doctor or dietitian before major changes.
          </Alert>
        </Panel>
      ) : null}
    </div>
  );
}
