/**
 * 全アルゴリズムのスモークテスト。
 * 各 chooseMove が「有効な方向 or null」を返し、数手プレイしてもエラーにならないことを保証する。
 * 1つでも壊れるとレースが止まるため、回帰検出として重要。
 *   実行: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, DIRECTIONS } from './game-engine.mjs';

const ALGOS = ['random', 'greedy', 'montecarlo', 'expectimax', 'rl'];

for (const name of ALGOS) {
  test(`${name}: 有効手(または null)を返し数手プレイできる`, async () => {
    const { default: chooseMove } = await import(`./algorithms/${name}.mjs`);
    const g = new Game(1);   // seed固定で決定論的
    let played = 0;
    for (let i = 0; i < 6; i++) {
      if (g.isGameOver()) break;
      const move = chooseMove(g.getBoard(), g.getScore(), g);
      assert.ok(move === null || DIRECTIONS.includes(move), `${name} の返り値が不正: ${move}`);
      if (move === null) break;
      assert.ok(g.getValidMoves().includes(move), `${name} は有効手を返す: ${move}`);
      g.move(move);
      played++;
    }
    assert.ok(played > 0, `${name} は少なくとも1手プレイできる`);
    assert.ok(g.getScore() >= 0);
  });
}
