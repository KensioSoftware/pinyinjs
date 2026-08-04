# pinyinjs documentation

The long form of the [README](../README.md). The README is the tour; these pages
are the same material with room to explain itself, one topic at a time.

They are also the source for [pinyinjs.dev](https://pinyinjs.dev), which copies
each `docs/<path>/README.md` here to a page there. Edit them here.

## Start here

- [Getting started](getting-started/) — install it, load a dictionary, convert
  something.

## Guides

- [The command line](cli/) — every `pinyinjs` command, its flags, and the JSON
  output.
- [Converting](converting/) — `convert`, and what the decoder is doing behind
  it.
- [Orthography](orthography/) — word spacing, capitals, apostrophes and
  punctuation, and where the implementation stops.
- [Confidence](confidence/) — which syllables were guesses, what they beat, and
  by how much.
- [HTML output](html/) — one element per syllable, with tone and uncertainty
  classes.
- [Dictionaries](dictionaries/) — loading, tiers, serving in a browser, and
  querying directly.
- [Syllables](syllables/) — the layer that needs no dictionary: parsing,
  writing, splitting and tones.
- [Sandhi](sandhi/) — 一, 不 and third-tone sandhi.
- [Numbers](numerals/) — reading numbers aloud, counted or spelled out.
- [Scripts and locales](scripts-and-locales/) — 简体 and 繁體, 普通话 and 國語,
  and why they are two axes.

## Reference

- [Options](options/) — every `ConvertOptions` field and value.
- [API](api/) — everything the package exports.
