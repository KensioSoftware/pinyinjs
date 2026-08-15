/**
 * What must hold of the neutral tone across the dictionary.
 *
 * The 轻声 list and the 语气词 are the two places a source refresh could take a
 * neutral tone away without any single word looking wrong.
 */
import { characterCount } from "../script/characters.js";
import { NEUTRAL_TONE } from "../tone/tone.js";
import { NEUTRAL_SENSE_WORDS } from "./neutral-senses.js";
import type { BuildAssertion, BuiltDictionary } from "./built-dictionary.js";

/**
 * jieba's tag for a 语气词, which is what 吧, 呢 and 吗 are.
 */
const PARTICLE_TAG = "y";

/**
 * The 语气词 the sources themselves do not lead with a 轻声 for.
 *
 * The rule below is that the words a character appears in must not take the
 * default away from its 轻声, not that a 语气词 is always neutral. For these
 * three the reading that leads was never the neutral one and no word put it
 * there: `kMandarin` names 呃 `è` and 哩 `lī`, and `kHanyuPinlu` ranks 呵 as
 * `ā(392)` over `hē(64)`, all of them counting the bare character.
 */
const FULL_TONE_PARTICLES = new Set(["呃", "呵", "哩"]);

export const TONE_INVARIANTS: readonly BuildAssertion[] = [
  // kHanyuPinlu writes 西 as `xi(902) xī(738)`, and the 902 are 东西: a 轻声 the
  // field counted only inside words is not the bare character's reading. 吗 is
  // the control — CC-CEDICT calls it a question particle in its own right, and
  // a particle's whole use *is* the bare character.
  {
    // The table names words and lets CC-CEDICT supply the reading, so the way
    // it can fail silently is a source refresh dropping or retoning the 轻声
    // sense — after which the word would quietly go back to the full-tone
    // homograph the list exists to get away from.
    description: "every word on the 轻声 sense list reads with one",
    check: (dictionary: BuiltDictionary): string | undefined => {
      const wrong = NEUTRAL_SENSE_WORDS.filter(
        (listed) =>
          !(dictionary.get(listed.word)?.readings.cn ?? []).some(
            (syllable) => syllable.tone === NEUTRAL_TONE,
          ),
      ).map(
        (listed) =>
          `${listed.word} ${dictionary.reading(listed.word) ?? "(missing)"}`,
      );
      return wrong.length === 0
        ? undefined
        : `listed for their 轻声 sense and not reading one: ${wrong.join(", ")}`;
    },
  },
  {
    // The corpus mass ranking the character defaults counts a character only
    // inside the words the dictionary holds, and a 语气词 is never inside one:
    // every 吧 it can reach is 酒吧, 网吧 or 吧台, and the only 呗 is 梵呗.
    // Left to it the particle takes the reading of the noun, which is what 吧
    // `bā` and 呗 `bài` were. A 语气词 is the one part of speech whose whole
    // use is the bare character, so its 轻声 is what words cannot vote on.
    description: "no 语气词 ranks a full tone above its own 轻声",
    check: (dictionary: BuiltDictionary): string | undefined => {
      const wrong = dictionary.entries
        .filter(
          (entry) =>
            entry.partOfSpeech === PARTICLE_TAG &&
            characterCount(entry.hans) === 1 &&
            !FULL_TONE_PARTICLES.has(entry.hans) &&
            entry.readings.cn[0]?.tone !== NEUTRAL_TONE &&
            (entry.alternates ?? []).some(
              (reading) => reading[0]?.tone === NEUTRAL_TONE,
            ),
        )
        .map(
          (entry) => `${entry.hans} ${dictionary.reading(entry.hans) ?? ""}`,
        );
      return wrong.length === 0
        ? undefined
        : `语气词 reading a full tone over a 轻声 they also have: ${wrong.join(", ")}`;
    },
  },
];
