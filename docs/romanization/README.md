# Romanisation

Bopomofo (注音符號), Wade-Giles, Yale and IPA, in both directions, at the
syllable level. Like [numbers](../numerals/) this needs no dictionary: a
romanisation is a mapping over about 420 syllables, so hanzi → Wade-Giles is
just hanzi → pinyin → Wade-Giles.

```ts
import {
  readSyllable,
  writeBopomofo,
  writeIpa,
  writeWadeGiles,
  writeYale,
} from "@kensio/pinyinjs";

const jiu = readSyllable("jiù");
writeBopomofo(jiu); // "ㄐㄧㄡˋ"
writeWadeGiles(jiu); // "chiu⁴"
writeYale(jiu); // "jyòu"
writeIpa(jiu); // "tɕiou˥˩"
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

## Yale

Written for American soldiers in 1943, and it shows: the aspiration pairs read
as English reads them, so pinyin b is `b` and pinyin p is `p`, and 知 is `jr`
because that is what an unprepared reader would say.

```ts
writeYaleSpelling(readSyllable("xī")); // "syi" — x is sy, alone among the palatals
writeYaleSpelling(readSyllable("zhī")); // "jr" — the empty rhyme is a letter
writeYaleSpelling(readSyllable("rì")); // "r" — and is never written twice
writeYaleSpelling(readSyllable("bō")); // "bwo" — -o after a labial is really -uo
writeYaleSpelling(readSyllable("dūn")); // "dwun", where 文 alone is "wen"
writeYale(readSyllable("jiù")); // "jyòu" — pinyin's own diacritics
```

Three things are worth knowing:

- **The medials are y and w**, which is what keeps the zero-initial table down
  to five entries where Wade-Giles needs twenty: 家 jiā is `jya` and 呀 ya is
  `ya`, the same final spelled the same way.
- **A letter is never written twice.** `sy` + `ya` is `sya`, `dz` + the empty
  rhyme `z` is `dz`, and `r` + `r` is `r`. Both halves of that rule fall out of
  putting the initial and the final side by side, which is why it lives in the
  code rather than in the tables.
- **The tone marks are pinyin's**, because pinyin took them from here. On the
  syllables with no vowel at all the mark goes on the letter standing in for
  one, so 知 zhī is `jr̄` and 字 zì is `dz̀`.

The neutral tone is written unmarked, exactly as pinyin writes it, so
`{ tones: "numbers" }` is the only notation that can say "neutral" rather than
leaving it to be inferred. 儿化 is an `r` on the end, as in pinyin, which
collides with 兒 itself:

```ts
readYale("ér"); // [ér, ér, ếr] — 兒, and either syllable Yale spells "e" plus the suffix
```

## IPA

Not a romanisation at all but a transcription, and the one table here that says
something about the language rather than about a spelling convention. It is
also the most compositional: an initial symbol and a final symbol, with **no
zero-initial forms whatever**, because y and w are spellings and IPA does not
spell.

```ts
writeIpaSymbols(readSyllable("yī")); // "i" — no y
writeIpaSymbols(readSyllable("wén")); // "uən", the same final as 敦 "tuən"
writeIpaSymbols(readSyllable("tiān")); // "tʰiɛn" — pinyin's one e is three vowels
writeIpaSymbols(readSyllable("zhī")); // "ʈʂɨ" — and its one i is two
writeIpa(readSyllable("mǎ")); // "ma˨˩˦" — Chao's tone letters
writeIpa(readSyllable("mǎ"), { tones: "numbers" }); // "ma214"
```

The transcription is the broad one of Wikipedia's _Help:IPA/Mandarin_, which is
what the syllabary below uses, so the table and its ground truth are the same
analysis rather than two.

Two things it shares with Yale and one it does not:

- **-o after a labial is [uo]**: 波 bō is `puo` while 咯 lo is `lɔ`. Yale makes
  the same split, from `bwo` against `lo` — two systems agreeing rather than one
  copying the other.
- **The empty rhyme is [ɨ]** after both the retroflexes and the dental
  sibilants, where a narrower transcription would separate [ʐ̩] from [z̩].
- **The neutral tone has no letter**, because it has no contour of its own. That
  is bopomofo's problem exactly reversed: bopomofo cannot say "no tone at all",
  and this cannot say "neutral".

**儿化 is written as a suffixed [ɚ], and that is an approximation this module
states rather than hides.** A rhotacised syllable is not the plain one with [ɚ]
after it: 玩儿 wánr is [wɑɚ̯] with the nasal gone, and 事儿 shìr loses its empty
rhyme entirely. Modelling that needs a rhyme-by-rhyme table of fused forms,
which is a phonological claim rather than a transcription convention, and it is
not made here.

## How ambiguous is Wade-Giles, really?

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
| recovered by taking the first candidate           | 312 |

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

|                                        |       |
| -------------------------------------- | ----: |
| Wade-Giles read back exactly           | 5,088 |
| Yale read back exactly, `tones` marked | 4,240 |
| Yale read back exactly, `tones` 1 to 5 | 5,088 |
| bopomofo read back exactly             | 4,240 |
| IPA read back exactly                  | 4,240 |

Every miss in that table is a tone that the system cannot write, and no two of
them are the same tone:

- **bopomofo** marks the first tone by omission, so a syllable whose tone was
  never written comes back as a first tone. 848 forms.
- **Yale** and pinyin both leave the neutral tone unmarked, so a syllable
  written `de` might be neutral or might have no tone written at all. 848 forms,
  and `{ tones: "numbers" }` is the notation that keeps them apart.
- **IPA** has no tone letter for the neutral tone, because it has no contour.
  848 forms, and there is no option that fixes it: a letter would have to be
  invented.

Wade-Giles loses nothing, because it writes all five tones as digits and never
writes one by leaving it off. Every written tone in every system round-trips.

How many syllables each system can tell apart, over the 424 of the inventory:

|                               |     |
| ----------------------------- | --: |
| distinct bopomofo spellings   | 424 |
| distinct IPA transcriptions   | 424 |
| distinct Wade-Giles spellings | 423 |
| distinct Yale spellings       | 423 |

Wade-Giles writes both 羅 luó and 咯 lo as `lo`; Yale writes both 額 e and 誒 ê
as `e`. Both are the systems' own doing rather than this module's.

## How the tables were checked

No source in this package's data pipeline carries any of these systems —
CC-CEDICT, Unihan and the phrase corpus are all pinyin — so unlike every other
claim here, the tables could not be scored against the data that ships. They are
scored instead against an outside syllabary: `test/fixtures/syllabary.ts` holds
all 417 rows of Wikipedia's _Comparison of Chinese transcription systems_, and
`src/romanization/syllabary.test.ts` asserts every one of them, in all four
systems.

**The Yale and IPA tables were derived from those columns rather than typed and
then checked against them**, which is a weaker claim than the one bopomofo and
Wade-Giles can make, and is worth saying plainly. What the check is still worth
is compression: one table of initials, one of finals and a handful of context
rules reproduce all 417 attested spellings in each system, and they go on to
write the 12 syllables of this inventory that the source's table does not have.
A table that had simply been copied would do neither.

The two lists differ at the edges and both differences are marginal: 12
syllables here are not in that table (the interjections, the syllabic nasals,
and the rare readings Unihan contributes), and 5 of its rows are not in this
inventory (`diang`, `lüan`, `lün`, `nia`, `shong`, all dialectal or
reconstructed). The rules write those five correctly regardless, since nothing
about them is special.

## On the command line

```console
$ pinyinjs romanize běijīng
běijīng     běijīng   ㄅㄟˇ ㄐㄧㄥ     pei³-ching¹ běijīng   pei˨˩˦tɕiŋ˥

