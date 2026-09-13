# Romanisation

Convert pinyin syllables to and from bopomofo (注音符號), Wade-Giles, Yale,
Gwoyeu Romatzyh and IPA. These functions work without a dictionary. To
transcribe hanzi, first convert the text to pinyin.

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

<a id="hanzi-to-wade-giles-end-to-end"></a>

## Transcribing hanzi

Convert the hanzi with a dictionary, then render the resulting pieces in the
selected system:

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

For readings above the original characters, use
[annotated HTML](../html/#another-system-in-place-of-the-pinyin).

<a id="the-word-segmentation-is-shared-and-only-the-join-changes"></a>

### Word grouping and separators

All transcription systems reuse the conversion’s word grouping.

Each system controls the separators within a word. Wade-Giles places a hyphen
between syllables and a space between words.

This affects output in two ways:

- Pinyin apostrophes are replaced by the system’s separator. 西安 becomes
  `Hsi-an` in Wade-Giles.
- Bopomofo separates syllables with spaces. Yale and GR join them without a
  separator. `--system` accepts all five transcription systems.

`--notation none` omits tones in Wade-Giles, Yale and IPA. The flag has no
effect on bopomofo or GR, whose formatters encode tones within their normal
spellings.

<a id="the-capitals-belong-to-the-romanisations-only"></a>

### Capitalisation

Word and sentence capitals carry over to Wade-Giles, Yale and GR. IPA symbols
are kept in their defined case, and bopomofo has no case.

```console
$ pinyinjs convert --system yale 我去银行。他姓王。
Wǒ chyù yínháng. Tā syìng Wáng.

$ pinyinjs convert --system ipa 我去银行。他姓王。
uo˨˩˦ tɕʰy˥˩ in˧˥xaŋ˧˥. tʰa˥ ɕiŋ˥˩ uaŋ˧˥.
```

Use `{ capitals: false }` with `toTranscription` to disable capitalisation.

<a id="what-it-gets-right-and-what-it-inherits"></a>

### Comparison with historical spellings

Across 20,000 Tatoeba sentences, 99.50% of 140,163 Wade-Giles words can be
read back as their original pinyin. Word hyphens preserve boundaries, but some
Wade-Giles syllable spellings remain ambiguous.

In a separate set of 15 historical names, 11 match the attested spelling exactly:

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

The [name-parts rule](../orthography/#the-parts-of-a-proper-name-are-written-apart)
supplies boundaries between surnames and given names, and between proper nouns
and their generic terms.

|          | now                   | attested              |
| -------- | --------------------- | --------------------- |
| 孙中山   | `Sun Chung-shan`      | `Sun Chung-shan`      |
| 李时珍   | `Li Shih-chên`        | `Li Shih-chen`        |
| 邓小平   | `Têng Hsiao-p'ing`    | `Teng Hsiao-p'ing`    |
| 清华大学 | `Ch'ing-hua Ta-hsüeh` | `Ch'ing-hua ta-hsüeh` |
| 北京大学 | `Pei-ching Ta-hsüeh`  | `Pei-ching ta-hsüeh`  |

李时珍 and 邓小平 differ from the historical samples because the formatter
keeps the Wade-Giles `ê` diacritic that those samples omit.

清华大学 and 北京大学 differ in capitalisation. The formatter capitalises
the generic term under GB/T 16159, while the historical samples use lowercase
`ta-hsüeh`.

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

The GR example has three readings because `ell` can represent 恩儿, 二儿 or
二. The leading dot marks neutral tone.

`--from` accepts `pinyin`, `wade-giles`, `bopomofo`, `yale`, `gwoyeu` or `ipa`.
Automatic detection recognises bopomofo and treats all other input as pinyin.
Specify `--from` for the other systems. See [the CLI guide](../cli/).

## Bopomofo

```ts
writeBopomofo(readSyllable("zhōng")); // "ㄓㄨㄥ", ong is ㄨ + ㄥ
writeBopomofo(readSyllable("zhī")); // "ㄓ", the empty rhyme is not written
writeBopomofo(readSyllable("ma5")); // "˙ㄇㄚ", the neutral dot goes in front
readBopomofo("ㄒㄩㄥˊ"); // xióng
```

The formatter and parser use these conventions:

- First tone is unmarked by default. `readBopomofo` therefore treats an unmarked
  syllable as first tone. Use `{ firstTone: "mark" }` to write ˉ explicitly.
- ㄦ is an erhua suffix after another symbol, or the syllable 兒 at the start.
  For example, 事儿 is ㄕㄦ and 二儿 is ㄦㄦ. The formatter places the tone mark
  before a suffix, as in 哪儿 ㄋㄚˇㄦ. The parser also accepts a mark after it.
- The obsolete letter ㄫ represents syllabic `ng`, as in 嗯 ǹg, distinguishing
  it from 鞥 ēng.

`isBopomofo` identifies bopomofo by its script. Latin transcription systems
cannot always be distinguished by their characters.

## Wade-Giles

Wade-Giles marks aspiration with an apostrophe. Pinyin `b` becomes `p`, and
pinyin `p` becomes `p'`:

```ts
writeWadeGiles(readSyllable("běi"), { tones: "none" }); // "pei"
writeWadeGiles(readSyllable("gē"), { tones: "none" }); // "ko", -e is o after k
writeWadeGiles(readSyllable("zuò"), { tones: "none" }); // "tso", -uo loses its u
writeWadeGiles(readSyllable("guì"), { tones: "none" }); // "kuei", not "kui"
writeWadeGiles(readSyllable("zī"), { tones: "none" }); // "tzŭ"
writeWadeGilesWord([readSyllable("běi"), readSyllable("jīng")]); // "pei³-ching¹"
```

Tones are superscript digits by default. Use `{ tones: "numbers" }` for plain
digits or `{ tones: "none" }` to omit them. Syllables within a word are joined
with hyphens.

Erhua is written as `-'rh`, with the tone digit on the preceding syllable:

```ts
writeWadeGiles(readSyllable("wánr")); // "wan²-'rh"
writeWadeGiles(readSyllable("èr")); // "êrh⁴", 兒 as a syllable keeps its own
```

The shortened suffix distinguishes erhua from a separate 兒 syllable. 女儿
`nǚ'ér` is `nü³-êrh²`.

<a id="reading-it-back-is-the-hard-part"></a>

### Parsing ambiguous spellings

`readWadeGiles` returns an array because some Wade-Giles spellings represent
more than one pinyin syllable:

```ts
readWadeGiles("chiu⁴"); // [jiù]
readWadeGiles("lo"); // [luo, lo], 羅 and 咯 spelled alike
readWadeGiles("o¹"); // [ō, ē]
```

Use `readWadeGilesLoosely` to accept missing apostrophes and diacritics:

```ts
readWadeGilesLoosely("chi¹"); // [jī, qī]: chi is jī, ch'i is qī
readWadeGilesLoosely("chu¹"); // [zhū, chū, jū, qū]
readWadeGilesLoosely("hsueh²"); // [xué], hsüeh with no diaeresis
```

Loose parsing allows missing marks but respects any marks present. For example,
`ch'u` keeps its aspiration mark and can represent pinyin `chū` or `qù`.

Exact matches appear first in the candidate list.

<a id="the-tone-narrows-the-list"></a>

### Tone-based filtering

A written tone can narrow an ambiguous spelling. For example, 咯 `lo` is only
attested in the neutral tone:

```ts
readWadeGiles("lo²"); // [luó], ló is not a syllable Mandarin writes
readWadeGiles("lo⁵"); // [luo, lo], neutral, and both are real
readWadeGilesLoosely("pan²"); // [pán], bán is not one either
```

The parser uses `SYLLABLE_TONES` to filter candidates by attested tone. See
[syllable tones](../syllables/#which-tones-a-syllable-is-written-in).

If no candidate is attested in the supplied tone, the parser keeps the original
candidates. A valid spelling with an unusual tone can therefore still be parsed.

## Yale

Yale uses `b` and `p` for the same aspiration pair as pinyin. Some other
spellings differ substantially, such as `jr` for pinyin `zhi`.

```ts
writeYaleSpelling(readSyllable("xī")); // "syi", x is sy, alone among the palatals
writeYaleSpelling(readSyllable("zhī")); // "jr", the empty rhyme is a letter
writeYaleSpelling(readSyllable("rì")); // "r", and is never written twice
writeYaleSpelling(readSyllable("bō")); // "bwo", -o after a labial is really -uo
writeYaleSpelling(readSyllable("dūn")); // "dwun", where 文 alone is "wen"
writeYale(readSyllable("jiù")); // "jyòu", pinyin's own diacritics
```

The main spelling conventions are:

- Medials use `y` and `w`. 家 `jiā` is `jya`, and 呀 `ya` is `ya`.
- Overlapping letters at the initial/final boundary are merged. `sy` + `ya`
  becomes `sya`, `dz` + `z` becomes `dz`, and `r` + `r` becomes `r`.
- Tone marks have the same shapes as pinyin marks. In a syllable without a
  vowel letter, the mark goes on the letter representing the rhyme. 知 `zhī`
  is `jr̄`, and 字 `zì` is `dz̀`.

Neutral tone is unmarked. Use `{ tones: "numbers" }` to distinguish an
explicit neutral tone from an unspecified tone. Erhua appends `r`, which can
produce the same spelling as a separate 兒 syllable:

```ts
readYale("ér"); // [ér, ér, ếr]: 兒, and either syllable Yale spells "e" plus the suffix
```

## Gwoyeu Romatzyh

Gwoyeu Romatzyh (GR) changes the spelling of a syllable to encode its tone:

```ts
writeGwoyeu(readSyllable("shān")); // "shan"
writeGwoyeu(readSyllable("shán")); // "sharn"
writeGwoyeu(readSyllable("shǎn")); // "shaan"
writeGwoyeu(readSyllable("shàn")); // "shann"
```

The doubled vowel in the English name Shaanxi comes from GR’s third-tone
spelling. It distinguishes 陝西 from 山西 (Shanxi).

The formatter derives each tone from a basic form by changing a vowel or adding
a letter.

```ts
const gr = (pinyin: string) => writeGwoyeu(readSyllable(pinyin));
gr("chuán"); // "chwan", i/u become y/w in the second tone...
gr("cháng"); // "charng", ...or an r goes in after the vowels
gr("qiǎn"); // "chean", i/u become e/o in the third...
gr("dǎ"); // "daa", ...or the main vowel doubles
gr("dào"); // "daw", the last letter changes in the fourth...
gr("dà"); // "dah", ...or an h is added
```

The main spelling conventions are:

- `j`, `ch` and `sh` represent both retroflex and palatal initials. The
  following letters distinguish them. Pinyin `zhu`, `ju` and `jiu` become `ju`,
  `jiu` and `jiou`.
- Initials `l`, `m`, `n` and `r` insert `h` for first tone and use the basic
  form for second tone. 媽 `mā` is `mha`, and 麻 `má` is `ma`.
- Zero-initial syllables beginning with `i` or `u` add `y` or `w` outside first
  tone. 一 `yī`, 疑 `yí`, 已 `yǐ` and 意 `yì` become `i`, `yi`, `yii` and `yih`.

<a id="the-rule-the-published-rules-get-wrong"></a>

### Zero-initial spelling rules

The prose rules in _Spelling in Gwoyeu Romatzyh_ describe replacing initial
`i` or `u` with `y` or `w`. That wording needs qualification for forms such as
`yih`, where replacement would remove the only vowel.

The implementation follows the source’s rime table. It replaces a medial only
when a different vowel follows it. Thus `iuh` becomes `yuh`, `ih` becomes
`yih`, and `ii` becomes `yii`.

These rules reproduce all 1,668 cells in the syllabary’s four GR columns.

### The neutral tone

A dot marks neutral tone. The following syllable keeps its original tonal
spelling when that tone is known. For 没有 `méiyou`, `mei.yeou` retains 友’s
third-tone spelling. Supply the original tone explicitly:

```ts
writeGwoyeu({ ...readSyllable("you5"), originalTone: 3 }); // ".yeou"
writeGwoyeu(readSyllable("you5")); // ".iou", no original tone to keep
readGwoyeu(".yeou"); // [you, originalTone 3]
```

Without an original tone, the formatter puts the basic form after the dot.
For example, 什么 `shénme` is `shern.me`.

`originalTone` is an optional [syllable](../syllables/) field. The parser does
not infer it from neutral pinyin. Only the GR formatter uses it.

<a id="儿化-fuses-into-the-rime"></a>

### Erhua

GR changes the rhyme for erhua before adding its suffix:

```ts
writeGwoyeu(readSyllable("huār")); // "hual"
writeGwoyeu(readSyllable("wánr")); // "wal", the -n is not there to hear
writeGwoyeu(readSyllable("shìr")); // "shell", the empty rhyme has gone
writeGwoyeu(readSyllable("zhèr")); // "jehl"
writeGwoyeu(readSyllable("diǎnr")); // "deal", as in 一點兒 `ideal`
```

The implementation follows the rime rules in _Spelling in Gwoyeu Romatzyh_.
`-y` becomes `e`, `i` and `in` become `ie`, and `ing` becomes `ieng`. Other
final `n` sounds and the nonsyllabic `i` of `ai` and `uei` are removed. Tonal
spelling applies afterwards. Fourth tone doubles the final `l` unless the
rhyme already marks fourth tone, as in `dawl`, `anql` and `ehl`.

Different syllables can produce the same rhotacised form. For example, `jiel`
represents both 今兒 `jīnr` and 雞兒 `jīr`.

```ts
readGwoyeu("jiel"); // [jīr, jīnr]
readGwoyeu("hual"); // [huār, huānr]
readGwoyeu("ell"); // [èir, ènr, èr]: 二, and two rimes that fuse to the same el
```

These mergers affect [round-trip behaviour](#what-round-trips).

### Reading it back

The reverse index includes each of the 424 syllables in four tones. Of those
1,696 spellings, 1,695 are distinct:

```ts
readGwoyeu("nn"); // [ň, ǹ], the syllabic nasal, and nothing else collides
```

The collision is a syllabic nasal absent from the reference syllabary. Applying
the general rules to 唔 produces `nn` in both third and fourth tone.

## IPA

IPA represents sounds with phonetic symbols. This implementation combines an
initial and a final without the `y` and `w` spellings used by pinyin.

```ts
writeIpaSymbols(readSyllable("yī")); // "i", no y
writeIpaSymbols(readSyllable("wén")); // "uən", the same final as 敦 "tuən"
writeIpaSymbols(readSyllable("tiān")); // "tʰiɛn", pinyin's one e is three vowels
writeIpaSymbols(readSyllable("zhī")); // "ʈʂɨ", and its one i is two
writeIpa(readSyllable("mǎ")); // "ma˨˩˦", Chao's tone letters
writeIpa(readSyllable("mǎ"), { tones: "numbers" }); // "ma214"
```

The output follows the broad IPA column in Wikipedia’s _Comparison of Standard
Chinese transcription systems_. The syllabary test fixture uses that same
analysis.

Wikipedia’s _Help:IPA/Mandarin_ uses a narrower transcription in four places:

|                 | the syllabary, and this | _Help:IPA/Mandarin_ |
| --------------- | ----------------------- | ------------------- |
| the medials     | i, u, y                 | j, w, ɥ             |
| -ang            | aŋ                      | ɑŋ                  |
| the empty rhyme | ɨ                       | ɻ̩ and ɹ̩             |
| the diphthongs  | ai au ei ou             | aɪ aʊ eɪ oʊ         |

`test/fixtures/ipa-mandarin.ts` records all 50 rows of that key and the 12
differences from this implementation. Two differences concern tones. This
implementation writes a citation contour for third tone and no tone letter
for neutral tone.

Other conventions are:

- The `-o` final after a labial is `[uo]`. 波 `bō` is `puo`, while 咯 `lo`
  is `lɔ`.
- The empty rhyme is `[ɨ]` after both retroflex and dental sibilants. A narrower
  transcription can distinguish `[ʐ̩]` and `[z̩]`.
- Neutral tone has no tone letter. The output cannot distinguish neutral tone
  from an unspecified tone.

Erhua is approximated by appending `[ɚ]`. This does not model the changes to
the original rhyme, such as the loss of the nasal in 玩儿 `wánr` or the empty
rhyme in 事儿 `shìr`.

<a id="a-third-source-and-what-it-settles"></a>

### Phonetic reference

Lee and Zee’s 2003 _Illustration of Standard Chinese_ describes broad symbols
and their narrower realisations. Its examples help explain the differences
between the two Wikipedia tables.

The following example words use the same broad symbols as this implementation:

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

The paper separately gives these narrow values:

> `[ai]=[aɪ]`, `[au]=[a̠ʊ]`, `[ou]=[o̝u]`, `[uo]=[uo̝]`, `[ei]=[e̞i]` … In
> syllables closed by a nasal … `[a]=[a̠]`

These narrow realisations explain some of the forms in _Help:IPA/Mandarin_.
In the paper’s notation:

- The vowel in `-ang` is retracted `[a̠]`.
- The second element of `[uo]` is raised `[o̝]`.

The paper gives citation tones separately from sandhi in compounds. This
package also applies [third-tone sandhi](../sandhi/) separately, through the
`sandhi.thirdTone` option or `--third-tone`. The paper’s third-tone citation
contour is `[˧˩˧]`, while this implementation uses Chao’s `[˨˩˦]`.

Zero-initial syllables differ. The paper writes approximants in 蛙 `[wa˥]`
and 鸭 `[ja˥]`, but none in 衣 `[i˥]`. This implementation follows the broad
comparison table and omits those glides, producing `uo˨˩˦` for 我.

#### References

- Lee, Wai-Sum & Zee, Eric (2003). Standard Chinese (Beijing). _Journal of the
  International Phonetic Association_ 33(1), 109–112.
  [doi:10.1017/S0025100303001208](https://doi.org/10.1017/S0025100303001208)
- [_Comparison of Standard Chinese transcription systems_](https://en.wikipedia.org/wiki/Comparison_of_Standard_Chinese_transcription_systems),
  Wikipedia, holding the 417-row syllabary in `test/fixtures/syllabary.ts` and
  the IPA column this follows
- [_Help:IPA/Mandarin_](https://en.wikipedia.org/wiki/Help:IPA/Mandarin),
  Wikipedia, holding the 50-row key in `test/fixtures/ipa-mandarin.ts`

<a id="splitting-a-word-that-dropped-its-hyphens"></a>

## Splitting Wade-Giles words

Use `splitWadeGiles` to recover syllable boundaries when hyphens have been
omitted. Wade-Giles apostrophes mark aspiration, so they cannot replace the
missing hyphens.

```js
splitWadeGiles("maotsetung"); // ["mao", "tse", "tung"]
splitWadeGiles("mao-tse-tung"); // the same, hyphens honoured
splitWadeGiles("hua¹-'rh"); // ["hua¹-'rh"], that hyphen is part of 花儿
splitWadeGiles("hua-êrh"); // ["hua", "êrh"], and this one is not: 花兒, huā ér
readWadeGilesWord("pei³ching¹"); // 北京, běijīng
```

`pnpm transcription` measures splitting over 411,956 multi-syllable corpus
words with their Wade-Giles hyphens removed:

|                       | marks kept | marks dropped |
| --------------------- | ---------: | ------------: |
| the boundary is found |     99.19% |        99.04% |
| the word comes back   |     99.45% |        56.04% |

The splitter usually recovers boundaries even when the syllable reading remains
ambiguous. Missing apostrophes and diacritics are the main source of reading
errors.

In this corpus, the correct split is always among the candidates and is the
only candidate for 17.08% of words. The mean is 5.23 candidates per word. The
longest-first result is one choice among those candidates.

The 0.81% of missed boundaries mostly involve `n` or a vowel being attached to
the wrong syllable. For example, `i-ti-hu-na` can be split as `i-ti-hun-a`
when its hyphens are removed.

<a id="the-syllabic-nasals-are-barred-from-a-split"></a>

### Syllabic nasals

Syllabic nasals (`ng`, `m`, `n`, `hm` and `hng`) can be parsed alone but are
excluded from splits of longer runs. None occurs inside the 411,956 corpus
words. Allowing them would introduce splits such as `shu` + `ng` for an
otherwise invalid syllable.

<a id="chungking-is-postal-romanisation"></a>

### Postal Romanisation

`Chungking`, `Tsingtao`, `Peking`, `Nanking` and `Canton` use
[Postal Romanisation](https://en.wikipedia.org/wiki/Chinese_postal_romanization).
They are outside the Wade-Giles syllabary, and `splitWadeGiles` returns
undefined for them. Wade-Giles writes 重慶 as `chʻung²-chʻing⁴` and 青島 as
`chʻing¹-tao³`.

Names such as `Mao Tse-tung`, `Taipei` and `Kuomintang` use Wade-Giles and are
supported.

<a id="what-round-trips"></a>

## Round-trip behaviour

Tests cover all inventory syllables in every tone state, with and without
erhua (5,088 forms):

|                                        |       |
| -------------------------------------- | ----: |
| Wade-Giles read back exactly           | 5,080 |
| Yale read back exactly, `tones` marked | 4,239 |
| Yale read back exactly, `tones` 1 to 5 | 5,085 |
| bopomofo read back exactly             | 4,240 |
| Gwoyeu Romatzyh read back exactly      | 4,112 |
| IPA read back exactly                  | 4,239 |

Most failures come from tone distinctions that a system cannot represent:

- Bopomofo interprets an omitted tone mark as first tone, losing the distinction
  between first tone and an unspecified tone (848 forms).
- GR’s basic form also represents first tone, leaving no spelling for an
  unspecified tone (848 forms).
- Yale leaves neutral tone unmarked. `{ tones: "numbers" }` preserves the
  distinction between neutral and unspecified tones (848 forms otherwise).
- IPA has no letter for neutral tone and cannot preserve that distinction
  (848 forms).

Wade-Giles represents all five tones as digits and can preserve an unspecified
tone by omitting the digit.

Other failures result from [tone filtering](#the-tone-narrows-the-list) of
unattested forms or GR’s erhua mergers:

- Wade-Giles `lo` merges 羅 and 咯. Filtering removes the unattested contour
  tones of 咯, with and without erhua (eight forms).
- Some systems give 兒 the same spelling as another syllable with erhua. The
  unattested first-tone `ēr` can therefore be filtered out.
- Numbered Yale filters a neutral 誒 `ê` because that tone is unattested.
- GR’s erhua mergers account for 128 forms (37 neutral and 91 toned). For
  example, `barl` can represent both 拔儿 `bár` and 掰儿 `báir`. Filtering keeps
  the attested candidates.

The reverse candidates retain every attested form among the 1,708 syllable-tone
combinations, with and without erhua.

The number of distinct spellings across the 424 syllables is:

|                                |     |
| ------------------------------ | --: |
| distinct bopomofo spellings    | 424 |
| distinct Gwoyeu Romatzyh forms | 424 |
| distinct IPA transcriptions    | 424 |
| distinct Wade-Giles spellings  | 423 |
| distinct Yale spellings        | 423 |

Wade-Giles uses `lo` for both 羅 `luó` and 咯 `lo`. Yale uses `e` for both
額 `e` and 誒 `ê`.

Because GR encodes tone in its spelling, its four-tone inventory has:

|                            |       |
| -------------------------- | ----: |
| syllables × the four tones | 1,696 |
| distinct GR spellings      | 1,695 |

Its only collision is `nn` for 唔, which has no attested GR spelling in the
reference syllabary.

<a id="how-ambiguous-is-wade-giles-really"></a>

## Wade-Giles ambiguity measurements

Run `pnpm transcription` to measure ambiguity over the 424-syllable
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

The twelve four-way cases come from `chu`, `chuan` and `chun`. Each can
represent the `zh`, `ch`, `j` or `q` series after its marks are removed.

Weighting syllables by frequency in the 1,029,971-syllable phrase corpus gives:

|                                         |                  |
| --------------------------------------- | ---------------: |
| written with a spelling that merges     | 536,304 (52.07%) |
| recovered by taking the first candidate | 814,220 (79.05%) |
| the same, with the tone digit written   | 851,334 (82.66%) |

About half the corpus becomes ambiguous after removing marks. Choosing an
exact spelling when available recovers about four fifths of syllables. The
parser returns candidates and does not use neighbouring words to choose one.

Tone filtering improves recovery by 37,114 syllables, from 79.05% to 82.66%,
when tone digits are present. These figures describe this corpus and parsing
strategy.

<a id="why-the-tables-are-short"></a>

## Syllable representation

A parsed syllable stores its underlying initial and final. For example, 就 is
`j` + `iou` and 军 is `j` + `ün`. Each transcription system maps those fields
to its own spelling. See [syllables](../syllables/).

Bopomofo represents these components directly. For example, ㄐㄧㄡ writes
`j` + `iou` symbol by symbol.

<a id="how-the-tables-were-checked"></a>

## Validation sources

`test/fixtures/syllabary.ts` contains the 417 rows of Wikipedia’s _Comparison
of Chinese transcription systems_. `src/transcription/syllabary.test.ts`
checks 3,336 cells across the five systems (GR has four tone columns).

The Yale and IPA mappings were derived from those columns, so these tests
check consistency with the source rather than independent accuracy. Initial
and final tables plus context rules reproduce the reference spellings.

The GR implementation follows the rules in _Spelling in Gwoyeu Romatzyh_ and
is checked against the comparison page’s 1,668 GR cells. Its zero-initial
handling follows the former page’s rime table.

The package inventory has 12 syllables absent from the reference, including
interjections, syllabic nasals and rare Unihan readings. The reference has five
forms absent from the package inventory (`diang`, `lüan`, `lün`, `nia` and
`shong`). The formatting rules also reproduce those five forms.

<a id="where-it-stops"></a>

## Limitations

- Parsing returns candidates when a spelling is ambiguous. It does not use a
  dictionary or sentence context to choose among them.
- Some systems lose tone distinctions or merge erhua forms. See
  [round-trip behaviour](#what-round-trips).
- GR needs `originalTone` to preserve the tone underlying a neutral syllable.
  Pinyin input does not supply it.
- IPA erhua uses an appended `[ɚ]` approximation.
- Historical spellings may omit marks or use different capitalisation. Postal
  Romanisation names such as `Peking` and `Canton` are unsupported.

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
