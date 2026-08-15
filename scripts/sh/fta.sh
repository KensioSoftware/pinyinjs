#!/usr/bin/env bash
#
# Report Fast TypeScript Analyzer complexity scores for the source tree.
#
# Thresholds live in fta.json; fta exits non-zero when a file exceeds
# score_cap, which is what makes this usable as a CI gate.
#
# score_cap is a ratchet: it sits just above the worst file so the gate
# blocks regressions today, and steps down as files are split up. The
# target is 50, which is where fta stops calling a file "could be better".

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."

exec pnpm exec fta . --config-path fta.json
