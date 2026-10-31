"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { CopyButton, ErrorText, Panel, RangeField, Segmented, ToolColumns } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Select, Switch } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { useTool } from "@/tools/context";
import {
  activeCharsets,
  generatePassphrase,
  generatePassword,
  passphraseEntropy,
  passwordEntropy,
  strengthFromEntropy,
  type CharsetName,
  type PassphraseOptions,
  type PasswordOptions,
} from "@/tools/lib/seo";
import { WORDLIST } from "@/tools/lib/wordlist";

type Mode = "password" | "passphrase";

interface Settings {
  mode: Mode;
  count: number;
  password: PasswordOptions;
  passphrase: PassphraseOptions;
}

const DEFAULTS: Settings = {
  mode: "password",
  count: 1,
  password: {
    length: 16,
    sets: { uppercase: true, lowercase: true, numbers: true, symbols: true },
    excludeSimilar: false,
    excludeAmbiguous: false,
  },
  passphrase: { words: 5, separator: "-", capitalize: true, addNumber: true },
};

const SET_LABELS: Record<CharsetName, string> = {
  uppercase: "Uppercase (A–Z)",
  lowercase: "Lowercase (a–z)",
  numbers: "Numbers (0–9)",
  symbols: "Symbols (!@#$…)",
};

const SEPARATORS: Array<{ value: string; label: string }> = [
  { value: "-", label: "Hyphen (-)" },
  { value: " ", label: "Space" },
  { value: ".", label: "Dot (.)" },
  { value: "_", label: "Underscore (_)" },
  { value: ",", label: "Comma (,)" },
  { value: "", label: "None" },
];

const STRENGTH_TONES = ["bg-red-600", "bg-orange-500", "bg-amber-400", "bg-emerald-500", "bg-emerald-600"];

function generateAll(settings: Settings): string[] {
  if (settings.mode === "password" && !activeCharsets(settings.password).length) return [];
  return Array.from({ length: settings.count }, () =>
    settings.mode === "password" ? generatePassword(settings.password) : generatePassphrase(WORDLIST, settings.passphrase),
  );
}

function entropyOf(settings: Settings): number {
  return settings.mode === "password"
    ? passwordEntropy(settings.password)
    : passphraseEntropy(WORDLIST.length, settings.passphrase);
}

