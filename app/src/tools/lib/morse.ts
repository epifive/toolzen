/** International Morse code (ITU-R M.1677-1) translation and audio timing. */

const CODES: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---",
  K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-",
  U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..",
  "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
  "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
  ".": ".-.-.-", ",": "--..--", "?": "..--..", "'": ".----.", "!": "-.-.--", "/": "-..-.", "(": "-.--.",
  ")": "-.--.-", "&": ".-...", ":": "---...", ";": "-.-.-.", "=": "-...-", "+": ".-.-.", "-": "-....-",
  _: "..--.-", '"': ".-..-.", $: "...-..-", "@": ".--.-.",
};

/** Every supported character and its code, for reference charts. */
export const MORSE_TABLE: ReadonlyArray<[char: string, code: string]> = Object.entries(CODES);

const LETTERS: Record<string, string> = Object.fromEntries(Object.entries(CODES).map(([char, code]) => [code, char]));

export interface MorseResult {
  output: string;
  /** Characters or codes that could not be translated. */
  unknown: string[];
}

/** Text to Morse: letters separated by spaces, words by " / ". */
export function textToMorse(text: string): MorseResult {
  const unknown = new Set<string>();
  const lines = text.split(/\r\n|\r|\n/).map((line) =>
    line
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) =>
        Array.from(word.toUpperCase())
          .map((char) => {
            const code = CODES[char];
            if (!code) unknown.add(char);
            return code;
          })
          .filter(Boolean)
          .join(" "),
      )
      .filter(Boolean)
      .join(" / "),
  );
  return { output: lines.join("\n"), unknown: [...unknown] };
}

/** Replace look-alike dot and dash characters (• · − – _) with . and -. */
export function normalizeMorse(morse: string): string {
  return morse.replace(/[•·∙]/g, ".").replace(/[−–—_]/g, "-");
}

/** Morse to text. Accepts . and - (or look-alikes), "/" or "|" or 3+ spaces between words. */
export function morseToText(morse: string): MorseResult {
  const unknown = new Set<string>();
  const lines = normalizeMorse(morse).split(/\r\n|\r|\n/).map((line) =>
    line
      .trim()
      .split(/\s*[/|]\s*|\s{3,}/)
      .map((word) =>
        word
          .split(/\s+/)
          .filter(Boolean)
          .map((code) => {
            const char = LETTERS[code];
            if (!char) unknown.add(code);
            return char ?? "";
          })
          .join(""),
      )
      .filter(Boolean)
      .join(" "),
  );
  return { output: lines.join("\n"), unknown: [...unknown] };
}

/** True when the text looks like Morse code rather than plain text. */
export function looksLikeMorse(text: string): boolean {
  return /^[\s.\-/|•·∙−–—_]+$/.test(text) && /[.\-•·−]/.test(text);
}

export interface Tone {
  /** Start time in seconds from the beginning. */
  start: number;
  duration: number;
}

/**
 * Tone schedule for Morse code using the PARIS standard: one unit is 1.2 / WPM
 * seconds, a dash is 3 units, gaps are 1 (inside a letter), 3 (between letters)
 * and 7 (between words) units.
 */
export function morseTimeline(morse: string, wpm: number): { tones: Tone[]; total: number } {
  const unit = 1.2 / wpm;
  const tones: Tone[] = [];
  let time = 0;
  const words = normalizeMorse(morse)
    .trim()
    .split(/\s*[/|\n]\s*|\s{3,}/)
    .filter((w) => w.trim());
  words.forEach((word, wi) => {
    if (wi > 0) time += 7 * unit;
    word
      .trim()
      .split(/\s+/)
      .forEach((letter, li) => {
        if (li > 0) time += 3 * unit;
        Array.from(letter).forEach((symbol, si) => {
          if (si > 0) time += unit;
          const length = symbol === "-" ? 3 * unit : unit;
          if (symbol === "." || symbol === "-") {
            tones.push({ start: time, duration: length });
            time += length;
          }
        });
      });
  });
  return { tones, total: time };
}
