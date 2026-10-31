"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Pause, Play, Square } from "lucide-react";
import { ErrorText, Panel, RangeField, TextInput } from "@/components/tool-ui";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { chunkForSpeech, type TextChunk } from "@/tools/lib/text";
import { useTool } from "@/tools/context";

type Status = "idle" | "speaking" | "paused";

interface Progress {
  /** The part currently being spoken (a sentence or group of sentences). */
  chunkStart: number;
  chunkEnd: number;
  /** The current word, when the browser reports word boundaries. */
  wordStart: number | null;
  wordEnd: number | null;
}

/* ───────────── Browser speech support and voice list (an external store) ───────────── */

const NO_VOICES: SpeechSynthesisVoice[] = [];
let rawVoices: SpeechSynthesisVoice[] = NO_VOICES;
let sortedVoices: SpeechSynthesisVoice[] = NO_VOICES;

function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function subscribeNothing(): () => void {
  return () => {};
}

/** Voices load asynchronously in most browsers and arrive with a "voiceschanged" event. */
function subscribeVoices(onChange: () => void): () => void {
  if (!speechSupported()) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", onChange);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", onChange);
}

/** Returns the same array until the list really changes, as useSyncExternalStore requires. */
function getVoices(): SpeechSynthesisVoice[] {
  if (!speechSupported()) return NO_VOICES;
  const next = window.speechSynthesis.getVoices();
  const unchanged = next.length === rawVoices.length && next.every((v, i) => v.voiceURI === rawVoices[i].voiceURI);
  if (!unchanged) {
    rawVoices = next;
    sortedVoices = [...next].sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
  }
  return sortedVoices;
}

function getNoVoices(): SpeechSynthesisVoice[] {
  return NO_VOICES;
}

function languageName(lang: string, names: Intl.DisplayNames | null): string {
  if (!lang) return "Other";
  try {
    return names?.of(lang) ?? lang;
  } catch {
    // Some engines report tags DisplayNames rejects (e.g. "en_US"); show them as they are.
    return lang;
  }
}

function groupVoices(voices: SpeechSynthesisVoice[]): Array<{ label: string; voices: SpeechSynthesisVoice[] }> {
  const names = "DisplayNames" in Intl ? new Intl.DisplayNames(undefined, { type: "language" }) : null;
  const groups = new Map<string, SpeechSynthesisVoice[]>();
  for (const voice of voices) {
    const label = languageName(voice.lang, names);
    const list = groups.get(label);
    if (list) list.push(voice);
    else groups.set(label, [voice]);
  }
  return Array.from(groups, ([label, list]) => ({ label, voices: list })).sort((a, b) => a.label.localeCompare(b.label));
}

/* ───────────── Helpers ───────────── */

