"use client";

import { useEffect, useState } from "react";
import { Shuffle } from "lucide-react";
import { OutputBox, Panel, TextInput, ToolColumns } from "@/components/tool-ui";
import { Button } from "@/components/ui/button";
import { Checkbox, Hint } from "@/components/ui/field";
import { useTool } from "@/tools/context";
import { graphemes, secureShuffle } from "@/tools/lib/text";

interface ScrambleOptions {
  letters: boolean;
  keepEnds: boolean;
  words: boolean;
  lines: boolean;
}

const WORD = /\p{L}[\p{L}\p{M}]*/gu;

/** Shuffle the letters of one word, retrying so the result differs from the original when it can. */
function scrambleWord(word: string, keepEnds: boolean): string {
  const chars = graphemes(word);
  if (keepEnds && chars.length <= 3) return word;
  const inner = keepEnds ? chars.slice(1, -1) : chars;
  if (new Set(inner).size < 2) return word;
  const original = inner.join("");
  let shuffled = inner;
  for (let attempt = 0; attempt < 8; attempt++) {
    shuffled = secureShuffle(inner);
    if (shuffled.join("") !== original) break;
  }
  return keepEnds ? chars[0] + shuffled.join("") + chars[chars.length - 1] : shuffled.join("");
}

/** Shuffle the words of a line while keeping the original spacing between them. */
function shuffleWordOrder(line: string): string {
  const words = line.match(/\S+/g);
  if (!words || words.length < 2) return line;
  const shuffled = secureShuffle(words);
  let i = 0;
  return line.replace(/\S+/g, () => shuffled[i++]);
}

function scramble(text: string, { letters, keepEnds, words, lines }: ScrambleOptions): string {
  let rows = text.split(/\r\n|\r|\n/);
  if (lines) rows = secureShuffle(rows);
  return rows
    .map((row) => {
      let out = words ? shuffleWordOrder(row) : row;
      if (letters) out = out.replace(WORD, (word) => scrambleWord(word, keepEnds));
      return out;
    })
    .join("\n");
}

export default function WordScrambler() {
  const { track } = useTool();
  const [text, setText] = useState("");
  const [options, setOptions] = useState<ScrambleOptions>({ letters: true, keepEnds: true, words: false, lines: false });
  const [output, setOutput] = useState("");

  const nothingSelected = !options.letters && !options.words && !options.lines;

  function run(nextText: string, nextOptions: ScrambleOptions) {
    setText(nextText);
    setOptions(nextOptions);
    const active = nextOptions.letters || nextOptions.words || nextOptions.lines;
    setOutput(nextText && active ? scramble(nextText, nextOptions) : "");
  }

  function toggle(key: keyof ScrambleOptions, value: boolean) {
    run(text, { ...options, [key]: value });
  }

  useEffect(() => {
    if (output) track();
  }, [output, track]);

  return (
    <div className="space-y-4">
      <Panel
        title="Scramble"
        actions={
          <Button size="sm" onClick={() => run(text, options)} disabled={!text || nothingSelected}>
            <Shuffle aria-hidden />
            Scramble again
          </Button>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-6">
          <Checkbox label="Scramble letters inside words" checked={options.letters} onChange={(e) => toggle("letters", e.target.checked)} />
          <Checkbox
            label="Keep first and last letter"
            checked={options.keepEnds}
            disabled={!options.letters}
            onChange={(e) => toggle("keepEnds", e.target.checked)}
          />
          <Checkbox label="Shuffle word order" checked={options.words} onChange={(e) => toggle("words", e.target.checked)} />
          <Checkbox label="Shuffle lines" checked={options.lines} onChange={(e) => toggle("lines", e.target.checked)} />
        </div>
        <Hint className={nothingSelected ? "text-red-600 dark:text-red-400" : undefined}>
          {nothingSelected
            ? "Choose at least one option."
            : "Uses your browser's cryptographic random generator, so every scramble is unpredictable."}
        </Hint>
      </Panel>

      <ToolColumns>
        <TextInput value={text} onChange={(value) => run(value, options)} label="Your text" placeholder="Type or paste your text here…" rows={12} />
        <OutputBox value={output} label="Scrambled text" filename="scrambled-text.txt" rows={12} />
      </ToolColumns>
    </div>
  );
}
