#!/bin/bash
#
# 2048 AI Self-Improve Challenge — レース起動 (6000番台)
#
# 使い方:
#   ./ai/self-improve/launch.sh
#
# 動作:
#   1. 結果をクリア (全員0からスタート)
#   2. ダッシュボードサーバー起動 (:6050)
#   3. 各AI CLIを別ターミナルで起動 (自己改善プロンプト付き)
#   4. ブラウザでダッシュボード表示
#
# オーケストレーター (このスクリプトを実行するClaude) の役割:
#   - ダッシュボードを監視し、動いていないエージェントに介入
#   - 入力が止まっているエージェントにプロンプトを再投入
#   - 実際のAI改善は行わない (各エージェント自身の仕事)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AI_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(dirname "$AI_DIR")"
RUNS_DIR="$PROJECT_DIR/runs"

# エージェント定義: name|cli|flags
# local-cli: https://github.com/lutelute/local-cli
AGENTS=(
  "claude-code|claude|--dangerously-skip-permissions"
  "codex|codex|--full-auto"
  "gemini|gemini|"
  "local-cli|local-cli|"
)

echo "=== 2048 AI Self-Improve Race (6000番台) ==="
echo ""

# ── 0. 事前チェック ──
AVAILABLE_AGENTS=()
for entry in "${AGENTS[@]}"; do
  IFS='|' read -r NAME CLI FLAGS <<< "$entry"
  if [ ! -f "$RUNS_DIR/$NAME/ai/my-ai.mjs" ]; then
    echo "ERROR: $RUNS_DIR/$NAME/ai/my-ai.mjs がありません。"
    echo "先に ./ai/self-improve/setup.sh を実行してください。"
    exit 1
  fi
  if command -v "$CLI" &>/dev/null && "$CLI" --version &>/dev/null; then
    AVAILABLE_AGENTS+=("$entry")
    echo "  ✓ $NAME ($CLI)"
  else
    echo "  ✗ $NAME: $CLI not available — skipped"
  fi
done

if [ ${#AVAILABLE_AGENTS[@]} -eq 0 ]; then
  echo "ERROR: 利用可能なAI CLIがありません。"
  exit 1
fi

echo ""

# ── 1. 既存プロセスを停止 ──
echo "既存プロセスをクリーンアップ..."
lsof -ti :6050 2>/dev/null | xargs kill 2>/dev/null || true
sleep 1

# ── 2. 結果クリア (全員0からスタート) ──
echo "結果をクリア..."
for entry in "${AGENTS[@]}"; do
  IFS='|' read -r NAME CLI FLAGS <<< "$entry"
  RESULTS_DIR="$RUNS_DIR/$NAME/ai/results"
  if [ -d "$RESULTS_DIR" ]; then
    rm -rf "$RESULTS_DIR"/run-* "$RESULTS_DIR"/progress.log "$RESULTS_DIR"/progress.jsonl "$RESULTS_DIR"/stdout.log 2>/dev/null || true
  fi
  mkdir -p "$RESULTS_DIR"
done

# ── 3. ダッシュボードサーバー起動 ──
echo "ダッシュボード起動中..."
PORT=6050 node "$AI_DIR/dashboard-ai-server.mjs" > /dev/null 2>&1 &
DASHBOARD_PID=$!
sleep 1

if lsof -nP -i :6050 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "  ✓ ダッシュボード :6050"
else
  echo "  ✗ ダッシュボード :6050 FAILED"
  exit 1
fi

# ── 4. 各AI CLIをターミナルで起動 ──
echo ""
echo "AI CLIを起動中..."

ONELINER="You are in a 2048 AI Self-Improvement Challenge. Read ai/challenge-prompt.txt for full instructions. Your mission: build a 2048 AI that achieves 100 percent win rate. You are fully autonomous — decide what to build, iterate, and do not stop until every game reaches 2048. Steps: (1) Read ai/game-engine.mjs for the API, (2) Create/improve ai/my-ai.mjs, (3) Run: node ai/evaluate.mjs --games 50, (4) Read results and improve, (5) Repeat 3-5 until 100 percent win rate. Reference algorithms in ai/algorithms/. Use all compute you can — deeper search, adaptive depth, precomputation. Start now."

for entry in "${AVAILABLE_AGENTS[@]}"; do
  IFS='|' read -r NAME CLI FLAGS <<< "$entry"
  DIR="$RUNS_DIR/$NAME"

  # 起動スクリプトを生成
  RUNNER="$DIR/.run-self-improve.sh"
  cat > "$RUNNER" << RUNEOF
#!/bin/bash
cd "$DIR"
RUNEOF

  case "$CLI" in
    claude)
      echo "exec claude $FLAGS \"$ONELINER\"" >> "$RUNNER"
      ;;
    codex)
      echo "exec codex $FLAGS \"$ONELINER\"" >> "$RUNNER"
      ;;
    gemini)
      echo "exec gemini -y -i \"$ONELINER\"" >> "$RUNNER"
      ;;
    local-cli)
      # local-cli is an interactive REPL; record PID for stop.sh, prompt pasted via osascript
      cat >> "$RUNNER" << 'LCEOF'
local-cli &
echo $! > ai/.local-cli.pid
wait
LCEOF
      ;;
    *)
      echo "exec $CLI $FLAGS \"$ONELINER\"" >> "$RUNNER"
      ;;
  esac
  chmod +x "$RUNNER"

  echo "  $NAME ($CLI)"

  if [ "$CLI" = "local-cli" ]; then
    # local-cli is an interactive REPL — launch, wait for startup, then paste the prompt
    osascript <<OSEOF
tell application "Terminal"
  activate
  do script "bash '$RUNNER'"
  set custom title of front window to "6000-$NAME"
end tell
OSEOF
    sleep 5
    # Save prompt to clipboard and paste into the Terminal
    echo -n "$ONELINER" | pbcopy
    osascript <<OSEOF
tell application "Terminal"
  activate
end tell
tell application "System Events"
  keystroke "v" using command down
  delay 0.3
  key code 36 -- press Return
end tell
OSEOF
  else
    osascript <<OSEOF
tell application "Terminal"
  activate
  do script "bash '$RUNNER'"
  set custom title of front window to "6000-$NAME"
end tell
OSEOF
  fi
  sleep 2
done

# ── 5. ブラウザでダッシュボード表示 ──
sleep 2
open "http://localhost:6050" 2>/dev/null || true

echo ""
echo "=== レース開始 ==="
echo ""
echo "  Dashboard : http://localhost:6050"
echo "  停止      : ./ai/self-improve/stop.sh"
echo ""
echo "  各ターミナルでAIが自分でコードを書いて改善しています。"
echo "  ダッシュボードでリアルタイム進捗を確認できます。"
echo ""
echo "  オーケストレーター (あなた) の役割:"
echo "    - ダッシュボードを監視"
echo "    - 動いていないエージェントに介入・プロンプト再投入"
echo "    - 実際のAI改善は各エージェント自身が行う"
echo ""

echo "$DASHBOARD_PID" > "$SCRIPT_DIR/.self-improve-pids"
