# pinyinjs documentation

Use pinyinjs to convert Chinese text to pinyin, inspect uncertain readings and
work with Chinese pronunciation in JavaScript or TypeScript.

## Start here

- [Getting started](getting-started/) covers installation, dictionary loading
  and your first conversion.

## Guides

- [The command line](cli/) covers commands, flags and JSON output.
- [Converting](converting/) explains conversion options and pronunciation rules.
- [Orthography](orthography/) covers word spacing, capitals, apostrophes and
  punctuation, including current limitations.
- [Confidence](confidence/) explains uncertain readings and alternative costs.
- [HTML output](html/) covers tone classes and annotated hanzi.
- [Segmenting](segmenting/) splits Chinese text into words.
- [Matching](matching/) searches Chinese text with pinyin queries.
- [Candidates](candidates/) finds Chinese words from pinyin.
- [Checking](checking/) grades typed pinyin against Chinese text.
- [Slugs](slug/) creates URL slugs, search keys and identifiers.
- [Dictionaries](dictionaries/) covers loading, tiers and direct queries.
- [Syllables](syllables/) parses, formats and splits pinyin without a dictionary.
- [Sandhi](sandhi/) applies 一, 不 and third-tone changes.
- [Numbers](numerals/) reads numbers and digit sequences.
- [Romanisation](romanization/) converts between pinyin, bopomofo, Wade-Giles,
  Yale, Gwoyeu Romatzyh and IPA.
- [Scripts and locales](scripts-and-locales/) explains character scripts and
  regional pronunciation standards.
- [Script conversion](script-conversion/) converts simplified and traditional
  characters and reports ambiguity.

## Reference

- [Options](options/) lists every `ConvertOptions` field and value.
- [API](api/) lists the public exports.

## Editing these docs

The files under `docs/<path>/README.md` are the source for
[pinyinjs.dev](https://pinyinjs.dev). Edit these files when updating a guide.

Each guide ends with a `<!-- card -->` comment containing the code snippet for
its social share image. Keep snippets within six lines of sixty characters.
The website scaffold requires a snippet for every guide. Generate and inspect
the image after changing one.
