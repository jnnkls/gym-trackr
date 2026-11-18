#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

npx biome ci .

npx tsc --noEmit

npx knip
npx vitest run --passWithNoTests
npm audit --audit-level=low

# shortcut: pytest exits 5 when no tests are collected; drop this guard once tests_ha has test files
rc=0
uv run pytest -q || rc=$?
if [ "$rc" -ne 0 ] && { [ "$rc" -ne 5 ] || compgen -G "tests_ha/test_*.py" >/dev/null; }; then exit "$rc"; fi

gitleaks dir .
