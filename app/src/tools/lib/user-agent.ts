/**
 * Rule-based user agent parser. It recognises the common browsers, rendering
 * engines, operating systems, device types and well-known bots. User agent
 * strings can be faked and modern browsers deliberately reduce them, so the
 * result is a best guess; `notes` explains the known blind spots.
 * Plain TypeScript, no DOM needed.
 */

export type DeviceType = "desktop" | "mobile" | "tablet" | "tv" | "console" | "bot" | "unknown";

export interface NameVersion {
  name: string;
  version: string;
}

export interface UserAgentInfo {
  browser: NameVersion;
  engine: NameVersion;
  os: NameVersion;
  device: { type: DeviceType; vendor: string; model: string };
  bot: { name: string; category: string; version: string } | null;
  notes: string[];
}

export const DEVICE_LABELS: Record<DeviceType, string> = {
  desktop: "Desktop",
  mobile: "Mobile phone",
  tablet: "Tablet",
  tv: "Smart TV / streaming device",
  console: "Game console",
  bot: "Bot / crawler",
  unknown: "Unknown",
};

const UNKNOWN: NameVersion = { name: "", version: "" };

interface Rule {
  pattern: RegExp;
  name: string;
  category?: string;
}

/* ───────────────────────── Bots ───────────────────────── */

const SEARCH = "Search engine crawler";
const SOCIAL = "Link preview (social / chat)";
const SEO = "SEO crawler";
const AI = "AI crawler or assistant";
const MONITOR = "Monitoring / performance";
const CLIENT = "HTTP client or library";
const AUTOMATION = "Browser automation";

