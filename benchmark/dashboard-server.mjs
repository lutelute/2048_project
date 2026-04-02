import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const PORT = parseInt(process.env.PORT || '4000', 10);

const AGENTS = [
  { id: 'claude-code', name: 'Claude Code', port: 4001 },
  { id: 'codex', name: 'Codex (OpenAI)', port: 4002 },
  { id: 'gemini', name: 'Gemini CLI', port: 4003 },
  { id: 'local-cli', name: 'Local CLI (Qwen)', port: 4004 },
];

async function readProgressLog(agentId) {
  const logPath = join(PROJECT_ROOT, 'runs', agentId, 'benchmark', 'results', 'progress.log');
  try {
    const raw = await readFile(logPath, 'utf-8');
    const lines = raw.trim().split('\n').filter(Boolean);
    const entries = [];
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line));
      } catch { /* skip malformed lines */ }
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
      score: 0,
      highest: 0,
      moves: 0,
      direction: null,
      firstTimestamp: null,
      lastTimestamp: null,
      milestones: [],
      result: null,
      games: 0,
      bestScore: 0,
      bestHighest: 0,
      gameHistory: [],
      winRate: 0,
      avgScore: 0,
      recentAvgScore: 0,
      tileDistribution: {},
    };
  }

  const last = entries[entries.length - 1];

  // Track best across all games + game history for RL charts
  let bestScore = 0;
  let bestHighest = 0;
  let games = 0;
  const seen = new Set();
  const milestones = [];
  const gameHistory = [];
  let wins = 0;
  const tileDistribution = {};

  for (const e of entries) {
    if ('result' in e) {
      games++;
      const gs = e.score || 0;
      const gh = e.highest || 0;
      if (gs > bestScore) bestScore = gs;
      if (gh > bestHighest) bestHighest = gh;
      if (e.result === 'win') wins++;
      gameHistory.push({
        game: games,
        score: gs,
        highest: gh,
        moves: e.moves || 0,
        result: e.result,
        timestamp: e.timestamp,
      });
      tileDistribution[gh] = (tileDistribution[gh] || 0) + 1;
    }
    const h = e.highest;
    if (h && !seen.has(h) && h >= 64) {
      seen.add(h);
      milestones.push({ tile: h, move: e.move || e.moves || 0 });
    }
  }

  const firstTimestamp = entries[0].timestamp || null;
  const lastTimestamp = last.timestamp || null;

  let lastMove = null;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].direction) { lastMove = entries[i]; break; }
  }
  const board = lastMove?.board || null;

  const isLastResult = 'result' in last;
  const currentScore = lastMove ? (lastMove.score || 0) : (last.score || 0);
  const currentHighest = Math.max(bestHighest, lastMove ? (lastMove.highest || 0) : (last.highest || 0));

  // RL metrics
  const winRate = games > 0 ? wins / games : 0;
  const totalScore = gameHistory.reduce((s, g) => s + g.score, 0);
  const avgScore = games > 0 ? Math.round(totalScore / games) : 0;
  const recent10 = gameHistory.slice(-10);
  const recentAvgScore = recent10.length > 0 ? Math.round(recent10.reduce((s, g) => s + g.score, 0) / recent10.length) : 0;

  return {
    status: isLastResult ? 'playing' : 'playing',
    score: currentScore,
    highest: currentHighest,
    moves: lastMove ? (lastMove.move || 0) : (last.moves || last.move || 0),
    direction: lastMove ? (lastMove.direction || null) : null,
    firstTimestamp,
    lastTimestamp,
    milestones,
    result: null,
    games,
    bestScore,
    bestHighest,
    board,
    gameHistory,
    winRate,
    avgScore,
    recentAvgScore,
    tileDistribution,
  };
}

async function getFullStatus() {
  const results = [];
  for (const agent of AGENTS) {
    const entries = await readProgressLog(agent.id);
    const state = deriveStatus(entries);
    results.push({
      ...agent,
      ...state,
    });
  }
  return results;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/status') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    });
    const status = await getFullStatus();
    res.end(JSON.stringify({ agents: status, serverTime: new Date().toISOString() }));
    return;
  }

  // Serve dashboard HTML
  if (url.pathname === '/' || url.pathname === '/dashboard.html') {
    try {
      const html = await readFile(join(__dirname, 'dashboard.html'), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Could not read dashboard.html');
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n  2048 AI Benchmark Dashboard`);
  console.log(`  ----------------------------`);
  console.log(`  Dashboard : http://localhost:${PORT}`);
  console.log(`  API       : http://localhost:${PORT}/api/status`);
  console.log(`  Press Ctrl+C to stop.\n`);
});
