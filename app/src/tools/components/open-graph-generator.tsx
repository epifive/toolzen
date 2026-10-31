"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageIcon } from "lucide-react";
import { OutputBox, Panel, Segmented, ToolColumns } from "@/components/tool-ui";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { useTool } from "@/tools/context";
import { buildOpenGraphTags, isHttpUrl, truncateText, type OgType, type OpenGraphInput, type TwitterCard } from "@/tools/lib/seo";

const INITIAL: OpenGraphInput = {
  title: "",
  description: "",
  url: "",
  image: "",
  imageAlt: "",
  type: "website",
  siteName: "",
  twitterCard: "summary_large_image",
  twitterSite: "",
};

const FALLBACK = {
  title: "Your page title",
  description: "A short description of the page that encourages people to click the link.",
};

function hostOf(url: string): string {
  return isHttpUrl(url) ? new URL(url).hostname.replace(/^www\./, "") : "example.com";
}

/** The share image, or a neutral placeholder when there is no usable image. */
function ShareImage({
  src,
  alt,
  className,
  onError,
}: {
  src: string | null;
  alt: string;
  className?: string;
  onError: () => void;
}) {
  if (!src) {
    return (
      <div className={cn("grid place-items-center bg-paper text-muted", className)}>
        <span className="flex flex-col items-center gap-1 text-xs">
          <ImageIcon className="size-6" aria-hidden />
          1200 × 630 image
        </span>
      </div>
    );
  }
  return (
    // The preview shows an arbitrary, user-supplied URL, so next/image optimisation can't be used here.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} onError={onError} className={cn("object-cover", className)} referrerPolicy="no-referrer" />
  );
}

export default function OpenGraphGenerator() {
  const { track } = useTool();
  const [input, setInput] = useState<OpenGraphInput>(INITIAL);
  const [brokenImage, setBrokenImage] = useState("");
  const set = <K extends keyof OpenGraphInput>(key: K, value: OpenGraphInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  const tags = useMemo(() => buildOpenGraphTags(input), [input]);
  const image = input.image.trim();
  const imageInvalid = image !== "" && !isHttpUrl(image);
  const urlInvalid = input.url.trim() !== "" && !isHttpUrl(input.url.trim());
  const previewImage = image && !imageInvalid && brokenImage !== image ? image : null;
  const host = hostOf(input.url.trim());
  const title = input.title.trim() || FALLBACK.title;
  const description = input.description.trim() || FALLBACK.description;
  const hasContent = Boolean(input.title.trim() || input.description.trim());
  const markBroken = () => setBrokenImage(image);

  useEffect(() => {
    if (hasContent) track();
  }, [hasContent, tags, track]);

  return (
    <ToolColumns>
      <Panel title="Share details">
        <div className="space-y-4">
          <Field
            label="Title (og:title)"
            htmlFor="og-title"
            hint={`${input.title.trim().length} characters · keep it under about 60`}
          >
            <Input
              id="og-title"
              value={input.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="The 10 best hiking trails in Colorado"
            />
          </Field>
          <Field
            label="Description (og:description)"
            htmlFor="og-description"
            hint={`${input.description.trim().length} characters · 2 short sentences work best`}
          >
            <Textarea
              id="og-description"
              rows={3}
              value={input.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="From easy lakeside loops to challenging 14ers, these trails show off the best of the Rockies."
            />
          </Field>
          <Field
            label="Page URL (og:url)"
            htmlFor="og-url"
            hint={urlInvalid ? "Use a full URL starting with https://" : undefined}
          >
            <Input
              id="og-url"
              type="url"
              inputMode="url"
              value={input.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://example.com/hiking-trails"
              aria-invalid={urlInvalid}
            />
          </Field>
          <Field
            label="Image URL (og:image)"
            htmlFor="og-image"
            hint={
              imageInvalid
                ? "Use a full image URL starting with https://"
                : brokenImage && brokenImage === image
                  ? "This image could not be loaded. Check that the URL is public."
                  : "1200 × 630 px (1.91:1) works on every network."
            }
          >
            <Input
              id="og-image"
              type="url"
              inputMode="url"
              value={input.image}
              onChange={(e) => set("image", e.target.value)}
              placeholder="https://example.com/images/trails.jpg"
              aria-invalid={imageInvalid}
            />
          </Field>
          <Field label="Image description (alt text)" htmlFor="og-image-alt">
            <Input
              id="og-image-alt"
              value={input.imageAlt}
              onChange={(e) => set("imageAlt", e.target.value)}
              placeholder="Hikers on a mountain ridge at sunrise"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type (og:type)" htmlFor="og-type">
              <Select id="og-type" value={input.type} onChange={(e) => set("type", e.target.value as OgType)}>
                <option value="website">website</option>
                <option value="article">article</option>
                <option value="product">product</option>
              </Select>
            </Field>
            <Field label="Site name (og:site_name)" htmlFor="og-site">
              <Input
                id="og-site"
                value={input.siteName}
                onChange={(e) => set("siteName", e.target.value)}
                placeholder="Trail Notes"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">X card type</p>
              <Segmented<TwitterCard>
                label="X card type"
                value={input.twitterCard}
                onChange={(v) => set("twitterCard", v)}
                options={[
                  { value: "summary_large_image", label: "Large image" },
                  { value: "summary", label: "Summary" },
                ]}
              />
            </div>
            <Field label="X username (twitter:site)" htmlFor="og-twitter">
              <Input
                id="og-twitter"
                value={input.twitterSite}
                onChange={(e) => set("twitterSite", e.target.value)}
                placeholder="@trailnotes"
              />
            </Field>
          </div>
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel title="Facebook & LinkedIn preview">
          <div className="overflow-hidden rounded-lg border border-line">
            <ShareImage src={previewImage} alt={input.imageAlt} onError={markBroken} className="aspect-[1.91/1] w-full" />
            <div className="border-t border-line bg-paper px-3 py-2.5">
              <p className="truncate text-xs text-muted uppercase">{host}</p>
              <p className="mt-0.5 line-clamp-2 font-semibold break-words text-ink">{title}</p>
              <p className="mt-0.5 line-clamp-1 text-sm break-words text-muted">{description}</p>
            </div>
          </div>
        </Panel>

        <Panel title="X (Twitter) preview">
          {input.twitterCard === "summary_large_image" ? (
            <div>
              <div className="relative overflow-hidden rounded-2xl border border-line">
                <ShareImage src={previewImage} alt={input.imageAlt} onError={markBroken} className="aspect-[1.91/1] w-full" />
                <span className="absolute bottom-2 left-2 max-w-[80%] truncate rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
                  {truncateText(title, 70)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">From {host}</p>
            </div>
          ) : (
            <div className="flex overflow-hidden rounded-2xl border border-line">
              <ShareImage
                src={previewImage}
                alt={input.imageAlt}
                onError={markBroken}
                className="aspect-square w-24 shrink-0 border-r border-line sm:w-32"
              />
              <div className="min-w-0 px-3 py-2.5">
                <p className="truncate text-xs text-muted">{host}</p>
                <p className="mt-0.5 line-clamp-1 text-sm font-medium break-words text-ink">{title}</p>
                <p className="mt-0.5 line-clamp-2 text-sm break-words text-muted">{description}</p>
              </div>
            </div>
          )}
        </Panel>

        <OutputBox value={tags} label="Meta tags" filename="open-graph-tags.html" mono rows={12} />
      </div>
    </ToolColumns>
  );
}
