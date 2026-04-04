/**
 * Greedy AI — picks the move that maximizes immediate score gain.
 * Ties broken by preferring down > left > right > up (corner bias).
 * Avg score ~3,000-5,000.
 */

const PREFERRED = ['down', 'left', 'right', 'up'];

export default function chooseMove(board, score, game) {
  const moves = game.getValidMoves();
  if (moves.length === 0) return null;

  let bestMove = null;
  let bestGain = -1;

  for (const dir of PREFERRED) {
    if (!moves.includes(dir)) continue;
    const sim = game.simulateMove(dir);
    const gain = sim.score - score;
    if (gain > bestGain) {
      bestGain = gain;
      bestMove = dir;
    }
  }

  return bestMove || moves[0];
}
