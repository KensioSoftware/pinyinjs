# The command line

Installing the package adds the `pinyinjs` command. Use it interactively, in a
pipeline or with `--json` for structured output.

```console
$ pinyinjs convert 我要去北京。
Wǒ yào qù Běijīng.
```

## Commands

| Command      | Does                                                |
| ------------ | --------------------------------------------------- |
| `convert`    | hanzi to pinyin                                     |
| `html`       | the same, as HTML                                   |
| `annotate`   | hanzi with its reading above, as ruby HTML          |
| `segment`    | split text into words                               |
| `match`      | filter text by a pinyin query, best first           |
| `check`      | mark typed pinyin against the text                  |
| `slug`       | hanzi to a URL-safe slug                            |
| `script`     | 简体 ↔ 繁體 conversion                              |
| `explain`    | each syllable, how settled it was, and what it beat |
| `lookup`     | what the dictionary holds for a word                |
| `syllable`   | take written pinyin apart                           |
| `sandhi`     | apply tone sandhi to written pinyin                 |
| `number`     | read a number as Chinese numerals                   |
| `transcribe` | pinyin to bopomofo, Wade-Giles, Yale, GR and IPA    |
| `info`       | which dictionary is loaded, and how big it is       |

Run `pinyinjs <command> --help` for the arguments and options of a command.

### convert

```console
$ pinyinjs convert 银行
yínháng

$ pinyinjs convert --notation numbers 银行
yin2hang2

$ pinyinjs convert --locale zh-TW 垃圾
lèsè

$ pinyinjs convert --system wade-giles --notation none 我要去北京。
Wo yao ch'ü Pei-ching.
```

