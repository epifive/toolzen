"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Dices, Trophy } from "lucide-react";
import { CopyButton, Panel, TextInput, ToolColumns } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import { Checkbox, Hint, Input, Label } from "@/components/ui/field";
import { cn, uid } from "@/lib/utils";
import { useTool } from "@/tools/context";
import { secureRandomInt, secureShuffle } from "@/tools/lib/text";

const SPIN_MS = 1600;
const TICK_MS = 70;

interface Draw {
  id: string;
  winners: string[];
  time: string;
}

function parseNames(text: string, unique: boolean): string[] {
  const names = text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!unique) return names;
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Remove one line per winner from the list, keeping everything else as typed. */
function removeWinners(text: string, winners: string[]): string {
  const remaining = [...winners];
  return text
    .split(/\r\n|\r|\n/)
    .filter((line) => {
      const index = remaining.indexOf(line.trim());
      if (index === -1) return true;
      remaining.splice(index, 1);
      return false;
    })
    .join("\n");
}

export default function RandomNamePicker() {
  const { track } = useTool();
  const countId = useId();
  const [text, setText] = useState("");
  const [count, setCount] = useState(1);
  const [unique, setUnique] = useState(true);
  const [removePicked, setRemovePicked] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [rolling, setRolling] = useState("");
  const [winners, setWinners] = useState<string[]>([]);
  const [history, setHistory] = useState<Draw[]>([]);
  const timers = useRef<{ interval?: ReturnType<typeof setInterval>; timeout?: ReturnType<typeof setTimeout> }>({});

  const names = useMemo(() => parseNames(text, unique), [text, unique]);
  const validCount = Number.isInteger(count) && count >= 1 && count <= Math.max(1, names.length);

  useEffect(() => {
    const active = timers.current;
    return () => {
      clearInterval(active.interval);
      clearTimeout(active.timeout);
    };
  }, []);

  function finish(picked: string[]) {
    setSpinning(false);
    setRolling("");
    setWinners(picked);
    setHistory((h) => [{ id: uid(), winners: picked, time: new Date().toLocaleTimeString() }, ...h].slice(0, 20));
    if (removePicked) setText((current) => removeWinners(current, picked));
    track();
  }

  function pick() {
    if (!names.length || !validCount || spinning) return;
    const picked = secureShuffle(names).slice(0, count);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || names.length < 2) {
      finish(picked);
      return;
    }
    setSpinning(true);
    setWinners([]);
    const pool = names;
    timers.current.interval = setInterval(() => setRolling(pool[secureRandomInt(pool.length)]), TICK_MS);
    timers.current.timeout = setTimeout(() => {
      clearInterval(timers.current.interval);
      finish(picked);
    }, SPIN_MS);
  }

  return (
    <div className="space-y-4">
      <ToolColumns>
        <div className="space-y-4">
          <TextInput value={text} onChange={setText} label="Names (one per line)" placeholder={"Alice\nBob\nCharlie\nDiana"} rows={12} />
          <p className="text-sm text-muted">
            {names.length.toLocaleString()} name{names.length === 1 ? "" : "s"} in the draw
          </p>
        </div>

        <div className="space-y-4">
          <Panel title="Draw">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
              <div className="w-32">
                <Label htmlFor={countId}>Winners</Label>
                <Input
                  id={countId}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={Math.max(1, names.length)}
                  value={Number.isNaN(count) ? "" : count}
                  onChange={(e) => setCount(e.target.valueAsNumber)}
                  aria-invalid={!validCount}
                />
              </div>
              <Button size="lg" onClick={pick} disabled={!names.length || !validCount || spinning}>
                <Dices aria-hidden />
                {spinning ? "Picking…" : count > 1 ? `Pick ${count} winners` : "Pick a winner"}
              </Button>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Checkbox label="Ignore duplicate names" checked={unique} onChange={(e) => setUnique(e.target.checked)} />
              <Checkbox label="Remove winners from the list after each draw" checked={removePicked} onChange={(e) => setRemovePicked(e.target.checked)} />
            </div>
            {!validCount && names.length ? (
              <Hint className="text-red-600 dark:text-red-400">Choose between 1 and {names.length} winners.</Hint>
            ) : (
              <Hint>Each name can win only once per draw. Picks use your browser&apos;s cryptographic random generator.</Hint>
            )}
          </Panel>

          <section
            aria-live="polite"
            aria-busy={spinning}
            aria-label="Result"
            className={cn(
              "flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border px-4 py-6 text-center",
              winners.length ? "border-primary-line bg-primary-soft" : "border-line bg-surface",
            )}
          >
            {spinning ? (
              <p className="font-display text-3xl font-semibold break-words text-muted" aria-hidden>
                {rolling || "…"}
              </p>
            ) : winners.length ? (
              <>
                <Trophy className="size-7 text-primary" aria-hidden />
                <p className="text-sm text-muted">{winners.length > 1 ? "The winners are" : "The winner is"}</p>
                <ol className="space-y-1">
                  {winners.map((name, i) => (
                    <li key={`${name}-${i}`} className="font-display text-2xl font-semibold break-words text-ink sm:text-3xl">
                      {winners.length > 1 ? <span className="mr-2 text-base text-muted tabular-nums">{i + 1}.</span> : null}
                      {name}
                    </li>
                  ))}
                </ol>
                <CopyButton text={winners.join("\n")} />
              </>
            ) : (
              <p className="text-sm text-muted">Add names and press the button to draw.</p>
            )}
          </section>
        </div>
      </ToolColumns>

      {history.length ? (
        <Panel
          title="Previous draws"
          actions={
            <Button size="sm" variant="ghost" onClick={() => setHistory([])}>
              Clear
            </Button>
          }
        >
          <ol className="space-y-1.5 text-sm">
            {history.map((draw) => (
              <li key={draw.id} className="flex flex-wrap gap-x-3">
                <span className="text-muted tabular-nums">{draw.time}</span>
                <span className="text-ink">{draw.winners.join(", ")}</span>
              </li>
            ))}
          </ol>
        </Panel>
      ) : null}
    </div>
  );
}
