#!/bin/bash
#
# 2048 AI Benchmark — レース起動
#
# 使い方:
#   ./benchmark/launch-race.sh          # 全エージェント (100ゲーム)
#   ./benchmark/launch-race.sh 50       # 全エージェント (50ゲーム)
#   AGENTS="claude-code codex" ./benchmark/launch-race.sh  # 指定エージェントのみ
#
# 前提:
#   ./benchmark/setup-race.sh を先に実行済みであること
#
# ポート割り当て:
#   dashboard:4000  claude-code:4001  codex:4002  gemini:4003  local-cli:4004
#

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNS_DIR="$PROJECT_DIR/runs"
TOTAL_GAMES="${1:-100}"

# エージェント定義: name|port
AGENTS_DEF=(
  "claude-code|4001"
  "codex|4002"
  "gemini|4003"
  "local-cli|4004"
)

# ポート取得関数
get_port() {
  for entry in "${AGENTS_DEF[@]}"; do
    IFS='|' read -r N P <<< "$entry"
    if [ "$N" = "$1" ]; then echo "$P"; return; fi
  done
}

# 起動するエージェント
AGENT_LIST=(claude-code codex gemini local-cli)

echo "=== 2048 AI Benchmark Race ==="
echo "  Games: $TOTAL_GAMES"
echo "  Agents: ${AGENT_LIST[*]}"
echo ""

# ── 0. 事前チェック ──
ERRORS=0

# メイン node_modules
if [ ! -d "$PROJECT_DIR/node_modules/vite" ]; then
  echo "ERROR: node_modules/vite がありません。npm install を実行してください。"
  ERRORS=1
fi

# Playwright ブラウザ
PW_CACHE="$HOME/Library/Caches/ms-playwright"
CHROMIUM_DIR=$(ls -d "$PW_CACHE"/chromium-*/chrome-mac-arm64 2>/dev/null | tail -1)
if [ -z "$CHROMIUM_DIR" ] || ! ls "$CHROMIUM_DIR"/*.app >/dev/null 2>&1; then
  echo "ERROR: Playwright Chromium が未インストールです。npx playwright install chromium を実行してください。"
  ERRORS=1
fi

# runs ディレクトリ
for NAME in "${AGENT_LIST[@]}"; do
  if [ ! -f "$RUNS_DIR/$NAME/benchmark/play.mjs" ]; then
    echo "ERROR: $RUNS_DIR/$NAME/benchmark/play.mjs がありません。setup-race.sh を実行してください。"
    ERRORS=1
  fi
  # node_modules シンボリックリンク確認・自動修復
  if [ ! -L "$RUNS_DIR/$NAME/node_modules" ]; then
    echo "  $NAME: node_modules をシンボリックリンクに修復..."
    # mv は rm -rf より高速 (バックグラウンドで削除)
    mv "$RUNS_DIR/$NAME/node_modules" "$RUNS_DIR/$NAME/node_modules_old_$$" 2>/dev/null || true
    rm -rf "$RUNS_DIR/$NAME/node_modules_old_$$" &
    ln -s "$PROJECT_DIR/node_modules" "$RUNS_DIR/$NAME/node_modules"
  fi
done

if [ "$ERRORS" -eq 1 ]; then
  echo ""
  echo "エラーがあります。先に ./benchmark/setup-race.sh を実行してください。"
  exit 1
fi

# ── 1. 既存プロセスを停止 ──
echo "既存プロセスをクリーンアップ..."
pkill -f "play.mjs" 2>/dev/null || true
pkill -f "Google Chrome for Testing" 2>/dev/null || true
for port in 4000 4001 4002 4003 4004; do
  lsof -ti :$port 2>/dev/null | xargs kill 2>/dev/null || true
done
sleep 2

# ── 2. dev サーバー起動 (メインプロジェクトから) ──
echo "dev サーバー起動中..."
for NAME in "${AGENT_LIST[@]}"; do
  PORT=$(get_port "$NAME")
  (cd "$PROJECT_DIR" && npx vite --port "$PORT" --strictPort > /dev/null 2>&1 &)
  echo "  $NAME → :$PORT"
done
sleep 4

# 起動確認
ALL_UP=true
for NAME in "${AGENT_LIST[@]}"; do
  PORT=$(get_port "$NAME")
  if lsof -nP -i ":$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "  ✓ $NAME :$PORT"
  else
    echo "  ✗ $NAME :$PORT FAILED"
    ALL_UP=false
  fi
done

if [ "$ALL_UP" = false ]; then
  echo "ERROR: dev サーバーの起動に失敗しました。"
  exit 1
fi

# ── 3. ダッシュボードサーバー起動 ──
echo ""
echo "ダッシュボード起動中..."
node "$PROJECT_DIR/benchmark/dashboard-server.mjs" > /dev/null 2>&1 &
DASHBOARD_PID=$!
sleep 1
if lsof -nP -i :4000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "  ✓ ダッシュボード :4000"
else
  echo "  ✗ ダッシュボード :4000 FAILED"
  exit 1
fi

# ── 4. 結果クリア & エージェント起動 ──
echo ""
echo "レース開始 ($TOTAL_GAMES ゲーム)..."
PIDS=()
for NAME in "${AGENT_LIST[@]}"; do
  rm -f "$RUNS_DIR/$NAME/benchmark/results/progress.log"
  rm -f "$RUNS_DIR/$NAME/benchmark/results/final.png"
  mkdir -p "$RUNS_DIR/$NAME/benchmark/results"

  TOTAL_GAMES="$TOTAL_GAMES" node "$RUNS_DIR/$NAME/benchmark/play.mjs" \
    > "$RUNS_DIR/$NAME/benchmark/results/stdout.log" 2>&1 &
  PID=$!
  PIDS+=("$PID")
  echo "  $NAME → PID $PID"
done

# ── 5. ブラウザでダッシュボード表示 ──
sleep 2
open "http://localhost:4000"

echo ""
echo "=== レース稼働中 ==="
echo ""
echo "  Dashboard : http://localhost:4000"
for NAME in "${AGENT_LIST[@]}"; do
  echo "  $NAME    : http://localhost:$(get_port "$NAME")/2048_project/"
done
echo ""
echo "  停止: ./benchmark/stop-race.sh"
echo "  監視: tail -f runs/*/benchmark/results/progress.log"
echo ""

# PID ファイルに保存 (stop-race.sh 用)
echo "${PIDS[*]} $DASHBOARD_PID" > "$PROJECT_DIR/benchmark/.race-pids"