Writes the converted text. Set `--system` to `bopomofo`, `wade-giles`, `yale`,
`gwoyeu` or `ipa` to choose another transcription system. Word grouping stays
the same, with separators supplied by the system. See
[romanisation](../romanization/#hanzi-to-wade-giles-end-to-end).

### explain

```console
$ pinyinjs explain 银行
银行  yínháng
  yín     locked
  háng    word    xíng +14.6  héng +16.6  hàng +17.6

$ pinyinjs explain 长江大桥
长江大桥  Cháng Jiāng Dàqiáo
  Cháng   word    zhǎng +14.6
  Jiāng   locked
  Dà      word    dài +12.6
  qiáo    locked
```

Prints each syllable, its confidence state (`locked`, `word` or `uncertain`),
and alternative readings with their costs. See [confidence](../confidence/).

### check

```console
$ pinyinjs check 银行 yínxíng
银行  yínháng  50%
  银     yín     yín     correct
  行     háng    xíng    wrong

$ pinyinjs check 北京 bei3jing3
北京  Běijīng  50%
  北     běi     bei3    correct
  京     jīng    jing3   tone

$ pinyinjs check 银行 "yín háng" --require-spacing
银行  yínháng  50%
  银     yín     yín     correct
  行     háng    háng    correct   split
```

Prints the expected reading, score and a verdict for each typed syllable.
Mistakes include the source characters and any incorrect word boundaries. See
[checking](../checking/).

The first argument is Chinese text. Remaining arguments are joined as the typed
pinyin. Use `--require-tones` and `--require-spacing` to count them in the
score. All conversion flags also apply.

### lookup

```console
$ pinyinjs lookup 头发
头发  tóu fa  n

$ pinyinjs lookup 垃圾
垃圾  lā jī  n
  zh-TW  lè sè
```

Prints the word, its 普通话 reading and jieba part-of-speech tag. A 國語
reading appears separately when it differs. Both scripts are accepted as keys.

### match

```console
$ pinyinjs match --query bjdx 北京大学 我在北京大学学中文 上海大学
[北京大学]  7.00
我在[北京大学]学中文  6.33
上海大学  no match
```

Matches Chinese texts against a pinyin query. `beijing`, `bei jing`, `bj`,
`beij` and `bei3jing1` all find 北京. Matches appear first, ranked by score,
with matching text in brackets. Non-matching texts are also reported.

Supply the query as a flag and the texts as arguments or standard input:

```console
$ cat titles.txt | pinyinjs match --query bjdx
```

`--json` includes `ranges` and `score`. See [matching](../matching/) for the
ranking rules.

### syllable

```console
$ pinyinjs syllable nǐhǎo
nǐhǎo  nǐ hǎo
  nǐ        n + i, tone 3         nǐ  ni3  ni³
  hǎo       h + ao, tone 3        hǎo  hao3  hao³
```

Splits written pinyin into syllables, reports each initial, final and tone, and
formats it in all three tone notations. No dictionary is required.

### sandhi

```console
$ pinyinjs sandhi bùshì
bùshì  bú shì

$ pinyinjs sandhi --third-tone nǐhǎo
nǐhǎo  ní hǎo
```

Applies tone sandhi to pinyin without loading a dictionary. See
[sandhi](../sandhi/).

### number

```console
$ pinyinjs number 2026
2026        两千零二十六            liǎng qiān líng èr shí liù

$ pinyinjs number --digits 2026
2026        二〇二六              èr líng èr liù

$ pinyinjs number --digits --yao 110
110         一一〇               yāo yāo líng

$ pinyinjs number --percent 95
95          百分之九十五            bǎi fēn zhī jiǔ shí wǔ
```

Use `--digits` to read each digit separately, `--yao` to read 一 as `yāo`, or
`--no-liang` to use 二 where the default uses 两. No dictionary is required.
See [numbers](../numerals/).

### transcribe

```console
$ pinyinjs transcribe běijīng
běijīng     běijīng   ㄅㄟˇ ㄐㄧㄥ     pei³-ching¹ běijīng   beeijing  pei˨˩˦tɕiŋ˥

$ pinyinjs transcribe --from wade-giles chu¹
chu¹        zhū       ㄓㄨ          chu¹        jū        ju        ʈʂu˥
            chū       ㄔㄨ          ch'u¹       chū       chu       ʈʂʰu˥       marks restored
            jū        ㄐㄩ          chü¹        jyū       jiu       tɕy˥        marks restored
            qū        ㄑㄩ          ch'ü¹       chyū      chiu      tɕʰy˥       marks restored
```

Prints pinyin, bopomofo, Wade-Giles, Yale, Gwoyeu Romatzyh and IPA columns.
Ambiguous input produces multiple rows. For example, Wade-Giles `chu` without
its distinguishing marks has four possible readings. No dictionary is required.

Set `--from` to `pinyin`, `wade-giles`, `bopomofo`, `yale`, `gwoyeu` or `ipa`.
Automatic detection recognises bopomofo and treats all other input as pinyin.
See [romanisation](../romanization/).

### html

```console
$ pinyinjs html 行
<span class="py-syllable py-tone-2 py-uncertain" lang="zh-Latn-CN-pinyin" data-alternatives="háng héng hàng">xíng</span>
```

`html` converts text to syllable elements. `annotate` keeps the hanzi with
readings above them. Both accept `--system` for another transcription system:

```console
$ pinyinjs annotate --system bopomofo 银
<ruby lang="zh">银<rp>(</rp><rt><span class="py-syllable py-tone-2" lang="zh-Bopo-CN">ㄧㄣˊ</span></rt><rp>)</rp></ruby>
```

See [HTML output](../html/).

### script

```console
$ pinyinjs script 我们后来发现了头发问题 --to zh-Hant
我們後來發現了頭髮問題

$ pinyinjs script 干燥 干部 --to zh-Hant
乾燥
幹部

$ pinyinjs script 面包 --to zh-Hant-HK
麪包

$ pinyinjs script 頭髮
头发
```

`--to` accepts `zh-Hans` (the default), `zh-Hant`, `zh-Hant-TW` or `zh-Hant-HK`.
`zh-Hant` uses Taiwan forms. Input script is detected automatically. Use
`--from-script Hans` or `Hant` to override detection.

Plain output contains the converted text. `--json` also reports uncertainty:

```console
$ pinyinjs script 下面 --to zh-Hant --json | jq -c .uncertain
["面"]
```

For example, 下面 can refer to a surface or noodles. Both read `xiàmiàn`, so
pronunciation alone cannot choose between them. See
[script conversion](../script-conversion/).

### info

```console
$ pinyinjs info
tier       full
data       the artifacts that shipped
keys       723,147
syllables  415 attested, 424 spellings in the inventory
```

Prints the loaded dictionary’s source and size. Use it to check which dictionary
`--data` or `--tier` selected.

## Options

These conversion flags apply to `convert`, `html`, `annotate`, `explain` and
`check`:

| Flag                    | Library option                |
| ----------------------- | ----------------------------- |
| `--notation <value>`    | `notation`                    |
| `--locale <value>`      | `locale`                      |
| `--apostrophe <value>`  | `apostrophe`                  |
| `--capitals <value>`    | `capitals`                    |
| `--punctuation <value>` | `punctuation`                 |
| `--no-grouping`         | `grouping: false`             |
| `--keep-numbers`        | `numbers: "keep"`             |
| `--third-tone`          | `sandhi: { thirdTone: true }` |
| `--no-sandhi`           | `sandhi: { yiBu: false }`     |

Additional flags depend on the command:

- `convert` accepts `--system` and `--greedy`. See the
  [greedy baseline](../converting/#the-greedy-baseline).
- `html` and `annotate` accept `--no-tone-classes`, `--no-uncertain`,
  `--no-lang` and `--system`.
- `check` accepts `--require-tones` and `--require-spacing`.
- `sandhi` accepts `--third-tone` and `--no-sandhi`.
- `number` accepts `--digits`, `--yao`, `--no-liang`, `--percent`,
  `--notation` and the sandhi flags.
- `transcribe` accepts `--from` and `--notation`.

[Options](../options/) documents what each value does.

These work on every command:

| Flag                        | Does                                    |
| --------------------------- | --------------------------------------- |
| `--data <dir>`              | read the dictionary from this directory |
| `--tier <tier>`             | `core`, `standard` or `full` (default)  |
| `--colour`, `--color`       | colour the tones, terminal or not       |
| `--no-colour`, `--no-color` | leave the tones uncoloured              |
| `--json`                    | write one JSON document per answer      |
| `-h`, `--help`              | show help                               |
| `-v`, `--version`           | show the version                        |

`syllable`, `sandhi`, `number` and `transcribe` skip dictionary loading.
`--data` and `--tier` have no effect on them.

## Colour

At a terminal, `convert`, `explain`, `lookup`, `syllable`, `sandhi`, `number`
and `transcribe` colour syllables by tone using the
[MDBG](https://www.mdbg.net) palette:

| Tone   | MDBG      | In the terminal           |
| ------ | --------- | ------------------------- |
| 1 阴平 | `#ff0000` | red                       |
| 2 阳平 | `#d09000` | yellow                    |
| 3 上声 | `#00a000` | green                     |
| 4 去声 | `#0044ff` | blue                      |
| 5 轻声 | `#000000` | the terminal's own colour |

Neutral tones and syllables with no written tone keep the terminal’s default
text colour. See [tones](../syllables/#tones) for the difference.

Colour is enabled for terminals and disabled for pipes. `NO_COLOR` disables it.
Use `--colour` or `--no-colour` to override detection (`--color` is also
accepted). JSON output never includes terminal colour codes. HTML output uses
CSS classes.

The CLI chooses the closest readable colours supported by the terminal. A
16-colour terminal gives less accurate second- and third-tone colours than a
256-colour terminal.

## Standard input

A command given no arguments reads standard input, one text per line:

```console
$ cat article.txt | pinyinjs convert
```

Each input line is processed separately.

For `check`, provide Chinese text and typed pinyin as a tab-separated pair on
each line:

```console
$ printf '银行\tyínxíng\n北京\tbei3jing3\n' | pinyinjs check
```

## JSON output

Add `--json` to get structured output from any command:

```console
$ pinyinjs explain 长江大桥 --json | jq -c '.syllables[] | select(.state != "locked")'
{"text":"Cháng","state":"word","tone":2,"alternatives":[{"reading":"zhǎng","cost":14.62}]}
{"text":"Dà","state":"word","tone":4,"alternatives":[{"reading":"dài","cost":12.62}]}

$ pinyinjs lookup 垃圾 --json | jq -r .taiwanReading
lè sè

$ cat article.txt | pinyinjs convert --json | jq -r .pinyin
```

The CLI writes one JSON document per result. Streamed input produces
newline-delimited JSON that can be processed one line at a time.

## Running it from a checkout

The repository’s `./pinyinjs` script runs the CLI from TypeScript source
without a build step:

```bash
./pinyinjs convert 你好
```

<!-- card
```console
$ pinyinjs convert 我要去北京。
Wǒ yào qù Běijīng.

$ pinyinjs explain 银行
银行  yínháng
  yín     locked
  háng    word    xíng +14.6  héng +16.6  hàng +17.6
```
-->
