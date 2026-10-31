"use client";

import { useState } from "react";
import { Dices } from "lucide-react";
import { CopyButton, DownloadTextButton, ErrorText, Panel, Segmented, Stat, ToolColumns } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Select } from "@/components/ui/field";
import { useTool } from "@/tools/context";
import { checkNumber, formatNumber } from "@/tools/lib/calc";
import { NumberField } from "@/tools/lib/calc-ui";
import { generateRandom, planRandom } from "@/tools/lib/stats";

type Kind = "integer" | "decimal";
type Order = "none" | "asc" | "desc";
type Separator = "newline" | "comma" | "space";

const SEPARATORS: Record<Separator, string> = { newline: "\n", comma: ", ", space: " " };
const MAX_COUNT = 10_000;

export default function RandomNumberGenerator() {
  const { track } = useTool();
  const [min, setMin] = useState("1");
  const [max, setMax] = useState("100");
  const [count, setCount] = useState("1");
  const [kind, setKind] = useState<Kind>("integer");
  const [decimals, setDecimals] = useState("2");
  const [unique, setUnique] = useState(false);
  const [order, setOrder] = useState<Order>("none");
  const [separator, setSeparator] = useState<Separator>("newline");
  const [numbers, setNumbers] = useState<number[]>([]);
  const [usedDecimals, setUsedDecimals] = useState(0);
  const [error, setError] = useState("");

  const minCheck = checkNumber(min, { min: -1e15, max: 1e15 });
  const maxCheck = checkNumber(max, { min: -1e15, max: 1e15 });
  const countCheck = checkNumber(count, { min: 1, max: MAX_COUNT, integer: true });
  const decimalsCheck = checkNumber(decimals, { min: 1, max: 10, integer: true });
  const places = kind === "integer" ? 0 : decimalsCheck.value;
  const ready = minCheck.value !== null && maxCheck.value !== null && countCheck.value !== null && places !== null;

  function generate() {
    if (minCheck.value === null || maxCheck.value === null || countCheck.value === null || places === null) return;
    const plan = planRandom({ min: minCheck.value, max: maxCheck.value, count: countCheck.value, decimals: places, unique });
    if (!plan.ok) {
      setError(plan.error);
      return;
    }
    const drawn = generateRandom(plan, countCheck.value, unique);
    if (order === "asc") drawn.sort((a, b) => a - b);
    if (order === "desc") drawn.sort((a, b) => b - a);
    setError("");
    setNumbers(drawn);
    setUsedDecimals(places);
    track();
  }

  const text = numbers.map((n) => n.toFixed(usedDecimals)).join(SEPARATORS[separator]);

  return (
    <ToolColumns>
      <Panel title="Settings">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <NumberField id="rng-min" label="Minimum" value={min} onChange={setMin} error={minCheck.error} />
            <NumberField id="rng-max" label="Maximum" value={max} onChange={setMax} error={maxCheck.error} />
          </div>
          <NumberField
            id="rng-count"
            label="How many numbers"
            value={count}
            onChange={setCount}
            error={countCheck.error}
            min={1}
            max={MAX_COUNT}
            step={1}
          />
          <div className="flex flex-wrap items-end gap-3">
            <Segmented<Kind>
              label="Number type"
              value={kind}
              onChange={setKind}
              options={[
                { value: "integer", label: "Whole numbers" },
                { value: "decimal", label: "Decimals" },
              ]}
            />
            {kind === "decimal" ? (
              <NumberField
                id="rng-decimals"
                label="Decimal places"
                value={decimals}
                onChange={setDecimals}
                error={decimalsCheck.error}
                min={1}
                max={10}
                step={1}
                className="w-36"
              />
            ) : null}
          </div>
          <Checkbox label="No repeats (unique numbers)" checked={unique} onChange={(e) => setUnique(e.target.checked)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Sort" htmlFor="rng-order">
              <Select id="rng-order" value={order} onChange={(e) => setOrder(e.target.value as Order)}>
                <option value="none">Random order</option>
                <option value="asc">Smallest first</option>
                <option value="desc">Largest first</option>
              </Select>
            </Field>
            <Field label="Separate with" htmlFor="rng-separator">
              <Select id="rng-separator" value={separator} onChange={(e) => setSeparator(e.target.value as Separator)}>
                <option value="newline">New lines</option>
                <option value="comma">Commas</option>
                <option value="space">Spaces</option>
              </Select>
            </Field>
          </div>
          <Button onClick={generate} disabled={!ready} className="w-full sm:w-auto">
            <Dices aria-hidden />
            Generate
          </Button>
          <ErrorText>{error}</ErrorText>
        </div>
      </Panel>

      <div className="space-y-4">
        {numbers.length === 1 ? (
          <dl aria-live="polite">
            <Stat label="Your random number" value={<span className="break-all">{text}</span>} emphasis />
          </dl>
        ) : null}
        <Panel
          title={numbers.length > 1 ? `${formatNumber(numbers.length, 0)} random numbers` : "Result"}
          actions={
            <>
              <CopyButton text={text} />
              <DownloadTextButton text={text} filename="random-numbers.txt" />
            </>
          }
        >
          <textarea
            readOnly
            value={text}
            rows={10}
            aria-label="Generated numbers"
            placeholder="Choose a range and press Generate."
            className="w-full resize-y rounded-lg border border-line bg-paper px-3 py-2.5 font-mono text-[13px] text-ink focus:outline-none"
          />
          <p className="mt-2 text-xs text-muted">
            Numbers come from your browser&apos;s cryptographically secure generator (crypto.getRandomValues) with unbiased
            sampling, so every value in the range is equally likely.
          </p>
        </Panel>
      </div>
    </ToolColumns>
  );
}
