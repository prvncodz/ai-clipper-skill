#!/usr/bin/env bash
# Install shorts for Claude Code (default) or Codex.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
case "${1:-claude}" in
    claude) SKILL_DIR="$HOME/.claude/skills/shorts" ;;
    codex) SKILL_DIR="$HOME/.agents/skills/shorts" ;;
    *) echo "Usage: bash install.sh [claude|codex]" >&2; exit 1 ;;
esac

if [ "$(realpath -m "$SCRIPT_DIR")" = "$(realpath -m "$SKILL_DIR")" ]; then
    echo "Already installed at $SKILL_DIR. Run bash setup.sh to update dependencies."
    exit 0
fi

echo "=== Installing shorts skill ==="

# Create skill directory
mkdir -p "$SKILL_DIR"
mkdir -p "$SKILL_DIR/scripts"
mkdir -p "$SKILL_DIR/references"
mkdir -p "$SKILL_DIR/remotion"

# Copy SKILL.md (the skill definition)
cp "$SCRIPT_DIR/SKILL.md" "$SCRIPT_DIR/setup.sh" "$SCRIPT_DIR/requirements.txt" "$SKILL_DIR/"

# Copy scripts
for f in "$SCRIPT_DIR"/scripts/*.sh "$SCRIPT_DIR"/scripts/*.py; do
    [ -f "$f" ] && cp "$f" "$SKILL_DIR/scripts/"
done

# Make scripts executable
chmod +x "$SKILL_DIR"/scripts/*.sh 2>/dev/null || true
chmod +x "$SKILL_DIR"/scripts/*.py 2>/dev/null || true

# Copy references
for f in "$SCRIPT_DIR"/references/*.md; do
    [ -f "$f" ] && cp "$f" "$SKILL_DIR/references/"
done

# Copy Remotion project (excluding node_modules)
rsync -a --exclude='node_modules' --exclude='.remotion' \
    "$SCRIPT_DIR/remotion/" "$SKILL_DIR/remotion/"

echo ""
echo "Installed to: $SKILL_DIR"
echo ""
echo "Files copied:"
find "$SKILL_DIR" -type f | sort | while read -r f; do
    echo "  ${f#$SKILL_DIR/}"
done
echo ""
echo "Next steps:"
echo "  1. Run: cd \"$SKILL_DIR\" && bash setup.sh"
echo '  2. Use /shorts in Claude Code or $shorts in Codex'
