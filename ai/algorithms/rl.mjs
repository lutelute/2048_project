/**
 * N-tuple Network + Afterstate TD(0) 強化学習 AI — 純JS・依存ゼロ
 *
 * 2048強化学習の定番手法 (Szubert & Jaśkowski 2014)。
 *  - 状態価値 V(afterstate) を 12本の4-tuple LUT で近似 (行4 + 列4 + 2x2 square 4)
 *  - 盤面の8対称 (二面体群 D4: 4回転 × 2反転) すべてで学習/評価し、効率と汎化を向上
 *  - 各手: 即時報酬 r + V(afterstate) が最大の方向を greedy 選択
 *  - 学習: afterstate TD(0)   V(s') ← V(s') + α( r_next + V(s'_next) − V(s') )
 *
 * 環境変数:
 *  - RL_LOAD=0     : 学習済みモデルのロードを無効化 (既定: ファイルがあればロード)
 *  - RL_SAVE=1     : プロセス終了時に学習済みモデルを保存 (事前学習→再利用)
 *  - RL_MODEL=path : モデルファイルパス (既定: <このファイルと同じ階層>/rl-model.bin)
 *
 * 事前学習例:  RL_SAVE=1 RL_LOAD=0 ALGO=rl TOTAL_GAMES=50000 node ai/evaluate.mjs
 *
 * chooseMove(board, score, game) インターフェース準拠。
 */
import fs from 'node:fs';
import path from 'node:path';

const TUPLE_VALUES = 16;                       // log2 タイル値 0..15
const TUPLE_SIZE = 4;
const LUT_SIZE = TUPLE_VALUES ** TUPLE_SIZE;   // 65536
const ALPHA = 0.1;                             // 学習率 (対称×タプル数で正規化)

// 行4 + 列4 + 2x2 square 4 = 12本の 4-tuple
const TUPLES = [
  [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15],   // 行
  [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15],   // 列
  [0, 1, 4, 5], [2, 3, 6, 7], [8, 9, 12, 13], [10, 11, 14, 15],   // 2x2 square
];
const NT = TUPLES.length;                      // 12
let luts = TUPLES.map(() => new Float32Array(LUT_SIZE));

// ── 8対称 (二面体群 D4) の座標順列を事前計算 ──
function buildSyms() {
  const id = [...Array(16).keys()];
  const rot = (p) => {            // 時計回り90度
    const np = new Array(16);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) np[r * 4 + c] = p[(3 - c) * 4 + r];
    return np;
  };
  const refl = (p) => {           // 左右反転
    const np = new Array(16);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) np[r * 4 + c] = p[r * 4 + (3 - c)];
    return np;
  };
  const syms = [];
  let cur = id;
  for (let i = 0; i < 4; i++) { syms.push(cur); cur = rot(cur); }
  cur = refl(id);
  for (let i = 0; i < 4; i++) { syms.push(cur); cur = rot(cur); }
  return syms;
}
const SYMS = buildSyms();
const NS = SYMS.length;                          // 8
const NORM = NS * NT;                            // 8 × 12 = 96

function tIndex(bl, perm, t) {
  return ((bl[perm[t[0]]] * 16 + bl[perm[t[1]]]) * 16 + bl[perm[t[2]]]) * 16 + bl[perm[t[3]]];
}
function value(bl) {
  let v = 0;
  for (let s = 0; s < NS; s++) {
    const perm = SYMS[s];
    for (let t = 0; t < NT; t++) v += luts[t][tIndex(bl, perm, TUPLES[t])];
  }
  return v;
}
function learn(bl, delta) {
  const d = (delta * ALPHA) / NORM;
  for (let s = 0; s < NS; s++) {
    const perm = SYMS[s];
    for (let t = 0; t < NT; t++) luts[t][tIndex(bl, perm, TUPLES[t])] += d;
  }
}
function toLog2(board2d) {
  const out = new Uint8Array(16);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const v = board2d[r][c];
      out[r * 4 + c] = v ? Math.round(Math.log2(v)) : 0;
    }
  }
  return out;
}

// ── 学習済みモデルの保存 / ロード ──
const MODEL_PATH = process.env.RL_MODEL || path.join(import.meta.dirname, 'rl-model.bin');
function saveModel() {
  try {
    const buf = Buffer.concat(luts.map(l => Buffer.from(l.buffer, l.byteOffset, l.byteLength)));
    fs.writeFileSync(MODEL_PATH, buf);
  } catch { /* 保存失敗は無視 */ }
}
function loadModel() {
  try {
    if (process.env.RL_LOAD === '0' || !fs.existsSync(MODEL_PATH)) return false;
    const buf = fs.readFileSync(MODEL_PATH);
    if (buf.length !== LUT_SIZE * 4 * NT) return false;   // 形が違えば無視
    const per = LUT_SIZE * 4;
    for (let t = 0; t < NT; t++) {
      luts[t] = new Float32Array(buf.buffer.slice(buf.byteOffset + t * per, buf.byteOffset + (t + 1) * per));
    }
    return true;
  } catch { return false; }
}
loadModel();
if (process.env.RL_SAVE === '1') process.on('exit', saveModel);

let lastGame = null;
let prevAfter = null;   // 前手の afterstate (Uint8Array log2)

export default function chooseMove(board, score, game) {
  // 新ゲーム検出 → 前ゲーム最終遷移を terminal (target=0) で学習
  if (game !== lastGame) {
    if (prevAfter) learn(prevAfter, -value(prevAfter));
    lastGame = game;
    prevAfter = null;
  }

  const valid = game.getValidMoves();
  if (valid.length === 0) {
    if (prevAfter) { learn(prevAfter, -value(prevAfter)); prevAfter = null; }
    return null;
  }

  // 各有効手の afterstate (タイル追加前) と即時報酬を評価し greedy 選択
  let bestDir = null, bestEval = -Infinity, bestAfter = null, bestReward = 0;
  for (const d of valid) {
    const sim = game.simulateMove(d);       // { board: 2D実値, score: 累積, changed }
    const reward = sim.score - score;
    const after = toLog2(sim.board);
    const ev = reward + value(after);
    if (ev > bestEval) {
      bestEval = ev; bestDir = d; bestAfter = after; bestReward = reward;
    }
  }

  // afterstate TD(0): 前手の afterstate を (今の報酬 + 今の afterstate 価値) に向けて更新
  if (prevAfter) {
    const target = bestReward + value(bestAfter);
    learn(prevAfter, target - value(prevAfter));
  }

  prevAfter = bestAfter;
  return bestDir;
}

// ── テスト用 named export (default の chooseMove には影響しない) ──
export { SYMS, TUPLES, value, learn, toLog2 };
