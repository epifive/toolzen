"use client";

import { useEffect, useState } from "react";
import { Panel, Segmented, Stat, ToolColumns } from "@/components/tool-ui";
import { cn } from "@/lib/utils";
import { useTool } from "@/tools/context";
import {
  BMI_CATEGORIES,
  bmiCategory,
  calculateBmi,
  checkNumber,
  formatNumber,
  healthyWeightRange,
  INCH_M,
  POUND_KG,
} from "@/tools/lib/calc";
import { NumberField } from "@/tools/lib/calc-ui";

type System = "metric" | "imperial";

/** The visible part of the BMI scale. */
const SCALE_MIN = 12;
const SCALE_MAX = 45;

function scalePosition(bmi: number): number {
  const clamped = Math.min(SCALE_MAX, Math.max(SCALE_MIN, bmi));
  return ((clamped - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
}

function BmiScale({ bmi }: { bmi: number }) {
  const segments = BMI_CATEGORIES.map((c, i) => {
    const from = Math.max(c.min, SCALE_MIN);
    const to = BMI_CATEGORIES[i + 1]?.min ?? SCALE_MAX;
    return { ...c, width: ((to - from) / (SCALE_MAX - SCALE_MIN)) * 100 };
  });
  const category = bmiCategory(bmi);
  return (
    <figure>
      <div
        role="img"
        aria-label={`BMI ${formatNumber(bmi, 1)} on a scale from ${SCALE_MIN} to ${SCALE_MAX}, in the ${category.label.toLowerCase()} range.`}
        className="relative pt-7"
      >
        <span
          className="absolute top-0 -translate-x-1/2 rounded bg-ink px-1.5 py-0.5 text-xs font-semibold text-paper tabular-nums"
          // Keep the label inside the bar at the extremes of the scale.
          style={{ left: `clamp(1.25rem, ${scalePosition(bmi)}%, calc(100% - 1.25rem))` }}
        >
          {formatNumber(bmi, 1)}
        </span>
        <span
          aria-hidden
          className="absolute top-5 h-6 w-0.5 -translate-x-1/2 bg-ink"
          style={{ left: `${scalePosition(bmi)}%` }}
        />
        <div className="flex h-3 overflow-hidden rounded-full">
          {segments.map((s) => (
            <span key={s.label} className={s.tone} style={{ width: `${s.width}%` }} />
          ))}
        </div>
        <div aria-hidden className="relative mt-1 h-4 text-[11px] text-muted tabular-nums">
          {BMI_CATEGORIES.slice(1).map((c) => (
            <span key={c.min} className="absolute -translate-x-1/2" style={{ left: `${scalePosition(c.min)}%` }}>
              {c.min}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="mt-3">
        <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
          {BMI_CATEGORIES.map((c, i) => {
            const next = BMI_CATEGORIES[i + 1];
            const range =
              i === 0 ? `below ${next.min}` : next ? `${c.min} – ${formatNumber(next.min - 0.1, 1)}` : `${c.min} and above`;
            return (
              <li
                key={c.label}
                className={cn("flex items-center gap-2", c === category ? "font-semibold text-ink" : "text-muted")}
              >
                <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", c.tone)} />
                {c.label}: {range}
              </li>
            );
          })}
        </ul>
      </figcaption>
    </figure>
  );
}

export default function BmiCalculator() {
  const { track } = useTool();
  const [system, setSystem] = useState<System>("metric");
  const [cm, setCm] = useState("");
  const [kg, setKg] = useState("");
  const [feet, setFeet] = useState("");
  const [inches, setInches] = useState("");
  const [pounds, setPounds] = useState("");

  const metric = system === "metric";
  const cmCheck = checkNumber(cm, { min: 50, max: 272 });
  const kgCheck = checkNumber(kg, { min: 2, max: 650 });
  const feetCheck = checkNumber(feet, { min: 1, max: 8, integer: true });
  const inchesCheck = checkNumber(inches, { min: 0, max: 11.99 });
  const poundsCheck = checkNumber(pounds, { min: 5, max: 1400 });

  let heightM: number | null = null;
  let weightKg: number | null = null;
  if (metric) {
    heightM = cmCheck.value !== null ? cmCheck.value / 100 : null;
    weightKg = kgCheck.value;
  } else {
    heightM = feetCheck.value !== null && !inchesCheck.error ? (feetCheck.value * 12 + (inchesCheck.value ?? 0)) * INCH_M : null;
    weightKg = poundsCheck.value !== null ? poundsCheck.value * POUND_KG : null;
  }

  const bmi = heightM !== null && weightKg !== null ? calculateBmi(weightKg, heightM) : null;
  const category = bmi !== null ? bmiCategory(bmi) : null;
  const healthy = heightM !== null ? healthyWeightRange(heightM) : null;
  const weightUnit = metric ? "kg" : "lb";
  const toDisplayWeight = (kgValue: number) => (metric ? kgValue : kgValue / POUND_KG);

  useEffect(() => {
    if (bmi !== null) track();
  }, [bmi, track]);

  return (
    <ToolColumns>
      <Panel title="Your measurements">
        <div className="space-y-4">
          <Segmented<System>
            label="Units"
            value={system}
            onChange={setSystem}
            options={[
              { value: "metric", label: "Metric (cm, kg)" },
              { value: "imperial", label: "Imperial (ft, in, lb)" },
            ]}
          />
          {metric ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                id="bmi-cm"
                label="Height"
                unit="cm"
                value={cm}
                onChange={setCm}
                error={cmCheck.error}
                placeholder="175"
                min={50}
                max={272}
              />
              <NumberField
                id="bmi-kg"
                label="Weight"
                unit="kg"
                value={kg}
                onChange={setKg}
                error={kgCheck.error}
                placeholder="70"
                min={2}
                max={650}
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField
                id="bmi-ft"
                label="Height"
                unit="ft"
                value={feet}
                onChange={setFeet}
                error={feetCheck.error}
                placeholder="5"
                min={1}
                max={8}
                step={1}
              />
              <NumberField
                id="bmi-in"
                label="and"
                unit="in"
                value={inches}
                onChange={setInches}
                error={inchesCheck.error}
                placeholder="9"
                min={0}
                max={11.99}
              />
              <NumberField
                id="bmi-lb"
                label="Weight"
                unit="lb"
                value={pounds}
                onChange={setPounds}
                error={poundsCheck.error}
                placeholder="154"
                min={5}
                max={1400}
              />
            </div>
          )}
          <p className="text-xs text-muted">
            BMI is a screening measure for adults aged 18 and over. It does not account for muscle mass, age, sex or body
            composition.
          </p>
        </div>
      </Panel>

      <div className="space-y-4">
        {bmi !== null && category && healthy ? (
          <>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Stat label="Your BMI" value={formatNumber(bmi, 1, 1)} emphasis />
              <Stat label="Category (WHO)" value={category.label} emphasis />
            </dl>
            <dl className="grid gap-3">
              <Stat
                label="Healthy weight for your height (BMI 18.5–24.9)"
                value={`${formatNumber(toDisplayWeight(healthy[0]), 1)} – ${formatNumber(toDisplayWeight(healthy[1]), 1)} ${weightUnit}`}
              />
            </dl>
            <Panel title="Where you are on the scale">
              <BmiScale bmi={bmi} />
            </Panel>
          </>
        ) : (
          <Panel>
            <p className="py-10 text-center text-sm text-muted">Enter your height and weight to calculate your BMI.</p>
          </Panel>
        )}
      </div>
    </ToolColumns>
  );
}
