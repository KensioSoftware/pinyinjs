/**
 * Reading numbers aloud, as quantities or digit by digit.
 */
import { applySandhi, type SandhiOptions } from "../decode/sandhi.js";
import { toCharacters } from "../script/characters.js";
import {
  numeralHanzi,
  type NumeralOptions,
  percentHanzi,
  readNumeralHanzi,
} from "../numerals/numerals.js";
import { type Syllable, writeSyllable } from "../syllable/syllable.js";
import { convertOptions } from "./arguments.js";
import { type Command, column } from "./command.js";

/**
 * Apply the sandhi a counted quantity takes, and only there.
 *
 * 一百 is said `yìbǎi`, but 110 read out is `yāo yāo líng` and never
 * `yì yì líng`, and 3.14 is `sān diǎn yī sì`: a digit said on its own keeps its
 * citation tone, and so does everything after the decimal point, which is read
 * digit by digit whatever the style. So the sandhi pass runs over the counted
 * part of the number and stops at the 点.
 */
function counted(
  hanzi: string,
  reading: readonly Syllable[],
  options: NumeralOptions,
  sandhi: SandhiOptions | undefined,
): readonly Syllable[] {
  if (options.style === "digits") {
    return reading;
  }
  const point = toCharacters(hanzi).indexOf("点");
  const quantity = point === -1 ? reading.length : point;
  return [
    ...applySandhi(reading.slice(0, quantity), sandhi),
    ...reading.slice(quantity),
  ];
}

/**
 * Read numbers aloud, as quantities or digit by digit.
 *
 * Needs no dictionary, for the same reason `syllable` and `sandhi` do not:
 * reading a number is arithmetic and a twenty-entry reading table, not a
 * lookup. Which of the two styles a number takes is the caller's to say —
 * 2026年 is read out digit by digit and 2026个 is counted — so the flag is
 * where that choice lives rather than a guess about the text around it.
 */
export const NUMBER: Command = {
  name: "number",
  summary: "read a number as Chinese numerals",
  argument: "<number...>",
  flags: [
    "notation",
    "digits",
    "yao",
    "no-liang",
    "percent",
    "third-tone",
    "no-sandhi",
  ],
  needsDictionary: false,
  run: (input) => {
    const { notation, sandhi } = convertOptions(input.flags);
    const options: NumeralOptions = {
      style: input.flags.digits === true ? "digits" : "cardinal",
      ...(input.flags.yao === true && { yao: true }),
      ...(input.flags["no-liang"] === true && { liang: "never" as const }),
    };
    return input.texts.map((text) => {
      const hanzi =
        input.flags.percent === true
          ? percentHanzi(text, options)
          : numeralHanzi(text, options);
      const reading =
        hanzi === undefined ? undefined : readNumeralHanzi(hanzi, options);
      if (hanzi === undefined || reading === undefined) {
        return {
          lines: [`${text}  not a number`],
          data: { text, read: false },
        };
      }
      const said = counted(hanzi, reading, options, sandhi);
      const spelled = said.map((syllable) => writeSyllable(syllable, notation));
      return {
        lines: [
          `${column(text, 12)}${column(hanzi, 18)}${spelled
            .map((written, at) => input.paint(written, said[at]?.tone))
            .join(" ")}`,
        ],
        data: {
          text,
          hanzi,
          pinyin: spelled.join(" "),
          style: options.style,
        },
      };
    });
  },
};
