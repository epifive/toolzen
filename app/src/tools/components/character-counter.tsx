"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Panel, Stat, StatGrid, TextInput } from "@/components/tool-ui";
import { cn } from "@/lib/utils";
import { useTool } from "@/tools/context";
import { graphemes } from "@/tools/lib/text";
import { utf8Length } from "@/tools/lib/dev";

/* ───────────────────────── X (Twitter) weighting ───────────────────────── */

/** Code point ranges X counts as one character; everything else (CJK, most symbols) counts as two. */
const LIGHT_RANGES: Array<[number, number]> = [
  [0, 4351],
  [8192, 8205],
  [8208, 8223],
  [8242, 8247],
];
const URL_LENGTH = 23;
const URL_PATTERN = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;
const EMOJI = /\p{Extended_Pictographic}/u;

function weightedPostLength(text: string): number {
  let length = 0;
  const withoutUrls = text.normalize("NFC").replace(URL_PATTERN, () => {
    length += URL_LENGTH;
    return "";
  });
  for (const cluster of graphemes(withoutUrls)) {
    if (EMOJI.test(cluster)) {
      length += 2;
      continue;
    }
    for (const char of cluster) {
      const code = char.codePointAt(0) ?? 0;
      length += LIGHT_RANGES.some(([from, to]) => code >= from && code <= to) ? 1 : 2;
    }
  }
  return length;
}

/* ───────────────────────── SMS ───────────────────────── */

const GSM_BASIC = new Set(
  Array.from("@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"),
);
/** GSM 03.38 extension table: each of these takes two septets. */
const GSM_EXTENDED = new Set(Array.from("^{}\\[~]|€\f"));

interface SmsInfo {
  unicode: boolean;
  units: number;
  segments: number;
  perSegment: number;
  remaining: number;
  /** Characters that forced Unicode (UCS-2) encoding. */
  unicodeChars: string[];
}

function smsInfo(text: string): SmsInfo {
  let septets = 0;
  const unicodeChars = new Set<string>();
  for (const char of text) {
    if (GSM_BASIC.has(char)) septets += 1;
    else if (GSM_EXTENDED.has(char)) septets += 2;
    else unicodeChars.add(char);
  }
  const unicode = unicodeChars.size > 0;
  // UCS-2 counts UTF-16 code units, so an emoji uses two of the 70.
  const units = unicode ? text.length : septets;
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  const segments = units === 0 ? 0 : units <= single ? 1 : Math.ceil(units / multi);
  const perSegment = segments > 1 ? multi : single;
  const capacity = segments > 1 ? segments * multi : single;
  return { unicode, units, segments, perSegment, remaining: capacity - units, unicodeChars: [...unicodeChars].slice(0, 12) };
}

/* ───────────────────────── UI ───────────────────────── */

interface Limit {
  label: string;
  limit: number;
  count: number;
  note?: string;
}

function LimitBar({ label, limit, count, note }: Limit) {
  const over = count > limit;
  const ratio = Math.min(1, count / limit);
  return (
    <li>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className={cn("tabular-nums", over ? "font-medium text-red-600 dark:text-red-400" : "text-muted")}>
          {count.toLocaleString()} / {limit.toLocaleString()} ·{" "}
          {over ? `${(count - limit).toLocaleString()} over` : `${(limit - count).toLocaleString()} left`}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(count, limit)}
        aria-valuetext={`${count} of ${limit} characters${over ? `, ${count - limit} over the limit` : ""}`}
        className="mt-1.5 h-2 overflow-hidden rounded-full bg-line"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] motion-reduce:transition-none",
            over ? "bg-red-500" : ratio >= 0.9 ? "bg-amber-500" : "bg-primary",
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
    </li>
  );
}

export default function CharacterCounter() {
  const { track } = useTool();
  const [text, setText] = useState("");
  const source = useDeferredValue(text);

  const stats = useMemo(() => {
    const characters = Array.from(source).length;
    return {
      characters,
      noSpaces: Array.from(source.replace(/\s/g, "")).length,
      words: source.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0,
      lines: source ? source.split(/\r\n|\r|\n/).length : 0,
      bytes: utf8Length(source),
      post: weightedPostLength(source),
      sms: smsInfo(source),
    };
  }, [source]);

  useEffect(() => {
    if (stats.characters > 0) track();
  }, [stats.characters, track]);

  const { sms } = stats;
  const limits: Limit[] = [
    { label: "X (Twitter) post", limit: 280, count: stats.post, note: "Counted like X: links count as 23, emoji and CJK characters as 2." },
    { label: "Meta title", limit: 60, count: stats.characters, note: "Google usually shows about 50–60 characters." },
    { label: "Meta description", limit: 160, count: stats.characters, note: "Aim for 120–160 characters." },
    { label: "YouTube title", limit: 100, count: stats.characters },
    { label: "Instagram caption", limit: 2200, count: stats.characters },
  ];

  return (
    <div className="space-y-4">
      <TextInput value={text} onChange={setText} label="Your text" placeholder="Start typing or paste your text here…" rows={8} />

      <StatGrid>
        <Stat label="Characters" value={stats.characters.toLocaleString()} emphasis />
        <Stat label="Without spaces" value={stats.noSpaces.toLocaleString()} emphasis />
        <Stat label="Words" value={stats.words.toLocaleString()} />
        <Stat label="Lines" value={stats.lines.toLocaleString()} />
        <Stat label="Bytes (UTF-8)" value={stats.bytes.toLocaleString()} />
        <Stat label="SMS segments" value={sms.segments.toLocaleString()} />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Character limits">
          <ul className="space-y-4">
            {limits.map((limit) => (
              <LimitBar key={limit.label} {...limit} />
            ))}
          </ul>
        </Panel>

        <Panel title="SMS">
          <ul className="space-y-4">
            <LimitBar
              label={sms.segments > 1 ? `SMS, ${sms.segments} parts` : "SMS"}
              limit={sms.segments > 1 ? sms.segments * sms.perSegment : sms.perSegment}
              count={sms.units}
              note={
                sms.unicode
                  ? "Unicode (UCS-2) encoding: 70 characters for one message, 67 per part when split. Emoji count as 2."
                  : "GSM-7 encoding: 160 characters for one message, 153 per part when split. Characters like € [ ] { } count as 2."
              }
            />
          </ul>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">Encoding</dt>
            <dd className="font-medium text-ink">{sms.unicode ? "Unicode (UCS-2)" : "GSM-7"}</dd>
            <dt className="text-muted">Messages</dt>
            <dd className="font-medium tabular-nums text-ink">{sms.segments}</dd>
            <dt className="text-muted">Left in this message</dt>
            <dd className="font-medium tabular-nums text-ink">{sms.units ? sms.remaining : sms.perSegment}</dd>
          </dl>
          {sms.unicodeChars.length ? (
            <p className="mt-3 text-xs text-muted">
              These characters switch the message to Unicode:{" "}
              <span className="font-mono text-ink">{sms.unicodeChars.map((c) => (/\s/.test(c) ? "␣" : c)).join(" ")}</span>. Replace
              them to fit up to 160 characters in one SMS.
            </p>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
