"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Panel, Stat } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { useTool } from "@/tools/context";
import { checkNumber, convertUnit, formatSignificant, UNIT_CATEGORIES, type UnitCategory } from "@/tools/lib/calc";
import { NumberField } from "@/tools/lib/calc-ui";

/** Temperatures below absolute zero don't exist. */
const ABSOLUTE_ZERO_C = -273.15;

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

export default function UnitConverter() {
  const { track } = useTool();
  const [categoryId, setCategoryId] = useState(UNIT_CATEGORIES[0].id);
  const category = UNIT_CATEGORIES.find((c) => c.id === categoryId) ?? UNIT_CATEGORIES[0];
  const [fromId, setFromId] = useState(category.defaultFrom);
  const [toId, setToId] = useState(category.defaultTo);
  const [input, setInput] = useState("1");
  /** The example conversion shown on load isn't counted as a use until the visitor changes something. */
  const [interacted, setInteracted] = useState(false);

  const from = category.units.find((u) => u.id === fromId) ?? category.units[0];
  const to = category.units.find((u) => u.id === toId) ?? category.units[1];
  const check = checkNumber(input);
  const belowAbsoluteZero =
    category.id === "temperature" && check.value !== null && from.toBase(check.value) < ABSOLUTE_ZERO_C - 1e-9;
  const value = belowAbsoluteZero ? null : check.value;
  const error = belowAbsoluteZero ? "That is below absolute zero (−273.15 °C)." : check.error;

  const result = value === null ? null : convertUnit(value, from, to);
  const table = value === null ? [] : category.units.map((u) => ({ unit: u, value: convertUnit(value, from, u) }));

  useEffect(() => {
    if (interacted && result !== null) track();
  }, [interacted, result, track]);

  function changeInput(next: string) {
    setInput(next);
    setInteracted(true);
  }

  function changeFrom(id: string) {
    setFromId(id);
    setInteracted(true);
  }

  function changeTo(id: string) {
    setToId(id);
    setInteracted(true);
  }

  function changeCategory(id: string) {
    setInteracted(true);
    const next = UNIT_CATEGORIES.find((c) => c.id === id) ?? UNIT_CATEGORIES[0];
    setCategoryId(next.id);
    setFromId(next.defaultFrom);
    setToId(next.defaultTo);
  }

  return (
    <div className="space-y-4">
      <Panel title="Convert">
        <div className="space-y-4">
          <Field label="Measurement" htmlFor="uc-category">
            <Select id="uc-category" value={category.id} onChange={(e) => changeCategory(e.target.value)} className="sm:max-w-xs">
              {UNIT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_1fr] sm:items-end">
            <NumberField id="uc-value" label="Value" value={input} onChange={changeInput} error={error} />
            <UnitSelect id="uc-from" label="From" category={category} value={from.id} onChange={changeFrom} />
            <Button
              variant="outline"
              className="justify-self-start px-2.5"
              aria-label="Swap units"
              onClick={() => {
                changeFrom(to.id);
                changeTo(from.id);
              }}
            >
              <ArrowLeftRight aria-hidden />
            </Button>
            <UnitSelect id="uc-to" label="To" category={category} value={to.id} onChange={changeTo} />
          </div>
          <dl aria-live="polite">
            <Stat
              label={`${from.name} to ${to.name}`}
              value={
                result === null || value === null
                  ? "–"
                  : `${formatSignificant(value)} ${from.symbol} = ${formatSignificant(result)} ${to.symbol}`
              }
              emphasis
            />
          </dl>
        </div>
      </Panel>

      {table.length && value !== null ? (
        <Panel title={`${formatSignificant(value)} ${from.symbol} in every ${category.name.toLowerCase()} unit`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Unit
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {table.map((row) => (
                  <tr
                    key={row.unit.id}
                    className={cn("border-b border-line last:border-0", row.unit.id === to.id && "bg-primary-soft")}
                  >
                    <th scope="row" className="py-2 pr-3 text-left font-normal text-ink">
                      {row.unit.name} <span className="text-muted">({row.unit.symbol})</span>
                    </th>
                    <td className="py-2 text-right font-mono text-[13px] break-all text-ink tabular-nums">
                      {formatSignificant(row.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            Results use exact conversion factors and are shown with up to 10 significant digits.
          </p>
        </Panel>
      ) : null}
    </div>
  );
}
