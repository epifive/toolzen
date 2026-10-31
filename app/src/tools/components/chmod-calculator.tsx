"use client";

import { useId, useState } from "react";
import { Checkbox, Hint, Input, Label } from "@/components/ui/field";
import { Panel, ToolColumns } from "@/components/tool-ui";
import { cn } from "@/lib/utils";
import { useTool } from "@/tools/context";
import {
  bitMask,
  describeMode,
  hasBit,
  modeToChmodSymbolic,
  modeToOctal,
  modeToSymbolic,
  parseOctalMode,
  parseSymbolicMode,
  PERMISSION_BITS,
  PERMISSION_CLASSES,
  SPECIAL_BITS,
  toggleBit,
} from "@/tools/lib/chmod";
import { ValueList, ValueRow } from "@/tools/lib/dev-ui";

const PRESETS: Array<{ mode: number; label: string }> = [
  { mode: 0o644, label: "Files" },
  { mode: 0o755, label: "Folders & scripts" },
  { mode: 0o600, label: "Private file" },
  { mode: 0o700, label: "Private folder" },
  { mode: 0o664, label: "Group-writable file" },
  { mode: 0o775, label: "Group-writable folder" },
  { mode: 0o400, label: "Read-only key" },
  { mode: 0o1777, label: "Shared temp folder" },
];

