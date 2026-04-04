#!/usr/bin/env node
/**
 * 2048 AI Evaluator
 *
 * Runs N games headlessly at full speed and writes JSONL results.
 *
 * Usage:
 *   node ai/evaluate.mjs                       # 100 games (default)
 *   node ai/evaluate.mjs --games 200           # 200 games
 *   TOTAL_GAMES=50 node ai/evaluate.mjs        # via env var
 *   node ai/evaluate.mjs --ai path/to/ai.mjs   # custom AI file
 */

import { Game, DIRECTIONS } from './game-engine.mjs';
import { pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

const args = process.argv.slice(2);
function getArg(name, defaultVal) {
  const idx = args.indexOf(name);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : defaultVal;
}

const numGames = parseInt(process.env.TOTAL_GAMES || getArg('--games', '100'), 10);
const aiPath = getArg('--ai', path.join(import.meta.dirname, 'my-ai.mjs'));
const runId = process.env.RUN_ID || new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
const logDir = path.join(import.meta.dirname, 'results', `run-${runId}`);
const logPath = path.join(logDir, 'progress.log');

// Ensure results directory exists
fs.mkdirSync(logDir, { recursive: true });

// Load AI
let chooseMove;
try {
  const mod = await import(pathToFileURL(path.resolve(aiPath)).href);
  chooseMove = mod.default || mod.chooseMove;
  if (typeof chooseMove !== 'function') {
    console.error(`ERROR: ${aiPath} does not export a chooseMove function`);
    process.exit(1);
  }
} catch (err) {
  console.error(`ERROR: Failed to load AI from ${aiPath}: ${err.message}`);
  process.exit(1);
}

console.log(`Evaluating: ${path.basename(aiPath)}`);
console.log(`Games: ${numGames}`);
console.log(`Log: ${logPath}`);
console.log('');

// Clear log file
fs.writeFileSync(logPath, '');

const t0 = Date.now();
const scores = [];
const tileDistribution = {};
let wins = 0;

for (let g = 0; g < numGames; g++) {
  const game = new Game();
  let moves = 0;

  while (!game.isGameOver()) {
    const dir = chooseMove(game.getBoard(), game.getScore(), game);
    if (!dir || !DIRECTIONS.includes(dir)) break;
    game.move(dir);
    moves++;
    if (moves > 50000) break; // safety
  }

  const score = game.getScore();
  const highest = game.getHighestTile();
  const won = game.hasWon();
  const result = won ? 'win' : 'loss';

  scores.push(score);
  tileDistribution[highest] = (tileDistribution[highest] || 0) + 1;
  if (won) wins++;

  // Write JSONL per-game result (same format as 4000-series)
  const line = JSON.stringify({
    result,
    score,
    highest,
    moves,
    game: g + 1,
    timestamp: new Date().toISOString(),
  });
  fs.appendFileSync(logPath, line + '\n');

  // Progress every 10 games
  if ((g + 1) % 10 === 0 || g + 1 === numGames) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const wr = (wins / (g + 1) * 100).toFixed(1);
    process.stdout.write(`\r  ${g + 1}/${numGames} games | WR: ${wr}% | Elapsed: ${elapsed}s`);
  }
}

const elapsed = Date.now() - t0;
const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
const maxScore = Math.max(...scores);
const minScore = Math.min(...scores);

console.log('\n');
console.log('=== Results ===');
console.log(`  Avg Score   : ${avgScore}`);
console.log(`  Max Score   : ${maxScore}`);
console.log(`  Min Score   : ${minScore}`);
console.log(`  Win Rate    : ${(wins / numGames * 100).toFixed(1)}% (${wins}/${numGames})`);
console.log(`  Tile Distribution:`);

const tiles = Object.entries(tileDistribution)
  .sort((a, b) => Number(b[0]) - Number(a[0]));
for (const [tile, count] of tiles) {
  const pct = (count / numGames * 100).toFixed(1);
  const bar = '\u2588'.repeat(Math.round(count / numGames * 40));
  console.log(`    ${tile.padStart(5)}: ${String(count).padStart(4)} (${pct.padStart(5)}%) ${bar}`);
}

console.log(`  Speed       : ${Math.round(numGames / elapsed * 1000)} games/sec`);
console.log(`  Elapsed     : ${(elapsed / 1000).toFixed(1)}s`);
console.log(`  Log         : ${logPath}`);
