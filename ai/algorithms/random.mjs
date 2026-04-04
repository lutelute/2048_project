/**
 * Random AI — picks a random valid move each turn.
 * Baseline for comparison. Avg score ~1,000-2,000.
 */

export default function chooseMove(board, score, game) {
  const moves = game.getValidMoves();
  if (moves.length === 0) return null;
  return moves[Math.floor(Math.random() * moves.length)];
}
