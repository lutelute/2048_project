/**
 * Expectimax AI — Expectimax search with snake heuristic.
 * The strongest built-in algorithm. Avg ~20,000, win rate ~40-60%.
 */

import { DIRECTIONS } from '../game-engine.mjs';

const SNAKE_WEIGHTS = [
  [   1,    2,    4,     8],
  [ 256,  128,   64,    32],
  [ 512, 1024, 2048,  4096],
  [524288, 262144, 131072, 65536],
];

function evaluateBoard(board) {
  let score = 0;
  let empty = 0;
  let maxTile = 0;
  let maxR = 0, maxC = 0;

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const v = board[r][c];
      if (v === 0) {
        empty++;
      } else {
        if (v > maxTile) { maxTile = v; maxR = r; maxC = c; }
      }
    }
  }

  // 1. Snake weight pattern
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (board[r][c] > 0) {
        score += Math.log2(board[r][c]) * SNAKE_WEIGHTS[r][c];
      }
    }
  }

  // 2. Corner bonus
  if (board[3][0] === maxTile) {
    score += maxTile * 20;
  } else if (maxR === 3 && maxC <= 1) {
    score += maxTile * 5;
  } else if (maxR === 3) {
    score += maxTile * 2;
  } else {
    score -= maxTile * 10;
  }

  // 3. Empty cells bonus
  score += empty * empty * 100;

  // 4. Monotonicity
  for (let c = 0; c < 3; c++) {
    if (board[3][c] >= board[3][c + 1]) {
      score += board[3][c] * 4;
    } else {
      score -= (board[3][c + 1] - board[3][c]) * 8;
    }
  }
  for (let r = 3; r > 0; r--) {
    if (board[r][0] >= board[r - 1][0]) {
      score += board[r][0] * 4;
    } else {
      score -= (board[r - 1][0] - board[r][0]) * 8;
    }
  }
  for (let c = 3; c > 0; c--) {
    if (board[2][c] >= board[2][c - 1]) {
      score += board[2][c] * 2;
    } else {
      score -= (board[2][c - 1] - board[2][c]) * 4;
    }
  }

  // 5. Smoothness
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const v = board[r][c];
      if (v === 0) continue;
      if (c < 3 && board[r][c + 1] > 0) {
        const diff = Math.abs(Math.log2(v) - Math.log2(board[r][c + 1]));
        score -= diff * diff * 10;
      }
      if (r < 3 && board[r + 1][c] > 0) {
        const diff = Math.abs(Math.log2(v) - Math.log2(board[r + 1][c]));
        score -= diff * diff * 10;
      }
    }
  }

  // 6. Merge potential
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const v = board[r][c];
      if (v === 0) continue;
      if (c < 3 && board[r][c + 1] === v) score += v * 2;
      if (r < 3 && board[r + 1][c] === v) score += v * 2;
    }
  }

  return score;
}

function expectimax(game, depth, isChanceNode) {
  if (depth === 0 || game.isGameOver()) {
    return evaluateBoard(game.getBoard());
  }

  if (isChanceNode) {
    const emptyCells = game.getEmptyCells();
    if (emptyCells.length === 0) return evaluateBoard(game.getBoard());

    let totalScore = 0;
    // 空きセルが多い序盤は計算量削減のためサンプリングするが、
    // slice(0,6) だと常に左上6セル固定で期待値が歪む。Fisher-Yates でランダム抽出する。
    let cells = emptyCells;
    if (emptyCells.length > 6 && depth > 1) {
      cells = [...emptyCells];
      for (let i = cells.length - 1; i > 0; i--) {
        // game のseed付きRNGを使い、SEED固定時にexpectimaxも再現可能にする
        const rnd = typeof game._random === 'function' ? game._random() : Math.random();
        const j = Math.floor(rnd * (i + 1));
        [cells[i], cells[j]] = [cells[j], cells[i]];
      }
      cells = cells.slice(0, 6);
    }

    for (const cell of cells) {
      const idx = cell.row * 4 + cell.col;

      const g2 = game.clone();
      g2.board[idx] = 2;
      if (!g2._canMove()) g2.over = true;
      totalScore += 0.9 * expectimax(g2, depth - 1, false);

      const g4 = game.clone();
      g4.board[idx] = 4;
      if (!g4._canMove()) g4.over = true;
      totalScore += 0.1 * expectimax(g4, depth - 1, false);
    }

    return totalScore / cells.length;
  } else {
    let bestScore = -Infinity;
    for (const dir of DIRECTIONS) {
      const g = game.clone();
      const changed = g._applyMove(dir);
      if (!changed) continue;
      const s = expectimax(g, depth - 1, true);
      if (s > bestScore) bestScore = s;
    }
    return bestScore === -Infinity ? evaluateBoard(game.getBoard()) : bestScore;
  }
}

export default function chooseMove(board, score, game) {
  const validMoves = game.getValidMoves();
  if (validMoves.length === 0) return null;
  if (validMoves.length === 1) return validMoves[0];

  const emptyCells = game.getEmptyCells().length;
  let depth;
  if (emptyCells <= 3) {
    depth = 4;
  } else if (emptyCells <= 6) {
    depth = 3;
  } else {
    depth = 2;
  }

  let bestMove = validMoves[0];
  let bestScore = -Infinity;

  for (const dir of validMoves) {
    const g = game.clone();
    g._applyMove(dir);
    const s = expectimax(g, depth, true);
    if (s > bestScore) {
      bestScore = s;
      bestMove = dir;
    }
  }

  return bestMove;
}
