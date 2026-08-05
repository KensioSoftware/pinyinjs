# Romanisation

Bopomofo (注音符號), Wade-Giles, Yale, Gwoyeu Romatzyh and IPA, in both
directions, at the syllable level. Like [numbers](../numerals/) this needs no
dictionary: a romanisation is a mapping over about 420 syllables, so hanzi →
Wade-Giles is just hanzi → pinyin → Wade-Giles.

```ts
import {
  readSyllable,
  writeBopomofo,
  writeGwoyeu,
  writeIpa,
  writeWadeGiles,
  writeYale,
} from "@kensio/pinyinjs";

const jiu = readSyllable("jiù");
writeBopomofo(jiu); // "ㄐㄧㄡˋ"
writeWadeGiles(jiu); // "chiu⁴"
writeYale(jiu); // "jyòu"
writeGwoyeu(jiu); // "jiow" — the tone is in the spelling
writeIpa(jiu); // "tɕiou˥˩"
```

## Why the tables are short

A parsed syllable holds its **underlying** initial and final rather than its
spelling — 就 is `j` + `iou`, not `j` + `iu`, and 军 is `j` + `ün` — so the
tables fall out of a lookup instead of a second pile of respelling rules. See
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

## Gwoyeu Romatzyh

The odd one. Every other system here writes a syllable and then marks its tone;
GR spells the tone **into** the syllable, so it is not one mapping over 424
syllables but four:

```ts
writeGwoyeu(readSyllable("shān")); // "shan"
writeGwoyeu(readSyllable("shán")); // "sharn"
writeGwoyeu(readSyllable("shǎn")); // "shaan"
writeGwoyeu(readSyllable("shàn")); // "shann"
```

That is why 陝西 is Shaanxi in English and 山西 is Shanxi: the doubled vowel is
GR's third tone, and it is the one piece of the system in everyday use.

The basic form is the first tone, and about twenty rules make the other three
out of it. The shape of all of them is: change a vowel if there is a suitable
one, and otherwise put a letter in.

```ts
const gr = (pinyin: string) => writeGwoyeu(readSyllable(pinyin));
gr("chuán"); // "chwan" — i/u become y/w in the second tone...
gr("cháng"); // "charng" — ...or an r goes in after the vowels
gr("qiǎn"); // "chean" — i/u become e/o in the third...
gr("dǎ"); // "daa" — ...or the main vowel doubles
gr("dào"); // "daw" — the last letter changes in the fourth...
gr("dà"); // "dah" — ...or an h is added
```

Three things are worth knowing:

- **`j`, `ch` and `sh` do two jobs each**, standing for the retroflexes and the
  palatals alike, with the following `i` saying which. Pinyin zhu, ju and jiu
  come out as `ju`, `jiu` and `jiou`, which is the single most confusing thing
  about reading GR next to pinyin.
- **The sonorants swap the first two tones over.** A syllable starting l-, m-,
  n- or r- takes an `-h-` as its second letter in the first tone and is left
  bare in the second, so 媽 mā is `mha` and 麻 má is `ma`. The reason is
  frequency: those initials carry far more second tones than first ones.
- **A syllable with no initial has no y- or w- in the first tone**, and grows
  one in the others: 一 yī is `i`, 疑 yí is `yi`, 已 yǐ is `yii`, 意 yì is
  `yih`.

### The rule the published rules get wrong

That last line is where the published rules break, and it is worth setting out
because it is the whole of what this module had to work out for itself.
_Spelling in Gwoyeu Romatzyh_ says that a basic form starting i- or u- has that
letter **replaced** by y- or w-. Applied literally, 一's basic form `i` gives
`yh` in the fourth tone where the attested spelling is `yih`: the rule has
deleted the only vowel the syllable had. Nine cells of the syllabary below fail
that way, and they are all one shape — a rime that is bare or closed by a
consonant, in the third and fourth tones: `yii`, `yih`, `wuu`, `wuh`, `yiin`,
`yinn`, `yiing`, `yinq`, `yuh`.

