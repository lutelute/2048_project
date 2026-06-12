/**
 * dashboard-control.mjs のユニットテスト。
 * コマンド実行の入口となる入力検証(clampInt)と、未知ルートの安全な無視を検証する。
 *   実行: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampInt, handleControlRoute, buildAlgoLaunchArgs } from './dashboard-control.mjs';

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

// ── Run の algo 伝播 (「Runすると毎回rlになる」報告の回帰テスト) ──

test('buildAlgoLaunchArgs: 選択した algo がそのまま --algo に伝わる', () => {
  assert.deepEqual(buildAlgoLaunchArgs({ games: 3, algo: 'greedy' }), ['3', '--algo', 'greedy']);
  assert.deepEqual(buildAlgoLaunchArgs({ games: 100, algo: 'montecarlo' }), ['100', '--algo', 'montecarlo']);
  assert.deepEqual(buildAlgoLaunchArgs({ games: 100, algo: 'expectimax' }), ['100', '--algo', 'expectimax']);
});

test('buildAlgoLaunchArgs: 不正な algo は rl にフォールバック (インジェクション対策)', () => {
  assert.deepEqual(buildAlgoLaunchArgs({ games: 3, algo: 'evil; rm -rf /' }), ['3', '--algo', 'rl']);
  assert.deepEqual(buildAlgoLaunchArgs({ games: 3, algo: '' }), ['3', '--algo', 'rl']);
  assert.deepEqual(buildAlgoLaunchArgs({ games: 3 }), ['3', '--algo', 'rl']);
});

test('buildAlgoLaunchArgs: compare は --algos 4種に展開', () => {
  assert.deepEqual(buildAlgoLaunchArgs({ games: 3, algo: 'compare' }),
    ['3', '--algos', 'rl,expectimax,montecarlo,greedy']);
});

test('handleControlRoute: POST /api/run は body の algo を起動引数に伝える', async () => {
  const url = new URL('http://localhost:5050/api/run');
  const req = {
    method: 'POST',
    async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify({ games: 5, algo: 'greedy' })); },
  };
  let payload = null;
  const res = { writeHead: () => {}, end: (s) => { payload = JSON.parse(s); } };
  const handled = await handleControlRoute(req, res, url, {
    projectRoot: '/tmp',
    launchScript: '/usr/bin/true',   // 実レースは起動しない
    buildLaunchArgs: buildAlgoLaunchArgs,
  });
  assert.equal(handled, true);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.args, ['5', '--algo', 'greedy'], 'greedy 指定が rl に化けない');
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
