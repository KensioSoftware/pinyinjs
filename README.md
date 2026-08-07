# pinyinjs

Hanzi → pinyin conversion for TypeScript, in Node and the browser. Also parses,
validates and writes pinyin syllables on their own, with no dictionary.

[https://pinyinjs.dev](https://pinyinjs.dev "PinyinJS docs website")

## Install

```bash
pnpm add @kensio/pinyinjs
```

Node 22+, or any browser. The core imports no Node built-ins, and the package is
ESM only.

The dictionaries ship inside the package, which is what makes it a 4 MB
download: `data/` is 10 MB of artifacts and the point of the whole thing.

## Command line

Installing the package installs a `pinyinjs` command, which is the quickest way
to try any of this.

```console
$ pinyinjs convert 我要去北京。
Wǒ yào qù Běijīng.

$ pinyinjs convert --notation numbers 银行
yin2hang2

$ pinyinjs slug 我想学中文。
wo3-xiang3-xue2-zhong1wen2

$ pinyinjs explain 银行
银行  yínháng
  yín     locked
  háng    word    xíng +24.6  héng +26.6  hàng +27.6

$ pinyinjs lookup 头发
头发  tóu fa  n

$ pinyinjs syllable nǐhǎo
nǐhǎo  nǐ hǎo
  nǐ        n + i, tone 3         nǐ  ni3  ni³
  hǎo       h + ao, tone 3        hǎo  hao3  hao³

$ pinyinjs convert --system wade-giles --notation none 我要去北京。
Wo yao ch'ü Pei-ching.

$ pinyinjs transcribe běijīng
běijīng     běijīng   ㄅㄟˇ ㄐㄧㄥ     pei³-ching¹ běijīng   beeijing  pei˨˩˦tɕiŋ˥
```

| Command      | Does                                                |
| ------------ | --------------------------------------------------- |
| `convert`    | hanzi to pinyin                                     |
| `html`       | the same, as HTML                                   |
| `slug`       | hanzi to a URL-safe slug                            |
| `explain`    | each syllable, how settled it was, and what it beat |
| `lookup`     | what the dictionary holds for a word                |
| `syllable`   | take written pinyin apart                           |
| `sandhi`     | apply tone sandhi to written pinyin                 |
| `number`     | read a number as Chinese numerals                   |
| `transcribe` | pinyin to bopomofo, Wade-Giles, Yale, GR and IPA    |
| `info`       | which dictionary is loaded, and how big it is       |

Every conversion option below is a flag: `--notation`, `--locale`,
`--apostrophe`, `--capitals`, `--punctuation`, `--no-grouping`, `--third-tone`,
`--no-sandhi`. Run `pinyinjs <command> --help` for what a command takes.

A command given no arguments reads standard input, one text per line, so
`cat article.txt | pinyinjs convert` works. `syllable` and `sandhi` need no
dictionary at all and start without loading one.

At a terminal each syllable is written in its tone's colour, in
[MDBG](https://www.mdbg.net)'s palette of red, yellow, green, blue, and the
terminal's own colour for the neutral tone. It is off for a pipe, `NO_COLOR` is
honoured, `--colour` and `--no-colour` force it either way, and `--json` is
never coloured. See [the command line](docs/cli/#colour).

### Calling it from something else

`convert` writes the pinyin and nothing else, so it drops straight into a
pipeline:

```console
$ pinyinjs convert 银行
yínháng
```

Everything else has columns for a person to read. Add `--json` to any command
and it writes one JSON document per answer instead, which is what `jq` wants:

```console
$ pinyinjs explain 长江大桥 --json | jq -c '.syllables[] | select(.state != "locked")'
{"text":"Cháng","state":"word","tone":2,"alternatives":[{"reading":"zhǎng","cost":24.62}]}
{"text":"Dà","state":"word","tone":4,"alternatives":[{"reading":"dài","cost":22.62}]}

$ pinyinjs lookup 垃圾 --json | jq -r .taiwanReading
lè sè

$ cat article.txt | pinyinjs convert --json | jq -r .pinyin
```

One document per answer rather than one array for the whole run, so the shape
is the same whether you convert one word or pipe a file through.

## Load a dictionary

Converting needs a dictionary, and it is a fetchable file rather than a
JavaScript module, so loading it is asynchronous.

```ts
import { convert, loadDictionary } from "@kensio/pinyinjs";
import { fileSource } from "@kensio/pinyinjs/node";

const source = fileSource("node_modules/@kensio/pinyinjs/data");
const dictionary = await loadDictionary(source, "full");

convert(dictionary, "银行"); // "yínháng"
```

In a browser, serve the package's `data/` directory and fetch it:

```ts
import { convert, fetchSource, loadDictionary } from "@kensio/pinyinjs";

const dictionary = await loadDictionary(fetchSource("/data"), "standard");
convert(dictionary, "长城"); // "Chángchéng"
```

Serve the artifacts uncompressed and let HTTP `Content-Encoding: br` compress
them: `DecompressionStream` has no brotli.

Load the dictionary once and keep it; it is immutable and safe to share.

### Tiers

| Tier       | Entries | Download (brotli) | Contains               |
| ---------- | ------: | ----------------: | ---------------------- |
| `core`     |  16,730 |             70 KB | single characters only |
| `standard` |  66,730 |            376 KB | the most common words  |
| `full`     | 461,623 |          2,381 KB | every word             |

`full` is the default. The tiers are nested, so a page can load `standard`
first, convert with it, and reload as `full` arrives.

## Convert

```ts
convert(dictionary, "银行"); // "yínháng"
convert(dictionary, "行长"); // "hángzhǎng"
convert(dictionary, "我要去北京。"); // "Wǒ yào qù Běijīng."
convert(dictionary, "3D银行"); // "sān D yínháng", the digit is read, the letter is not
```

A reading the dictionary cannot settle on its own is settled by context, with
typed rules over the lattice rather than tweaks to the output:

```ts
convert(dictionary, "我得走了"); // "wǒ děi zǒule", modal 得
convert(dictionary, "他跑得很快"); // "tā pǎo de hěn kuài", the particle
convert(dictionary, "那边儿"); // "nà biānr", 儿 does not stand on its own
```

See [converting](docs/converting/#rules-where-the-cost-model-cannot-reach).

### Options

```ts
convert(dictionary, text, { notation: "numbers", capitals: "none" });
```

| Option        | Default                            | Values                                            |
| ------------- | ---------------------------------- | ------------------------------------------------- |
| `locale`      | `"zh-CN"`                          | `"zh-CN"`, `"zh-TW"`                              |
| `notation`    | `"marks"`                          | `"marks"`, `"numbers"`, `"superscript"`, `"none"` |
| `apostrophe`  | `"always"`                         | `"always"`, `"standard"`, `"never"`               |
| `capitals`    | `"auto"`                           | `"auto"`, `"proper"`, `"none"`                    |
| `punctuation` | `"latin"`                          | `"latin"`, `"keep"`                               |
| `grouping`    | `true`                             | `false` turns off GB/T 16159 word spacing         |
| `numbers`     | `"read"`                           | `"keep"` leaves every digit as it was written     |
| `numbers`     | `"read"`                           | `"keep"` leaves every digit as it was written     |
| `sandhi`      | `{ yiBu: true, thirdTone: false }` | `{ yiBu?: boolean; thirdTone?: boolean }`         |

```ts
convert(dictionary, "垃圾"); // "lājī"
convert(dictionary, "垃圾", { locale: "zh-TW" }); // "lèsè"
convert(dictionary, "银行", { notation: "numbers" }); // "yin2hang2"
convert(dictionary, "银行", { notation: "superscript" }); // "yin²hang²"
convert(dictionary, "银行", { notation: "none" }); // "yinhang"
convert(dictionary, "西安"); // "Xī'ān"
convert(dictionary, "海鸥", { apostrophe: "standard" }); // "hǎiōu"
convert(dictionary, "北京。", { punctuation: "keep" }); // "Běijīng。"
convert(dictionary, "北京。", { capitals: "none" }); // "běijīng."
convert(dictionary, "好好", { sandhi: { thirdTone: true } }); // "háohǎo"
```

### Spacing, capitals and punctuation

**Capitals.** Proper nouns always; the first word of a sentence only when the
source is punctuated as one, since that is the only thing separating 学生 looked
up as a word from 这是我的书。written as a sentence. A comma does not count.

```ts
convert(dictionary, "银行"); // "yínháng", not "Yínháng"
convert(dictionary, "我要去北京。"); // "Wǒ yào qù Běijīng."
convert(dictionary, "你好，世界"); // "nǐ hǎo, shìjiè"
```

**Apostrophes.** The 隔音符号 goes before any syllable of a word that starts with
`a`, `o` or `e` and is not the first. `apostrophe: "standard"` writes it only
where leaving it out would read as something else.

```ts
convert(dictionary, "天安门"); // "Tiān'ānmén"
convert(dictionary, "女儿"); // "nǚ'ér"
```

**Punctuation.** `。，、；：？！` are rewritten as their Latin equivalents and take
the space the full-width glyph carried. Brackets and quotation marks are left
alone. `punctuation: "keep"` leaves everything as it was.

**Word spacing.** 分词连写 is applied to the decoded words: aspect particles
attach to their verb, suffixes to their stem, and the generic half of a place
name separates and capitalises. A small curated list covers words the standard
writes in a way no rule reaches.

```ts
convert(dictionary, "他看了"); // "tā kànle"
convert(dictionary, "我还给你了。"); // "Wǒ huán gěi nǐ le.", sentence-final 了
convert(dictionary, "作者"); // "zuòzhě"
convert(dictionary, "南京市"); // "Nánjīng Shì"
convert(dictionary, "南京市", { grouping: false }); // "Nánjīngshì"
convert(dictionary, "不是"); // "bú shì"
convert(dictionary, "一个"); // "yí gè"
convert(dictionary, "黄河"); // "Huáng Hé"
convert(dictionary, "中国人"); // "Zhōngguórén"
```

The list is not a complete 正词法 implementation, so some words it does not
cover are written differently: 不但 is `búdàn`, 大米 is `dàmǐ`, 青海 is
`Qīnghǎi`.

**Reduplication** takes a hyphen rather than a space, since it is one word with
a boundary inside it.

```ts
convert(dictionary, "干干净净"); // "gāngān-jìngjìng"
convert(dictionary, "研究研究"); // "yánjiū-yánjiū"
convert(dictionary, "爸爸妈妈"); // "bàba māma", that shape, but two words
```

**A 成语 that can be read as two disyllables** takes the same hyphen, from a
curated list of 117; the rest are written solid, as the standard writes them.

```ts
convert(dictionary, "风平浪静"); // "fēngpíng-làngjìng"
convert(dictionary, "不亦乐乎"); // "búyìlèhū", cannot be halved
```

**Digits are read**, and the rest of a non-Han run passes through exactly as
written:

```ts
convert(dictionary, "我有3个苹果。"); // "Wǒ yǒu sān gè píngguǒ."
convert(dictionary, "1988年之后"); // "yī jiǔ bā bā nián zhīhòu"
convert(dictionary, "95%的人"); // "bǎifēnzhījiǔshíwǔ de rén"
convert(dictionary, "3D打印"); // "sān D dǎyìn"
convert(dictionary, "6:30起床"); // "liù diǎn sānshí fēn qǐchuáng"
convert(dictionary, "16:9的"); // "16:9de", a ratio is not a quantity
```

`numbers: "keep"` leaves every digit alone. See [numbers](docs/numerals/).

## Syllable by syllable

`convertPieces` returns the same conversion one piece at a time, with the
syllable behind each and what the decoder chose it over.

```ts
import { convertPieces, isUncertain, writeSyllable } from "@kensio/pinyinjs";

const pieces = convertPieces(dictionary, "银行");
pieces.map((piece) => piece.text); // ["yín", "háng"]
pieces[1]?.syllable; // { initial: "h", final: "ang", tone: 2 }
pieces[0]?.confidence?.isLocked; // true, nothing else can be read here
pieces[1]?.confidence?.alternatives.map((found) =>
  found.reading.map((syllable) => writeSyllable(syllable)).join(""),
); // ["xíng", "héng", "hàng"]
```

A piece with no `syllable` is the text between two of them: a space, or a run
that was never Han. `joinPieces(pieces)` gives back exactly what `convert`
returns.

Each syllable is in one of three states:

| State            | `isLocked` | `isUncertain` | Meaning                                                    |
| ---------------- | ---------- | ------------- | ---------------------------------------------------------- |
| locked           | `true`     | `false`       | only one reading is possible here                          |
| backed by a word | `false`    | `false`       | other readings exist; taking one means breaking a word up  |
| uncertain        | `false`    | `true`        | another reading of the same characters was nearly as cheap |

```ts
const guesses = (text: string) =>
  convertPieces(dictionary, text).filter(
    (piece) => piece.confidence !== undefined && isUncertain(piece.confidence),
  );

guesses("行").map((piece) => piece.text); // ["xíng"], nothing but a prior chose it
guesses("银行").map((piece) => piece.text); // [], the word settles both syllables
```

An alternative's `cost` says how much more the cheapest conversion taking it
would have cost, in the decoder's own units. Treat it as a measure of how much
evidence there was, not as a probability.

## HTML output

```ts
import { convertToHtml } from "@kensio/pinyinjs";

convertToHtml(dictionary, "行");
// <span class="py-syllable py-tone-2 py-uncertain"
//       data-alternatives="háng héng hàng">xíng</span>
```

One element per syllable, with `py-tone-1` to `py-tone-5` (5 is the neutral
tone), and `py-uncertain` plus the rejected readings where the decoder was
guessing. Text that is not Han is escaped, not marked up. No styles are
included, so write your own:

```css
.py-tone-1 {
  color: #c1272d;
}
.py-uncertain {
  border-bottom: 1px dotted currentcolor;
}
```

Takes any `convert` option, plus `toneClasses: false` and
`markUncertain: false`. `toHtml(pieces, options)` renders pieces you already
have.

## Look words up

```ts
const entry = dictionary.lookup("头发");
entry?.reading; // [{ initial: "t", final: "ou", tone: 2 }, { initial: "f", final: "a", tone: 5 }]
entry?.isProperNoun; // false
entry?.partOfSpeech; // "n", jieba's tag

dictionary.lookup("頭髮")?.reading; // the same reading, found under 繁體
dictionary.lookup("重複")?.reading; // 重複 and 重覆 are both keys for 重复
dictionary.hasPrefix("银"); // true, does any word start with this?
dictionary.readingsOf("行"); // xíng, háng, héng, hàng, likeliest first
```

Both scripts are keys in the same dictionary, so nothing is converted before a
lookup.

## Syllables

The syllable layer needs no dictionary and no network.

```ts
import { isSyllable, readSyllable, writeSyllable } from "@kensio/pinyinjs";

readSyllable("jiù"); // { initial: "j", final: "iou", tone: 4 }
readSyllable("jiu4"); // the same, both notations parse
readSyllable("lv4"); // { initial: "l", final: "ü", tone: 4 }
readSyllable("hello"); // undefined
readSyllable("běi3"); // undefined, one notation at a time

isSyllable("wánr"); // true, 儿化 is a suffix, not a syllable of its own
```

Initials and finals are the _underlying_ forms rather than the spelling, so 就 is
`j` + `iou` and 军 is `j` + `ün`. Spelling is reconstructed on demand:

```ts
const jiu = { initial: "j", final: "iou", tone: 4 } as const;
writeSyllable(jiu); // "jiù"
writeSyllable(jiu, "numbers"); // "jiu4"
writeSyllable(jiu, "superscript"); // "jiu⁴"
writeSyllable(jiu, "none"); // "jiu"
```

Input takes either notation, the `v` and `u:` conventions for ü, and raised tone
digits. Output is standard diacritics unless asked otherwise.

Parsing answers whether a spelling is _well formed_, not whether Mandarin uses
it: `shong` parses and is not a real syllable. The attested inventory is
separate:

```ts
import { ATTESTED_SYLLABLES, DICTIONARY_SYLLABLES } from "@kensio/pinyinjs";

DICTIONARY_SYLLABLES.has("shong"); // false
DICTIONARY_SYLLABLES.has("zhuang"); // true
ATTESTED_SYLLABLES.length; // 415
```

### Splitting written pinyin

```ts
import { readWord, splitSyllables } from "@kensio/pinyinjs";

splitSyllables("nǐhǎo"); // ["nǐ", "hǎo"]
splitSyllables("Xī'ān"); // ["Xī", "ān"]
splitSyllables("yinhang"); // ["yin", "hang"]
splitSyllables("guórén"); // ["guó", "rén"], not ["guór", "én"]
splitSyllables("hǎiōu"); // ["hǎi", "ōu"], missing apostrophe, read anyway
readWord("yínháng"); // the same, parsed into Syllable objects
```

### Tones

```ts
import {
  applyToneMark,
  NEUTRAL_TONE,
  stripToneMarks,
  toneFromMarks,
} from "@kensio/pinyinjs";

applyToneMark("hao", 3); // "hǎo"
applyToneMark("hao", NEUTRAL_TONE); // "hao"
stripToneMarks("hǎo"); // "hao"
toneFromMarks("hǎo"); // 3
```

`Syllable.tone` is `Tone | undefined`, and undefined is not the neutral tone: the
`de` in 我的 is neutral (5), whereas the `bei` in a typed `beijing` has no tone
written at all.

## Numbers

Reading a number needs no dictionary, just arithmetic and about twenty
readings, so this works with nothing loaded.

```ts
import { numeralHanzi, percentHanzi, readNumeral } from "@kensio/pinyinjs";

numeralHanzi(12345); // "一万两千三百四十五"
numeralHanzi(1005); // "一千零五", a skipped place is spoken
numeralHanzi(2000); // "两千", a leading lone 2 before a big unit
numeralHanzi(2, { counts: true }); // "两", as in 两个西瓜, never 二个
percentHanzi(95); // "百分之九十五", the order reverses
```

The same digits are read two ways and nothing in the number says which, since
2026年 is spelled out and 2026个 is counted, so the style is the caller's:

```ts
numeralHanzi(2026); // "两千零二十六"
numeralHanzi(2026, { style: "digits" }); // "二〇二六"
readNumeral(110, { style: "digits", yao: true }); // yāo yāo líng
```

More in [numbers](docs/numerals/).

## Bopomofo, Wade-Giles, Yale, Gwoyeu Romatzyh and IPA

Also dictionary-free: a romanisation is a mapping over about 420 syllables, so
hanzi → Wade-Giles is hanzi → pinyin → Wade-Giles.

```ts
import {
  readSyllable,
  readWadeGilesLoosely,
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
writeGwoyeu(jiu); // "jiow"
writeIpa(jiu); // "tɕiou˥˩"
```

Gwoyeu Romatzyh is the odd one, and it needs no tone mark because the tone is
spelled into the syllable, which is why 陝西 is Shaanxi in English and 山西 is
Shanxi:

```ts
const gr = (pinyin: string) => writeGwoyeu(readSyllable(pinyin));
[gr("shān"), gr("shán"), gr("shǎn"), gr("shàn")]; // shan, sharn, shaan, shann
```

Reading Wade-Giles back gives an **array**, because real text drops the
apostrophes and diacritics that carry the distinctions:

```ts
readWadeGilesLoosely("chi¹"); // [jī, qī]: chi is jī, ch'i is qī
readWadeGilesLoosely("chu¹"); // [zhū, chū, jū, qū]
```

Measured over the phrase corpus, 52.07% of written syllables have a Wade-Giles
spelling that merges with another once its marks are dropped, and taking the
first candidate recovers 79.05% of them. More in
[romanisation](docs/romanization/).

## Sandhi

The dictionary stores underlying tones, and sandhi is applied to the syllable
array, so it can be switched off and works across word boundaries.

```ts
import { applySandhi, readWord } from "@kensio/pinyinjs";

const buShi = readWord("bùshì") ?? [];
applySandhi(buShi); // bú shì, 不 flattens before a fourth tone
applySandhi(buShi, { yiBu: false }); // unchanged

const niHao = readWord("nǐhǎo") ?? [];
applySandhi(niHao); // unchanged by default
applySandhi(niHao, { thirdTone: true }); // ní hǎo
```

Third-tone sandhi is off by default: standard orthography writes 你好 as
`nǐ hǎo` even though it is said `ní hǎo`. Turn it on for transcribing speech.

## Scripts and locales

Script and locale are separate options: Taiwan writes 繁體 with `zh-TW`
readings, but mainland editions of classical texts use 繁體 with `zh-CN`
readings, and Singapore uses 简体.

| Axis   | Values            | What differs                 |
| ------ | ----------------- | ---------------------------- |
| Script | `Hans` / `Hant`   | which characters are written |
| Locale | `zh-CN` / `zh-TW` | how they are read            |

Both scripts are dictionary keys, so only the locale is an option to pass.

## API

| Function                                             | Does                                              |
| ---------------------------------------------------- | ------------------------------------------------- |
| `loadDictionary(source, tier)`                       | load a dictionary from `fileSource`/`fetchSource` |
| `convert(dictionary, text, options?)`                | hanzi → pinyin                                    |
| `convertPieces(dictionary, text, ...)`               | the same, per syllable, with confidence           |
| `convertToHtml(dictionary, text, ...)`               | the same, as HTML                                 |
| `slug(dictionary, text, options?)`                   | hanzi → a URL-safe slug                           |
| `joinPieces(pieces)` / `toHtml(pieces)`              | render pieces                                     |
| `isUncertain(confidence)`                            | was this syllable a guess?                        |
| `dictionary.lookup / hasPrefix / readingsOf`         | query the dictionary                              |
| `readSyllable` / `writeSyllable` / `isSyllable`      | one syllable, no dictionary                       |
| `splitSyllables` / `readWord`                        | split written pinyin                              |
| `applySandhi`                                        | 一, 不 and optional third-tone sandhi             |
| `writeBopomofo` / `writeWadeGiles`                   | one syllable, romanised                           |
| `writeYale` / `writeGwoyeu` / `writeIpa`             | the same, in Yale, GR and IPA                     |
| `readBopomofo` / `readWadeGilesLoosely`              | and back again                                    |
| `readYale` / `readGwoyeu` / `readIpa`                | and back from those three                         |
| `applyToneMark` / `stripToneMarks` / `toneFromMarks` | tone marks                                        |
| `convertGreedily(...)`                               | the old longest-match decoder, kept as a baseline |

Types (`Syllable`, `Tone`, `ConvertOptions`, `ConvertedPiece`,
`ReadingConfidence`, `HtmlOptions`, `WordEntry`, `Tier`, `Locale`, `Script`) are
exported alongside them.

## Development

```bash
pnpm install
pnpm check      # format, complexity, build, typecheck, test with coverage
./pinyinjs      # the CLI, straight from the sources: ./pinyinjs convert 你好
pnpm accuracy   # score both decoders against the gold corpus
pnpm polyphones # score them against 20,139 hand-labelled polyphones
pnpm build:data # rebuild data/ from the upstream sources
```

`pnpm check` must pass: eslint on `strictTypeChecked`, `tsc` with
`exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`, and vitest at 95%
coverage thresholds.

Every example in this README is executed by `src/readme.test.ts` against the
committed dictionary, so the two cannot drift apart. Change them together.

The compiled dictionaries in `data/` are committed, so what ships is exactly
what was tested. `pnpm build:data` fetches the four sources into `.cache/`
(~32 MB), merges them, runs the build assertions, and rewrites `data/` and
`NOTICE`. It fails rather than warns: no artifact is written unless 儿化 is
repaired both ways, 一 and 不 sandhi is normalised out, every syllable is one
the inventory knows, and every tier reads back exactly as it was built.

## Data sources

| Source                                                                | Provides                                              | Licence      |
| --------------------------------------------------------------------- | ----------------------------------------------------- | ------------ |
| [Unihan](https://www.unicode.org/charts/unihan.html)                  | character readings, polyphone priors, script variants | Unicode      |
| [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict)   | 简体/繁體 pairs, 儿化, neutral tones, Taiwan readings | CC BY-SA 4.0 |
| [phrase-pinyin-data](https://github.com/mozillazg/phrase-pinyin-data) | the bulk of the word readings                         | MIT          |
| [jieba](https://github.com/fxsjy/jieba)                               | word frequencies and part-of-speech tags              | MIT          |

`NOTICE` is generated from the same table the pipeline fetches from.

## Licence

`Apache-2.0 AND CC-BY-SA-4.0`, because the package is two things: the code is
Apache-2.0, and the compiled dictionaries in `data/` are share-alike, CC-CEDICT
being CC BY-SA 4.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE), which is
generated from the sources the pipeline actually fetched.
