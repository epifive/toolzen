import type { ToolDefinition } from "../registry";

const TEXT_PRIVATE = "No. Everything happens in your browser. Your text is never sent to our servers or stored anywhere.";

export const TEXT_TOOLS: ToolDefinition[] = [
  // ───────────────────────────── Text ─────────────────────────────
  {
    slug: "character-counter",
    name: "Character Counter",
    category: "text",
    icon: "text-cursor-input",
    description: "Count characters with and without spaces and check limits for X, SMS, meta tags, Instagram and YouTube.",
    keywords: ["character counter", "letter count", "tweet character count", "sms character counter", "meta description length"],
    steps: [
      "Type or paste your text.",
      "Read the character, word and byte counts as you type.",
      "Check the bars to see how much room is left on each platform.",
    ],
    faq: [
      {
        q: "Why does the X (Twitter) count differ from the character count?",
        a: "X weighs characters: links always count as 23, and emoji and Chinese, Japanese or Korean characters count as 2. The X bar uses the same rules.",
      },
      {
        q: "How are SMS messages counted?",
        a: "Plain text uses the GSM-7 alphabet: 160 characters fit in one message, or 153 per part when it is split. A single emoji or special character switches the whole message to Unicode, which allows only 70 characters (67 per part).",
      },
      { q: "Is my text saved or uploaded?", a: TEXT_PRIVATE },
    ],
  },
  {
    slug: "fancy-text-generator",
    name: "Fancy Text Generator",
    category: "text",
    icon: "sparkles",
    description: "Turn plain text into bold, italic, script, gothic, bubble and 20+ other Unicode styles you can copy anywhere.",
    keywords: ["fancy text generator", "bold text generator", "cursive text", "instagram fonts", "unicode fonts", "stylish text"],
    steps: [
      "Type your text.",
      "Scroll through the styles to find one you like.",
      "Press Copy and paste it into your bio, post or message.",
    ],
    faq: [
      {
        q: "How does fancy text work without a font?",
        a: "Each style uses real Unicode characters that look like styled letters, such as the Mathematical Bold and Script alphabets. Because they are characters, not formatting, they keep their look when pasted into Instagram, X, TikTok or WhatsApp.",
      },
      {
        q: "Why do some characters show as boxes?",
        a: "A few older devices lack fonts for every Unicode symbol. Bold, italic and script styles are the most widely supported.",
      },
      {
        q: "Is fancy text bad for accessibility?",
        a: "Screen readers may read styled letters one by one or skip them, so use fancy text for short accents rather than whole sentences.",
      },
    ],
    featured: true,
  },
  {
    slug: "text-repeater",
    name: "Text Repeater",
    category: "text",
    icon: "repeat-2",
    description: "Repeat a word, sentence or emoji up to 10,000 times with your choice of separator and numbering.",
    keywords: ["text repeater", "repeat text", "repeat words", "emoji repeater", "copy paste text multiple times"],
    steps: [
      "Type the text to repeat.",
      "Choose how many times and the separator: new line, space, comma or your own.",
      "Copy or download the result.",
    ],
    faq: [
      { q: "How many times can I repeat text?", a: "Up to 10,000 times, as long as the result stays under 5 million characters so your browser remains responsive." },
      { q: "Can I put each copy on its own line?", a: "Yes. Choose New line as the separator, and turn on numbering to get 1., 2., 3. in front of each copy." },
    ],
  },
  {
    slug: "add-line-numbers",
    name: "Add Line Numbers",
    category: "text",
    icon: "list-ordered",
    description: "Number every line of text with your own start, step, separator and padding, or strip existing line numbers.",
    keywords: ["add line numbers", "number lines", "remove line numbers", "numbered list generator"],
    steps: [
      "Paste your text.",
      "Set the starting number, step, separator and padding.",
      "Copy the numbered text, or switch to Remove mode to strip numbers.",
    ],
    faq: [
      { q: "Can I skip blank lines?", a: "Yes. Turn on Skip empty lines and blank lines are kept but not numbered." },
      {
        q: "Which numbers does Remove mode strip?",
        a: "A number at the very start of a line, followed by a separator such as a dot, parenthesis, colon, pipe, dash, tab or space, for example \"1. \", \"(2) \" or \"003 | \".",
      },
    ],
  },
  {
    slug: "add-prefix-suffix",
    name: "Add Prefix & Suffix to Lines",
    category: "text",
    icon: "list-plus",
    description: "Add the same text to the start and end of every line, for quotes, lists, HTML or SQL.",
    keywords: ["add prefix to each line", "add suffix to lines", "add text to every line", "wrap lines in quotes"],
    steps: [
      "Paste your lines.",
      "Type a prefix, a suffix or both, or pick a preset.",
      "Copy the result.",
    ],
    faq: [
      { q: "Can I add a tab or line break?", a: "Yes. Type \\t for a tab or \\n for a new line in the prefix or suffix." },
      { q: "What happens to empty lines?", a: "By default they are left untouched. Turn off Skip empty lines to add the prefix and suffix to them too." },
    ],
  },
  {
    slug: "word-scrambler",
    name: "Word Scrambler",
    category: "text",
    icon: "shuffle",
    description: "Scramble the letters inside words, shuffle word order or shuffle lines, using secure randomness.",
    keywords: ["word scrambler", "scramble letters", "jumble words", "shuffle words", "word puzzle maker"],
    steps: [
      "Type or paste your text.",
      "Choose what to scramble: letters, word order, lines or a mix.",
      "Press Scramble again for a new result, then copy it.",
    ],
    faq: [
      {
        q: "Why keep the first and last letter?",
        a: "Words with their first and last letters in place stay surprisingly readable, which is popular for puzzles and reading experiments. Turn it off for a full scramble.",
      },
      { q: "Is the shuffle truly random?", a: "It uses your browser's cryptographic random number generator, so results cannot be predicted." },
    ],
  },
  {
    slug: "text-splitter",
    name: "Text Splitter",
    category: "text",
    icon: "scissors",
    description: "Split long text into parts by characters, words, lines or a delimiter, ready for posts and SMS.",
    keywords: ["text splitter", "split text", "tweet splitter", "split text into chunks", "character limit splitter"],
    steps: [
      "Paste your text.",
      "Choose how to split it and the maximum size of each part.",
      "Copy the parts one by one, or copy or download them all.",
    ],
    faq: [
      {
        q: "Can I make a thread for X (Twitter)?",
        a: "Yes. Split by characters with the 280 preset, keep Don't break words on and turn on numbering. Room for the 1/5 label is reserved so every part still fits.",
      },
      { q: "Is there a limit?", a: "No fixed limit. The first 200 parts are shown on the page, and Copy all or Download gives you every part." },
    ],
  },
  {
    slug: "random-name-picker",
    name: "Random Name Picker",
    category: "text",
    icon: "dices",
    description: "Draw one or more random winners from a list of names for giveaways, classrooms and teams.",
    keywords: ["random name picker", "name picker", "giveaway winner picker", "random winner generator", "draw names"],
    steps: [
      "Paste the names, one per line.",
      "Choose how many winners to draw.",
      "Press the button to reveal the winners.",
    ],
    faq: [
      {
        q: "Is the draw fair?",
        a: "Yes. Winners are picked with your browser's cryptographic random number generator, and no name can win twice in the same draw.",
      },
      {
        q: "Can I keep drawing without repeats?",
        a: "Turn on Remove winners from the list and each winner is taken out of the list after the draw, so later draws only include the remaining names.",
      },
      { q: "Are the names uploaded?", a: TEXT_PRIVATE },
    ],
  },
  {
    slug: "number-to-words",
    name: "Number to Words Converter",
    category: "text",
    icon: "spell-check",
    description: "Spell out numbers in English words, as ordinals or for cheques and invoices, in the international or Indian system.",
    keywords: ["number to words", "amount in words", "cheque amount in words", "spell number", "lakh crore in words"],
    steps: [
      "Type a number, with or without commas.",
      "Pick the format: words, ordinal, currency or cheque.",
      "Copy the result.",
    ],
    faq: [
      {
        q: "How do I write an amount on a cheque?",
        a: "Choose Cheque to get the US style, for example \"One thousand two hundred thirty-four and 56/100 dollars\". Choose Currency for \"…dollars and fifty-six cents\".",
      },
      {
        q: "Does it support lakh and crore?",
        a: "Yes. Switch to the Indian system to get lakh and crore, for example 1,25,00,000 becomes one crore twenty-five lakh.",
      },
      { q: "How large can the number be?", a: "Up to 999 sextillion (24 digits), including negative numbers and decimals." },
    ],
  },

  // ───────────────────────────── Converters ─────────────────────────────
  {
    slug: "text-to-binary",
    name: "Text to Binary Converter",
    category: "converter",
    icon: "binary",
    description: "Convert text to binary code (8-bit UTF-8 bytes), including emoji and accented letters.",
    keywords: ["text to binary", "binary translator", "string to binary", "binary code converter"],
    steps: ["Type or paste your text.", "Choose a separator between bytes.", "Copy the binary code."],
    faq: [
      {
        q: "Why do some characters take more than 8 bits?",
        a: "Text is encoded as UTF-8. English letters use one byte, accented letters two, and emoji four, so they produce 16 or 32 bits.",
      },
      { q: "How do I convert it back?", a: "Press Swap to open the Binary to Text converter with your binary code already filled in." },
    ],
  },
  {
    slug: "binary-to-text",
    name: "Binary to Text Converter",
    category: "converter",
    icon: "type",
    description: "Decode binary code back into readable text, with clear errors for invalid digits.",
    keywords: ["binary to text", "binary decoder", "binary to ascii", "binary translator"],
    steps: ["Paste the binary code.", "Read the decoded text instantly.", "Copy the result."],
    faq: [
      {
        q: "Which binary formats are accepted?",
        a: "Groups of 8 bits separated by spaces, commas or line breaks, or one continuous run of bits. Groups with leading zeros left out, such as 1000001, and a 0b prefix are accepted too.",
      },
      {
        q: "Why do I see � characters?",
        a: "The bytes are not valid UTF-8, usually because a bit or byte is missing. Check the input for incomplete groups.",
      },
    ],
  },
  {
    slug: "text-to-hex",
    name: "Text to Hex Converter",
    category: "converter",
    icon: "hexagon",
    description: "Convert text to hexadecimal UTF-8 bytes, with optional uppercase letters and 0x prefixes.",
    keywords: ["text to hex", "string to hex", "ascii to hex", "hex encoder"],
    steps: ["Type or paste your text.", "Choose the separator, case and prefix.", "Copy the hex output."],
    faq: [
      { q: "Is Unicode supported?", a: "Yes. Text is encoded as UTF-8, so é becomes C3 A9 and emoji become four bytes." },
      { q: "How do I convert hex back to text?", a: "Press Swap to open the Hex to Text converter with the result filled in." },
    ],
  },
  {
    slug: "hex-to-text",
    name: "Hex to Text Converter",
    category: "converter",
    icon: "letter-text",
    description: "Decode hexadecimal bytes back into readable UTF-8 text.",
    keywords: ["hex to text", "hex decoder", "hex to string", "hex to ascii"],
    steps: ["Paste the hex bytes.", "Read the decoded text instantly.", "Copy the result."],
    faq: [
      {
        q: "Which hex formats are accepted?",
        a: "Bytes separated by spaces, commas or line breaks, one continuous string like 48656C6C6F, and bytes with 0x or \\x prefixes. Upper and lower case both work.",
      },
      { q: "Why does it say the digits are not a whole number of bytes?", a: "Each byte needs two hex digits. A continuous hex string must have an even length." },
    ],
  },
  {
    slug: "ascii-converter",
    name: "ASCII Converter",
    category: "converter",
    icon: "keyboard",
    description: "Convert text to ASCII character codes in decimal, hex, binary or octal and back, with a full character table.",
    keywords: ["ascii converter", "text to ascii", "ascii to text", "ascii code", "character code converter"],
    steps: [
      "Choose a direction and a number base.",
      "Type text or paste character codes.",
      "Copy the result or look up each character in the table.",
    ],
    faq: [
      {
        q: "What about characters outside ASCII?",
        a: "ASCII covers codes 0 to 127. Other characters, such as é or emoji, are shown with their Unicode code point, which is the same number for the ASCII range.",
      },
      { q: "Which separators can I use when decoding?", a: "Spaces, commas, semicolons or line breaks between codes. Prefixes like 0x, 0b and &# are ignored." },
    ],
  },
  {
    slug: "morse-code-translator",
    name: "Morse Code Translator",
    category: "converter",
    icon: "radio",
    description: "Translate text to Morse code and back, and play it as sound at your chosen speed and tone.",
    keywords: ["morse code translator", "text to morse", "morse to text", "morse code audio", "morse decoder"],
    steps: [
      "Type text or paste Morse code.",
      "Copy the translation.",
      "Press Play sound to hear it, adjusting speed (WPM) and tone as you like.",
    ],
    faq: [
      {
        q: "How should I write Morse code?",
        a: "Use . for dots and - for dashes, a space between letters and / between words. Look-alike characters such as • and − are understood too.",
      },
      {
        q: "What does WPM mean?",
        a: "Words per minute, based on the standard word PARIS. At 20 WPM a dot lasts 60 milliseconds.",
      },
    ],
  },
  {
    slug: "caesar-cipher",
    name: "Caesar Cipher",
    category: "converter",
    icon: "key-round",
    description: "Encrypt and decrypt text with the Caesar shift cipher or ROT13, and crack unknown shifts by brute force.",
    keywords: ["caesar cipher", "rot13", "shift cipher", "caesar decoder", "cipher solver"],
    steps: [
      "Choose Encode or Decode and set the shift, or press ROT13.",
      "Type or paste your text.",
      "Copy the result, or use the brute-force list to find an unknown shift.",
    ],
    faq: [
      {
        q: "What is ROT13?",
        a: "A Caesar cipher with a shift of 13. Because the alphabet has 26 letters, applying ROT13 twice gives back the original text.",
      },
      {
        q: "How does the brute-force list find the right shift?",
        a: "It tries all 25 shifts and compares each result's letter frequencies with English. The closest match is highlighted.",
      },
      { q: "Is the Caesar cipher secure?", a: "No. It is easy to break and should only be used for puzzles, games and learning." },
    ],
  },
  {
    slug: "roman-numeral-converter",
    name: "Roman Numeral Converter",
    category: "converter",
    icon: "landmark",
    description: "Convert numbers to Roman numerals and back, with a step-by-step breakdown of each symbol.",
    keywords: ["roman numeral converter", "roman numerals", "number to roman", "roman to number"],
    steps: ["Type a number or a Roman numeral.", "Read the conversion in the other box.", "See how the numeral breaks down."],
    faq: [
      { q: "What range is supported?", a: "Whole numbers from 1 to 3,999 (MMMCMXCIX), the range standard Roman numerals can write." },
      {
        q: "Why is IIII not accepted?",
        a: "Only the standard form is valid, where 4 is IV, 9 is IX, 40 is XL and so on. Non-standard forms are rejected so you always get a correct numeral.",
      },
    ],
  },
  {
    slug: "punycode-converter",
    name: "Punycode Converter",
    category: "converter",
    icon: "globe",
    description: "Convert internationalized domain names to Punycode (xn--) and back, including URLs and email addresses.",
    keywords: ["punycode converter", "idn converter", "punycode decoder", "xn-- domain", "unicode domain"],
    steps: [
      "Choose a direction.",
      "Paste domains, URLs or email addresses, one per line.",
      "Copy the converted list.",
    ],
    faq: [
      {
        q: "What is Punycode?",
        a: "An encoding (RFC 3492) that writes Unicode domain names with only letters, digits and hyphens, so they work in DNS. bücher.de becomes xn--bcher-kva.de.",
      },
      {
        q: "Are URLs and emails supported?",
        a: "Yes. Only the domain part is converted; the scheme, user name, port and path are left as they are.",
      },
    ],
  },
  {
    slug: "unicode-escape-converter",
    name: "Unicode Escape Converter",
    category: "converter",
    icon: "braces",
    description: "Convert text to Unicode escape sequences for JavaScript, JSON, HTML, CSS and Python, and decode them back.",
    keywords: ["unicode escape", "unicode unescape", "\\u escape converter", "html numeric entities", "unicode code points"],
    steps: [
      "Choose a direction and, for escaping, the format you need.",
      "Type or paste your text.",
      "Copy the result.",
    ],
    faq: [
      {
        q: "Which formats are supported?",
        a: "JavaScript and JSON \\uXXXX (with surrogate pairs), ES6 \\u{…}, HTML &#x…; and &#…;, CSS \\XXXX, Python \\u and \\U, and U+XXXX code points.",
      },
      {
        q: "Do I need to choose the format when decoding?",
        a: "No. Every supported format is detected automatically, even when they are mixed in the same text.",
      },
    ],
  },
];
