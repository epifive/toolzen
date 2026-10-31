import type { ToolDefinition } from "../registry";
import { PRIVATE } from "./shared";

export const IMAGE_PDF_TOOLS: ToolDefinition[] = [
  // ───────────────────────────── Image ─────────────────────────────
  {
    slug: "png-to-jpg",
    name: "PNG to JPG",
    category: "image",
    icon: "image-up",
    description: "Convert PNG images to JPG with adjustable quality and a background colour for transparent areas.",
    keywords: ["png to jpg", "png to jpeg", "convert png to jpg", "png converter", "png jpg online"],
    steps: [
      "Drop one or more PNG images into the box, or click to choose them.",
      "Set the JPG quality and the colour that should replace transparent areas.",
      "Convert, then download each JPG or all of them as a ZIP file.",
    ],
    faq: [
      { q: "Are my images uploaded?", a: PRIVATE },
      {
        q: "What happens to transparent areas?",
        a: "JPG has no transparency, so transparent pixels are filled with the background colour you pick. White is the default.",
      },
      {
        q: "Why is the JPG smaller than my PNG?",
        a: "JPG uses lossy compression that suits photos very well. At 85–90% quality the difference is rarely visible.",
      },
    ],
    fileKinds: ["image"],
  },
  {
    slug: "jpg-to-png",
    name: "JPG to PNG",
    category: "image",
    icon: "image-plus",
    description: "Convert JPG and JPEG photos to lossless PNG images in seconds.",
    keywords: ["jpg to png", "jpeg to png", "convert jpg to png", "jpg converter", "photo to png"],
    steps: [
      "Drop one or more JPG or JPEG images into the box, or click to choose them.",
      "Click Convert.",
      "Download each PNG or all of them as a ZIP file.",
    ],
    faq: [
      { q: "Are my images uploaded?", a: PRIVATE },
      {
        q: "Will converting to PNG improve quality?",
        a: "No. PNG keeps every pixel exactly as it is, but it can't restore detail the JPG compression already removed. The file is usually larger.",
      },
    ],
    fileKinds: ["image"],
  },
  {
    slug: "webp-to-png",
    name: "WebP to PNG",
    category: "image",
    icon: "file-input",
    description: "Convert WebP images to PNG while keeping transparency intact.",
    keywords: ["webp to png", "convert webp", "webp converter", "open webp file", "webp png online"],
    steps: [
      "Drop one or more WebP images into the box, or click to choose them.",
      "Click Convert.",
      "Download each PNG or all of them as a ZIP file.",
    ],
    faq: [
      { q: "Are my images uploaded?", a: PRIVATE },
      { q: "Is transparency kept?", a: "Yes. PNG supports full transparency, so transparent areas stay transparent." },
      {
        q: "What about animated WebP files?",
        a: "Only the first frame is converted, because PNG images are still images.",
      },
    ],
    fileKinds: ["image"],
  },
  {
    slug: "png-to-webp",
    name: "PNG to WebP",
    category: "image",
    icon: "arrow-right-left",
    description: "Convert PNG images to smaller WebP files for faster websites, with transparency preserved.",
    keywords: ["png to webp", "convert png to webp", "webp converter", "optimize png for web"],
    steps: [
      "Drop one or more PNG images into the box, or click to choose them.",
      "Choose a quality level.",
      "Convert, then download each WebP or all of them as a ZIP file.",
    ],
    faq: [
      { q: "Are my images uploaded?", a: PRIVATE },
      {
        q: "How much smaller will my images be?",
        a: "WebP files are typically 25–35% smaller than PNG at the same visual quality, and often much smaller for photos.",
      },
      {
        q: "Which browsers can create WebP?",
        a: "Chrome, Edge, Firefox and other modern browsers. Older Safari versions can display WebP but not create it.",
      },
    ],
    fileKinds: ["image"],
  },
  {
    slug: "jpg-to-webp",
    name: "JPG to WebP",
    category: "image",
    icon: "repeat-2",
    description: "Convert JPG photos to WebP to cut file size without visible quality loss.",
    keywords: ["jpg to webp", "jpeg to webp", "convert jpg to webp", "webp for website", "compress jpg"],
    steps: [
      "Drop one or more JPG or JPEG images into the box, or click to choose them.",
      "Choose a quality level.",
      "Convert, then download each WebP or all of them as a ZIP file.",
    ],
    faq: [
      { q: "Are my images uploaded?", a: PRIVATE },
      {
        q: "Which quality should I choose?",
        a: "Around 80% keeps photos looking the same as the original JPG while saving a noticeable amount of space.",
      },
    ],
    fileKinds: ["image"],
  },
  {
    slug: "webp-to-jpg",
    name: "WebP to JPG",
    category: "image",
    icon: "refresh-cw",
    description: "Convert WebP images to JPG so they open in any app, editor or older device.",
    keywords: ["webp to jpg", "webp to jpeg", "convert webp to jpg", "open webp", "webp converter"],
    steps: [
      "Drop one or more WebP images into the box, or click to choose them.",
      "Set the JPG quality and a background colour for transparent areas.",
      "Convert, then download each JPG or all of them as a ZIP file.",
    ],
    faq: [
      { q: "Are my images uploaded?", a: PRIVATE },
      {
        q: "Why convert WebP to JPG?",
        a: "Some older programs, printers and websites still don't accept WebP. JPG works almost everywhere.",
      },
      {
        q: "What happens to transparent areas?",
        a: "JPG has no transparency, so transparent pixels are filled with the background colour you pick.",
      },
    ],
    fileKinds: ["image"],
  },
  {
    slug: "meme-generator",
    name: "Meme Generator",
    category: "image",
    icon: "laugh",
    description: "Add classic bold top and bottom captions to any image and download your meme.",
    keywords: ["meme generator", "meme maker", "add text to image", "caption image", "impact font meme"],
    steps: [
      "Choose an image.",
      "Type the top and bottom text, then adjust the size and colours.",
      "Drag the captions into place if you like, then download the meme as PNG or JPG.",
    ],
    faq: [
      { q: "Are my images uploaded?", a: PRIVATE },
      {
        q: "Which font is used?",
        a: "The classic Impact font when your device has it, falling back to the boldest similar system font. No fonts are downloaded.",
      },
      { q: "Is there a watermark?", a: "No. The meme you download contains only your image and your text." },
    ],
    fileKinds: ["image"],
  },
  {
    slug: "circle-crop-image",
    name: "Circle Crop Image",
    category: "image",
    icon: "circle-user-round",
    description: "Crop any photo into a circle for profile pictures and avatars, with an optional border ring.",
    keywords: ["circle crop", "round image", "profile picture maker", "circular avatar", "crop image circle"],
    steps: [
      "Choose an image.",
      "Drag the photo and use the zoom slider until the circle frames it nicely.",
      "Pick an output size and an optional border ring, then download the transparent PNG.",
    ],
    faq: [
      { q: "Are my images uploaded?", a: PRIVATE },
      {
        q: "Why is the result a PNG?",
        a: "The corners outside the circle are transparent, and PNG is the common format that keeps transparency.",
      },
      {
        q: "Which size should I pick?",
        a: "512 px suits most social networks and chat apps. Choose 1024 px for print or high-resolution screens.",
      },
    ],
    fileKinds: ["image"],
  },
  {
    slug: "add-border-to-image",
    name: "Add Border to Image",
    category: "image",
    icon: "frame",
    description: "Add a coloured border, padding and rounded corners to one or many images at once.",
    keywords: ["add border to image", "image frame", "photo border", "rounded corners image", "image padding"],
    steps: [
      "Drop one or more images into the box, or click to choose them.",
      "Set the border width and colour, and optionally padding and rounded corners.",
      "Download each framed image or all of them as a ZIP file.",
    ],
    faq: [
      { q: "Are my images uploaded?", a: PRIVATE },
      {
        q: "Why did my JPG become a PNG?",
        a: "Rounded corners need transparent pixels, which JPG can't store. Without rounded corners the original format is kept.",
      },
    ],
    fileKinds: ["image"],
  },
  {
    slug: "pixelate-image",
    name: "Pixelate Image",
    category: "image",
    icon: "grid-2x2",
    description: "Pixelate a whole image or just a selected area to hide faces, plates or private details.",
    keywords: ["pixelate image", "blur face", "censor image", "mosaic effect", "hide details in photo"],
    steps: [
      "Choose an image.",
      "Pick the whole image or drag a box over the area you want to hide.",
      "Adjust the pixel size and download the result.",
    ],
    faq: [
      { q: "Are my images uploaded?", a: PRIVATE },
      {
        q: "Can pixelation be reversed?",
        a: "The original pixels are replaced, so the detail is gone from the saved file. Use a large pixel size for text and faces.",
      },
    ],
    fileKinds: ["image"],
  },
  {
    slug: "image-exif-viewer",
    name: "Image EXIF Viewer",
    category: "image",
    icon: "camera",
    description: "See a photo's hidden metadata such as camera, lens, settings, date and GPS location, and remove it.",
    keywords: ["exif viewer", "photo metadata", "image metadata", "remove exif", "gps location photo"],
    steps: [
      "Choose a photo.",
      "Read the camera, exposure, date and location details, or browse every tag in the table.",
      "Click Remove metadata to download a clean copy without EXIF, GPS or other hidden data.",
    ],
    faq: [
      { q: "Is my photo uploaded?", a: PRIVATE },
      {
        q: "Why does my photo show no metadata?",
        a: "Many apps and social networks strip metadata when saving or sharing. Screenshots and edited images often have none.",
      },
      {
        q: "How is metadata removed?",
        a: "The image is redrawn and saved again, which writes only the pixels. Camera details, GPS coordinates and comments are left out.",
      },
    ],
    fileKinds: ["image"],
  },

  // ───────────────────────────── PDF ─────────────────────────────
  {
    slug: "pdf-to-text",
    name: "PDF to Text",
    category: "pdf",
    icon: "file-text",
    description: "Extract the text from a PDF page by page, then copy it or save it as a TXT file.",
    keywords: ["pdf to text", "extract text from pdf", "pdf to txt", "copy text from pdf", "pdf text extractor"],
    steps: [
      "Choose a PDF file.",
      "Wait a moment while the text of every page is extracted.",
      "Copy the text or download it as a .txt file.",
    ],
    faq: [
      { q: "Is my PDF uploaded?", a: PRIVATE },
      {
        q: "Why is no text found in my PDF?",
        a: "Scanned documents are pictures of pages and contain no real text. They need OCR software to turn the pictures into text.",
      },
      {
        q: "Is the layout kept?",
        a: "Line breaks are kept, but columns, tables and fonts are not. The result is plain text you can edit anywhere.",
      },
    ],
    fileKinds: ["pdf"],
  },
  {
    slug: "text-to-pdf",
    name: "Text to PDF",
    category: "pdf",
    icon: "file-type",
    description: "Turn plain text or a TXT file into a clean, paginated PDF document.",
    keywords: ["text to pdf", "txt to pdf", "convert text to pdf", "notepad to pdf", "create pdf from text"],
    steps: [
      "Paste your text or open a .txt file.",
      "Choose the page size, margins, font, font size and line spacing.",
      "Click Create PDF to download the document.",
    ],
    faq: [
      { q: "Is my text uploaded?", a: PRIVATE },
      {
        q: "Which characters are supported?",
        a: "The built-in PDF fonts cover English and Western European languages. Text in other scripts, and emoji, can't be shown with them.",
      },
      {
        q: "Can I start a new page manually?",
        a: "Yes. A form-feed character in a .txt file starts a new page, just like in a printer.",
      },
    ],
    fileKinds: ["text"],
  },
  {
    slug: "organize-pdf",
    name: "Organize PDF",
    category: "pdf",
    icon: "layout-grid",
    description: "Reorder, rotate, duplicate and delete PDF pages visually, then save the new PDF.",
    keywords: ["organize pdf", "reorder pdf pages", "rearrange pdf", "sort pdf pages", "pdf page organizer"],
    steps: [
      "Choose a PDF file.",
      "Drag the page thumbnails into a new order, or use the buttons on each page to move, rotate, duplicate or delete it.",
      "Click Save PDF to download the reorganised document.",
    ],
    faq: [
      { q: "Is my PDF uploaded?", a: PRIVATE },
      {
        q: "Does it work on phones?",
        a: "Yes. Use the arrow buttons on each page to move it, since drag and drop is not available on touch screens.",
      },
      {
        q: "Is quality reduced?",
        a: "No. Pages are copied as they are, so text stays sharp and searchable.",
      },
    ],
    fileKinds: ["pdf"],
  },
  {
    slug: "sign-pdf",
    name: "Sign PDF",
    category: "pdf",
    icon: "signature",
    description: "Draw, type or upload your signature and place it anywhere on a PDF page.",
    keywords: ["sign pdf", "esign pdf", "add signature to pdf", "pdf signature", "fill and sign"],
    steps: [
      "Choose a PDF file.",
      "Draw your signature, type your name or upload a picture of your signature.",
      "Pick a page, drag and resize the signature into place, and optionally add the date.",
      "Click Sign PDF to download the signed document.",
    ],
    faq: [
      { q: "Is my PDF uploaded?", a: PRIVATE },
      {
        q: "Is this a legally binding signature?",
        a: "It adds a visual signature, which many everyday agreements accept. Contracts that require a certified digital signature need a dedicated signing service.",
      },
      {
        q: "Can I use a photo of my handwritten signature?",
        a: "Yes. Upload it and turn on background removal so the white paper becomes transparent.",
      },
    ],
    fileKinds: ["pdf"],
    premium: true,
  },
];
