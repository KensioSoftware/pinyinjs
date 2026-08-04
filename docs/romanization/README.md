# Romanisation

Bopomofo (注音符號) and Wade-Giles, in both directions, at the syllable level.
Like [numbers](../numerals/) this needs no dictionary: a romanisation is a
mapping over about 420 syllables, so hanzi → Wade-Giles is just hanzi → pinyin →
Wade-Giles.

```ts
import { readSyllable, writeBopomofo, writeWadeGiles } from "@kensio/pinyinjs";

const jiu = readSyllable("jiù");
writeBopomofo(jiu); // "ㄐㄧㄡˋ"
writeWadeGiles(jiu); // "chiu⁴"
```

## Why the tables are short

A parsed syllable holds its **underlying** initial and final rather than its
spelling — 就 is `j` + `iou`, not `j` + `iu`, and 军 is `j` + `ün` — so both
systems fall out of a lookup instead of a second pile of respelling rules. See
[syllables](../syllables/).

That is most of the reason bopomofo is a straight bijection: ㄐㄧㄡ is the
underlying form written symbol for symbol.

## Bopomofo

```ts
writeBopomofo(readSyllable("zhōng")); // "ㄓㄨㄥ" — ong is ㄨ + ㄥ
writeBopomofo(readSyllable("zhī")); // "ㄓ" — the empty rhyme is not written
writeBopomofo(readSyllable("ma5")); // "˙ㄇㄚ" — the neutral dot goes in front
readBopomofo("ㄒㄩㄥˊ"); // xióng
```

Three things are worth knowing:

- **The first tone is unmarked**, as the standard writes it. `readBopomofo`
  therefore reads an unmarked syllable as a first tone — the omission is
  written, unlike a bare `bei` typed as pinyin, where nothing was written either
  way. Pass `{ firstTone: "mark" }` to write ˉ and keep the two apart.
- **ㄦ is the 儿化 suffix everywhere except at the front of a syllable**, where
  it is 兒 itself. 事儿 shìr is ㄕㄦ, with no rhyme for the ㄦ to attach to, and
  二儿 is ㄦㄦ.
- **ㄫ, the obsolete letter, writes the syllabic ng** of 嗯 ǹg, so that it does
  not collide with the rare 鞥 ēng.

Bopomofo also has a script of its own, which is why `isBopomofo` can tell it
apart from pinyin and Wade-Giles cannot be told apart from either.

## Wade-Giles

Writing it is a table with a few context rules — the ones that trip people up
are the whole stop series being shifted, so pinyin b is `p` and pinyin p is
`p'`:

```ts
writeWadeGiles(readSyllable("běi"), { tones: "none" }); // "pei"
writeWadeGiles(readSyllable("gē"), { tones: "none" }); // "ko" — -e is o after k
writeWadeGiles(readSyllable("zuò"), { tones: "none" }); // "tso" — -uo loses its u
writeWadeGiles(readSyllable("guì"), { tones: "none" }); // "kuei", not "kui"
writeWadeGiles(readSyllable("zī"), { tones: "none" }); // "tzŭ"
writeWadeGilesWord([readSyllable("běi"), readSyllable("jīng")]); // "pei³-ching¹"
```

The tone is a raised digit, which is what Wade-Giles writes; `{ tones: "numbers"
}` puts it on the line and `{ tones: "none" }` leaves it off. A word hyphenates,
because Wade-Giles has no 隔音符号 and the hyphen is what marks the boundary.

### Reading it back is the hard part

`readWadeGiles` returns an **array**, because one spelling can be several
syllables. That is true even of correctly written Wade-Giles, in two places:

```ts
readWadeGiles("chiu⁴"); // [jiù]
readWadeGiles("lo²"); // [luó, ló] — the system does not distinguish them
readWadeGiles("o¹"); // [ō, ē]
```

And then there is what actually turns up in books, where the apostrophes and
the diacritics have been dropped: `Tsingtao`, `Chungking`, `Mao Tse-tung`.
`readWadeGilesLoosely` allows for that:

```ts
readWadeGilesLoosely("chi¹"); // [jī, qī] — chi is jī; ch'i is qī
readWadeGilesLoosely("chu¹"); // [zhū, chū, jū, qū]
readWadeGilesLoosely("hsueh²"); // [xué] — hsüeh, no diaeresis
```

