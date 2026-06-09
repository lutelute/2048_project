/**
 * ダッシュボード操作の E2E テスト (Playwright / playwright-core)
 *   実行: node benchmark/dashboard.e2e.mjs [port] [server.mjs]
 *
 * dashboard サーバーを起動し、実ブラウザから Run/Stop/Reset ボタンが正しく API を叩くか、
 * compare オプションが存在するか、ページエラーが出ないかを検証する。
 * 「curlのAPIは通るがブラウザでは動かない」事故 (キャッシュ等) を防ぐリグレッションテスト。
 *
 * 注: Stop/Reset は evaluate/play.mjs を kill するため、RL事前学習などの実行中は走らせないこと。
 */
import { chromium } from 'playwright-core';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const PORT = process.argv[2] || '5050';
const SERVER = process.argv[3] || 'ai/dashboard-ai-server.mjs';

function findChromium() {
  // macOS / Linux(CI) 両対応。環境変数で明示指定も可
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
  await sleep(400);

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
}
process.exit(fail > 0 ? 1 : 0);
