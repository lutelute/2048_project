#!/bin/bash
#
# 2048 AI Benchmark — レース起動
#
# 使い方:
#   ./benchmark/launch-race.sh          # 全エージェント (100ゲーム)
#   ./benchmark/launch-race.sh 50       # 全エージェント (50ゲーム)
#   AGENTS="claude-code codex" ./benchmark/launch-race.sh  # 指定エージェントのみ
#   NO_OPEN=1 ./benchmark/launch-race.sh 1  # ブラウザでダッシュボードを開かない (テスト用)
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

# ── ポートユーティリティ ──
# lsof は環境状態 (SMBマウントやFDの多いプロセス) によって数十秒かかるため使わない。
# LISTEN判定は nc の接続試行 (vite preview は ::1 のみで待つので IPv4/IPv6 両対応の localhost 解決が必須。
# bash3.2 の /dev/tcp は IPv6 不可)。PID取得の lsof は3秒で諦める保険に留める
port_listening() { nc -z localhost "$1" >/dev/null 2>&1; }
port_pids() { perl -e 'alarm 3; exec @ARGV' -- lsof -ti ":$1" 2>/dev/null || true; }

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
pkill -f race-2048-agent 2>/dev/null || true        # play.mjs起動ブラウザ (マーカーで絞る)
pkill -f "vite preview --port 40" 2>/dev/null || true
pkill -f "vite --port 40" 2>/dev/null || true       # 旧dev方式の残骸
pkill -f "npm exec vite" 2>/dev/null || true        # 詰まったnpx解決の残骸
for port in 4000 4001 4002 4003 4004; do
  port_pids "$port" | xargs kill 2>/dev/null || true
done
# ポート解放をポーリング (固定sleepより速く・確実)
DEADLINE=$((SECONDS + 10))
for port in 4000 4001 4002 4003 4004; do
  while port_listening "$port" && [ "$SECONDS" -lt "$DEADLINE" ]; do
    sleep 0.2
  done
done

# ── 2. アプリ配信サーバー起動 (vite preview: ビルド済みdistの静的配信。devより軽量・高速) ──
mkdir -p "$PROJECT_DIR/logs"
echo "アプリをビルド中..."
(cd "$PROJECT_DIR" && npm run build > "$PROJECT_DIR/logs/build.log" 2>&1) || {
  echo "ERROR: ビルドに失敗しました。logs/build.log を確認してください。"
  exit 1
}

echo "配信サーバー起動中 (vite preview)..."
for NAME in "${AGENT_LIST[@]}"; do
  PORT=$(get_port "$NAME")
  # npx は npmの解決レイヤーで遅延・ロック競合するため使わない (バイナリ直接実行)
  ("$PROJECT_DIR/node_modules/.bin/vite" preview --port "$PORT" --strictPort \
    > "$PROJECT_DIR/logs/vite-$PORT.log" 2>&1 &)
  echo "  $NAME → :$PORT"
done

# 起動確認 (全ポートLISTENまでポーリング。通常2秒、高負荷マシンでも粘れるよう上限60秒)
DEADLINE=$((SECONDS + 60))
for NAME in "${AGENT_LIST[@]}"; do
  PORT=$(get_port "$NAME")
  until port_listening "$PORT"; do
    if [ "$SECONDS" -ge "$DEADLINE" ]; then
      echo "  ✗ $NAME :$PORT FAILED (logs/vite-$PORT.log を確認)"
      exit 1
    fi
    sleep 0.2
  done
  echo "  ✓ $NAME :$PORT"
done

# ── 3. ダッシュボードサーバー起動 ──
echo ""
echo "ダッシュボード起動中..."
node "$PROJECT_DIR/benchmark/dashboard-server.mjs" > "$PROJECT_DIR/logs/dashboard-4000.log" 2>&1 &
DASHBOARD_PID=$!
DEADLINE=$((SECONDS + 30))
until port_listening 4000; do
  if [ "$SECONDS" -ge "$DEADLINE" ]; then
    echo "  ✗ ダッシュボード :4000 FAILED (logs/dashboard-4000.log を確認)"
    exit 1
  fi
  sleep 0.2
done
echo "  ✓ ダッシュボード :4000"

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

# ── 5. ブラウザでダッシュボード表示 (NO_OPEN=1 でスキップ) ──
if [ -z "$NO_OPEN" ]; then
  open "http://localhost:4000" 2>/dev/null || true
fi

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
