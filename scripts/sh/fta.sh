#!/usr/bin/env bash
#
# Report Fast TypeScript Analyzer complexity scores for the source tree.
#
# Thresholds live in fta.json; fta exits non-zero when a file exceeds
# score_cap, which is what makes this usable as a CI gate.
#
# score_cap was a ratchet, stepping down as files were split up. It has
# reached its target of 50, which is where fta stops calling a file "could
# be better", so it is now a floor to hold rather than a number to lower.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

exec pnpm exec fta . --config-path fta.json
