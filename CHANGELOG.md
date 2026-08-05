# Changelog

Notable changes to `@kensio/pinyinjs`. Versions follow
[semantic versioning](https://semver.org) from 1.0.0 onward.

Two things are outside the version contract, for the reasons
[the API page](docs/api/#stability) gives: the readings a conversion produces,
which a dictionary rebuild can change, and the artifact format under `data/`.

## 1.0.0

The first stable release. Everything the
[API page](docs/api/) lists is now covered by semantic versioning, including the
decoder internals and the build pipeline.

### Added since 0.1.0-beta.0

- **Transcription systems, all five, in both directions.** Bopomofo, Wade-Giles,
  Yale, Gwoyeu Romatzyh and IPA at the syllable level, plus hanzi → any of them
  end to end via `convert --system` and `convertToWadeGiles`. Checked against
  417 rows of an outside syllabary in every system — 3,336 cells.
- **Reading ambiguous Wade-Giles.** `readWadeGilesLoosely` allows for the
  apostrophes and diacritics real texts drop, and `splitWadeGiles` puts back the
  hyphens they lose. Measured: 52.07% of written syllables lose their identity
  without their marks, and taking the first candidate recovers 79.05%.
- **Numbers read aloud** (`src/numerals/`, the `number` command): counting and
  spelling out, 两 against 二, decimals, percentages, fractions, `yāo`, and
  times. `convert` reads the digits it meets and takes the style from what
  follows them.
- **Orthography rules.** The 重叠 hyphen for AABB and repeated words, the 成语
  hyphen from a curated list of 117, 老王 → `Lǎo Wáng`, and GB/T 16159 5.1 in
  full — 毛泽东 is `Máo Zédōng`, 北京大学 is `Běijīng Dàxué`, on boundaries
  CC-CEDICT's own capitalisation states.
- **Typed rule overrides on the lattice** (`READING_RULES`), with the modal 得
  and attested 儿化 as the first two.
- **Tone colour in the terminal**, in MDBG's palette, on every command that
  writes a syllable.

### Fixed since 0.1.0-beta.0

- **一 sandhi is about the 一 that counts.** 十一月 is `shíyīyuè` and 第一次 is
  `dìyīcì`; the citation tone survives a final digit and an ordinal. 561
  conversions change over 88,866 lines, 520 of them right.
- **A colon between digits is a time**, not an identifier: 6:30 is
  `liù diǎn sānshí fēn`.
- **The documented proper-noun mechanism was wrong.** The capitals page
  described a 500-entry surname list that has never existed; what produces
  `Lǐ Huá` is two single-character dictionary entries each flagged a proper
  noun.

### Changed

- **`engines` is now `>=22.0.0`**, down from `>=24.0.0`. The suite and the
  packaged tarball are both exercised on Node 22 and 24 in CI.
- **No more `beta` dist-tag.** `pnpm add @kensio/pinyinjs` finds it.
- `src/romanization/` is `src/transcription/`, since bopomofo has a script of
  its own and IPA is a transcription rather than a spelling. The published docs
  path keeps the older name.
- The build cleans `dist/` before compiling, and `pnpm pack:check` asserts the
  tarball's contents. The beta tarball shipped 24 stale files from a directory
  that had been renamed away.

### Accuracy at 1.0.0

Over the 105-case gold corpus, which is committed to the repository — not to
the published package — and scored by `pnpm accuracy`:

|                  |   lattice | greedy baseline |
| ---------------- | --------: | --------------: |
| exact match      | **97.1%** |           92.4% |
| reading accuracy |     99.7% |           98.6% |
| spacing (F1)     | **99.7%** |           97.0% |

Every figure in that table is asserted against the scorer by
`src/changelog.test.ts`, because a number nothing executes goes stale — which is
what happened to this project's README table across three releases.

`pnpm polyphones` reports 89.04% for the lattice against greedy's 88.82% over
CPP's 20,139 hand-labelled polyphones. That corpus is fetched rather than
committed, so unlike the table above it cannot be asserted here, and it is
reported rather than guarded.

## 0.1.0-beta.0

First published release: the lattice decoder, the tiered dictionaries, the
syllable layer, sandhi, GB/T 16159 spacing and capitals, HTML output and the
`pinyinjs` command.
