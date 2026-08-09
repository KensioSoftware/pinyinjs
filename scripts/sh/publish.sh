#!/usr/bin/env bash
#
# Publish a major release to npm, by hand.
#
#   ./scripts/sh/publish.sh
#
# Everything else goes through the Release workflow in the Actions tab, which
# publishes without a credential ever existing in this repository. This script
# is the one path that workflow deliberately cannot take: `.releaserc.yaml`
# fails the run rather than letting a `feat!:` subject line publish a 2.0.0,
# because what consumers have to rewrite is a decision for a person.
#
# So there is no release-type argument any more. It used to default to a minor,
# and two ways to mint one is exactly the ambiguity the note below is about.
#
# It used to take a prerelease identifier instead — `publish.sh beta` meant
# "open or advance a beta" — and the two readings of one argument are not
# distinguishable by looking: `publish.sh major` ran `pnpm version preminor
# --preid major` against 1.0.0 and published `1.1.0-major.0` under a `major`
# dist-tag. The prerelease mechanism is gone rather than fixed, since the
# package is past 1.0 and a release type is what anyone would expect to pass.

set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

if [[ $# -gt 0 ]]; then
  echo "publish: takes no arguments; this is the major-release path." >&2
  echo "publish: patches and minors go through the Release workflow." >&2
  exit 1
fi

pnpm install
pnpm lint
pnpm test:coverage
pnpm build
# Checks the real tarball rather than the local dist/, which is where a stale
# build hides. See scripts/sh/pack-check.sh.
pnpm pack:check

# `--no-git-tag-version` so the commit and the tag are made below rather than
# by pnpm, which names them its own way.
pnpm version major --no-git-tag-version
version="$(node -p "require('./package.json').version")"

git add package.json
git commit --message "$version"
git tag "v$version"

pnpm login
pnpm publish --access public
git push
git push --tags

# The release notes are not written here and not held anywhere in this
# repository: they live on the GitHub Release, and the workflow builds them out
# of the commit subjects since the last tag. This path has no semantic-release
# run to do that, so GitHub's own "Generate release notes" does it instead —
# same source, the pull requests merged since the previous tag.
echo
echo "Published $version. Draft the release and press Generate release notes:"
echo "  https://github.com/KensioSoftware/pinyinjs/releases/new?tag=v$version"
echo
echo "A major is the one release nobody generated notes for automatically, so"
echo "it is also the one worth writing a paragraph at the top of: what breaks,"
echo "and what a consumer has to change."
