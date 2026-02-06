# 2048 AI Benchmark Challenge

## Overview

This benchmark evaluates an AI agent's ability to play and win the browser-based 2048 game by interacting with the GUI — no source code modification, no direct function calls, no shortcuts. The agent must observe the game state visually (via screenshots) and send keyboard inputs to play, just like a human would.

## Objective

**Reach the 2048 tile on a 5×5 board.**

The game is a sliding-tile puzzle where tiles merge when two of the same value collide. Starting from 2s and 4s, the agent must strategically combine tiles until a 2048 tile is created.

## Rules

1. **GUI-only interaction**: The agent must play the game through browser automation (e.g., Playwright, Puppeteer, or similar). Directly calling game logic functions, modifying source code, or injecting scripts into the page is prohibited.
2. **Allowed inputs**: Arrow keys (Up/Down/Left/Right) only — the same inputs available to a human player.
3. **Observation method**: The agent must take screenshots of the browser to read the current board state and score.
4. **No save/load exploitation**: The agent must not manipulate localStorage or use the Undo button. Each move is final.
5. **Single continuous game**: The agent plays one game from start (New Game) to completion. Restarting mid-game counts as a failure for that attempt.

## Setup

Clone the repository and start the game server:

```bash
git clone https://github.com/lutelute/2048_project.git
cd 2048_project
npm install
npm run dev
# Game is available at http://localhost:5173/2048_project/
```

## Challenge Prompt

Use the following prompt to instruct the AI agent:

---

### Prompt

```
You are tasked with playing and winning a 2048 game running in a browser.

## Game URL
http://localhost:5173/2048_project/

## Goal
Reach the **2048 tile** to win the game.

## How the Game Works
- The board is a 5×5 grid.
- Each turn, you press an arrow key (Up, Down, Left, Right) to slide all tiles in that direction.
- When two tiles of the same value collide, they merge into one tile with double the value (e.g., 2+2=4, 4+4=8, ..., 1024+1024=2048).
- After each move, a new tile (2 or 4) appears randomly on an empty cell.
- The game ends in victory when a 2048 tile is created.
- The game ends in defeat if no moves are possible.

## Your Approach
1. Launch a browser and navigate to the game URL.
2. Click "New Game" to start a fresh game.
3. On each turn:
   a. Take a screenshot to observe the current board state.
   b. Parse the tile values and their positions from the screenshot.
   c. Decide the best move using a strategy (see tips below).
   d. Press the corresponding arrow key.
   e. Wait briefly (~200ms) for the animation to complete before the next move.
4. Repeat until you reach 2048 or the game is over.
5. Take a final screenshot as proof of the result.

## Strategy Tips
- **Corner strategy**: Keep your highest-value tile in a corner (e.g., bottom-left). Build a descending chain along one edge.
- **Prefer two directions**: Favor moves in two primary directions (e.g., Down and Left). Only use Up or Right when absolutely necessary.
- **Avoid isolating large tiles**: Keep high-value tiles adjacent to each other so they can merge.
- **Monotonic rows/columns**: Try to keep rows or columns in decreasing order from the corner.
- **Plan ahead**: Consider what each move will do before pressing the key. Avoid moves that scatter tiles unpredictably.

## Output Requirements
- After each move, briefly log: move number, direction chosen, and current score.
- At the end, report:
  - Final result: Win or Loss
  - Total moves made
  - Final score
  - Highest tile achieved
  - A screenshot of the final board state
```

---

## Evaluation Criteria

| Metric | Description |
|---|---|
| **Success** | Did the agent reach the 2048 tile? (Pass/Fail) |
| **Highest Tile** | The maximum tile value achieved (2048, 1024, 512, etc.) |
| **Score** | The final game score |
| **Moves** | Total number of moves taken |
| **Efficiency** | Score per move (higher is better) |
| **Consistency** | Success rate over N attempts (suggested: 5 runs) |

## Difficulty Notes

- The 5×5 board is **easier** than the standard 4×4 board, providing more room to maneuver. A competent strategy should win most games.
- A random-move baseline wins ~5% of the time on a 5×5 board.
- A simple corner-hugging strategy wins ~70–90% of the time.
- The benchmark primarily tests the agent's ability to:
  1. **Perceive**: Accurately read tile values from screenshots
  2. **Reason**: Choose good moves based on board state
  3. **Act**: Execute browser automation reliably
  4. **Persist**: Continue a multi-step task over hundreds of moves

## Variants (Optional)

For harder benchmarks, modify `src/game/constants.ts`:

| Variant | Change | Difficulty |
|---|---|---|
| **Standard 4×4** | `GRID_SIZE = 4` | Harder |
| **Target 4096** | `WIN_VALUE = 4096` | Much Harder |
| **4×4 + 4096** | Both changes | Expert |