**Marks are allowed to be missing, never to be wrong.** `ch'u` has kept its
apostrophe, so whatever it is, it is not 朱 `chu` or 居 `chü`; only the diaeresis
is in question, and it reads as chū or qù and nothing else. Allowing for a
spurious mark would double every candidate list to catch a mistake nobody makes.

The exact readings come first in the list, so taking the head amounts to
believing the text wrote what it meant.

## How ambiguous is it, really?

`pnpm romanization` measures it. Over the 424 syllables of the
[inventory](../syllables/#well-formed-is-not-the-same-as-real):

|                                                   |     |
| ------------------------------------------------- | --: |
| distinct Wade-Giles spellings                     | 423 |
| spellings standing for more than one syllable     |   2 |
| spellings carrying a mark that could be dropped   | 164 |
| syllables still recovered alone once the marks go | 205 |
| syllables that merge with others                  | 219 |
| the worst of them merge four ways                 |  12 |

The twelve are `chu`, `chuan` and `chun`, each of which is zhu/chu/ju/qu once
`ch'u`, `chü` and `ch'ü` have lost their marks.

Counted over the syllabary every syllable weighs the same, which tells you
nothing about text. Weighted by how often each is actually written, over the
1,029,971 syllables of the phrase corpus the inventory came from:

|                                         |                  |
| --------------------------------------- | ---------------: |
| written with a spelling that merges     | 536,304 (52.07%) |
| recovered by taking the first candidate | 814,220 (79.05%) |

So **half of running text is ambiguous once the marks are dropped**, and
believing what was written recovers about four fifths of it. That is the honest
ceiling for a syllable at a time; a decoder with a dictionary and neighbouring
syllables to look at could do better, and this module deliberately does not
guess.

## What round-trips

Exhaustively, every syllable of the inventory in every tone state, with and
without 儿化 — 5,088 forms:

|                              |       |
| ---------------------------- | ----: |
| Wade-Giles read back exactly | 5,088 |
| bopomofo read back exactly   | 4,240 |

The 848 bopomofo misses are all the same thing, and are the standard's doing
rather than this module's: a syllable whose tone was never written comes back as
a first tone, because bopomofo marks the first tone by omission and has no room
left to say "no tone at all". Every written tone round-trips.

## How the tables were checked

No source in this package's data pipeline carries either system — CC-CEDICT,
Unihan and the phrase corpus are all pinyin — so unlike every other claim here,
the tables could not be scored against the data that ships. They are scored
instead against an outside syllabary: `test/fixtures/syllabary.ts` holds all 417
rows of Wikipedia's _Comparison of Chinese transcription systems_, and
`src/romanization/syllabary.test.ts` asserts every one of them, in both systems.

The two lists differ at the edges and both differences are marginal: 12
syllables here are not in that table (the interjections, the syllabic nasals,
and the rare readings Unihan contributes), and 5 of its rows are not in this
inventory (`diang`, `lüan`, `lün`, `nia`, `shong`, all dialectal or
reconstructed). The rules write those five correctly regardless, since nothing
about them is special.

## On the command line

```console
$ pinyinjs romanize běijīng
běijīng     běijīng   ㄅㄟˇ ㄐㄧㄥ     pei³-ching¹

$ pinyinjs romanize --from wade-giles chu¹
chu¹        zhū       ㄓㄨ          chu¹
            chū       ㄔㄨ          ch'u¹     marks restored
            jū        ㄐㄩ          chü¹      marks restored
            qū        ㄑㄩ          ch'ü¹     marks restored
```

Bopomofo needs no `--from`: it has a script of its own. See
[the command line](../cli/).

## What is not built

- **Yale, Gwoyeu Romatzyh and IPA.** The same shape of problem and the same
  tables; left for a later change rather than done badly in a hurry.
- **Whole words of Wade-Giles.** `readWadeGiles` takes one syllable. Real text
  writes `Chungking` unhyphenated, and splitting that is the Wade-Giles
  equivalent of `splitSyllables` — with the added difficulty that every
  candidate split multiplies against the ambiguity measured above.
- **hanzi → Wade-Giles end to end.** `convertPieces` already hands back a
  `Syllable` per piece, so the mapping is a few lines; what is not decided is
  what the _orthography_ should be — 正词法's word spacing is a pinyin standard,
  and Wade-Giles hyphenates instead.
- **Postal romanisation** (`Peking`, `Tsingtao`, `Canton`), which is not a
  system so much as a list, and is not derivable from any of this.
