# Slugs

`slug` converts Chinese text to a URL-safe string.

```ts
import { slug } from "@kensio/pinyinjs";

slug(dictionary, "我想学中文。"); // "wo3-xiang3-xue2-zhong1wen2"
```

Slugs use dictionary readings and word boundaries:

| Text | This         | A slugifier over the characters |
| ---- | ------------ | ------------------------------- |
| 银行 | `yin2hang2`  | `yin2xing2` — wrong reading     |
| 西安 | `xi1an1`     | `xian` — a different word       |
| 中文 | `zhong1wen2` | `zhong1-wen2` — not one word    |

The conversion preserves these distinctions:

- Context selects the reading. 行 is `háng` in 银行. See
  [converting](../converting/).
- Separators follow word boundaries. 北京市银行 becomes
  `bei3jing1-shi4-yin2hang2`. See [orthography](../orthography/).
- Syllable boundaries remain distinct. A toneless slug replaces the apostrophe
  in `xī'ān` with a separator, producing `xi-an`.

<a id="tones-and-why-they-are-on"></a>

## Tones

```ts
slug(dictionary, "重庆火锅"); // "chong2qing4-huo3guo1"
slug(dictionary, "重庆火锅", { tones: "none" }); // "chongqing-huoguo"
```

Tone numbers are included by default to distinguish readings. Without tones,
树, 书 and 输 all become `shu`.

Different words with the same pronunciation still produce the same slug:

```ts
slug(dictionary, "权利"); // "quan2li4"
slug(dictionary, "权力"); // "quan2li4"
```

Use a hash suffix to reduce these collisions.

<a id="the-hash"></a>

## Hash suffixes

`hash` appends a short hash of the original text.

```ts
slug(dictionary, "权利", { hash: true }); // "quan2li4-1lpt"
slug(dictionary, "权力", { hash: true }); // "quan2li4-uta0"
```

The suffix is calculated from the source text. Homophones can therefore get
different suffixes, and a reading change in a later release leaves the suffix
unchanged.

The default suffix has four base-36 characters (about 1.7 million values).
Use `hash: 6` for six characters. The maximum is seven because the hash is
32 bits.

When enabled, the hash is appended to every slug.

<a id="uniqueness-is-yours-to-enforce"></a>

## Uniqueness and stable URLs

Tones and hashes reduce collisions but cannot guarantee uniqueness. Check a new
slug against the slugs already stored by your application.

Store generated slugs as permanent values. Dictionary and reading-rule updates
can change pronunciations or word boundaries in later releases.

## Latin, digits and punctuation

Latin text is folded to ASCII letters, and digits stay as digits. Punctuation,
emoji and other marks become word boundaries.

```ts
slug(dictionary, "iPhone 15 发布"); // "iphone-15-fa1bu4"
slug(dictionary, "《中文》：真好！"); // "zhong1wen2-zhen1-hao3"
slug(dictionary, "2024年报告"); // "2024-nian2-bao4gao4"
```

Set `numbers: "read"` to convert digits to their spoken reading:

```ts
slug(dictionary, "2024年报告", { numbers: "read" });
// "er4-ling2-er4-si4-nian2-bao4gao4"
```

Input with no usable content, such as an empty string or 《》！, returns an
empty string. Set `fallback` to use another value.

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

Slugs control their own formatting. The conversion options `notation`,
`capitals`, `apostrophe`, `punctuation` and `grouping` are unavailable.

`maxLength` truncates at a word boundary and preserves the hash suffix:

```ts
slug(dictionary, "北京市银行", { maxLength: 20 }); // "bei3jing1-shi4"
```

<a id="beyond-urls"></a>

## Search keys and identifiers

Choose a different separator to make identifiers or search keys:

| Want           | Options                            | 中文         |
| -------------- | ---------------------------------- | ------------ |
| A URL slug     | none                               | `zhong1wen2` |
| A search key   | `{ tones: "none", separator: "" }` | `zhongwen`   |
| A name in code | `{ separator: "_" }`               | `zhong1wen2` |
| An anchor id   | `{ tones: "none", hash: 4 }`       | `zhongwen-…` |

A search key with no tones or separators lets `zhongwen` match 中文 and `xian`
match 西安. This intentionally combines readings that URL slugs distinguish.

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

The CLI accepts `--tones`, `--separator`, `--syllables`, `--umlaut`, `--hash`,
`--hash-length`, `--max-length`, `--fallback`, `--read-numbers`, `--locale`,
`--third-tone` and `--no-sandhi`. `--hash-length` enables hashing. With no
arguments, the command reads one title per line from standard input:

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
