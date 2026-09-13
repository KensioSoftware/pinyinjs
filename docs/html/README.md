# HTML output

`convertToHtml` converts Chinese text to pinyin with one HTML element per
syllable. Each element can carry a tone class and uncertainty information.

```ts
import { convertToHtml } from "@kensio/pinyinjs";

convertToHtml(dictionary, "行");
// <span class="py-syllable py-tone-2 py-uncertain" lang="zh-Latn-CN-pinyin"
//       data-alternatives="háng héng hàng">xíng</span>
```

Use the classes to colour tones or show readers where a pronunciation is
uncertain.

<a id="what-it-emits"></a>

## Generated markup

```ts
convertToHtml(dictionary, "银行");
// <span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">yín</span><span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">háng</span>
```

| Class                     | On                                         |
| ------------------------- | ------------------------------------------ |
| `py-syllable`             | every syllable element                     |
| `py-tone-1` … `py-tone-5` | the syllable's tone; 5 is the neutral tone |
| `py-uncertain`            | a syllable the decoder was guessing at     |

An uncertain syllable has a `data-alternatives` attribute containing the other
readings, separated by spaces and ordered by the decoder.

Non-Han text is escaped and emitted without a wrapper:

```ts
convertToHtml(dictionary, "3D银行");
// <span class="py-syllable py-tone-1" lang="zh-Latn-CN-pinyin">sān</span> D <span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">yín</span><span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">háng</span>
```

HTML escaping is always enabled, including for input that cannot be parsed as
a syllable.

<a id="what-language-it-says-it-is"></a>

## Language tags

Each syllable has a `lang` attribute:

| Conversion        | `lang`              |
| ----------------- | ------------------- |
| `zh-CN` (default) | `zh-Latn-CN-pinyin` |
| `zh-TW`           | `zh-Latn-TW-pinyin` |

```ts
convertToHtml(dictionary, "垃圾", { locale: "zh-TW" });
// <span class="py-syllable py-tone-4" lang="zh-Latn-TW-pinyin">lè</span><span class="py-syllable py-tone-4" lang="zh-Latn-TW-pinyin">sè</span>
```

The tag identifies Mandarin written in pinyin. Screen readers and browsers can
use it for pronunciation, hyphenation and font selection. `zh-Latn-CN-pinyin`
uses registered BCP 47 subtags. Without an explicit tag, pinyin would inherit
the surrounding page’s language.

The region follows the conversion locale. Tone notation leaves the tag
unchanged, so `hang2` and `háng` have the same language tag.

To set the language once on a wrapper, disable per-syllable language tags:

```ts
`<span lang="zh-Latn-CN-pinyin">${convertToHtml(dictionary, "银行", { lang: false })}</span>`;
```

<a id="no-styles-are-included"></a>

## Styling

The package includes no CSS. Add styles for the generated classes:

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

The alternatives are available to CSS through their attribute:

```css
.py-uncertain::after {
  content: " (" attr(data-alternatives) ")";
}
```

## Options

HTML conversion accepts every [conversion option](../options/), plus these
four options:

| Option          | Default  | Does                                                      |
| --------------- | -------- | --------------------------------------------------------- |
| `toneClasses`   | `true`   | `false` leaves off `py-tone-*`                            |
| `markUncertain` | `true`   | `false` leaves off `py-uncertain` and `data-alternatives` |
| `lang`          | `true`   | `false` leaves off `lang`                                 |
| `transcription` | (pinyin) | writes the reading in another system                      |

```ts
convertToHtml(dictionary, "银行", { toneClasses: false });
// <span class="py-syllable" lang="zh-Latn-CN-pinyin">yín</span><span class="py-syllable" lang="zh-Latn-CN-pinyin">háng</span>

convertToHtml(dictionary, "行", { markUncertain: false });
// <span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">xíng</span>

convertToHtml(dictionary, "银行", { lang: false });
// <span class="py-syllable py-tone-2">yín</span><span class="py-syllable py-tone-2">háng</span>
```

Turning off the three boolean options leaves a bare `py-syllable` element for
each syllable. You can still style syllable boundaries.

For example, conversion options can change the tone notation:

```ts
convertToHtml(dictionary, "银行", { notation: "numbers" });
```

<a id="another-system-in-place-of-the-pinyin"></a>

## Other transcription systems

Set `transcription` to write bopomofo, Wade-Giles, Yale, Gwoyeu Romatzyh or IPA.
The option also works with annotated HTML:

```ts
import { convertToAnnotatedHtml, BOPOMOFO } from "@kensio/pinyinjs";

convertToAnnotatedHtml(dictionary, "银行", { transcription: BOPOMOFO });
```

```html
<ruby lang="zh"
  >银<rp>(</rp
  ><rt><span class="py-syllable py-tone-2" lang="zh-Bopo-CN">ㄧㄣˊ</span></rt
  ><rp>)</rp></ruby
>…
```

Tone and uncertainty classes remain the same across systems. `data-alternatives`
contains the alternatives in the selected system.

<a id="the-word-grouping-is-shared-and-only-the-join-changes"></a>

### Word grouping and syllable separators

