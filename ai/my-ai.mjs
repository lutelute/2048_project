/**
 * Baseline AI — Expectimax with snake heuristic.
 *
 * 実体は algorithms/expectimax.mjs と同一だったため re-export して重複を排除する。
 * 各エージェントはこのファイルを自分の chooseMove 実装で置き換える:
 *
 *   export default function chooseMove(board, score, game) {
 *     return 'down'; // 'up' | 'down' | 'left' | 'right'
 *   }
 */
export { default } from './algorithms/expectimax.mjs';
