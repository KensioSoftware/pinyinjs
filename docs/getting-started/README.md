# Getting started

Set up PinyinJS to convert Chinese characters (hanzi) to pinyin in Node.js or a browser.

## Install

```bash
pnpm add @kensio/pinyinjs
```

PinyinJS requires Node.js 22 or later, or a browser with ES modules. The package is ESM only. Import browser-compatible functions from `@kensio/pinyinjs` and Node.js file access from `@kensio/pinyinjs/node`.

The package includes compiled dictionaries in `data/`. At runtime, load the [tier](#pick-a-tier) your application needs.

## Try it without writing any code

Installing the package installs a `pinyinjs` command:

```console
$ pinyinjs convert 我要去北京。
Wǒ yào qù Běijīng.

$ pinyinjs explain 银行
银行  yínháng
  yín     locked
  háng    word    xíng +14.6  héng +16.6  hàng +17.6
```

The CLI exposes library options as flags and supports JSON output with `--json`. See [the command line](../cli/) for the commands and their options.

## Load a dictionary

Chinese-to-pinyin conversion requires a dictionary. Dictionary data is stored separately from the JavaScript bundle and loaded asynchronously.

In Node.js, load the data from disk:

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

Serve the dictionary files over HTTP. Your server can compress responses with Brotli and set `Content-Encoding: br`. The browser then decompresses them before PinyinJS reads them.

Load a dictionary once and reuse it. Dictionaries are immutable and safe to share across requests. Entries are decoded when first accessed.

## Pick a tier

| Tier       | Entries | Download (brotli) | Contains               |
| ---------- | ------: | ----------------: | ---------------------- |
| `core`     |  16,970 |             70 KB | single characters only |
| `standard` |  66,970 |            377 KB | the most common words  |
| `full`     | 461,555 |          2,378 KB | every word             |

`full` is the default tier and provides the most complete word coverage. In a browser, you can start with `standard` and replace it with `full` after the larger tier loads. Each tier includes the entries in the smaller tiers. See [dictionaries](../dictionaries/) for loading and memory usage.

## Convert something

```ts
convert(dictionary, "银行"); // "yínháng"
convert(dictionary, "行长"); // "hángzhǎng"
convert(dictionary, "我要去北京。"); // "Wǒ yào qù Běijīng."
convert(dictionary, "3D银行"); // "sān D yínháng", the digit is read, the letter is not
```

A Chinese character can have several readings. PinyinJS uses the surrounding word to choose one. For example, 行 is `háng` in both `银行` (`yínháng`) and `行长` (`hángzhǎng`). See [converting](../converting/) for how readings are selected.

Pass conversion options as the third argument:

```ts
convert(dictionary, "银行", { notation: "numbers" }); // "yin2hang2"
convert(dictionary, "垃圾", { locale: "zh-TW" }); // "lèsè"
```

See [options](../options/) for all settings and their defaults.

## Where to go next

- [Converting](../converting/) explains how Chinese text is converted to pinyin.
- [Orthography](../orthography/) covers word spacing and spelling rules.
- [Confidence](../confidence/) explains how to identify uncertain readings.
- [HTML output](../html/) covers pinyin markup for web pages.
- [Syllables](../syllables/) covers parsing and formatting written pinyin.

<!-- card
```ts
const dictionary = await loadDictionary(source, "full");

convert(dictionary, "银行"); // "yínháng"
convert(dictionary, "行长"); // "hángzhǎng"
convert(dictionary, "垃圾"); // "lājī"
```
-->
