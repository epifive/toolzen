"use client";

import { Fragment, useDeferredValue, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Hint, Input, Label } from "@/components/ui/field";
import { CopyButton, ErrorText, Panel, TextInput } from "@/components/tool-ui";
import { cn } from "@/lib/utils";
import { useTool } from "@/tools/context";
import { collectMatches, errorMessage, type RegexMatch } from "@/tools/lib/dev";
import { CodeBlock } from "@/tools/lib/dev-ui";

const MATCH_LIMIT = 1000;
const LIST_LIMIT = 200;

const FLAGS: Array<{ flag: string; name: string; description: string }> = [
  { flag: "g", name: "global", description: "Find all matches, not just the first" },
  { flag: "i", name: "ignore case", description: "Letters match regardless of case" },
  { flag: "m", name: "multiline", description: "^ and $ match at the start and end of each line" },
  { flag: "s", name: "dot all", description: ". also matches line breaks" },
  { flag: "u", name: "unicode", description: "Full Unicode support, including \\p{…} classes" },
  { flag: "y", name: "sticky", description: "Match only at the current position" },
];

type Compiled = { ok: true; regex: RegExp } | { ok: false; error: string };

function compile(pattern: string, flags: string): Compiled | null {
  if (!pattern) return null;
  try {
    return { ok: true, regex: new RegExp(pattern, flags) };
  } catch (error) {
    return { ok: false, error: errorMessage(error, "Invalid regular expression.").replace(/^Invalid regular expression:\s*/i, "") };
  }
}

/** Test string with each match wrapped in <mark>. Built from text nodes only, never HTML. */
function Highlighted({ text, matches }: { text: string; matches: RegexMatch[] }) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.index > cursor) parts.push(<Fragment key={`t${i}`}>{text.slice(cursor, m.index)}</Fragment>);
    parts.push(
      m.text ? (
        <mark
          key={`m${i}`}
          title={`Match ${i + 1} at index ${m.index}`}
          className={cn(
            "rounded-sm text-ink",
            i % 2 ? "bg-sky-200 dark:bg-sky-500/40" : "bg-amber-200 dark:bg-amber-500/40",
          )}
        >
          {m.text}
        </mark>
      ) : (
        <span key={`m${i}`} title={`Empty match at index ${m.index}`} className="-mx-px inline-block h-[1.1em] w-0.5 translate-y-[0.15em] bg-primary" />
      ),
    );
    cursor = Math.max(cursor, m.end);
  });
  if (cursor < text.length) parts.push(<Fragment key="rest">{text.slice(cursor)}</Fragment>);

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Test string with matches highlighted"
      className="max-h-[28rem] overflow-auto rounded-lg border border-line bg-paper px-3 py-2.5 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words text-ink"
    >
      {parts}
    </div>
  );
}

function groupLabel(value: string | undefined): ReactNode {
  return value === undefined ? <span className="text-muted">undefined</span> : value === "" ? <span className="text-muted">(empty)</span> : value;
}

