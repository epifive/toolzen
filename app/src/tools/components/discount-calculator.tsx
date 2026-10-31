"use client";

import { useEffect, useState } from "react";
import { Panel, Segmented, Stat, StatGrid, ToolColumns } from "@/components/tool-ui";
import { useTool } from "@/tools/context";
import { calculateDiscount, checkNumber, formatAmount, formatNumber } from "@/tools/lib/calc";
import { NumberField } from "@/tools/lib/calc-ui";

type DiscountType = "percent" | "amount";

export default function DiscountCalculator() {
  const { track } = useTool();
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("percent");
  const [second, setSecond] = useState("");
  const [tax, setTax] = useState("");

  const priceCheck = checkNumber(price, { min: 0 });
  const discountCheck = checkNumber(discount, discountType === "percent" ? { min: 0, max: 100 } : { min: 0 });
  const secondCheck = checkNumber(second, { min: 0, max: 100 });
  const taxCheck = checkNumber(tax, { min: 0, max: 100 });

  const discountTooBig =
    discountType === "amount" &&
    priceCheck.value !== null &&
    discountCheck.value !== null &&
    discountCheck.value > priceCheck.value;
  const discountError = discountTooBig ? "The discount can't be more than the original price." : discountCheck.error;

  const result =
    priceCheck.value !== null && discountCheck.value !== null && !discountTooBig && !secondCheck.error && !taxCheck.error
      ? calculateDiscount({
          price: priceCheck.value,
          discount: discountCheck.value,
          discountType,
          secondPercent: secondCheck.value ?? 0,
          taxPercent: taxCheck.value ?? 0,
        })
      : null;

  const total = result?.total;
  useEffect(() => {
    if (total !== undefined) track();
  }, [total, track]);

  return (
    <ToolColumns>
      <Panel title="Price and discount">
        <div className="space-y-4">
          <NumberField
            id="dc-price"
            label="Original price"
            value={price}
            onChange={setPrice}
            error={priceCheck.error}
            placeholder="120"
            min={0}
          />
          <div className="space-y-2">
            <Segmented<DiscountType>
              label="Discount type"
              value={discountType}
              onChange={setDiscountType}
              options={[
                { value: "percent", label: "Percent off" },
                { value: "amount", label: "Fixed amount off" },
              ]}
            />
            <NumberField
              id="dc-discount"
              label="Discount"
              unit={discountType === "percent" ? "%" : undefined}
              value={discount}
              onChange={setDiscount}
              error={discountError}
              placeholder={discountType === "percent" ? "25" : "30"}
              min={0}
            />
          </div>
          <NumberField
            id="dc-second"
            label="Extra discount (optional)"
            unit="%"
            value={second}
            onChange={setSecond}
            error={secondCheck.error}
            hint="Applied after the first discount, e.g. an extra 10% off at checkout."
            placeholder="0"
            min={0}
            max={100}
          />
          <NumberField
            id="dc-tax"
            label="Sales tax (optional)"
            unit="%"
            value={tax}
            onChange={setTax}
            error={taxCheck.error}
            hint="Added to the discounted price."
            placeholder="0"
            min={0}
            max={100}
          />
        </div>
      </Panel>

      <div className="space-y-4">
        {result ? (
          <>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Stat
                label={result.tax > 0 ? "Final price (incl. tax)" : "Final price"}
                value={formatAmount(result.total)}
                emphasis
              />
              <Stat label="You save" value={formatAmount(result.savings)} emphasis />
            </dl>
            <StatGrid>
              <Stat label="Total discount" value={`${formatNumber(result.effectivePercent, 2)}%`} />
              <Stat label="Price after discounts" value={formatAmount(result.subtotal)} />
              <Stat label="Sales tax" value={formatAmount(result.tax)} />
            </StatGrid>
            <Panel title="Breakdown">
              <dl className="space-y-1.5 text-sm tabular-nums">
                <Row label="Original price" value={formatAmount(priceCheck.value ?? 0)} />
                <Row
                  label={discountType === "percent" ? `Discount (${formatNumber(discountCheck.value ?? 0, 2)}%)` : "Discount"}
                  value={`− ${formatAmount(result.firstDiscount)}`}
                />
                {result.secondDiscount > 0 ? (
                  <Row
                    label={`Extra discount (${formatNumber(secondCheck.value ?? 0, 2)}%)`}
                    value={`− ${formatAmount(result.secondDiscount)}`}
                  />
                ) : null}
                {result.tax > 0 ? (
                  <Row label={`Sales tax (${formatNumber(taxCheck.value ?? 0, 2)}%)`} value={`+ ${formatAmount(result.tax)}`} />
                ) : null}
                <Row label="You pay" value={formatAmount(result.total)} strong />
              </dl>
            </Panel>
          </>
        ) : (
          <Panel>
            <p className="py-10 text-center text-sm text-muted">Enter the original price and the discount.</p>
          </Panel>
        )}
      </div>
    </ToolColumns>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={
        strong
          ? "flex justify-between gap-4 border-t border-line pt-1.5 font-semibold text-ink"
          : "flex justify-between gap-4 text-muted"
      }
    >
      <dt>{label}</dt>
      <dd className={strong ? undefined : "text-ink"}>{value}</dd>
    </div>
  );
}
