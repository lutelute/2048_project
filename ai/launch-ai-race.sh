#!/bin/bash
#
# 2048 AI Challenge — レース起動 (5000番台)
#
# 使い方:
#   ./ai/launch-ai-race.sh              # 全エージェント (200ゲーム, expectimax)
#   ./ai/launch-ai-race.sh 500          # 評価ゲーム数を変更
#   ./ai/launch-ai-race.sh --algo montecarlo       # 全員モンテカルロ
#   ./ai/launch-ai-race.sh --algo all               # 4アルゴリズム対決
#   ./ai/launch-ai-race.sh 100 --algo greedy        # 100ゲーム + greedy
#
# 利用可能なアルゴリズム: random, greedy, montecarlo, expectimax
#
# 動作:
#   1. ダッシュボードサーバー起動 (:5050)
#   2. 各エージェントの evaluate.mjs を並列実行
#   3. ブラウザでダッシュボード表示
#
# ポート割り当て:
#   dashboard:5050  claude-code:5001  codex:5002  gemini:5003  local-cli:5004
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RUNS_DIR="$PROJECT_DIR/runs"
# ── 引数パース ──
EVAL_GAMES="200"
ALGO=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --algo)
      ALGO="$2"
      shift 2
      ;;
    *)
      EVAL_GAMES="$1"
      shift
      ;;
  esac
done

AGENTS=("claude-code" "codex" "gemini" "local-cli")
ALL_ALGOS=("random" "greedy" "montecarlo" "expectimax")
# --algo で指定可能な全アルゴリズム (rl=N-tuple TD強化学習。all割り当ては ALL_ALGOS のみ使用)
VALID_ALGOS=("random" "greedy" "montecarlo" "expectimax" "rl")

# --algo all: 4つのアルゴリズムを4エージェントに割り当て
if [ "$ALGO" = "all" ]; then
  AGENT_ALGOS=("${ALL_ALGOS[@]}")
elif [ -n "$ALGO" ]; then
  AGENT_ALGOS=("$ALGO" "$ALGO" "$ALGO" "$ALGO")
else
  AGENT_ALGOS=("" "" "" "")
fi

echo "=== 2048 AI Challenge Race (5000番台) ==="
echo "  Evaluation games: $EVAL_GAMES"
if [ "$ALGO" = "all" ]; then
  echo "  Algorithm: ALL (random vs greedy vs montecarlo vs expectimax)"
elif [ -n "$ALGO" ]; then
  echo "  Algorithm: $ALGO"
else
  echo "  Algorithm: default (my-ai.mjs)"
fi
echo "  Mode: Headless (no browser needed)"
echo ""

# ── 0. 事前チェック ──

# アルゴリズム名の検証
if [ -n "$ALGO" ] && [ "$ALGO" != "all" ]; then
  VALID=0
  for a in "${VALID_ALGOS[@]}"; do
    [ "$a" = "$ALGO" ] && VALID=1
  done
  if [ "$VALID" -eq 0 ]; then
    echo "ERROR: 不明なアルゴリズム '$ALGO'"
    echo "利用可能: ${VALID_ALGOS[*]}"
    exit 1
  fi
fi

# アルゴリズム使用時はalgorithmsディレクトリを確認
if [ -n "$ALGO" ]; then
  for NAME in "${AGENTS[@]}"; do
    if [ ! -d "$RUNS_DIR/$NAME/ai/algorithms" ]; then
      echo "ERROR: $RUNS_DIR/$NAME/ai/algorithms/ がありません。"
      echo "先に ./ai/setup-ai-race.sh を実行してください。"
      exit 1
    fi
  done
fi

ERRORS=0
for NAME in "${AGENTS[@]}"; do
  if [ ! -f "$RUNS_DIR/$NAME/ai/evaluate.mjs" ]; then
    echo "ERROR: $RUNS_DIR/$NAME/ai/evaluate.mjs がありません。"
    ERRORS=1
  fi
  if [ ! -f "$RUNS_DIR/$NAME/ai/my-ai.mjs" ]; then
    echo "ERROR: $RUNS_DIR/$NAME/ai/my-ai.mjs がありません。"
    ERRORS=1
  fi
done

if [ "$ERRORS" -eq 1 ]; then
  echo ""
  echo "先に ./ai/setup-ai-race.sh を実行してください。"
  exit 1
fi

# ── 1. 既存プロセスを停止 ──
echo "既存プロセスをクリーンアップ..."
pkill -f "evaluate.mjs" 2>/dev/null || true
lsof -ti :5050 2>/dev/null | xargs kill 2>/dev/null || true
sleep 1

# ── 1.5. 過去の結果をクリア（ダッシュボードを0からスタート）──
echo "過去の結果をクリア..."
for NAME in "${AGENTS[@]}"; do
  RESULTS_DIR="$RUNS_DIR/$NAME/ai/results"
  if [ -d "$RESULTS_DIR" ]; then
    rm -rf "$RESULTS_DIR"/run-* "$RESULTS_DIR"/progress.log "$RESULTS_DIR"/progress.jsonl "$RESULTS_DIR"/stdout.log 2>/dev/null || true
  fi
done

# ── 2. ダッシュボードサーバー起動 ──
echo "ダッシュボード起動中..."
node "$SCRIPT_DIR/dashboard-ai-server.mjs" > /dev/null 2>&1 &
DASHBOARD_PID=$!
sleep 1

if lsof -nP -i :5050 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "  ダッシュボード :5050"
else
  echo "  ダッシュボード :5050 FAILED"
  exit 1
fi

# ── 3. 評価開始 (ランごとに別フォルダ) ──
RUN_ID=$(date +%Y-%m-%d_%H-%M-%S)
echo ""
echo "評価開始 ($EVAL_GAMES ゲーム, run-$RUN_ID)..."
PIDS=()
for i in "${!AGENTS[@]}"; do
  NAME="${AGENTS[$i]}"
  AGENT_ALGO="${AGENT_ALGOS[$i]}"
  AI_DIR="$RUNS_DIR/$NAME/ai"
  mkdir -p "$AI_DIR/results/run-$RUN_ID"

  ALGO_LABEL=""
  ALGO_ENV=""
  if [ -n "$AGENT_ALGO" ]; then
    ALGO_ENV="ALGO=$AGENT_ALGO"
    ALGO_LABEL=" ($AGENT_ALGO)"
  fi

  env RUN_ID="$RUN_ID" TOTAL_GAMES="$EVAL_GAMES" GAME_DELAY_MS="${GAME_DELAY_MS:-0}" $ALGO_ENV node "$AI_DIR/evaluate.mjs" \
    > "$AI_DIR/results/run-$RUN_ID/stdout.log" 2>&1 &
  PID=$!
  PIDS+=("$PID")
  echo "  $NAME$ALGO_LABEL -> PID $PID"
done

# ── 4. ブラウザでダッシュボード表示 ──
sleep 2
open "http://localhost:5050" 2>/dev/null || xdg-open "http://localhost:5050" 2>/dev/null || true

echo ""
echo "=== 評価稼働中 ==="
echo ""
echo "  Dashboard : http://localhost:5050"
echo "  停止      : ./ai/stop-ai-race.sh"
echo "  監視      : tail -f runs/*/ai/results/progress.log"
echo ""

# PID ファイルに保存 (stop 用)
echo "${PIDS[*]} $DASHBOARD_PID" > "$SCRIPT_DIR/.ai-race-pids"
