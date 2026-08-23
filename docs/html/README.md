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

That is the whole reason to use it. A reader can be shown which syllables were
settled and which were a guess, and a flat string has nowhere to put that.

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

Text that was never Han is escaped and emitted as it stood, with no markup
around it:

```ts
convertToHtml(dictionary, "3D银行");
// <span class="py-syllable py-tone-1" lang="zh-Latn-CN-pinyin">sān</span> D <span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">yín</span><span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">háng</span>
```

Escaping always happens and has no option to turn it off. Anything from the
input that failed to parse as a syllable goes through HTML escaping on the way
out.

## What language it says it is

Every syllable declares itself, because `yín` on its own could be almost any
language:

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
pinyin ends up read aloud as English. The tag says Mandarin in the Latin
alphabet. That is what `zh-Latn-…-pinyin` means in BCP 47, and it is why the
`zh` of a Chinese page and the `en` of an English one are both wrong. The
subtags are all registered, and the `pinyin` variant's own prefix in the IANA
registry is `zh-Latn`.

The region follows the reading standard the conversion used, since that is the
distinction it makes (垃圾 is `lājī` under `zh-CN` and `lèsè` under `zh-TW`).
Tone notation stays out of it. `hang2` is pinyin spelt with a tone number, still
the same romanisation, and it carries the same tag as `háng`.

The conversion emits no wrapper, and the tag is repeated on every syllable. To
declare it once instead, turn it off and put the same tag on a wrapper of your
own, which everything inside inherits:

```ts
`<span lang="zh-Latn-CN-pinyin">${convertToHtml(dictionary, "银行", { lang: false })}</span>`;
```

## No styles are included

The package ships no CSS. The class names are the contract, and what they look
like is yours:

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

A tooltip on the alternatives needs no extra work, since they are already in the
attribute:

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

With all three off you get one bare `py-syllable` element per syllable, still
worth having if all you want is to letter-space or hyphenate on syllable
boundaries.

Conversion options work as they do everywhere:

```ts
convertToHtml(dictionary, "银行", { notation: "numbers" });
```

## Rendering pieces you already have

`toHtml(pieces, options)` renders a `ConvertedPiece[]` you got from
`convertPieces`. Inspect or filter the conversion before it becomes markup:

```ts
import { convertPieces, toHtml } from "@kensio/pinyinjs";

const pieces = convertPieces(dictionary, "长江大桥");
toHtml(pieces);
```

`convertToHtml(dictionary, text, options)` is exactly
`toHtml(convertPieces(dictionary, text, options), options)`, so use whichever
end you need. See [confidence](../confidence/) for what is on a piece.

## Annotation: keeping the hanzi

Everything above writes the pinyin _instead of_ the hanzi. `convertToAnnotatedHtml`
writes both, with the reading above the characters:

```ts
import { convertToAnnotatedHtml } from "@kensio/pinyinjs";

convertToAnnotatedHtml(dictionary, "银行");
```

```html
<ruby lang="zh"
  >银<rp>(</rp
  ><rt
    ><span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">yín</span></rt
  ><rp>)</rp></ruby
>…
```

The element is `<ruby>`, which browsers lay out natively, with no script and no
measuring, and it reflows with the text. `<rp>` holds the parentheses a browser
without ruby support falls back to. The reading degrades to `银(yín)` instead of
vanishing.

Inside the `<rt>` is exactly what `toHtml` would have written, so tone classes,
`py-uncertain` and `data-alternatives` all work within an annotation.

### A base can span characters

This is the part that makes annotation harder than it looks, and the reason
`ConvertedPiece` carries a `source` at all. A syllable and a character line up
only in the ordinary case:

| Text     | Annotated as                          | Because                                                       |
| -------- | ------------------------------------- | ------------------------------------------------------------- |
| 银行     | 银 over `yín`, 行 over `háng`         | the ordinary case                                             |
| 玩儿     | 玩儿 over `wánr`                      | 儿化 folds two characters into one syllable                   |
| 95%      | 95% over `bǎifēnzhījiǔshíwǔ`          | a read number reverses, so no syllable is any one character's |
| 干干净净 | four bases, the hyphen in the reading | `gāngān-jìngjìng` is one word with a boundary inside it       |

Splitting per character regardless is what produces `玩` over `wán` and `儿`
over an empty reading. `source` names the characters a piece reads, or is
undefined where the piece reads on into the ones before it, and the renderer
groups on that.

### The base is what the author wrote

An annotation puts the source and the reading in two different places, so
anything belonging to only one of them has to go in the right one. Pinyin
orthography stops at the reading:

|                                 | In the hanzi                            | In the reading                       |
| ------------------------------- | --------------------------------------- | ------------------------------------ |
| the space between two words     | no — Chinese is not written with spaces | yes, as separate groups              |
| the hyphen of `gāngān-jìngjìng` | no — 干干净净 has no hyphen             | yes, beside the syllables it divides |
| 。 rewritten as a full stop     | no — the mark the author typed          | yes, as the conversion writes it     |

So `convertToAnnotatedHtml(dictionary, "银行。")` annotates 银 and 行 and then
writes 。, while `convertToHtml` on the same text writes a full stop. Both are
right about the text they are writing.

Measured over the committed dictionary, 5,283 of 723,147 keys have fewer
syllables than characters. 4,024 of them are 儿化, and the rest are words
written with punctuation, which never reaches the decoder because punctuation
ends a Han run.

### Styling it

Ruby needs no CSS to work, but the default `<rt>` is small:

```css
ruby rt {
  font-size: 0.5em;
  /* Some browsers need telling that the reading goes above. */
  ruby-position: over;
}
```

Tone colours go on the syllables inside the `<rt>`, exactly as elsewhere:

```css
ruby rt .py-tone-1 {
  color: #c1272d;
}
```

### Rendering annotated pieces

`toAnnotatedHtml(pieces, options)` is the piece-level entry point, and
`convertToAnnotatedHtml(dictionary, text, options)` is
`toAnnotatedHtml(convertPieces(dictionary, text, options), options)`.

## At the command line

```console
$ pinyinjs html 行
<span class="py-syllable py-tone-2 py-uncertain" lang="zh-Latn-CN-pinyin" data-alternatives="háng héng hàng">xíng</span>

$ pinyinjs annotate 银行
<ruby lang="zh">银<rp>(</rp><rt><span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">yín</span></rt><rp>)</rp></ruby>…
```

`--no-tone-classes`, `--no-uncertain` and `--no-lang` are the three options
above, and both commands take them.

<!-- card
```ts
convertToHtml(dictionary, "行");
// <span class="py-syllable py-tone-2 py-uncertain" lang="zh-Latn-CN-pinyin"
//       data-alternatives="háng héng hàng">xíng</span>
```
-->
