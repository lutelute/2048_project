/**
 * Monte Carlo AI — for each valid move, runs random playouts
 * and picks the move with the highest average final score.
 * Avg score ~8,000-15,000.
 */

const SIMULATIONS = 80;
const MAX_PLAYOUT_MOVES = 200;

function randomPlayout(game) {
  const g = game.clone();
  let moves = 0;
  while (!g.isGameOver() && moves < MAX_PLAYOUT_MOVES) {
    const valid = g.getValidMoves();
    if (valid.length === 0) break;
    g.move(valid[Math.floor(Math.random() * valid.length)]);
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
      total += randomPlayout(g);
    }
    const avg = total / SIMULATIONS;

    if (avg > bestAvg) {
      bestAvg = avg;
      bestMove = dir;
    }
  }

  return bestMove;
}
