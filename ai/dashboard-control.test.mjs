/**
 * dashboard-control.mjs のユニットテスト。
 * コマンド実行の入口となる入力検証(clampInt)と、未知ルートの安全な無視を検証する。
 *   実行: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampInt, handleControlRoute } from './dashboard-control.mjs';

test('clampInt: 範囲内はそのまま', () => {
  assert.equal(clampInt(50, 1, 100, 10), 50);
  assert.equal(clampInt(1, 1, 100, 10), 1);
  assert.equal(clampInt(100, 1, 100, 10), 100);
});

test('clampInt: 下限未満は下限にクランプ', () => {
  assert.equal(clampInt(-5, 1, 100, 10), 1);
  assert.equal(clampInt(0, 1, 100, 10), 1);
});

test('clampInt: 上限超過は上限にクランプ', () => {
  assert.equal(clampInt(999999, 1, 100, 10), 100);
});

test('clampInt: 非数値はデフォルト', () => {
  assert.equal(clampInt('abc', 1, 100, 10), 10);
  assert.equal(clampInt(undefined, 1, 100, 10), 10);
  assert.equal(clampInt(null, 1, 100, 10), 10);
  assert.equal(clampInt(NaN, 1, 100, 10), 10);
});

test('clampInt: 文字列の数値はパースしてクランプ', () => {
  assert.equal(clampInt('50', 1, 100, 10), 50);
  assert.equal(clampInt('999', 1, 100, 10), 100);
});

test('handleControlRoute: 未知パスは false を返し何もしない', async () => {
  const url = new URL('http://localhost:5050/api/unknown');
  let touched = false;
  const res = { writeHead: () => { touched = true; }, end: () => { touched = true; } };
  const handled = await handleControlRoute({ method: 'GET' }, res, url, {});
  assert.equal(handled, false);
  assert.equal(touched, false, 'レスポンスに触れない');
});

test('handleControlRoute: GETの/api/runは処理しない(POST限定)', async () => {
  const url = new URL('http://localhost:5050/api/run');
  let touched = false;
  const res = { writeHead: () => { touched = true; }, end: () => { touched = true; } };
  const handled = await handleControlRoute({ method: 'GET' }, res, url, { projectRoot: '/tmp', launchScript: '/tmp/x.sh', buildLaunchArgs: () => [] });
  assert.equal(handled, false);
  assert.equal(touched, false);
});
