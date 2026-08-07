# HTML output

`convertToHtml` returns the same conversion as `convert`, with one element per
syllable carrying its tone and, where the decoder was guessing, what it chose
over.

```ts
import { convertToHtml } from "@kensio/pinyinjs";

convertToHtml(dictionary, "行");
// <span class="py-syllable py-tone-2 py-uncertain" lang="zh-Latn-CN-pinyin"
//       data-alternatives="háng héng hàng">xíng</span>
```

That is the whole reason to use it rather than styling `convert`'s string: a
reader can be shown which syllables were settled and which were a guess, which
a flat string cannot express.

## What it emits

```ts
convertToHtml(dictionary, "银行");
// <span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">yín</span><span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">háng</span>
```

| Class                     | On                                         |
| ------------------------- | ------------------------------------------ |
| `py-syllable`             | every syllable element                     |
| `py-tone-1` … `py-tone-5` | the syllable's tone; 5 is the neutral tone |
| `py-uncertain`            | a syllable the decoder was guessing at     |

An uncertain syllable also carries `data-alternatives`, the readings it was
chosen over, space-separated and in the decoder's own order.

Text that was never Han is escaped and emitted as-is, not marked up:

```ts
convertToHtml(dictionary, "3D银行");
// <span class="py-syllable py-tone-1" lang="zh-Latn-CN-pinyin">sān</span> D <span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">yín</span><span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">háng</span>
```

Escaping is not optional and not configurable: anything from the input that is
not a syllable goes through HTML escaping on the way out.

## What language it says it is

Every syllable declares itself, because nothing about `yín` on its own says
what it is:

| Conversion        | `lang`              |
| ----------------- | ------------------- |
| `zh-CN` (default) | `zh-Latn-CN-pinyin` |
| `zh-TW`           | `zh-Latn-TW-pinyin` |

```ts
convertToHtml(dictionary, "垃圾", { locale: "zh-TW" });
// <span class="py-syllable py-tone-4" lang="zh-Latn-TW-pinyin">lè</span><span class="py-syllable py-tone-4" lang="zh-Latn-TW-pinyin">sè</span>
```

A screen reader consults `lang` before deciding how to pronounce what it has
found, and a browser consults it for hyphenation and font selection. Without
one, `xíng` inherits whatever the page around it claims to be, which is how
pinyin ends up read aloud as English. The tag is neither the `zh` of a Chinese
page nor the `en` of an English one: it is Mandarin in the Latin alphabet, and
`zh-Latn-…-pinyin` is what BCP 47 has for that. The subtags are all registered,
and the `pinyin` variant's own prefix in the IANA registry is `zh-Latn`.

The region follows the reading standard the conversion used, since that is the
distinction it makes — 垃圾 is `lājī` under `zh-CN` and `lèsè` under `zh-TW`.
Tone notation does not come into it: `hang2` is pinyin spelt with a tone
number, not a different romanisation, so it carries the same tag as `háng`.

Nothing is wrapped around the conversion, so the tag is repeated on every
syllable. To declare it once instead, turn it off and put the same tag on a
wrapper of your own, which everything inside inherits:

```ts
`<span lang="zh-Latn-CN-pinyin">${convertToHtml(dictionary, "银行", { lang: false })}</span>`;
```

## No styles are included

The package ships no CSS. The class names are the contract; what they look like
is yours:

```css
.py-tone-1 {
  color: #c1272d;
}
.py-tone-2 {
  color: #e08a1e;
}
.py-tone-3 {
  color: #2d8a4e;
}
.py-tone-4 {
  color: #2b5fa8;
}
.py-tone-5 {
  color: #777;
}

.py-uncertain {
  border-bottom: 1px dotted currentcolor;
}
```

A tooltip on the alternatives costs nothing extra, since they are already in
the attribute:

```css
.py-uncertain::after {
  content: " (" attr(data-alternatives) ")";
}
```

## Options

Takes every [conversion option](../options/), plus three of its own:

| Option          | Default | Does                                                      |
| --------------- | ------- | --------------------------------------------------------- |
| `toneClasses`   | `true`  | `false` leaves off `py-tone-*`                            |
| `markUncertain` | `true`  | `false` leaves off `py-uncertain` and `data-alternatives` |
| `lang`          | `true`  | `false` leaves off `lang`                                 |

```ts
convertToHtml(dictionary, "银行", { toneClasses: false });
// <span class="py-syllable" lang="zh-Latn-CN-pinyin">yín</span><span class="py-syllable" lang="zh-Latn-CN-pinyin">háng</span>

convertToHtml(dictionary, "行", { markUncertain: false });
// <span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">xíng</span>

convertToHtml(dictionary, "银行", { lang: false });
// <span class="py-syllable py-tone-2">yín</span><span class="py-syllable py-tone-2">háng</span>
```

With all three off you get one bare `py-syllable` element per syllable, which
is still worth having if all you want is to letter-space or hyphenate on
syllable boundaries.

Conversion options work as they do everywhere:

```ts
convertToHtml(dictionary, "银行", { notation: "numbers" });
```

## Rendering pieces you already have

`toHtml(pieces, options)` renders a `ConvertedPiece[]` you got from
`convertPieces`, so you can inspect or filter the conversion before it becomes
markup:

```ts
import { convertPieces, toHtml } from "@kensio/pinyinjs";

const pieces = convertPieces(dictionary, "长江大桥");
toHtml(pieces);
```

`convertToHtml(dictionary, text, options)` is exactly
`toHtml(convertPieces(dictionary, text, options), options)`, so use whichever
end you need. See [confidence](../confidence/) for what is on a piece.

## At the command line

```console
$ pinyinjs html 行
<span class="py-syllable py-tone-2 py-uncertain" lang="zh-Latn-CN-pinyin" data-alternatives="háng héng hàng">xíng</span>
```

`--no-tone-classes`, `--no-uncertain` and `--no-lang` are the three options
above.

<!-- card
```ts
convertToHtml(dictionary, "行");
// <span class="py-syllable py-tone-2 py-uncertain" lang="zh-Latn-CN-pinyin"
//       data-alternatives="háng héng hàng">xíng</span>
```
-->
