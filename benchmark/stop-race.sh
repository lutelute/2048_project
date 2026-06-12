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

# レースのブラウザを停止 (play.mjs がlaunch時に付けるマーカーで絞る。検証用・人間用ブラウザは触らない)
pkill -f race-2048-agent 2>/dev/null && echo "  ✓ レースブラウザ停止" || echo "  - レースブラウザなし"

# 配信サーバー (vite preview) と残骸を停止
pkill -f "vite preview --port 40" 2>/dev/null && echo "  ✓ vite preview 停止" || true
pkill -f "vite --port 40" 2>/dev/null || true
pkill -f "npm exec vite" 2>/dev/null || true

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
