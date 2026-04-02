#!/bin/bash
#
# 2048 AI Benchmark — マルチエージェント一括セットアップ
#
# 使い方:
#   ./benchmark/setup-race.sh
#
# 各エージェント用のディレクトリを作成し、npm install を実行する。
# ポートは固定:
#   claude-code :4001  |  codex :4002  |  gemini :4003  |  local-cli :4004
#

set -e

REPO_URL="https://github.com/lutelute/2048_project.git"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RUNS_DIR="$PROJECT_DIR/runs"

# エージェント定義: name|port
AGENTS=(
  "claude-code|4001"
  "codex|4002"
  "gemini|4003"
  "local-cli|4004"
)

echo "=== 2048 AI Benchmark Setup ==="
echo "Project: $PROJECT_DIR"
echo ""

mkdir -p "$RUNS_DIR"

for entry in "${AGENTS[@]}"; do
  IFS='|' read -r NAME PORT <<< "$entry"
  DIR="$RUNS_DIR/$NAME"

  echo "[$NAME] port=$PORT"

  # Clone if needed
  if [ -d "$DIR" ]; then
    echo "  Already exists, skipping clone."
  else
    echo "  Cloning..."
    git clone "$REPO_URL" "$DIR"
  fi

  # Ensure results dir exists
  mkdir -p "$DIR/benchmark/results"

  # npm install if needed
  if [ ! -d "$DIR/node_modules" ]; then
    echo "  Running npm install..."
    (cd "$DIR" && npm install --silent)
  fi

  # Patch vite.config.ts to use fixed port
  VITE="$DIR/vite.config.ts"
  if ! grep -q "port:" "$VITE" 2>/dev/null; then
    echo "  Setting vite port to $PORT..."
    sed -i '' "s|base: '/2048_project/'|base: '/2048_project/',\n  server: { port: $PORT, strictPort: true }|" "$VITE"
  fi

  echo ""
done

echo "=== Setup Complete ==="
echo ""
echo "ポート割り当て:"
echo "  claude-code  → http://localhost:4001/2048_project/"
echo "  codex        → http://localhost:4002/2048_project/"
echo "  gemini       → http://localhost:4003/2048_project/"
echo "  local-cli    → http://localhost:4004/2048_project/"
echo ""
echo "ダッシュボード起動:"
echo "  node benchmark/dashboard-server.mjs"
echo "  → http://localhost:4000"
echo ""
echo "一括起動:"
echo "  ./benchmark/launch-race.sh"