export default function PasswordGenerator() {
  const { track } = useTool();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [results, setResults] = useState<string[]>(() => generateAll(DEFAULTS));

  /** Every change of settings immediately produces fresh passwords. */
  function apply(next: Settings) {
    setSettings(next);
    regenerate(next);
  }

  function regenerate(next: Settings) {
    const values = generateAll(next);
    setResults(values);
    if (values.length) track();
  }
  const setPassword = (patch: Partial<PasswordOptions>) => apply({ ...settings, password: { ...settings.password, ...patch } });
  const setPassphrase = (patch: Partial<PassphraseOptions>) =>
    apply({ ...settings, passphrase: { ...settings.passphrase, ...patch } });

  const bits = entropyOf(settings);
  const strength = strengthFromEntropy(bits);
  const noSets = settings.mode === "password" && !activeCharsets(settings.password).length;

  return (
    <ToolColumns>
      <Panel title="Options">
        <div className="space-y-5">
          <Segmented<Mode>
            label="Generator mode"
            value={settings.mode}
            onChange={(mode) => apply({ ...settings, mode })}
            options={[
              { value: "password", label: "Password" },
              { value: "passphrase", label: "Passphrase" },
            ]}
          />

          {settings.mode === "password" ? (
            <>
              <RangeField
                label="Length"
                value={settings.password.length}
                min={4}
                max={128}
                onChange={(length) => setPassword({ length })}
                format={(v) => `${v} characters`}
              />
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-ink">Include</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(Object.keys(SET_LABELS) as CharsetName[]).map((name) => (
                    <Checkbox
                      key={name}
                      label={SET_LABELS[name]}
                      checked={settings.password.sets[name]}
                      onChange={(e) => setPassword({ sets: { ...settings.password.sets, [name]: e.target.checked } })}
                    />
                  ))}
                </div>
              </fieldset>
              <div className="space-y-3">
                <Switch
                  label="Exclude similar characters"
                  description="Leaves out I, l, 1, O and 0, which are easy to confuse."
                  checked={settings.password.excludeSimilar}
                  onChange={(e) => setPassword({ excludeSimilar: e.target.checked })}
                />
                <Switch
                  label="Exclude ambiguous symbols"
                  description={"Leaves out { } [ ] ( ) / \\ ' \" ` ~ , ; : . < > which some systems reject."}
                  checked={settings.password.excludeAmbiguous}
                  onChange={(e) => setPassword({ excludeAmbiguous: e.target.checked })}
                />
              </div>
              <p className="text-xs text-muted">Every password contains at least one character from each selected type.</p>
            </>
          ) : (
            <>
              <RangeField
                label="Words"
                value={settings.passphrase.words}
                min={3}
                max={12}
                onChange={(words) => setPassphrase({ words })}
                format={(v) => `${v} words`}
              />
              <Field label="Separator" htmlFor="pw-separator">
                <Select
                  id="pw-separator"
                  value={settings.passphrase.separator}
                  onChange={(e) => setPassphrase({ separator: e.target.value })}
                >
                  {SEPARATORS.map((s) => (
                    <option key={s.label} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="space-y-3">
                <Switch
                  label="Capitalize words"
                  checked={settings.passphrase.capitalize}
                  onChange={(e) => setPassphrase({ capitalize: e.target.checked })}
                />
                <Switch
                  label="Add a number"
                  description="Appends a number from 0 to 99 to one random word."
                  checked={settings.passphrase.addNumber}
                  onChange={(e) => setPassphrase({ addNumber: e.target.checked })}
                />
              </div>
              <p className="text-xs text-muted">Words are picked from a list of {WORDLIST.length} common English words.</p>
            </>
          )}

          <RangeField
            label="How many"
            value={settings.count}
            min={1}
            max={20}
            onChange={(count) => apply({ ...settings, count })}
            format={(v) =>
              settings.mode === "password" ? `${v} password${v === 1 ? "" : "s"}` : `${v} passphrase${v === 1 ? "" : "s"}`
            }
          />
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel
          title={settings.count > 1 ? "Your passwords" : "Your password"}
          actions={
            <>
              {results.length > 1 ? <CopyButton text={results.join("\n")} label="Copy all" /> : null}
              <Button size="sm" onClick={() => regenerate(settings)} disabled={noSets}>
                <RefreshCw aria-hidden />
                Generate
              </Button>
            </>
          }
        >
          {noSets ? (
            <ErrorText>Select at least one character type.</ErrorText>
          ) : (
            <ul className="space-y-2" aria-live="polite">
              {results.map((value, index) => (
                <li
                  key={`${index}-${value}`}
                  className="flex items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2"
                >
                  <span className="min-w-0 flex-1 font-mono text-[15px] break-all text-ink">{value}</span>
                  <CopyButton text={value} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {!noSets ? (
          <Panel title="Strength">
            <div className="flex gap-1" aria-hidden>
              {STRENGTH_TONES.map((tone, i) => (
                <span
                  key={tone}
                  className={cn("h-2 flex-1 rounded-full", i <= strength.score ? STRENGTH_TONES[strength.score] : "bg-line")}
                />
              ))}
            </div>
            <p className="mt-2 flex flex-wrap justify-between gap-2 text-sm">
              <span className="font-semibold text-ink">{strength.label}</span>
              <span className="text-muted tabular-nums">≈ {Math.round(bits)} bits of entropy</span>
            </p>
            <p className="mt-2 text-xs text-muted">
              Generated in your browser with a cryptographically secure random generator. Nothing is sent or stored.
            </p>
          </Panel>
        ) : null}
      </div>
    </ToolColumns>
  );
}
