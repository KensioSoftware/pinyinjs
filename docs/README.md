# pinyinjs documentation

The long form of the [README](../README.md). The README is the tour; these pages
are the same material with room to explain itself, one topic at a time.

They are also the source for [pinyinjs.dev](https://pinyinjs.dev), which copies
each `docs/<path>/README.md` here to a page there. Edit them here.

Every page ends with a `<!-- card -->` comment holding the snippet its share
image shows on that site. It renders nowhere, here or there, and the site's
scaffold fails on a page without one. Six lines of sixty characters is what an
image holds, and hanzi are drawn wide enough that anything following three of
them mid-line collides with them, so keep a card's hanzi to two at a time, or
put them at the end of the line.

## Start here

- [Getting started](getting-started/): install it, load a dictionary, convert
  something.

## Guides

- [The command line](cli/): every `pinyinjs` command, its flags, and the JSON
  output.
- [Converting](converting/): `convert`, and what the decoder is doing behind
  it.
- [Orthography](orthography/): word spacing, capitals, apostrophes and
  punctuation, and where the implementation stops.
- [Confidence](confidence/): which syllables were guesses, what they beat, and
  by how much.
- [HTML output](html/): one element per syllable, with tone and uncertainty
  classes.
- [Segmenting](segmenting/): splitting text into words, and why the split is
  chosen for the reading it produces.
- [Matching](matching/): filtering Chinese text by a pinyin query typed on a
  Latin keyboard, and ranking what it finds.
- [Slugs](slug/): hanzi to a URL-safe slug, and to search keys and identifiers
  besides.
- [Dictionaries](dictionaries/): loading, tiers, serving in a browser, and
  querying directly.
- [Syllables](syllables/): the layer that needs no dictionary, covering parsing,
  writing, splitting and tones.
- [Sandhi](sandhi/): 一, 不 and third-tone sandhi.
- [Numbers](numerals/): reading numbers aloud, counted or spelled out.
- [Romanisation](romanization/): bopomofo and Wade-Giles, both directions, and
  how ambiguous Wade-Giles really is.
- [Scripts and locales](scripts-and-locales/): 简体 and 繁體, 普通话 and 國語,
  and why they are two axes.
- [Script conversion](script-conversion/): 简体 ↔ 繁體, why the reading is what
  makes it accurate, and which characters were guesses.

## Reference

- [Options](options/): every `ConvertOptions` field and value.
- [API](api/): everything the package exports.