The same page's rime table says what actually happens, and it is one rule rather
than the published two: **the letter replaced is a medial**, so it goes only
when a different vowel follows it. `iuh` has a u after the i and becomes `yuh`;
`ih` has an h and becomes `yih`; `ii` is one vowel written twice, which is not a
following vowel at all, and becomes `yii`. The third tone needs no separate
clause once that is said, because its own swap has already eaten the medial
wherever there was one.

With that one word corrected, the rules write **all 1,668 cells** of the
syllabary's four GR columns.

### The neutral tone, and 儿化

```ts
writeGwoyeu(readSyllable("de5")); // ".de" — the dot is in front
writeGwoyeu(readSyllable("huār")); // "hual" — 儿化 is an -l
readGwoyeu("shaan"); // [shǎn]
readGwoyeu("ell"); // [èr, ērr] — 二, and the same rime in tone 1 plus -l
```

Both of those come with a caveat this module states rather than hides:

- **GR keeps the syllable's etymological tone behind the dot** — 朋友 is
  `perng.yeou`, with 友 still spelled as the third tone it came from. A neutral
  pinyin syllable does not record what that tone was, so what is written here is
  the basic form: `perng.iou`. Reading is not so limited, and a dot in front of
  any tonal spelling reads as the neutral tone, which is what GR means by it.
- **GR's `-l` is a fusion rather than a suffix.** 一點兒 yìdiǎnr is `ideal`,
  where `dean` has lost its `-n`, and the fusion collapses syllables that were
  distinct — the source's own example is that `jiel` is either 今兒 or 雞兒.
  Modelling that needs a rime-by-rime table of rhotacised forms, which is a
  phonological claim rather than a spelling convention, and it is the same line
  the IPA module draws around its suffixed [ɚ]. So this module's 儿化 always
  reads back and GR's own does not.

### Reading it back

An index like the others, but built four times over, because the tone is in the
spelling rather than on it. Over the 424 syllables of the inventory that is
1,696 spellings, and **1,695 of them are distinct** — GR separates every
syllable in every tone but one:

```ts
readGwoyeu("nn"); // [ň, ǹ] — the syllabic nasal, and nothing else collides
```

唔 is not in the syllabary at all, and nothing in GR is attested for a syllabic
nasal; what it gets here is the general rules applied to the letters it has,
where the third tone's doubling and the fourth tone's `-n` → `-nn` land in the
same place.

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

## Splitting a word that dropped its hyphens

Wade-Giles hyphenates its syllables and the hyphen is not decoration: the system
has no 隔音符号 to fall back on, because its apostrophe marks aspiration instead.
Real text drops the hyphen anyway, so `splitWadeGiles` puts it back.

```js
splitWadeGiles("maotsetung"); // ["mao", "tse", "tung"]
splitWadeGiles("mao-tse-tung"); // the same, hyphens honoured
splitWadeGiles("hua-êrh"); // ["hua-êrh"] — that hyphen is part of 花儿
readWadeGilesWord("pei³ching¹"); // 北京, běijīng
```

`pnpm romanization` measures it over the same 411,956 multi-syllable words of
the phrase corpus the ambiguity figures above come from, written in Wade-Giles
and run together:

|                       | marks kept | marks dropped |
| --------------------- | ---------: | ------------: |
| the boundary is found |     99.19% |        99.04% |
| the word comes back   |     99.45% |        56.04% |

