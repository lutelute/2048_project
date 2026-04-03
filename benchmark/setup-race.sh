#!/bin/bash
#
# 2048 AI Benchmark — セットアップ (一度だけ実行)
#
# 使い方:
#   ./benchmark/setup-race.sh
#
# やること:
#   1. runs/{agent}/ ディレクトリにリポジトリをクローン
#   2. メインプロジェクトの node_modules をシンボリックリンク (npm install 不要)
#   3. 各エージェント用の play.mjs を配置 (ポート固定・100ゲームループ)
#   4. Playwright ブラウザのインストール確認
#
# ポート割り当て:
#   dashboard:4000  claude-code:4001  codex:4002  gemini:4003  local-cli:4004
#

set -e

REPO_URL="https://github.com/lutelute/2048_project.git"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RUNS_DIR="$PROJECT_DIR/runs"

AGENTS=("claude-code|4001" "codex|4002" "gemini|4003" "local-cli|4004")

echo "=== 2048 AI Benchmark Setup ==="
echo ""

# ── 0. メインプロジェクトの node_modules 確認 ──
if [ ! -d "$PROJECT_DIR/node_modules/vite" ]; then
  echo "メインプロジェクトに node_modules がありません。npm install を実行します..."
  (cd "$PROJECT_DIR" && npm install)
fi

# ── 1. 各エージェントディレクトリを準備 ──
mkdir -p "$RUNS_DIR"

for entry in "${AGENTS[@]}"; do
  IFS='|' read -r NAME PORT <<< "$entry"
  DIR="$RUNS_DIR/$NAME"

  echo "[$NAME] port=$PORT"

  # Clone if needed
  if [ -d "$DIR" ]; then
    echo "  既にクローン済み。スキップ。"
  else
    echo "  クローン中..."
    git clone "$REPO_URL" "$DIR"
  fi

  # results ディレクトリ
  mkdir -p "$DIR/benchmark/results"

  # node_modules はメインからシンボリックリンク (npm install 不要)
  if [ -L "$DIR/node_modules" ]; then
    echo "  node_modules: シンボリックリンク済み ✓"
  else
    rm -rf "$DIR/node_modules"
    ln -s "$PROJECT_DIR/node_modules" "$DIR/node_modules"
    echo "  node_modules: シンボリックリンク作成 ✓"
  fi

  # vite.config.ts にポートを設定
  VITE="$DIR/vite.config.ts"
  if ! grep -q "port:" "$VITE" 2>/dev/null; then
    echo "  vite port=$PORT を設定中..."
    sed -i '' "s|base: '/2048_project/'|base: '/2048_project/',\n  server: { port: $PORT, strictPort: true }|" "$VITE"
  fi

  echo ""
done

# ── 2. play.mjs を全エージェントに配置 ──
echo "play.mjs を各エージェントに配置中..."

for entry in "${AGENTS[@]}"; do
  IFS='|' read -r NAME PORT <<< "$entry"
  PLAY_FILE="$RUNS_DIR/$NAME/benchmark/play.mjs"

  cat > "$PLAY_FILE" << 'PLAY_EOF'
import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const GAME_URL = 'http://localhost:__PORT__/2048_project/';
const LOG_FILE = path.join(import.meta.dirname, 'results/progress.log');
const FINAL_SCREENSHOT = path.join(import.meta.dirname, 'results/final.png');
const TOTAL_GAMES = parseInt(process.env.TOTAL_GAMES || '100', 10);

fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
fs.writeFileSync(LOG_FILE, '');

function log(obj) {
  fs.appendFileSync(LOG_FILE, JSON.stringify(obj) + '\n');
  const summary = obj.result
    ? `FINAL: ${obj.result} | score=${obj.score} highest=${obj.highest} moves=${obj.moves}`
    : `move=${obj.move} dir=${obj.direction} score=${obj.score} highest=${obj.highest}`;
  console.log(summary);
}

async function readBoardState(page) {
  return await page.evaluate(() => {
    const grid = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
    const allTiles = document.querySelectorAll('.tile-slide');
    if (allTiles.length === 0) return grid;
    const first = allTiles[0];
    const tileSize = first.offsetWidth;
    const gap = 8;
    allTiles.forEach(el => {
      const value = parseInt(el.textContent?.trim() || '0');
      if (isNaN(value) || value === 0) return;
      const top = parseFloat(el.style.top);
      const left = parseFloat(el.style.left);
      const row = Math.round(top / (tileSize + gap));
      const col = Math.round(left / (tileSize + gap));
      if (row >= 0 && row < 4 && col >= 0 && col < 4) {
        grid[row][col] = Math.max(grid[row][col], value);
      }
    });
    return grid;
  });
}

