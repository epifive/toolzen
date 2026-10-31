"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, OutputBox, Segmented, Stat, StatGrid, TextInput } from "@/components/tool-ui";
import { formatBytes } from "@/lib/utils";
import { useTool } from "@/tools/context";
import { minifyCss, minifyHtml, utf8Length } from "@/tools/lib/dev";
import { OpenFileButton } from "@/tools/lib/dev-ui";

type Language = "css" | "html";

const ACCEPT = ".css,.html,.htm,text/css,text/html";

const DETAILS: Record<Language, { placeholder: string; note: string }> = {
  css: {
    placeholder: "/* Paste your CSS */\n.card {\n  color: #333;\n  margin: 0 auto;\n}",
    note: "Removes comments (except /*! licence comments) and unnecessary whitespace and semicolons. Strings are never changed.",
  },
  html: {
    placeholder: "<!-- Paste your HTML -->\n<div class=\"card\">\n  <p>Hello</p>\n</div>",
    note: "Removes comments (except conditional comments) and collapses whitespace. <pre>, <textarea>, <script> and <style> contents are kept as written.",
  },
};

export default function CodeMinifier() {
  const { track } = useTool();
  const [language, setLanguage] = useState<Language>("css");
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);
  const [fileError, setFileError] = useState("");
  const source = useDeferredValue(input);

  // After the first click on Minify the result follows every edit.
  const output = useMemo(() => {
    if (!started || !source.trim()) return "";
    return language === "css" ? minifyCss(source) : minifyHtml(source);
  }, [started, source, language]);

  const sizes = useMemo(
    () => (output ? { before: utf8Length(source), after: utf8Length(output) } : null),
    [output, source],
  );

  useEffect(() => {
    if (output) track();
  }, [output, track]);

  const saved = sizes && sizes.before ? Math.max(0, 1 - sizes.after / sizes.before) : 0;
  const details = DETAILS[language];

  return (
    <div className="space-y-4">
      <Segmented
        label="Language"
        value={language}
        onChange={setLanguage}
        options={[
          { value: "css", label: "CSS" },
          { value: "html", label: "HTML" },
        ]}
      />
      <p className="text-sm text-muted">{details.note}</p>

      <TextInput
        value={input}
        onChange={setInput}
        label={language === "css" ? "CSS code" : "HTML code"}
        placeholder={details.placeholder}
        rows={12}
        mono
        actions={
          <OpenFileButton
            accept={ACCEPT}
            onText={(text, file) => {
              setFileError("");
              setInput(text);
              if (/\.html?$/i.test(file.name)) setLanguage("html");
              else if (/\.css$/i.test(file.name)) setLanguage("css");
            }}
            onError={setFileError}
          />
        }
      />
      <ErrorText>{fileError}</ErrorText>

      <Button onClick={() => setStarted(true)} disabled={!input.trim()}>
        <Minimize2 aria-hidden />
        Minify {language === "css" ? "CSS" : "HTML"}
      </Button>

      {sizes ? (
        <StatGrid>
          <Stat label="Original size" value={formatBytes(sizes.before)} />
          <Stat label="Minified size" value={formatBytes(sizes.after)} />
          <Stat label="Saved" value={`${(saved * 100).toFixed(1)}%`} emphasis />
        </StatGrid>
      ) : null}

      <OutputBox value={output} label="Minified code" filename={language === "css" ? "styles.min.css" : "index.min.html"} mono rows={10} />
    </div>
  );
}
