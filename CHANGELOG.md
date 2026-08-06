# Changelog

Notable changes to `@kensio/pinyinjs`. Versions follow
[semantic versioning](https://semver.org) from 1.0.0 onward.

Two things are outside the version contract, for the reasons
[the API page](docs/api/#stability) gives: the readings a conversion produces,
which a dictionary rebuild can change, and the artifact format under `data/`.

## Unreleased

### Added

- **`SYLLABLE_TONES` and `isAttestedTone`.** Which tones each of the 424
  syllables is actually written in, extracted from the merged dictionary and
  held to it by a build assertion. 424 syllables in five tones would be 2,120
  combinations and only 1,708 of them occur, so a fifth of that grid is empty.
- **`Syllable.originalTone`,** the tone a neutral syllable had before it was
  reduced. Gwoyeu Romatzyh writes the neutral tone as a dot in front of the
  syllable _in its original tonal spelling_, so 没有 méiyou is `mei.yeou`, and
  nothing else in a pinyin syllable records what that tone was. Optional, never
  inferred, and used by GR alone.
- **Two more outside sources for the transcription tables.** 148 words from
  en.wiktionary's Mandarin pronunciation blocks, in bopomofo, Wade-Giles, Yale
  and GR with their tones, and all 50 rows of Wikipedia's _Help:IPA/Mandarin_
  key. The 417-row syllabary already checked was toneless, so it could say
  nothing about tone marks, the neutral tone, 儿化 or how a word is joined,
  which is where the four fixes below were found.

### Fixed

- **A decimal lost the grouping of its counted part.** 一共75.5元 was
  `yígòng qī shí wǔ diǎn wǔ yuán`, with the 75 in loose syllables, and is now
  `yígòng qīshíwǔ diǎn wǔ yuán`, the same word 一共75元 already got. Only what
  follows the 点 is read a digit at a time, and that part is unchanged: 3.14 is
  still `sān diǎn yī sì`, and sandhi still stops at the point.
- **A decimal point was read as a full stop.** 一共75.5元 came back as
  `Yígòng …`, capitalised as though the text were a sentence, and a conversion
  keeping its digits capitalised again after the point: 我有75.5个。was
  `Wǒ yǒu75.5Gè.` A stop between two digits now ends no sentence.
- **Bopomofo wrote the tone mark after the 儿化 ㄦ.** 哪儿 nǎr was `ㄋㄚㄦˇ` and
  is now `ㄋㄚˇㄦ`: the mark belongs to the nucleus and the suffix is not part of
  what it marks. A mark written after the ㄦ is still read.
- **Wade-Giles put the tone digit on the 儿化 suffix,** so 花儿 huār was
  `hua-êrh¹`, a first-tone 兒. It is now `hua¹-'rh`, with the digit on the
  syllable the tone belongs to and the suffix written as the reduced `'rh` that
  keeps it apart from 女儿 nǚ'ér's `nü³-êrh²`.
- **Gwoyeu Romatzyh wrote 儿化 as a plain `-l` suffix.** GR fuses it into the
  rime instead, and the rules are now implemented as _Spelling in Gwoyeu
  Romatzyh_ gives them: 玩儿 wánr is `wal` rather than `wanl`, 事儿 shìr is
  `shell`, 今儿 jīnr is `jiel`. The fusion is many-to-one, so `jiel` is 今儿 and
  鸡儿 both and 128 forms no longer round-trip, every one of them a form the
  language does not write.
- **Gwoyeu Romatzyh wrote `.mhe` for a neutral 么.** The `-h-` is the first tone
  of a sonorant initial, and a neutral syllable is in no tone at all; the basic
  form goes behind the dot, so 什么 shénme is `shern.me`.
- **The IPA module said it followed _Help:IPA/Mandarin_ and did not.** It
  follows the broader IPA column of _Comparison of Standard Chinese
  transcription systems_, which is where its ground truth comes from; the two
  pages differ at the medials, -ang, the empty rhyme and the diphthongs. No
  output changed, only the claim.
- **`--system ipa` capitalised the IPA.** 我去银行。他姓王。 came out as
  `Uo˨˩˦ ... Tʰa˥ ɕiŋ˥˩ Uaŋ˧˥`, with the sentence capital and the proper noun
  carried over from the pinyin as though a transcription spelled words. IPA
  letters are symbols rather than an alphabet, since `[T]` is not `[t]` in a
  larger size but a symbol the IPA does not have, so the capitals are now dropped for
  IPA and bopomofo and kept for the three romanisations. `toTranscription`
  takes `{ capitals: false }` for callers writing their own.
- **A compound lost the zh-TW reading its own parts carry.** 垃圾分類 read
  `lājīfēnlèi` under `zh-TW`, because CC-CEDICT marks `Taiwan pr.` on 垃圾 and
  垃圾桶 and on no other compound, and the decoder prefers the longer word, so
  the entry that had the delta was never consulted. 101 compounds now compose
  one from their constituents, 垃圾 accounting for 14 of them and 比肩, 玳瑁,
  从容, 骨头, 蜗牛 and 说服 for most of the rest. Three guards keep it honest:
  the constituent has to survive segmentation (運行狀況 contains 行狀 but reads
  運行 + 狀況), it has to be read in the compound exactly as its own entry reads
  it, and it has to be a whole word rather than a bare character, since 會's `huǐ`
  would rewrite 三合會 as `sānhéhuǐ` and 3,743 entries would compose that way
  against the 101 that whole words compose.
- **A character's zh-TW delta was often a choice between its 普通话 senses.**
  从容地 read `cōngróng dì` and 他都知道 read `tā dū zhīdào` under `zh-TW`,
  because 地 was stored with a Taiwan reading of `dì` and 都 with `dū`. Neither
  is a locale shift: CC-CEDICT lists 地[de5] and 地[di4] as separate entries, so
  `dì` is what 地 reads in 普通话 when it means the ground, and the adverbial
  particle is `de` in Taipei too. A delta the word already has as a 普通话 sense
  is now refused, so 71 characters and 3 words lose one, 都, 着, 应, 差, 称, 斗,
  舍, 薄 and 万 among them, while 和 `hàn`, 期 `qí`, 垃 `lè` and 髮 `fǎ` stay,
  no 普通话 sense reading any of those that way. A `Taiwan pr.` note is also
  only read off a sense matching the reading the entry settled on, which drops
  16 more: the note on 著's chess-move sense, which reads `zhāo`, had been
  giving the aspect particle 着 a 國語 reading of `zhuó`.
- **A locale delta overwrote a reading it was not measured against.** The delta
  describes the entry's own 普通话 reading, so a polyphone the decode read some
  other way, such as 得 forced to the modal `děi` rather than the particle `de`
  its entry stores, now keeps what the decode worked out instead of being
  rewritten from the entry.

### Changed

- **Reading a romanisation narrows on the tone that was written.**
  `readWadeGiles("lo²")` was `[luó, ló]` and is now `[luó]`: 咯 is a
  sentence-final particle and is only ever neutral, so ló is not a syllable
  Mandarin has. The same goes for `readWadeGilesLoosely`, where `pan²` is pán
  alone, and for `readYale`, `readIpa` and `readGwoyeu`, where it settles the 儿化
  collisions the same way (`ell` is 二 èr, there being no first-tone 兒).
  Narrowing never empties a list: a tone no candidate is written in leaves the
  candidates alone, since that says the tone is wrong rather than the spelling.
  Over the phrase corpus, taking the first candidate recovers 82.66% of
  syllables when the tone digit is written, against 79.05% without it.
- Eight Wade-Giles forms no longer round-trip, and one to three in each of the
  other systems, because they are forms the language does not write: `lo` in the
  four contour tones, a first-tone 兒, and a neutral 誒. Every attested
  syllable-and-tone combination still comes back.

## 1.0.0

The first stable release. Everything the
[API page](docs/api/) lists is now covered by semantic versioning, including the
decoder internals and the build pipeline.

### Added since 0.1.0-beta.0

- **Transcription systems, all five, in both directions.** Bopomofo, Wade-Giles,
  Yale, Gwoyeu Romatzyh and IPA at the syllable level, plus hanzi → any of them
  end to end via `convert --system` and `convertToWadeGiles`. Checked against
  417 rows of an outside syllabary in every system, which is 3,336 cells.
- **Reading ambiguous Wade-Giles.** `readWadeGilesLoosely` allows for the
  apostrophes and diacritics real texts drop, and `splitWadeGiles` puts back the
  hyphens they lose. Measured: 52.07% of written syllables lose their identity
  without their marks, and taking the first candidate recovers 79.05%.
- **Numbers read aloud** (`src/numerals/`, the `number` command): counting and
  spelling out, 两 against 二, decimals, percentages, fractions, `yāo`, and
  times. `convert` reads the digits it meets and takes the style from what
  follows them.
- **Orthography rules.** The 重叠 hyphen for AABB and repeated words, the 成语
  hyphen from a curated list of 117, 老王 → `Lǎo Wáng`, and GB/T 16159 5.1 in
  full, so 毛泽东 is `Máo Zédōng` and 北京大学 is `Běijīng Dàxué`, on boundaries
  CC-CEDICT's own capitalisation states.
- **Typed rule overrides on the lattice** (`READING_RULES`), with the modal 得
  and attested 儿化 as the first two.
- **Tone colour in the terminal**, in MDBG's palette, on every command that
  writes a syllable.

### Fixed since 0.1.0-beta.0

- **一 sandhi is about the 一 that counts.** 十一月 is `shíyīyuè` and 第一次 is
  `dìyīcì`; the citation tone survives a final digit and an ordinal. 561
  conversions change over 88,866 lines, 520 of them right.
- **A colon between digits is a time**, not an identifier: 6:30 is
  `liù diǎn sānshí fēn`.
- **The documented proper-noun mechanism was wrong.** The capitals page
  described a 500-entry surname list that has never existed; what produces
  `Lǐ Huá` is two single-character dictionary entries each flagged a proper
  noun.

### Changed

- **`engines` is now `>=22.0.0`**, down from `>=24.0.0`. The suite and the
  packaged tarball are both exercised on Node 22 and 24 in CI.
- **No more `beta` dist-tag.** `pnpm add @kensio/pinyinjs` finds it.
- `src/romanization/` is `src/transcription/`, since bopomofo has a script of
  its own and IPA is a transcription rather than a spelling. The published docs
  path keeps the older name.
- The build cleans `dist/` before compiling, and `pnpm pack:check` asserts the
  tarball's contents. The beta tarball shipped 24 stale files from a directory
  that had been renamed away.

### Accuracy at 1.0.0

Over the 110-case gold corpus, which is committed to the repository rather than
to the published package, and scored by `pnpm accuracy`:

|                  |   lattice | greedy baseline |
| ---------------- | --------: | --------------: |
| exact match      | **97.3%** |           90.9% |
| reading accuracy |     99.7% |           98.7% |
| spacing (F1)     | **99.7%** |           96.3% |

Every figure in that table is asserted against the scorer by
`src/changelog.test.ts`, because a number nothing executes goes stale, which is
what happened to this project's README table across three releases.

`pnpm polyphones` reports 89.04% for the lattice against greedy's 88.82% over
CPP's 20,139 hand-labelled polyphones. That corpus is fetched rather than
committed, so unlike the table above it cannot be asserted here, and it is
reported rather than guarded.

## 0.1.0-beta.0

First published release: the lattice decoder, the tiered dictionaries, the
syllable layer, sandhi, GB/T 16159 spacing and capitals, HTML output and the
`pinyinjs` command.
