#!/bin/bash
#
# 2048 AI Benchmark — レース停止
#
# 使い方:
#   ./benchmark/stop-race.sh
#

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== 2048 AI Benchmark — 停止中 ==="

# play.mjs プロセスを停止
pkill -f "play.mjs" 2>/dev/null && echo "  ✓ play.mjs プロセス停止" || echo "  - play.mjs プロセスなし"

# Playwright ブラウザを停止
pkill -f "Google Chrome for Testing" 2>/dev/null && echo "  ✓ Playwright ブラウザ停止" || echo "  - Playwright ブラウザなし"

# ポート 4000-4004 のプロセスを停止
for port in 4000 4001 4002 4003 4004; do
  PID=$(lsof -ti :$port 2>/dev/null)
  if [ -n "$PID" ]; then
    kill $PID 2>/dev/null
    echo "  ✓ :$port 停止 (PID $PID)"
  fi
done

# PID ファイルをクリア
rm -f "$PROJECT_DIR/benchmark/.race-pids"

echo ""
echo "=== 停止完了 ==="