export default function RegexTester() {
  const { track } = useTool();
  const patternId = useId();
  const replaceId = useId();
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("g");
  const [text, setText] = useState("");
  const [replacement, setReplacement] = useState("");

  const deferredPattern = useDeferredValue(pattern);
  const deferredText = useDeferredValue(text);
  const deferredReplacement = useDeferredValue(replacement);

  const compiled = useMemo(() => compile(deferredPattern, flags), [deferredPattern, flags]);

  const found = useMemo(
    () => (compiled?.ok && deferredText ? collectMatches(compiled.regex, deferredText, MATCH_LIMIT) : null),
    [compiled, deferredText],
  );

  const replaced = useMemo(() => {
    if (!compiled?.ok || !deferredText) return "";
    return deferredText.replace(new RegExp(compiled.regex.source, compiled.regex.flags), deferredReplacement);
  }, [compiled, deferredText, deferredReplacement]);

  useEffect(() => {
    if (found?.matches.length) track();
  }, [found, track]);

  function toggleFlag(flag: string) {
    const next = flags.includes(flag) ? flags.replace(flag, "") : flags + flag;
    setFlags(FLAGS.map((f) => f.flag).filter((f) => next.includes(f)).join(""));
  }

  const matches = found?.matches ?? [];
  const namedGroups = matches.length && matches[0].named ? Object.keys(matches[0].named) : [];
  const groupCount = matches[0]?.groups.length ?? 0;

  return (
    <div className="space-y-4">
      <Panel>
        <Label htmlFor={patternId}>Regular expression</Label>
        <div className="flex items-center gap-1 rounded-lg border border-line bg-surface pr-3 font-mono text-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          <span aria-hidden className="pl-3 text-muted">
            /
          </span>
          <input
            id={patternId}
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="(?<year>\d{4})-(\d{2})"
            spellCheck={false}
            autoComplete="off"
            className="h-10 min-w-0 flex-1 bg-transparent text-ink placeholder:text-muted/70 focus:outline-none"
          />
          <span aria-hidden className="text-muted">
            /{flags}
          </span>
        </div>

        <fieldset className="mt-3">
          <legend className="mb-1.5 text-sm font-medium text-ink">Flags</legend>
          <div className="flex flex-wrap gap-1.5">
            {FLAGS.map(({ flag, name, description }) => {
              const active = flags.includes(flag);
              return (
                <button
                  key={flag}
                  type="button"
                  aria-pressed={active}
                  title={description}
                  onClick={() => toggleFlag(flag)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-sm transition-colors",
                    active ? "border-primary-line bg-primary-soft text-primary" : "border-line text-muted hover:text-ink",
                  )}
                >
                  <span className="font-mono font-semibold">{flag}</span> <span className="text-xs">{name}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {compiled && !compiled.ok ? (
          <div className="mt-3">
            <ErrorText>{compiled.error}</ErrorText>
          </div>
        ) : null}
      </Panel>

      <TextInput value={text} onChange={setText} label="Test string" placeholder="Paste the text to search…" rows={8} mono />

      {found ? (
        <Panel
          title={
            found.truncated
              ? `First ${MATCH_LIMIT.toLocaleString()} matches`
              : `${matches.length.toLocaleString()} match${matches.length === 1 ? "" : "es"}`
          }
        >
          <Highlighted text={deferredText} matches={matches} />
          {found.truncated ? (
            <Hint>Only the first {MATCH_LIMIT.toLocaleString()} matches are shown to keep the page responsive.</Hint>
          ) : null}
        </Panel>
      ) : null}

      {matches.length ? (
        <Panel title="Match details">
          <div className="overflow-x-auto rounded-lg border border-line" tabIndex={0} role="region" aria-label="Match details">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-paper text-xs text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    #
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Index
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Match
                  </th>
                  {Array.from({ length: groupCount }, (_, g) => (
                    <th key={g} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                      Group {g + 1}
                    </th>
                  ))}
                  {namedGroups.map((name) => (
                    <th key={name} scope="col" className="px-3 py-2 font-mono font-medium whitespace-nowrap">
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono text-[13px] text-ink">
                {matches.slice(0, LIST_LIMIT).map((m, i) => (
                  <tr key={i} className="border-t border-line align-top">
                    <td className="px-3 py-2 text-muted">{i + 1}</td>
                    <td className="px-3 py-2 tabular-nums">{m.index}</td>
                    <td className="max-w-72 px-3 py-2 break-all whitespace-pre-wrap">{groupLabel(m.text)}</td>
                    {m.groups.map((g, gi) => (
                      <td key={gi} className="max-w-56 px-3 py-2 break-all whitespace-pre-wrap">
                        {groupLabel(g)}
                      </td>
                    ))}
                    {namedGroups.map((name) => (
                      <td key={name} className="max-w-56 px-3 py-2 break-all whitespace-pre-wrap">
                        {groupLabel(m.named?.[name])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {matches.length > LIST_LIMIT ? (
            <Hint>The table lists the first {LIST_LIMIT} matches; all of them are highlighted above.</Hint>
          ) : null}
        </Panel>
      ) : found ? (
        <p className="text-sm text-muted">No matches.</p>
      ) : null}

      {compiled?.ok && deferredText ? (
        <Panel title="Replace" actions={<CopyButton text={replaced} />}>
          <Label htmlFor={replaceId}>Replace with</Label>
          <Input
            id={replaceId}
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            placeholder="$<year>/$2"
            spellCheck={false}
            className="font-mono"
          />
          <Hint>
            Use $1, $2… for numbered groups, $&lt;name&gt; for named groups and $&amp; for the whole match.
            {flags.includes("g") ? "" : " Without the g flag only the first match is replaced."}
          </Hint>
          <CodeBlock code={replaced} label="Text after replacement" className="mt-3" />
        </Panel>
      ) : null}
    </div>
  );
}
