import "server-only";
import { fetchFollow, parsePublicUrl, ToolInputError, type FetchedResponse, type Hop } from "./net";

export interface HtmlPage {
  url: URL;
  hops: Hop[];
  final: FetchedResponse;
  /** Total time across all redirects. */
  timeMs: number;
}

/** Fetches a visitor-supplied URL (following redirects safely) and makes sure it is an HTML page. */
export async function fetchHtmlPage(input: string, maxBytes = 1_500_000): Promise<HtmlPage> {
  const url = parsePublicUrl(input);
  const { hops, final } = await fetchFollow(url, { maxRedirects: 10, maxBytes });
  if (final.status >= 400) {
    throw new ToolInputError(`The page returned HTTP ${final.status}${final.statusText ? ` ${final.statusText}` : ""}.`);
  }
  const type = final.headers["content-type"] ?? "";
  if (type && !/html|xml/i.test(type)) {
    throw new ToolInputError(`That URL returned ${type.split(";")[0].trim()}, not an HTML page.`);
  }
  return { url, hops, final, timeMs: hops.reduce((sum, hop) => sum + hop.timeMs, 0) };
}
