"use client";

/**
 * Shared workspace for the HTML, CSS and JavaScript formatters. Formatting is
 * done by js-beautify, which is loaded on first use; minifying HTML and CSS
 * reuses the minifiers in dev.ts.
 */

import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import type { CSSBeautifyOptions, HTMLBeautifyOptions, JSBeautifyOptions } from "js-beautify";
import { Checkbox, Label, Select } from "@/components/ui/field";
import { ErrorText, OutputBox, Panel, Segmented, Spinner, Stat, StatGrid, TextInput } from "@/components/tool-ui";
import { formatBytes } from "@/lib/utils";
import { useTool } from "@/tools/context";
import { errorMessage, minifyCss, minifyHtml, utf8Length } from "@/tools/lib/dev";
import { OpenFileButton } from "@/tools/lib/dev-ui";

export type BeautifyLanguage = "html" | "css" | "js";

type Beautifier = typeof import("js-beautify");
type Mode = "format" | "minify";
type Indent = "2" | "4" | "tab";
type BraceStyle = NonNullable<JSBeautifyOptions["brace_style"]>;
type WrapAttributes = NonNullable<HTMLBeautifyOptions["wrap_attributes"]>;

interface Settings {
  indent: Indent;
  wrap: number;
  keepBlankLines: boolean;
  braceStyle: BraceStyle;
  breakChains: boolean;
  wrapAttributes: WrapAttributes;
  indentInner: boolean;
  newlineBetweenRules: boolean;
  selectorPerLine: boolean;
}

const DEFAULTS: Settings = {
  indent: "2",
  wrap: 0,
  keepBlankLines: true,
  braceStyle: "collapse",
  breakChains: false,
  wrapAttributes: "auto",
  indentInner: false,
  newlineBetweenRules: true,
  selectorPerLine: true,
};

const LANGUAGES: Record<
  BeautifyLanguage,
  { name: string; accept: string; placeholder: string; extension: string; mime: string; canMinify: boolean }
> = {
  html: {
    name: "HTML",
    accept: ".html,.htm,.xhtml,.vue,.svelte,text/html",
    placeholder: '<!doctype html><html><head><title>Hello</title></head><body><div class="card"><p>Hello <b>world</b></p></div></body></html>',
    extension: "html",
    mime: "text/html;charset=utf-8",
    canMinify: true,
  },
  css: {
    name: "CSS",
    accept: ".css,.scss,.less,text/css",
    placeholder: ".card{color:#333;margin:0 auto}.card h2,.card h3{font-weight:600}@media (max-width:600px){.card{padding:8px}}",
    extension: "css",
    mime: "text/css;charset=utf-8",
    canMinify: true,
  },
  js: {
    name: "JavaScript",
    accept: ".js,.mjs,.cjs,.jsx,.json,text/javascript,application/javascript,application/json",
    placeholder: "function greet(name){if(!name){return 'Hello!'}const parts=['Hello',name];return parts.join(', ')+'!'}",
    extension: "js",
    mime: "text/javascript;charset=utf-8",
    canMinify: false,
  },
};

const WRAP_OPTIONS = [0, 80, 100, 120, 160];

const BRACE_STYLES: Array<{ value: BraceStyle; label: string }> = [
  { value: "collapse", label: "Opening brace on the same line (collapse)" },
  { value: "expand", label: "Opening brace on its own line (expand)" },
  { value: "end-expand", label: "Same line, else on its own line (end-expand)" },
  { value: "none", label: "Keep as written (none)" },
];

const WRAP_ATTRIBUTES: Array<{ value: WrapAttributes; label: string }> = [
  { value: "auto", label: "Only when the line is too long" },
  { value: "force", label: "Each attribute on its own line" },
  { value: "force-aligned", label: "Each on its own line, aligned" },
  { value: "force-expand-multiline", label: "Each on its own line, tag closed on its own line" },
  { value: "preserve", label: "Keep as written" },
];

function beautify(beautifier: Beautifier, language: BeautifyLanguage, code: string, s: Settings): string {
  const common = {
    indent_size: s.indent === "4" ? 4 : 2,
    indent_with_tabs: s.indent === "tab",
    wrap_line_length: s.wrap,
    preserve_newlines: s.keepBlankLines,
    max_preserve_newlines: 2,
    end_with_newline: true,
  };
  if (language === "js") {
    const options: JSBeautifyOptions = { ...common, brace_style: s.braceStyle, break_chained_methods: s.breakChains };
    return beautifier.js(code, options);
  }
  if (language === "css") {
    const options: CSSBeautifyOptions = {
      ...common,
      newline_between_rules: s.newlineBetweenRules,
      selector_separator_newline: s.selectorPerLine,
    };
    return beautifier.css(code, options);
  }
  const options: HTMLBeautifyOptions = {
    ...common,
    wrap_attributes: s.wrapAttributes,
    indent_inner_html: s.indentInner,
    indent_scripts: "normal",
  };
  return beautifier.html(code, options);
}

type Result = { ok: true; value: string } | { ok: false; error: string };

