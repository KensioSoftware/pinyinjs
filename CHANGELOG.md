# Changelog

Notable changes to `@kensio/pinyinjs`. Versions follow
[semantic versioning](https://semver.org) from 1.0.0 onward.

Two things are outside the version contract, for the reasons
[the API page](docs/api/#stability) gives: the readings a conversion produces,
which a dictionary rebuild can change, and the artifact format under `data/`.

## Unreleased

### Added

- **`segment` returns the words, rather than throwing them away.** Finding the
  words is what converting has always had to do first, because the unit a
  reading belongs to is the word — 行 is `xíng`, `háng`, `héng` or `hàng` and
  only 银行 and 行长 say which — but the answer went no further than the string
  `convert` built out of it.

  ```ts
  segment(dictionary, "南京市长江大桥").map((found) => found.text);
  // ["南京市", "长江", "大桥"]
  ```

  Which is a segmenter with something most do not have: **the split is chosen
  for the reading it produces**. That example cuts either way — the other is
  南京 / 市长 / 江大桥 — and the two disagree about whether 长 is `cháng` or
  `zhǎng`, so a cut that reads correctly is preferred over one that merely
  matches something longer. No wasm, no backend and no model; the dictionary is
  already loaded.

  A `Segment` carries the characters, the reading, jieba's tag, the proper-noun
  mark, whether the dictionary knew it, and `at`, its position in code points.
  Every stretch of the text comes back in order — punctuation, Latin and
  whitespace included — so the segments rejoin into exactly the text they came
  from, which is what makes it safe to rebuild a document from or to highlight
  in place.

  The boundaries are the ones `convert` uses, down to the number in front of a
  run: 2个人 is 个 + 人 where 个人 alone is the word `gèrén`. What is not applied
  is 分词连写, so 他看了 segments as 他 / 看 / 了 and still converts as
  `tā kànle` — attaching an aspect particle to its verb is a fact about writing
  pinyin rather than about where the words are. `pinyinjs segment` at the
  command line.

## 1.6.0

### Added

- **Hanzi and pinyin together, rather than one instead of the other.**
  `convertToAnnotatedHtml` writes the characters with their reading above them,
  as `<ruby>` markup — the output every other mode could not give, and what a
  learner's text, a subtitle and a dictionary entry all want. `convert` and
  `convertToHtml` write the reading _instead of_ the characters.
  `toAnnotatedHtml(pieces)` renders pieces you already have, and the command
  line has `pinyinjs annotate`.

  Each `<rt>` holds exactly what `convertToHtml` would have written, so tone
  classes and uncertainty marking work inside an annotation as they do outside
  one. `<rp>` gives the parenthesised fallback, the `<ruby>` carries `lang="zh"`
  and the syllables inside it keep `zh-Latn-CN-pinyin`, since on an English page
  a screen reader needs to be told both.

  **A base is not always one character**, which is what makes this harder than
  it looks and what every naive per-character annotation gets wrong. 玩儿 is two
  characters and the one syllable `wánr`; 95% is `bǎifēnzhījiǔshíwǔ` over three
  written characters in the other order; 1988 is `yī jiǔ bā bā` over one. All
  are annotated whole. `ConvertedPiece` gains a `source` — the characters a
  piece reads, or undefined where it reads on into the ones named before it —
  which is what makes that expressible.

  Pinyin orthography stays out of the hanzi it annotates: no word spaces, since
  Chinese is not written with them; the hyphen of `gāngān-jìngjìng` sits in the
  reading, being a boundary inside one word rather than a gap between two; and
  the base keeps 。 where the conversion writes a full stop.

- **`readings`: a conversion takes readings the caller asserts.** No rule
  settles every polyphone, and some texts are genuinely ambiguous —
  孩子越长越漂亮 grows where 头发越长越漂亮 lengthens, and nothing in the
  characters says which. An application that knows its own content can now say
  so, rather than the library guessing on its behalf.

  ```ts
  convert(dictionary, "这篇文章不太长。", { readings: { 太长: "tài cháng" } });
  ```

  A **word** hint asserts something about the text it names and rewrites exactly
  those characters, so a bare `长` leaves 校长 as `xiàozhǎng` — the dictionary
  knowing that word is better evidence about the stretch than a remark about one
  of its characters, and that is what makes a corrections table safe to
  accumulate. Naming the whole word does reach it, and keeps it whole:
  `{ 银行: "yín xíng" }` gives `yínxíng`.

  A **positional** hint asserts something about one character of one text, and
  nothing outranks it, the enclosing word included. Positions count code points
  from the start of the text, across any non-Han runs in it. The list form takes
  both kinds together.

  Hints enter as lattice edges rather than as rules, because the rules layer
  cannot invent a reading no source attests — which is exactly what a hint is,
  the difference being that a caller attests it. Spacing is untouched, an
  unmarked syllable is 轻声, and a hint that cannot be parsed throws rather than
  being skipped: a correction that silently does nothing is worse than one that
  fails.

### Fixed

- **Polyphones defaulted to whichever reading a dictionary happened to print
  first.** Unihan's `kTGHZ2013` ranked above `kMandarin`, and that field
  prefixes every reading with its entry number in 《現代漢語規範詞典》 — 勒 is
  `212.050:lè 212.100:lēi` — so its order is a page order, and taking the first
  reading meant taking whichever one sorted earlier by pinyin. 殷 read `yān` and
  楷 `jiē`. The dictionary-indexed fields now rank last: they are a good
  _source_ of readings and a meaningless _ranking_ of them.

  `kHanyuPinlu` still leads where it lists more than one reading, because there
  it has counted them against each other, but where it lists one it counted
  nothing — it is saying "this occurred", not "this leads" — and a lone reading
  now ranks last too. Only ten characters have one that disagrees with
  `kMandarin`, and eight of those are simply pre-1985: the corpus behind the
  field, 《現代漢語頻率詞典》, predates the 普通话异读词审音表, and the 132
  occurrences carrying 绩 as `jī` are the old standard rather than a case for
  it.

  354 readings fixed against 94 broken over 25 characters, the largest being 贾
  `gǔ`→`jiǎ`, 苔 `tāi`→`tái`, 町 `dīng`→`tǐng`, 殷 `yān`→`yīn` and 芥
  `gài`→`jiè`. CPP's polyphone score is 90.34%, up from 89.05%, and the gold
  corpus does not move. What broke is mostly `kMandarin` being wrong with
  nothing behind it — 媛 `yuán`→`yuàn`, 桔 `jú`→`jié`, 耶 `yē`→`yé`, 缪
  `miào`→`móu` — which needs a third opinion with corpus evidence behind it
  rather than an override, since here the sources disagree. 䘚 is now paired
  with 卒, so `core` and `standard` each gained a key.

- **`full` read 特徵 as `tèzhǐ` where `standard` read it right.**
  `large_pinyin.txt` is a 简体 corpus, and where it carries a 繁體 headword
  anyway it has read it as though the characters were 简体, taking each at face
  value instead of as the 简体 character it stands for: 徵 as itself rather than
  as 征, 沈 as the surname rather than as 沉, so 沈溺 came out `shěnnì`. Of the
  2,854 corpus headwords carrying a 繁體-only character, 72 are ones CC-CEDICT
  pairs with a 简体 form and 13 of those read wrongly.

  The reading was only half of it. A corpus headword becomes an entry of its
  own, and an entry outranks the 繁體 key that the traditional derivation hangs
  on the 简体 entry — so the word was in the dictionary twice, and which copy
  answered depended on the tier. `standard` excludes the phrase tail and was
  right; `full`, the default, was wrong. Loading more dictionary made the answer
  worse, which is also the upgrade path the docs describe, of converting with
  `standard` and reloading as `full`.

  A headword CC-CEDICT knows _only_ as another word's 繁體 spelling now
  contributes no entry, and the word keeps the reading CC-CEDICT pairs it with.
  68 entries drop out and their keys are re-claimed from the 简体 entry, so
  `full` loses 2 keys; 简→繁→简 round trips gain 38 against 5 lost on 繁→简→繁,
  both unchanged as percentages. The 2,782 headwords CC-CEDICT does not pair are
  rare or mixed-script words whose characters do read them, and are left alone.
  Three of the words are build assertions now, this being the kind of defect
  that comes back when a rolling source is refreshed and nothing is watching.

- **长 read `zhǎng` wherever no word covered it**, so 这篇文章不太长 came out
  `bú tài zhǎng` and 要多长时间 `duō zhǎng shíjiān`. The stored default is not
  the defect — Unihan ranks the readings `zhǎng(1879) cháng(1179)` and names
  `zhǎng` in `kMandarin`, and that ranking is what reads 署长, 团长, 公安局长 and
  总会长 correctly off a bare 长 at the end of a title. What was missing is that
  nothing could prefer the alternate at a position no word covers.

  A degree adverb settles it, and only from the left: a growing 长 is a verb and
  no 很, 太, 最 or 多 can modify one, while what follows an adjectival 长 is a
  noun, a particle or the end of the sentence — which is what follows half the
  verbs too. 得, 着 and the 越…越 correlative are the exceptions, and are guarded;
  了 and 的 are deliberately not, since after an adverb they are the sentence
  particle and the attributive, making 时间太长了 and 很长的道路 both `cháng`.

  Measured over the same 88,866 lines of Tatoeba and zh.wikipedia the other
  edge rules were sized against, 260 长 decode as a word of their own and this
  moves 75 to `cháng`, all 75 correctly. On CPP's 40 hand-labelled 长 the
  character goes 85.00% to 87.50%; overall CPP is unmoved at 90.34%, as expected
  of one character in 20,139.

- **越长越高 read `yuè cháng yuè gāo`.** 越长 is a key read `yuè cháng` and the
  only one of its shape — 越大, 越高, 越好 and 越快 are all absent, so 越高越好
  decodes as two words while 越长越高 reached for a word nothing else in the
  paradigm has. It carries no part of speech, which is how a reading somebody
  asserted is held rather than a word anybody counted, and only
  `large_pinyin.txt` has it. Where the far half of the correlative names
  something growing produces — 高, 大, 胖, 壮, 结实 — the edge is dropped and the
  character's own `zhǎng` stands.

  Unlike everything else here this is a heuristic with no corpus behind it: 越长
  occurs three times in the 88,866 lines and all three are 越来越长 or 说的越长.
  It forbids rather than forces, so `cháng` stays on as a rival one bucket
  dearer and the syllable still reports itself uncertain — 越长越X is genuinely
  ambiguous, 孩子越长越漂亮 growing where 头发越长越漂亮 lengthens, which is why
  漂亮 is not in the list. 时间越长越好 and 头发越长 are untouched.

## 1.5.3

### Fixed

- **The changelog inside the package described five releases as unreleased.**
  Every tarball from 1.1.0 to 1.5.2 shipped a `## Unreleased` section holding
  everything since 1.0.0, so a reader who opened the copy they installed —
  which [the API page](docs/api/#stability) points them at — had no way to tell
  which version any of it arrived in. The entries are filed under the versions
  that shipped them now. No code changes; this release exists to put the
  corrected file on the registry.

## 1.5.2

### Fixed

- **Third-tone sandhi ran over the syllables rather than over the feet.** The
  rule is usually stated as "a third tone before another third tone is said as
  a second", and a left-to-right scan of a reading applying exactly that is
  wrong about as often as it is right: sandhi's domain is the prosodic foot,
  which is built out of structure ([Shih 1986][1]). 這家銀行的行長很喜歡旅行
  came out `hángzháng hén xǐhuan`, running the subject into the predicate, and
  紙老虎 came out `zhíláohǔ`.

  Three passes now, innermost first, each reading what the one before it left.
  Inside a constituent, every third tone but the last lowers. Between the
  constituents of a word, so that 展覽館 is 展覽 + 館 and stays `zhánlánguǎn`
  while 紙老虎 is 紙 + 老虎 and becomes `zhǐláohǔ` — the dictionary is asked
  where a word divides, and only proposes one where both halves are words. And
  between a monosyllabic word and the word after it, which it leans on: 我也很好
  is `wó yé hén hǎo`, but 行長 and 老闆 keep their second syllable.

  `applySandhi` takes a `SandhiGrouping` for this, and without one still treats
  the whole reading as a single word. `convert` passes what the decoder found;
  the `sandhi` command splits its argument on whitespace.

  What is given up is the monosyllable leaning backwards — 保管好 is
  `báoguán hǎo` and comes out `báoguǎn hǎo` — which needs to know which way it
  attaches, a question about syntax rather than about the words.

  [1]: https://www.researchgate.net/publication/36071823_The_Prosodic_Domain_of_Tone_Sandhi_in_Chinese

- **14 characters read wrongly under `zh-TW`.** CC-CEDICT states a `Taiwan pr.`
  note either as a definition of its own, where it qualifies the headword's
  reading, or parenthesised inside one sense, where it qualifies that sense —
  and the merge took both as facts about the headword. 從's `zòng` is the 侍從
  and 從兄弟 senses, all of them bound forms, so `我從北京來` read
  `wǒ zòng Běijīng lái`; 會 took `huǐ` from 一會兒 and `很會說話` followed it.
  A note now has to cover the sense the entry leads with, which is what a
  character means with nothing to narrow it — 和's `hàn` is the conjunction, and
  it stays. Also fixed for 勞, 燥, 行, 勝, 匹, 多, 抵, 枕, 比, 玩, 署 and 聽.
  Compounds keep their own notes, so 肉燥麵 is still `ròusào miàn`.

  Only a character is tested this way; a word is reached only where it is
  written, so 相親 keeps the `xiàngqīn` its dominant sense carries. CC-CEDICT
  now supplies 335 deltas rather than 349.

## 1.5.1

Tooling and test-suite work only; nothing a consumer installs changed.

## 1.5.0

### Added

- **`convertToHtml` declares what language it is emitting.** Every syllable
  element now carries `lang="zh-Latn-CN-pinyin"`, or `zh-Latn-TW-pinyin` where
  the conversion read `zh-TW`. Nothing about `yín` on its own says it is
  Mandarin in the Latin alphabet, so without the tag a screen reader pronounces
  it as whatever the surrounding page claims to be — English, usually — and the
  browser hyphenates it that way too. The subtags are all registered, and the
  `pinyin` variant's prefix in the IANA registry is `zh-Latn`.

  **This changes the markup existing callers get**, which is why it is worth
  saying plainly: the classes are unchanged, and `lang` is a new attribute
  between `class` and `data-alternatives`. `lang: false` — `--no-lang` at the
  command line — leaves it off, for a caller who would rather declare the
  language once on a wrapper of their own than repeat it on every syllable.

## 1.4.0

### Added

- **`pinyinjs script`,** script conversion at the command line, with `--to` for
  the target and `--from-script` where the text is too short for detection to
  tell. The lines carry the converted text and nothing else so it pipes;
  `--json` carries the per-character evidence and what was uncertain. Also a
  [script conversion](docs/script-conversion/) page, which the README and the
  docs index now point at — `toScript` shipped with one row in the API table
  and nothing a reader would find.

- **`toScript`,** 简体 ↔ 繁體 conversion. 我们后来发现了头发问题 is
  我們後來發現了頭髮問題. The reading is the evidence, in both directions, and it
  is what nothing else in this space has: 发 is 發 or 髮 and only `fà` tells them
  apart; 干 is 幹, 乾 or 干; 乾 stays 乾 in 乾隆 and simplifies to 干 in 乾燥.
  Every other converter resolves these from a phrase table alone. This one
  segments with the lattice and reads the result, so it generalises to words no
  phrase table lists.

  Evidence is taken strongest first — a word some source wrote in both scripts,
  then the character at the reading it was decoded with, then the character's
  commonest form — and `toScriptPieces` reports which of those settled every
  character. `isUncertainChoice` marks the last one, the only case that is a
  guess: 下面 is a surface or a bowl of noodles and nothing here can tell, so it
  says so rather than picking silently. Over the gold corpus 97.7% of characters
  are locked and 1.5% are guesses.

  Targets are BCP-47: `zh-Hans`, `zh-Hant`, `zh-Hant-TW`, `zh-Hant-HK`, with a
  bare `zh-Hant` taking Taiwan. The input script is detected unless `from` names
  it, which matters more than it sounds — plenty of characters are current in
  both scripts, so running 繁體 through the 简→繁 tables would turn 准將 into
  準將.

  **This is orthography, not translation.** 軟體 and 软件 are different words
  rather than two spellings of one. OpenCC folds that into script conversion
  with `s2twp`; pinyinjs does not.

- **`data/script.map`,** the conversion tables, as their own fetchable file:
  282 KB, 96 KB brotli, loaded by `loadScriptTables` only when something asks
  to convert. A caller converting hanzi to pinyin pays nothing for it. The
  character tables alone are right for 99.13% of the 267,639 entries whose two
  scripts differ, and the word exception lists cover the rest.

- **`hansOnly` and `hantOnly`,** the character sets `detectScript` has always
  taken and nothing shipped. They ride in the same file.

- **Round-trip scoring in `pnpm accuracy`.** 繁→简 is near-deterministic, so
  简→繁→简 has to be the identity for essentially every key — half a million
  cases with no hand-labelling, and every failure a real defect. It reports
  99.6% over the words in use and 99.3% over every key. The reverse trip is
  lossy by design and is reported rather than targeted.

- **Hong Kong 繁體 glyph forms are recognised on the lookup path.** Taiwan and
  Hong Kong write the same characters with the same readings and disagree about
  the standard form of 58 of them — 裡 against 裏, 群 against 羣, 麵 against 麪.
  Hong Kong spellings were missing dictionary keys and falling back to
  converting character by character, so 羣眾 and 麪包 read worse than 群眾 and
  麵包 did. The lookup path now normalises 繁體 glyph forms to the Taiwan
  standard the keys are already built from: measured over the 9,833 keys with a
  distinct Hong Kong spelling, 2,358 were already keys and normalisation reaches
  a further 5,439. Only the reading is taken from the normalised form — the
  characters a caller gets back are the ones they wrote. `toCanonicalGlyphs`,
  `toRegionalGlyphs` and the `Region` type are exported for it, and
  SCRIPTS-AND-LOCALES.md carries the reasoning.

  Nineteen of OpenCC's mappings are deliberately not applied, because the
  variant is a live spelling rather than a regional one. Six are current 繁體 —
  台 appears 164 times in CC-CEDICT against 臺's 208 — and thirteen are current
  **简体**, because the PRC simplification adopted the same 新字形 conventions
  Hong Kong did: 着, 温, 脱, 户, 税, 卧, 悦, 兑, 葱, 幺, 棱, 檐, 痹. Normalising
  those would have rewritten 简体 text, and 走着 `zǒuzhe` is the case that
  caught it.

- **OpenCC as a data source.** Its 简体 ↔ 繁體 character tables and the Taiwan
  and Hong Kong variant tables, Apache-2.0, attributed in `NOTICE`. The glyph
  tables are held in `src/script/glyphs.ts` as code rather than shipped as an
  artifact, since 120 mappings do not justify a download and they have to work
  before any dictionary has loaded; `pnpm build:data` re-derives them from
  OpenCC and fails the build if the two have drifted.

### Fixed

- **240 dictionary entries could not be looked up at all.** Recognising Hong
  Kong glyph forms on the lookup path means a key written in a form the path
  normalises _away from_ can never be found, and the merge derived 繁體 forms
  per word from Unihan's variant lists with no single standard behind them — so
  it wrote 裏 where the corpus overwhelmingly writes 裡, and 上樑, 中峯 and 义藴
  became keys nothing could reach. The merge now derives canonical glyph forms,
  and keys a headword's canonical spelling alongside it where the phrase corpus
  wrote one with a 繁體 variant. **No key is now unreachable**, and Hong Kong
  spellings resolve slightly better than before: 5,499 of the 9,978 keys with a
  distinct Hong Kong form, against 5,439.

  Two things had to be got right alongside it. The evidence for "简体 writes
  this character" comes from CC-CEDICT entries whose two columns differ, not
  from the phrase corpus, which is nominally 简体 but carries 峯, 藴 and 枱 of
  its own — counting it cut the table from 50 mappings to 32 and stopped Hong
  Kong text converting at all. And a 繁體 form differing from its 简体 one only
  by glyph normalisation is not evidence about script, or the alias key would
  put that entry's 简体 characters into the 繁體-only set, which is how 发
  briefly stopped being 简体-only.

  `toScript` drops the pass that was papering over this. Key counts move:
  723,149 for `full`, 97,997 for `standard`, 16,975 for `core`.

## 1.3.0

### Added

- **`slug`,** hanzi to a URL-safe slug: 我想学中文。 is
  `wo3-xiang3-xue2-zhong1wen2`. Built on the decode rather than on a finished
  string, which is the whole point of it — 银行 is `yin2hang2` and not
  `yin2xing2`, the separators fall on the word boundaries 分词连写 found, and
  西安 keeps its 隔音符号 as a break so a toneless slug is `xi-an` rather than
  `xian`, which is a different word. Tones are written by default because
  dropping them collides, and `hash` puts a short hash of the _hanzi_ on the end
  for the homophones tones cannot separate: 权利 and 权力 are both `quan2li4`.
  The options generalise it past URLs to search keys and identifiers, which the
  [slug page](docs/slug/) tabulates. `pinyinjs slug` at the command line.

## 1.2.2

### Added

- **`TEACHING_JIAO` and `COUNTED_MEASURE`,** two more lattice rules, and
  `QUANTITY_CHARACTERS`, the 汉字 a quantity is written with that the second of
  them asks about. See the fixes below for what they do and what they measure.

- **`counts` on the numeral options.** Whether the number stands immediately in
  front of something it counts, which is what makes a lone 2 两:
  `numeralHanzi(2, { counts: true })` is `两` and `numeralHanzi(2)` is `二`.
  Unlike `liang` it is not a variable choice — 二个 is simply wrong — but
  nothing about the number says whether it is counting, so the caller says.
  `convert` sets it from the character after the digits.

### Fixed

- **教 was `jiào` even where it was teaching.** 他在北京大学教了三年书 came out
  `jiàole sān nián shū`, and 我教英语, 谁教你法语 and 她教我如何游泳 with it.
  The dictionary stores 教 as `jiào` with `jiāo` as an alternate, and `jiào` is
  right for the compounds — 教育, 教师, 宗教, 主教 — which are words and reach
  their reading through the word; what is left is the 教 standing as a word of
  its own, and that one is the verb. The object is what says so: a pronoun, a
  noun or a name after it, or an aspect particle, since only a verb takes 了,
  过 or 得. Forcing the character's own reading was not enough on its own,
  because a two-character reading carries its 教 into the position from
  outside — 王老师教我们汉语 read `jiào` off 师教 and 来教我 off 来教 — so an
  untagged pair ending in 教 goes too, while every tagged word keeps its
  reading: 任教, 宗教, 主教, 佛教, 传教, 执教, 请教, 家教. Over 88,866 lines
  181 教 decode as a word of their own and every one read `jiào`; 158 are now
  `jiāo`, three of them wrongly — 统一教创始人, 方法教深思 and 做到了教政分离,
  where a nominal compound takes an object's shape. CPP's polyphone score is
  89.05%, up from 89.04%.

- **A 量词 was swallowed by the word behind it.** 三个人 was `sān gèrén`, three
  _personals_, because 个人 is a common noun and nothing weighed it against the
  个 belonging to the 三 in front of it. It is now `sān gè rén`, and so are
  两家人, 三杯水, 四匹马, 十八层楼 and 一段长时间. What makes it decidable is
  that the dictionary tags the 量词: 个, 次, 天 and 杯 are `q`, while the
  characters that only look like measure words in this position are not — 分 is
  a verb, 部 and 成 are nouns, 年 and 点 are numerals — so 五分钟, 三部分,
  五成分, 五年级 and 三点钟 are untouched, and those are exactly the words a
  blanket rule would break. Nor does an ordinal count anything (第三集团军), nor
  a numeral inside a longer word (唯一道路), and a number and its measure
  written solid survive whole where the dictionary has them: 一辈子, 一会儿,
  一口气 and 两口子 are unchanged. Over 88,866 lines the rule forbids 561 edges
  and moves 53 decodes, three of them wrongly — 一批评, 这一名词 and 六七股灾,
  where the 一 and the 六七 count nothing. Exactly one reading changes in the
  whole corpus and it is a fix: 已经下了两天雨了 read 天雨 as `tiān yù`.

- **The Han after a number was decoded without it.** 2个人 was `liǎng gèrén`
  while 两个人 written out was already `liǎng gè rén`, because a Han run was
  decoded on its own and had no idea a number preceded it. A run is now decoded
  with the 汉字 the digits stand for in front of it, and reported without them,
  so digits and 汉字 reach the same decode. `decodeRun` and `decodeRunScored`
  take that context as a fourth argument; where a reading would straddle the
  join — 1点儿事, whose 一点儿 is one `yìdiǎnr` over both sides of it — the run
  is decoded alone, as before.

- **A lone 2 in front of a 量词 was read 二.** 我们买了2个西瓜 came out as
  `wǒmen mǎile èr gè xīguā`, and a 2 standing immediately in front of what it
  counts is 两: it is now `liǎng gè`, and 2岁 is `liǎng suì`, 2点 `liǎng diǎn`
  and 2万人 `liǎng wàn rén`, the same 两 that 2,000 and 2:00 already got. The
  measure words a 2 can count with are an open list, so 两 is the default and
  the exceptions are named — 月, 日, 号, 楼, 路, 班 and 期, where the digit
  labels a position rather than counting (2月 is `èr yuè`), an ordinal, which
  the 第 in front of it marks (第2次 is `dì èr cì`), and 十 and 百, which follow
  二 as 20 and 200 already do. A 2 inside a larger number is untouched: 12个 is
  still `shí'èr gè`.

## 1.2.1

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

## 1.2.0

### Fixed

- **`--system ipa` capitalised the IPA.** 我去银行。他姓王。 came out as
  `Uo˨˩˦ ... Tʰa˥ ɕiŋ˥˩ Uaŋ˧˥`, with the sentence capital and the proper noun
  carried over from the pinyin as though a transcription spelled words. IPA
  letters are symbols rather than an alphabet, since `[T]` is not `[t]` in a
  larger size but a symbol the IPA does not have, so the capitals are now dropped for
  IPA and bopomofo and kept for the three romanisations. `toTranscription`
  takes `{ capitals: false }` for callers writing their own.

## 1.1.0

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

Over the 130-case gold corpus, which is committed to the repository rather than
to the published package, and scored by `pnpm accuracy`:

|                  |   lattice | greedy baseline |
| ---------------- | --------: | --------------: |
| exact match      | **97.7%** |           86.9% |
| reading accuracy |     99.7% |           97.9% |
| spacing (F1)     | **99.8%** |           95.7% |

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