**Finding the boundary is not the hard part; saying which syllable it was is.**
The boundary is found either way. What collapses is the reading, and only once
the marks are gone — because [half of running
text](#how-ambiguous-is-wade-giles-really) is then ambiguous a syllable at a
time, and a word has to get every one of its syllables right.

The true split is among the candidates 100.00% of the time and is the only
candidate 17.08% of the time, at a mean of 5.23 candidates per word, so
longest-first is a choice among real rivals rather than the only reading going.
It comes back whole slightly _more_ often than it finds the boundary, because
two of the variant spellings read the same either way.

The 0.81% of boundaries that are missed are one mechanism. Wade-Giles ends
syllables in -n and -ng and begins them with vowels and with n-, so `i-ti-hu-na`
run together as `itihuna` comes back `i-ti-hun-a`. Of 3,317 misses, 53.39%
swallow a syllable beginning with n- and 36.72% one beginning with a vowel.
Pinyin is spared most of this by spelling a zero-initial i- as `yi-`; Wade-Giles
writes 一 as `i`, and 960 of the misses — 28.94% — are a swallowed 一.

### The syllabic nasals are barred from a split

嗯 `ng`, 呣 `m`, 唔 `n`, 噷 `hm` and 哼 `hng` are syllables and read as such on
their own, but never as one piece of a longer run: **not one** of the 411,956
multi-syllable words has a syllabic nasal anywhere in it. Without the bar, `ng`
would let any run ending in -ng come apart — `shung` is regular Wade-Giles for a
syllable Mandarin does not have, and `shu` + `ng` would hand it back through the
side door after [the index](#reading-it-back-is-the-hard-part) had refused it.

### Chungking is not Wade-Giles

The name this was built for turns out to be the wrong example, and so are most
of the others. `Chungking`, `Tsingtao`, `Peking`, `Nanking` and `Canton` are
[Postal Romanisation](https://en.wikipedia.org/wiki/Chinese_postal_romanization),
which is a different system and largely a list — `king`, `tsing`, `pe`, `can`
and `ton` are not Wade-Giles syllables at all. 重慶 in Wade-Giles is
`chʻung²-chʻing⁴` and 青島 is `chʻing¹-tao³`. `splitWadeGiles` returns undefined
for all of them, which is the honest answer rather than a gap.

`Mao Tse-tung`, `Taipei` and `Kuomintang` really are Wade-Giles, and those are
the cases this handles.

## What round-trips

Exhaustively, every syllable of the inventory in every tone state, with and
without 儿化 — 5,088 forms:

|                                        |       |
| -------------------------------------- | ----: |
| Wade-Giles read back exactly           | 5,088 |
| Yale read back exactly, `tones` marked | 4,240 |
| Yale read back exactly, `tones` 1 to 5 | 5,088 |
| bopomofo read back exactly             | 4,240 |
| Gwoyeu Romatzyh read back exactly      | 4,240 |
| IPA read back exactly                  | 4,240 |

Every miss in that table is a tone that the system cannot write, and there are
only two such tones between the four of them:

- **bopomofo** marks the first tone by omission, so a syllable whose tone was
  never written comes back as a first tone. 848 forms.
- **Gwoyeu Romatzyh** has the same 848, for a reason that looks nothing like
  bopomofo's and comes to the same thing: the basic form _is_ the first tone,
  so there is no spelling left over to mean "no tone was written". It is the
  only system here that can write the neutral tone but not the absence of one.
- **Yale** and pinyin both leave the neutral tone unmarked, so a syllable
  written `de` might be neutral or might have no tone written at all. 848 forms,
  and `{ tones: "numbers" }` is the notation that keeps them apart.
- **IPA** has no tone letter for the neutral tone, because it has no contour.
  848 forms, and there is no option that fixes it: a letter would have to be
  invented.

Wade-Giles loses nothing, because it writes all five tones as digits and never
writes one by leaving it off. Every written tone in every system round-trips.

How many syllables each system can tell apart, over the 424 of the inventory —
for GR the basic form, so that all five are being asked the same question:

|                                |     |
| ------------------------------ | --: |
| distinct bopomofo spellings    | 424 |
| distinct Gwoyeu Romatzyh forms | 424 |
| distinct IPA transcriptions    | 424 |
| distinct Wade-Giles spellings  | 423 |
| distinct Yale spellings        | 423 |

Wade-Giles writes both 羅 luó and 咯 lo as `lo`; Yale writes both 額 e and 誒 ê
as `e`. Both are the systems' own doing rather than this module's.

GR is the one system where that count is not the whole story, because it writes
the tone as well. Over the same inventory in all four tones:

|                            |       |
| -------------------------- | ----: |
| syllables × the four tones | 1,696 |
| distinct GR spellings      | 1,695 |

The one collision is 唔 `nn`, which the syllabary does not list and GR has no
attested spelling for.

## hanzi to Wade-Giles, end to end

hanzi → pinyin → Wade-Giles, which is the shape this package was designed
around: a transcription needs no dictionary of its own, so the only hard problem
is the one the decoder already solved.

```js
convertToWadeGiles(dictionary, "我要去北京。", { notation: "none" });
// "Wo yao ch'ü Pei-ching."
convertToWadeGiles(dictionary, "北京");
// "Pei³-ching¹"
```

```console
$ pinyinjs convert --system wade-giles --notation none 我要去北京大学。
Wo yao ch'ü Pei-ching-ta-hsüeh.

$ pinyinjs convert --system bopomofo 我要去北京大学。
ㄨㄛˇ ㄧㄠˋ ㄑㄩˋ ㄅㄟˇ ㄐㄧㄥ ㄉㄚˋ ㄒㄩㄝˊ.
```

### The word segmentation is shared and only the join changes

This is the question the roadmap left open, and it comes apart into two.

GB/T 16159 分词连写 decides what a **word** is, and that is a fact about the
language rather than about pinyin: 北京大学 is two words in any system anybody
writes it in. What the standard _also_ decides — that a word's syllables are run
together, with a 隔音符号 where the boundary would otherwise be lost — is a
pinyin spelling rule, and Wade-Giles has one of its own: a hyphen between every
syllable of a word, and a space between words. So the grouping is reused and the
join is the system's.

Two things follow:

- **The 隔音符号 is not written.** 西安 is `Hsi-an`, not `Hsi'an`. It would be
  wrong twice over — the hyphen has already marked the boundary, and Wade-Giles
  spends the apostrophe on aspiration, so `Hsi'an` reads as `hsi` followed by an
  aspirated syllable.
- **Every other system gets the same treatment**, since each already declares
  its own join: bopomofo spaces its syllables, Yale and Gwoyeu Romatzyh write
  them solid as pinyin does. `--system` takes any of the five.

`--notation none` leaves the tone off where the system writes it separately —
Wade-Giles, Yale and IPA. Bopomofo marks the tone with a symbol of the script
and Gwoyeu Romatzyh spells it into the syllable, so for those two there is
nothing to leave off and the flag is ignored rather than approximated.

### What it gets right, and what it inherits

Read back word by word — the hyphens keep the boundaries, so the only thing that
can be lost is Wade-Giles's own non-injectivity — **99.50% of 140,163 words**
over 20,000 Tatoeba sentences come back as the pinyin they were written from.

Against the forms in general use before 1979, hand-checked, **10 of 15 match
exactly**:

|        |                   |
| ------ | ----------------- |
| 重庆   | `Ch'ung-ch'ing`   |
| 青岛   | `Ch'ing-tao`      |
| 台北   | `T'ai-pei`        |
| 国民党 | `Kuo-min-tang`    |
| 北京   | `Pei-ching`       |
| 南京   | `Nan-ching`       |
| 黑龙江 | `Hei-lung-chiang` |
| 四川   | `Ssŭ-ch'uan`      |
| 广东   | `Kuang-tung`      |
| 西安   | `Hsi-an`          |

**The five that do not are word boundaries, and the hyphen rule is not wrong in
any of the fifteen.** 毛泽东 comes out `Mao-tsê-tung` where the attested form is
`Mao Tse-tung`, and 北京大学 comes out `Pei-ching-ta-hsüeh` against
`Pei-ching ta-hsüeh` — and the pinyin has exactly the same defect in exactly the
same place, `Máozédōng` and `Běijīngdàxué`, where GB/T 16159 5.1 wants 姓 and 名
apart and a proper noun apart from its generic. Supply the boundary by hand and
`北京 大学` gives `Pei-ching ta-hsüeh` outright. That is the grouping's to fix,
and it is on Phase 4's list rather than this one.

## How the tables were checked

No source in this package's data pipeline carries any of these systems —
CC-CEDICT, Unihan and the phrase corpus are all pinyin — so unlike every other
claim here, the tables could not be scored against the data that ships. They are
scored instead against an outside syllabary: `test/fixtures/syllabary.ts` holds
all 417 rows of Wikipedia's _Comparison of Chinese transcription systems_, and
`src/romanization/syllabary.test.ts` asserts every one of them, in all five
systems — 3,336 cells, since GR has four columns to everyone else's one.

**The Yale and IPA tables were derived from those columns rather than typed and
then checked against them**, which is a weaker claim than the one bopomofo and
Wade-Giles can make, and is worth saying plainly. What the check is still worth
is compression: one table of initials, one of finals and a handful of context
rules reproduce all 417 attested spellings in each system, and they go on to
write the 12 syllables of this inventory that the source's table does not have.
A table that had simply been copied would do neither.

**Gwoyeu Romatzyh is checked the strongest way any of them is**, and it is worth
saying that too. Its tables and every one of its tonal rules were written from a
_different page_ — _Spelling in Gwoyeu Romatzyh_, which states them in prose —
and then scored against the four columns of this one, which is a different page
maintained by different people. All 1,668 cells. The one amendment the prose
needed came from that page's rime table rather than from the columns being
scored against, so nothing here was fitted to its own test.

The two lists differ at the edges and both differences are marginal: 12
syllables here are not in that table (the interjections, the syllabic nasals,
and the rare readings Unihan contributes), and 5 of its rows are not in this
inventory (`diang`, `lüan`, `lün`, `nia`, `shong`, all dialectal or
reconstructed). The rules write those five correctly regardless, since nothing
about them is special.

## On the command line

```console
$ pinyinjs transcribe běijīng
běijīng     běijīng   ㄅㄟˇ ㄐㄧㄥ     pei³-ching¹ běijīng   beeijing  pei˨˩˦tɕiŋ˥

$ pinyinjs transcribe --from wade-giles chu¹
chu¹        zhū       ㄓㄨ          chu¹        jū        ju        ʈʂu˥
            chū       ㄔㄨ          ch'u¹       chū       chu       ʈʂʰu˥       marks restored
            jū        ㄐㄩ          chü¹        jyū       jiu       tɕy˥        marks restored
            qū        ㄑㄩ          ch'ü¹       chyū      chiu      tɕʰy˥       marks restored

$ pinyinjs transcribe --from wade-giles maotsetung
maotsetung  maocedong ㄇㄠ ㄘㄜ ㄉㄨㄥ   mao-ts'ê-tung  mautsedung  mhautsedong  mautsʰɤtʊŋ  marks restored

$ pinyinjs transcribe --from yale syī
syī         xī        ㄒㄧ          hsi¹        syī       shi       ɕi˥

$ pinyinjs transcribe --from gwoyeu ell
ell         èr        ㄦˋ          êrh⁴        èr        ell       aɚ˥˩
            ērr       ㄦㄦ          êrh-êrh¹    ērr       ell       aɚɚ˥
```

`--from` takes `wade-giles`, `yale`, `gwoyeu` or `ipa`. Bopomofo needs none of
them: it has a script of its own. See [the command line](../cli/).

## What is not built

- **GR's rhotacised forms**, which are a fusion rather than the plain `-l`
  suffix written here, and **the etymological tone behind a neutral syllable's
  dot**, which pinyin does not record. Both are set out under
  [Gwoyeu Romatzyh](#gwoyeu-romatzyh) above.
- **姓 and 名 written apart**, which is the one thing standing between this and
  the attested forms of personal names. GB/T 16159 5.1 asks for it and the
  grouping does not do it, in pinyin either — see
  [what it inherits](#what-it-gets-right-and-what-it-inherits).
- **Postal Romanisation** (`Peking`, `Tsingtao`, `Canton`), which is not a
  system so much as a list, and is not derivable from any of this. See
  [Chungking is not Wade-Giles](#chungking-is-not-wade-giles).
