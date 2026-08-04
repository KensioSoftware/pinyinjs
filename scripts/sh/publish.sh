#!/usr/bin/env bash
#
# Publish to npm.
#
#   ./scripts/sh/publish.sh          # a stable minor release, tagged latest
#   ./scripts/sh/publish.sh beta     # a prerelease, tagged beta
#
# A prerelease goes out under its own dist-tag, so `pnpm add @kensio/pinyinjs`
# keeps returning the newest stable version and nobody gets a beta by accident.
# The version bump follows suit: with no prerelease in progress it opens one
# (0.0.1 becomes 0.1.0-beta.0), and with one in progress it advances that
# (0.1.0-beta.0 becomes 0.1.0-beta.1) rather than opening another.

set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

preid="${1:-}"

pnpm install
pnpm lint
pnpm test:coverage
pnpm build
pnpm pack --dry-run

if [[ -n "$preid" ]]; then
  current="$(node -p "require('./package.json').version")"
  if [[ "$current" == *-* ]]; then
    pnpm version prerelease --preid "$preid"
  else
    pnpm version preminor --preid "$preid"
  fi
  pnpm login
  pnpm publish --access public --tag "$preid"
else
  pnpm version minor
  pnpm login
  pnpm publish --access public
fi

git push
git push --tags
