/**
 * logic.ts (React版) と game-engine.mjs (ヘッドレス版) の挙動一致テスト。
 * 同じ盤面・方向で「移動後の盤面」と「獲得スコア」が一致することを保証する。
 * Node 24 の type-stripping で .ts を直接 import する。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from './game-engine.mjs';
import { moveTiles } from '../src/game/logic.ts';

function flatToTiles(flat) {
  const tiles = [];
  let id = 1;
  for (let i = 0; i < 16; i++) if (flat[i]) tiles.push({ id: id++, value: flat[i], row: (i / 4) | 0, col: i % 4 });
  return tiles;
}
function tilesToFlat(tiles) {
  const f = new Array(16).fill(0);
  for (const t of tiles) f[t.row * 4 + t.col] = t.value;
  return f;
}

const CASES = [
  [2,2,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
  [2,2,2,2, 0,0,0,0, 0,0,0,0, 0,0,0,0],
  [2,2,2,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
  [0,2,2,4, 4,4,2,2, 8,8,8,8, 2,4,2,4],
  [2,0,0,2, 4,0,0,4, 0,8,8,0, 16,0,0,16],
  [4,4,8,8, 2,2,2,2, 0,0,0,0, 32,32,0,0],
  [2,4,8,16, 16,8,4,2, 2,2,4,4, 8,8,16,16],
];

for (const flat of CASES) {
  for (const dir of ['left', 'right', 'up', 'down']) {
    test(`logic.ts ≡ game-engine: dir=${dir} board=[${flat.join(',')}]`, () => {
      const g = new Game(1);
      g.board = flat.slice(); g.score = 0; g.over = false; g.won = false;
      g._applyMove(dir);
      const res = moveTiles(flatToTiles(flat), dir);
      assert.deepEqual(g.board, tilesToFlat(res.tiles), 'board mismatch');
      assert.equal(g.score, res.scoreGained, 'score mismatch');
    });
  }
}
