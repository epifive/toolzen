"use client";

import { useEffect, useId, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Hint, Input, Label } from "@/components/ui/field";
import { OutputBox, Panel, Stat, StatGrid } from "@/components/tool-ui";
import { useTool } from "@/tools/context";
import {
  alphabetOf,
  characterGroups,
  entropyBits,
  RANDOM_CHARSETS,
  randomString,
  SIMILAR_CHARACTERS,
  type RandomCharset,
  type RandomStringOptions,
} from "@/tools/lib/random-string";

const MAX_LENGTH = 1024;
const MAX_COUNT = 1000;

interface Settings extends RandomStringOptions {
  count: number;
}

const DEFAULTS: Settings = {
  length: 16,
  count: 10,
  sets: { uppercase: true, lowercase: true, digits: true, symbols: false },
  custom: "",
  excludeSimilar: false,
  everyGroup: true,
};

const SET_LABELS: Record<RandomCharset, string> = {
  uppercase: "Uppercase (A–Z)",
  lowercase: "Lowercase (a–z)",
  digits: "Digits (0–9)",
  symbols: "Symbols (!#$%…)",
};

const isValidNumber = (value: number, max: number) => Number.isInteger(value) && value >= 1 && value <= max;

function generateAll(settings: Settings): string[] {
  if (!isValidNumber(settings.length, MAX_LENGTH) || !isValidNumber(settings.count, MAX_COUNT)) return [];
  const groups = characterGroups(settings);
  if (!groups.length) return [];
  return Array.from({ length: settings.count }, () => randomString(groups, settings.length, settings.everyGroup));
}

function strengthLabel(bits: number): string {
  if (bits < 40) return "Weak";
  if (bits < 64) return "Fair";
  if (bits < 100) return "Strong";
  return "Very strong";
}

export default function RandomStringGenerator() {
  const { track } = useTool();
  const lengthId = useId();
  const countId = useId();
  const customId = useId();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [results, setResults] = useState<string[]>(() => generateAll(DEFAULTS));

  /** Every change of settings immediately produces fresh strings. */
  function update(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    setResults(generateAll(next));
  }

  useEffect(() => {
    if (results.length) track();
  }, [results, track]);

  const groups = characterGroups(settings);
  const alphabetSize = alphabetOf(groups).length;
  const lengthValid = isValidNumber(settings.length, MAX_LENGTH);
  const countValid = isValidNumber(settings.count, MAX_COUNT);
  const bits = lengthValid ? entropyBits(alphabetSize, settings.length) : 0;
  const output = results.join("\n");

  return (
    <div className="space-y-4">
      <Panel title="Settings">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={lengthId}>Length</Label>
            <Input
              id={lengthId}
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_LENGTH}
              value={Number.isNaN(settings.length) ? "" : settings.length}
              onChange={(e) => update({ length: e.target.valueAsNumber })}
              aria-invalid={!lengthValid}
            />
            {!lengthValid ? <Hint className="text-red-600 dark:text-red-400">Enter a whole number from 1 to {MAX_LENGTH}.</Hint> : null}
          </div>
          <div>
            <Label htmlFor={countId}>How many</Label>
            <Input
              id={countId}
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_COUNT}
              value={Number.isNaN(settings.count) ? "" : settings.count}
              onChange={(e) => update({ count: e.target.valueAsNumber })}
              aria-invalid={!countValid}
            />
            {!countValid ? <Hint className="text-red-600 dark:text-red-400">Enter a whole number from 1 to {MAX_COUNT}.</Hint> : null}
          </div>
        </div>

        <fieldset className="mt-4">
          <legend className="mb-1.5 text-sm font-medium text-ink">Characters</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(RANDOM_CHARSETS) as RandomCharset[]).map((name) => (
              <Checkbox
                key={name}
                label={SET_LABELS[name]}
                checked={settings.sets[name]}
                onChange={(e) => update({ sets: { ...settings.sets, [name]: e.target.checked } })}
              />
            ))}
          </div>
        </fieldset>

        <div className="mt-4">
          <Label htmlFor={customId}>Custom characters</Label>
          <Input
            id={customId}
            value={settings.custom}
            onChange={(e) => update({ custom: e.target.value })}
            placeholder="e.g. -_ or äöü"
            spellCheck={false}
            className="font-mono"
            maxLength={200}
          />
          <Hint>Added to the selected sets. Duplicates are ignored.</Hint>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
          <Checkbox
            label={`Exclude look-alikes (${SIMILAR_CHARACTERS.split("").join(" ")})`}
            checked={settings.excludeSimilar}
            onChange={(e) => update({ excludeSimilar: e.target.checked })}
          />
          <Checkbox
            label="Use every selected group at least once"
            checked={settings.everyGroup}
            onChange={(e) => update({ everyGroup: e.target.checked })}
          />
        </div>

        {!groups.length ? <Hint className="text-red-600 dark:text-red-400">Select at least one character set or add custom characters.</Hint> : null}

        <Button className="mt-4" onClick={() => setResults(generateAll(settings))} disabled={!groups.length || !lengthValid || !countValid}>
          <RefreshCw aria-hidden />
          Generate
        </Button>
      </Panel>

      <StatGrid>
        <Stat label="Possible characters" value={alphabetSize.toLocaleString()} />
        <Stat label="Entropy per string" value={`${Math.round(bits)} bits`} />
        <Stat label="Strength" value={alphabetSize > 1 ? strengthLabel(bits) : "—"} emphasis />
      </StatGrid>

      <OutputBox
        value={output}
        label={`${results.length.toLocaleString()} random string${results.length === 1 ? "" : "s"}`}
        filename="random-strings.txt"
        mono
        rows={Math.min(14, Math.max(3, results.length))}
      />
      <p className="text-xs text-muted">
        Generated in your browser with crypto.getRandomValues and rejection sampling, so every character is equally likely.
      </p>
    </div>
  );
}
