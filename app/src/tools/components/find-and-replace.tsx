"use client";

import { useDeferredValue, useEffect, useId, useMemo, useState, type ChangeEvent } from "react";
import { ErrorText, OutputBox, Panel, Segmented, TextInput, ToolColumns } from "@/components/tool-ui";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { findAndReplace, type FindOptions } from "@/tools/lib/text";
import { useTool } from "@/tools/context";

type Scope = "all" | "first";

const SCOPES: Array<{ value: Scope; label: string }> = [
  { value: "all", label: "Replace all" },
  { value: "first", label: "First match only" },
];

export default function FindAndReplace() {
  const { track } = useTool();
  const findId = useId();
  const replaceId = useId();
  const [text, setText] = useState("");
  const [find, setFind] = useState("");
  const [replacement, setReplacement] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [flags, setFlags] = useState({ matchCase: false, wholeWord: false, regex: false });

  const deferredText = useDeferredValue(text);
  const result = useMemo(() => {
    const options: FindOptions = { ...flags, replaceAll: scope === "all" };
    return findAndReplace(deferredText, find, replacement, options);
  }, [deferredText, find, replacement, flags, scope]);

  const output = result.ok ? result.output : "";

  useEffect(() => {
    if (result.ok && result.replaced > 0) track();
  }, [result, track]);

  function toggle(key: keyof typeof flags) {
    return (e: ChangeEvent<HTMLInputElement>) => setFlags((prev) => ({ ...prev, [key]: e.target.checked }));
  }

  return (
    <div className="space-y-4">
      <Panel title="Find and replace">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Find" htmlFor={findId}>
            <Input
              id={findId}
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder={flags.regex ? "e.g. (\\d+)-(\\d+)" : "Text to find"}
              spellCheck={false}
              autoComplete="off"
              className={flags.regex ? "font-mono" : undefined}
            />
          </Field>
          <Field
            label="Replace with"
            htmlFor={replaceId}
            hint={flags.regex ? "Use $1, $2… for captured groups, $& for the whole match, \\n for a new line." : undefined}
          >
            <Input
              id={replaceId}
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder="Leave empty to delete matches"
              spellCheck={false}
              autoComplete="off"
              className={flags.regex ? "font-mono" : undefined}
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Checkbox label="Match case" checked={flags.matchCase} onChange={toggle("matchCase")} />
          <Checkbox label="Whole words only" checked={flags.wholeWord} onChange={toggle("wholeWord")} />
          <Checkbox label="Regular expression" checked={flags.regex} onChange={toggle("regex")} />
          <Segmented label="Replace" value={scope} onChange={setScope} options={SCOPES} />
        </div>

        <div className="mt-4" aria-live="polite">
          {result.ok ? (
            find && deferredText ? (
              <p className="text-sm text-muted">
                <span className="font-semibold text-ink tabular-nums">{result.matches.toLocaleString()}</span>{" "}
                {result.matches === 1 ? "match" : "matches"} found
                {result.replaced ? (
                  <>
                    , <span className="font-semibold text-primary tabular-nums">{result.replaced.toLocaleString()}</span> replaced
                  </>
                ) : null}
                .
              </p>
            ) : null
          ) : (
            <ErrorText>{result.error}</ErrorText>
          )}
        </div>
      </Panel>

      <ToolColumns>
        <TextInput value={text} onChange={setText} label="Your text" placeholder="Paste the text to search in…" rows={14} />
        <OutputBox value={output} label="Updated text" filename="replaced-text.txt" rows={14} />
      </ToolColumns>
    </div>
  );
}
