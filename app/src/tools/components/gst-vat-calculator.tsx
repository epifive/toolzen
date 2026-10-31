"use client";

import { useEffect, useState } from "react";
import { Panel, Segmented, Stat, ToolColumns } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/field";
import { useTool } from "@/tools/context";
import { calculateTax, checkNumber, formatAmount, formatNumber } from "@/tools/lib/calc";
import { NumberField } from "@/tools/lib/calc-ui";

type Mode = "add" | "remove";

const PRESETS: Array<{ label: string; rates: number[] }> = [
  { label: "GST", rates: [5, 12, 18, 28] },
  { label: "VAT", rates: [5, 20] },
];

export default function GstVatCalculator() {
  const { track } = useTool();
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("18");
  const [mode, setMode] = useState<Mode>("add");
  const [split, setSplit] = useState(false);

  const amountCheck = checkNumber(amount, { min: 0 });
  const rateCheck = checkNumber(rate, { min: 0, max: 100 });
  const result =
    amountCheck.value !== null && rateCheck.value !== null ? calculateTax(amountCheck.value, rateCheck.value, mode) : null;
  const gross = result?.gross;

  useEffect(() => {
    if (gross !== undefined) track();
  }, [gross, track]);

  const ratePct = rateCheck.value ?? 0;

  return (
    <ToolColumns>
      <Panel title="Amount and rate">
        <div className="space-y-4">
          <Segmented<Mode>
            label="Calculation"
            value={mode}
            onChange={setMode}
            options={[
              { value: "add", label: "Add tax (price excludes tax)" },
              { value: "remove", label: "Remove tax (price includes tax)" },
            ]}
          />
          <NumberField
            id="tax-amount"
            label={mode === "add" ? "Net amount (before tax)" : "Gross amount (including tax)"}
            value={amount}
            onChange={setAmount}
            error={amountCheck.error}
            placeholder="1000"
            min={0}
          />
          <NumberField
            id="tax-rate"
            label="Tax rate"
            unit="%"
            value={rate}
            onChange={setRate}
            error={rateCheck.error}
            min={0}
            max={100}
            step={0.5}
          />
          <div className="space-y-2">
            {PRESETS.map((group) => (
              <div key={group.label} className="flex flex-wrap items-center gap-2">
                <span className="w-10 text-sm text-muted">{group.label}</span>
                {group.rates.map((r) => {
                  const active = rateCheck.value === r;
                  return (
                    <Button
                      key={r}
                      size="sm"
                      variant={active ? "primary" : "secondary"}
                      aria-pressed={active}
                      aria-label={`${group.label} ${r}%`}
                      onClick={() => setRate(String(r))}
                    >
                      {r}%
                    </Button>
                  );
                })}
              </div>
            ))}
          </div>
          <Switch
            label="Show CGST / SGST split"
            description="For intra-state GST in India, the tax is split equally between central and state GST."
            checked={split}
            onChange={(e) => setSplit(e.target.checked)}
          />
        </div>
      </Panel>

      <div className="space-y-4">
        {result ? (
          <>
            <dl className="grid gap-3 sm:grid-cols-3">
              <Stat label="Net amount" value={formatAmount(result.net)} emphasis={mode === "remove"} />
              <Stat label={`Tax (${formatNumber(ratePct, 2)}%)`} value={formatAmount(result.tax)} />
              <Stat label="Gross amount" value={formatAmount(result.gross)} emphasis={mode === "add"} />
            </dl>
            {split ? (
              <dl className="grid grid-cols-2 gap-3">
                <Stat label={`CGST (${formatNumber(ratePct / 2, 2)}%)`} value={formatAmount(result.tax / 2)} />
                <Stat label={`SGST (${formatNumber(ratePct / 2, 2)}%)`} value={formatAmount(result.tax / 2)} />
              </dl>
            ) : null}
            <Panel title="Formula">
              <p className="font-mono text-[13px] break-words text-muted">
                {mode === "add"
                  ? `Gross = ${formatAmount(result.net)} × (1 + ${formatNumber(ratePct, 2)} ÷ 100) = ${formatAmount(result.gross)}`
                  : `Net = ${formatAmount(result.gross)} ÷ (1 + ${formatNumber(ratePct, 2)} ÷ 100) = ${formatAmount(result.net)}`}
              </p>
            </Panel>
          </>
        ) : (
          <Panel>
            <p className="py-10 text-center text-sm text-muted">Enter an amount and a tax rate.</p>
          </Panel>
        )}
      </div>
    </ToolColumns>
  );
}
