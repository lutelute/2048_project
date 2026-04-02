#!/bin/bash
#
# 2048 AI Benchmark — 全エージェント + ダッシュボード一括起動
#
# 使い方:
#   ./benchmark/launch-race.sh
#
# 前提:
#   ./benchmark/setup-race.sh を先に実行済みであること
#
# 動作:
#   1. 既存プロセスを停止
#   2. 全devサーバーをバックグラウンド起動 (ポート固定)
#   3. ダッシュボードサーバーを起動 (port 4000)
#   4. 各エージェント用ターミナルを開いてAI CLIを起動
#   5. ブラウザでダッシュボードを表示
#
# ポート割り当て:
#   claude-code :4001  |  codex :4002  |  gemini :4003  |  local-cli :4004
#   dashboard   :4000
#

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNS_DIR="$PROJECT_DIR/runs"

# エージェント定義: name|port|cli_command|flags
AGENTS=(
  "claude-code|4001|claude|--dangerously-skip-permissions"
  "codex|4002|codex|--full-auto"
  "gemini|4003|gemini|-y -i"
  "local-cli|4004|local-cli|"
)

echo "=== 2048 AI Benchmark Launcher ==="
echo "Project: $PROJECT_DIR"
echo ""

# セットアップ確認
for entry in "${AGENTS[@]}"; do
  IFS='|' read -r NAME PORT CLI FLAGS <<< "$entry"
  if [ ! -d "$RUNS_DIR/$NAME" ]; then
    echo "ERROR: $RUNS_DIR/$NAME が存在しません。先に setup-race.sh を実行してください。"
    exit 1
  fi
done

# 0. 既存プロセスを停止
echo "Cleaning up existing processes..."
for port in 4000 4001 4002 4003 4004; do
  lsof -ti :$port 2>/dev/null | xargs kill 2>/dev/null || true
done
sleep 1

# 1. 前回の結果をクリア
echo "Clearing previous results..."
for entry in "${AGENTS[@]}"; do
  IFS='|' read -r NAME PORT CLI FLAGS <<< "$entry"
  rm -f "$RUNS_DIR/$NAME/benchmark/results/progress.log" "$RUNS_DIR/$NAME/benchmark/results/final.png"
  mkdir -p "$RUNS_DIR/$NAME/benchmark/results"
done

# 2. 全devサーバーをバックグラウンド起動
echo "Starting dev servers..."
for entry in "${AGENTS[@]}"; do
  IFS='|' read -r NAME PORT CLI FLAGS <<< "$entry"
  (cd "$RUNS_DIR/$NAME" && npx vite --port "$PORT" --strictPort > /dev/null 2>&1 &)
  echo "  $NAME → :$PORT"
done

# devサーバーの起動を待つ
echo "Waiting for dev servers..."
sleep 4

# 起動確認
ALL_UP=true
for entry in "${AGENTS[@]}"; do
  IFS='|' read -r NAME PORT CLI FLAGS <<< "$entry"
  if lsof -nP -i ":$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "  ✓ $NAME :$PORT"
  else
    echo "  ✗ $NAME :$PORT FAILED"
    ALL_UP=false
  fi
done

if [ "$ALL_UP" = false ]; then
  echo "ERROR: 一部のdevサーバーが起動できませんでした。"
  exit 1
fi

# 3. ダッシュボードサーバー起動
echo ""
echo "Starting dashboard server..."
osascript <<EOF
tell application "Terminal"
  activate
  do script "cd '$PROJECT_DIR' && node benchmark/dashboard-server.mjs"
  set custom title of front window to "2048-dashboard"
end tell
EOF
sleep 1

# 4. 各エージェントのターミナルを起動
# プロンプト: devサーバーは起動済み。play.mjs を実行するだけ。
for entry in "${AGENTS[@]}"; do
  IFS='|' read -r NAME PORT CLI FLAGS <<< "$entry"
  DIR="$RUNS_DIR/$NAME"

  PROMPT="The 2048 game dev server is already running at http://localhost:${PORT}/2048_project/ — do NOT run npm run dev. A Playwright-based play script is ready at benchmark/play.mjs. Your task: (1) run 'node benchmark/play.mjs' to play the game automatically. That is the ONLY thing you need to do. Do NOT modify any files. Do NOT start a dev server. Just run the script. Start now."

  CMD="cd '$DIR' && $CLI $FLAGS '$PROMPT'"
  echo "Launching: $NAME ($CLI)"

  osascript <<EOF
tell application "Terminal"
  activate
  do script "$CMD"
  set custom title of front window to "2048-$NAME"
end tell
EOF
  sleep 1
done

# 5. ダッシュボードをブラウザで開く
sleep 2
open "http://localhost:4000"

echo ""
echo "=== 全ターミナル起動完了 ==="
echo ""
echo "  Dashboard : http://localhost:4000"
echo "  claude-code : http://localhost:4001/2048_project/"
echo "  codex       : http://localhost:4002/2048_project/"
echo "  gemini      : http://localhost:4003/2048_project/"
echo "  local-cli   : http://localhost:4004/2048_project/"
echo ""
echo "devサーバーは事前起動済み。各エージェントは play.mjs を実行するだけです。"
echo "ダッシュボードでリアルタイム進捗を確認できます。"
