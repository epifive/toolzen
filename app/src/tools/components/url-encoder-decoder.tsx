"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label } from "@/components/ui/field";
import { CopyButton, ErrorText, OutputBox, Panel, Segmented, TextInput } from "@/components/tool-ui";
import { useTool } from "@/tools/context";
import { describePercentError } from "@/tools/lib/dev";
import { ValueList, ValueRow } from "@/tools/lib/dev-ui";

type Mode = "component" | "uri" | "decode";

type Result = { ok: true; value: string } | { ok: false; error: string };

function convert(text: string, mode: Mode, plusAsSpace: boolean): Result {
  try {
    if (mode === "component") return { ok: true, value: encodeURIComponent(text) };
    if (mode === "uri") return { ok: true, value: encodeURI(text) };
    return { ok: true, value: decodeURIComponent(plusAsSpace ? text.replace(/\+/g, " ") : text) };
  } catch {
    if (mode === "decode") return { ok: false, error: describePercentError(text) };
    return { ok: false, error: "The text contains an unpaired surrogate character that cannot be encoded." };
  }
}

type Parsed = { ok: true; url: URL; assumedScheme: boolean } | { ok: false };

function parseUrl(value: string): Parsed | null {
  const text = value.trim();
  if (!text) return null;
  try {
    return { ok: true, url: new URL(text), assumedScheme: false };
  } catch {
    try {
      // Allow "example.com/path?x=1" by assuming https://.
      if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) return { ok: true, url: new URL(`https://${text}`), assumedScheme: true };
    } catch {
      // Fall through to the error below.
    }
    return { ok: false };
  }
}

function UrlParser() {
  const id = useId();
  const [value, setValue] = useState("");
  const parsed = useMemo(() => parseUrl(value), [value]);
  const params = parsed?.ok ? Array.from(parsed.url.searchParams.entries()) : [];

  return (
    <Panel title="URL parser">
      <Label htmlFor={id}>URL to inspect</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={"https://user@example.com:8080/path/page?q=caf%C3%A9&lang=en#top"}
        spellCheck={false}
        className="font-mono"
      />

      {parsed && !parsed.ok ? (
        <div className="mt-3">
          <ErrorText>This is not a valid URL.</ErrorText>
        </div>
      ) : null}

      {parsed?.ok ? (
        <div className="mt-4 space-y-4">
          {parsed.assumedScheme ? (
            <Alert tone="info">No scheme was given, so https:// was assumed.</Alert>
          ) : null}
          <ValueList>
            <ValueRow label="Protocol" value={parsed.url.protocol} />
            {parsed.url.username ? <ValueRow label="Username" value={decodeURIComponentSafe(parsed.url.username)} /> : null}
            {parsed.url.password ? <ValueRow label="Password" value={decodeURIComponentSafe(parsed.url.password)} /> : null}
            <ValueRow label="Host" value={parsed.url.hostname} />
            <ValueRow label="Port" value={parsed.url.port || "(default)"} copyValue={parsed.url.port} />
            <ValueRow label="Origin" value={parsed.url.origin === "null" ? "" : parsed.url.origin} />
            <ValueRow label="Path" value={decodeURIComponentSafe(parsed.url.pathname)} copyValue={parsed.url.pathname} />
            <ValueRow label="Query string" value={parsed.url.search} />
            <ValueRow label="Fragment" value={decodeURIComponentSafe(parsed.url.hash)} copyValue={parsed.url.hash} />
          </ValueList>

          {params.length ? (
            <div>
              <h3 className="mb-2 font-sans text-sm font-semibold tracking-normal text-ink">
                Query parameters ({params.length})
              </h3>
              <div className="overflow-x-auto rounded-lg border border-line" tabIndex={0} role="region" aria-label="Query parameters">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-paper text-xs text-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Name
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Value (decoded)
                      </th>
                      <th scope="col" className="px-3 py-2">
                        <span className="sr-only">Copy</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {params.map(([name, val], i) => (
                      <tr key={`${name}-${i}`} className="border-t border-line">
                        <td className="px-3 py-2 align-top font-mono text-[13px] break-all text-ink">{name}</td>
                        <td className="px-3 py-2 align-top font-mono text-[13px] break-all text-ink">
                          {val || <span className="text-muted">(empty)</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <CopyButton text={val} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function UrlEncoderDecoder() {
  const { track } = useTool();
  const [mode, setMode] = useState<Mode>("component");
  const [input, setInput] = useState("");
  const [plusAsSpace, setPlusAsSpace] = useState(true);

  const result = useMemo(() => (input ? convert(input, mode, plusAsSpace) : null), [input, mode, plusAsSpace]);
  const output = result?.ok ? result.value : "";

  useEffect(() => {
    if (output) track();
  }, [output, track]);

  function swap() {
    setMode(mode === "decode" ? "component" : "decode");
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
            { value: "component", label: "Encode component" },
            { value: "uri", label: "Encode full URL" },
            { value: "decode", label: "Decode" },
          ]}
        />
        {mode === "decode" ? (
          <Checkbox label="Treat + as a space (form data)" checked={plusAsSpace} onChange={(e) => setPlusAsSpace(e.target.checked)} />
        ) : null}
      </div>
      <p className="text-sm text-muted">
        {mode === "component"
          ? "Encodes every reserved character, including : / ? & = #. Use it for query values and path segments."
          : mode === "uri"
            ? "Keeps the characters that give a URL its structure (: / ? & = #) and encodes spaces, accents and other unsafe characters."
            : "Converts %XX sequences back into readable text."}
      </p>

      <TextInput
        value={input}
        onChange={setInput}
        label={mode === "decode" ? "Encoded text" : "Text or URL"}
        placeholder={mode === "decode" ? "caf%C3%A9%20au%20lait%3F" : "café au lait?"}
        rows={6}
        mono
        actions={
          <Button size="sm" variant="ghost" onClick={swap} disabled={!output}>
            <ArrowUpDown aria-hidden />
            Swap
          </Button>
        }
      />

      {result && !result.ok ? <ErrorText>{result.error}</ErrorText> : null}

      <OutputBox value={output} label={mode === "decode" ? "Decoded text" : "Encoded text"} mono rows={6} />

      <UrlParser />
    </div>
  );
}
