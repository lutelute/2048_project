#!/bin/bash
#
# 2048 AI Self-Improve Challenge — 停止 (6000番台)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== 2048 AI Self-Improve — 停止中 ==="

# ダッシュボードサーバー停止
lsof -ti :6050 2>/dev/null | xargs kill 2>/dev/null \
  && echo "  ✓ ダッシュボード :6050 停止" \
  || echo "  - ダッシュボード停止済み"

# PID ファイルから残存プロセスを停止
if [ -f "$SCRIPT_DIR/.self-improve-pids" ]; then
  PIDS=$(cat "$SCRIPT_DIR/.self-improve-pids")
  for PID in $PIDS; do
    kill "$PID" 2>/dev/null || true
  done
  rm -f "$SCRIPT_DIR/.self-improve-pids"
fi

echo ""
echo "=== 停止完了 ==="
echo ""
echo "注意: 各AI CLIのターミナルは手動で閉じてください。"
