/**
 * 2048 Headless Game Engine
 *
 * Pure-JS 4x4 2048 engine for AI development.
 * No browser, no React — runs thousands of games per second.
 *
 * Usage:
 *   import { Game, DIRECTIONS } from './game-engine.mjs'
 */

const GRID_SIZE = 4;
const WIN_VALUE = 2048;
export const DIRECTIONS = ['up', 'down', 'left', 'right'];

export class Game {
  constructor(seed) {
    this.board = new Array(16).fill(0);
    this.score = 0;
    this.over = false;
    this.won = false;
    // seed を渡すと決定論的(mulberry32)、省略すると Math.random。再現可能なベンチマーク用。
    this._seed = (seed === undefined || seed === null) ? null : (seed >>> 0);
    this._addRandomTile();
    this._addRandomTile();
  }

  /** 内部RNG: seed があれば mulberry32 で決定論的に進める。clone でも状態が独立する。 */
  _random() {
    if (this._seed === null) return Math.random();
    let a = (this._seed = (this._seed + 0x6D2B79F5) | 0);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Get board as 4x4 array of actual values */
  getBoard() {
    const b = [];
    for (let r = 0; r < 4; r++) {
      b.push([this.board[r * 4], this.board[r * 4 + 1], this.board[r * 4 + 2], this.board[r * 4 + 3]]);
    }
    return b;
  }

  /** Get board as flat Uint8Array of log2 values (0 = empty, 1 = 2, 2 = 4, ...) */
  getBoardLog2() {
    const out = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      out[i] = this.board[i] === 0 ? 0 : Math.log2(this.board[i]);
    }
    return out;
  }

  getScore() { return this.score; }
  isGameOver() { return this.over; }
  hasWon() { return this.won; }

  getEmptyCells() {
    const cells = [];
    for (let i = 0; i < 16; i++) {
      if (this.board[i] === 0) cells.push({ row: Math.floor(i / 4), col: i % 4 });
    }
    return cells;
  }

  getHighestTile() {
    let max = 0;
    for (let i = 0; i < 16; i++) if (this.board[i] > max) max = this.board[i];
    return max;
  }

  /** Get list of valid move directions */
  getValidMoves() {
    return DIRECTIONS.filter(dir => {
      const g = this.clone();
      return g._applyMove(dir);
    });
  }

  /** Clone this game state (for simulation) */
  clone() {
    const g = Object.create(Game.prototype);
    g.board = this.board.slice();
    g.score = this.score;
    g.over = this.over;
    g.won = this.won;
    g._seed = this._seed;  // RNG状態を数値コピー → cloneのmove()は本筋の乱数列に影響しない
    return g;
  }

  /** Simulate a move without changing state. Returns { board, score, changed } */
  simulateMove(dir) {
    const g = this.clone();
    const changed = g._applyMove(dir);
    return { board: g.getBoard(), score: g.score, changed };
  }

  /** Apply a move. Returns true if the board changed. */
  move(dir) {
    if (this.over) return false;
    const changed = this._applyMove(dir);
    if (!changed) return false;
    this._addRandomTile();
    if (!this._canMove()) this.over = true;
    return true;
  }

  // ── Internal ──

  _applyMove(dir) {
    let changed = false;
    const b = this.board;

    const processLine = (indices) => {
      const vals = indices.map(i => b[i]).filter(v => v !== 0);
      const merged = [];
      let i = 0;
      while (i < vals.length) {
        if (i + 1 < vals.length && vals[i] === vals[i + 1]) {
          const v = vals[i] * 2;
          merged.push(v);
          this.score += v;
          if (v >= WIN_VALUE) this.won = true;
          i += 2;
        } else {
          merged.push(vals[i]);
          i++;
        }
      }
      while (merged.length < 4) merged.push(0);
      for (let j = 0; j < 4; j++) {
        if (b[indices[j]] !== merged[j]) changed = true;
        b[indices[j]] = merged[j];
      }
    };

    for (let line = 0; line < 4; line++) {
      let indices;
      switch (dir) {
        case 'left':  indices = [line * 4, line * 4 + 1, line * 4 + 2, line * 4 + 3]; break;
        case 'right': indices = [line * 4 + 3, line * 4 + 2, line * 4 + 1, line * 4]; break;
        case 'up':    indices = [line, line + 4, line + 8, line + 12]; break;
        case 'down':  indices = [line + 12, line + 8, line + 4, line]; break;
      }
      processLine(indices);
    }

    return changed;
  }

  _addRandomTile() {
    const empty = [];
    for (let i = 0; i < 16; i++) if (this.board[i] === 0) empty.push(i);
    if (empty.length === 0) return;
    const idx = empty[Math.floor(this._random() * empty.length)];
    this.board[idx] = this._random() < 0.9 ? 2 : 4;
  }

  _canMove() {
    for (let i = 0; i < 16; i++) {
      if (this.board[i] === 0) return true;
      const r = Math.floor(i / 4), c = i % 4;
      if (c < 3 && this.board[i] === this.board[i + 1]) return true;
      if (r < 3 && this.board[i] === this.board[i + 4]) return true;
    }
    return false;
  }
}
