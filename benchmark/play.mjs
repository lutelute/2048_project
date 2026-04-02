import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const GAME_URL = 'http://localhost:5175/2048_project/';
const LOG_FILE = path.join(import.meta.dirname, 'results/progress.log');
const FINAL_SCREENSHOT = path.join(import.meta.dirname, 'results/final.png');

fs.writeFileSync(LOG_FILE, '');

function log(obj) {
  fs.appendFileSync(LOG_FILE, JSON.stringify(obj) + '\n');
  const summary = obj.result
    ? `FINAL: ${obj.result} | score=${obj.score} highest=${obj.highest} moves=${obj.moves}`
    : `move=${obj.move} dir=${obj.direction} score=${obj.score} highest=${obj.highest} tiles=${obj.tiles}`;
  console.log(summary);
}

async function readBoardState(page) {
  return await page.evaluate(() => {
    const grid = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
    // Tiles are absolutely positioned inside the board container
    const allTiles = document.querySelectorAll('.tile-slide');
    if (allTiles.length === 0) return grid;

    // Compute tile size from first tile
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

    // Corner: highest in bottom-left
    if (b[3][0] === highest) score += highest * 10;
    else if (b[3][1] === highest || b[2][0] === highest) score += highest * 3;
    else if (b[3][2] === highest || b[3][3] === highest) score += highest;

    // Monotonic bottom row
    for (let c = 0; c < 3; c++) {
      if (b[3][c] >= b[3][c+1]) score += b[3][c] * 2;
      else score -= b[3][c+1];
    }

    // Monotonic left column
    for (let r = 3; r > 0; r--) {
      if (b[r][0] >= b[r-1][0]) score += b[r][0] * 2;
      else score -= b[r-1][0];
    }

    // Snake pattern bonus (row 2 right-to-left)
    for (let c = 3; c > 0; c--) {
      if (b[2][c] >= b[2][c-1]) score += b[2][c];
    }

    // Empty cells
    const empty = b.flat().filter(v => v === 0).length;
    score += empty * 50;

    // Direction preferences
    if (dir === 'ArrowDown') score += 30;
    if (dir === 'ArrowLeft') score += 20;
    if (dir === 'ArrowUp') score -= 80;

    // Penalty for moving highest from corner
    const curHighest = Math.max(...board.flat());
    if (board[3][0] === curHighest && b[3][0] !== curHighest) {
      score -= curHighest * 8;
    }

    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
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
      if (i + 1 < f.length && f[i] === f[i + 1]) {
        res.push(f[i] * 2);
        mergeScore += f[i] * 2;
        i += 2;
      } else {
        res.push(f[i]);
        i++;
      }
    }
    while (res.length < 4) res.push(0);
    return res;
  }

  if (direction === 'ArrowLeft') {
    for (let r = 0; r < 4; r++) {
      const nr = compress(grid[r]);
      if (nr.some((v, i) => v !== grid[r][i])) changed = true;
      grid[r] = nr;
    }
  } else if (direction === 'ArrowRight') {
    for (let r = 0; r < 4; r++) {
      const nr = compress([...grid[r]].reverse()).reverse();
      if (nr.some((v, i) => v !== grid[r][i])) changed = true;
      grid[r] = nr;
    }
  } else if (direction === 'ArrowUp') {
    for (let c = 0; c < 4; c++) {
      const col = [grid[0][c], grid[1][c], grid[2][c], grid[3][c]];
      const nc = compress(col);
      if (nc.some((v, i) => v !== col[i])) changed = true;
      for (let r = 0; r < 4; r++) grid[r][c] = nc[r];
    }
  } else if (direction === 'ArrowDown') {
    for (let c = 0; c < 4; c++) {
      const col = [grid[3][c], grid[2][c], grid[1][c], grid[0][c]];
      const nc = compress(col);
      if (nc.some((v, i) => v !== col[i])) changed = true;
      grid[3][c] = nc[0]; grid[2][c] = nc[1]; grid[1][c] = nc[2]; grid[0][c] = nc[3];
    }
  }

  return { board: grid, mergeScore, changed };
}

async function main() {
  console.log('Launching browser in headed mode...');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 520, height: 700 } });

  console.log(`Navigating to ${GAME_URL}...`);
  await page.goto(GAME_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  console.log('Starting new game...');
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

    // Check game end
    const endState = await checkGameEnd(page);
    if (endState) {
      await page.waitForTimeout(500);
      await page.screenshot({ path: FINAL_SCREENSHOT });
      log({ result: endState, score, highest, moves: moveCount, timestamp: new Date().toISOString() });
      console.log(`\nGame ${endState === 'win' ? 'WON' : 'LOST'}! Score: ${score}, Highest: ${highest}, Moves: ${moveCount}`);
      break;
    }

    // Stuck detection
    const boardStr = JSON.stringify(board);
    if (boardStr === lastBoardStr) {
      stuckCount++;
      if (stuckCount > 10) {
        let escaped = false;
        for (const dir of ['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp']) {
          await page.keyboard.press(dir);
          await page.waitForTimeout(200);
          const nb = await readBoardState(page);
          if (JSON.stringify(nb) !== boardStr) { escaped = true; break; }
        }
        if (!escaped) {
          await page.screenshot({ path: FINAL_SCREENSHOT });
          log({ result: 'loss', score, highest, moves: moveCount, timestamp: new Date().toISOString() });
          console.log(`\nGame stuck. Score: ${score}, Highest: ${highest}, Moves: ${moveCount}`);
          break;
        }
        stuckCount = 0;
        continue;
      }
    } else {
      stuckCount = 0;
    }
    lastBoardStr = boardStr;

    const direction = chooseDirection(board);
    moveCount++;
    await page.keyboard.press(direction);
    await page.waitForTimeout(200);

    const dirName = direction.replace('Arrow', '').toLowerCase();
    log({ move: moveCount, direction: dirName, score, highest, tiles: tileCount, timestamp: new Date().toISOString() });

    if (moveCount % 100 === 0) {
      await page.screenshot({ path: path.join(import.meta.dirname, `results/progress_${moveCount}.png`) });
    }

    if (moveCount > 5000) {
      await page.screenshot({ path: FINAL_SCREENSHOT });
      log({ result: 'loss', score, highest, moves: moveCount, timestamp: new Date().toISOString() });
      break;
    }
  }

  console.log('Browser remains open for observation.');
  await new Promise(() => {});
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
