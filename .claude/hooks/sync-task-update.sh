#!/bin/bash
# Syncs Claude TaskUpdate to Flux

INPUT=$(cat)
cd "$CLAUDE_PROJECT_DIR" || exit 0

if [ ! -f ".flux/data.json" ] && [ ! -f ".flux/data.sqlite" ]; then
  exit 0
fi

TASK_ID=$(echo "$INPUT" | jq -r '.tool_input.taskId // empty')
STATUS=$(echo "$INPUT" | jq -r '.tool_input.status // empty')

# Map Claude status to Flux status
case "$STATUS" in
  "completed") FLUX_STATUS="done" ;;
  "in_progress") FLUX_STATUS="in_progress" ;;
  *) FLUX_STATUS="" ;;
esac

# Try to update matching Flux task
if [ -n "$FLUX_STATUS" ] && [ -n "$TASK_ID" ]; then
  flux task update "$TASK_ID" --status "$FLUX_STATUS" 2>/dev/null || true
fi

exit 0
