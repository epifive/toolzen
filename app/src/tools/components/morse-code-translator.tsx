"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, Play, Square } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ErrorText, OutputBox, Panel, RangeField, Segmented, TextInput, ToolColumns } from "@/components/tool-ui";
import { useTool } from "@/tools/context";
import { MORSE_TABLE, morseTimeline, morseToText, normalizeMorse, textToMorse } from "@/tools/lib/morse";

type Mode = "encode" | "decode";

const VOLUME = 0.25;
/** Short fade in and out of each tone, so the audio has no clicks. */
const RAMP = 0.005;

interface Playback {
  ctx: AudioContext | null;
  timeout?: ReturnType<typeof setTimeout>;
}

type AudioContextConstructor = typeof AudioContext;

function getAudioContext(): AudioContextConstructor | undefined {
  if (typeof AudioContext !== "undefined") return AudioContext;
  // Older Safari versions only expose the prefixed constructor.
  return (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
}

export default function MorseCodeTranslator() {
  const { track } = useTool();
  const [mode, setMode] = useState<Mode>("encode");
  const [input, setInput] = useState("");
  const [wpm, setWpm] = useState(20);
  const [frequency, setFrequency] = useState(600);
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState("");
  const playback = useRef<Playback>({ ctx: null });
  const source = useDeferredValue(input);

  const result = useMemo(() => (mode === "encode" ? textToMorse(source) : morseToText(source)), [source, mode]);
  const morse = mode === "encode" ? result.output : normalizeMorse(source);

  useEffect(() => {
    if (result.output) track();
  }, [result.output, track]);

  useEffect(() => {
    const state = playback.current;
    return () => {
      clearTimeout(state.timeout);
      void state.ctx?.close();
    };
  }, []);

  function stop() {
    const state = playback.current;
    clearTimeout(state.timeout);
    void state.ctx?.close();
    state.ctx = null;
    setPlaying(false);
  }

  function play() {
    stop();
    setAudioError("");
    const { tones, total } = morseTimeline(morse, wpm);
    if (!tones.length) return;
    const AudioCtx = getAudioContext();
    if (!AudioCtx) {
      setAudioError("Your browser cannot play audio. Try a recent version of Chrome, Edge, Firefox or Safari.");
      return;
    }
    try {
      const ctx = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.value = 0;
      oscillator.connect(gain).connect(ctx.destination);

      const start = ctx.currentTime + 0.05;
      for (const tone of tones) {
        const on = start + tone.start;
        const off = on + tone.duration;
        gain.gain.setValueAtTime(0, on);
        gain.gain.linearRampToValueAtTime(VOLUME, on + RAMP);
        gain.gain.setValueAtTime(VOLUME, off - RAMP);
        gain.gain.linearRampToValueAtTime(0, off);
      }
      oscillator.start(start);
      oscillator.stop(start + total + 0.05);

      playback.current.ctx = ctx;
      playback.current.timeout = setTimeout(stop, (total + 0.3) * 1000);
      setPlaying(true);
    } catch {
      setAudioError("The audio could not be started. Check that sound is allowed for this site.");
    }
  }

  function swap() {
    stop();
    setMode(mode === "encode" ? "decode" : "encode");
    setInput(result.output);
  }

  return (
    <div className="space-y-4">
      <Segmented
        label="Direction"
        value={mode}
        onChange={(value) => {
          stop();
          setMode(value);
        }}
        options={[
          { value: "encode", label: "Text → Morse" },
          { value: "decode", label: "Morse → Text" },
        ]}
      />

      <ToolColumns>
        <TextInput
          value={input}
          onChange={setInput}
          label={mode === "encode" ? "Text" : "Morse code"}
          placeholder={mode === "encode" ? "Type a message, e.g. SOS" : "... --- ... / .... ..   (use / between words)"}
          rows={8}
          mono={mode === "decode"}
          actions={
            <Button size="sm" variant="ghost" onClick={swap} disabled={!result.output}>
              <ArrowUpDown aria-hidden />
              Swap
            </Button>
          }
        />
        <OutputBox
          value={result.output}
          label={mode === "encode" ? "Morse code" : "Text"}
          filename={mode === "encode" ? "morse-code.txt" : "decoded-morse.txt"}
          mono={mode === "encode"}
          rows={8}
        />
      </ToolColumns>

      {result.unknown.length ? (
        <Alert tone="warning" title={mode === "encode" ? "Some characters have no Morse code" : "Some codes were not recognised"}>
          <span className="font-mono">{result.unknown.slice(0, 20).join("  ")}</span> {mode === "encode" ? "were left out." : "were skipped."}
        </Alert>
      ) : null}

      <Panel
        title="Listen"
        actions={
          playing ? (
            <Button size="sm" variant="outline" onClick={stop}>
              <Square aria-hidden />
              Stop
            </Button>
          ) : (
            <Button size="sm" onClick={play} disabled={!/[.-]/.test(morse)}>
              <Play aria-hidden />
              Play sound
            </Button>
          )
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <RangeField label="Speed" value={wpm} min={5} max={40} onChange={setWpm} format={(v) => `${v} WPM`} />
          <RangeField label="Tone" value={frequency} min={300} max={1200} step={10} onChange={setFrequency} format={(v) => `${v} Hz`} />
        </div>
        <p className="mt-3 text-xs text-muted">Changes to speed and tone apply the next time you press Play.</p>
        {audioError ? (
          <div className="mt-3">
            <ErrorText>{audioError}</ErrorText>
          </div>
        ) : null}
      </Panel>

      <details className="group rounded-xl border border-line bg-surface">
        <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold text-ink">Morse code chart</summary>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line p-4 font-mono text-sm sm:grid-cols-4 lg:grid-cols-6">
          {MORSE_TABLE.map(([char, code]) => (
            <li key={char} className="flex justify-between gap-2">
              <span className="font-semibold text-ink">{char}</span>
              <span className="text-muted">{code}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
