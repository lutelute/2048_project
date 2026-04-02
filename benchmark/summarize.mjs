#!/usr/bin/env node
/**
 * 2048 AI Benchmark — 結果集計
 *
 * Usage:
 *   node benchmark/summarize.mjs
 *
 * 各エージェントの progress.log を読み取り、結果を一覧表示する。
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');

const AGENTS = [
  { id: 'claude-code', name: 'Claude Code',    port: 4001 },
  { id: 'codex',       name: 'Codex (OpenAI)', port: 4002 },
  { id: 'gemini',      name: 'Gemini CLI',     port: 4003 },
  { id: 'local-cli',   name: 'Local CLI (Qwen)', port: 4004 },
];

async function readLog(agentId) {
  const logPath = join(PROJECT_ROOT, 'runs', agentId, 'benchmark', 'results', 'progress.log');
  try {
    const raw = await readFile(logPath, 'utf-8');
    const lines = raw.trim().split('\n').filter(Boolean);
    return lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch {
    return [];
  }
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${String(m % 60).padStart(2, '0')}m ${String(s % 60).padStart(2, '0')}s`;
  return `${m}m ${String(s % 60).padStart(2, '0')}s`;
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║            2048 AI Benchmark — Results Summary                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  const results = [];

  for (const agent of AGENTS) {
    const entries = await readLog(agent.id);

    if (entries.length === 0) {
      results.push({ ...agent, status: 'NOT STARTED', score: '-', highest: '-', moves: '-', duration: '-', efficiency: '-' });
      continue;
    }

    const last = entries[entries.length - 1];
    const isFinished = 'result' in last;

    const firstTs = entries[0].timestamp ? new Date(entries[0].timestamp).getTime() : null;
    const lastTs = last.timestamp ? new Date(last.timestamp).getTime() : null;
    const duration = (firstTs && lastTs) ? formatDuration(lastTs - firstTs) : '-';

    const score = isFinished ? last.score : (last.score || 0);
    const highest = isFinished ? last.highest : (last.highest || 0);
    const moves = isFinished ? last.moves : (last.move || entries.length);
    const efficiency = moves > 0 ? (score / moves).toFixed(1) : '-';

    let status;
    if (isFinished) {
      status = last.result === 'win' ? '🏆 WIN' : '❌ LOSS';
    } else {
      status = '⏳ PLAYING';
    }

    results.push({ ...agent, status, score, highest, moves, duration, efficiency });
  }

  // Table header
  const cols = [
    { key: 'name',       label: 'Agent',      width: 18 },
    { key: 'status',     label: 'Status',     width: 12 },
    { key: 'score',      label: 'Score',      width: 8,  align: 'right' },
    { key: 'highest',    label: 'Highest',    width: 8,  align: 'right' },
    { key: 'moves',      label: 'Moves',      width: 7,  align: 'right' },
    { key: 'efficiency', label: 'Eff.',       width: 7,  align: 'right' },
    { key: 'duration',   label: 'Duration',   width: 12, align: 'right' },
  ];

  const header = cols.map(c => c.label.padEnd(c.width)).join('  ');
  const divider = cols.map(c => '─'.repeat(c.width)).join('──');

  console.log(header);
  console.log(divider);

  for (const r of results) {
    const row = cols.map(c => {
      const val = String(r[c.key] ?? '-');
      return c.align === 'right' ? val.padStart(c.width) : val.padEnd(c.width);
    }).join('  ');
    console.log(row);
  }

  console.log(divider);

  // Winner
  const finished = results.filter(r => r.status.includes('WIN'));
  if (finished.length > 0) {
    const best = finished.sort((a, b) => (b.score || 0) - (a.score || 0))[0];
    console.log(`\n🥇 Best: ${best.name} — Score ${best.score}, ${best.moves} moves, ${best.duration}`);
  } else {
    const playing = results.filter(r => r.status.includes('PLAYING'));
    if (playing.length > 0) {
      console.log(`\n⏳ ${playing.length} agent(s) still playing...`);
    } else {
      console.log('\n No winners this round.');
    }
  }
  console.log('');
}

main();
