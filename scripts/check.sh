#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

npx biome ci .

npx tsc --noEmit

npx knip
npx vitest run --passWithNoTests
npm audit --audit-level=low

# No pip-audit gate: known advisories (e.g. Pillow) sit in the HA test harness,
# pinned transitively by pytest-homeassistant-custom-component and never shipped;
# Dependabot keeps the harness current.
uv run ruff check
uv run ruff format --check
uv run pytest -q

gitleaks dir .
gitleaks git .
