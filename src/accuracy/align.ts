/**
 * A pair of indices matched between two sequences.
 */
export interface AlignedPair {
  readonly expected: number;
  readonly actual: number;
}

/**
 * Match two sequences up by longest common subsequence.
 *
 * Scoring cannot compare position by position, because a converter that drops or
 * invents a syllable would then be marked wrong on everything after the slip
 * rather than on the slip itself. Aligning first keeps the penalty proportional.
 */
export function alignSequences(
  expected: readonly string[],
  actual: readonly string[],
): readonly AlignedPair[] {
  const rows = expected.length;
  const columns = actual.length;
  const width = columns + 1;

  // Suffix table held flat: lengths[row * width + column] is the length of the
  // longest common subsequence of expected[row..] and actual[column..].
  const lengths = new Uint32Array((rows + 1) * width);
  /* c8 ignore next 2 -- the fallback is unreachable; every read is in bounds */
  const lengthAt = (row: number, column: number): number =>
    lengths[row * width + column] ?? 0;

  for (let row = rows - 1; row >= 0; row--) {
    for (let column = columns - 1; column >= 0; column--) {
      lengths[row * width + column] =
        expected[row] === actual[column]
          ? lengthAt(row + 1, column + 1) + 1
          : Math.max(lengthAt(row + 1, column), lengthAt(row, column + 1));
    }
  }

  const pairs: AlignedPair[] = [];
  let row = 0;
  let column = 0;
  while (row < rows && column < columns) {
    if (expected[row] === actual[column]) {
      pairs.push({ expected: row, actual: column });
      row++;
      column++;
    } else if (lengthAt(row + 1, column) >= lengthAt(row, column + 1)) {
      row++;
    } else {
      column++;
    }
  }
  return pairs;
}
