"use client";

import { useDeferredValue, useEffect, useId, useMemo, useState, type ClipboardEvent } from "react";
import type { Marked } from "marked";
import type TurndownService from "turndown";
import { Checkbox, Label, Select } from "@/components/ui/field";
import { CopyButton, DownloadTextButton, ErrorText, Panel, Segmented, Spinner, TextInput } from "@/components/tool-ui";
import { useTool } from "@/tools/context";
import { errorMessage, sanitizeHtml } from "@/tools/lib/dev";
import { CodeBlock, OpenFileButton } from "@/tools/lib/dev-ui";

type TurndownClass = typeof TurndownService;
type View = "markdown" | "preview";

interface Settings {
  headingStyle: "atx" | "setext";
  bulletListMarker: "-" | "*" | "+";
  codeBlockStyle: "fenced-backticks" | "fenced-tildes" | "indented";
  emDelimiter: "_" | "*";
  strongDelimiter: "**" | "__";
  linkStyle: "inlined" | "referenced";
}

const DEFAULTS: Settings = {
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced-backticks",
  emDelimiter: "_",
  strongDelimiter: "**",
  linkStyle: "inlined",
};

/** Elements whose content is never part of the readable text. */
const REMOVED = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "iframe",
  "object",
  "embed",
  "canvas",
  "svg",
  "head",
  "title",
  "meta",
  "link",
  "button",
  "select",
  "form",
]);

const PLACEHOLDER = `<h1>Release notes</h1>
<p>This version is <strong>faster</strong> and <em>smaller</em>. Read the <a href="https://example.com/docs">docs</a>.</p>
<ul><li>New export button</li><li>Bug fixes</li></ul>
<pre><code class="language-js">const greeting = "hello";</code></pre>`;

function cellText(cell: Element): string {
  return (cell.textContent ?? "").replace(/\s+/g, " ").trim().replace(/\|/g, "\\|");
}

/** GitHub-flavoured Markdown table from an HTML table. The first row becomes the header. */
function tableToMarkdown(table: HTMLTableElement): string {
  const rows = Array.from(table.rows).map((row) => Array.from(row.cells).map(cellText));
  if (!rows.length) return "";
  const width = Math.max(...rows.map((row) => row.length));
  const line = (cells: string[]) => `| ${Array.from({ length: width }, (_, i) => cells[i] ?? "").join(" | ")} |`;
  const [header, ...body] = rows;
  return `\n\n${[line(header), `| ${Array(width).fill("---").join(" | ")} |`, ...body.map(line)].join("\n")}\n\n`;
}

function createService(Turndown: TurndownClass, s: Settings): TurndownService {
  const service = new Turndown({
    headingStyle: s.headingStyle,
    bulletListMarker: s.bulletListMarker,
    codeBlockStyle: s.codeBlockStyle === "indented" ? "indented" : "fenced",
    fence: s.codeBlockStyle === "fenced-tildes" ? "~~~" : "```",
    emDelimiter: s.emDelimiter,
    strongDelimiter: s.strongDelimiter,
    linkStyle: s.linkStyle,
    hr: "---",
  });
  service.remove((node) => REMOVED.has(node.nodeName.toLowerCase()));
  service.addRule("strikethrough", {
    filter: (node) => ["DEL", "S", "STRIKE"].includes(node.nodeName),
    replacement: (content) => (content.trim() ? `~~${content}~~` : ""),
  });
  service.addRule("taskListItem", {
    filter: (node) => node.nodeName === "INPUT" && node.getAttribute("type") === "checkbox",
    replacement: (_content, node) => (node.hasAttribute("checked") ? "[x] " : "[ ] "),
  });
  // Turndown's default puts three spaces after the bullet; one space is what most people write.
  service.addRule("listItem", {
    filter: "li",
    replacement: (content, node, options) => {
      const parent = node.parentElement;
      let prefix = `${options.bulletListMarker ?? "-"} `;
      if (parent?.nodeName === "OL") {
        const start = Number(parent.getAttribute("start") ?? "1");
        prefix = `${(Number.isFinite(start) ? start : 1) + Array.from(parent.children).indexOf(node)}. `;
      }
      const body = content
        .replace(/^\n+/, "")
        .replace(/\n+$/, "\n")
        .replace(/\n(?=[^\n])/g, `\n${" ".repeat(prefix.length)}`);
      return prefix + body + (node.nextSibling && !body.endsWith("\n") ? "\n" : "");
    },
  });
  service.addRule("table", {
    filter: "table",
    replacement: (_content, node) => tableToMarkdown(node as HTMLTableElement),
  });
  return service;
}