const BOT_RULES: Rule[] = [
  { pattern: /Googlebot-(?:Image|News|Video)\/?([\d.]*)/i, name: "Googlebot (media)", category: SEARCH },
  { pattern: /Googlebot\/?([\d.]*)/i, name: "Googlebot", category: SEARCH },
  { pattern: /Google-InspectionTool\/?([\d.]*)/i, name: "Google Search Console", category: SEARCH },
  { pattern: /(?:AdsBot-Google|Mediapartners-Google|Storebot-Google|GoogleOther|FeedFetcher-Google)\/?([\d.]*)/i, name: "Google crawler", category: SEARCH },
  { pattern: /bingbot\/?([\d.]*)/i, name: "Bingbot", category: SEARCH },
  { pattern: /(?:BingPreview|adidxbot|msnbot)\/?([\d.]*)/i, name: "Microsoft Bing crawler", category: SEARCH },
  { pattern: /DuckDuckBot(?:-Https)?\/?([\d.]*)/i, name: "DuckDuckBot", category: SEARCH },
  { pattern: /Yandex(?:Bot|Images|MobileBot|Metrika)\/?([\d.]*)/i, name: "YandexBot", category: SEARCH },
  { pattern: /Baiduspider(?:-render)?\/?([\d.]*)/i, name: "Baiduspider", category: SEARCH },
  { pattern: /Applebot(?:-Extended)?\/?([\d.]*)/i, name: "Applebot", category: SEARCH },
  { pattern: /Yahoo! Slurp/i, name: "Yahoo Slurp", category: SEARCH },
  { pattern: /(?:Sogou web spider|SeznamBot|PetalBot|Qwantbot|Exabot|MojeekBot)\/?([\d.]*)/i, name: "Search engine crawler", category: SEARCH },
  { pattern: /GPTBot\/?([\d.]*)/i, name: "OpenAI GPTBot", category: AI },
  { pattern: /(?:ChatGPT-User|OAI-SearchBot)\/?([\d.]*)/i, name: "OpenAI ChatGPT", category: AI },
  { pattern: /(?:ClaudeBot|Claude-User|Claude-SearchBot|anthropic-ai)\/?([\d.]*)/i, name: "Anthropic Claude", category: AI },
  { pattern: /(?:PerplexityBot|Perplexity-User)\/?([\d.]*)/i, name: "Perplexity", category: AI },
  { pattern: /CCBot\/?([\d.]*)/i, name: "Common Crawl", category: AI },
  { pattern: /Bytespider/i, name: "ByteDance Bytespider", category: AI },
  { pattern: /Amazonbot\/?([\d.]*)/i, name: "Amazonbot", category: AI },
  { pattern: /meta-externalagent\/?([\d.]*)/i, name: "Meta AI crawler", category: AI },
  { pattern: /(?:facebookexternalhit|Facebot|facebookcatalog)\/?([\d.]*)/i, name: "Facebook link preview", category: SOCIAL },
  { pattern: /Twitterbot\/?([\d.]*)/i, name: "X (Twitter) card bot", category: SOCIAL },
  { pattern: /LinkedInBot\/?([\d.]*)/i, name: "LinkedIn link preview", category: SOCIAL },
  { pattern: /Slackbot(?:-LinkExpanding)?[ /]?([\d.]*)/i, name: "Slackbot", category: SOCIAL },
  { pattern: /Discordbot\/?([\d.]*)/i, name: "Discordbot", category: SOCIAL },
  { pattern: /TelegramBot/i, name: "Telegram link preview", category: SOCIAL },
  { pattern: /WhatsApp\/?([\d.]*)/i, name: "WhatsApp link preview", category: SOCIAL },
  { pattern: /Pinterest(?:bot)?\/?([\d.]*)/i, name: "Pinterest", category: SOCIAL },
  { pattern: /redditbot\/?([\d.]*)/i, name: "Reddit", category: SOCIAL },
  { pattern: /SkypeUriPreview/i, name: "Skype link preview", category: SOCIAL },
  { pattern: /AhrefsBot\/?([\d.]*)/i, name: "AhrefsBot", category: SEO },
  { pattern: /SemrushBot\/?([\d.]*)/i, name: "SemrushBot", category: SEO },
  { pattern: /MJ12bot\/?v?([\d.]*)/i, name: "Majestic MJ12bot", category: SEO },
  { pattern: /DotBot\/?([\d.]*)/i, name: "Moz DotBot", category: SEO },
  { pattern: /rogerbot\/?([\d.]*)/i, name: "Moz rogerbot", category: SEO },
  { pattern: /Screaming Frog SEO Spider\/?([\d.]*)/i, name: "Screaming Frog", category: SEO },
  { pattern: /(?:serpstatbot|BLEXBot|DataForSeoBot)\/?([\d.]*)/i, name: "SEO crawler", category: SEO },
  { pattern: /Chrome-Lighthouse/i, name: "Google Lighthouse", category: MONITOR },
  { pattern: /UptimeRobot\/?([\d.]*)/i, name: "UptimeRobot", category: MONITOR },
  { pattern: /Pingdom/i, name: "Pingdom", category: MONITOR },
  { pattern: /StatusCake/i, name: "StatusCake", category: MONITOR },
  { pattern: /Site24x7/i, name: "Site24x7", category: MONITOR },
  { pattern: /GTmetrix/i, name: "GTmetrix", category: MONITOR },
  { pattern: /HeadlessChrome\/([\d.]+)/i, name: "Headless Chrome", category: AUTOMATION },
  { pattern: /PhantomJS\/([\d.]+)/i, name: "PhantomJS", category: AUTOMATION },
  { pattern: /Selenium|webdriver/i, name: "Selenium WebDriver", category: AUTOMATION },
  { pattern: /^curl\/([\d.]+)/i, name: "curl", category: CLIENT },
  { pattern: /^Wget\/([\d.]+)/i, name: "Wget", category: CLIENT },
  { pattern: /python-requests\/([\d.]+)/i, name: "Python Requests", category: CLIENT },
  { pattern: /Python-urllib\/([\d.]+)/i, name: "Python urllib", category: CLIENT },
  { pattern: /aiohttp\/([\d.]+)/i, name: "Python aiohttp", category: CLIENT },
  { pattern: /python-httpx\/([\d.]+)/i, name: "Python HTTPX", category: CLIENT },
  { pattern: /Scrapy\/([\d.]+)/i, name: "Scrapy", category: CLIENT },
  { pattern: /Go-http-client\/([\d.]+)/i, name: "Go net/http", category: CLIENT },
  { pattern: /okhttp\/([\d.]+)/i, name: "OkHttp", category: CLIENT },
  { pattern: /axios\/([\d.]+)/i, name: "Axios", category: CLIENT },
  { pattern: /node-fetch\/?([\d.]*)/i, name: "node-fetch", category: CLIENT },
  { pattern: /^undici/i, name: "Node.js fetch (undici)", category: CLIENT },
  { pattern: /PostmanRuntime\/([\d.]+)/i, name: "Postman", category: CLIENT },
  { pattern: /insomnia\/([\d.]+)/i, name: "Insomnia", category: CLIENT },
  { pattern: /Apache-HttpClient\/([\d.]+)/i, name: "Apache HttpClient", category: CLIENT },
  { pattern: /^Java\/([\d._]+)/i, name: "Java HTTP client", category: CLIENT },
  { pattern: /libwww-perl\/([\d.]+)/i, name: "Perl LWP", category: CLIENT },
  { pattern: /^GuzzleHttp\/([\d.]+)/i, name: "Guzzle (PHP)", category: CLIENT },
];

