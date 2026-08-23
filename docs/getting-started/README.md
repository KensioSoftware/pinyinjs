# Getting started

Install the package, load a dictionary, convert some hanzi. This page goes from
an empty project to a working conversion in Node and in the browser, and points
at the guide for each thing it touches on the way.

## Install

```bash
pnpm add @kensio/pinyinjs
```

Node 22+, or any browser. The package is ESM only, and the core imports no Node
built-ins. The one Node-specific entry point is `@kensio/pinyinjs/node`, and the
browser path never reaches it.

It is a 4 MB download, because `data/` is 10 MB of compiled dictionaries and
they are the point of the whole thing. At runtime you load one tier of it (see
[tiers](#pick-a-tier) below).

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

Every option the library takes is a flag, and every command writes JSON with
`--json`. See [the command line](../cli/).

## Load a dictionary

Converting needs a dictionary. A dictionary is a fetchable file, so loading one
is asynchronous. Keeping it out of the module graph also keeps it out of your
bundle.

In Node, read it off disk:

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

Serve the artifacts uncompressed and let HTTP `Content-Encoding: br` do the
compressing. `DecompressionStream` has no brotli. The transfer encoding is the
only route to a brotli-compressed artifact in a browser.

Load the dictionary once and keep it. It is immutable, safe to share, and
decodes entries lazily. Building a second one repeats the work for no gain.

## Pick a tier

| Tier       | Entries | Download (brotli) | Contains               |
| ---------- | ------: | ----------------: | ---------------------- |
| `core`     |  16,970 |             70 KB | single characters only |
| `standard` |  66,970 |            377 KB | the most common words  |
| `full`     | 461,555 |          2,378 KB | every word             |

`full` is the default and is what you want on a server. The tiers are nested. A
page can load `standard`, start converting, and swap in `full` when it arrives.
More in [dictionaries](../dictionaries/).

## Convert something

```ts
convert(dictionary, "银行"); // "yínháng"
convert(dictionary, "行长"); // "hángzhǎng"
convert(dictionary, "我要去北京。"); // "Wǒ yào qù Běijīng."
convert(dictionary, "3D银行"); // "sān D yínháng", the digit is read, the letter is not
```

行 has two readings. `银行` is `yínháng` and `行长` is `hángzhǎng`, and only the
surrounding word says which. A lookup table has nowhere to put that. The
package decodes whole words. See [converting](../converting/).

Options are a third argument:

```ts
convert(dictionary, "银行", { notation: "numbers" }); // "yin2hang2"
convert(dictionary, "垃圾", { locale: "zh-TW" }); // "lèsè"
```

Every one of them is in [options](../options/).

## Where to go next

- [Converting](../converting/): hanzi in, pinyin out, and how the decoder decides
- [Orthography](../orthography/): why the spaces and capitals fall where they do
- [Confidence](../confidence/): which syllables it was unsure about
- [HTML output](../html/): marked-up output for a web page
- [Syllables](../syllables/): pinyin without any hanzi at all

<!-- card
```ts
const dictionary = await loadDictionary(source, "full");

convert(dictionary, "银行"); // "yínháng"
convert(dictionary, "行长"); // "hángzhǎng"
convert(dictionary, "垃圾"); // "lājī"
```
-->
