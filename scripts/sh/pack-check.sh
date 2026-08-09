#!/usr/bin/env bash
# What actually ships, checked against what should.
#
# `tsc` does not clean its output directory, so a rename leaves the old files
# behind and `files: ["dist"]` publishes them: before this existed, the tarball
# carried 24 dead files under dist/romanization/ alongside the real
# dist/transcription/. A build is not the same thing as a package, and only the
# package is what a user installs.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$here"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

pnpm pack --pack-destination "$work" >/dev/null
tarball="$(find "$work" -name '*.tgz' -maxdepth 1 | head -1)"
if [[ -z "$tarball" ]]; then
  echo "pack:check: no tarball was produced" >&2
  exit 1
fi

listing="$work/listing.txt"
tar -tzf "$tarball" >"$listing"

fail=0
note() {
  echo "pack:check: $1" >&2
  fail=1
}

# Every compiled module must correspond to a source file. This is the check
# that catches stale output, whatever it happens to be called.
while read -r compiled; do
  source_path="src/${compiled#package/dist/}"
  source_path="${source_path%.js}.ts"
  if [[ ! -f "$source_path" ]]; then
    note "$compiled has no source at $source_path"
  fi
done < <(grep -E '^package/dist/.*\.js$' "$listing")

# The entry points package.json promises.
for required in \
  package/dist/index.js \
  package/dist/index.d.ts \
  package/dist/dictionary/node-source.js \
  package/dist/cli/main.js \
  package/data/full.entries \
  package/data/manifest.json \
  package/LICENSE \
  package/NOTICE \
  package/README.md; do
  grep -qxF "$required" "$listing" || note "missing $required"
done

# Nothing that is not meant to ship.
if grep -qE '^package/(src|test|scripts|docs|\.claude)/' "$listing"; then
  note "the tarball carries sources, tests or docs"
fi
if grep -qE '\.test\.(js|ts|d\.ts)$' "$listing"; then
  note "the tarball carries test files"
fi

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "pack:check: $(wc -l <"$listing" | tr -d ' ') files, $(du -h "$tarball" | cut -f1) — no stale output"
