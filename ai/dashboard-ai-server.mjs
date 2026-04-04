import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const PORT = parseInt(process.env.PORT || '5050', 10);

const AGENTS = [
  { id: 'claude-code', name: 'Claude Code', port: 5001 },
  { id: 'codex', name: 'Codex (OpenAI)', port: 5002 },
  { id: 'gemini', name: 'Gemini CLI', port: 5003 },
  { id: 'local-cli', name: 'Local CLI (Qwen)', port: 5004 },
];

async function findLatestRunDir(agentId) {
  const resultsDir = join(PROJECT_ROOT, 'runs', agentId, 'ai', 'results');
  try {
    const entries = await readdir(resultsDir, { withFileTypes: true });
    const runDirs = entries
      .filter(e => e.isDirectory() && e.name.startsWith('run-'))
      .map(e => e.name)
      .sort()
      .reverse();
    return runDirs.length > 0 ? join(resultsDir, runDirs[0]) : null;
  } catch {
    return null;
  }
}

async function listRuns(agentId) {
  const resultsDir = join(PROJECT_ROOT, 'runs', agentId, 'ai', 'results');
  try {
    const entries = await readdir(resultsDir, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory() && e.name.startsWith('run-'))
      .map(e => e.name)
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

async function readProgressLog(agentId, runDir) {
  // If a specific run dir is provided, use it; otherwise find latest
  let logPath;
  if (runDir) {
    logPath = join(PROJECT_ROOT, 'runs', agentId, 'ai', 'results', runDir, 'progress.log');
  } else {
    const latestDir = await findLatestRunDir(agentId);
    if (!latestDir) {
      // Fallback: try legacy flat progress.log
      logPath = join(PROJECT_ROOT, 'runs', agentId, 'ai', 'results', 'progress.log');
    } else {
      logPath = join(latestDir, 'progress.log');
    }
  }
  try {
    const raw = await readFile(logPath, 'utf-8');
    const lines = raw.trim().split('\n').filter(Boolean);
    const entries = [];
    for (const line of lines) {
      try { entries.push(JSON.parse(line)); } catch { /* skip malformed */ }
    }
    return entries;
  } catch {
    return [];
  }
}

function deriveStatus(entries) {
  if (entries.length === 0) {
    return {
      status: 'waiting',
      games: 0,
      bestScore: 0,
      avgScore: 0,
      winRate: 0,
      wins: 0,
      bestHighest: 0,
      highest: 0,
      tileDistribution: {},
      gameHistory: [],
      recentAvgScore: 0,
      firstTimestamp: null,
      lastTimestamp: null,
      gamesPerSec: 0,
    };
  }

  let totalScore = 0, bestScore = 0, bestHighest = 0, wins = 0;
  let bestBoard = null, latestBoard = null;
  const tileDist = {};
  const gameHistory = [];

  for (const e of entries) {
    const s = e.score || 0;
    const h = e.highest || 0;
    totalScore += s;
    if (s > bestScore) { bestScore = s; if (e.board) bestBoard = e.board; }
    if (h > bestHighest) bestHighest = h;
    if (e.board) latestBoard = e.board;
    if (e.result === 'win') wins++;
    tileDist[h] = (tileDist[h] || 0) + 1;
    gameHistory.push({
      game: e.game || gameHistory.length + 1,
      score: s,
      highest: h,
      moves: e.moves || 0,
      result: e.result,
      timestamp: e.timestamp,
    });
  }

  const n = entries.length;
  const avgScore = Math.round(totalScore / n);
  const recent10 = gameHistory.slice(-10);
  const recentAvgScore = recent10.length > 0
    ? Math.round(recent10.reduce((s, g) => s + g.score, 0) / recent10.length) : 0;

  const firstTs = entries[0]?.timestamp || null;
  const lastTs = entries[n - 1]?.timestamp || null;

  // Games per second
  let gamesPerSec = 0;
  if (firstTs && lastTs && n > 1) {
    const elapsed = (new Date(lastTs).getTime() - new Date(firstTs).getTime()) / 1000;
    if (elapsed > 0) gamesPerSec = ((n - 1) / elapsed).toFixed(1);
  }

  return {
    status: 'playing',
    games: n,
    bestScore,
    avgScore,
    winRate: wins / n,
    wins,
    bestHighest,
    highest: bestHighest,
    tileDistribution: tileDist,
    gameHistory,
    recentAvgScore,
    firstTimestamp: firstTs,
    lastTimestamp: lastTs,
    gamesPerSec: Number(gamesPerSec),
    bestBoard,
    latestBoard,
  };
}

async function getFullStatus(runDir) {
  const results = [];
  for (const agent of AGENTS) {
    const entries = await readProgressLog(agent.id, runDir);
    const state = deriveStatus(entries);
    results.push({ ...agent, ...state });
  }
  return results;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/runs') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    });
    // Return union of all run dirs across agents
    const allRuns = new Set();
    for (const agent of AGENTS) {
      const runs = await listRuns(agent.id);
      runs.forEach(r => allRuns.add(r));
    }
    const sorted = [...allRuns].sort().reverse();
    res.end(JSON.stringify({ runs: sorted }));
    return;
  }

  if (url.pathname === '/api/status') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    });
    const runDir = url.searchParams.get('run') || undefined;
    const status = await getFullStatus(runDir);
    res.end(JSON.stringify({ agents: status, serverTime: new Date().toISOString() }));
    return;
  }

  if (url.pathname === '/' || url.pathname === '/dashboard.html') {
    try {
      const html = await readFile(join(__dirname, 'dashboard-ai.html'), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Could not read dashboard-ai.html');
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n  2048 AI Challenge Dashboard`);
  console.log(`  ----------------------------`);
  console.log(`  Dashboard : http://localhost:${PORT}`);
  console.log(`  API       : http://localhost:${PORT}/api/status`);
  console.log(`  Press Ctrl+C to stop.\n`);
});