type Result = { ok: true; markdown: string } | { ok: false; error: string };

export default function HtmlToMarkdown() {
  const { track } = useTool();
  const headingId = useId();
  const bulletId = useId();
  const codeId = useId();
  const emId = useId();
  const strongId = useId();
  const linkId = useId();
  const [input, setInput] = useState("");
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [pasteRich, setPasteRich] = useState(true);
  const [view, setView] = useState<View>("markdown");
  const [Turndown, setTurndown] = useState<TurndownClass | null>(null);
  const [parser, setParser] = useState<Marked | null>(null);
  const [loadError, setLoadError] = useState("");
  const [fileError, setFileError] = useState("");
  const source = useDeferredValue(input);

  const needsTurndown = source.trim() !== "" && !Turndown;
  const needsParser = view === "preview" && source.trim() !== "" && !parser;

  useEffect(() => {
    if (!needsTurndown) return;
    let cancelled = false;
    import("turndown")
      .then((mod) => {
        // Stored through an updater because the library export is a class.
        if (!cancelled) setTurndown(() => mod.default);
      })
      .catch(() => {
        if (!cancelled) setLoadError("The converter could not be loaded. Check your connection and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [needsTurndown]);

  useEffect(() => {
    if (!needsParser) return;
    let cancelled = false;
    import("marked")
      .then(({ Marked }) => {
        if (!cancelled) setParser(new Marked({ gfm: true }));
      })
      .catch(() => {
        if (!cancelled) setLoadError("The preview could not be loaded. Check your connection and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [needsParser]);

  const service = useMemo(() => (Turndown ? createService(Turndown, settings) : null), [Turndown, settings]);

  // Turndown parses the HTML in an inert DOMParser document: scripts never run and nothing is loaded.
  const result = useMemo<Result | null>(() => {
    if (!service || !source.trim()) return null;
    try {
      return { ok: true, markdown: service.turndown(source).trim() + "\n" };
    } catch (error) {
      return { ok: false, error: errorMessage(error, "This HTML could not be converted.") };
    }
  }, [service, source]);

  const markdown = result?.ok ? result.markdown : "";

  // The preview is rendered from the Markdown and always sanitised before it touches the page.
  const previewHtml = useMemo(
    () => (parser && markdown && view === "preview" ? sanitizeHtml(parser.parse(markdown, { async: false, gfm: true }), { externalLinks: true }) : ""),
    [parser, markdown, view],
  );

  useEffect(() => {
    if (result?.ok) track();
  }, [result, track]);

  const update = (patch: Partial<Settings>) => setSettings((current) => ({ ...current, ...patch }));

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    if (!pasteRich) return;
    const html = event.clipboardData.getData("text/html");
    const target = event.target;
    if (!html || !(target instanceof HTMLTextAreaElement)) return;
    event.preventDefault();
    const { selectionStart, selectionEnd, value } = target;
    setInput(value.slice(0, selectionStart) + html + value.slice(selectionEnd));
  }

  return (
    <div className="space-y-4">
      <div onPaste={handlePaste}>
        <TextInput
          value={input}
          onChange={setInput}
          label="HTML input"
          placeholder={PLACEHOLDER}
          rows={12}
          mono
          actions={
            <OpenFileButton
              accept=".html,.htm,.xhtml,text/html"
              onText={(text) => {
                setFileError("");
                setInput(text);
              }}
              onError={setFileError}
            />
          }
        />
      </div>
      <ErrorText>{fileError || loadError}</ErrorText>

      <Panel title="Options">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor={headingId}>Headings</Label>
            <Select id={headingId} value={settings.headingStyle} onChange={(e) => update({ headingStyle: e.target.value as Settings["headingStyle"] })}>
              <option value="atx"># Heading (ATX)</option>
              <option value="setext">Underlined (Setext)</option>
            </Select>
          </div>
          <div>
            <Label htmlFor={bulletId}>Bullet marker</Label>
            <Select
              id={bulletId}
              value={settings.bulletListMarker}
              onChange={(e) => update({ bulletListMarker: e.target.value as Settings["bulletListMarker"] })}
            >
              <option value="-">- Dash</option>
              <option value="*">* Asterisk</option>
              <option value="+">+ Plus</option>
            </Select>
          </div>
          <div>
            <Label htmlFor={codeId}>Code blocks</Label>
            <Select id={codeId} value={settings.codeBlockStyle} onChange={(e) => update({ codeBlockStyle: e.target.value as Settings["codeBlockStyle"] })}>
              <option value="fenced-backticks">Fenced with ```</option>
              <option value="fenced-tildes">Fenced with ~~~</option>
              <option value="indented">Indented (4 spaces)</option>
            </Select>
          </div>
          <div>
            <Label htmlFor={emId}>Italic</Label>
            <Select id={emId} value={settings.emDelimiter} onChange={(e) => update({ emDelimiter: e.target.value as Settings["emDelimiter"] })}>
              <option value="_">_italic_</option>
              <option value="*">*italic*</option>
            </Select>
          </div>
          <div>
            <Label htmlFor={strongId}>Bold</Label>
            <Select id={strongId} value={settings.strongDelimiter} onChange={(e) => update({ strongDelimiter: e.target.value as Settings["strongDelimiter"] })}>
              <option value="**">**bold**</option>
              <option value="__">__bold__</option>
            </Select>
          </div>
          <div>
            <Label htmlFor={linkId}>Links</Label>
            <Select id={linkId} value={settings.linkStyle} onChange={(e) => update({ linkStyle: e.target.value as Settings["linkStyle"] })}>
              <option value="inlined">Inline [text](url)</option>
              <option value="referenced">Reference [text][1]</option>
            </Select>
          </div>
        </div>
        <Checkbox
          className="mt-4"
          label="When pasting from a web page or document, paste its HTML"
          checked={pasteRich}
          onChange={(e) => setPasteRich(e.target.checked)}
        />
      </Panel>

      {result && !result.ok ? <ErrorText>{result.error}</ErrorText> : null}

      <Panel
        className="min-w-0"
        title="Markdown"
        actions={
          <>
            <CopyButton text={markdown} label="Copy Markdown" />
            <DownloadTextButton text={markdown} filename="document.md" type="text/markdown;charset=utf-8" />
          </>
        }
      >
        <Segmented
          label="Output view"
          className="mb-3"
          value={view}
          onChange={setView}
          options={[
            { value: "markdown", label: "Markdown" },
            { value: "preview", label: "Preview" },
          ]}
        />
        {needsTurndown && !loadError ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Spinner />
            Loading…
          </p>
        ) : !markdown ? (
          <p className="text-sm text-muted">The Markdown will appear here as you type or paste HTML.</p>
        ) : view === "markdown" ? (
          <CodeBlock code={markdown} label="Generated Markdown" className="max-h-[36rem]" />
        ) : needsParser && !loadError ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Spinner />
            Loading the preview…
          </p>
        ) : (
          <div
            className="prose-tz max-h-[36rem] max-w-none overflow-auto break-words"
            // Safe: previewHtml has been through sanitizeHtml (allow-listed tags and attributes, no scripts or event handlers).
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        )}
      </Panel>
    </div>
  );
}
