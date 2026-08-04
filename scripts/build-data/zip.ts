import { inflateRawSync } from "node:zlib";

/**
 * Signature of the end-of-central-directory record.
 */
const END_OF_CENTRAL_DIRECTORY = 0x06_05_4b_50;

/**
 * Signature of a central directory file header.
 */
const CENTRAL_FILE_HEADER = 0x02_01_4b_50;

/**
 * Fixed size of the end-of-central-directory record, before its comment.
 */
const END_RECORD_SIZE = 22;

/**
 * Longest comment a zip file may carry, which bounds how far back to scan.
 */
const MAX_COMMENT = 0xff_ff;

/**
 * Fixed size of a central directory file header, before its variable fields.
 */
const CENTRAL_HEADER_SIZE = 46;

/**
 * Offset of the variable-length fields in a local file header.
 */
const LOCAL_HEADER_SIZE = 30;

const STORED = 0;
const DEFLATED = 8;

/**
 * Find the end-of-central-directory record, scanning back from the end.
 *
 * The record is last in the file but has a variable-length comment after it, so
 * its position can only be found by searching rather than computed.
 */
function findEndRecord(zip: Buffer): number {
  const earliest = Math.max(0, zip.length - END_RECORD_SIZE - MAX_COMMENT);
  for (let at = zip.length - END_RECORD_SIZE; at >= earliest; at--) {
    if (zip.readUInt32LE(at) === END_OF_CENTRAL_DIRECTORY) {
      return at;
    }
  }
  throw new Error("not a zip file: no end-of-central-directory record");
}

/**
 * Read a zip archive's central directory, mapping each name to its data.
 *
 * Only the two compression methods that matter here are supported — stored and
 * deflated — because a zip using anything else would be a change upstream had
 * to make deliberately, and silently returning nothing for it would be worse
 * than failing.
 *
 * Written out rather than taken as a dependency because `node:zlib` already
 * provides the hard part: the container format is a few offsets, and Unihan is
 * the only zip this pipeline ever reads.
 */
export function readZipEntries(zip: Buffer): Map<string, Buffer> {
  const endRecord = findEndRecord(zip);
  const entryCount = zip.readUInt16LE(endRecord + 10);
  let at = zip.readUInt32LE(endRecord + 16);

  const entries = new Map<string, Buffer>();
  for (let index = 0; index < entryCount; index++) {
    if (zip.readUInt32LE(at) !== CENTRAL_FILE_HEADER) {
      throw new Error(
        `corrupt zip: bad central directory header at ${String(at)}`,
      );
    }

    const method = zip.readUInt16LE(at + 10);
    const compressedSize = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28);
    const extraLength = zip.readUInt16LE(at + 30);
    const commentLength = zip.readUInt16LE(at + 32);
    const localHeader = zip.readUInt32LE(at + 42);
    const name = zip.toString(
      "utf8",
      at + CENTRAL_HEADER_SIZE,
      at + CENTRAL_HEADER_SIZE + nameLength,
    );

    // The local header repeats the name and carries its own extra field, whose
    // length routinely differs from the central directory's. Both have to be
    // read from the local header to find where the data actually starts.
    const localNameLength = zip.readUInt16LE(localHeader + 26);
    const localExtraLength = zip.readUInt16LE(localHeader + 28);
    const start =
      localHeader + LOCAL_HEADER_SIZE + localNameLength + localExtraLength;
    const body = zip.subarray(start, start + compressedSize);

    if (method === STORED) {
      entries.set(name, body);
    } else if (method === DEFLATED) {
      entries.set(name, inflateRawSync(body));
    } else {
      throw new Error(
        `unsupported compression method ${String(method)} for ${name}`,
      );
    }

    at += CENTRAL_HEADER_SIZE + nameLength + extraLength + commentLength;
  }

  return entries;
}
