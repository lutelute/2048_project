/**
 * Monte Carlo AI — for each valid move, runs random playouts
 * and picks the move with the highest average final score.
 * Avg score ~8,000-15,000.
 *
 * SEED指定時は各プレイアウトに異なるオフセットseedを与えることで、
 * 80回のプレイアウトの多様性を保ちつつ、全体を再現可能にする。
 */

const SIMULATIONS = 80;
const MAX_PLAYOUT_MOVES = 200;

function randomPlayout(game, offset) {
  const g = game.clone();
  // 各プレイアウトに異なるシードを与える (seed未指定時は Math.random で多様性を確保)
  if (g._seed != null) g._seed = (g._seed + (offset + 1) * 0x9E3779B1) | 0;
  let moves = 0;
  while (!g.isGameOver() && moves < MAX_PLAYOUT_MOVES) {
    const valid = g.getValidMoves();
    if (valid.length === 0) break;
    const rnd = typeof g._random === 'function' ? g._random() : Math.random();
    g.move(valid[Math.floor(rnd * valid.length)]);
    moves++;
  }
  return g.getScore();
}

export default function chooseMove(board, score, game) {
  const moves = game.getValidMoves();
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  let bestMove = moves[0];
  let bestAvg = -Infinity;

  for (const dir of moves) {
    const g = game.clone();
    g.move(dir);

    let total = 0;
    for (let i = 0; i < SIMULATIONS; i++) {
      total += randomPlayout(g, i);
    }
    const avg = total / SIMULATIONS;

    if (avg > bestAvg) {
      bestAvg = avg;
      bestMove = dir;
    }
  }

  return bestMove;
}
