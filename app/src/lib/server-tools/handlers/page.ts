import "server-only";
import { z } from "zod";
import type { LinkResult, MetaResult, RobotsResult } from "@/tools/lib/server-types";
import { fetchHtmlPage } from "../fetch-page";
import type { ServerToolHandler } from "../index";
import { parseInput, textField } from "../input";
import { fetchFollow, parsePublicUrl } from "../net";
import { analyzeMeta, extractLinks } from "../page-analysis";

const MAX_LINKS = 500;
/** Google ignores robots.txt content beyond 500 KiB. */
const ROBOTS_MAX_BYTES = 512_000;

const urlInput = z.object({ url: textField("Enter a URL, e.g. https://example.com.") });

const metaTagsAnalyzer: ServerToolHandler = async (input) => {
  const { url, final, timeMs } = await fetchHtmlPage(parseInput(urlInput, input).url);
  const result: MetaResult = {
    url: url.toString(),
    finalUrl: final.url,
    status: final.status,
    timeMs,
    truncated: final.truncated,
    ...analyzeMeta(final.body, final.url),
  };
  return result;
};

const linkExtractor: ServerToolHandler = async (input) => {
  const { url, final } = await fetchHtmlPage(parseInput(urlInput, input).url);
  const result: LinkResult = { url: url.toString(), finalUrl: final.url, ...extractLinks(final.body, final.url, MAX_LINKS) };
  return result;
};

const robotsTxtTester: ServerToolHandler = async (input) => {
  const site = parsePublicUrl(parseInput(urlInput, input).url);
  const robotsUrl = new URL("/robots.txt", site.origin);
  const { final } = await fetchFollow(robotsUrl, { maxBytes: ROBOTS_MAX_BYTES });

  const state: RobotsResult["state"] = final.status < 300 ? "found" : final.status >= 500 ? "error" : "missing";
  const result: RobotsResult = {
    robotsUrl: robotsUrl.toString(),
    status: final.status,
    state,
    content: state === "found" ? final.body : "",
    truncated: state === "found" && final.truncated,
  };
  return result;
};

export const PAGE_HANDLERS: Record<string, ServerToolHandler> = {
  "meta-tags-analyzer": metaTagsAnalyzer,
  "link-extractor": linkExtractor,
  "robots-txt-tester": robotsTxtTester,
};