All systems use the same [word grouping](../romanization/#the-word-segmentation-is-shared-and-only-the-join-changes).
Each system supplies its own separator between syllable elements:

```ts
convertToHtml(dictionary, "北京", { transcription: WADE_GILES });
// <span …>Pei³</span>-<span …>ching¹</span>
```

A source span can contain several syllables. For example, 95% has six bopomofo
syllables inside one `<rt>`, with a space between each pair.

Separators follow the selected system. 干干净净 is `gāngān-jìngjìng` in pinyin,
`kan¹-kan¹-ching⁴-ching⁴` in Wade-Giles and `ㄍㄢ ㄍㄢ ㄐㄧㄥˋ ㄐㄧㄥˋ` in bopomofo.

<a id="what-the-reading-says-it-is"></a>

### Language tags by system

The reading’s `lang` attribute follows the selected system:

| System          | `zh-CN`               | `zh-TW`               |
| --------------- | --------------------- | --------------------- |
| pinyin          | `zh-Latn-CN-pinyin`   | `zh-Latn-TW-pinyin`   |
| bopomofo        | `zh-Bopo-CN`          | `zh-Bopo-TW`          |
| Wade-Giles      | `zh-Latn-CN-wadegile` | `zh-Latn-TW-wadegile` |
| Yale            | `zh-Latn-CN`          | `zh-Latn-TW`          |
| Gwoyeu Romatzyh | `zh-Latn-CN`          | `zh-Latn-TW`          |
| IPA             | `zh-Latn-CN-fonipa`   | `zh-Latn-TW-fonipa`   |

Every tag includes the conversion region. This records which reading standard
was used, including differences such as 垃圾 under `zh-CN` and `zh-TW`.

Yale and Gwoyeu Romatzyh have no registered IANA variant subtag. Their tags
identify Mandarin in the Latin alphabet and the region.

`BOPOMOFO`, `WADE_GILES`, `YALE`, `GWOYEU` and `IPA` are exported, along with
`TRANSCRIPTION_SYSTEMS` and `transcriptionSystemNamed`. A caller with a system
of its own can pass any `TranscriptionSystem`.

## Rendering pieces you already have

Use `toHtml(pieces, options)` to render a `ConvertedPiece[]` after inspecting or
filtering it:

```ts
import { convertPieces, toHtml } from "@kensio/pinyinjs";

const pieces = convertPieces(dictionary, "长江大桥");
toHtml(pieces);
```

`convertToHtml(dictionary, text, options)` composes `convertPieces` and
`toHtml`. See [confidence](../confidence/) for the fields on each piece.

<a id="annotation-keeping-the-hanzi"></a>

## Annotating hanzi

`convertToAnnotatedHtml` keeps the hanzi and places the reading above them:

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

Browsers lay out `<ruby>` annotations without JavaScript. `<rp>` supplies
fallback parentheses for browsers without ruby support, producing `银(yín)`.

The `<rt>` contains the same syllable markup as `toHtml`, including tone
classes, `py-uncertain` and `data-alternatives`.

<a id="a-base-can-span-characters"></a>

### Aligning characters and syllables

A character and a syllable do not always correspond one to one:

| Text     | Annotated as                          | Because                                                       |
| -------- | ------------------------------------- | ------------------------------------------------------------- |
| 银行     | 银 over `yín`, 行 over `háng`         | the ordinary case                                             |
| 玩儿     | 玩儿 over `wánr`                      | 儿化 folds two characters into one syllable                   |
| 95%      | 95% over `bǎifēnzhījiǔshíwǔ`          | a read number reverses, so no syllable is any one character's |
| 干干净净 | four bases, the hyphen in the reading | `gāngān-jìngjìng` is one word with a boundary inside it       |

The renderer groups pieces by `source`. A piece with an undefined `source`
continues the preceding source span. For example, 玩儿 gets one annotation
over both characters.

<a id="the-base-is-what-the-author-wrote"></a>

### Preserving the source text

An annotation preserves the original text in its base. Pinyin formatting applies
only to the reading:

|                                 | In the hanzi                            | In the reading                       |
| ------------------------------- | --------------------------------------- | ------------------------------------ |
| the space between two words     | no — Chinese is not written with spaces | yes, as separate groups              |
| the hyphen of `gāngān-jìngjìng` | no — 干干净净 has no hyphen             | yes, beside the syllables it divides |
| 。 rewritten as a full stop     | no — the mark the author typed          | yes, as the conversion writes it     |

For example, `convertToAnnotatedHtml(dictionary, "银行。")` preserves 。 after
the annotated characters. `convertToHtml` writes a Latin full stop.

The dictionary contains entries with fewer syllables than characters, mostly
erhua words. Source spans preserve their alignment.

<a id="styling-it"></a>

### Styling annotations

Ruby works without CSS. To enlarge the default reading:

```css
ruby rt {
  font-size: 0.5em;
  /* Some browsers need telling that the reading goes above. */
  ruby-position: over;
}
```

Apply tone colours to the syllables inside `<rt>`:

```css
ruby rt .py-tone-1 {
  color: #c1272d;
}
```

### Rendering annotated pieces

Use `toAnnotatedHtml(pieces, options)` to render existing pieces.
`convertToAnnotatedHtml(dictionary, text, options)` composes `convertPieces`
and `toAnnotatedHtml`.

## At the command line

```console
$ pinyinjs html 行
<span class="py-syllable py-tone-2 py-uncertain" lang="zh-Latn-CN-pinyin" data-alternatives="háng héng hàng">xíng</span>

$ pinyinjs annotate 银行
<ruby lang="zh">银<rp>(</rp><rt><span class="py-syllable py-tone-2" lang="zh-Latn-CN-pinyin">yín</span></rt><rp>)</rp></ruby>…
```

```console
$ pinyinjs annotate --system bopomofo 银
<ruby lang="zh">银<rp>(</rp><rt><span class="py-syllable py-tone-2" lang="zh-Bopo-CN">ㄧㄣˊ</span></rt><rp>)</rp></ruby>
```

Both commands accept `--no-tone-classes`, `--no-uncertain`, `--no-lang` and
`--system`.

<!-- card
```ts
convertToHtml(dictionary, "行");
// <span class="py-syllable py-tone-2 py-uncertain" lang="zh-Latn-CN-pinyin"
//       data-alternatives="háng héng hàng">xíng</span>
```
-->
