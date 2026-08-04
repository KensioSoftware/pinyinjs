/**
 * A word made only of Han characters.
 *
 * Drops the file's header lines, which are comments that happen to contain a
 * colon: `# version: 0.19.0` parses as the word `# version`.
 */
const HAN_ONLY = /^\p{Script=Han}+$/u;

/**
 * Read a phrase pinyin file, whose lines are `词: pīn yīn`.
 *
 * Readings are returned exactly as written. They are **not** yet usable as
 * dictionary values: this data bakes in 一 and 不 tone sandhi inconsistently
 * (`一不小心` is given as `yí bù xiǎo xīn` but `一丁不识` as `yī dīng bù shí`),
 * and it writes 儿化 as a separate `er` syllable (`玩儿` as `wán er` rather than
 * `wánr`). Both have to be repaired downstream.
 */
export function parsePhrasePinyin(
  text: string,
): Map<string, readonly string[]> {
  const entries = new Map<string, readonly string[]>();

  for (const line of text.split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const word = line.slice(0, separator).trim().normalize("NFC");
    if (!HAN_ONLY.test(word)) {
      continue;
    }

    // A reading may be followed by an inline comment, which would otherwise be
    // read as extra syllables. There is exactly one such line upstream — 地藏,
    // whose comment contributed three non-syllables to the inventory — but the
    // format allows it anywhere.
    const commented = line.slice(separator + 1);
    const commentStart = commented.indexOf("#");
    const readings = (
      commentStart === -1 ? commented : commented.slice(0, commentStart)
    )
      .trim()
      .split(/\s+/u)
      .filter((reading) => reading !== "")
      .map((reading) => reading.normalize("NFC"));
    if (readings.length === 0) {
      continue;
    }

    entries.set(word, readings);
  }

  return entries;
}
