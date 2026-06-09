/**
 * ダッシュボード操作 + 実データ描画の E2E テスト (Playwright / playwright-core)
 *   実行: node benchmark/dashboard.e2e.mjs [port] [server.mjs]
 *
 * 1. ダミーの progress.log を注入し、実データで leaderboard / 学習曲線(共通化したdrawScoreChart)が
 *    描画されることを実ブラウザで検証する (データ無し経路だけでなく、実データ経路を保証)。
 * 2. Run/Stop/Reset ボタンが正しく API を叩くこと、ページエラーが出ないことを検証する。
 *
 * 「curlのAPIは通るがブラウザでは動かない / 共通化で描画が壊れる」回帰を防ぐ。
 * 注: Stop/Reset は evaluate/play.mjs を kill するため、実行中の学習などがあるときは走らせないこと。
 */
import { chromium } from 'playwright-core';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import fs from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const PORT = process.argv[2] || '5050';
const SERVER = process.argv[3] || 'ai/dashboard-ai-server.mjs';

function findChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM;
  const globs = [
    '"$HOME/Library/Caches/ms-playwright"/chromium-*/chrome-mac*/*.app/Contents/MacOS/*',
    '"$HOME/.cache/ms-playwright"/chromium-*/chrome-linux*/chrome',
  ];
  for (const g of globs) {
    try {
      const r = execSync(`ls -d ${g} 2>/dev/null | head -1`, { shell: '/bin/bash' }).toString().trim();
      if (r) return r;
    } catch { /* try next */ }
  }
  return '';
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log(`  ✔ ${name}`); } else { fail++; console.log(`  ✘ ${name}`); } };

// ── 実データ描画検証用のダミーデータを注入 (run名を zzz 始まりにして最新runにする) ──
const testRun = join(PROJECT_ROOT, 'runs', 'claude-code', 'ai', 'results', 'run-zzz-e2e');
fs.mkdirSync(testRun, { recursive: true });
const lines = [];
for (let i = 1; i <= 12; i++) {
  lines.push(JSON.stringify({ result: i % 3 === 0 ? 'win' : 'loss', score: i * 2500, highest: 2048, moves: 100 + i, game: i, timestamp: `2026-01-01T00:${String(i).padStart(2, '0')}:00Z` }));
}
fs.writeFileSync(join(testRun, 'progress.log'), lines.join('\n'));
fs.writeFileSync(join(testRun, 'meta.json'), JSON.stringify({ algo: 'rl', games: 12 }));

const server = spawn('node', [SERVER], { cwd: PROJECT_ROOT, env: { ...process.env, PORT }, stdio: 'ignore', detached: true });
await sleep(1600);

const browser = await chromium.launch({ executablePath: findChromium(), headless: true });
const page = await browser.newPage();
const api = [];
const errors = [];
page.on('request', (r) => { const p = new URL(r.url()).pathname; if (p.startsWith('/api/')) api.push(`${r.method()} ${p}`); });
page.on('pageerror', (e) => errors.push(e.message));
page.on('dialog', (d) => d.accept());

try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  // refresh() は非同期なので、leaderboard に実データ(カンマ区切り数値)が描画されるまで待つ
  await page.waitForFunction(() => (document.querySelector('#leaderboard')?.textContent || '').includes(','), { timeout: 6000 }).catch(() => {});
  await sleep(300);

  // --- 実データ描画の検証 (共通化した drawScoreChart / buildLeaderboard が実データで動くか) ---
  const lbText = await page.locator('#leaderboard').textContent();
  check('leaderboard に実データの bestScore(30,000) が表示', lbText.includes('30,000'));
  check('学習曲線 canvas が描画されている', (await page.locator('canvas[id^="chart-"]').count()) >= 1);
  check('共通化した shared.js が読み込まれている', (await page.locator('script[src="/dashboard-shared.js"]').count()) === 1);

  // --- ボタンの存在と動作 ---
  check('Run ボタンが存在', (await page.locator('#btn-run').count()) === 1);
  check('Stop ボタンが存在', (await page.locator('#btn-stop').count()) === 1);
  check('Reset ボタンが存在', (await page.locator('#btn-reset').count()) === 1);

  await page.click('#btn-stop'); await sleep(900);
  check('Stop が POST /api/stop を叩く', api.includes('POST /api/stop'));

  await page.click('#btn-reset'); await sleep(900);
  check('Reset が POST /api/reset を叩く', api.includes('POST /api/reset'));

  if ((await page.locator('#ctl-algo').count()) > 0) {
    check('compare オプションが存在', (await page.locator('#ctl-algo option[value="compare"]').count()) > 0);
  }

  check('ページエラーなし', errors.length === 0);
} finally {
  console.log(`\nE2E: ${pass} passed, ${fail} failed` + (errors.length ? `\nerrors: ${errors.join('; ')}` : ''));
  await browser.close();
  try { process.kill(-server.pid); } catch { /* already gone */ }
  fs.rmSync(testRun, { recursive: true, force: true });   // ダミーデータを削除
}
process.exit(fail > 0 ? 1 : 0);