/** Quote a file name for a POSIX shell when it contains anything but safe characters. */
function shellQuote(name: string): string {
  if (/^[\w@%+=:,./-]+$/.test(name)) return name;
  return `'${name.replace(/'/g, `'\\''`)}'`;
}

export default function ChmodCalculator() {
  const { track } = useTool();
  const octalId = useId();
  const symbolicId = useId();
  const fileId = useId();
  const [mode, setMode] = useState(0o755);
  // While the visitor types, the raw text is kept; null shows the value derived from the mode.
  const [octalDraft, setOctalDraft] = useState<string | null>(null);
  const [symbolicDraft, setSymbolicDraft] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [recursive, setRecursive] = useState(false);

  function apply(next: number) {
    setMode(next);
    track();
  }

  function selectMode(next: number) {
    setOctalDraft(null);
    setSymbolicDraft(null);
    apply(next);
  }

  const octal = modeToOctal(mode);
  const symbolic = modeToSymbolic(mode);
  const octalInvalid = octalDraft !== null && parseOctalMode(octalDraft) === null;
  const symbolicInvalid = symbolicDraft !== null && parseSymbolicMode(symbolicDraft) === null;
  const target = shellQuote(fileName.trim() || "file");
  const flag = recursive ? "-R " : "";

  return (
    <div className="space-y-4">
      <ToolColumns>
        <Panel title="Permissions">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th scope="col" className="pb-2 text-left font-medium">
                    <span className="sr-only">Who</span>
                  </th>
                  {PERMISSION_BITS.map((bit) => (
                    <th key={bit.key} scope="col" className="px-2 pb-2 text-center font-medium">
                      {bit.label} ({bit.value})
                    </th>
                  ))}
                  <th scope="col" className="pb-2 text-right font-medium">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {PERMISSION_CLASSES.map((cls) => (
                  <tr key={cls.key}>
                    <th scope="row" className="py-2.5 text-left font-medium text-ink">
                      {cls.label}
                    </th>
                    {PERMISSION_BITS.map((bit) => (
                      <td key={bit.key} className="px-2 py-2.5 text-center">
                        <input
                          type="checkbox"
                          className="size-5 accent-[var(--primary)]"
                          aria-label={`${cls.label} ${bit.label.toLowerCase()}`}
                          checked={hasBit(mode, cls.key, bit.key)}
                          onChange={(e) => selectMode(toggleBit(mode, bitMask(cls.key, bit.key), e.target.checked))}
                        />
                      </td>
                    ))}
                    <td className="py-2.5 text-right font-mono text-base text-ink">{(mode >> cls.shift) & 7}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <fieldset className="mt-4 border-t border-line pt-4">
            <legend className="sr-only">Special bits</legend>
            <div className="space-y-2">
              {SPECIAL_BITS.map((bit) => (
                <div key={bit.value}>
                  <Checkbox
                    label={bit.label}
                    checked={(mode & bit.value) !== 0}
                    onChange={(e) => selectMode(toggleBit(mode, bit.value, e.target.checked))}
                  />
                  <p className="ml-6 text-xs text-muted">{bit.hint}</p>
                </div>
              ))}
            </div>
          </fieldset>
        </Panel>

        <div className="space-y-4">
          <Panel title="Convert">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor={octalId}>Numeric (octal)</Label>
                <Input
                  id={octalId}
                  value={octalDraft ?? octal}
                  inputMode="numeric"
                  spellCheck={false}
                  autoComplete="off"
                  className="h-12 font-mono text-xl"
                  aria-invalid={octalInvalid}
                  onChange={(e) => {
                    setOctalDraft(e.target.value);
                    const parsed = parseOctalMode(e.target.value);
                    if (parsed !== null) {
                      setSymbolicDraft(null);
                      apply(parsed);
                    }
                  }}
                  onBlur={() => setOctalDraft(null)}
                />
                <Hint className={cn(octalInvalid && "text-red-600 dark:text-red-400")}>
                  {octalInvalid ? "Use up to 4 digits from 0 to 7, e.g. 755." : "e.g. 644, 755 or 4755"}
                </Hint>
              </div>
              <div>
                <Label htmlFor={symbolicId}>Symbolic</Label>
                <Input
                  id={symbolicId}
                  value={symbolicDraft ?? symbolic}
                  spellCheck={false}
                  autoComplete="off"
                  className="h-12 font-mono text-xl"
                  aria-invalid={symbolicInvalid}
                  onChange={(e) => {
                    setSymbolicDraft(e.target.value);
                    const parsed = parseSymbolicMode(e.target.value);
                    if (parsed !== null) {
                      setOctalDraft(null);
                      apply(parsed);
                    }
                  }}
                  onBlur={() => setSymbolicDraft(null)}
                />
                <Hint className={cn(symbolicInvalid && "text-red-600 dark:text-red-400")}>
                  {symbolicInvalid ? "Use 9 characters like rwxr-xr-x (or ls -l output)." : "e.g. rw-r--r-- or -rwxr-xr-x"}
                </Hint>
              </div>
            </div>

            <ul className="mt-4 space-y-1 text-sm text-ink" aria-live="polite">
              {describeMode(mode).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Panel>

          <Panel title="Command">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <Label htmlFor={fileId}>File or folder</Label>
                <Input
                  id={fileId}
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="file"
                  spellCheck={false}
                  className="font-mono"
                />
              </div>
              <Checkbox label="Recursive (-R)" checked={recursive} onChange={(e) => setRecursive(e.target.checked)} className="pb-2.5" />
            </div>
            <ValueList className="mt-4">
              <ValueRow label="Numeric" value={`chmod ${flag}${octal} ${target}`} />
              <ValueRow label="Symbolic" value={`chmod ${flag}${modeToChmodSymbolic(mode)} ${target}`} />
              <ValueRow label="ls -l shows" value={`-${symbolic}`} />
            </ValueList>
          </Panel>
        </div>
      </ToolColumns>

      <Panel title="Common permissions">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESETS.map((preset) => (
            <button
              key={preset.mode}
              type="button"
              aria-pressed={preset.mode === mode}
              onClick={() => selectMode(preset.mode)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left transition-colors",
                preset.mode === mode ? "border-primary bg-primary-soft" : "border-line bg-surface hover:border-primary-line",
              )}
            >
              <span className="block font-mono text-base font-semibold text-ink">{modeToOctal(preset.mode)}</span>
              <span className="block font-mono text-xs text-muted">{modeToSymbolic(preset.mode)}</span>
              <span className="mt-1 block text-xs text-ink">{preset.label}</span>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
