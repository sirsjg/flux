#!/bin/bash
# Syncs Claude TaskCreate to Flux

INPUT=$(cat)
cd "$CLAUDE_PROJECT_DIR" || exit 0

# Check if Flux is initialized
if [ ! -f ".flux/data.json" ] && [ ! -f ".flux/data.sqlite" ]; then
  exit 0
fi

# Extract task details from Claude's TaskCreate input
SUBJECT=$(echo "$INPUT" | jq -r '.tool_input.subject // empty')
DESCRIPTION=$(echo "$INPUT" | jq -r '.tool_input.description // empty')

if [ -n "$SUBJECT" ]; then
  # Get active Flux project
  PROJECT=$(flux project list --json 2>/dev/null | jq -r '.[0].id // empty')
  if [ -n "$PROJECT" ]; then
    flux task create "$PROJECT" "$SUBJECT" --note "$DESCRIPTION" 2>/dev/null || true
  fi
fi

exit 0
