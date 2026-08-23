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
writeGwoyeu(jiu); // "jiow", with the tone in the spelling
writeIpa(jiu); // "tɕiou˥˩"
```

## Why the tables are short

A parsed syllable holds its **underlying** initial and final rather than its
spelling: 就 is `j` + `iou`, not `j` + `iu`, and 军 is `j` + `ün`, so the tables
fall out of a lookup instead of a second pile of respelling rules. See
[syllables](../syllables/).

That is most of the reason bopomofo is a straight bijection: ㄐㄧㄡ is the
underlying form written symbol for symbol.

## Bopomofo

```ts
writeBopomofo(readSyllable("zhōng")); // "ㄓㄨㄥ", ong is ㄨ + ㄥ
writeBopomofo(readSyllable("zhī")); // "ㄓ", the empty rhyme is not written
writeBopomofo(readSyllable("ma5")); // "˙ㄇㄚ", the neutral dot goes in front
readBopomofo("ㄒㄩㄥˊ"); // xióng
```

Three things are worth knowing:

- **The first tone is unmarked**, as the standard writes it. `readBopomofo`
  therefore reads an unmarked syllable as a first tone, because the omission is
  written, unlike a bare `bei` typed as pinyin, where nothing was written either
  way. Pass `{ firstTone: "mark" }` to write ˉ and keep the two apart.
- **ㄦ is the 儿化 suffix everywhere except at the front of a syllable**, where
  it is 兒 itself. 事儿 shìr is ㄕㄦ, with no rhyme for the ㄦ to attach to, and
  二儿 is ㄦㄦ. **The tone mark goes in front of that ㄦ** rather than after it,
  so 哪儿 nǎr is ㄋㄚˇㄦ, because the mark belongs to the nucleus and the suffix
  is not part of what it marks. A mark written after the ㄦ is read anyway.
- **ㄫ, the obsolete letter, writes the syllabic ng** of 嗯 ǹg, so that it does
  not collide with the rare 鞥 ēng.

Bopomofo also has a script of its own, which is why `isBopomofo` can tell it
apart from pinyin and Wade-Giles cannot be told apart from either.

## Wade-Giles

Writing it is a table with a few context rules. The ones that trip people up are
the whole stop series being shifted, so pinyin b is `p` and pinyin p is `p'`:

```ts
writeWadeGiles(readSyllable("běi"), { tones: "none" }); // "pei"
writeWadeGiles(readSyllable("gē"), { tones: "none" }); // "ko", -e is o after k
writeWadeGiles(readSyllable("zuò"), { tones: "none" }); // "tso", -uo loses its u
writeWadeGiles(readSyllable("guì"), { tones: "none" }); // "kuei", not "kui"
writeWadeGiles(readSyllable("zī"), { tones: "none" }); // "tzŭ"
writeWadeGilesWord([readSyllable("běi"), readSyllable("jīng")]); // "pei³-ching¹"
```

The tone is a raised digit, which is what Wade-Giles writes; `{ tones: "numbers"
}` puts it on the line and `{ tones: "none" }` leaves it off. A word hyphenates,
because Wade-Giles has no 隔音符号 and the hyphen is what marks the boundary.

儿化 hangs off the syllable as a reduced `-'rh`, with the tone digit staying
with the syllable it belongs to:

```ts
writeWadeGiles(readSyllable("wánr")); // "wan²-'rh"
writeWadeGiles(readSyllable("èr")); // "êrh⁴", 兒 as a syllable keeps its own
```

The suffix is written short precisely so that the two stay apart: 女儿 nǚ'ér is
`nü³-êrh²`, two syllables, and a suffix spelled `-êrh` would be the same string.

### Reading it back is the hard part

`readWadeGiles` returns an **array**, because one spelling can be several
syllables. That is true even of correctly written Wade-Giles, in two places:

```ts
readWadeGiles("chiu⁴"); // [jiù]
readWadeGiles("lo"); // [luo, lo], 羅 and 咯 spelled alike
readWadeGiles("o¹"); // [ō, ē]
```

And then there is what actually turns up in books, where the apostrophes and
the diacritics have been dropped: `Tsingtao`, `Chungking`, `Mao Tse-tung`.
`readWadeGilesLoosely` allows for that:

