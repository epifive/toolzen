"use client";

import { useEffect, useState } from "react";
import { CopyButton, Panel, Stat, StatGrid } from "@/components/tool-ui";
import { useTool } from "@/tools/context";

interface ScreenInfo {
  screenWidth: number;
  screenHeight: number;
  availWidth: number;
  availHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  /** Viewport without the vertical scrollbar. */
  layoutWidth: number;
  pixelRatio: number;
  colorDepth: number;
  orientation: string;
  touchPoints: number;
  pointer: string;
  hover: boolean;
  colorScheme: "dark" | "light";
  reducedMotion: boolean;
  gamut: string;
  hdr: boolean;
}

/** Media queries whose result can change while the page is open. */
const WATCHED_QUERIES = [
  "(prefers-color-scheme: dark)",
  "(prefers-reduced-motion: reduce)",
  "(pointer: coarse)",
  "(hover: hover)",
  "(dynamic-range: high)",
  "(color-gamut: p3)",
];

const matches = (query: string) => window.matchMedia(query).matches;

function readScreen(): ScreenInfo {
  const { screen } = window;
  const orientation = screen.orientation?.type ?? (screen.width >= screen.height ? "landscape-primary" : "portrait-primary");
  return {
    screenWidth: screen.width,
    screenHeight: screen.height,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    layoutWidth: document.documentElement.clientWidth,
    pixelRatio: window.devicePixelRatio || 1,
    colorDepth: screen.colorDepth,
    orientation: orientation.startsWith("portrait") ? "Portrait" : "Landscape",
    touchPoints: navigator.maxTouchPoints ?? 0,
    pointer: matches("(pointer: coarse)") ? "Coarse (touch)" : matches("(pointer: fine)") ? "Fine (mouse or trackpad)" : "None",
    hover: matches("(hover: hover)"),
    colorScheme: matches("(prefers-color-scheme: dark)") ? "dark" : "light",
    reducedMotion: matches("(prefers-reduced-motion: reduce)"),
    gamut: matches("(color-gamut: rec2020)") ? "Rec. 2020" : matches("(color-gamut: p3)") ? "Display P3" : "sRGB",
    hdr: matches("(dynamic-range: high)"),
  };
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** "16:9" for 1920 × 1080. Unusual ratios are shown as a decimal, e.g. "2.17:1". */
function aspectRatio(width: number, height: number): string {
  if (!width || !height) return "—";
  const divisor = gcd(width, height);
  const w = width / divisor;
  const h = height / divisor;
  if (w <= 32 && h <= 32) return `${w}:${h}`;
  return `${(Math.max(width, height) / Math.min(width, height)).toFixed(2)}:1`;
}

const round = (value: number) => Math.round(value * 100) / 100;

export default function ScreenResolutionChecker() {
  const { track } = useTool();
  const [info, setInfo] = useState<ScreenInfo>(readScreen);

  useEffect(() => {
    const refresh = () => setInfo(readScreen());
    const lists = WATCHED_QUERIES.map((query) => window.matchMedia(query));
    // A resolution query fires when the window moves to a screen with a different pixel ratio or the page is zoomed.
    const ratio = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    window.addEventListener("resize", refresh);
    screen.orientation?.addEventListener("change", refresh);
    lists.forEach((list) => list.addEventListener("change", refresh));
    ratio.addEventListener("change", refresh);
    return () => {
      window.removeEventListener("resize", refresh);
      screen.orientation?.removeEventListener("change", refresh);
      lists.forEach((list) => list.removeEventListener("change", refresh));
      ratio.removeEventListener("change", refresh);
    };
  }, [info.pixelRatio]);

  useEffect(() => {
    track();
  }, [track]);

  const physicalWidth = Math.round(info.screenWidth * info.pixelRatio);
  const physicalHeight = Math.round(info.screenHeight * info.pixelRatio);

  const summary = [
    `Screen resolution: ${info.screenWidth} × ${info.screenHeight} (CSS pixels)`,
    `Physical resolution: ${physicalWidth} × ${physicalHeight}`,
    `Available screen: ${info.availWidth} × ${info.availHeight}`,
    `Browser viewport: ${info.viewportWidth} × ${info.viewportHeight}`,
    `Device pixel ratio: ${round(info.pixelRatio)}`,
    `Aspect ratio: ${aspectRatio(info.screenWidth, info.screenHeight)}`,
    `Color depth: ${info.colorDepth}-bit`,
    `Orientation: ${info.orientation}`,
    `Touch points: ${info.touchPoints}`,
    `Color scheme: ${info.colorScheme}`,
    `User agent: ${navigator.userAgent}`,
  ].join("\n");

  return (
    <div className="space-y-4">
      <Panel title="Your screen" actions={<CopyButton text={summary} label="Copy summary" />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-primary-line bg-primary-soft px-5 py-6 text-center">
            <p className="text-sm text-muted">Screen resolution</p>
            <p className="mt-1 font-display text-4xl font-semibold tabular-nums text-ink sm:text-5xl">
              {info.screenWidth} × {info.screenHeight}
            </p>
            <p className="mt-2 text-xs text-muted">
              {physicalWidth} × {physicalHeight} physical pixels at {round(info.pixelRatio)}x
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface px-5 py-6 text-center" aria-live="polite">
            <p className="text-sm text-muted">Browser viewport</p>
            <p className="mt-1 font-display text-4xl font-semibold tabular-nums text-ink sm:text-5xl">
              {info.viewportWidth} × {info.viewportHeight}
            </p>
            <p className="mt-2 text-xs text-muted">Resize the window to see it update.</p>
          </div>
        </div>
      </Panel>

      <StatGrid>
        <Stat label="Available screen" value={`${info.availWidth} × ${info.availHeight}`} />
        <Stat label="Viewport without scrollbar" value={`${info.layoutWidth} × ${info.viewportHeight}`} />
        <Stat label="Device pixel ratio" value={round(info.pixelRatio)} />
        <Stat label="Aspect ratio" value={aspectRatio(info.screenWidth, info.screenHeight)} />
        <Stat label="Color depth" value={`${info.colorDepth}-bit`} />
        <Stat label="Orientation" value={info.orientation} />
        <Stat label="Touch points" value={info.touchPoints ? info.touchPoints : "No touch"} />
        <Stat label="Pointer" value={info.pointer} />
        <Stat label="Hover" value={info.hover ? "Supported" : "Not supported"} />
        <Stat label="Color scheme" value={info.colorScheme === "dark" ? "Dark" : "Light"} />
        <Stat label="Color gamut" value={info.gamut} />
        <Stat label="HDR" value={info.hdr ? "Yes" : "No"} />
        <Stat label="Reduced motion" value={info.reducedMotion ? "On" : "Off"} />
      </StatGrid>

      <p className="text-sm text-muted">
        Screen sizes are in CSS pixels, which is what websites use for layout. Multiply by the device pixel ratio to get the
        physical pixels of the display. Browser zoom changes the CSS size and the pixel ratio.
      </p>
    </div>
  );
}
