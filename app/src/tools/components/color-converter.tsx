"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Hint, Input, Label } from "@/components/ui/field";
import { ErrorText, Panel, ToolColumns } from "@/components/tool-ui";
import { cn } from "@/lib/utils";
import { useTool } from "@/tools/context";
import { contrastRatio, flattenOver, formatColor, mixColors, parseColor, rgbToHex, type Rgba } from "@/tools/lib/dev";
import { ValueList, ValueRow } from "@/tools/lib/dev-ui";

const INITIAL = "#17785F";
const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };
const STEPS = [0.85, 0.7, 0.55, 0.4, 0.2];

const CHECKERBOARD = {
  backgroundImage: "repeating-conic-gradient(#c8cdd0 0% 25%, #ffffff 0% 50%)",
  backgroundSize: "16px 16px",
};

function ContrastCard({ background, text, label }: { background: Rgba; text: typeof WHITE; label: string }) {
  const ratio = contrastRatio(background, text);
  const checks = [
    { name: "AA", pass: ratio >= 4.5 },
    { name: "AA Large", pass: ratio >= 3 },
    { name: "AAA", pass: ratio >= 7 },
    { name: "AAA Large", pass: ratio >= 4.5 },
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div
        className="flex items-center justify-between gap-3 px-4 py-5"
        style={{ backgroundColor: rgbToHex(background, false), color: rgbToHex({ ...text, a: 1 }, false) }}
      >
        <span className="font-display text-2xl font-semibold">Aa</span>
        <span className="text-sm">{label}</span>
      </div>
      <div className="space-y-2 px-4 py-3">
        <p className="text-sm text-ink">
          Contrast <span className="font-mono font-semibold tabular-nums">{ratio.toFixed(2)}:1</span>
        </p>
        <ul className="flex flex-wrap gap-1.5" aria-label={`WCAG results for ${label.toLowerCase()}`}>
          {checks.map((c) => (
            <li key={c.name}>
              <Badge tone={c.pass ? "success" : "danger"}>
                {c.name} {c.pass ? "pass" : "fail"}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function ColorConverter() {
  const { track } = useTool();
  const textId = useId();
  const pickerId = useId();
  const [text, setText] = useState(INITIAL);
  const [color, setColor] = useState<Rgba>(() => parseColor(INITIAL)!);
  const [touched, setTouched] = useState(false);

  const valid = parseColor(text) !== null;
  const formats = useMemo(() => formatColor(color), [color]);
  const opaque = useMemo(() => flattenOver(color, WHITE), [color]);

  const palette = useMemo(
    () => [
      ...STEPS.map((amount) => ({ color: mixColors(color, WHITE, amount), label: `Tint ${Math.round(amount * 100)}%` })),
      { color, label: "Selected colour" },
      ...[...STEPS].reverse().map((amount) => ({ color: mixColors(color, BLACK, amount), label: `Shade ${Math.round(amount * 100)}%` })),
    ],
    [color],
  );

  useEffect(() => {
    if (touched) track();
  }, [touched, color, track]);

  function updateText(value: string) {
    setText(value);
    const parsed = parseColor(value);
    if (parsed) {
      setColor(parsed);
      setTouched(true);
    }
  }

  function select(next: Rgba) {
    setColor(next);
    setText(rgbToHex(next));
    setTouched(true);
  }

  return (
    <div className="space-y-4">
      <ToolColumns>
        <Panel title="Colour">
          <div className="flex gap-4">
            <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border border-line" style={CHECKERBOARD}>
              <div className="absolute inset-0" style={{ backgroundColor: formats.rgb }} />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <Label htmlFor={textId}>Any colour value</Label>
                <Input
                  id={textId}
                  value={text}
                  onChange={(e) => updateText(e.target.value)}
                  placeholder="#17785F, rgb(23 120 95), hsl(164 68% 28%)"
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={!valid}
                  className="font-mono"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id={pickerId}
                  type="color"
                  value={rgbToHex(color, false).toLowerCase()}
                  onChange={(e) => {
                    const picked = parseColor(e.target.value);
                    if (picked) select({ ...picked, a: color.a });
                  }}
                  className="h-9 w-12 cursor-pointer rounded-md border border-line bg-surface p-0.5"
                />
                <label htmlFor={pickerId} className="text-sm text-muted">
                  Pick from the colour wheel
                </label>
              </div>
            </div>
          </div>
          {!valid && text.trim() ? (
            <div className="mt-3">
              <ErrorText>Not a recognised colour. Try #RRGGBB, #RGB, rgb(), rgba(), hsl() or hsla().</ErrorText>
            </div>
          ) : null}
        </Panel>

        <Panel title="Formats">
          <ValueList>
            <ValueRow label="HEX" value={formats.hex} />
            <ValueRow label="RGB" value={formats.rgb} />
            <ValueRow label="HSL" value={formats.hsl} />
            <ValueRow label="HSV" value={formats.hsv} />
            <ValueRow label="CMYK" value={formats.cmyk} />
          </ValueList>
        </Panel>
      </ToolColumns>

      <Panel title="Tints and shades">
        <div className="flex overflow-hidden rounded-lg border border-line">
          {palette.map((swatch) => {
            const hex = rgbToHex(swatch.color, false);
            const isCurrent = swatch.color === color;
            return (
              <button
                key={swatch.label}
                type="button"
                onClick={() => select(swatch.color)}
                title={`${swatch.label}: ${hex}`}
                aria-label={`${swatch.label}, ${hex}`}
                aria-current={isCurrent || undefined}
                className={cn(
                  "h-14 min-w-0 flex-1 transition-transform hover:z-10 hover:scale-y-110 focus-visible:z-10",
                  isCurrent && "relative z-10 ring-2 ring-ink ring-inset",
                )}
                style={{ backgroundColor: hex }}
              />
            );
          })}
        </div>
        <Hint>Click a swatch to select it.</Hint>
      </Panel>

      <Panel title="Accessibility (WCAG 2)">
        <div className="grid gap-4 sm:grid-cols-2">
          <ContrastCard background={opaque} text={WHITE} label="White text" />
          <ContrastCard background={opaque} text={BLACK} label="Black text" />
        </div>
        <Hint>
          AA needs 4.5:1 for normal text and 3:1 for large text (24px, or 19px bold). AAA needs 7:1 and 4.5:1.
          {color.a < 1 ? " Translucent colours are measured as they appear on a white page." : ""}
        </Hint>
      </Panel>
    </div>
  );
}
