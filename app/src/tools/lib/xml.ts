/**
 * XML helpers for the XML formatter and the JSON ↔ XML converters.
 *
 * `jsonToXml`, `tokenizeXml`, `formatXml` and `minifyXml` are plain TypeScript.
 * `parseXml` and `xmlToJson` need a browser DOM: they use DOMParser, which
 * parses XML into an inert document (nothing is rendered, loaded or run).
 */

import { inferCsvValue, offsetToPosition, type TextPosition } from "./dev";

export type XmlIndent = "2" | "4" | "tab";

export interface XmlErrorInfo extends Partial<TextPosition> {
  message: string;
}

function indentUnit(indent: XmlIndent | "none"): string {
  if (indent === "none") return "";
  return indent === "tab" ? "\t" : " ".repeat(Number(indent));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/* ───────────────────────── Escaping ───────────────────────── */

/** Characters XML 1.0 cannot represent at all, not even as character references. */
const INVALID_XML_CHARS = /[^\t\n\r\x20-\u{D7FF}\u{E000}-\u{FFFD}\u{10000}-\u{10FFFF}]/gu;

function stripInvalidChars(text: string): string {
  return text.replace(INVALID_XML_CHARS, "");
}

/** Escape text for use as XML element content. */
export function escapeXmlText(text: string): string {
  return stripInvalidChars(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Escape text for use inside a double-quoted XML attribute value. */
export function escapeXmlAttribute(text: string): string {
  return escapeXmlText(text)
    .replace(/"/g, "&quot;")
    .replace(/\t/g, "&#9;")
    .replace(/\n/g, "&#10;")
    .replace(/\r/g, "&#13;");
}

const XML_NAME = /^[\p{L}_][\p{L}\p{N}_.-]*(?::[\p{L}_][\p{L}\p{N}_.-]*)?$/u;

/** True when `name` can be used as an element or attribute name. */
export function isValidXmlName(name: string): boolean {
  return XML_NAME.test(name);
}

/** Turn any JSON key into a valid XML name: invalid characters become "_". */
export function toXmlName(key: string, fallback: string): string {
  if (isValidXmlName(key)) return key;
  let name = key.replace(/[^\p{L}\p{N}_.-]/gu, "_");
  if (!name) return fallback;
  if (!/^[\p{L}_]/u.test(name)) name = `_${name}`;
  return name;
}

/* ───────────────────────── JSON → XML ───────────────────────── */

export interface JsonToXmlOptions {
  /** Name of the root element when the JSON does not provide one. */
  rootName: string;
  /** Element name used for the items of arrays that have no key (top-level or nested arrays). */
  itemName: string;
  indent: XmlIndent | "none";
  /** Add an <?xml version="1.0" encoding="UTF-8"?> declaration. */
  declaration: boolean;
  /** Keys starting with this prefix become attributes, e.g. "@id". */
  attributePrefix: string;
  /** Key whose value becomes the element's text, e.g. "#text". */
  textKey: string;
  /** Use the only top-level key as the root element, e.g. {"catalog": {…}} → <catalog>. */
  unwrapSingleKey: boolean;
}

export interface JsonToXmlResult {
  xml: string;
  /** Keys that were not valid XML names and had to be renamed. */
  renamed: Array<{ from: string; to: string }>;
}

function scalarText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Convert parsed JSON to XML. Arrays become repeated elements; "@" keys become attributes. */
export function jsonToXml(value: unknown, options: JsonToXmlOptions): JsonToXmlResult {
  const unit = indentUnit(options.indent);
  const newline = options.indent === "none" ? "" : "\n";
  const renamed = new Map<string, string>();
  const lines: string[] = [];

  const nameFor = (key: string, fallback: string) => {
    const name = toXmlName(key, fallback);
    if (name !== key) renamed.set(key, name);
    return name;
  };
  const pad = (depth: number) => unit.repeat(depth);

  const writeField = (key: string, field: unknown, depth: number) => {
    const name = nameFor(key, options.itemName);
    if (Array.isArray(field)) field.forEach((item) => writeElement(name, item, depth));
    else writeElement(name, field, depth);
  };

  const writeElement = (name: string, element: unknown, depth: number) => {
    if (element === null || element === undefined) {
      lines.push(`${pad(depth)}<${name}/>`);
      return;
    }
    if (Array.isArray(element)) {
      if (!element.length) {
        lines.push(`${pad(depth)}<${name}/>`);
        return;
      }
      lines.push(`${pad(depth)}<${name}>`);
      element.forEach((item) => writeElement(nameFor(options.itemName, "item"), item, depth + 1));
      lines.push(`${pad(depth)}</${name}>`);
      return;
    }
    if (!isPlainObject(element)) {
      lines.push(`${pad(depth)}<${name}>${escapeXmlText(scalarText(element))}</${name}>`);
      return;
    }

    let attributes = "";
    let text = "";
    const children: Array<[string, unknown]> = [];
    for (const [key, child] of Object.entries(element)) {
      if (options.attributePrefix && key.startsWith(options.attributePrefix) && key.length > options.attributePrefix.length) {
        const attrName = nameFor(key.slice(options.attributePrefix.length), "attribute");
        attributes += ` ${attrName}="${escapeXmlAttribute(scalarText(child))}"`;
      } else if (key === options.textKey) {
        text += scalarText(child);
      } else {
        children.push([key, child]);
      }
    }

    const open = `${pad(depth)}<${name}${attributes}`;
    if (!children.length) {
      lines.push(text ? `${open}>${escapeXmlText(text)}</${name}>` : `${open}/>`);
      return;
    }
    lines.push(`${open}>`);
    if (text) lines.push(`${pad(depth + 1)}${escapeXmlText(text)}`);
    for (const [key, child] of children) writeField(key, child, depth + 1);
    lines.push(`${pad(depth)}</${name}>`);
  };

  const rootName = nameFor(options.rootName.trim() || "root", "root");
  const keys = isPlainObject(value) ? Object.keys(value) : [];
  const singleKey =
    options.unwrapSingleKey &&
    isPlainObject(value) &&
    keys.length === 1 &&
    keys[0] !== options.textKey &&
    !(options.attributePrefix && keys[0].startsWith(options.attributePrefix)) &&
    !Array.isArray(value[keys[0]]);

  if (singleKey) writeElement(nameFor(keys[0], rootName), value[keys[0]], 0);
  else writeElement(rootName, value, 0);

  const declaration = options.declaration ? `<?xml version="1.0" encoding="UTF-8"?>${newline}` : "";
  return {
    xml: declaration + lines.join(newline) + newline,
    renamed: Array.from(renamed, ([from, to]) => ({ from, to })),
  };
}

/* ───────────────────────── Parsing (DOM) ───────────────────────── */

const PARSER_ERROR_NAMESPACES = [
  "http://www.w3.org/1999/xhtml", // Chrome, Edge, Safari
  "http://www.mozilla.org/newlayout/xml/parsererror.xml", // Firefox
];

function tidyMessage(message: string): string {
  const text = message.trim().replace(/\s+/g, " ").replace(/[.:]$/, "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "The XML is not well-formed";
}

/** Turn the text of a browser <parsererror> element into a message with a line and column. */
export function describeXmlParserError(raw: string): XmlErrorInfo {
  const webkit = /error on line (\d+) at column (\d+):\s*([^\n]+)/i.exec(raw);
  if (webkit) return { message: tidyMessage(webkit[3]), line: Number(webkit[1]), column: Number(webkit[2]) };

  const gecko = /XML Parsing Error:\s*([^\n]+)/i.exec(raw);
  const position = /Line Number (\d+), Column (\d+)/i.exec(raw);
  const message = tidyMessage(gecko ? gecko[1] : (raw.split("\n").find((line) => line.trim()) ?? ""));
  return position ? { message, line: Number(position[1]), column: Number(position[2]) } : { message };
}

export type XmlParseResult = { ok: true; doc: Document } | { ok: false; error: XmlErrorInfo };

/** Parse and validate XML with the browser's own parser. Requires a DOM. */
export function parseXml(text: string): XmlParseResult {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  for (const namespace of PARSER_ERROR_NAMESPACES) {
    const error = doc.getElementsByTagNameNS(namespace, "parsererror")[0];
    if (error) return { ok: false, error: describeXmlParserError(error.textContent ?? "") };
  }
  if (!doc.documentElement) return { ok: false, error: { message: "The document has no root element" } };
  return { ok: true, doc };
}

/* ───────────────────────── XML → JSON (DOM) ───────────────────────── */

export interface XmlToJsonOptions {
  /** Prefix for attribute keys, e.g. "@" gives "@id". */
  attributePrefix: string;
  /** Key for an element's text when it also has attributes or children. */
  textKey: string;
  /** Text-only elements become plain values and single children are not wrapped in arrays. */
  compact: boolean;
  includeAttributes: boolean;
  /** Turn "42", "true" and "false" into numbers and booleans. */
  inferTypes: boolean;
}

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;

/** Convert a parsed XML document to a JSON-compatible value keyed by the root element's name. */
export function xmlToJson(doc: Document, options: XmlToJsonOptions): Record<string, unknown> {
  const scalar = (text: string): unknown => (options.inferTypes ? inferCsvValue(text) : text);

  const convert = (element: Element): unknown => {
    const result: Record<string, unknown> = {};
    if (options.includeAttributes) {
      for (const attr of Array.from(element.attributes)) result[options.attributePrefix + attr.name] = scalar(attr.value);
    }

    const pieces: string[] = [];
    const children = new Map<string, unknown[]>();
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === ELEMENT_NODE) {
        const child = node as Element;
        const list = children.get(child.nodeName) ?? [];
        list.push(convert(child));
        children.set(child.nodeName, list);
      } else if (node.nodeType === TEXT_NODE || node.nodeType === CDATA_SECTION_NODE) {
        pieces.push(node.nodeValue ?? "");
      }
    }
    // A single text node keeps its inner line breaks; mixed content is joined with single spaces.
    const text = children.size
      ? pieces
          .map((piece) => piece.trim())
          .filter(Boolean)
          .join(" ")
      : pieces.join("").trim();

    if (options.compact && !children.size && !Object.keys(result).length) return text === "" ? null : scalar(text);
    if (text) result[options.textKey] = scalar(text);
    for (const [name, list] of children) result[name] = options.compact && list.length === 1 ? list[0] : list;
    return result;
  };

  const root = doc.documentElement;
  return { [root.nodeName]: convert(root) };
}

/* ───────────────────────── Tokenizer, formatter, minifier ───────────────────────── */

export type XmlTokenKind = "open" | "close" | "empty" | "text" | "comment" | "cdata" | "pi" | "doctype";

export interface XmlToken {
  kind: XmlTokenKind;
  raw: string;
  /** Element name for open, close and empty tags. */
  name: string;
  /** 0-based offsets of the token in the source. */
  start: number;
  end: number;
}

export class XmlSyntaxError extends Error {
  /** The problem without its location, e.g. "Unclosed comment". */
  readonly reason: string;
  readonly position: TextPosition;

  constructor(reason: string, text: string, offset: number) {
    const position = offsetToPosition(text, offset);
    super(`${reason} at line ${position.line}, column ${position.column}`);
    this.name = "XmlSyntaxError";
    this.reason = reason;
    this.position = position;
  }
}

/** Index just after the next `>` that is not inside quotes or [brackets]. */
function findTagEnd(text: string, from: number): number {
  let quote = "";
  let brackets = 0;
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === "[") {
      brackets++;
    } else if (ch === "]") {
      brackets = Math.max(0, brackets - 1);
    } else if (ch === ">" && brackets === 0) {
      return i + 1;
    }
  }
  return -1;
}

/**
 * Split XML into tags, text, comments, CDATA sections, processing instructions
 * and doctypes. It does not check nesting (DOMParser does that); it only needs
 * to find token boundaries reliably.
 */
export function tokenizeXml(text: string): XmlToken[] {
  const tokens: XmlToken[] = [];
  let i = 0;

  const push = (kind: XmlTokenKind, start: number, end: number, name = "") =>
    tokens.push({ kind, raw: text.slice(start, end), name, start, end });

  const closeAt = (start: number, marker: string, from: number, what: string) => {
    const index = text.indexOf(marker, from);
    if (index < 0) throw new XmlSyntaxError(`Unclosed ${what}`, text, start);
    return index + marker.length;
  };

  while (i < text.length) {
    if (text[i] !== "<") {
      const next = text.indexOf("<", i);
      const end = next < 0 ? text.length : next;
      push("text", i, end);
      i = end;
      continue;
    }
    let end: number;
    if (text.startsWith("<!--", i)) {
      end = closeAt(i, "-->", i + 4, "comment");
      push("comment", i, end);
    } else if (text.startsWith("<![CDATA[", i)) {
      end = closeAt(i, "]]>", i + 9, "CDATA section");
      push("cdata", i, end);
    } else if (text.startsWith("<?", i)) {
      end = closeAt(i, "?>", i + 2, "processing instruction");
      push("pi", i, end);
    } else if (text.startsWith("<!", i)) {
      end = findTagEnd(text, i + 2);
      if (end < 0) throw new XmlSyntaxError("Unclosed declaration", text, i);
      push("doctype", i, end);
    } else if (text.startsWith("</", i)) {
      end = closeAt(i, ">", i + 2, "end tag");
      push("close", i, end, text.slice(i + 2, end - 1).trim());
    } else {
      end = findTagEnd(text, i + 1);
      if (end < 0) throw new XmlSyntaxError("Unclosed start tag", text, i);
      const raw = text.slice(i, end);
      const name = /^<\s*([^\s/>]+)/.exec(raw)?.[1] ?? "";
      if (!name) throw new XmlSyntaxError("Missing element name", text, i);
      push(/\/\s*>$/.test(raw) ? "empty" : "open", i, end, name);
    }
    i = end;
  }
  return tokens;
}

/** Collapse whitespace between attributes while leaving quoted values untouched. */
function normalizeTag(raw: string, selfClosing: boolean): string {
  let out = "";
  let quote = "";
  let pendingSpace = false;
  const body = raw.slice(1, selfClosing ? raw.lastIndexOf("/") : -1);
  for (const ch of body) {
    if (quote) {
      out += ch;
      if (ch === quote) quote = "";
      continue;
    }
    if (/\s/.test(ch)) {
      pendingSpace = out.length > 0;
      continue;
    }
    if (pendingSpace && ch !== "=" && !out.endsWith("=")) out += " ";
    pendingSpace = false;
    if (ch === '"' || ch === "'") quote = ch;
    out += ch;
  }
  return `<${out}${selfClosing ? "/>" : ">"}`;
}

function renderTag(token: XmlToken): string {
  if (token.kind === "open") return normalizeTag(token.raw, false);
  if (token.kind === "empty") return normalizeTag(token.raw, true);
  if (token.kind === "close") return `</${token.name}>`;
  return token.raw;
}

/** Index of the close tag that matches the open tag at `index`, or -1. */
function matchingClose(tokens: XmlToken[], index: number): number {
  let depth = 0;
  for (let i = index; i < tokens.length; i++) {
    if (tokens[i].kind === "open") depth++;
    else if (tokens[i].kind === "close" && --depth === 0) return i;
  }
  return -1;
}

const PRESERVE_SPACE = /\sxml:space\s*=\s*["']preserve["']/;

export interface FormatXmlOptions {
  indent: XmlIndent;
  removeComments?: boolean;
}

/**
 * Pretty-print XML. Text-only elements stay on one line exactly as written,
 * whitespace-only text between tags is dropped, and elements marked
 * xml:space="preserve" are copied verbatim.
 */
export function formatXml(text: string, { indent, removeComments = false }: FormatXmlOptions): string {
  const tokens = tokenizeXml(text);
  const unit = indentUnit(indent);
  const lines: string[] = [];
  let depth = 0;
  const line = (content: string) => lines.push(unit.repeat(Math.max(0, depth)) + content);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    switch (token.kind) {
      case "text": {
        const trimmed = token.raw.trim();
        if (trimmed) line(trimmed);
        break;
      }
      case "comment":
        if (!removeComments) line(token.raw);
        break;
      case "open": {
        if (PRESERVE_SPACE.test(token.raw)) {
          const close = matchingClose(tokens, i);
          if (close > 0) {
            line(text.slice(token.start, tokens[close].end));
            i = close;
            break;
          }
        }
        const next = tokens[i + 1];
        const after = tokens[i + 2];
        if (next?.kind === "close") {
          line(renderTag(token) + renderTag(next));
          i += 1;
        } else if ((next?.kind === "text" || next?.kind === "cdata") && after?.kind === "close") {
          line(renderTag(token) + next.raw + renderTag(after));
          i += 2;
        } else {
          line(renderTag(token));
          depth++;
        }
        break;
      }
      case "close":
        depth--;
        line(renderTag(token));
        break;
      default:
        line(renderTag(token));
    }
  }
  return lines.join("\n") + "\n";
}

/**
 * Remove whitespace between tags, indentation around text, and optionally
 * comments. Other text and xml:space="preserve" elements are kept exactly.
 */
export function minifyXml(text: string, { removeComments = true }: { removeComments?: boolean } = {}): string {
  const tokens = tokenizeXml(text);
  let out = "";
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.kind === "text") {
      // Leading or trailing whitespace that contains a line break is indentation; whitespace-only text is dropped.
      const content = token.raw.replace(/^\s*\n\s*/, "").replace(/\s*\n\s*$/, "");
      if (content.trim()) out += content;
    } else if (token.kind === "comment") {
      if (!removeComments) out += token.raw;
    } else if (token.kind === "open" && PRESERVE_SPACE.test(token.raw)) {
      const close = matchingClose(tokens, i);
      if (close > 0) {
        out += text.slice(token.start, tokens[close].end);
        i = close;
      } else {
        out += renderTag(token);
      }
    } else {
      out += renderTag(token);
    }
  }
  return out;
}