async function readScore(page) {
  return await page.evaluate(() => {
    const boxes = document.querySelectorAll('.bg-board.rounded-md');
    for (const box of boxes) {
      const divs = box.querySelectorAll('div');
      if (divs[0]?.textContent?.trim().toUpperCase() === 'SCORE') {
        return parseInt(divs[1]?.textContent?.trim()) || 0;
      }
    }
    return 0;
  });
}

async function checkGameEnd(page) {
  return await page.evaluate(() => {
    const overlay = document.querySelector('.overlay-fade');
    if (!overlay) return null;
    const style = window.getComputedStyle(overlay);
    if (style.opacity === '0' || style.pointerEvents === 'none') return null;
    const text = overlay.textContent || '';
    if (text.includes('You Win')) return 'win';
    if (text.includes('Game Over')) return 'loss';
    return null;
  });
}

function chooseDirection(board) {
  const directions = ['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'];
  let bestDir = 'ArrowDown';
  let bestScore = -Infinity;
  for (const dir of directions) {
    const sim = simulateMove(board, dir);
    if (!sim.changed) continue;
    let score = sim.mergeScore;
    const highest = Math.max(...sim.board.flat());
    const b = sim.board;
    if (b[3][0] === highest) score += highest * 10;
    else if (b[3][1] === highest || b[2][0] === highest) score += highest * 3;
    else if (b[3][2] === highest || b[3][3] === highest) score += highest;
    for (let c = 0; c < 3; c++) {
      if (b[3][c] >= b[3][c+1]) score += b[3][c] * 2;
      else score -= b[3][c+1];
    }
    for (let r = 3; r > 0; r--) {
      if (b[r][0] >= b[r-1][0]) score += b[r][0] * 2;
      else score -= b[r-1][0];
    }
    for (let c = 3; c > 0; c--) {
      if (b[2][c] >= b[2][c-1]) score += b[2][c];
    }
    const empty = b.flat().filter(v => v === 0).length;
    score += empty * 50;
    if (dir === 'ArrowDown') score += 30;
    if (dir === 'ArrowLeft') score += 20;
    if (dir === 'ArrowUp') score -= 80;
    const curHighest = Math.max(...board.flat());
    if (board[3][0] === curHighest && b[3][0] !== curHighest) score -= curHighest * 8;
    if (score > bestScore) { bestScore = score; bestDir = dir; }
  }
  if (bestScore === -Infinity) {
    for (const dir of directions) {
      if (simulateMove(board, dir).changed) return dir;
    }
  }
  return bestDir;
}

function simulateMove(board, direction) {
  const grid = board.map(r => [...r]);
  let mergeScore = 0;
  let changed = false;
  function compress(line) {
    const f = line.filter(v => v !== 0);
    const res = [];
    let i = 0;
    while (i < f.length) {
      if (i + 1 < f.length && f[i] === f[i + 1]) { res.push(f[i] * 2); mergeScore += f[i] * 2; i += 2; }
      else { res.push(f[i]); i++; }
    }
    while (res.length < 4) res.push(0);
    return res;
  }
  if (direction === 'ArrowLeft') {
    for (let r = 0; r < 4; r++) { const nr = compress(grid[r]); if (nr.some((v, i) => v !== grid[r][i])) changed = true; grid[r] = nr; }
  } else if (direction === 'ArrowRight') {
    for (let r = 0; r < 4; r++) { const nr = compress([...grid[r]].reverse()).reverse(); if (nr.some((v, i) => v !== grid[r][i])) changed = true; grid[r] = nr; }
  } else if (direction === 'ArrowUp') {
    for (let c = 0; c < 4; c++) { const col = [grid[0][c], grid[1][c], grid[2][c], grid[3][c]]; const nc = compress(col); if (nc.some((v, i) => v !== col[i])) changed = true; for (let r = 0; r < 4; r++) grid[r][c] = nc[r]; }
  } else if (direction === 'ArrowDown') {
    for (let c = 0; c < 4; c++) { const col = [grid[3][c], grid[2][c], grid[1][c], grid[0][c]]; const nc = compress(col); if (nc.some((v, i) => v !== col[i])) changed = true; grid[3][c] = nc[0]; grid[2][c] = nc[1]; grid[1][c] = nc[2]; grid[0][c] = nc[3]; }
  }
  return { board: grid, mergeScore, changed };
}

