#!/usr/bin/env bash
set -euo pipefail

main() {
    echo "Uninstalling Clipex..."

    rm -rf "${HOME}/.claude/skills/shorts"

    echo "Clipex uninstalled."
    echo "Restart Claude Code to complete removal."
}

main "$@"
