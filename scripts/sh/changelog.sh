#!/usr/bin/env bash
# CHANGELOG.md, read and rewritten by the release.
#
#   ./scripts/sh/changelog.sh notes            # print the Unreleased section
#   ./scripts/sh/changelog.sh release 1.6.0    # retitle it as that version
#
# The changelog is written by hand, one entry per pull request, under a single
# `## Unreleased` heading. That prose is the release notes: `notes` prints it
# for .releaserc.yaml to hand to the GitHub Release, and `release` retitles the
# heading to the version being published and opens a fresh empty one above it.
#
# `release` runs during semantic-release's prepare step, before the tarball is
# packed, which is what keeps the published CHANGELOG.md from saying
# "Unreleased" about the version you just installed. Committing the same
# rewrite back to main is a separate pull request; see .github/workflows/
# release.yml.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$here"

changelog="CHANGELOG.md"
heading="## Unreleased"

usage() {
  echo "changelog: usage: changelog.sh notes | changelog.sh release <version>" >&2
  exit 2
}

# The lines between `## Unreleased` and whatever heading comes next, with the
# blank lines at either end taken off. Prints nothing if the section is empty,
# which is how `notes` below tells the difference.
#
# The trimming is done by holding the section rather than by piping through
# `tac`, which is GNU-only: this script runs on a runner and on a laptop, and
# macOS spells that `tail -r`.
unreleased_body() {
  awk -v heading="$heading" '
    $0 == heading { inside = 1; next }
    inside && /^## / { exit }
    inside { held[count++] = $0 }
    END {
      first = 0
      last = count - 1
      while (first <= last && held[first] ~ /^[[:space:]]*$/) first++
      while (last >= first && held[last] ~ /^[[:space:]]*$/) last--
      for (i = first; i <= last; i++) print held[i]
    }
  ' "$changelog"
}

require_heading() {
  if ! grep -qxF "$heading" "$changelog"; then
    echo "changelog: no '$heading' heading in $changelog" >&2
    exit 1
  fi
}

case "${1:-}" in
  notes)
    [[ $# -eq 1 ]] || usage
    require_heading

    body="$(unreleased_body)"
    # An empty section fails rather than publishing a release with no notes.
    # Every releasable change is a change worth a sentence, and the release is
    # the last moment anyone will remember what it was.
    if [[ -z "$body" ]]; then
      echo "changelog: nothing is written under '$heading' in $changelog" >&2
      exit 1
    fi

    printf '%s\n' "$body"
    ;;

  release)
    [[ $# -eq 2 ]] || usage
    version="$2"

    # Digits and dots only. This ends up as a markdown heading and as the
    # anchor every link to it uses, and the argument comes from a template in
    # .releaserc.yaml rather than from a person reading the result.
    if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "changelog: expected a version like 1.6.0; got '$version'" >&2
      exit 1
    fi

    require_heading

    if grep -qxF "## $version" "$changelog"; then
      echo "changelog: $changelog already has a '## $version' section" >&2
      exit 1
    fi

    # The new empty Unreleased sits above the section just retitled, so the
    # file still opens on the place the next entry gets written.
    awk -v heading="$heading" -v version="$version" '
      $0 == heading && !done {
        print heading
        print ""
        print "## " version
        done = 1
        next
      }
      { print }
    ' "$changelog" >"$changelog.tmp"

    mv "$changelog.tmp" "$changelog"
    echo "changelog: $heading is now ## $version"
    ;;

  *)
    usage
    ;;
esac
