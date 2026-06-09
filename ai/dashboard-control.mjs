/**
 * ダッシュボード共通: Run / Reset 制御ルート
 *
 * 4000番台・5000番台のダッシュボードサーバーで共通だった /api/run・/api/reset を一本化する。
 * 各サーバーは config でレースの起動スクリプト・引数・リセットコマンドの差分だけを渡す。
 *
 *   if (await handleControlRoute(req, res, url, config)) return;
 *
 * config:
 *   projectRoot     : プロジェクトルート (cwd)
 *   launchScript    : 起動スクリプトの絶対パス
 *   buildLaunchArgs : (params) => string[]   リクエストbody → 起動引数 (検証込み)
 *   buildLaunchEnv? : (params) => env        省略時は process.env
 *   resetCmd        : リセット用 bash -c コマンド (dashboard自身のポートはkillしないこと)
 */
import { spawn } from 'node:child_process';

// コマンド実行API (run/stop/reset) は same-origin のダッシュボードからのみ呼ばれる。
// Access-Control-Allow-Origin を付けない = 別オリジンの Webページからは叩けない (CSRF的保護)。
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export async function handleControlRoute(req, res, url, config) {
  const { projectRoot, launchScript, buildLaunchArgs, buildLaunchEnv, resetCmd, stopCmd } = config;

  // POST /api/run — レースを detached 起動 (launch-*.sh が自身のdashboardを再起動するためブラウザ側で数秒後リロード)
  if (url.pathname === '/api/run' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let params = {};
    try { params = JSON.parse(body || '{}'); } catch { /* defaults */ }
    const args = buildLaunchArgs(params);
    const env = buildLaunchEnv ? buildLaunchEnv(params) : process.env;
    const child = spawn('bash', [launchScript, ...args], { cwd: projectRoot, env, detached: true, stdio: 'ignore' });
    child.unref();
    res.writeHead(200, JSON_HEADERS);
    res.end(JSON.stringify({ ok: true, action: 'run', args }));
    return true;
  }

  // POST /api/reset — エージェント/評価プロセスを停止し結果をクリア (dashboard自身は維持)
  if (url.pathname === '/api/reset' && req.method === 'POST') {
    await new Promise((resolve) => {
      const c = spawn('bash', ['-c', resetCmd], { cwd: projectRoot, stdio: 'ignore' });
      c.on('close', resolve); c.on('error', resolve);
    });
    res.writeHead(200, JSON_HEADERS);
    res.end(JSON.stringify({ ok: true, action: 'reset' }));
    return true;
  }

  // POST /api/stop — レースを停止するが結果は保持する (一時停止/途中経過の確認用)
  if (url.pathname === '/api/stop' && req.method === 'POST' && stopCmd) {
    await new Promise((resolve) => {
      const c = spawn('bash', ['-c', stopCmd], { cwd: projectRoot, stdio: 'ignore' });
      c.on('close', resolve); c.on('error', resolve);
    });
    res.writeHead(200, JSON_HEADERS);
    res.end(JSON.stringify({ ok: true, action: 'stop' }));
    return true;
  }

  return false;
}

// 起動引数の検証ヘルパー (両サーバーで共用)
export function clampInt(v, min, max, dflt) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : dflt;
}