export function CodeBeautifier({ language }: { language: BeautifyLanguage }) {
  const { track } = useTool();
  const details = LANGUAGES[language];
  const indentId = useId();
  const wrapId = useId();
  const braceId = useId();
  const attrId = useId();
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("format");
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [beautifier, setBeautifier] = useState<Beautifier | null>(null);
  const [loadError, setLoadError] = useState("");
  const [fileError, setFileError] = useState("");
  const source = useDeferredValue(input);

  const needsBeautifier = mode === "format" && source.trim() !== "" && !beautifier;

  useEffect(() => {
    if (!needsBeautifier) return;
    let cancelled = false;
    import("js-beautify")
      .then((mod) => {
        // Stored through an updater because the library itself is a function.
        if (!cancelled) setBeautifier(() => mod.default);
      })
      .catch(() => {
        if (!cancelled) setLoadError("The formatter could not be loaded. Check your connection and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [needsBeautifier]);

  const result = useMemo<Result | null>(() => {
    if (!source.trim()) return null;
    try {
      if (mode === "minify") return { ok: true, value: language === "css" ? minifyCss(source) : minifyHtml(source) };
      if (!beautifier) return null;
      return { ok: true, value: beautify(beautifier, language, source, settings) };
    } catch (error) {
      return { ok: false, error: errorMessage(error, `This ${details.name} could not be formatted.`) };
    }
  }, [source, mode, beautifier, language, settings, details.name]);

  useEffect(() => {
    if (result?.ok) track();
  }, [result, track]);

  const update = (patch: Partial<Settings>) => setSettings((current) => ({ ...current, ...patch }));
  const output = result?.ok ? result.value : "";
  const sizes = mode === "minify" && output ? { before: utf8Length(source), after: utf8Length(output) } : null;

  return (
    <div className="space-y-4">
      <TextInput
        value={input}
        onChange={setInput}
        label={`${details.name} code`}
        placeholder={details.placeholder}
        rows={12}
        mono
        actions={
          <OpenFileButton
            accept={details.accept}
            onText={(text) => {
              setFileError("");
              setInput(text);
            }}
            onError={setFileError}
          />
        }
      />
      <ErrorText>{fileError || loadError}</ErrorText>

      <Panel title="Options">
        <div className="space-y-4">
          {details.canMinify ? (
            <Segmented
              label="Action"
              value={mode}
              onChange={setMode}
              options={[
                { value: "format", label: "Beautify" },
                { value: "minify", label: "Minify" },
              ]}
            />
          ) : null}

          {mode === "format" ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <Label htmlFor={indentId}>Indentation</Label>
                  <Select id={indentId} value={settings.indent} onChange={(e) => update({ indent: e.target.value as Indent })}>
                    <option value="2">2 spaces</option>
                    <option value="4">4 spaces</option>
                    <option value="tab">Tab</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor={wrapId}>Wrap lines at</Label>
                  <Select id={wrapId} value={settings.wrap} onChange={(e) => update({ wrap: Number(e.target.value) })}>
                    {WRAP_OPTIONS.map((width) => (
                      <option key={width} value={width}>
                        {width === 0 ? "Don't wrap" : `${width} characters`}
                      </option>
                    ))}
                  </Select>
                </div>
                {language === "js" ? (
                  <div>
                    <Label htmlFor={braceId}>Brace style</Label>
                    <Select id={braceId} value={settings.braceStyle} onChange={(e) => update({ braceStyle: e.target.value as BraceStyle })}>
                      {BRACE_STYLES.map((style) => (
                        <option key={style.value} value={style.value}>
                          {style.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : null}
                {language === "html" ? (
                  <div>
                    <Label htmlFor={attrId}>Attributes</Label>
                    <Select
                      id={attrId}
                      value={settings.wrapAttributes}
                      onChange={(e) => update({ wrapAttributes: e.target.value as WrapAttributes })}
                    >
                      {WRAP_ATTRIBUTES.map((style) => (
                        <option key={style.value} value={style.value}>
                          {style.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
                <Checkbox
                  label="Keep blank lines (up to 1)"
                  checked={settings.keepBlankLines}
                  onChange={(e) => update({ keepBlankLines: e.target.checked })}
                />
                {language === "js" ? (
                  <Checkbox
                    label="Break chained method calls"
                    checked={settings.breakChains}
                    onChange={(e) => update({ breakChains: e.target.checked })}
                  />
                ) : null}
                {language === "html" ? (
                  <Checkbox
                    label="Indent <head> and <body>"
                    checked={settings.indentInner}
                    onChange={(e) => update({ indentInner: e.target.checked })}
                  />
                ) : null}
                {language === "css" ? (
                  <>
                    <Checkbox
                      label="Blank line between rules"
                      checked={settings.newlineBetweenRules}
                      onChange={(e) => update({ newlineBetweenRules: e.target.checked })}
                    />
                    <Checkbox
                      label="One selector per line"
                      checked={settings.selectorPerLine}
                      onChange={(e) => update({ selectorPerLine: e.target.checked })}
                    />
                  </>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">
              {language === "css"
                ? "Removes comments (except /*! licence comments) and unnecessary whitespace and semicolons. Strings are never changed."
                : "Removes comments and collapses whitespace. <pre>, <textarea>, <script> and <style> contents are kept as written."}
            </p>
          )}
        </div>
      </Panel>

      {needsBeautifier && !loadError ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner />
          Loading the formatter…
        </p>
      ) : null}
      {result && !result.ok ? <ErrorText>{result.error}</ErrorText> : null}

      {sizes ? (
        <StatGrid>
          <Stat label="Original size" value={formatBytes(sizes.before)} />
          <Stat label="Minified size" value={formatBytes(sizes.after)} />
          <Stat label="Saved" value={`${(Math.max(0, 1 - sizes.after / Math.max(1, sizes.before)) * 100).toFixed(1)}%`} emphasis />
        </StatGrid>
      ) : null}

      <OutputBox
        value={output}
        label={mode === "minify" ? `Minified ${details.name}` : `Formatted ${details.name}`}
        filename={mode === "minify" ? `minified.min.${details.extension}` : `formatted.${details.extension}`}
        mimeType={details.mime}
        mono
        rows={16}
      />
    </div>
  );
}
