#!/bin/bash
#
# 2048 AI Self-Improve Challenge — 停止 (6000番台)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"

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

# 6000番台 Self-Improve プロセスを停止
KILLED=0

# パターン1: claude/codex/gemini — プロンプト文字列が引数に含まれる
for PID in $(ps aux | grep "Self-Improvement Challenge" | grep -v grep | awk '{print $2}'); do
  kill "$PID" 2>/dev/null && KILLED=$((KILLED + 1))
done

# パターン2: .run-self-improve.sh ランナースクリプト + 子プロセス
for PID in $(ps aux | grep "\.run-self-improve\.sh" | grep -v grep | awk '{print $2}'); do
  kill "$PID" 2>/dev/null && KILLED=$((KILLED + 1))
done

# パターン3: runs/ 配下から起動された local-cli (対話REPL、引数にプロンプトが出ない)
for PIDFILE in "$PROJECT_DIR"/runs/*/ai/.local-cli.pid; do
  if [ -f "$PIDFILE" ]; then
    PID=$(cat "$PIDFILE")
    kill "$PID" 2>/dev/null && KILLED=$((KILLED + 1))
    rm -f "$PIDFILE"
  fi
done

# SIGTERM で残ったプロセスを強制停止
sleep 1
for PID in $(ps aux | grep -E "Self-Improvement Challenge|\.run-self-improve\.sh" | grep -v grep | awk '{print $2}'); do
  kill -9 "$PID" 2>/dev/null
done

if [ "$KILLED" -gt 0 ]; then
  echo "  ✓ AI CLIプロセス ${KILLED}個 停止"
else
  echo "  - AI CLIプロセスなし"
fi

echo ""
echo "=== 停止完了 ==="
