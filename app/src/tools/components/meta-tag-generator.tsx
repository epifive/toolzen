"use client";

import { useEffect, useMemo, useState } from "react";
import { OutputBox, Panel, ToolColumns } from "@/components/tool-ui";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { useTool } from "@/tools/context";
import { buildMetaTags, isHttpUrl, normalizeSpace, truncateText, urlBreadcrumb, type MetaTagInput } from "@/tools/lib/seo";

const TITLE_RANGE: [number, number] = [50, 60];
const DESCRIPTION_RANGE: [number, number] = [120, 160];
const HEX_COLOR = /^#[\da-f]{6}$/i;

const INITIAL: MetaTagInput = {
  title: "",
  description: "",
  keywords: "",
  author: "",
  canonical: "",
  index: true,
  follow: true,
  viewport: "width=device-width, initial-scale=1",
  charset: "UTF-8",
  language: "en",
  themeColor: "",
};

/** Character counter that turns green inside the ideal range. */
function LengthHint({ id, length, range }: { id: string; length: number; range: [number, number] }) {
  const [min, max] = range;
  const status = length === 0 ? "" : length < min ? "Too short" : length > max ? "Too long" : "Ideal length";
  return (
    <p id={id} className="mt-1.5 flex justify-between gap-2 text-xs text-muted">
      <span>
        Recommended: {min}–{max} characters
      </span>
      <span
        className={cn(
          "tabular-nums",
          status === "Ideal length" && "text-emerald-700 dark:text-emerald-400",
          (status === "Too short" || status === "Too long") && "text-amber-700 dark:text-amber-400",
        )}
      >
        {length} characters{status ? ` · ${status}` : ""}
      </span>
    </p>
  );
}

