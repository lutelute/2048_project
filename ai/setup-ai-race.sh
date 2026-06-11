#!/bin/bash
#
# 2048 AI Challenge — セットアップ (5000番台)
#
# 使い方:
#   ./ai/setup-ai-race.sh
#
# やること:
#   1. runs/{agent}/ai/ ディレクトリを作成
#   2. game-engine.mjs, evaluate.mjs, challenge-prompt.txt を配置
#   3. my-ai.mjs (ベースライン) を配置 (既存があれば保持)
#   4. ai/results/ ディレクトリを作成
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RUNS_DIR="$PROJECT_DIR/runs"

AGENTS=("claude-code" "codex" "gemini" "local-cli")

echo "=== 2048 AI Challenge Setup (5000番台) ==="
echo ""

# runs/ ディレクトリを作成 (なければ)
mkdir -p "$RUNS_DIR"

for NAME in "${AGENTS[@]}"; do
  DIR="$RUNS_DIR/$NAME"
  AI_DIR="$DIR/ai"

  echo "[$NAME]"

  # エージェントディレクトリを作成
  mkdir -p "$AI_DIR"
  mkdir -p "$AI_DIR/results"

  # 共有ファイルをコピー
  cp "$SCRIPT_DIR/game-engine.mjs" "$AI_DIR/game-engine.mjs"
  echo "  game-engine.mjs: コピー済み"

  cp "$SCRIPT_DIR/evaluate.mjs" "$AI_DIR/evaluate.mjs"
  echo "  evaluate.mjs: コピー済み"

  cp "$SCRIPT_DIR/challenge-prompt.txt" "$AI_DIR/challenge-prompt.txt"
  echo "  challenge-prompt.txt: コピー済み"

  # アルゴリズム集をコピー (学習済みRLモデルがあれば一緒に配布して即戦力にする)
  if [ -d "$SCRIPT_DIR/algorithms" ]; then
    mkdir -p "$AI_DIR/algorithms"
    cp "$SCRIPT_DIR/algorithms/"*.mjs "$AI_DIR/algorithms/"
    if [ -f "$SCRIPT_DIR/algorithms/rl-model.bin" ]; then
      cp "$SCRIPT_DIR/algorithms/rl-model.bin" "$AI_DIR/algorithms/"
      echo "  algorithms/ + rl-model.bin(学習済み): コピー済み"
    else
      echo "  algorithms/: コピー済み (rl-model.bin なし — rlは事前学習を推奨)"
    fi
  fi

  # ベースラインAI (常にExpectimax AIを配置して確実に動作させる)
  cp "$SCRIPT_DIR/my-ai.mjs" "$AI_DIR/my-ai.mjs"
  echo "  my-ai.mjs: ベースライン配置 (expectimax AI)"

  echo "  ai/ ready"
  echo ""
done

echo "=== セットアップ完了 ==="
echo ""
echo "レースを開始するには:"
echo "  ./ai/launch-ai-race.sh"
echo ""
echo "各エージェントのAIを手動テスト:"
echo "  node runs/claude-code/ai/evaluate.mjs --games 50"
echo ""
echo "チャレンジプロンプト:"
echo "  cat ai/challenge-prompt.txt"
