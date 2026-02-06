# 2048 — AI Benchmark Platform

<p align="center">
  <img src="benchmark/assets/demo.gif" alt="2048 gameplay demo" width="480" />
</p>

<p align="center">
  <strong>Browser-based 2048 game designed as a benchmark for AI agents.</strong><br/>
  Can your AI play a real GUI game and win?
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-blue" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-blue" alt="Tailwind CSS 4" />
  <img src="https://img.shields.io/badge/Vite-7-purple" alt="Vite 7" />
</p>

---

## What is this?

A fully functional 2048 game (5×5 grid) built with React + TypeScript, purpose-built as an **AI agent benchmark**. The challenge: an AI must play the game through **real browser interaction** — reading the screen via screenshots, pressing arrow keys, and strategizing to reach 2048.

This tests an AI agent's ability to:

| Capability | Description |
|---|---|
| **Perceive** | Read tile values from browser screenshots |
| **Reason** | Choose optimal moves based on board state |
| **Act** | Execute browser automation (Playwright) reliably |
| **Persist** | Sustain a multi-step task over hundreds of moves |

<p align="center">
  <img src="benchmark/assets/hero.png" alt="2048 mid-game screenshot" width="400" />
</p>

## Quick Start

```bash
# Install
npm install

# Dev server
npm run dev

# Build
npm run build
```

## The Benchmark Challenge

### For AI Agents

Give your AI agent the prompt in [`benchmark/prompt.txt`](benchmark/prompt.txt). The agent must:

1. Launch a browser with Playwright
2. Navigate to the game
3. Read the board via screenshots
4. Play using only arrow key presses
5. Reach the 2048 tile

**No source code modification, no JS injection, no Undo button.**

### Full Specification

See [`benchmark/CHALLENGE.md`](benchmark/CHALLENGE.md) for:
- Detailed rules and constraints
- Evaluation criteria (success rate, score, efficiency)
- Strategy tips
- Difficulty variants (4×4, target 4096, etc.)

### Evaluation Metrics

| Metric | Description |
|---|---|
| Success | Reached 2048? (Pass/Fail) |
| Highest Tile | Max tile value achieved |
| Score | Final game score |
| Moves | Total arrow key presses |
| Efficiency | Score per move |
| Consistency | Win rate over 5 attempts |

### Difficulty Variants

Edit `src/game/constants.ts` to adjust:

| Variant | `GRID_SIZE` | `WIN_VALUE` | Difficulty |
|---|---|---|---|
| Default (5×5) | 5 | 2048 | Normal |
| Standard (4×4) | 4 | 2048 | Hard |
| Extended (5×5) | 5 | 4096 | Hard |
| Expert (4×4) | 4 | 4096 | Expert |

## Game Features

- 5×5 sliding tile grid
- Smooth CSS animations (slide, appear, merge)
- Keyboard (Arrow keys + WASD) and touch/swipe input
- Score tracking with localStorage persistence
- Undo (single step)
- Win/Game Over overlays
- Fully responsive (mobile-friendly)

## Generating Demo Assets

To regenerate the GIF and screenshots:

```bash
npm run dev &
node benchmark/capture-demo.mjs http://localhost:5173/2048_project/
```

Requires: [Playwright](https://playwright.dev/), [ffmpeg](https://ffmpeg.org/)

## Tech Stack

- **React 19** + **TypeScript 5.9**
- **Vite 7** (build tool)
- **Tailwind CSS v4** (`@tailwindcss/vite` plugin)
- **GitHub Pages** (auto-deploy via GitHub Actions)

## Project Structure

```
src/
  game/         # Pure game logic (no React dependency)
    types.ts    # Type definitions (Tile, Direction, GameState)
    constants.ts # Grid size, colors, timing
    logic.ts    # Core functions: move, merge, canMove, hasWon
  hooks/        # React hooks
    useGame.ts  # Main state management
    useKeyboard.ts # Arrow key / WASD input
    useSwipe.ts # Touch swipe detection
  components/   # UI components
    Board.tsx   # Grid + tile layer + overlay
    Tile.tsx    # Individual tile with animations
    Header.tsx  # Title + score display
    Controls.tsx # New Game + Undo buttons
    GameOverlay.tsx # Win/Lose overlay
  utils/
    storage.ts  # localStorage helpers
benchmark/
  CHALLENGE.md  # Full benchmark specification
  prompt.txt    # Copy-paste prompt for AI agents
  capture-demo.mjs # GIF generation script
  assets/       # Demo GIF + screenshots
```

## License

MIT
