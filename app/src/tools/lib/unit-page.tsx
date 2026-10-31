"use client";

/**
 * One converter page per measurement type (length, weight, …). Each
 * `components/<x>-converter.tsx` file simply renders <UnitConverterPage category="…" />.
 */

import { useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { CopyButton, Panel } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { useTool } from "@/tools/context";
import {
  checkNumber,
  convertUnit,
  formatSignificant,
  getUnit,
  getUnitCategory,
  type Unit,
  type UnitCategory,
} from "@/tools/lib/calc";
import { DataTable, NumberField } from "@/tools/lib/calc-ui";

/** A ready-made conversion: `value` of unit `from` expressed in unit `to`. */
type Common = [value: number, from: string, to: string];

/** Popular conversions per category, matching what people search for most. */
const COMMON_CONVERSIONS = {
  length: [
    [1, "in", "cm"],
    [1, "cm", "in"],
    [1, "ft", "m"],
    [1, "m", "ft"],
    [1, "ft", "cm"],
    [1, "yd", "m"],
    [1, "km", "mi"],
    [1, "mi", "km"],
    [1, "mm", "in"],
    [1, "nmi", "km"],
  ],
  mass: [
    [1, "kg", "lb"],
    [1, "lb", "kg"],
    [1, "oz", "g"],
    [100, "g", "oz"],
    [1, "st", "kg"],
    [1, "st", "lb"],
    [1, "t", "lb"],
    [1, "ston", "t"],
    [1, "ct", "mg"],
  ],
  temperature: [
    [-40, "c", "f"],
    [0, "c", "f"],
    [20, "c", "f"],
    [37, "c", "f"],
    [100, "c", "f"],
    [32, "f", "c"],
    [98.6, "f", "c"],
    [350, "f", "c"],
    [0, "k", "c"],
    [25, "c", "k"],
  ],
  area: [
    [1, "m2", "ft2"],
    [1, "ft2", "m2"],
    [1, "ac", "ha"],
    [1, "ha", "ac"],
    [1, "km2", "mi2"],
    [1, "mi2", "km2"],
    [1, "ac", "ft2"],
    [1, "in2", "cm2"],
    [1, "yd2", "m2"],
  ],
  volume: [
    [1, "l", "usgal"],
    [1, "usgal", "l"],
    [1, "ukgal", "l"],
    [1, "usfloz", "ml"],
    [1, "uscup", "ml"],
    [1, "ustbsp", "ml"],
    [1, "ustsp", "ml"],
    [1, "m3", "l"],
    [1, "ft3", "l"],
    [1, "l", "usfloz"],
  ],
  speed: [
    [1, "kmh", "mph"],
    [1, "mph", "kmh"],
    [1, "ms", "kmh"],
    [1, "kmh", "ms"],
    [1, "kn", "kmh"],
    [1, "kn", "mph"],
    [1, "ms", "mph"],
    [1, "fts", "ms"],
  ],
  time: [
    [1, "min", "s"],
    [1, "h", "min"],
    [1, "d", "h"],
    [1, "wk", "d"],
    [1, "mo", "d"],
    [1, "yr", "d"],
    [1, "yr", "h"],
    [1, "s", "ms"],
  ],
  data: [
    [1, "kB", "B"],
    [1, "MB", "kB"],
    [1, "GB", "MB"],
    [1, "TB", "GB"],
    [1, "GB", "GiB"],
    [1, "GiB", "MiB"],
    [1, "TB", "TiB"],
    [100, "Mbit", "MB"],
    [1, "Gbit", "MB"],
    [1, "B", "bit"],
  ],
  pressure: [
    [1, "bar", "psi"],
    [1, "psi", "bar"],
    [1, "atm", "kpa"],
    [1, "atm", "psi"],
    [1, "psi", "kpa"],
    [1, "kpa", "psi"],
    [1, "mmhg", "kpa"],
    [1, "inhg", "hpa"],
    [1, "mpa", "psi"],
  ],
  energy: [
    [1, "kcal", "kj"],
    [1, "kj", "kcal"],
    [1, "kwh", "mj"],
    [1, "kwh", "btu"],
    [1, "btu", "kj"],
    [1, "cal", "j"],
    [1, "wh", "j"],
    [1, "ftlbf", "j"],
    [1, "ev", "j"],
  ],
  power: [
    [1, "hp", "kw"],
    [1, "kw", "hp"],
    [1, "ps", "kw"],
    [1, "kw", "ps"],
    [1, "hp", "ps"],
    [1, "kw", "btuh"],
    [1000, "btuh", "w"],
    [1, "hp", "ftlbfs"],
    [1, "mw", "hp"],
  ],
  angle: [
    [1, "deg", "rad"],
    [1, "rad", "deg"],
    [90, "deg", "rad"],
    [180, "deg", "rad"],
    [1, "turn", "deg"],
    [1, "deg", "grad"],
    [1, "deg", "arcmin"],
    [1, "arcmin", "arcsec"],
    [1, "mrad", "deg"],
  ],
} satisfies Record<string, Common[]>;

export type UnitPageCategory = keyof typeof COMMON_CONVERSIONS;

/** Temperatures below absolute zero don't exist. */
const ABSOLUTE_ZERO_C = -273.15;

/** Plain number for the clipboard: no grouping separators, at most 10 significant digits. */
function plainNumber(value: number): string {
  return String(Number(value.toPrecision(10)));
}

/**
 * Short label for a unit: its symbol, or its name when another unit in the
 * category shares the symbol (US and imperial gallons are both "gal").
 */
function unitLabel(category: UnitCategory, unit: Unit): string {
  const shared = category.units.some((u) => u.id !== unit.id && u.symbol === unit.symbol);
  return shared ? unit.name : unit.symbol;
}

/**
 * Every unit here converts as to = a × from + b. Linear units have b = 0, so the
 * formula is a single factor; temperatures also have an offset.
 */
function formula(category: UnitCategory, from: Unit, to: Unit): string {
  const b = convertUnit(0, from, to);
  const a = convertUnit(1, from, to) - b;
  const offset = Math.abs(b) < 1e-12 ? "" : ` ${b < 0 ? "−" : "+"} ${formatSignificant(Math.abs(b))}`;
  return `${unitLabel(category, to)} = ${unitLabel(category, from)} × ${formatSignificant(a)}${offset}`;
}

function UnitSelect({
  id,
  label,
  category,
  value,
  onChange,
}: {
  id: string;
  label: string;
  category: UnitCategory;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} htmlFor={id}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {category.units.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} ({u.symbol})
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function UnitConverterPage({ category: categoryId }: { category: UnitPageCategory }) {
  const { track } = useTool();
  const category = getUnitCategory(categoryId);
  const [fromId, setFromId] = useState(category.defaultFrom);
  const [toId, setToId] = useState(category.defaultTo);
  const [input, setInput] = useState("1");
  /** The example conversion shown on load isn't counted as a use until the visitor changes something. */
  const [interacted, setInteracted] = useState(false);

  const from = getUnit(category, fromId);
  const to = getUnit(category, toId);
  const check = checkNumber(input);
  const belowAbsoluteZero =
    category.id === "temperature" && check.value !== null && from.toBase(check.value) < ABSOLUTE_ZERO_C - 1e-9;
  const value = belowAbsoluteZero ? null : check.value;
  const error = belowAbsoluteZero ? "That is below absolute zero (−273.15 °C)." : check.error;
  const result = value === null ? null : convertUnit(value, from, to);

  useEffect(() => {
    if (interacted && result !== null) track();
  }, [interacted, result, track]);

  function update(apply: () => void) {
    apply();
    setInteracted(true);
  }

  const common = (COMMON_CONVERSIONS[categoryId] as Common[]).map(([amount, f, t]) => {
    const source = getUnit(category, f);
    const target = getUnit(category, t);
    return { key: `${amount}-${f}-${t}`, amount, source, target, value: convertUnit(amount, source, target) };
  });

  return (
    <div className="space-y-4">
      <Panel title={`Convert ${category.name.toLowerCase()}`}>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_1fr] sm:items-start">
            <NumberField
              id="unit-value"
              label="Value"
              value={input}
              onChange={(next) => update(() => setInput(next))}
              error={error}
            />
            <UnitSelect
              id="unit-from"
              label="From"
              category={category}
              value={from.id}
              onChange={(id) => update(() => setFromId(id))}
            />
            <Button
              variant="outline"
              className="justify-self-start px-2.5 sm:mt-7"
              aria-label="Swap units"
              onClick={() =>
                update(() => {
                  setFromId(to.id);
                  setToId(from.id);
                })
              }
            >
              <ArrowLeftRight aria-hidden />
            </Button>
            <UnitSelect
              id="unit-to"
              label="To"
              category={category}
              value={to.id}
              onChange={(id) => update(() => setToId(id))}
            />
          </div>

          <div className="rounded-lg border border-primary-line bg-primary-soft px-4 py-3" aria-live="polite">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted">
                  {from.name} to {to.name}
                </p>
                <p className="mt-1 font-display text-2xl font-semibold break-words text-ink tabular-nums">
                  {result === null || value === null
                    ? "–"
                    : `${formatSignificant(value)} ${unitLabel(category, from)} = ${formatSignificant(result)} ${unitLabel(category, to)}`}
                </p>
              </div>
              <CopyButton text={result === null ? "" : plainNumber(result)} label="Copy result" />
            </div>
            <p className="mt-2 text-sm text-muted">Formula: {formula(category, from, to)}</p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {value !== null ? (
          <Panel title={`${formatSignificant(value)} ${unitLabel(category, from)} in every unit`}>
            <DataTable
              caption={`${formatSignificant(value)} ${from.name} converted to every ${category.name.toLowerCase()} unit`}
              minWidth={300}
              rows={category.units}
              rowKey={(u) => u.id}
              highlight={(u) => u.id === to.id}
              columns={[
                {
                  header: "Unit",
                  cell: (u) => (
                    <>
                      {u.name} <span className="text-muted">({u.symbol})</span>
                    </>
                  ),
                },
                {
                  header: "Value",
                  cell: (u) => (
                    <span className="font-mono text-[13px] break-all">{formatSignificant(convertUnit(value, from, u))}</span>
                  ),
                },
              ]}
            />
          </Panel>
        ) : null}

        <Panel title="Common conversions" className={value === null ? "lg:col-span-2" : undefined}>
          <DataTable
            caption={`Common ${category.name.toLowerCase()} conversions`}
            minWidth={280}
            rows={common}
            rowKey={(row) => row.key}
            columns={[
              {
                header: "From",
                cell: (row) => `${formatSignificant(row.amount)} ${unitLabel(category, row.source)}`,
              },
              {
                header: "To",
                cell: (row) => (
                  <span className="font-mono text-[13px]">
                    {formatSignificant(row.value)} {unitLabel(category, row.target)}
                  </span>
                ),
              },
            ]}
          />
          <p className="mt-3 text-xs text-muted">
            Results use exact conversion factors and are shown with up to 10 significant digits.
          </p>
        </Panel>
      </div>
    </div>
  );
}
