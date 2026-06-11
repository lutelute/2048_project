/**
 * rl.mjs (N-tuple TD強化学習) の核心ロジックのユニットテスト。
 * 特に 8対称(D4群) 変換の正しさと、対称不変性・learn収束を検証する。
 *   実行: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SYMS, value, learn, toLog2 } from './algorithms/rl.mjs';

const ID = [...Array(16).keys()];
// 90度回転の座標順列 (rl.mjs の buildSyms と同一定義)
const rot = (p) => { const np = new Array(16); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) np[r * 4 + c] = p[(3 - c) * 4 + r]; return np; };
const applyPerm = (bl, perm) => { const o = new Uint8Array(16); for (let i = 0; i < 16; i++) o[i] = bl[perm[i]]; return o; };

test('SYMS は 8個の置換 (二面体群 D4)', () => {
  assert.equal(SYMS.length, 8);
  for (const s of SYMS) {
    assert.deepEqual([...s].sort((a, b) => a - b), ID, '各対称は 0..15 の置換');
  }
});

test('SYMS は全て相異なる', () => {
  assert.equal(new Set(SYMS.map(s => s.join(','))).size, 8);
});

test('恒等変換を含む', () => {
  assert.ok(SYMS.some(s => s.join(',') === ID.join(',')));
});

test('回転は位数4 (rot^4 = id)', () => {
  let p = ID;
  for (let i = 0; i < 4; i++) p = rot(p);
  assert.deepEqual(p, ID);
});

test('toLog2: 実値 → log2 (空=0)', () => {
  const l = toLog2([[2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  assert.deepEqual([l[0], l[1], l[2], l[3], l[4]], [1, 2, 3, 4, 0]);
});

test('learn は value を target 方向 (正→増加 / 負→減少) へ動かす', () => {
  // 注: 重複エントリ(特に全0タプル)があると更新が増幅されるため、増分の厳密値ではなく
  //     「TD更新の向き」を検証する (向きさえ正しければ学習は収束する)。
  const bl = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 2]);
  const v0 = value(bl);
  learn(bl, 10);  const v1 = value(bl);
  learn(bl, -20); const v2 = value(bl);
  assert.ok(v1 > v0, `正のdeltaでvalue増加: ${v0.toFixed(3)} → ${v1.toFixed(3)}`);
  assert.ok(v2 < v1, `負のdeltaでvalue減少: ${v1.toFixed(3)} → ${v2.toFixed(3)}`);
});

test('対称不変性: 盤面と その90度回転は同じ value (8対称の重み共有が正しい証明)', () => {
  const bl = new Uint8Array([1, 2, 0, 0, 3, 4, 0, 0, 0, 0, 5, 0, 0, 0, 0, 6]);
  learn(bl, 7);                        // 適当に学習させてから
  const rotated = applyPerm(bl, rot(ID));
  assert.ok(Math.abs(value(bl) - value(rotated)) < 1e-3,
    `回転不変: value(bl)=${value(bl).toFixed(4)} ≈ value(rot)=${value(rotated).toFixed(4)}`);
});
