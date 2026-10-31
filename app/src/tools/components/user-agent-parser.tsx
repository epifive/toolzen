"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, TextInput } from "@/components/tool-ui";
import { useTool } from "@/tools/context";
import { ValueList, ValueRow } from "@/tools/lib/dev-ui";
import { DEVICE_LABELS, parseUserAgent, type NameVersion, type UserAgentInfo } from "@/tools/lib/user-agent";

/* User-Agent Client Hints are not in TypeScript's DOM library yet. */
interface UaBrand {
  brand: string;
  version: string;
}

interface UaHints {
  brands: UaBrand[];
  mobile: boolean;
  platform: string;
  platformVersion?: string;
  architecture?: string;
  bitness?: string;
  model?: string;
}

interface NavigatorUaData {
  brands: UaBrand[];
  mobile: boolean;
  platform: string;
  getHighEntropyValues(hints: string[]): Promise<Partial<UaHints> & { fullVersionList?: UaBrand[] }>;
}

type ExtendedNavigator = Navigator & {
  userAgentData?: NavigatorUaData;
  brave?: { isBrave(): Promise<boolean> };
};

const SAMPLES: Array<{ label: string; ua: string }> = [
  {
    label: "iPhone Safari",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
  },
  {
    label: "Android Chrome",
    ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.81 Mobile Safari/537.36",
  },
  {
    label: "Windows Edge",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.2792.79",
  },
  {
    label: "Googlebot",
    ua: "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.70 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  },
];

const HIGH_ENTROPY_HINTS = ["platformVersion", "architecture", "bitness", "model", "fullVersionList"];

const label = (part: NameVersion) => (part.name ? `${part.name}${part.version ? ` ${part.version}` : ""}` : "");

/** Real brands only: browsers add a deliberately fake "Not A Brand" entry. */
const realBrands = (brands: UaBrand[]) => brands.filter((b) => !/not.?a.?brand/i.test(b.brand));

/** Client Hints report the real Windows and macOS versions that the user agent string hides. */
function osFromHints(hints: UaHints | null): string {
  if (!hints?.platformVersion) return "";
  const major = Number(hints.platformVersion.split(".")[0]);
  if (hints.platform === "Windows") return major >= 13 ? "Windows 11" : major > 0 ? "Windows 10" : "";
  if (hints.platform === "macOS") return `macOS ${hints.platformVersion.replace(/\.0$/, "")}`;
  if (hints.platform === "Android") return `Android ${hints.platformVersion}`;
  return "";
}

function UaDetails({ info, browserOverride, osOverride, modelOverride }: { info: UserAgentInfo; browserOverride?: string; osOverride?: string; modelOverride?: string }) {
  const device = [info.device.vendor, modelOverride || info.device.model].filter(Boolean).join(" ");
  return (
    <>
      {info.bot ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone="warning">Bot</Badge>
          <span className="text-sm text-ink">
            {info.bot.name}
            {info.bot.version ? ` ${info.bot.version}` : ""} — {info.bot.category}
          </span>
        </div>
      ) : null}
      <ValueList>
        <ValueRow label="Browser" value={browserOverride || label(info.browser)} mono={false} />
        <ValueRow label="Rendering engine" value={label(info.engine)} mono={false} />
        <ValueRow label="Operating system" value={osOverride || label(info.os)} mono={false} />
        <ValueRow label="Device type" value={DEVICE_LABELS[info.device.type]} mono={false} />
        <ValueRow label="Device" value={device} mono={false} />
      </ValueList>
      {info.notes.length ? (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted">
          {info.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

export default function UserAgentParser() {
  const { track } = useTool();
  const [ownUa] = useState(() => navigator.userAgent);
  const [hints, setHints] = useState<UaHints | null>(null);
  const [isBrave, setIsBrave] = useState(false);
  const [input, setInput] = useState("");
  const source = useDeferredValue(input);

  const own = useMemo(() => parseUserAgent(ownUa), [ownUa]);
  const parsed = useMemo(() => (source.trim() ? parseUserAgent(source) : null), [source]);

  useEffect(() => {
    const nav = navigator as ExtendedNavigator;
    let cancelled = false;
    const data = nav.userAgentData;
    if (data) {
      const basic: UaHints = { brands: data.brands, mobile: data.mobile, platform: data.platform };
      data
        .getHighEntropyValues(HIGH_ENTROPY_HINTS)
        .then((values) => {
          if (!cancelled) setHints({ ...basic, ...values, brands: values.fullVersionList ?? data.brands });
        })
        .catch(() => {
          if (!cancelled) setHints(basic);
        });
    }
    nav.brave
      ?.isBrave()
      .then((brave) => {
        if (!cancelled) setIsBrave(brave);
      })
      .catch(() => {
        if (!cancelled) setIsBrave(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The visitor's own user agent is the tool's first result.
  useEffect(() => {
    track();
  }, [track]);

  useEffect(() => {
    if (parsed) track();
  }, [parsed, track]);

  const brands = hints ? realBrands(hints.brands) : [];
  const ownBrowser = isBrave ? `Brave${own.browser.version ? ` (Chromium ${own.browser.version.split(".")[0]})` : ""}` : undefined;

  return (
    <div className="space-y-4">
      <Panel title="What is my user agent?">
        <p className="break-all rounded-lg border border-line bg-paper px-3 py-2.5 font-mono text-[13px] text-ink">{ownUa}</p>
        <div className="mt-4">
          <UaDetails info={own} browserOverride={ownBrowser} osOverride={osFromHints(hints)} modelOverride={hints?.model} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setInput(ownUa)}>
            Inspect it in the parser below
          </Button>
        </div>
      </Panel>

      {hints ? (
        <Panel title="Client Hints from your browser">
          <p className="mb-3 text-sm text-muted">
            Chromium-based browsers also send structured Client Hints, which reveal details the user agent string hides.
          </p>
          <ValueList>
            <ValueRow
              label="Brands"
              value={brands.map((b) => `${b.brand} ${b.version}`).join(", ")}
              mono={false}
              extra={isBrave ? <Badge tone="primary">Brave</Badge> : null}
            />
            <ValueRow label="Platform" value={[hints.platform, hints.platformVersion].filter(Boolean).join(" ")} mono={false} />
            <ValueRow label="Architecture" value={[hints.architecture, hints.bitness ? `${hints.bitness}-bit` : ""].filter(Boolean).join(", ")} mono={false} />
            <ValueRow label="Mobile" value={hints.mobile ? "Yes" : "No"} mono={false} />
            {hints.model ? <ValueRow label="Model" value={hints.model} mono={false} /> : null}
          </ValueList>
        </Panel>
      ) : null}

      <TextInput
        value={input}
        onChange={setInput}
        label="Parse a user agent"
        placeholder="Paste any user agent string, e.g. from your server logs."
        rows={4}
        mono
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Try:</span>
        {SAMPLES.map((sample) => (
          <Button key={sample.label} size="sm" variant="outline" onClick={() => setInput(sample.ua)}>
            {sample.label}
          </Button>
        ))}
      </div>

      {parsed ? (
        <Panel title="Parsed user agent">
          <UaDetails info={parsed} />
        </Panel>
      ) : null}

      <Alert tone="info">
        User agents are easy to change and modern browsers reduce them on purpose, so treat the result as a well-informed guess rather than proof.
      </Alert>
    </div>
  );
}