/** Length of the word starting at `index`, for browsers that do not report charLength. */
function wordLengthAt(text: string, index: number): number {
  return /^[\p{L}\p{N}'’-]+/u.exec(text.slice(index))?.[0].length ?? 1;
}

function speechErrorMessage(error: SpeechSynthesisErrorCode): string {
  switch (error) {
    case "not-allowed":
      return "Your browser blocked speech playback. Press Play again to allow it.";
    case "voice-unavailable":
    case "language-unavailable":
    case "synthesis-unavailable":
      return "The selected voice is not available right now. Choose another voice and try again.";
    case "text-too-long":
      return "This text is too long for your browser's speech engine. Try a shorter text.";
    default:
      return "Speech stopped unexpectedly. Please try again.";
  }
}

const formatTimes = (v: number) => `${v.toFixed(1)}×`;
const formatPercent = (v: number) => `${Math.round(v * 100)}%`;

/* ───────────── Component ───────────── */

export default function TextToSpeech() {
  const { track } = useTool();
  const voiceId = useId();
  const supported = useSyncExternalStore(subscribeNothing, speechSupported, () => false);
  const voices = useSyncExternalStore(subscribeVoices, getVoices, getNoVoices);

  const [text, setText] = useState("");
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [status, setStatus] = useState<Status>("idle");
  const [spokenText, setSpokenText] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState("");

  /** Increases on every Play/Stop so events from cancelled utterances are ignored. */
  const sessionRef = useRef(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLElement>(null);

  const chunks = useMemo(() => chunkForSpeech(text), [text]);
  const groups = useMemo(() => groupVoices(voices), [voices]);
  const voice = voices.find((v) => v.voiceURI === voiceURI) ?? null;

  // Stop speaking when the visitor leaves the tool.
  useEffect(() => {
    return () => {
      if (speechSupported()) window.speechSynthesis.cancel();
    };
  }, []);

  // Keep the word being read visible inside the scrolling preview.
  useEffect(() => {
    const box = boxRef.current;
    const mark = markRef.current;
    if (!box || !mark) return;
    const top = mark.offsetTop;
    if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - mark.offsetHeight) {
      box.scrollTop = Math.max(0, top - box.clientHeight / 3);
    }
  }, [progress]);

  function finish() {
    setStatus("idle");
    setProgress(null);
  }

  function speakChunk(chunk: TextChunk, isLast: boolean, session: number) {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(chunk.text);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    const current = () => sessionRef.current === session;
    const chunkEnd = chunk.start + chunk.text.length;

    utterance.onstart = () => {
      if (current()) setProgress({ chunkStart: chunk.start, chunkEnd, wordStart: null, wordEnd: null });
    };
    utterance.onboundary = (event) => {
      if (!current() || (event.name && event.name !== "word")) return;
      const start = chunk.start + event.charIndex;
      const length = event.charLength || wordLengthAt(chunk.text, event.charIndex);
      setProgress({ chunkStart: chunk.start, chunkEnd, wordStart: start, wordEnd: start + length });
    };
    utterance.onend = () => {
      if (current() && isLast) finish();
    };
    utterance.onerror = (event) => {
      if (!current() || event.error === "interrupted" || event.error === "canceled") return;
      sessionRef.current++;
      synth.cancel();
      setError(speechErrorMessage(event.error));
      finish();
    };
    synth.speak(utterance);
  }

  function play() {
    if (!chunks.length) return;
    const synth = window.speechSynthesis;
    const session = ++sessionRef.current;
    synth.cancel();
    // Long texts are queued as separate utterances: browsers cut off or stall on very long ones.
    chunks.forEach((chunk, i) => speakChunk(chunk, i === chunks.length - 1, session));
    // Some browsers keep a paused state across cancel(); make sure the queue actually plays.
    synth.resume();
    setSpokenText(text);
    setError("");
    setStatus("speaking");
    setProgress({ chunkStart: chunks[0].start, chunkEnd: chunks[0].start + chunks[0].text.length, wordStart: null, wordEnd: null });
    track();
  }

  function togglePause() {
    const synth = window.speechSynthesis;
    if (status === "speaking") {
      synth.pause();
      setStatus("paused");
    } else if (status === "paused") {
      synth.resume();
      setStatus("speaking");
    }
  }

  function stop() {
    sessionRef.current++;
    window.speechSynthesis.cancel();
    finish();
  }

  if (!supported) {
    return (
      <Alert tone="warning" title="Your browser does not support text to speech.">
        Open this page in a recent version of Chrome, Edge, Safari or Firefox to have your text read aloud.
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <TextInput value={text} onChange={setText} label="Text to read aloud" placeholder="Type or paste the text you want to hear…" rows={10} />

      {chunks.length > 1 ? (
        <Alert tone="info">
          This text has {text.length.toLocaleString()} characters. It will be read in {chunks.length} parts so your browser
          does not cut it off.
        </Alert>
      ) : null}

      <Panel title="Voice and speed">
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Voice"
            htmlFor={voiceId}
            hint={voices.length ? `${voices.length} voices available on this device.` : "Loading the voices installed on this device…"}
            className="md:col-span-2"
          >
            <Select id={voiceId} value={voiceURI} onChange={(e) => setVoiceURI(e.target.value)}>
              <option value="">Browser default</option>
              {groups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name}
                      {v.localService ? "" : " (online)"}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <RangeField label="Speed" value={rate} min={0.5} max={2} step={0.1} onChange={setRate} format={formatTimes} />
          <RangeField label="Pitch" value={pitch} min={0} max={2} step={0.1} onChange={setPitch} format={formatTimes} />
          <RangeField label="Volume" value={volume} min={0} max={1} step={0.05} onChange={setVolume} format={formatPercent} />
        </div>
        {status !== "idle" ? <p className="mt-3 text-xs text-muted">New settings apply the next time you press Play.</p> : null}
      </Panel>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={play} disabled={!chunks.length}>
          <Play aria-hidden />
          {status === "idle" ? "Play" : "Play from start"}
        </Button>
        <Button variant="outline" onClick={togglePause} disabled={status === "idle"}>
          {status === "paused" ? <Play aria-hidden /> : <Pause aria-hidden />}
          {status === "paused" ? "Resume" : "Pause"}
        </Button>
        <Button variant="outline" onClick={stop} disabled={status === "idle"}>
          <Square aria-hidden />
          Stop
        </Button>
        <span className="text-sm text-muted" role="status">
          {status === "speaking" ? "Reading…" : status === "paused" ? "Paused" : ""}
        </span>
      </div>

      <ErrorText>{error}</ErrorText>

      {progress ? (
        <Panel title="Now reading">
          <div
            ref={boxRef}
            className="relative max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-paper px-3 py-2.5 text-sm leading-relaxed text-muted"
          >
            {spokenText.slice(0, progress.chunkStart)}
            <span className="rounded bg-primary-soft text-ink">
              {progress.wordStart === null || progress.wordEnd === null ? (
                <span ref={markRef}>{spokenText.slice(progress.chunkStart, progress.chunkEnd)}</span>
              ) : (
                <>
                  {spokenText.slice(progress.chunkStart, progress.wordStart)}
                  <mark ref={markRef} className="rounded bg-marker text-black">
                    {spokenText.slice(progress.wordStart, progress.wordEnd)}
                  </mark>
                  {spokenText.slice(progress.wordEnd, progress.chunkEnd)}
                </>
              )}
            </span>
            {spokenText.slice(progress.chunkEnd)}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
