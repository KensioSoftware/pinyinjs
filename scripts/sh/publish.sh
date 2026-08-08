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

# The version is written before anything is committed, so that the changelog
# rewrite lands in the same commit and the tag points at a tree where the two
# agree. `pnpm version` on its own would commit and tag first, leaving the
# changelog to a second commit the tag does not cover.
pnpm version major --no-git-tag-version
version="$(node -p "require('./package.json').version")"

# What the workflow's prepare step does, done here: the `## Unreleased`
# section becomes this version, and a fresh empty one opens above it.
./scripts/sh/changelog.sh release "$version"

git add package.json CHANGELOG.md
git commit --message "$version"
git tag "v$version"

pnpm login
pnpm publish --access public
git push
git push --tags

echo
echo "Published $version. The release notes are the changelog section:"
echo "  https://github.com/KensioSoftware/pinyinjs/releases/new?tag=v$version"
