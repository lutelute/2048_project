#!/bin/bash
#
# 2048 AI Race — デモモード (4000番台)
#
# プリセットAI (play-2048.mjs) で各エージェントが自動プレイ。
# エージェントが正常に動作するか確認するためのモード。
#
# 使い方:
#   ./benchmark/race-demo.sh              # 全エージェント
#   ./benchmark/race-demo.sh claude       # claude-code のみ
#   ./benchmark/race-demo.sh codex        # codex のみ
#   ./benchmark/race-demo.sh gemini       # gemini のみ
#
# ポート: claude-code:4001  codex:4002  gemini:4003  dashboard:4000
#

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNS_DIR="$PROJECT_DIR/runs"

# 引数でエージェントを選択（デフォルト: 全部）
FILTER="${1:-all}"

declare -A AGENT_PORT
declare -A AGENT_CLI
declare -A AGENT_FLAGS

AGENT_PORT[claude-code]=4001
AGENT_PORT[codex]=4002
AGENT_PORT[gemini]=4003

AGENT_CLI[claude-code]="claude"
AGENT_CLI[codex]="codex"
AGENT_CLI[gemini]="gemini"

AGENT_FLAGS[claude-code]="--dangerously-skip-permissions"
AGENT_FLAGS[codex]="--full-auto"
AGENT_FLAGS[gemini]="-y"

AGENT_LIST=()
case "$FILTER" in
  claude) AGENT_LIST=(claude-code) ;;
  codex)  AGENT_LIST=(codex) ;;
  gemini) AGENT_LIST=(gemini) ;;
  all)    AGENT_LIST=(claude-code codex gemini) ;;
  *)      echo "Usage: $0 [claude|codex|gemini|all]"; exit 1 ;;
esac

echo "=== 2048 AI Race — Demo Mode (4000番台) ==="
echo "Agents: ${AGENT_LIST[*]}"
echo ""

# セットアップ確認
for NAME in "${AGENT_LIST[@]}"; do
  if [ ! -d "$RUNS_DIR/$NAME" ]; then
    echo "ERROR: $RUNS_DIR/$NAME が存在しません。先に setup-race.sh を実行してください。"
    exit 1
  fi
done

# 既存プロセスを停止
echo "Cleaning up..."
for port in 4000 4001 4002 4003; do
  lsof -ti :$port 2>/dev/null | xargs kill 2>/dev/null || true
done
sleep 1

# 結果クリア
for NAME in "${AGENT_LIST[@]}"; do
  rm -f "$RUNS_DIR/$NAME/benchmark/results/progress.log"
  mkdir -p "$RUNS_DIR/$NAME/benchmark/results"
done

# devサーバー起動
echo "Starting dev servers..."
for NAME in "${AGENT_LIST[@]}"; do
  PORT="${AGENT_PORT[$NAME]}"
  (cd "$RUNS_DIR/$NAME" && npx vite --port "$PORT" --strictPort > /dev/null 2>&1 &)
  echo "  $NAME → :$PORT"
done
sleep 4

# 起動確認
for NAME in "${AGENT_LIST[@]}"; do
  PORT="${AGENT_PORT[$NAME]}"
  if lsof -nP -i ":$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "  ✓ $NAME :$PORT"
  else
    echo "  ✗ $NAME :$PORT FAILED"
    exit 1
  fi
done

# ダッシュボード起動
echo ""
echo "Starting dashboard..."
osascript -e "
tell application \"Terminal\"
  activate
  do script \"cd '$PROJECT_DIR' && node benchmark/dashboard-server.mjs\"
end tell
" 2>/dev/null
sleep 1

# 各エージェントのターミナル起動
PROMPT_TEMPLATE='The dev server is running at http://localhost:__PORT__/2048_project/ — do NOT start another server. Run this command: node benchmark/play-2048.mjs — that is the ONLY thing you need to do. Do NOT modify files. Start now.'

for NAME in "${AGENT_LIST[@]}"; do
  PORT="${AGENT_PORT[$NAME]}"
  CLI="${AGENT_CLI[$NAME]}"
  FLAGS="${AGENT_FLAGS[$NAME]}"
  DIR="$RUNS_DIR/$NAME"
  PROMPT="${PROMPT_TEMPLATE//__PORT__/$PORT}"

  echo "Launching: $NAME ($CLI)"

  case "$CLI" in
    claude)
      osascript -e "
tell application \"Terminal\"
  activate
  do script \"cd '$DIR' && claude $FLAGS '$PROMPT'\"
end tell
" 2>/dev/null
      ;;
    codex)
      # codex: prompt as positional argument
      osascript -e "
tell application \"Terminal\"
  activate
  do script \"cd '$DIR' && codex $FLAGS \\\"$PROMPT\\\"\"
end tell
" 2>/dev/null
      ;;
    gemini)
      # gemini: -p for non-interactive prompt execution
      osascript -e "
tell application \"Terminal\"
  activate
  do script \"cd '$DIR' && gemini $FLAGS \\\"$PROMPT\\\"\"
end tell
" 2>/dev/null
      ;;
  esac
  sleep 1
done

# ダッシュボードを開く
sleep 2
open "http://localhost:4000"

echo ""
echo "=== 起動完了 ==="
echo "  Dashboard: http://localhost:4000"
for NAME in "${AGENT_LIST[@]}"; do
  echo "  $NAME: http://localhost:${AGENT_PORT[$NAME]}/2048_project/"
done
echo ""
echo "各ターミナルでプレイ状況を確認できます。"