const GENERIC_BOT = /([\w.-]*(?:bot|crawler|spider|crawl|scraper|fetcher)[\w.-]*)(?:\/v?([\d.]+))?/i;

function detectBot(ua: string): UserAgentInfo["bot"] {
  for (const rule of BOT_RULES) {
    const match = rule.pattern.exec(ua);
    if (match) return { name: rule.name, category: rule.category ?? "Bot", version: match[1] ?? "" };
  }
  // "Cubot" and "Robot" phones are not crawlers.
  const generic = GENERIC_BOT.exec(ua.replace(/\b(?:Cubot|Robot)\b/gi, ""));
  return generic ? { name: generic[1], category: "Bot or crawler", version: generic[2] ?? "" } : null;
}

/* ───────────────────────── Browsers ───────────────────────── */

const BROWSER_RULES: Rule[] = [
  { pattern: /Edge\/([\d.]+)/, name: "Microsoft Edge (Legacy)" },
  { pattern: /Edg(?:A|iOS)?\/([\d.]+)/, name: "Microsoft Edge" },
  { pattern: /Opera Mini\/([\d.]+)/, name: "Opera Mini" },
  { pattern: /(?:OPR|OPiOS|OPT)\/([\d.]+)/, name: "Opera" },
  { pattern: /Opera.+Version\/([\d.]+)/, name: "Opera" },
  { pattern: /Opera[/ ]([\d.]+)/, name: "Opera" },
  { pattern: /SamsungBrowser\/([\d.]+)/, name: "Samsung Internet" },
  { pattern: /YaBrowser\/([\d.]+)/, name: "Yandex Browser" },
  { pattern: /Vivaldi\/([\d.]+)/, name: "Vivaldi" },
  { pattern: /Brave\/([\d.]+)/, name: "Brave" },
  { pattern: /(?:DuckDuckGo|Ddg)\/([\d.]+)/, name: "DuckDuckGo Browser" },
  { pattern: /UC ?Browser\/([\d.]+)/, name: "UC Browser" },
  { pattern: /HuaweiBrowser\/([\d.]+)/, name: "Huawei Browser" },
  { pattern: /MiuiBrowser\/([\d.]+)/, name: "Xiaomi Browser" },
  { pattern: /Silk\/([\d.]+)/, name: "Amazon Silk" },
  { pattern: /Instagram ([\d.]+)/, name: "Instagram in-app browser" },
  { pattern: /FBAV\/([\d.]+)/, name: "Facebook in-app browser" },
  { pattern: /FB_IAB|FBAN/, name: "Facebook in-app browser" },
  { pattern: /Line\/([\d.]+)/, name: "LINE in-app browser" },
  { pattern: /Focus\/([\d.]+)/, name: "Firefox Focus" },
  { pattern: /(?:Firefox|FxiOS)\/([\d.]+)/, name: "Firefox" },
  { pattern: /Chromium\/([\d.]+)/, name: "Chromium" },
  { pattern: /; wv\).+Chrome\/([\d.]+)/, name: "Android WebView" },
  { pattern: /(?:Chrome|CriOS)\/([\d.]+)/, name: "Chrome" },
  { pattern: /MSIE ([\d.]+)/, name: "Internet Explorer" },
  { pattern: /Trident\/.+rv:([\d.]+)/, name: "Internet Explorer" },
  { pattern: /Android.+Version\/([\d.]+).*Safari\//, name: "Android Browser" },
  { pattern: /Version\/([\d.]+).*Safari\//, name: "Safari" },
];

function detectBrowser(ua: string): NameVersion {
  for (const rule of BROWSER_RULES) {
    const match = rule.pattern.exec(ua);
    if (match) return { name: rule.name, version: match[1] ?? "" };
  }
  if (/\((?:iPhone|iPad|iPod)/.test(ua) && /AppleWebKit/.test(ua)) return { name: "iOS WebView", version: "" };
  if (/AppleWebKit/.test(ua) && /Safari\//.test(ua)) return { name: "WebKit-based browser", version: "" };
  return UNKNOWN;
}

/* ───────────────────────── Engine ───────────────────────── */

function detectEngine(ua: string, browser: NameVersion, isIos: boolean): NameVersion {
  const version = (pattern: RegExp) => pattern.exec(ua)?.[1] ?? "";
  if (browser.name === "Internet Explorer") return { name: "Trident", version: version(/Trident\/([\d.]+)/) };
  if (browser.name === "Microsoft Edge (Legacy)") return { name: "EdgeHTML", version: browser.version };
  if (/Presto\//.test(ua)) return { name: "Presto", version: version(/Presto\/([\d.]+)/) };
  // Every iOS browser must use Apple's WebKit, whatever its name.
  if (isIos) return { name: "WebKit", version: version(/AppleWebKit\/([\d.]+)/) };
  if (/Gecko\/\d/.test(ua) && /rv:/.test(ua) && !/like Gecko/.test(ua)) return { name: "Gecko", version: version(/rv:([\d.]+)/) };
  const chrome = /(?:Chrome|Chromium)\/([\d.]+)/.exec(ua);
  if (chrome) return { name: "Blink", version: chrome[1] };
  if (/AppleWebKit\//.test(ua)) return { name: "WebKit", version: version(/AppleWebKit\/([\d.]+)/) };
  return UNKNOWN;
}

/* ───────────────────────── Operating system ───────────────────────── */

const WINDOWS_VERSIONS: Record<string, string> = {
  "10.0": "10 / 11",
  "6.3": "8.1",
  "6.2": "8",
  "6.1": "7",
  "6.0": "Vista",
  "5.2": "XP x64",
  "5.1": "XP",
  "5.0": "2000",
};

function detectOs(ua: string): NameVersion {
  const match = (pattern: RegExp) => pattern.exec(ua);
  let m: RegExpExecArray | null;

  if ((m = match(/Windows Phone(?: OS)? ([\d.]+)/))) return { name: "Windows Phone", version: m[1] };
  if (/Xbox/.test(ua)) return { name: "Xbox OS", version: "" };
  if ((m = match(/Windows NT ([\d.]+)/))) return { name: "Windows", version: WINDOWS_VERSIONS[m[1]] ?? `NT ${m[1]}` };
  if (/Windows/.test(ua)) return { name: "Windows", version: "" };
  if ((m = match(/\((?:iPhone|iPod)[^)]*?OS ([\d_]+)/))) return { name: "iOS", version: m[1].replace(/_/g, ".") };
  if ((m = match(/\(iPad[^)]*?OS ([\d_]+)/))) return { name: "iPadOS", version: m[1].replace(/_/g, ".") };
  if (/\((?:iPhone|iPod|iPad)/.test(ua)) return { name: /iPad/.test(ua) ? "iPadOS" : "iOS", version: "" };
  if ((m = match(/CrOS \S+ ([\d.]+)/))) return { name: "ChromeOS", version: m[1] };
  if ((m = match(/HarmonyOS(?:[ /]([\d.]+))?/))) return { name: "HarmonyOS", version: m[1] ?? "" };
  if ((m = match(/KAIOS\/([\d.]+)/i))) return { name: "KaiOS", version: m[1] };
  if ((m = match(/Android(?: ([\d.]+))?/))) return { name: "Android", version: m[1] ?? "" };
  if ((m = match(/Tizen[ /]([\d.]+)/))) return { name: "Tizen", version: m[1] };
  if (/Web0S|webOS/.test(ua)) return { name: "webOS", version: "" };
  if ((m = match(/PlayStation (\d|Vita)/))) return { name: "PlayStation", version: m[1] };
  if (/Nintendo/.test(ua)) return { name: "Nintendo", version: "" };
  if ((m = match(/Mac OS X ([\d_.]+)/))) return { name: "macOS", version: m[1].replace(/_/g, ".") };
  if (/Macintosh|Mac OS X/.test(ua)) return { name: "macOS", version: "" };
  if (/Ubuntu/.test(ua)) return { name: "Ubuntu Linux", version: "" };
  if (/Fedora/.test(ua)) return { name: "Fedora Linux", version: "" };
  if (/Debian/.test(ua)) return { name: "Debian Linux", version: "" };
  if ((m = match(/(FreeBSD|OpenBSD|NetBSD)/))) return { name: m[1], version: "" };
  if (/Linux|X11/.test(ua)) return { name: "Linux", version: "" };
  return UNKNOWN;
}

/* ───────────────────────── Device ───────────────────────── */

const VENDOR_RULES: Array<[RegExp, string]> = [
  [/^(?:SM-|GT-|SCH-|SGH-|SAMSUNG|Galaxy)/i, "Samsung"],
  [/^Pixel|^Nexus/i, "Google"],
  [/^(?:Redmi|POCO|Mi |MI |Xiaomi|M2\d{3}|2\d{3}[A-Z0-9]{4,})/i, "Xiaomi"],
  [/^RMX/i, "realme"],
  [/^(?:CPH|OPPO)/i, "OPPO"],
  [/^(?:ONEPLUS|OnePlus)/i, "OnePlus"],
  [/^(?:vivo|V\d{4}[A-Z]?$)/i, "vivo"],
  [/^(?:moto|XT\d{4})/i, "Motorola"],
  [/^(?:HUAWEI|VOG-|ELS-|ANA-|LYA-|MAR-|NOH-)/i, "Huawei"],
  [/^(?:HONOR|HRY-)/i, "Honor"],
  [/^(?:LG|LM-)/i, "LG"],
  [/^Nokia/i, "Nokia"],
  [/^(?:SO-|XQ-|Xperia)/i, "Sony"],
  [/^(?:KF[A-Z]{2,4}|Kindle)/, "Amazon"],
  [/^Lenovo/i, "Lenovo"],
  [/^ASUS/i, "ASUS"],
  [/^(?:TECNO|Infinix|itel)/i, "Transsion"],
];

const LOCALE = /^[a-z]{2}(?:[-_][a-z]{2})?$/i;

/** The model name from "(Linux; Android 14; Pixel 8 Build/AP1A)". */
function androidModel(ua: string): string {
  const platform = /\(([^)]*Android[^)]*)\)/.exec(ua)?.[1];
  if (!platform) return "";
  const tokens = platform.split(";").map((t) => t.trim());
  const android = tokens.findIndex((t) => t.startsWith("Android"));
  for (const token of tokens.slice(android + 1)) {
    if (!token || token === "U" || token === "wv" || token === "Mobile" || LOCALE.test(token)) continue;
    return token.replace(/\s*Build\/.*$/, "").trim();
  }
  return "";
}

function detectDevice(ua: string, os: NameVersion, isBot: boolean): UserAgentInfo["device"] {
  let type: DeviceType = "unknown";
  if (isBot) type = "bot";
  else if (/SmartTV|SMART-TV|Smart TV|HbbTV|NetCast|Web0S|AppleTV|GoogleTV|Android TV|BRAVIA|CrKey|Roku|AFT[A-Z]|Tizen.+TV/i.test(ua)) type = "tv";
  else if (/PlayStation|Xbox|Nintendo/i.test(ua)) type = "console";
  else if (/iPad|Tablet|Kindle|Silk|PlayBook/i.test(ua) || (os.name === "Android" && !/Mobile/.test(ua))) type = "tablet";
  else if (/Mobi|iPhone|iPod|Windows Phone|IEMobile|Opera Mini|BlackBerry|KAIOS/i.test(ua)) type = "mobile";
  else if (["Windows", "macOS", "ChromeOS", "Linux", "Ubuntu Linux", "Fedora Linux", "Debian Linux", "FreeBSD", "OpenBSD", "NetBSD"].includes(os.name)) {
    type = "desktop";
  }

  const apple = /\((iPhone|iPad|iPod)/.exec(ua)?.[1];
  if (apple) return { type, vendor: "Apple", model: apple };
  if (os.name === "macOS") return { type, vendor: "Apple", model: "Mac" };
  if (os.name === "Android" || os.name === "HarmonyOS") {
    const model = androidModel(ua);
    // Chrome's reduced user agent replaces the model with "K".
    if (!model || model === "K") return { type, vendor: "", model: "" };
    const vendor = VENDOR_RULES.find(([pattern]) => pattern.test(model))?.[1] ?? "";
    return { type, vendor, model: model.replace(/^SAMSUNG\s+/i, "") };
  }
  return { type, vendor: "", model: "" };
}

/* ───────────────────────── Public API ───────────────────────── */

export function parseUserAgent(input: string): UserAgentInfo {
  const ua = input.trim();
  const bot = ua ? detectBot(ua) : null;
  const os = detectOs(ua);
  const browser = detectBrowser(ua);
  const isIos = os.name === "iOS" || os.name === "iPadOS";
  const engine = detectEngine(ua, browser, isIos);
  const device = detectDevice(ua, os, bot !== null);

  const notes: string[] = [];
  if (browser.name === "Chrome" && !bot) {
    notes.push("Brave, Arc and several other Chromium browsers send exactly the same user agent as Chrome, so they appear as Chrome here.");
  }
  if (/^\d+\.0\.0\.0$/.test(browser.version)) {
    notes.push("The browser reports only its major version (the rest is zeros) to reduce fingerprinting.");
  }
  if (os.name === "Windows" && os.version === "10 / 11") {
    notes.push("Windows 11 still identifies itself as Windows NT 10.0, so Windows 10 and 11 look the same in the user agent.");
  }
  if (os.name === "macOS" && os.version.startsWith("10.15")) {
    notes.push("Browsers freeze the macOS version at 10.15.7, so newer macOS releases look the same. iPads may also identify as a Mac.");
  }
  if (os.name === "Android" && androidModel(ua) === "K") {
    notes.push("The device model is hidden by the browser's reduced user agent.");
  }
  if (isIos && browser.name !== "Safari") {
    notes.push("All browsers on iPhone and iPad use Apple's WebKit engine.");
  }
  if (bot?.category === SEARCH) {
    notes.push("Anyone can copy a crawler's user agent. To confirm a real search engine bot, verify its IP address with a reverse DNS lookup.");
  }

  return { browser, engine, os, device, bot, notes };
}
