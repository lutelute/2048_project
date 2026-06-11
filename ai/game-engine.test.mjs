/**
 * game-engine.mjs のユニットテスト (node:test, 依存ゼロ)
 *   実行: npm test   または   node --test ai/game-engine.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, DIRECTIONS } from './game-engine.mjs';

// 盤面を直接セットするヘルパー (flat 16要素)
function withBoard(flat, seed = 1) {
  const g = new Game(seed);
  g.board = flat.slice();
  g.score = 0;
  g.over = false;
  g.won = false;
  return g;
}

test('初期状態: タイル2枚 / スコア0 / 値は2か4', () => {
  const g = new Game(1);
  const nonzero = g.getBoard().flat().filter(v => v > 0);
  assert.equal(nonzero.length, 2);
  assert.equal(g.getScore(), 0);
  assert.ok(nonzero.every(v => v === 2 || v === 4));
});

test('merge: 左移動で [2,2] → [4] かつ score+4', () => {
  const g = withBoard([2,2,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]);
  assert.equal(g._applyMove('left'), true);
  assert.deepEqual(g.board.slice(0,4), [4,0,0,0]);
  assert.equal(g.score, 4);
});

test('merge: [2,2,2] は左から1回だけ → [4,2]', () => {
  const g = withBoard([2,2,2,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]);
  g._applyMove('left');
  assert.deepEqual(g.board.slice(0,4), [4,2,0,0]);
});

test('merge: [2,2,2,2] → [4,4] かつ score+8', () => {
  const g = withBoard([2,2,2,2, 0,0,0,0, 0,0,0,0, 0,0,0,0]);
  g._applyMove('left');
  assert.deepEqual(g.board.slice(0,4), [4,4,0,0]);
  assert.equal(g.score, 8);
});

test('変化しない方向は changed=false', () => {
  const g = withBoard([2,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]);
  assert.equal(g._applyMove('left'), false);
});

test('win: 1024+1024 → 2048 で hasWon()=true', () => {
  const g = withBoard([1024,1024,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]);
  g._applyMove('left');
  assert.equal(g.board[0], 2048);
  assert.equal(g.hasWon(), true);
});

test('canMove: 満杯かつマージ不可は false', () => {
  const g = withBoard([2,4,2,4, 4,2,4,2, 2,4,2,4, 4,2,4,2]);
  assert.equal(g._canMove(), false);
});

test('canMove: 隣接同値ありは true', () => {
  const g = withBoard([2,2,2,4, 4,2,4,2, 2,4,2,4, 4,2,4,2]);
  assert.equal(g._canMove(), true);
});

test('getValidMoves は DIRECTIONS の部分集合', () => {
  const g = new Game(1);
  assert.ok(g.getValidMoves().every(d => DIRECTIONS.includes(d)));
});

test('simulateMove は元の盤面を変更しない', () => {
  const g = new Game(1);
  const before = JSON.stringify(g.getBoard());
  g.simulateMove('down');
  assert.equal(JSON.stringify(g.getBoard()), before);
});

test('getBoardLog2 は log2 値 (空=0)', () => {
  const g = withBoard([2,4,8,16, 0,0,0,0, 0,0,0,0, 0,0,0,0]);
  const l = g.getBoardLog2();
  assert.deepEqual([l[0],l[1],l[2],l[3],l[4]], [1,2,3,4,0]);
});

test('seed決定論: 同seedは同一プレイ / 異seedは別プレイ', () => {
  const play = (seed) => {
    const g = new Game(seed);
    for (let i = 0; i < 150; i++) { for (const d of DIRECTIONS) if (g.move(d)) break; }
    return JSON.stringify(g.getBoard()) + ':' + g.getScore();
  };
  assert.equal(play(123), play(123));
  assert.notEqual(play(123), play(456));
});

test('clone の move() は親の状態を汚さない', () => {
  const g = new Game(123);
  const before = JSON.stringify(g.getBoard());
  const c = g.clone();
  for (let i = 0; i < 30; i++) { for (const d of DIRECTIONS) if (c.move(d)) break; }
  assert.equal(JSON.stringify(g.getBoard()), before);
});
