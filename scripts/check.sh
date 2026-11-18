#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

npx biome ci .

npx tsc --noEmit

npx knip
npx vitest run --passWithNoTests
npm audit --audit-level=low

uv run ruff check
uv run ruff format --check
uv run pytest -q

gitleaks dir .
