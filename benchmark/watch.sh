#!/bin/bash
#
# Real-time benchmark monitor
#
# Watches progress.log files from multiple AI agents running in parallel.
# Uses tail -f with file headers so you can see which agent each line belongs to.
#
# Usage:
#   ./benchmark/watch.sh path/to/agent_a path/to/agent_b path/to/agent_c
#
# Example (3 agents side by side):
#   ./benchmark/watch.sh runs/claude runs/gpt runs/gemini
#
# Each path should be a cloned 2048_project directory.

set -e

if [ $# -eq 0 ]; then
  echo "Usage: $0 <agent_dir1> [agent_dir2] [agent_dir3] ..."
  echo ""
  echo "Example:"
  echo "  $0 runs/claude runs/gpt runs/gemini"
  exit 1
fi

LOGS=()
for DIR in "$@"; do
  LOG="$DIR/benchmark/results/progress.log"
  LOGS+=("$LOG")
  echo "Watching: $LOG"
done

echo ""
echo "=== 2048 AI Benchmark Monitor ==="
echo "Waiting for agents to write logs..."
echo "Press Ctrl+C to stop."
echo "---"

# tail -f with file names shown on each new file switch
tail -f "${LOGS[@]}" 2>/dev/null
