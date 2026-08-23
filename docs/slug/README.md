# Slugs

`slug` turns hanzi into a string you can put in a URL.

```ts
import { slug } from "@kensio/pinyinjs";

slug(dictionary, "我想学中文。"); // "wo3-xiang3-xue2-zhong1wen2"
```

A general slugifier run over `convert`'s output loses things a dictionary can
keep.

| Text | This         | A slugifier over the characters |
| ---- | ------------ | ------------------------------- |
| 银行 | `yin2hang2`  | `yin2xing2` — wrong reading     |
| 西安 | `xi1an1`     | `xian` — a different word       |
| 中文 | `zhong1wen2` | `zhong1-wen2` — not one word    |

Three separate things are going on there, and each of them needs the decode:

- **The word is read as a word.** 行 alone is `xíng`, and only 银行 around it
  makes it `háng`. See [converting](../converting/).
- **The word boundaries are the decoder's.** The hyphens fall between words
  because GB/T 16159 grouping put them there, so 中文 stays one word and
  北京市银行 becomes `bei3jing1-shi4-yin2hang2`. See
  [orthography](../orthography/).
- **The syllable boundaries survive.** 西安 is `xī'ān`, and the 隔音符号 is the
  only thing keeping it from reading as 先 `xiān`. A toneless slug turns it into
  a separator, and 西安交通大学 comes out `xi-an-jiaotong-daxue` and not
  `xianjiaotongdaxue`.

## Tones, and why they are on

```ts
slug(dictionary, "重庆火锅"); // "chong2qing4-huo3guo1"
slug(dictionary, "重庆火锅", { tones: "none" }); // "chongqing-huoguo"
```

Tones are written by default because dropping them collides. There are roughly
400 toneless syllables against 1300 toned ones. A toneless slug runs 树, 书 and
输 together as `shu`.

They narrow the collisions without closing them. True homophones survive:

```ts
slug(dictionary, "权利"); // "quan2li4"
slug(dictionary, "权力"); // "quan2li4"
```

That is what the hash is for.

## The hash

`hash` puts a short hash of the text on the end.

```ts
slug(dictionary, "权利", { hash: true }); // "quan2li4-1lpt"
slug(dictionary, "权力", { hash: true }); // "quan2li4-uta0"
```

**The hanzi are hashed, not the pinyin.** Two texts needing a hash to tell them
apart are, by definition, ones the pinyin already ran together. Hashing
`quan2li4` would give both the same suffix. It also holds the suffix still when
a later release reads a word differently, and the tail of a slug is the stable
half of it.

Four base-36 characters is the default, 1.7 million values and far more than it
looks. Two texts only collide when their slug _and_ their hash match, and the
suffix is only ever telling apart the handful of texts that share one slug.
`hash: 6` asks for more, up to seven (the hash is 32 bits wide, and an eighth
character would add a place no value can reach).

It is written every time, collision or not, because a function that cannot see
the rest of your corpus cannot know when two slugs met.

## Uniqueness is yours to enforce

Tones narrow the collisions and the hash narrows them much further, and both
leave a residue. A slug that has to be unique still has to be checked against
the ones you have already stored.

Slugs also move between releases. The dictionary and the reading rules improve,
and when they do a slug changes with them (a word that segmented as two words
last release may segment as one in the next). **Store the slug you generated**,
exactly as you would with any other permalink.

## Latin, digits and punctuation

Latin passes through, folded to the letters a URL carries without escaping.
Digits are kept as digits, because that is how anyone looks the text up.
Punctuation of either script becomes a boundary between words, and so do emoji
and marks of any script.

```ts
slug(dictionary, "iPhone 15 发布"); // "iphone-15-fa1bu4"
slug(dictionary, "《中文》：真好！"); // "zhong1wen2-zhen1-hao3"
slug(dictionary, "2024年报告"); // "2024-nian2-bao4gao4"
```

`numbers: "read"` says the digits instead, as [converting](../converting/)
does by default:

```ts
slug(dictionary, "2024年报告", { numbers: "read" });
// "er4-ling2-er4-si4-nian2-bao4gao4"
```

Where a text has nothing in it to slug (an empty string, or 《》！) the result
is the empty string, or `fallback` if you gave one.

```ts
slug(dictionary, "！？。", { fallback: "untitled" }); // "untitled"
```

## Options

| Option      | Default      | Does                                        |
| ----------- | ------------ | ------------------------------------------- |
| `tones`     | `"numbers"`  | `"none"` leaves the tones off               |
| `separator` | `"-"`        | what goes between words                     |
| `syllables` | `"join"`     | `"separate"` cuts every syllable apart      |
| `umlaut`    | `"v"`        | how ü is written; `"u"` merges 绿 into 路   |
| `numbers`   | `"keep"`     | `"read"` says the digits out                |
| `hash`      | none         | `true` for four characters, or a length     |
| `maxLength` | none         | the longest it may be, cut at a word        |
| `fallback`  | `""`         | what to write where a text slugs to nothing |
| `locale`    | `"zh-CN"`    | `"zh-TW"` for 國語 readings                 |
| `sandhi`    | as `convert` | 一, 不 and optional third-tone sandhi       |

The writing options a conversion takes (`notation`, `capitals`, `apostrophe`,
`punctuation` and `grouping`) are absent here. A slug settles all of those
itself.

`maxLength` cuts at a word boundary, so a limit lands between words and never
through the middle of one, and the hash is never what gets dropped:

```ts
slug(dictionary, "北京市银行", { maxLength: 20 }); // "bei3jing1-shi4"
```

## Beyond URLs

The options generalise past URLs, and that is most of why they are there. Each
of these is the same function with a different separator:

| Want           | Options                            | 中文         |
| -------------- | ---------------------------------- | ------------ |
| A URL slug     | none                               | `zhong1wen2` |
| A search key   | `{ tones: "none", separator: "" }` | `zhongwen`   |
| A name in code | `{ separator: "_" }`               | `zhong1wen2` |
| An anchor id   | `{ tones: "none", hash: 4 }`       | `zhongwen-…` |

A search key is the one worth spelling out. With no separator and no tones,
someone typing `zhongwen` into a search box matches 中文, and someone typing
`xian` matches 西安. That is the right answer for a search box, and the wrong
one for a URL.

```ts
slug(dictionary, "中文", { tones: "none", separator: "" }); // "zhongwen"
```

## At the command line

```console
$ pinyinjs slug 我想学中文。
wo3-xiang3-xue2-zhong1wen2

$ pinyinjs slug --tones none 西安交通大学
xi-an-jiaotong-daxue

$ pinyinjs slug --hash 权利 权力
quan2li4-1lpt
quan2li4-uta0
```

Every option above is a flag: `--tones`, `--separator`, `--syllables`,
`--umlaut`, `--hash`, `--hash-length`, `--max-length`, `--fallback`,
`--read-numbers`, `--locale`, `--third-tone` and `--no-sandhi`. `--hash-length`
implies `--hash`. As with every command, no arguments reads standard input a
line at a time. A file of titles slugs in one go:

```console
$ cat titles.txt | pinyinjs slug --hash
```

<!-- card
```ts
slug(dictionary, "我想学中文。");
// "wo3-xiang3-xue2-zhong1wen2"

slug(dictionary, "西安", { tones: "none" });
// "xi-an", not 先
```
-->
