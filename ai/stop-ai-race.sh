#!/bin/bash
#
# 2048 AI Challenge — 停止 (5000番台)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== 2048 AI Challenge — 停止中 ==="

# evaluate.mjs プロセスを停止
pkill -f "evaluate.mjs" 2>/dev/null && echo "  evaluate プロセス停止" || echo "  - evaluate プロセスなし"

# ダッシュボードサーバーを停止
lsof -ti :5050 2>/dev/null | xargs kill 2>/dev/null && echo "  ダッシュボード :5050 停止" || echo "  - ダッシュボード停止済み"

# PID ファイルから残存プロセスを停止
if [ -f "$SCRIPT_DIR/.ai-race-pids" ]; then
  PIDS=$(cat "$SCRIPT_DIR/.ai-race-pids")
  for PID in $PIDS; do
    kill "$PID" 2>/dev/null || true
  done
  rm -f "$SCRIPT_DIR/.ai-race-pids"
fi

echo ""
echo "=== 停止完了 ==="