```ts
readWadeGilesLoosely("chi¹"); // [jī, qī]: chi is jī, ch'i is qī
readWadeGilesLoosely("chu¹"); // [zhū, chū, jū, qū]
readWadeGilesLoosely("hsueh²"); // [xué], hsüeh with no diaeresis
```

**Marks are allowed to be missing, never to be wrong.** `ch'u` has kept its
apostrophe, so whatever it is, it is not 朱 `chu` or 居 `chü`; only the diaeresis
is in question, and it reads as chū or qù and nothing else. Allowing for a
spurious mark would double every candidate list to catch a mistake nobody makes.

The exact readings come first in the list, so taking the head amounts to
believing the text wrote what it meant.

### The tone narrows the list

A spelling that stands for two syllables is often only ambiguous on paper,
because a syllable is written in some tones and not in others. 咯 `lo` is a
sentence-final particle and is only ever neutral, so a `lo` with a tone digit on
it can only be the other one:

```ts
readWadeGiles("lo²"); // [luó], ló is not a syllable Mandarin writes
readWadeGiles("lo⁵"); // [luo, lo], neutral, and both are real
readWadeGilesLoosely("pan²"); // [pán], bán is not one either
```

That is `SYLLABLE_TONES` doing the work: 424 syllables in five tones would be
2,120 combinations and only **1,708 of them are ever written**, so a fifth of
what a reader could hand back is a syllable no Chinese word is read with. See
[syllables](../syllables/#which-tones-a-syllable-is-written-in).

**Narrowing never empties the list.** `fiao²` reads as fiáo, which 覅 is not: a
tone no candidate is written in says the tone is wrong rather than the spelling,
and refusing a spelling outright is the inventory's job, done before there is a
candidate at all.

## Yale

Written for American soldiers in 1943, and it shows: the aspiration pairs read
as English reads them, so pinyin b is `b` and pinyin p is `p`, and 知 is `jr`
because that is what an unprepared reader would say.

```ts
writeYaleSpelling(readSyllable("xī")); // "syi", x is sy, alone among the palatals
writeYaleSpelling(readSyllable("zhī")); // "jr", the empty rhyme is a letter
writeYaleSpelling(readSyllable("rì")); // "r", and is never written twice
writeYaleSpelling(readSyllable("bō")); // "bwo", -o after a labial is really -uo
writeYaleSpelling(readSyllable("dūn")); // "dwun", where 文 alone is "wen"
writeYale(readSyllable("jiù")); // "jyòu", pinyin's own diacritics
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
readYale("ér"); // [ér, ér, ếr]: 兒, and either syllable Yale spells "e" plus the suffix
```

## IPA

Not a romanisation at all but a transcription, and the one table here that says
something about the language rather than about a spelling convention. It is
also the most compositional: an initial symbol and a final symbol, with **no
zero-initial forms whatever**, because y and w are spellings and IPA does not
spell.

```ts
writeIpaSymbols(readSyllable("yī")); // "i", no y
writeIpaSymbols(readSyllable("wén")); // "uən", the same final as 敦 "tuən"
writeIpaSymbols(readSyllable("tiān")); // "tʰiɛn", pinyin's one e is three vowels
writeIpaSymbols(readSyllable("zhī")); // "ʈʂɨ", and its one i is two
writeIpa(readSyllable("mǎ")); // "ma˨˩˦", Chao's tone letters
writeIpa(readSyllable("mǎ"), { tones: "numbers" }); // "ma214"
```

The transcription is the broad one of the IPA column of Wikipedia's _Comparison
of Standard Chinese transcription systems_, which is where the syllabary below
comes from, so the table and its ground truth are the same analysis rather than
two.

**Wikipedia has a second IPA table and the two do not agree.**
_Help:IPA/Mandarin_ is the key its editors transcribe articles with, and it is
the narrower of the two in four places:

|                 | the syllabary, and this | _Help:IPA/Mandarin_ |
| --------------- | ----------------------- | ------------------- |
| the medials     | i, u, y                 | j, w, ɥ             |
| -ang            | aŋ                      | ɑŋ                  |
| the empty rhyme | ɨ                       | ɻ̩ and ɹ̩             |
| the diphthongs  | ai au ei ou             | aɪ aʊ eɪ oʊ         |

Both are scored against: all 50 rows of the key are in
`test/fixtures/ipa-mandarin.ts`, and the twelve rows where they part are
recorded there one by one, along with the reason. The other two of the twelve
are tones: the key writes the third tone as the pitches it is realised at rather
than as a citation contour, and gives the neutral tone a pitch where this writes
no letter at all.

Two things it shares with Yale and one it does not:

- **-o after a labial is [uo]**: 波 bō is `puo` while 咯 lo is `lɔ`. Yale makes
  the same split, from `bwo` against `lo`: two systems agreeing rather than one
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

### A third source, and what it settles

The two Wikipedia tables above are conventions, and a convention cannot settle
which of them is right. The IPA's **own** Illustration of Standard Chinese, Lee
& Zee (2003) in the _Journal of the IPA_, is a description rather than a
convention, and it settles most of what the two disagree about by not choosing
between them: it writes the broad symbol, and states the narrow realisation
separately.

Its example words, against this:

|          | Lee & Zee | this    |
| -------- | --------- | ------- |
| 说 shuō  | [ʂuo˥]    | `ʂuo˥`  |
| 虾 xiā   | [ɕia˥]    | `ɕia˥`  |
| 花 huā   | [xua˥]    | `xua˥`  |
| 香 xiāng | [ɕiaŋ˥]   | `ɕiaŋ˥` |
| 哀 āi    | [ai˥]     | `ai˥`   |
| 凹 āo    | [au˥]     | `au˥`   |
| 欧 ōu    | [ou˥]     | `ou˥`   |
| 黑 hēi   | [xei˥]    | `xei˥`  |
| 衣 yī    | [i˥]      | `i˥`    |

Nine words, character for character, medials and diphthongs and -ang and all.
The narrow values are given by the same paper, in its conventions:

> `[ai]=[aɪ]`, `[au]=[a̠ʊ]`, `[ou]=[o̝u]`, `[uo]=[uo̝]`, `[ei]=[e̞i]` … In
> syllables closed by a nasal … `[a]=[a̠]`

So `[aɪ]` and a backed a before -ŋ are real, **as narrow realisations of these
symbols**, which is what _Help:IPA/Mandarin_ has taken up into its key. Two
details are worth having, since a narrower reading is often given as neither:

- the a of -ang is **retracted `[a̠]`, not back `[ɑ]`**
- the second element of uo is **raised `[o̝]`**, closer than cardinal [o], where
  `[ɔ]` would be opener

Their tone table is headed **citation forms**, and the sandhi is a separate rule
about compounds: `[˧˩˧]` → `[˧˥]` before another `[˧˩˧]`, and → low before
`[˥ ˧˥ ˥˩]` or the neutral tone. That is the line this draws as well: a syllable
in and a syllable out, with 三声 sandhi a level up, in
[the sandhi page](../sandhi/) and behind `--third-tone`. Their own citation
contour is the dipping `[˧˩˧]` rather than Chao's `[˨˩˦]`, which is one of the
two tone rows in the twelve above.

**Where they and this part company is the zero-initial syllable.** Their
consonant table has 蛙 wā as [wa˥] and 鸭 yā as [ja˥], approximants, while 衣 yī
is plain [i˥], with the glide written where a vowel follows it and not where
none does. This writes no glide anywhere, so 我 wǒ is `uo˨˩˦` rather than [wo˨˩˦].
It is the one place the broad column is a simplification rather than a level of
detail, and it is a spelling convention either way: nothing about the sound is
in dispute.

#### References

- Lee, Wai-Sum & Zee, Eric (2003). Standard Chinese (Beijing). _Journal of the
  International Phonetic Association_ 33(1), 109–112.
  [doi:10.1017/S0025100303001208](https://doi.org/10.1017/S0025100303001208)
- [_Comparison of Standard Chinese transcription systems_](https://en.wikipedia.org/wiki/Comparison_of_Standard_Chinese_transcription_systems),
  Wikipedia: the 417-row syllabary in `test/fixtures/syllabary.ts`, and the IPA
  column this follows
- [_Help:IPA/Mandarin_](https://en.wikipedia.org/wiki/Help:IPA/Mandarin),
  Wikipedia: the 50-row key in `test/fixtures/ipa-mandarin.ts`

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
gr("chuán"); // "chwan", i/u become y/w in the second tone...
gr("cháng"); // "charng", ...or an r goes in after the vowels
gr("qiǎn"); // "chean", i/u become e/o in the third...
gr("dǎ"); // "daa", ...or the main vowel doubles
gr("dào"); // "daw", the last letter changes in the fourth...
gr("dà"); // "dah", ...or an h is added
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
that way, and they are all one shape: a rime that is bare or closed by a
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

### The neutral tone

The dot goes in front, and **the syllable behind it keeps the tonal spelling it
had before it was reduced**: 没有 méiyou is `mei.yeou`, with 友 still spelled as
the third tone it came from. Pinyin does not write that tone anywhere, so a
syllable carries it explicitly:

```ts
writeGwoyeu({ ...readSyllable("you5"), originalTone: 3 }); // ".yeou"
writeGwoyeu(readSyllable("you5")); // ".iou", no original tone to keep
readGwoyeu(".yeou"); // [you, originalTone 3]
```

Without one the basic form goes behind the dot, which is what GR itself writes
for a syllable that is neutral in its own right: 什么 shénme is `shern.me`, and
never `shern.mhe`: the `-h-` is the first tone of a sonorant initial, and 么 is
not in the first tone, it is in no tone at all.

`originalTone` is a field on a parsed [syllable](../syllables/), and nothing
infers it: a syllable that arrives neutral and nothing else leaves it undefined.
GR is the only system here with any use for it, every other one writing the
neutral tone with a mark of its own.

### 儿化 is a fusion, not a suffix

GR transcribes 儿化 as it is said rather than as it is spelled, which makes it a
table rather than an `-l` on the end:

```ts
writeGwoyeu(readSyllable("huār")); // "hual"
writeGwoyeu(readSyllable("wánr")); // "wal", the -n is not there to hear
writeGwoyeu(readSyllable("shìr")); // "shell", the empty rhyme has gone
writeGwoyeu(readSyllable("zhèr")); // "jehl"
writeGwoyeu(readSyllable("diǎnr")); // "deal", as in 一點兒 `ideal`
```

The rules are those of _Spelling in Gwoyeu Romatzyh_, which gives them rime by
rime: `-y` becomes `e`, `i` and `in` become `ie`, `ing` becomes `ieng`, every
other `-n` disappears, and so does the asyllabic `-i` of `ai` and `uei`. The
tonal rules then apply to what is left, and the fourth tone doubles the `-l`
except where the rime has a fourth tone of its own to spell: `dawl`, `anql`,
`ehl`.

**The fusion is many-to-one, and that is the system rather than this module.**
The source makes the point itself: `jiel` is 今兒 jīnr and 雞兒 jīr alike,
because neither has an `-n` left to tell them apart.

```ts
readGwoyeu("jiel"); // [jīr, jīnr]
readGwoyeu("hual"); // [huār, huānr]
readGwoyeu("ell"); // [èir, ènr, èr]: 二, and two rimes that fuse to the same el
```

Which is why GR round-trips fewer forms than the systems that spell 儿化 as a
suffix: see [what round-trips](#what-round-trips).

### Reading it back

An index like the others, but built four times over, because the tone is in the
spelling rather than on it. Over the 424 syllables of the inventory that is
1,696 spellings, and **1,695 of them are distinct**: GR separates every syllable
in every tone but one:

```ts
readGwoyeu("nn"); // [ň, ǹ], the syllabic nasal, and nothing else collides
```

唔 is not in the syllabary at all, and nothing in GR is attested for a syllabic
nasal; what it gets here is the general rules applied to the letters it has,
where the third tone's doubling and the fourth tone's `-n` → `-nn` land in the
same place.

## How ambiguous is Wade-Giles, really?

`pnpm transcription` measures it. Over the 424 syllables of the
[inventory](../syllables/#well-formed-and-attested-are-different-questions):

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
| the same, with the tone digit written   | 851,334 (82.66%) |

So **half of running text is ambiguous once the marks are dropped**, and
believing what was written recovers about four fifths of it. That is the honest
ceiling for a syllable at a time; a decoder with a dictionary and neighbouring
syllables to look at could do better, and this module deliberately does not
guess.

The last row is what [the tone](#the-tone-narrows-the-list) is worth: 37,114
more syllables, from a digit that is often not there in the first place. Most
Wade-Giles in the wild carries no tones at all, so the 79.05% is the figure to
plan around and the 82.66% is the ceiling for a text that does write them.
1.33% of the corpus is neutral and so has no digit to write either way.

## Splitting a word that dropped its hyphens

Wade-Giles hyphenates its syllables and the hyphen is not decoration: the system
has no 隔音符号 to fall back on, because its apostrophe marks aspiration instead.
Real text drops the hyphen anyway, so `splitWadeGiles` puts it back.

```js
splitWadeGiles("maotsetung"); // ["mao", "tse", "tung"]
splitWadeGiles("mao-tse-tung"); // the same, hyphens honoured
splitWadeGiles("hua¹-'rh"); // ["hua¹-'rh"], that hyphen is part of 花儿
splitWadeGiles("hua-êrh"); // ["hua", "êrh"], and this one is not: 花兒, huā ér
readWadeGilesWord("pei³ching¹"); // 北京, běijīng
```

`pnpm transcription` measures it over the same 411,956 multi-syllable words of
the phrase corpus the ambiguity figures above come from, written in Wade-Giles
and run together:

|                       | marks kept | marks dropped |
| --------------------- | ---------: | ------------: |
| the boundary is found |     99.19% |        99.04% |
| the word comes back   |     99.45% |        56.04% |

**Finding the boundary is not the hard part; saying which syllable it was is.**
The boundary is found either way. What collapses is the reading, and only once
the marks are gone, because [half of running
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
writes 一 as `i`, and 960 of the misses (28.94%) are a swallowed 一.

### The syllabic nasals are barred from a split

嗯 `ng`, 呣 `m`, 唔 `n`, 噷 `hm` and 哼 `hng` are syllables and read as such on
their own, but never as one piece of a longer run: **not one** of the 411,956
multi-syllable words has a syllabic nasal anywhere in it. Without the bar, `ng`
would let any run ending in -ng come apart: `shung` is regular Wade-Giles for a
syllable Mandarin does not have, and `shu` + `ng` would hand it back through the
side door after [the index](#reading-it-back-is-the-hard-part) had refused it.

### Chungking is not Wade-Giles

The name this was built for turns out to be the wrong example, and so are most
of the others. `Chungking`, `Tsingtao`, `Peking`, `Nanking` and `Canton` are
[Postal Romanisation](https://en.wikipedia.org/wiki/Chinese_postal_romanization),
which is a different system and largely a list: `king`, `tsing`, `pe`, `can` and
`ton` are not Wade-Giles syllables at all. 重慶 in Wade-Giles is
`chʻung²-chʻing⁴` and 青島 is `chʻing¹-tao³`. `splitWadeGiles` returns undefined
for all of them, which is the honest answer rather than a gap.

`Mao Tse-tung`, `Taipei` and `Kuomintang` really are Wade-Giles, and those are
the cases this handles.

## What round-trips

Exhaustively, every syllable of the inventory in every tone state, with and
without 儿化, 5,088 forms:

|                                        |       |
| -------------------------------------- | ----: |
| Wade-Giles read back exactly           | 5,080 |
| Yale read back exactly, `tones` marked | 4,239 |
| Yale read back exactly, `tones` 1 to 5 | 5,085 |
| bopomofo read back exactly             | 4,240 |
| Gwoyeu Romatzyh read back exactly      | 4,112 |
| IPA read back exactly                  | 4,239 |

Almost every miss in that table is a tone that the system cannot write, and
there are only two such tones between the four of them:

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

Wade-Giles loses nothing to a tone it cannot write, because it writes all five
as digits and never writes one by leaving it off.

The rest of the misses, eight in Wade-Giles, one each in Yale and IPA, 128 in
GR and three in numbered Yale, are the price of [narrowing on the
tone](#the-tone-narrows-the-list), and every one of them is a form Mandarin does
not write:

- **`lo` in the four contour tones**, with and without 儿化, which is the eight.
  Wade-Giles spells 羅 and 咯 alike and 咯 is only ever neutral.
- **`ēr`**, in every system that spells 兒 the way it spells another syllable
  plus 儿化. There is no first-tone 兒, so `ēr` is 啊儿 ār and `ell` is 二 èr.
- **a neutral 誒 `ê`**, in numbered Yale, which is the only notation that can
  say "neutral" over a spelling Yale shares between 額 and 誒. 誒 is written in
  the four contour tones and not in the neutral one.
- **GR's 128** are the [fusion](#儿化-is-a-fusion-not-a-suffix), which is a
  different mechanism reaching the same place. One rhotacised spelling is
  several syllables, since `barl` is 拔儿 bár and 掰儿 báir alike, and where the
  form written in is one the language does not read, narrowing hands back the ones
  it does and not that. 37 of them are neutral and 91 are not.

A round trip through one of those is a round trip through a syllable no Chinese
word is read with. Every form the language does write still comes back: 1,708
syllable-and-tone combinations, with and without 儿化.

How many syllables each system can tell apart, over the 424 of the inventory,
taking GR's basic form so that all five are asked the same question:

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
writes it in. What the standard _also_ decides, that a word's syllables are run
together with a 隔音符号 where the boundary would otherwise be lost, is a pinyin
spelling rule, and Wade-Giles has one of its own: a hyphen between every
syllable of a word, and a space between words. So the grouping is reused and the
join is the system's.

Two things follow:

- **The 隔音符号 is not written.** 西安 is `Hsi-an`, not `Hsi'an`. It would be
  wrong twice over: the hyphen has already marked the boundary, and Wade-Giles
  spends the apostrophe on aspiration, so `Hsi'an` reads as `hsi` followed by an
  aspirated syllable.
- **Every other system gets the same treatment**, since each already declares
  its own join: bopomofo spaces its syllables, Yale and Gwoyeu Romatzyh write
  them solid as pinyin does. `--system` takes any of the five.

`--notation none` leaves the tone off where the system writes it separately, in
Wade-Giles, Yale and IPA. Bopomofo marks the tone with a symbol of the script
and Gwoyeu Romatzyh spells it into the syllable, so for those two there is
nothing to leave off and the flag is ignored rather than approximated.

### The capitals belong to the romanisations only

What the grouping settles about a capital, for a proper noun and for the first
word of a sentence, carries over to Wade-Giles, Yale and Gwoyeu Romatzyh, because a
romanisation is a way of writing Chinese in the Latin alphabet and inherits what
that alphabet does. **IPA is not a romanisation and takes none of them.** Its
letters are symbols rather than an alphabet: `[T]` is not `[t]` in a larger size
but a symbol the IPA does not have, so `[Tʰa˥]` for 他 is not a capitalised
`[tʰa˥]` but nothing at all. Bopomofo is a script without case, and says the
same thing for a different reason.

```console
$ pinyinjs convert --system yale 我去银行。他姓王。
Wǒ chyù yínháng. Tā syìng Wáng.

$ pinyinjs convert --system ipa 我去银行。他姓王。
uo˨˩˦ tɕʰy˥˩ in˧˥xaŋ˧˥. tʰa˥ ɕiŋ˥˩ uaŋ˧˥.
```

`toTranscription` takes `{ capitals: false }` for the same reason, since a
caller writing IPA from its own pieces wants it too.

### What it gets right, and what it inherits

Read back word by word, where the hyphens keep the boundaries so that the only
thing that can be lost is Wade-Giles's own non-injectivity, **99.50% of 140,163
words** over 20,000 Tatoeba sentences come back as the pinyin they were written
from.

Against the forms in general use before 1979, hand-checked, **11 of 15 match
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

**It was 10 of 15, and every one of the five misses was a word boundary the
hyphen rule had no part in.** The [name-parts
rule](../orthography/#the-parts-of-a-proper-name-are-written-apart) supplies the
boundary in all five, and what is left is worth separating:

|          | now                   | attested              |
| -------- | --------------------- | --------------------- |
| 孙中山   | `Sun Chung-shan`      | `Sun Chung-shan`      |
| 李时珍   | `Li Shih-chên`        | `Li Shih-chen`        |
| 邓小平   | `Têng Hsiao-p'ing`    | `Teng Hsiao-p'ing`    |
| 清华大学 | `Ch'ing-hua Ta-hsüeh` | `Ch'ing-hua ta-hsüeh` |
| 北京大学 | `Pei-ching Ta-hsüeh`  | `Pei-ching ta-hsüeh`  |

孙中山 now matches outright, and the count is 11 of 15. **The other four are no
longer boundary errors, and that is the whole of what changed.** 李时珍 and
邓小平 are down to the `ê`, which is correct Wade-Giles for those syllables and a
diacritic the attested forms drop along with the apostrophes, so the spelling is
stricter than the source rather than wrong.

清华大学 and 北京大学 now divide in the right place and differ only in the
capital: GB/T 16159 capitalises a generic, as this package already does in
`Nánjīng Shì`, and the sources in general use before 1979 wrote `ta-hsüeh` in
lower case. So the list no longer scores a word boundary on those two; it scores
a capitalisation convention, which is a fact about the sources rather than about
the grouping.

## How the tables were checked

No source in this package's data pipeline carries any of these systems, since
CC-CEDICT, Unihan and the phrase corpus are all pinyin, so unlike every other
claim here, the tables could not be scored against the data that ships. They are
scored instead against an outside syllabary: `test/fixtures/syllabary.ts` holds
all 417 rows of Wikipedia's _Comparison of Chinese transcription systems_, and
`src/transcription/syllabary.test.ts` asserts every one of them, in all five
systems: 3,336 cells, since GR has four columns to everyone else's one.

**The Yale and IPA tables were derived from those columns rather than typed and
then checked against them**, which is a weaker claim than the one bopomofo and
Wade-Giles can make, and is worth saying plainly. What the check is still worth
is compression: one table of initials, one of finals and a handful of context
rules reproduce all 417 attested spellings in each system, and they go on to
write the 12 syllables of this inventory that the source's table does not have.
A table that had simply been copied would do neither.

**Gwoyeu Romatzyh is checked the strongest way any of them is**, and it is worth
saying that too. Its tables and every one of its tonal rules were written from a
_different page_, _Spelling in Gwoyeu Romatzyh_, which states them in prose, and
then scored against the four columns of this one, which is a different page
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

$ pinyinjs transcribe --from gwoyeu .ell
.ell        enr       ˙ㄣㄦ         ên⁵-'rh     enr       .ell      ənɚ
            err       ˙ㄦㄦ         êrh⁵-'rh    err       .ell      aɚɚ
            er        ˙ㄦ          êrh⁵        er        .ell      aɚ
```

Three readings, because `ell` is where GR's [fusion](#儿化-is-a-fusion-not-a-suffix)
puts 恩儿, 二儿 and 二 together, and the dot in front says only that whichever it
is, it is neutral.

`--from` takes `pinyin`, `wade-giles`, `bopomofo`, `yale`, `gwoyeu` or `ipa`,
and defaults to working it out. Bopomofo is the only one detection can be sure
of, since it has a script of its own; everything else is read as pinyin unless
declared, because `chi` is well formed in both pinyin and Wade-Giles and means
a different syllable in each. See [the command line](../cli/).

## What is not built

- **GR's rhotacised forms**, which are a fusion rather than the plain `-l`
  suffix written here, and **the etymological tone behind a neutral syllable's
  dot**, which pinyin does not record. Both are set out under
  [Gwoyeu Romatzyh](#gwoyeu-romatzyh) above.
- **Nothing of 5.1 any more.** 姓 and 名 written apart was the entry here, and
  a proper noun apart from its generic replaced it; both are now the
  [name-parts rule](../orthography/#the-parts-of-a-proper-name-are-written-apart).
  What keeps 清华大学 and 北京大学 off the attested forms is a capital rather
  than a boundary; see [what it
  inherits](#what-it-gets-right-and-what-it-inherits).
- **Postal Romanisation** (`Peking`, `Tsingtao`, `Canton`), which is not a
  system so much as a list, and is not derivable from any of this. See
  [Chungking is not Wade-Giles](#chungking-is-not-wade-giles).

<!-- card
```ts
const jiu = readSyllable("jiù");
writeBopomofo(jiu); // "ㄐㄧㄡˋ"
writeWadeGiles(jiu); // "chiu⁴"
writeYale(jiu); // "jyòu"
writeGwoyeu(jiu); // "jiow"
writeIpa(jiu); // "tɕiou˥˩"
```
-->
