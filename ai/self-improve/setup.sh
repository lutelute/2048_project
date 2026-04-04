#!/bin/bash
#
# 2048 AI Self-Improve Challenge — セットアップ (6000番台)
#
# 使い方:
#   ./ai/self-improve/setup.sh
#
# やること:
#   1. runs/{agent}/ai/ に game-engine, evaluate, challenge-prompt を配置
#   2. my-ai.mjs をランダムベースラインにリセット (既存は上書き)
#   3. 結果ディレクトリをクリア
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AI_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(dirname "$AI_DIR")"
RUNS_DIR="$PROJECT_DIR/runs"

AGENTS=("claude-code" "codex" "gemini" "local-cli")

echo "=== 2048 AI Self-Improve Setup (6000番台) ==="
echo ""

# runs/ の存在確認
if [ ! -d "$RUNS_DIR" ]; then
  echo "ERROR: runs/ がありません。先に ./benchmark/setup-race.sh を実行してください。"
  exit 1
fi

# ランダムベースライン (全エージェント共通の出発点)
BASELINE='/**
 * Baseline AI — Random moves (replace this!)
 *
 * Your goal: iteratively improve this to reach 2048.
 */
import { DIRECTIONS } from "./game-engine.mjs";

export default function chooseMove(board, score, game) {
  const valid = game.getValidMoves();
  if (valid.length === 0) return null;
  return valid[Math.floor(Math.random() * valid.length)];
}
'

for NAME in "${AGENTS[@]}"; do
  DIR="$RUNS_DIR/$NAME/ai"
  echo "[$NAME]"

  mkdir -p "$DIR/results"

  # 共有ファイルをコピー
  cp "$AI_DIR/game-engine.mjs" "$DIR/game-engine.mjs"
  cp "$AI_DIR/evaluate.mjs" "$DIR/evaluate.mjs"
  cp "$SCRIPT_DIR/challenge-prompt.txt" "$DIR/challenge-prompt.txt"
  echo "  game-engine.mjs, evaluate.mjs, challenge-prompt.txt: コピー済み"

  # ランダムベースラインで上書き (6000番台は全員ゼロスタート)
  echo "$BASELINE" > "$DIR/my-ai.mjs"
  echo "  my-ai.mjs: ランダムベースラインにリセット"

  # 結果クリア (run-* ディレクトリ含む)
  rm -rf "$DIR/results"/run-* "$DIR/results"/progress.log "$DIR/results"/progress.jsonl "$DIR/results"/stdout.log 2>/dev/null || true
  echo "  results/: クリア済み"

  echo ""
done

echo "=== セットアップ完了 ==="
echo ""
echo "レースを開始するには:"
echo "  ./ai/self-improve/launch.sh"
echo ""
echo "注意: 6000番台は各AI CLIが自分でコードを書いて改善します。"
echo "      ターミナルウィンドウが開きます。"
