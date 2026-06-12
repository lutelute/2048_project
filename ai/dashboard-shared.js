// 4000/5000番台ダッシュボード共通JS — 重複排除のため抽出 (両HTMLで完全同一だった関数)。
// 普通の<script src>で読み込まれ、window スコープに定義される。

const AGENT_COLORS = {
  'claude-code': '#6c72ff',
  'codex': '#34d399',
  'gemini': '#fbbf24',
  'local-cli': '#f472b6',
};

function fmt(n) { return n.toLocaleString(); }

function drawScoreChart(canvas, history, agentColor) {
  if (!history || history.length < 2) {
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth * 2; canvas.height = 160;
    ctx.scale(2, 2);
    ctx.fillStyle = '#4a4e63'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Waiting for data...', canvas.width/4, 40);
    return;
  }
  const w = canvas.offsetWidth, h = 80;
  canvas.width = w * 2; canvas.height = h * 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);

  const scores = history.map(g => g.score);
  const maxS = Math.max(...scores, 1);
  const pad = {l:28, r:4, t:4, b:14};
  const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;

  // Grid lines
  ctx.strokeStyle = '#2a2e3d'; ctx.lineWidth = 0.5;
  for (let i = 0; i <= 3; i++) {
    const y = pad.t + (ch / 3) * i;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
    ctx.fillStyle = '#6b7089'; ctx.font = '7px monospace'; ctx.textAlign = 'right';
    ctx.fillText(fmt(Math.round(maxS * (1 - i/3))), pad.l - 3, y + 3);
  }

  // Moving average (window 5)
  const windowSize = Math.min(5, Math.floor(scores.length / 2)) || 1;
  const ma = [];
  for (let i = 0; i < scores.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const slice = scores.slice(start, i + 1);
    ma.push(slice.reduce((a,b)=>a+b,0) / slice.length);
  }

  // Draw MA line (thick, semi-transparent)
  if (ma.length >= 2) {
    ctx.strokeStyle = agentColor + '40'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < ma.length; i++) {
      const x = pad.l + (i / (scores.length - 1)) * cw;
      const y = pad.t + ch - (ma[i] / maxS) * ch;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Score line
  ctx.strokeStyle = agentColor; ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < scores.length; i++) {
    const x = pad.l + (i / (scores.length - 1)) * cw;
    const y = pad.t + ch - (scores[i] / maxS) * ch;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Win/loss dots
  for (let i = 0; i < history.length; i++) {
    const x = pad.l + (i / (scores.length - 1)) * cw;
    const y = pad.t + ch - (scores[i] / maxS) * ch;
    ctx.fillStyle = history[i].result === 'win' ? '#34d399' : '#f8717180';
    ctx.beginPath(); ctx.arc(x, y, history[i].result === 'win' ? 3 : 1.5, 0, Math.PI*2); ctx.fill();
  }

  // X axis label
  ctx.fillStyle = '#6b7089'; ctx.font = '7px monospace'; ctx.textAlign = 'center';
  ctx.fillText(`Game 1`, pad.l, h - 1);
  ctx.fillText(`${scores.length}`, w - pad.r, h - 1);
}

// ── 統一盤面コンポーネント (全ダッシュボード共通) ──
// 配色は React版ゲーム本体 src/game/constants.ts の TILE_COLORS / SUPER_TILE_COLOR と同値。
// 4000(ブラウザレース)〜6000(自己改善) でゲームの見た目を同一にする。
const BOARD_TILE_COLORS = {
  2:    { bg: '#eee4da', text: '#776e65' },
  4:    { bg: '#ede0c8', text: '#776e65' },
  8:    { bg: '#f2b179', text: '#f9f6f2' },
  16:   { bg: '#f59563', text: '#f9f6f2' },
  32:   { bg: '#f67c5f', text: '#f9f6f2' },
  64:   { bg: '#f65e3b', text: '#f9f6f2' },
  128:  { bg: '#edcf72', text: '#f9f6f2' },
  256:  { bg: '#edcc61', text: '#f9f6f2' },
  512:  { bg: '#edc850', text: '#f9f6f2' },
  1024: { bg: '#edc53f', text: '#f9f6f2' },
  2048: { bg: '#edc22e', text: '#f9f6f2' },
};
const BOARD_SUPER_COLOR = { bg: '#3c3a32', text: '#f9f6f2' };  // 4096以上
const BOARD_EMPTY_BG = 'rgba(238,228,218,0.35)';

function injectBoardStyles() {
  if (document.getElementById('shared-board-css')) return;
  const st = document.createElement('style');
  st.id = 'shared-board-css';
  st.textContent = [
    '.mini-board { display:grid; grid-template-columns:repeat(4,1fr); gap:3px;',
    '  background:#bbada0; border-radius:6px; padding:3px; aspect-ratio:1; }',
    '.mini-cell { display:flex; align-items:center; justify-content:center;',
    '  border-radius:4px; font-family:var(--mono, ui-monospace, monospace); font-weight:800;',
    '  aspect-ratio:1; transition:background 0.15s; }',
  ].join('\n');
  document.head.appendChild(st);
}

// board は 2次元配列 board[r][c] (実値)。null/不正は空盤面として描画。
function buildBoardHtml(board) {
  injectBoardStyles();
  const rows = (Array.isArray(board) && board.length === 4) ? board
    : [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  let html = '<div class="mini-board">';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const v = rows[r]?.[c] || 0;
      if (v === 0) {
        html += `<div class="mini-cell" style="background:${BOARD_EMPTY_BG}"></div>`;
      } else {
        const col = BOARD_TILE_COLORS[v] || BOARD_SUPER_COLOR;
        const fs = v >= 1024 ? '0.7rem' : v >= 128 ? '0.85rem' : '1rem';
        html += `<div class="mini-cell" style="background:${col.bg};color:${col.text};font-size:${fs}">${v}</div>`;
      }
    }
  }
  return html + '</div>';
}

function formatElapsed(first, last, server) {
  if (!first) return '--:--';
  const start = new Date(first).getTime();
  const end = last ? new Date(last).getTime() : new Date(server).getTime();
  let d = Math.max(0, Math.floor((end-start)/1000));
  const h=Math.floor(d/3600); d%=3600; const m=Math.floor(d/60); const s=d%60;
  if (h>0) return `${h}h${String(m).padStart(2,'0')}m`;
  return `${m}m${String(s).padStart(2,'0')}s`;
}

function trendArrow(avg, recent) {
  if (!avg || !recent) return '';
  const diff = recent - avg;
  const pct = avg > 0 ? Math.round((diff / avg) * 100) : 0;
  if (Math.abs(pct) < 3) return '';
  return diff > 0
    ? `<span style="color:var(--green);font-size:0.55rem"> +${pct}%</span>`
    : `<span style="color:var(--red);font-size:0.55rem"> ${pct}%</span>`;
}
