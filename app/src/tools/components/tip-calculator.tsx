"use client";

import { useState } from "react";
import { Panel, Segmented, Stat, ToolColumns } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import { checkNumber, formatAmount, formatNumber } from "@/tools/lib/calc";
import { EmptyResult, NumberField, useTrackResult } from "@/tools/lib/calc-ui";
import { calculateTip, type TipRounding } from "@/tools/lib/finance";

const TIP_PRESETS = [10, 12, 15, 18, 20, 25];

export default function TipCalculator() {
  const [bill, setBill] = useState("");
  const [tip, setTip] = useState("15");
  const [people, setPeople] = useState("1");
  const [rounding, setRounding] = useState<TipRounding>("none");

  const billCheck = checkNumber(bill, { min: 0, exclusiveMin: true, max: 1e9 });
  const tipCheck = checkNumber(tip, { min: 0, max: 100 });
  const peopleCheck = checkNumber(people, { min: 1, max: 100, integer: true });

  const result =
    billCheck.value !== null && tipCheck.value !== null && peopleCheck.value !== null
      ? calculateTip(billCheck.value, tipCheck.value, peopleCheck.value, rounding)
      : null;
  const split = (peopleCheck.value ?? 1) > 1;

  useTrackResult(result?.total);

  return (
    <ToolColumns>
      <Panel title="Bill">
        <div className="space-y-4">
          <NumberField
            id="tip-bill"
            label="Bill amount"
            value={bill}
            onChange={setBill}
            error={billCheck.error}
            placeholder="84.50"
            min={0}
            step={0.01}
          />
          <div>
            <NumberField
              id="tip-percent"
              label="Tip"
              unit="%"
              value={tip}
              onChange={setTip}
              error={tipCheck.error}
              min={0}
              max={100}
            />
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Tip presets">
              {TIP_PRESETS.map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={tipCheck.value === p ? "primary" : "secondary"}
                  aria-pressed={tipCheck.value === p}
                  onClick={() => setTip(String(p))}
                >
                  {p}%
                </Button>
              ))}
            </div>
          </div>
          <NumberField
            id="tip-people"
            label="Split between"
            unit="people"
            value={people}
            onChange={setPeople}
            error={peopleCheck.error}
            min={1}
            max={100}
            step={1}
          />
          <div>
            <p aria-hidden className="mb-1.5 text-sm font-medium text-ink">
              Rounding
            </p>
            <Segmented<TipRounding>
              label="Rounding"
              value={rounding}
              onChange={setRounding}
              options={[
                { value: "none", label: "None" },
                { value: "total", label: "Round total up" },
                { value: "share", label: "Round each share up" },
              ]}
            />
          </div>
        </div>
      </Panel>

      <div className="space-y-4">
        {result && billCheck.value !== null ? (
          <>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Stat label="Tip" value={formatAmount(result.tip)} emphasis />
              <Stat label="Total to pay" value={formatAmount(result.total)} emphasis />
              {split ? (
                <>
                  <Stat label="Tip per person" value={formatAmount(result.tipPerPerson)} />
                  <Stat label="Total per person" value={formatAmount(result.totalPerPerson)} />
                </>
              ) : null}
            </dl>
            {rounding !== "none" ? (
              <p className="text-sm text-muted">
                After rounding up, the tip is {formatNumber(result.effectivePercent, 2)}% of the bill.
              </p>
            ) : null}
          </>
        ) : (
          <EmptyResult>Enter the bill amount to see the tip.</EmptyResult>
        )}
      </div>
    </ToolColumns>
  );
}
