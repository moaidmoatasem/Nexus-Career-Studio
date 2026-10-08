#!/bin/bash
# Installs dependencies in Claude Code cloud sessions so checks and tests run straight away.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"
bun install --frozen-lockfile