function SerpPreview({ title, description, url }: { title: string; description: string; url: string }) {
  const site = isHttpUrl(url) ? new URL(url).hostname.replace(/^www\./, "") : "example.com";
  return (
    <div className="rounded-lg border border-line bg-white p-4 font-[arial,sans-serif] dark:bg-[#202124]">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-full bg-[#f1f3f4] text-xs font-semibold text-[#5f6368] uppercase dark:bg-[#303134] dark:text-[#bdc1c6]"
        >
          {site.charAt(0)}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm text-[#202124] dark:text-[#dadce0]">{site}</p>
          <p className="truncate text-xs text-[#4d5156] dark:text-[#bdc1c6]">
            {isHttpUrl(url) ? urlBreadcrumb(url) : "https://example.com › page"}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xl leading-snug break-words text-[#1a0dab] dark:text-[#8ab4f8]">
        {title ? truncateText(title, 60) : "Your page title appears here"}
      </p>
      <p className="mt-1 text-sm leading-relaxed break-words text-[#4d5156] dark:text-[#bdc1c6]">
        {description
          ? truncateText(description, 160)
          : "Your meta description appears here. Summarise the page in one or two sentences that make people want to click."}
      </p>
    </div>
  );
}

export default function MetaTagGenerator() {
  const { track } = useTool();
  const [input, setInput] = useState<MetaTagInput>(INITIAL);
  const set = <K extends keyof MetaTagInput>(key: K, value: MetaTagInput[K]) => setInput((prev) => ({ ...prev, [key]: value }));

  const html = useMemo(() => buildMetaTags(input), [input]);
  const titleLength = normalizeSpace(input.title).length;
  const descriptionLength = normalizeSpace(input.description).length;
  const canonicalInvalid = input.canonical.trim() !== "" && !isHttpUrl(input.canonical.trim());
  const colorInvalid = input.themeColor.trim() !== "" && !/^#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(input.themeColor.trim());
  const hasContent = Boolean(input.title.trim() || input.description.trim());

  useEffect(() => {
    if (hasContent) track();
  }, [hasContent, html, track]);

  return (
    <ToolColumns>
      <Panel title="Page details">
        <div className="space-y-4">
          <div>
            <Field label="Title" htmlFor="mt-title">
              <Input
                id="mt-title"
                value={input.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Handmade Leather Wallets | Acme Goods"
                aria-describedby="mt-title-length"
              />
            </Field>
            <LengthHint id="mt-title-length" length={titleLength} range={TITLE_RANGE} />
          </div>
          <div>
            <Field label="Description" htmlFor="mt-description">
              <Textarea
                id="mt-description"
                rows={3}
                value={input.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Shop slim, durable leather wallets crafted by hand. Free shipping and a lifetime warranty on every order."
                aria-describedby="mt-description-length"
              />
            </Field>
            <LengthHint id="mt-description-length" length={descriptionLength} range={DESCRIPTION_RANGE} />
          </div>
          <Field
            label="Keywords"
            htmlFor="mt-keywords"
            hint="Comma-separated. Google ignores this tag, but some other search engines and site tools read it."
          >
            <Input
              id="mt-keywords"
              value={input.keywords}
              onChange={(e) => set("keywords", e.target.value)}
              placeholder="leather wallet, slim wallet, handmade"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Author" htmlFor="mt-author">
              <Input id="mt-author" value={input.author} onChange={(e) => set("author", e.target.value)} placeholder="Jane Doe" />
            </Field>
            <Field
              label="Canonical URL"
              htmlFor="mt-canonical"
              hint={canonicalInvalid ? "Use a full URL starting with https://" : undefined}
            >
              <Input
                id="mt-canonical"
                type="url"
                inputMode="url"
                value={input.canonical}
                onChange={(e) => set("canonical", e.target.value)}
                placeholder="https://example.com/wallets"
                aria-invalid={canonicalInvalid}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Search engine indexing" htmlFor="mt-index">
              <Select
                id="mt-index"
                value={input.index ? "index" : "noindex"}
                onChange={(e) => set("index", e.target.value === "index")}
              >
                <option value="index">index – show in search results</option>
                <option value="noindex">noindex – keep out of results</option>
              </Select>
            </Field>
            <Field label="Links on this page" htmlFor="mt-follow">
              <Select
                id="mt-follow"
                value={input.follow ? "follow" : "nofollow"}
                onChange={(e) => set("follow", e.target.value === "follow")}
              >
                <option value="follow">follow – crawl the links</option>
                <option value="nofollow">nofollow – don&apos;t follow links</option>
              </Select>
            </Field>
          </div>
          <Field label="Viewport" htmlFor="mt-viewport">
            <Input id="mt-viewport" value={input.viewport} onChange={(e) => set("viewport", e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Character set" htmlFor="mt-charset">
              <Select id="mt-charset" value={input.charset} onChange={(e) => set("charset", e.target.value)}>
                <option value="UTF-8">UTF-8</option>
                <option value="ISO-8859-1">ISO-8859-1</option>
                <option value="windows-1252">windows-1252</option>
                <option value="">None</option>
              </Select>
            </Field>
            <Field label="Language" htmlFor="mt-language" hint="Also set lang on your <html> tag.">
              <Input id="mt-language" value={input.language} onChange={(e) => set("language", e.target.value)} placeholder="en" />
            </Field>
            <Field label="Theme colour" htmlFor="mt-theme" hint={colorInvalid ? "Use a hex colour such as #17785f." : undefined}>
              <div className="flex gap-2">
                <input
                  type="color"
                  aria-label="Pick theme colour"
                  value={HEX_COLOR.test(input.themeColor.trim()) ? input.themeColor.trim() : "#000000"}
                  onChange={(e) => set("themeColor", e.target.value)}
                  className="h-10 w-11 shrink-0 cursor-pointer rounded-lg border border-line bg-surface p-1"
                />
                <Input
                  id="mt-theme"
                  value={input.themeColor}
                  onChange={(e) => set("themeColor", e.target.value)}
                  placeholder="#17785f"
                  aria-invalid={colorInvalid}
                />
              </div>
            </Field>
          </div>
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel title="Google search preview">
          <SerpPreview title={input.title} description={input.description} url={input.canonical.trim()} />
          <p className="mt-2 text-xs text-muted">
            Google cuts titles at about 600 pixels (≈ 60 characters) and descriptions at about 160 characters.
          </p>
        </Panel>
        <OutputBox value={html} label="HTML for your <head>" filename="meta-tags.html" mono rows={12} />
      </div>
    </ToolColumns>
  );
}
