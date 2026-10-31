"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Checkbox, Hint, Input, Label, Switch } from "@/components/ui/field";
import { ErrorText, FileDropzone, FileRow, Panel, Segmented, Spinner, TextInput } from "@/components/tool-ui";
import { useTool } from "@/tools/context";
import { bytesToHex, errorMessage, normalizeHash } from "@/tools/lib/dev";
import { useDebouncedValue, ValueList, ValueRow } from "@/tools/lib/dev-ui";

type Source = "text" | "file";
type Algorithm = "MD5" | "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

const ALGORITHMS: Algorithm[] = ["MD5", "SHA-1", "SHA-256", "SHA-384", "SHA-512"];
const SHA_ALGORITHMS = ALGORITHMS.filter((a) => a !== "MD5");

type Hashes = Partial<Record<Algorithm, string>>;

interface Computed {
  key: string;
  hashes: Hashes;
  error?: string;
}

interface SelectedFile {
  file: File;
  id: number;
}

async function computeHashes(
  data: Uint8Array<ArrayBuffer>,
  secret: Uint8Array<ArrayBuffer> | null,
): Promise<{ hashes: Hashes; error?: string }> {
  const { md5 } = await import("js-md5");
  const hashes: Hashes = { MD5: secret ? md5.hmac.hex(secret, data) : md5.hex(data) };
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return { hashes, error: "SHA hashes need a secure (HTTPS) connection, which this page is not using." };
  }
  for (const algorithm of SHA_ALGORITHMS) {
    if (secret) {
      const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: algorithm }, false, ["sign"]);
      hashes[algorithm] = bytesToHex(await crypto.subtle.sign("HMAC", key, data));
    } else {
      hashes[algorithm] = bytesToHex(await crypto.subtle.digest(algorithm, data));
    }
  }
  return { hashes };
}

export default function HashGenerator() {
  const { track } = useTool();
  const secretId = useId();
  const expectedId = useId();
  const [source, setSource] = useState<Source>("text");
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<SelectedFile | null>(null);
  const [hmac, setHmac] = useState(false);
  const [secret, setSecret] = useState("");
  const [uppercase, setUppercase] = useState(false);
  const [expected, setExpected] = useState("");
  const [computed, setComputed] = useState<Computed | null>(null);

  const debouncedText = useDebouncedValue(text, 200);
  const debouncedSecret = useDebouncedValue(secret, 200);
  const useSecret = hmac && debouncedSecret !== "";
  const hasInput = source === "text" ? debouncedText !== "" : selected !== null;

  /** Identifies the current input so stale async results are never shown. */
  const requestKey = useMemo(
    () =>
      JSON.stringify([
        source,
        source === "text" ? debouncedText : selected?.id,
        useSecret ? debouncedSecret : null,
      ]),
    [source, debouncedText, selected, useSecret, debouncedSecret],
  );

  useEffect(() => {
    if (!hasInput) return;
    let cancelled = false;
    (async () => {
      let result: Computed;
      try {
        const data =
          source === "text" ? new TextEncoder().encode(debouncedText) : new Uint8Array(await selected!.file.arrayBuffer());
        const key = useSecret ? new TextEncoder().encode(debouncedSecret) : null;
        result = { key: requestKey, ...(await computeHashes(data, key)) };
      } catch (e) {
        result = { key: requestKey, hashes: {}, error: errorMessage(e, "The hashes could not be calculated.") };
      }
      if (!cancelled) {
        setComputed(result);
        if (Object.keys(result.hashes).length) track();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestKey, hasInput, source, debouncedText, selected, useSecret, debouncedSecret, track]);

  const current = hasInput && computed?.key === requestKey ? computed : null;
  const pending = hasInput && !current;
  const display = (hash: string) => (uppercase ? hash.toUpperCase() : hash);

  const comparison = useMemo(() => {
    const wanted = normalizeHash(expected);
    if (!wanted || !current) return null;
    const match = ALGORITHMS.find((a) => current.hashes[a] === wanted);
    return match ?? false;
  }, [expected, current]);

  return (
    <div className="space-y-4">
      <Segmented
        label="Input type"
        value={source}
        onChange={setSource}
        options={[
          { value: "text", label: "Text" },
          { value: "file", label: "File" },
        ]}
      />

      {source === "text" ? (
        <TextInput value={text} onChange={setText} label="Text to hash" placeholder="Type or paste text…" rows={6} />
      ) : selected ? (
        <ul>
          <FileRow name={selected.file.name} size={selected.file.size} onRemove={() => setSelected(null)} />
        </ul>
      ) : (
        <FileDropzone accept="" onFiles={(files) => setSelected({ file: files[0], id: Date.now() })} label="Drop a file to hash it" />
      )}

      <Panel title="Options">
        <div className="space-y-4">
          <Checkbox label="Uppercase hex" checked={uppercase} onChange={(e) => setUppercase(e.target.checked)} />
          <Switch
            label="HMAC mode"
            description="Sign the input with a secret key instead of hashing it on its own."
            checked={hmac}
            onChange={(e) => setHmac(e.target.checked)}
          />
          {hmac ? (
            <div>
              <Label htmlFor={secretId}>Secret key</Label>
              <Input
                id={secretId}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Your secret key"
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
              />
              <Hint>{secret ? "The key is used as UTF-8 text." : "Enter a key to calculate HMAC values."}</Hint>
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel
        title={useSecret ? "HMAC values" : "Hashes"}
        actions={pending ? <Spinner className="text-muted" /> : null}
      >
        {current ? (
          <>
            <ValueList>
              {ALGORITHMS.filter((a) => current.hashes[a]).map((a) => (
                <ValueRow key={a} label={useSecret ? `HMAC-${a}` : a} value={display(current.hashes[a]!)} />
              ))}
            </ValueList>
            {current.error ? (
              <div className="mt-3">
                <ErrorText>{current.error}</ErrorText>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted">
            {pending ? "Calculating…" : source === "text" ? "Type some text to see its hashes." : "Choose a file to see its hashes."}
          </p>
        )}
      </Panel>

      <Panel title="Compare">
        <Label htmlFor={expectedId}>Expected hash</Label>
        <Input
          id={expectedId}
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
          placeholder="Paste a checksum to verify it"
          spellCheck={false}
          className="font-mono"
        />
        {comparison !== null ? (
          <Alert tone={comparison ? "success" : "error"} className="mt-3">
            {comparison ? `Match: this is the ${useSecret ? `HMAC-${comparison}` : comparison} value.` : "No match with any of the values above."}
          </Alert>
        ) : null}
      </Panel>
    </div>
  );
}
