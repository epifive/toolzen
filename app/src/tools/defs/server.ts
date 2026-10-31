import type { ToolDefinition } from "../registry";

/** Standard FAQ answer for tools that contact the site the visitor enters. */
const SERVER_REQUEST =
  "Our server sends a request to the site you enter and shows you what came back. Nothing is stored, and the site sees our server, not you.";

/** Standard FAQ answer for tools that query public DNS. */
const DNS_REQUEST =
  "Our server asks public DNS resolvers (Cloudflare 1.1.1.1 and Google 8.8.8.8) and shows you the answer. Nothing is stored.";

export const SERVER_TOOLS: ToolDefinition[] = [
  {
    slug: "dns-lookup",
    name: "DNS Lookup",
    category: "seo",
    icon: "network",
    description: "Look up A, AAAA, CNAME, MX, TXT, NS, SOA, CAA and SRV records for any domain.",
    keywords: ["dns lookup", "dns checker", "mx lookup", "txt record", "nameserver lookup", "dns records"],
    steps: [
      "Enter a domain name such as example.com.",
      "Pick a record type, or keep \"All record types\".",
      "Read the records and copy them as zone-file lines.",
    ],
    faq: [
      { q: "How does the lookup work?", a: DNS_REQUEST },
      {
        q: "Why don't I see my new DNS change?",
        a: "Resolvers cache records for the TTL shown next to them. Changes appear once the old record's TTL has run out.",
      },
      { q: "Can I look up SPF or DMARC records?", a: "Yes. SPF is a TXT record on the domain; for DMARC enter _dmarc.example.com." },
    ],
    featured: true,
  },
  {
    slug: "whois-lookup",
    name: "WHOIS Lookup",
    category: "seo",
    icon: "globe",
    description: "Find a domain's registrar, registration and expiry dates, status and name servers.",
    keywords: ["whois lookup", "domain whois", "domain age checker", "domain expiry", "rdap lookup", "who owns a domain"],
    steps: [
      "Enter a domain name.",
      "See the registrar, important dates, domain age and status codes.",
      "Open the raw registry data if you need every detail.",
    ],
    faq: [
      {
        q: "Where does the data come from?",
        a: "Our server queries the domain's registry over RDAP, the modern replacement for WHOIS, and shows you the answer. Nothing is stored.",
      },
      {
        q: "Why is the owner's name missing?",
        a: "Most registries hide personal contact details for privacy (GDPR). Contact the registrar's abuse address shown in the results instead.",
      },
      {
        q: "Does it work for every domain extension?",
        a: "It works for all generic domains (.com, .net, .org, new gTLDs) and most country domains. A few country registries don't publish RDAP data yet.",
      },
    ],
  },
  {
    slug: "ssl-checker",
    name: "SSL Certificate Checker",
    category: "seo",
    icon: "shield-check",
    description: "Check a site's SSL/TLS certificate: issuer, expiry date, covered names, chain and protocol.",
    keywords: ["ssl checker", "ssl certificate check", "https checker", "certificate expiry", "tls checker"],
    steps: [
      "Enter a domain name.",
      "See whether the certificate is valid, trusted and covers the domain.",
      "Review the expiry date, names covered and certificate chain.",
    ],
    faq: [
      { q: "How does the check work?", a: `${SERVER_REQUEST} We connect to port 443 and read the certificate the server presents.` },
      {
        q: "What does \"not trusted\" mean?",
        a: "Browsers can't link the certificate to a trusted authority. It is usually self-signed or missing an intermediate certificate on the server.",
      },
      { q: "When should I renew?", a: "Most certificates renew automatically 30 days before expiry. Check the setup if fewer than 30 days remain." },
    ],
  },
  {
    slug: "http-headers-checker",
    name: "HTTP Headers Checker",
    category: "seo",
    icon: "list-checks",
    description: "See a URL's HTTP response headers and check its security headers.",
    keywords: ["http headers checker", "response headers", "security headers", "hsts check", "csp checker"],
    steps: [
      "Enter a URL.",
      "Choose whether to follow redirects.",
      "Review the status code, every response header and the security header checklist.",
    ],
    faq: [
      { q: "Is my request private?", a: SERVER_REQUEST },
      {
        q: "Which security headers matter most?",
        a: "Strict-Transport-Security, Content-Security-Policy and X-Content-Type-Options give the most protection; X-Frame-Options, Referrer-Policy and Permissions-Policy add more.",
      },
    ],
  },
  {
    slug: "redirect-checker",
    name: "Redirect Checker",
    category: "seo",
    icon: "route",
    description: "Trace every redirect of a URL with status codes and timings, and spot loops.",
    keywords: ["redirect checker", "301 checker", "redirect chain", "redirect loop", "http to https redirect"],
    steps: [
      "Enter a URL, for example the http:// or non-www version of your site.",
      "Follow the chain step by step with each status code and response time.",
      "Fix loops, long chains and temporary redirects that should be permanent.",
    ],
    faq: [
      { q: "Is my request private?", a: SERVER_REQUEST },
      {
        q: "Which redirect should I use?",
        a: "301 or 308 for permanent moves, so search engines transfer rankings. 302 and 307 are for temporary moves.",
      },
      { q: "How many redirects are too many?", a: "Keep it to one. Every extra hop slows the page, and crawlers stop after about 5 to 10." },
    ],
  },
  {
    slug: "website-status-checker",
    name: "Website Status Checker",
    category: "seo",
    icon: "activity",
    description: "Is a website down or just you? Check its status code, response time and page title.",
    keywords: ["is it down", "website down checker", "site status", "uptime check", "is website up"],
    steps: ["Enter the website address.", "Click Check status.", "See whether the site is up, its status code and how fast it answered."],
    faq: [
      { q: "Is my request private?", a: SERVER_REQUEST },
      {
        q: "The site is up here but not for me. Why?",
        a: "Your connection, DNS cache, firewall or a regional outage may be the problem. Try another network or flush your DNS cache.",
      },
    ],
    featured: true,
  },
  {
    slug: "meta-tags-analyzer",
    name: "Meta Tags Analyzer",
    category: "seo",
    icon: "scan-search",
    description: "Audit a page's title, description, headings, Open Graph and other SEO tags, with a score and tips.",
    keywords: ["meta tags analyzer", "seo checker", "on page seo", "seo audit", "open graph checker", "meta description checker"],
    steps: [
      "Enter the URL of a page.",
      "Review the SEO score and the recommendations.",
      "Check the meta tags, headings and social tags in detail and fix what's missing.",
    ],
    faq: [
      { q: "Is my request private?", a: SERVER_REQUEST },
      {
        q: "How is the score calculated?",
        a: "Each of the 13 checks counts equally: a pass scores fully, a warning half and a failure nothing.",
      },
      {
        q: "Why are my tags missing when I can see them in the browser?",
        a: "The analyzer reads the HTML the server sends. Tags added later by JavaScript are not visible to it, and some search engines may miss them too.",
      },
    ],
    featured: true,
  },
  {
    slug: "what-is-my-ip",
    name: "What Is My IP",
    category: "seo",
    icon: "map-pin",
    description: "See your public IP address, IP version, reverse DNS hostname and browser user agent.",
    keywords: ["what is my ip", "my ip address", "public ip", "ip checker", "my user agent"],
    steps: ["Open the tool; your IP address appears straight away.", "Copy it with one click.", "Press Refresh after switching networks or VPNs."],
    faq: [
      {
        q: "Is my IP address stored?",
        a: "No. It is read from your request to show it back to you and is not saved by this tool.",
      },
      { q: "Why is the address different from my computer's?", a: "Your router or VPN shares one public address between devices; websites only see that public address." },
    ],
  },
  {
    slug: "page-size-checker",
    name: "Page Size Checker",
    category: "seo",
    icon: "gauge",
    description: "Measure a page's HTML size, compression, response time and the scripts, styles and images it loads.",
    keywords: ["page size checker", "website size", "page weight", "html size", "gzip checker"],
    steps: ["Enter the URL of a page.", "See the HTML size, compression and response time.", "Review the largest files hosted on the same site."],
    faq: [
      { q: "Is my request private?", a: SERVER_REQUEST },
      {
        q: "Why isn't the full page weight shown?",
        a: "To stay fast, only up to 25 files on the same site are measured. Files from CDNs and other domains are counted but not downloaded.",
      },
    ],
  },
  {
    slug: "link-extractor",
    name: "Link Extractor",
    category: "seo",
    icon: "link",
    description: "List every link on a page with its anchor text, internal or external type and nofollow status.",
    keywords: ["link extractor", "extract links", "url extractor", "nofollow checker", "outbound links"],
    steps: ["Enter the URL of a page.", "Filter internal, external or nofollow links, or search them.", "Copy the URLs or download a CSV."],
    faq: [
      { q: "Is my request private?", a: SERVER_REQUEST },
      { q: "Is there a limit?", a: "The tool lists up to 500 links per page and tells you when a page has more." },
    ],
  },
  {
    slug: "robots-txt-tester",
    name: "Robots.txt Tester",
    category: "seo",
    icon: "file-check",
    description: "Fetch a site's robots.txt and test whether Googlebot and other crawlers may crawl a URL.",
    keywords: ["robots.txt tester", "robots.txt checker", "is url blocked", "googlebot blocked", "robots validator"],
    steps: [
      "Enter a website address to fetch its robots.txt.",
      "Choose a crawler and type a path or URL.",
      "See whether it is allowed and which rule decides it.",
    ],
    faq: [
      { q: "Is my request private?", a: SERVER_REQUEST },
      {
        q: "Which rules are applied?",
        a: "Google's rules: the crawler uses its most specific user-agent group, the longest matching rule wins, Allow wins a tie, and * and $ wildcards are supported.",
      },
    ],
  },
  {
    slug: "reverse-dns-lookup",
    name: "Reverse DNS Lookup",
    category: "seo",
    icon: "server-cog",
    description: "Find the hostname of an IPv4 or IPv6 address and check that it resolves back (FCrDNS).",
    keywords: ["reverse dns lookup", "ptr lookup", "ip to hostname", "rdns check", "fcrdns"],
    steps: ["Enter an IP address.", "Click Look up.", "See its PTR hostnames and whether they resolve back to the same IP."],
    faq: [
      { q: "How does the lookup work?", a: DNS_REQUEST },
      {
        q: "Why does reverse DNS matter?",
        a: "Mail servers check that a sending IP has a PTR record that resolves back to it. Without one, email is more likely to be marked as spam.",
      },
    ],
  },
];
