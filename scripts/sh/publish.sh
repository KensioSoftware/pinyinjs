#!/usr/bin/env bash
#
# Publish to npm.
#
#   ./scripts/sh/publish.sh          # a minor release
#   ./scripts/sh/publish.sh major    # a major release
#   ./scripts/sh/publish.sh patch    # a patch release
#
# The argument is the release type, and it is passed straight to `pnpm version`.
# This script owns the version bump, so package.json holds the *last released*
# version between releases and nothing else should edit it.
#
# It used to take a prerelease identifier instead — `publish.sh beta` meant
# "open or advance a beta" — and the two readings of one argument are not
# distinguishable by looking: `publish.sh major` ran `pnpm version preminor
# --preid major` against 1.0.0 and published `1.1.0-major.0` under a `major`
# dist-tag. The prerelease mechanism is gone rather than fixed, since the
# package is past 1.0 and a release type is what anyone would expect to pass.

set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

RELEASE_TYPE="${1:-minor}"

# A release type is checked rather than trusted, because the failure this
# replaces was an argument that meant something plausible and wrong.
case "$RELEASE_TYPE" in
  major | minor | patch) ;;
  *)
    echo "publish: expected major, minor or patch; got '$RELEASE_TYPE'" >&2
    exit 1
    ;;
esac

pnpm install
pnpm lint
pnpm test:coverage
pnpm build
# Checks the real tarball rather than the local dist/, which is where a stale
# build hides. See scripts/sh/pack-check.sh.
pnpm pack:check
pnpm version "$RELEASE_TYPE"
pnpm login
pnpm publish --access public
git push
git push --tags
