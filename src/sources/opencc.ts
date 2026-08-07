/**
 * One OpenCC mapping table: each key with the forms it may be written as.
 *
 * The first value is OpenCC's default, and the rest are alternatives it keeps
 * for the reverse tables it generates. Both matter here: the default is what a
 * conversion takes when it has no other evidence, and the alternatives are what
 * a normalisation has to recognise on input.
 */
export type OpenCcTable = ReadonlyMap<string, readonly string[]>;

/**
 * Separator between an OpenCC key and its values.
 */
const COLUMN = "\t";

/**
 * Separator between the values of one key.
 */
const VALUE = " ";

/**
 * Read one of OpenCC's dictionary tables.
 *
 * The format is one mapping per line as `key<TAB>value(s)`, values separated by
 * spaces with the first as the default, and `#` starting a comment line.
 *
 * OpenCC also writes directives into those comments — `# @reverse-prefer: 才`
 * tells its own build which value to favour when it generates the reversed
 * table. They are deliberately ignored: we do not use OpenCC's generated
 * reverse tables, and reversing a table here is a decision for the code that
 * knows what it is reversing for. See SCRIPTS-AND-LOCALES.md.
 *
 * Faithful to the file, per the convention in DATA-SOURCES.md: a key mapping to
 * itself is kept rather than dropped as a no-op, because "this character is
 * already standard" and "this character is unknown to the table" are different
 * facts, and only the table can tell them apart.
 */
export function parseOpenCcTable(text: string): OpenCcTable {
  const table = new Map<string, readonly string[]>();

  for (const line of text.split("\n")) {
    if (line.startsWith("#")) {
      continue;
    }
    const [key, values] = line.trim().split(COLUMN);
    if (key === undefined || key === "" || values === undefined) {
      continue;
    }
    const forms = values.split(VALUE).filter((form) => form !== "");
    if (forms.length === 0) {
      continue;
    }
    table.set(
      key.normalize("NFC"),
      forms.map((form) => form.normalize("NFC")),
    );
  }

  return table;
}

/**
 * The form a table converts a character to, or undefined if it has no opinion.
 */
export function openCcDefault(
  table: OpenCcTable,
  character: string,
): string | undefined {
  return table.get(character)?.[0];
}
