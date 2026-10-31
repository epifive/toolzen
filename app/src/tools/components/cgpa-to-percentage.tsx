"use client";

import { useState } from "react";
import { Panel, Segmented, Stat, ToolColumns } from "@/components/tool-ui";
import { Field, Select } from "@/components/ui/field";
import { checkNumber, formatNumber } from "@/tools/lib/calc";
import { DataTable, EmptyResult, NumberField, useTrackResult } from "@/tools/lib/calc-ui";

type Direction = "toPercent" | "toCgpa";

interface Formula {
  id: string;
  label: string;
  /** Highest possible CGPA on this scale. */
  max: number;
  /** Human-readable formula, with {m} standing for the multiplier. */
  text: string;
  toPercent: (cgpa: number, multiplier: number) => number;
  toCgpa: (percent: number, multiplier: number) => number;
}

const FORMULAS: Formula[] = [
  {
    id: "cbse",
    label: "CBSE (× 9.5)",
    max: 10,
    text: "Percentage = CGPA × 9.5",
    toPercent: (c) => c * 9.5,
    toCgpa: (p) => p / 9.5,
  },
  {
    id: "times10",
    label: "Direct (× 10)",
    max: 10,
    text: "Percentage = CGPA × 10",
    toPercent: (c) => c * 10,
    toCgpa: (p) => p / 10,
  },
  {
    id: "vtu",
    label: "VTU ((CGPA − 0.75) × 10)",
    max: 10,
    text: "Percentage = (CGPA − 0.75) × 10",
    toPercent: (c) => (c - 0.75) * 10,
    toCgpa: (p) => p / 10 + 0.75,
  },
  {
    id: "gpa4",
    label: "4.0 GPA (÷ 4 × 100)",
    max: 4,
    text: "Percentage = GPA ÷ 4 × 100",
    toPercent: (c) => (c / 4) * 100,
    toCgpa: (p) => (p / 100) * 4,
  },
  {
    id: "custom",
    label: "Custom multiplier",
    max: 10,
    text: "Percentage = CGPA × {m}",
    toPercent: (c, m) => c * m,
    toCgpa: (p, m) => p / m,
  },
];

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

export default function CgpaToPercentage() {
  const [direction, setDirection] = useState<Direction>("toPercent");
  const [formulaId, setFormulaId] = useState("cbse");
  const [value, setValue] = useState("");
  const [multiplier, setMultiplier] = useState("9.5");

  const formula = FORMULAS.find((f) => f.id === formulaId) ?? FORMULAS[0];
  const multiplierCheck = checkNumber(multiplier, { min: 0, exclusiveMin: true, max: 100 });
  const m = formula.id === "custom" ? multiplierCheck.value : 1;
  const valueCheck = checkNumber(value, direction === "toPercent" ? { min: 0, max: formula.max } : { min: 0, max: 100 });
  const v = valueCheck.value;

  const answer =
    v === null || m === null
      ? null
      : direction === "toPercent"
        ? clampPercent(formula.toPercent(v, m))
        : Math.min(formula.max, Math.max(0, formula.toCgpa(v, m)));

  useTrackResult(answer);

  const comparison =
    v === null || m === null
      ? []
      : FORMULAS.filter((f) => f.id !== "custom" && (direction === "toCgpa" || v <= f.max)).map((f) => ({
          formula: f,
          result: direction === "toPercent" ? clampPercent(f.toPercent(v, 1)) : Math.min(f.max, Math.max(0, f.toCgpa(v, 1))),
        }));

  const formulaText = formula.text.replace("{m}", m === null ? "m" : formatNumber(m, 4));

  return (
    <ToolColumns>
      <Panel title="Convert">
        <div className="space-y-4">
          <Segmented<Direction>
            label="Conversion direction"
            value={direction}
            onChange={(next) => {
              setDirection(next);
              setValue("");
            }}
            options={[
              { value: "toPercent", label: "CGPA → Percentage" },
              { value: "toCgpa", label: "Percentage → CGPA" },
            ]}
          />
          <Field label="Formula" htmlFor="cgpa-formula" hint={formulaText}>
            <Select id="cgpa-formula" value={formula.id} onChange={(e) => setFormulaId(e.target.value)}>
              {FORMULAS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </Select>
          </Field>
          {formula.id === "custom" ? (
            <NumberField
              id="cgpa-multiplier"
              label="Multiplier"
              value={multiplier}
              onChange={setMultiplier}
              error={multiplierCheck.error}
              placeholder="9.5"
              min={0}
              step={0.1}
            />
          ) : null}
          <NumberField
            id="cgpa-value"
            label={direction === "toPercent" ? `CGPA (out of ${formula.max})` : "Percentage"}
            unit={direction === "toPercent" ? undefined : "%"}
            value={value}
            onChange={setValue}
            error={valueCheck.error}
            placeholder={direction === "toPercent" ? (formula.max === 4 ? "3.4" : "8.2") : "78"}
            min={0}
            max={direction === "toPercent" ? formula.max : 100}
            step={0.01}
          />
        </div>
      </Panel>

      <div className="space-y-4">
        {answer !== null && v !== null ? (
          <>
            <dl>
              <Stat
                label={direction === "toPercent" ? `Percentage for CGPA ${formatNumber(v, 2)}` : `CGPA for ${formatNumber(v, 2)}%`}
                value={direction === "toPercent" ? `${formatNumber(answer, 2)}%` : formatNumber(answer, 2)}
                emphasis
              />
            </dl>
            {comparison.length ? (
              <Panel title="With other formulas">
                <DataTable
                  caption="The same value converted with each common formula"
                  minWidth={300}
                  rows={comparison}
                  rowKey={(row) => row.formula.id}
                  highlight={(row) => row.formula.id === formula.id}
                  columns={[
                    { header: "Formula", cell: (row) => row.formula.label },
                    {
                      header: direction === "toPercent" ? "Percentage" : "CGPA",
                      cell: (row) =>
                        direction === "toPercent"
                          ? `${formatNumber(row.result, 2)}%`
                          : `${formatNumber(row.result, 2)} / ${row.formula.max}`,
                    },
                  ]}
                />
              </Panel>
            ) : null}
            <p className="text-xs text-muted">
              Universities use different conversion rules. Use the formula printed on your mark sheet or published by your
              board or university.
            </p>
          </>
        ) : (
          <EmptyResult>{direction === "toPercent" ? "Enter your CGPA." : "Enter your percentage."}</EmptyResult>
        )}
      </div>
    </ToolColumns>
  );
}