$ pinyinjs romanize --from wade-giles chu¹
chu¹        zhū       ㄓㄨ          chu¹        jū        ʈʂu˥
            chū       ㄔㄨ          ch'u¹       chū       ʈʂʰu˥       marks restored
            jū        ㄐㄩ          chü¹        jyū       tɕy˥        marks restored
            qū        ㄑㄩ          ch'ü¹       chyū      tɕʰy˥       marks restored

$ pinyinjs romanize --from yale syī
syī         xī        ㄒㄧ          hsi¹        syī       ɕi˥
```

`--from` takes `wade-giles`, `yale` or `ipa`. Bopomofo needs none of them: it
has a script of its own. See [the command line](../cli/).

## What is not built

- **Gwoyeu Romatzyh**, which is a different shape of problem from the other
  three and is deliberately left on its own. GR spells the tone into the
  syllable rather than marking it — 山 shān is `shan`, 陝 shǎn is `shaan` and
  二 èr is `ell` — so it is not one mapping over 424 syllables but four, related
  by about twenty rules, with a sonorant exception that swaps what the first two
  tones do.

  It was **measured before being deferred**, because "harder" is not a
  number. The same source has four GR columns, 417 rows each; a throwaway
  implementation of the rules exactly as _Spelling in Gwoyeu Romatzyh_ states
  them writes **1,659 of those 1,668 cells correctly**, and all nine misses are
  one class: a zero-initial syllable whose rime is bare or closed by a
  consonant, in the third and fourth tones, where the stated rule replaces the
  initial i- or u- with y- or w- and the attested form keeps the vowel as well
  — `yih`, `wuh`, `yinn`, `yinq`, `yiin`, `yiing`, `yuh`, `yii`, `wuu`.

  So the writing direction is close to solved and the phase's remaining work is
  everything around it: reading back, where the index has to be built per tone
  because the tone is in the spelling; the neutral tone's leading dot; the `-l`
  suffix for 儿化, which the source itself notes is ambiguous (`jiel` is either
  今儿 or 鸡儿); and the four columns being taken into the fixture.

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
