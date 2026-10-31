"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { CopyButton, ErrorText, Panel, Segmented } from "@/components/tool-ui";
import { Checkbox, Hint, Input, Label, Select } from "@/components/ui/field";
import { useTool } from "@/tools/context";
import { errorMessage } from "@/tools/lib/dev";
import {
  CURRENCIES,
  formatGrouped,
  numberToWords,
  ordinalSuffix,
  parseNumberInput,
  type LetterCase,
  type NumberSystem,
  type WordsFormat,
} from "@/tools/lib/number-words";

const FORMATS: Array<{ value: WordsFormat; label: string }> = [
  { value: "words", label: "Words" },
  { value: "ordinal", label: "Ordinal" },
  { value: "currency", label: "Currency" },
  { value: "cheque", label: "Cheque" },
];

const SYSTEMS: Array<{ value: NumberSystem; label: string }> = [
  { value: "international", label: "International (million)" },
  { value: "indian", label: "Indian (lakh, crore)" },
];

const CASES: Array<{ value: LetterCase; label: string }> = [
  { value: "sentence", label: "Sentence case" },
  { value: "lower", label: "lower case" },
  { value: "title", label: "Title Case" },
  { value: "upper", label: "UPPER CASE" },
];

const EXAMPLES = ["1234.56", "21", "1,00,000", "-45.07", "1000000000"];

export default function NumberToWords() {
  const { track } = useTool();
  const inputId = useId();
  const currencyId = useId();
  const caseId = useId();
  const [input, setInput] = useState("");
  const [format, setFormat] = useState<WordsFormat>("words");
  const [system, setSystem] = useState<NumberSystem>("international");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [letterCase, setLetterCase] = useState<LetterCase>("sentence");
  const [useAnd, setUseAnd] = useState(false);

  const currency = CURRENCIES.find((c) => c.code === currencyCode) ?? CURRENCIES[0];

  const result = useMemo(() => {
    if (!input.trim()) return null;
    try {
      const value = parseNumberInput(input);
      const words = numberToWords(value, { format, system, currency, useAnd, letterCase });
      const sign = value.negative ? "-" : "";
      const fraction = value.fraction ? `.${value.fraction}` : "";
      const grouped = sign + formatGrouped(value.integer, system) + fraction;
      return {
        ok: true as const,
        words,
        grouped: format === "ordinal" ? `${formatGrouped(value.integer, system)}${ordinalSuffix(value.integer)}` : grouped,
      };
    } catch (error) {
      return { ok: false as const, error: errorMessage(error, "This is not a valid number.") };
    }
  }, [input, format, system, currency, useAnd, letterCase]);

  const words = result?.ok ? result.words : "";

  useEffect(() => {
    if (words) track();
  }, [words, track]);

  return (
    <div className="space-y-4">
      <Panel>
        <Label htmlFor={inputId}>Number</Label>
        <Input
          id={inputId}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. 1234.56"
          aria-invalid={result?.ok === false}
          className="h-12 font-mono text-lg"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Try:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setInput(example)}
              className="rounded-md border border-line px-2 py-0.5 font-mono text-xs text-ink hover:border-primary-line hover:text-primary"
            >
              {example}
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Options">
        <div className="space-y-4">
          <Segmented label="Format" value={format} onChange={setFormat} options={FORMATS} />
          <Segmented label="Number system" value={system} onChange={setSystem} options={SYSTEMS} />
          <div className="grid gap-4 sm:grid-cols-2">
            {format === "currency" || format === "cheque" ? (
              <div>
                <Label htmlFor={currencyId}>Currency</Label>
                <Select id={currencyId} value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} – {c.major[1]} and {c.minor[1]}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            <div>
              <Label htmlFor={caseId}>Letter case</Label>
              <Select id={caseId} value={letterCase} onChange={(e) => setLetterCase(e.target.value as LetterCase)}>
                {CASES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Checkbox
            label='Use "and" after hundreds (one hundred and five)'
            checked={useAnd}
            onChange={(e) => setUseAnd(e.target.checked)}
          />
        </div>
        <Hint>Supports negative numbers, decimals and values up to 999 sextillion (24 digits).</Hint>
      </Panel>

      {result && !result.ok ? <ErrorText>{result.error}</ErrorText> : null}

      {result?.ok ? (
        <Panel title="In words" actions={<CopyButton text={result.words} />}>
          <p className="font-display text-xl leading-relaxed break-words text-ink sm:text-2xl">{result.words}</p>
          <p className="mt-3 font-mono text-sm text-muted">{result.grouped}</p>
        </Panel>
      ) : null}
    </div>
  );
}
