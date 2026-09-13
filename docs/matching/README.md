# Matching

`match` searches Chinese text using pinyin or initials and returns the matching character ranges.

```ts
import { match } from "@kensio/pinyinjs";

match(dictionary, "北京大学", "bjdx")?.ranges; // [{ at: 0, length: 4 }]
match(dictionary, "北京大学", "nanjing"); // undefined
```

For example, 北京大学 matches `bjdx`, `beijing`, `beijingdx` and `bei jing da xue`.

<a id="what-a-query-may-write"></a>

## Query syntax

| Form            | Written                    |
| --------------- | -------------------------- |
| full syllables  | `beijingdaxue`             |
| the same, apart | `bei jing da xue`          |
| initials        | `bjdx`                     |
| the two mixed   | `beijingdx`, `bjdaxue`     |
| tones as digits | `bei3jing1`                |
| ü as typed      | `lvse` or `lu:se` for 绿色 |

The final syllable in a query can be incomplete. `b`, `be` and `bei` all match 北京. With `beij`, the match also includes 京. This supports filtering while the user types.

Apostrophes, hyphens and spaces specify syllable boundaries. For example, 县 is `xian` and 西安 is `xi an`. An explicit boundary distinguishes them:

```ts
match(dictionary, "县城", "xian")?.ranges; // [{ at: 0, length: 1 }]
match(dictionary, "县城", "xi an"); // undefined
```

Tone digits constrain the match. `bei3` matches 北, but `bei1` does not. Tone marks are ignored because the final syllable may still be incomplete. For example, `bei` may become `beijing`.

<a id="no-index-and-none-needed"></a>

## Character readings

Pass the Chinese text directly to `match`. It checks the query against each character's dictionary readings. You can reuse the dictionary loaded for conversion without building a separate pinyin index.

`match` accepts every dictionary reading of a character:

```ts
match(dictionary, "银行", "yh")?.score; // 7 — 银行 is yínháng
match(dictionary, "银行", "yx")?.score; // 5 — a reading 行 has, but not here
```

Both queries match 行, but the reading supported by the surrounding text receives a higher score. Similarly, 长江 ranks `cj` above `zj`, and 重庆 ranks `cq` above `zq`.

Taiwan Mandarin readings also match. 垃圾 matches both `lese` and `laji`. When a `zh-CN` conversion reads the text as `lājī`, that reading ranks first.

## 儿化

In 儿化 (erhua), the r-suffix belongs to the preceding syllable. For example, 玩儿 is `wánr`, one syllable covering two characters:

```ts
match(dictionary, "玩儿", "wanr")?.ranges; // [{ at: 0, length: 2 }]
match(dictionary, "一点儿", "yidianr")?.ranges; // [{ at: 0, length: 3 }]
```

The match includes both characters. Separate-character queries such as `wane` and `we` also match 玩 `wán` and 儿 `ér`, but rank below the contextual reading.

An r-suffix query is accepted whenever 儿 follows a character, including words with a separate 儿 syllable. For example, 女儿 is read `nǚ'ér`. Both `nver` and `nvr` find it, with `nver` ranked higher.

## Ranking

Sort by `score` in descending order. It combines three factors:

| Worth | For                                                        |
| ----- | ---------------------------------------------------------- |
| 4     | reading the characters the way the text reads them         |
| 2     | starting where a word starts                               |
| 1     | starting at the beginning of the text, decaying with depth |

The first factor measures how many matched characters agree with the contextual reading. A match with agreement on half its characters contributes 2 points. The other factors reward word boundaries and positions near the start of the text.

```ts
const query = "dx";
["大学生活", "上海大学"]
  .map((text) => ({ text, found: match(dictionary, text, query) }))
  .filter((one) => one.found !== undefined)
  .toSorted((a, b) => (b.found?.score ?? 0) - (a.found?.score ?? 0))
  .map((one) => one.text); // ["大学生活", "上海大学"]
```

Compare scores only within the same query. They are ranking values, not probabilities. If two matches have the same score, the earlier match is kept.

<a id="what-comes-back-is-ranges"></a>

## Matching ranges

The result contains character ranges measured in Unicode code points from the start of the text. Use them to highlight matches:

```ts
const found = match(dictionary, "我在北京大学学中文", "bjdx");
found?.ranges; // [{ at: 2, length: 4 }]
```

A match has multiple ranges when it skips characters with no reading, such as a separator, space or bracket:

```ts
match(dictionary, "北京·大学", "bjdx")?.ranges;
// [{ at: 0, length: 2 }, { at: 3, length: 2 }]
```

In this example, `·` is outside the highlighted ranges. Characters with dictionary readings must match the query and cannot be skipped.

Positions use Unicode code points, as in `segment`. A supplementary character occupies one position. Convert the input with `Array.from` before slicing by these positions.

## The core tier is enough

Matching asks the dictionary for a character's readings, and every tier has
them:

```ts
const core = await loadDictionary(fileSource(directory), "core");
match(core, "北京大学", "bjdx")?.ranges; // [{ at: 0, length: 4 }]
```

The `core` tier supports matching with a download of about 70 KB. The larger `standard` and `full` tiers provide more word context for ranking results.

<a id="where-it-stops"></a>

## Limitations

Matching requires correct spelling, with an incomplete syllable allowed only at the end of a query. For example, `bejing` fails to match `beijing`.

Matching searches Chinese readings only. Use a separate substring search to match Latin text, such as `iphone` in `iPhone 15 发布`.

## At the command line

```console
$ pinyinjs match --query bjdx 北京大学 我在北京大学学中文 上海大学
[北京大学]  7.00
我在[北京大学]学中文  6.33
上海大学  no match
```

Results are ordered with matches first and the highest scores first. Each input text gets a line. With no positional arguments, the command reads standard input. For example, `cat titles.txt | pinyinjs match --query bjdx` searches a file of titles. `--json` includes `ranges` and `score` for matching texts.

## Uses

- a search box over Chinese titles, names or entries
- filtering a list in the browser, with no round trip and no index
- a pinyin input aid for anybody without a Chinese IME on the device in front
  of them
- highlighting what a query matched, with the ranges it gives back

<!-- card
```ts
match(dictionary, "北京大学", "bjdx")?.ranges;
// [{ at: 0, length: 4 }]

match(dictionary, "银行", "yh")?.score; // 7, yínháng
match(dictionary, "银行", "yx")?.score; // 5, a reading it has
```
-->
