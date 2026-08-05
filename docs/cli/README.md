# The command line

Installing the package installs a `pinyinjs` command. It is the quickest way to
try any of the library, and with `--json` it is a usable tool in its own right.

```console
$ pinyinjs convert 我要去北京。
Wǒ yào qù Běijīng.
```

## Commands

| Command    | Does                                                |
| ---------- | --------------------------------------------------- |
| `convert`  | hanzi to pinyin                                     |
| `html`     | the same, as HTML                                   |
| `explain`  | each syllable, how settled it was, and what it beat |
| `lookup`   | what the dictionary holds for a word                |
| `syllable` | take written pinyin apart                           |
| `sandhi`   | apply tone sandhi to written pinyin                 |
| `number`   | read a number as Chinese numerals                   |
| `romanize` | pinyin to bopomofo, Wade-Giles, Yale, GR and IPA    |
| `info`     | which dictionary is loaded, and how big it is       |

Run `pinyinjs <command> --help` for what a command takes.

### convert

```console
$ pinyinjs convert 银行
yínháng

$ pinyinjs convert --notation numbers 银行
yin2hang2

$ pinyinjs convert --locale zh-TW 垃圾
lèsè
```

Writes the pinyin and nothing else, so it drops straight into a pipeline.

### explain

```console
$ pinyinjs explain 银行
银行  yínháng
  yín     locked
  háng    word    xíng +24.6  héng +26.6  hàng +27.6

$ pinyinjs explain 长江大桥
长江大桥  Cháng Jiāng Dàqiáo
  Cháng   word    zhǎng +24.6
  Jiāng   locked
  Dà      word    dài +22.6
  qiáo    locked
```

One line per syllable: the syllable, how settled it was (`locked`, `word` or
`uncertain`), and the readings it was chosen over with what taking each would
have cost. [Confidence](../confidence/) explains what the states and the
numbers mean.

### lookup

```console
$ pinyinjs lookup 头发
头发  tóu fa  n

$ pinyinjs lookup 垃圾
垃圾  lā jī  n
  zh-TW  lè sè
```

The word, its 普通话 reading, and jieba's part-of-speech tag. A 國語 reading
appears on its own line only where it differs. Both scripts are keys, so
`pinyinjs lookup 頭髮` finds the same entry.

### syllable

```console
$ pinyinjs syllable nǐhǎo
nǐhǎo  nǐ hǎo
  nǐ        n + i, tone 3         nǐ  ni3  ni³
  hǎo       h + ao, tone 3        hǎo  hao3  hao³
```

Splits written pinyin, then takes each syllable apart into its initial, final
and tone, and writes it back in all three notations. Needs no dictionary.

### sandhi

```console
$ pinyinjs sandhi bùshì
bùshì  bú shì

$ pinyinjs sandhi --third-tone nǐhǎo
nǐhǎo  ní hǎo
```

Also needs no dictionary. See [sandhi](../sandhi/).

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

`--digits` spells the number out instead of counting it, which is the
difference between 2026年 and 2026个; `--yao` reads 一 as `yāo`, as a phone
number does; `--no-liang` writes 二千 rather than 两千. Needs no dictionary
either. See [numbers](../numerals/).

### romanize

```console
$ pinyinjs romanize běijīng
běijīng     běijīng   ㄅㄟˇ ㄐㄧㄥ     pei³-ching¹ běijīng   beeijing  pei˨˩˦tɕiŋ˥

$ pinyinjs romanize --from wade-giles chu¹
chu¹        zhū       ㄓㄨ          chu¹        jū        ju        ʈʂu˥
            chū       ㄔㄨ          ch'u¹       chū       chu       ʈʂʰu˥       marks restored
            jū        ㄐㄩ          chü¹        jyū       jiu       tɕy˥        marks restored
            qū        ㄑㄩ          ch'ü¹       chyū      chiu      tɕʰy˥       marks restored
```

The columns are pinyin, bopomofo, Wade-Giles, Yale, Gwoyeu Romatzyh and IPA.
Four rows because Wade-Giles `chu` with its marks dropped is four different
syllables. `--from` takes `pinyin`, `wade-giles`, `bopomofo`, `yale`, `gwoyeu`
or `ipa`, and defaults to working it out: bopomofo has a script of its own, and
everything else is read as pinyin. Needs no dictionary. See
[romanisation](../romanization/).

### html

```console
$ pinyinjs html 行
<span class="py-syllable py-tone-2 py-uncertain" data-alternatives="háng héng hàng">xíng</span>
```

See [HTML output](../html/).

### info

```console
$ pinyinjs info
tier       full
data       the artifacts that shipped
keys       723,139
syllables  415 attested, 424 spellings in the inventory
```

Which dictionary got loaded, from where, and how big it is. Useful when
`--data` or `--tier` is not doing what you expected.

## Options

Every conversion option the library takes is a flag on `convert`, `html` and
`explain`:

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

`convert` also takes `--greedy`, which decodes with the old longest-match
baseline instead of the lattice — see [converting](../converting/#the-greedy-baseline).
`html` also takes `--no-tone-classes` and `--no-uncertain`. `sandhi` takes
`--third-tone` and `--no-sandhi`. `number` takes `--digits`, `--yao`,
`--no-liang` and `--percent`, plus `--notation` and the sandhi flags.
`romanize` takes `--from` and `--notation`.

[Options](../options/) documents what each value does.

These work on every command:

| Flag              | Does                                    |
| ----------------- | --------------------------------------- |
| `--data <dir>`    | read the dictionary from this directory |
| `--tier <tier>`   | `core`, `standard` or `full` (default)  |
| `--json`          | write one JSON document per answer      |
| `-h`, `--help`    | show help                               |
| `-v`, `--version` | show the version                        |

`syllable`, `sandhi`, `number` and `romanize` need no dictionary at all and
start without loading one, so `--data` and `--tier` do nothing on them.

## Standard input

A command given no arguments reads standard input, one text per line:

```console
$ cat article.txt | pinyinjs convert
```

That is one answer per line in, one line out, so it stays usable on a file of
any size.

## JSON output

`convert` writes bare pinyin, which is what a pipeline wants. Everything else
lays its answer out in columns for a person to read. Add `--json` — to any
command — and it writes one JSON document per answer instead:

```console
$ pinyinjs explain 长江大桥 --json | jq -c '.syllables[] | select(.state != "locked")'
{"text":"Cháng","state":"word","tone":2,"alternatives":[{"reading":"zhǎng","cost":24.62}]}
{"text":"Dà","state":"word","tone":4,"alternatives":[{"reading":"dài","cost":22.62}]}

$ pinyinjs lookup 垃圾 --json | jq -r .taiwanReading
lè sè

$ cat article.txt | pinyinjs convert --json | jq -r .pinyin
```

One document per answer rather than one array for the whole run, so the shape
is the same whether you convert one word or pipe a file through, and a reader
can process it a line at a time.

## Running it from a checkout

The repository has a `./pinyinjs` script that runs the CLI straight from the
TypeScript sources, so there is nothing to build first:

```bash
./pinyinjs convert 你好
```
