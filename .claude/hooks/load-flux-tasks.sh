#!/bin/bash
# Loads Flux tasks into Claude's context at session start

cd "$CLAUDE_PROJECT_DIR" || exit 0

# Check if Flux is initialized
if [ ! -f ".flux/data.json" ] && [ ! -f ".flux/data.sqlite" ]; then
  exit 0
fi

# Output context for Claude
echo "## Active Flux Tasks"
echo ""
flux ready 2>/dev/null || exit 0
