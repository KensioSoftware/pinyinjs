import type { Tone } from "../tone/tone.js";

/**
 * How much colour the output can carry.
 *
 * Two tiers rather than one because the sixteen colours every terminal has
 * cannot carry this palette: the nearest basic yellow to MDBG's second tone is
 * `#cdcd00`, which is ΔE00 22.7 away and contrasts 1.70:1 against a white
 * background. The 256-colour cube gets every tone within ΔE00 8.6 and above
 * 3:1 on both backgrounds. See {@link TONE_COLOURS} for the numbers.
 */
export type ColourDepth = 0 | 16 | 256;

/**
 * Paint one syllable's text in its tone's colour.
 *
 * Takes the tone rather than the syllable so that a system spelling its
 * syllables some other way — bopomofo, Wade-Giles — paints them the same. A
 * tone the source never wrote is not painted, for the same reason tone 5 is
 * not: MDBG has no colour for either.
 */
export type Painter = (text: string, tone: Tone | undefined) => string;

/**
 * One tone's colour, in MDBG's values and in a terminal's.
 *
 * MDBG names its scheme "red/yellow/green/blue/black" and ships two variants,
 * choosing between them with `prefers-color-scheme`. A terminal cannot say
 * whether its background is dark or light, so each tone gets one value that has
 * to survive both — which is why the extended codes are the nearest cube entry
 * clearing 3:1 against black *and* white, rather than the nearest outright.
 */
interface ToneColour {
  readonly tone: Tone;
  /** MDBG's own value, from `.mpt1`–`.mpt5` in its stylesheet. */
  readonly mdbg: string;
  /** The SGR code for one of the sixteen colours every terminal has. */
  readonly basic: number;
  /** The index into the 256-colour cube. */
  readonly extended: number;
}

/**
 * The palette, pinned against MDBG's stylesheet rather than guessed at.
 *
 * | Tone | MDBG | 256 | ΔE00 | 16 | ΔE00 |
 * | ---: | --- | --- | ---: | --- | ---: |
 * | 1 | `#ff0000` | 196 `#ff0000` | 0.0 | bright red | 0.0 |
 * | 2 | `#d09000` | 136 `#af8700` | 7.8 | yellow | 22.7 |
 * | 3 | `#00a000` | 28 `#008700` | 8.6 | green | 12.7 |
 * | 4 | `#0044ff` | 27 `#005fff` | 7.7 | bright blue | 8.3 |
 *
 * **Tone 5 is not here, and that is MDBG's answer rather than an omission.**
 * Its fifth colour is `#000000` on a light page and `#ffffff` on a dark one —
 * the plain text colour, which in a terminal means writing no escape at all.
 * The grey the roadmap recorded is Pleco's fifth colour, not MDBG's.
 *
 * A tone that was never written gets no colour either. MDBG's stylesheet
 * carries a sixth class, `.mptd` `#808080`, but no page it serves uses it, so
 * there is nothing attested to copy.
 */
const TONE_COLOURS: readonly ToneColour[] = [
  { tone: 1, mdbg: "#ff0000", basic: 91, extended: 196 },
  { tone: 2, mdbg: "#d09000", basic: 33, extended: 136 },
  { tone: 3, mdbg: "#00a000", basic: 32, extended: 28 },
  { tone: 4, mdbg: "#0044ff", basic: 94, extended: 27 },
];

/**
 * The escape that puts a terminal back to its own colours.
 */
const RESET = "\u{1B}[0m";

/**
 * The escape sequence a tone is written in, at a given depth.
 */
function escapeFor(colour: ToneColour, depth: ColourDepth): string {
  return depth === 256
    ? `\u{1B}[38;5;${String(colour.extended)}m`
    : `\u{1B}[${String(colour.basic)}m`;
}

/**
 * One tone's colour, as the docs and their guards need it.
 */
export interface PaletteEntry {
  readonly tone: Tone;
  /** MDBG's own value, so a page quoting it cannot drift from the source. */
  readonly mdbg: string;
  readonly escape: string;
}

/**
 * Everything the palette knows, at a given depth.
 */
export function paletteAt(depth: ColourDepth): readonly PaletteEntry[] {
  return TONE_COLOURS.map((colour) => ({
    tone: colour.tone,
    mdbg: colour.mdbg,
    escape: escapeFor(colour, depth),
  }));
}

/**
 * A painter that hands text back exactly as it was.
 */
export const PLAIN: Painter = (text) => text;

/**
 * A painter for a terminal of a given depth.
 *
 * Depth 0 is {@link PLAIN}, so a caller never has to ask twice.
 */
export function painterFor(depth: ColourDepth): Painter {
  if (depth === 0) {
    return PLAIN;
  }
  const escapes = new Map<Tone, string>(
    TONE_COLOURS.map((colour) => [colour.tone, escapeFor(colour, depth)]),
  );
  return (text, tone) => {
    const escape = tone === undefined ? undefined : escapes.get(tone);
    return escape === undefined || text === ""
      ? text
      : `${escape}${text}${RESET}`;
  };
}

/**
 * The escape sequences a painter writes, for measuring a line's real width.
 *
 * The control character is the thing being matched — it is what a terminal
 * reads and a reader never sees — so `no-control-regex` has nothing to say
 * here.
 */
// eslint-disable-next-line no-control-regex
const ESCAPES = /\u{1B}\[[\d;]*m/gu;

/**
 * A line with its colour taken back off.
 */
export function stripColour(text: string): string {
  return text.replaceAll(ESCAPES, "");
}

/**
 * How many characters of a string a reader actually sees.
 *
 * A column padded with `padEnd` counts the escapes, so a coloured cell comes
 * out short by however many bytes its colour took.
 */
export function visibleLength(text: string): number {
  return stripColour(text).length;
}

/**
 * What a terminal says about itself.
 */
export interface TerminalSignals {
  /** Whether the output is going to a terminal rather than a pipe or a file. */
  readonly isTerminal: boolean;
  /** `NO_COLOR`, honoured whenever it is set to anything but the empty string. */
  readonly noColour: string | undefined;
  readonly term: string | undefined;
  readonly colorterm: string | undefined;
}

/**
 * How much colour to write, from what the terminal says about itself.
 *
 * Pure, and separate from the Node adapter that reads the signals, so that both
 * answers can be asked for in a test rather than sniffed at run time.
 *
 * A file full of escape sequences is worse than no colour at all, so a pipe
 * gets none; `NO_COLOR` is honoured because it is the convention every other
 * tool honours; and `TERM=dumb` means what it says.
 */
export function depthFrom(signals: TerminalSignals): ColourDepth {
  const { isTerminal, noColour, term = "", colorterm = "" } = signals;
  if (
    !isTerminal ||
    (noColour ?? "") !== "" ||
    term === "dumb" ||
    term === ""
  ) {
    return 0;
  }
  const isExtended =
    colorterm === "truecolor" ||
    colorterm === "24bit" ||
    term.includes("256color") ||
    term.includes("direct");
  return isExtended ? 256 : 16;
}
