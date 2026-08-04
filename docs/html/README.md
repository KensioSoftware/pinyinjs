# HTML output

`convertToHtml` returns the same conversion as `convert`, with one element per
syllable carrying its tone and, where the decoder was guessing, what it chose
over.

```ts
import { convertToHtml } from "@kensio/pinyinjs";

convertToHtml(dictionary, "行");
// <span class="py-syllable py-tone-2 py-uncertain"
//       data-alternatives="háng héng hàng">xíng</span>
```

That is the whole reason to use it rather than styling `convert`'s string: a
reader can be shown which syllables were settled and which were a guess, which
a flat string cannot express.

## What it emits

```ts
convertToHtml(dictionary, "银行");
// <span class="py-syllable py-tone-2">yín</span><span class="py-syllable py-tone-2">háng</span>
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
// <span class="py-syllable py-tone-1">sān</span> D <span class="py-syllable py-tone-2">yín</span><span class="py-syllable py-tone-2">háng</span>
```

Escaping is not optional and not configurable — anything from the input that is
not a syllable goes through HTML escaping on the way out.

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

Takes every [conversion option](../options/), plus two of its own:

| Option          | Default | Does                                                      |
| --------------- | ------- | --------------------------------------------------------- |
| `toneClasses`   | `true`  | `false` leaves off `py-tone-*`                            |
| `markUncertain` | `true`  | `false` leaves off `py-uncertain` and `data-alternatives` |

```ts
convertToHtml(dictionary, "银行", { toneClasses: false });
// <span class="py-syllable">yín</span><span class="py-syllable">háng</span>

convertToHtml(dictionary, "行", { markUncertain: false });
// <span class="py-syllable py-tone-2">xíng</span>
```

With both off you get one bare `py-syllable` element per syllable, which is
still worth having if all you want is to letter-space or hyphenate on syllable
boundaries.

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
<span class="py-syllable py-tone-2 py-uncertain" data-alternatives="háng héng hàng">xíng</span>
```

`--no-tone-classes` and `--no-uncertain` are the two options above.
