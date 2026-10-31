"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { OutputBox, Segmented, TextInput } from "@/components/tool-ui";
import { useTool } from "@/tools/context";
import { decodeHtmlEntities, encodeHtmlEntities } from "@/tools/lib/dev";

type Mode = "encode" | "decode";

export default function HtmlEntityEncoder() {
  const { track } = useTool();
  const [mode, setMode] = useState<Mode>("encode");
  const [input, setInput] = useState("");
  const [encodeNonAscii, setEncodeNonAscii] = useState(false);
  const source = useDeferredValue(input);

  const output = useMemo(() => {
    if (!source) return "";
    return mode === "encode" ? encodeHtmlEntities(source, encodeNonAscii) : decodeHtmlEntities(source);
  }, [source, mode, encodeNonAscii]);

  useEffect(() => {
    if (output) track();
  }, [output, track]);

  function swap() {
    setMode(mode === "encode" ? "decode" : "encode");
    setInput(output);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Segmented
          label="Mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "encode", label: "Encode" },
            { value: "decode", label: "Decode" },
          ]}
        />
        {mode === "encode" ? (
          <Checkbox
            label={"Also encode non-ASCII characters (é → &#233;)"}
            checked={encodeNonAscii}
            onChange={(e) => setEncodeNonAscii(e.target.checked)}
          />
        ) : null}
      </div>
      <p className="text-sm text-muted">
        {mode === "encode"
          ? "Escapes & < > \" and ' so the text displays literally inside HTML."
          : "Converts named (&copy;), decimal (&#169;) and hexadecimal (&#xA9;) entities back to characters. Tags are left as text."}
      </p>

      <TextInput
        value={input}
        onChange={setInput}
        label={mode === "encode" ? "Text or HTML to encode" : "Text with HTML entities"}
        placeholder={mode === "encode" ? '<a href="/">Tom & Jerry’s</a>' : "&lt;p&gt;Caf&eacute; &amp; cr&#232;me&lt;/p&gt;"}
        rows={8}
        mono
        actions={
          <Button size="sm" variant="ghost" onClick={swap} disabled={!output}>
            <ArrowUpDown aria-hidden />
            Swap
          </Button>
        }
      />

      <OutputBox
        value={output}
        label={mode === "encode" ? "Encoded HTML" : "Decoded text"}
        filename={mode === "encode" ? "encoded.html" : "decoded.txt"}
        mono
        rows={8}
      />
    </div>
  );
}
