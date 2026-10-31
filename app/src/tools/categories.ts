export const CATEGORY_SLUGS = ["image", "pdf", "text", "developer", "converter", "seo", "calculator"] as const;

export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export interface CategoryDefinition {
  slug: CategorySlug;
  name: string;
  /** Short line used on cards and in menus. */
  summary: string;
  /** Longer intro used on the category page and as its meta description. */
  description: string;
  /** Tailwind color utility suffix, e.g. `cat-image` → `text-cat-image`. */
  color: string;
}

export const CATEGORIES: CategoryDefinition[] = [
  {
    slug: "image",
    name: "Image tools",
    summary: "Compress, resize, convert and edit images",
    description:
      "Free online image tools to compress, resize, crop, convert and edit JPG, PNG and WebP images, make memes and view EXIF data. Everything runs in your browser, so your photos stay private.",
    color: "cat-image",
  },
  {
    slug: "pdf",
    name: "PDF tools",
    summary: "Merge, split, rotate and convert PDFs",
    description:
      "Free online PDF tools to merge, split, rotate, organize, sign, watermark and convert PDF files. No uploads, no sign-up: your documents are processed on your device.",
    color: "cat-pdf",
  },
  {
    slug: "text",
    name: "Text tools",
    summary: "Count, clean, compare and transform text",
    description:
      "Free online text tools to count words and characters, change case, remove duplicates, compare text, generate fancy text and more. Paste your text and get results instantly.",
    color: "cat-text",
  },
  {
    slug: "developer",
    name: "Developer tools",
    summary: "Format, encode, decode and generate code",
    description:
      "Free online developer tools: JSON, XML, YAML, HTML, CSS and JavaScript formatters and converters, Base64 and URL encoders, hash and UUID generators, JWT decoder, cron generator, regex tester and more.",
    color: "cat-developer",
  },
  {
    slug: "converter",
    name: "Converters",
    summary: "Convert units, number systems and encodings",
    description:
      "Free online converters for length, weight, temperature, data size and more, plus text to binary, hex, Morse code and other encodings.",
    color: "cat-converter",
  },
  {
    slug: "seo",
    name: "SEO & web tools",
    summary: "DNS, SSL, headers, meta tags and more",
    description:
      "Free SEO and website tools: DNS, WHOIS and SSL checkers, HTTP headers and redirect checkers, meta tag analyzer, plus generators for meta tags, robots.txt, UTM links, QR codes and passwords.",
    color: "cat-seo",
  },
  {
    slug: "calculator",
    name: "Calculators",
    summary: "Everyday math, finance and health",
    description:
      "Free online calculators for age, percentages, BMI, calories, loan EMI, SIP, compound interest, CAGR, discounts, GST/VAT, dates and time zones.",
    color: "cat-calculator",
  },
];

export function getCategory(slug: string): CategoryDefinition | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}