async function playOneGame(page, gameNum) {
  console.log(`\n--- Game ${gameNum}/${TOTAL_GAMES} ---`);
  await page.locator('button', { hasText: /new game/i }).first().click();
  await page.waitForTimeout(500);

  let moveCount = 0;
  let lastBoardStr = '';
  let stuckCount = 0;

  while (true) {
    const board = await readBoardState(page);
    const score = await readScore(page);
    const highest = Math.max(...board.flat());
    const tileCount = board.flat().filter(v => v > 0).length;

    const endState = await checkGameEnd(page);
    if (endState) {
      await page.waitForTimeout(300);
      await page.screenshot({ path: FINAL_SCREENSHOT });
      log({ result: endState, score, highest, moves: moveCount, board, timestamp: new Date().toISOString() });
      console.log(`Game ${gameNum} ${endState === 'win' ? 'WON' : 'LOST'}! Score: ${score}, Highest: ${highest}, Moves: ${moveCount}`);
      return;
    }

    const boardStr = JSON.stringify(board);
    if (boardStr === lastBoardStr) {
      stuckCount++;
      if (stuckCount > 10) {
        let escaped = false;
        for (const dir of ['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp']) {
          await page.keyboard.press(dir);
          await page.waitForTimeout(150);
          const nb = await readBoardState(page);
          if (JSON.stringify(nb) !== boardStr) { escaped = true; break; }
        }
        if (!escaped) {
          await page.screenshot({ path: FINAL_SCREENSHOT });
          log({ result: 'loss', score, highest, moves: moveCount, board, timestamp: new Date().toISOString() });
          console.log(`Game ${gameNum} stuck. Score: ${score}, Highest: ${highest}, Moves: ${moveCount}`);
          return;
        }
        stuckCount = 0;
        continue;
      }
    } else { stuckCount = 0; }
    lastBoardStr = boardStr;

    const direction = chooseDirection(board);
    moveCount++;
    await page.keyboard.press(direction);
    await page.waitForTimeout(150);

    const dirName = direction.replace('Arrow', '').toLowerCase();
    log({ move: moveCount, direction: dirName, score, highest, tiles: tileCount, board, timestamp: new Date().toISOString() });

    if (moveCount > 5000) {
      await page.screenshot({ path: FINAL_SCREENSHOT });
      log({ result: 'loss', score, highest, moves: moveCount, board, timestamp: new Date().toISOString() });
      return;
    }
  }
}

async function main() {
  console.log(`Starting ${TOTAL_GAMES}-game race on ${GAME_URL}`);
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 520, height: 700 } });

  await page.goto(GAME_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  for (let g = 1; g <= TOTAL_GAMES; g++) {
    await playOneGame(page, g);
    await page.waitForTimeout(1000);
  }

  console.log(`\n=== All ${TOTAL_GAMES} games complete ===`);
  await new Promise(() => {});
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
PLAY_EOF

  # ポートを置換
  sed -i '' "s/__PORT__/$PORT/" "$PLAY_FILE"
  echo "  $NAME → play.mjs (port $PORT)"
done

# ── 3. Playwright ブラウザのインストール確認 ──
echo ""
echo "Playwright ブラウザを確認中..."
# playwright の browserType.executablePath() はESMなので、
# npx playwright install --dry-run の代わりに直接パスを探す
PW_CACHE="$HOME/Library/Caches/ms-playwright"
CHROMIUM_DIR=$(ls -d "$PW_CACHE"/chromium-*/chrome-mac-arm64 2>/dev/null | tail -1)
if [ -n "$CHROMIUM_DIR" ] && ls "$CHROMIUM_DIR"/*.app >/dev/null 2>&1; then
  echo "  Chromium: インストール済み ✓"
else
  echo "  Chromium: 未インストール。ダウンロード中..."
  npx playwright install chromium
fi

echo ""
echo "=== セットアップ完了 ==="
echo ""
echo "レースを開始するには:"
echo "  ./benchmark/launch-race.sh"
echo ""
echo "停止するには:"
echo "  ./benchmark/stop-race.sh"
