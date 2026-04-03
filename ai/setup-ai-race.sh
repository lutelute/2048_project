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

  # ベースラインAI (既にmy-ai.mjsがあれば上書きしない)
  if [ ! -f "$AI_DIR/my-ai.mjs" ]; then
    cp "$SCRIPT_DIR/my-ai.mjs" "$AI_DIR/my-ai.mjs"
    echo "  my-ai.mjs: ベースライン配置 (expectimax AI)"
  else
    echo "  my-ai.mjs: 既存のAIを保持"
  fi

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
