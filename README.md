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

A fully functional 2048 game (4x4 grid) built with React + TypeScript, purpose-built as an **AI agent benchmark**. The challenge: an AI must play the game through **real browser interaction** — reading the screen via screenshots, pressing arrow keys, and strategizing to reach 2048.

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

---

## Running the Benchmark (Step by Step)

### Prerequisites

- Node.js 20+
- An AI coding agent with shell access (Claude Code, Cursor, Cline, Aider, etc.)

### 1. Give this prompt to each AI agent

Open a separate terminal for each AI. Paste the following as the **entire prompt**:

```
Clone the 2048 AI benchmark repo and play the game to reach the 2048 tile.

git clone https://github.com/lutelute/2048_project.git
cd 2048_project

Read benchmark/prompt.txt for the full instructions, then execute them.
The file contains the complete game rules, setup steps, constraints,
progress logging format, and strategy tips.

Key points:
- Run `npm install` and `npm run dev` to start the game server
- Use Playwright with `headless: false` (visible browser window) to play
- Read the board by taking screenshots, send arrow key presses to make moves
- Write progress to benchmark/results/progress.log (one JSON line per move)
- Save final screenshot as benchmark/results/final.png
- Do NOT modify source code, inject JS, or use Undo

Start now.
```

That's it. Each agent will clone its own copy, install, launch the game, and start playing.

> See [`benchmark/oneliner.md`](benchmark/oneliner.md) for an even shorter variant.

### 2. Monitor progress in real time

```bash
tail -f /path/to/agent_*/2048_project/benchmark/results/progress.log
```

Each log line is JSON:

```json
{"move":42,"direction":"down","score":1280,"highest":256,"tiles":18,"timestamp":"..."}
```

When an agent finishes:

```json
{"result":"win","score":12345,"highest":2048,"moves":187,"timestamp":"..."}
```

### 3. Multi-agent race mode

Run 4 AI agents side-by-side with a real-time dashboard. Each agent plays the game in its own browser window using a heuristic AI, and results are streamed to a live dashboard.

```bash
# 1. Setup (one time only)
#    - Clones the repo into runs/{agent} directories
#    - Symlinks node_modules from the main project (no per-agent npm install)
#    - Deploys play.mjs with correct port for each agent
#    - Checks/installs Playwright Chromium
./benchmark/setup-race.sh

# 2. Launch race
./benchmark/launch-race.sh          # 100 games (default)
./benchmark/launch-race.sh 10       # 10 games
./benchmark/launch-race.sh 50       # 50 games

# 3. Stop all processes
./benchmark/stop-race.sh
```

After `launch-race.sh`, 4 browser windows open automatically and the dashboard is available at `http://localhost:4000`.

You can repeat `stop-race.sh` → `launch-race.sh` as many times as needed — it cleans up previous processes automatically.

| Port | Agent |
|------|-------|
| 4000 | Dashboard |
| 4001 | Claude Code |
| 4002 | Codex |
| 4003 | Gemini CLI |
| 4004 | [Local CLI](https://github.com/lutelute/local-cli) |

> **Note**: Requires Node.js 20+ and macOS. On Node 24, `playwright-core` is used instead of `playwright` to avoid an ESM import hang.
>
> **Note**: Setup and race execution are driven by AI agents (e.g. Claude Code). Because agent behavior is non-deterministic, exact results and execution flow may vary between runs.

### 4. AI Challenge mode (5000番台)

Each AI agent writes its own `chooseMove` function using any strategy (heuristics, Monte Carlo, reinforcement learning, etc.) and competes headlessly at thousands of games per second.

```bash
# 1. Setup (one time) — deploys game engine + baseline AI to each agent
./ai/setup-ai-race.sh

# 2. Launch evaluation
./ai/launch-ai-race.sh                        # 200 games, baseline (my-ai.mjs = expectimax)
./ai/launch-ai-race.sh 500 --algo montecarlo  # all agents use one algorithm
./ai/launch-ai-race.sh --algos rl,expectimax,montecarlo,greedy   # per-agent algorithms (compare!)

# Pre-train the RL agent (N-tuple TD) and save the model for reuse:
RL_SAVE=1 RL_LOAD=0 ALGO=rl TOTAL_GAMES=50000 node ai/evaluate.mjs

# 3. Stop
./ai/stop-ai-race.sh
```

Dashboard: `http://localhost:5050` — avg/max score, win rate, tile distribution, learning curves, mini boards. **Run / Stop / Reset buttons** control races from the browser; select **Algo = compare** to pit all algorithms against each other.

Available algorithms (`ai/algorithms/`): `random`, `greedy`, `montecarlo`, `expectimax`, and `rl` (N-tuple TD learning — **~33k avg / 77% win rate** after ~250k games of pre-training, surpassing expectimax; with `RL_SAVE`/`RL_LOAD` model persistence so the trained model is reused).

#### How the RL agent learns (`rl.mjs`)

The RL agent is an **N-tuple network with afterstate TD(0)** — the classic 2048 RL method (Szubert & Jaśkowski 2014), implemented in pure JS with zero dependencies:

- **Value function**: V(afterstate) approximated by 12 lookup tables (4 rows + 4 columns + 4 2×2 squares, each a 4-tuple over log2 tile values → 16⁴ entries per table).
- **8-fold symmetry**: every board is evaluated/updated under all 8 symmetries of the square (4 rotations × 2 reflections), sharing weights for sample efficiency and generalization.
- **Move selection**: greedy over `immediate reward + V(afterstate)` for each valid move.
- **TD(0) update — every single move**: after choosing a move, the previous afterstate's value is nudged toward `reward + V(current afterstate)`; at game end it is nudged toward 0 (terminal).

**Learning is always on and happens in real time** — playing *is* training. There is no separate "inference mode". What differs between runs is only where the weights start and whether they are persisted:

| Mode | Command | Weights start from | Saved? |
|---|---|---|---|
| Default (dashboard **Run** with `rl`) | `--algo rl` | pre-trained `rl-model.bin` (deployed by setup) | no — learning continues in-memory, discarded at exit |
| Learn from zero (watch the curve grow) | `RL_LOAD=0 ALGO=rl TOTAL_GAMES=1000 node ai/evaluate.mjs` | random (all zeros) | no |
| Pre-train & persist | `RL_SAVE=1 RL_LOAD=0 ALGO=rl TOTAL_GAMES=50000 node ai/evaluate.mjs` | random | yes — written to `rl-model.bin` on exit |

Env vars: `RL_LOAD=0` (skip loading the model), `RL_SAVE=1` (save on exit), `RL_MODEL=path` (model file path, default `ai/algorithms/rl-model.bin`).

**Reading the dashboard's Score Learning Curve**: it plots the per-game scores of the current run. Start from zero and you literally watch real-time learning — measured on this machine: avg score **2,274 → 6,912 within 1,000 games (~1.3 s)**, max tile 512 → 1024. Start from the pre-trained model and the curve starts already high (**~63% win rate, avg ~29k, max tile 4096**) because the deployed model has ~250k games of training baked in — while still continuing to learn online during the run.

Each agent implements `ai/my-ai.mjs` exporting:

```js
export default function chooseMove(board, score, game) {
  // board: 4x4 array, game: Game object with .simulateMove(), .clone(), etc.
  return 'down'; // 'up' | 'down' | 'left' | 'right'
}
```

See [`ai/challenge-prompt.txt`](ai/challenge-prompt.txt) for full rules and strategy hints.

---

## The Benchmark Challenge

### Rules

- **GUI-only**: Must use browser automation (Playwright). No source code modification, no JS injection.
- **Screenshot-based**: Must read the board visually from screenshots.
- **Arrow keys only**: Same inputs as a human player.
- **No Undo**: Each move is final.
- **Single game**: Play from "New Game" to Win/Loss.

### Evaluation Metrics

| Metric | Description |
|---|---|
| Success | Reached 2048? (Pass/Fail) |
| Highest Tile | Max tile value achieved |
| Score | Final game score |
| Moves | Total arrow key presses |
| Efficiency | Score per move |
| Consistency | Win rate over N attempts |

### Difficulty Variants

Edit `src/game/constants.ts` to adjust:

| Variant | `GRID_SIZE` | `WIN_VALUE` | Difficulty |
|---|---|---|---|
| Default (4x4) | 4 | 2048 | Normal |
| Easy (5x5) | 5 | 2048 | Easy |
| Extended (4x4) | 4 | 4096 | Hard |
| Expert (5x5 + 4096) | 5 | 4096 | Expert |

### Full Specification

See [`benchmark/CHALLENGE.md`](benchmark/CHALLENGE.md) for detailed rules, strategy tips, and evaluation criteria.

---

## Game Features

- 4x4 sliding tile grid
- Smooth CSS animations (slide, appear, merge)
- Keyboard (Arrow keys + WASD) and touch/swipe input
- Score tracking with localStorage persistence
- Undo (single step)
- Win/Game Over overlays
- Fully responsive (mobile-friendly)

## Tech Stack

- **React 19** + **TypeScript 5.9**
- **Vite 7** (build tool)
- **Tailwind CSS v4** (`@tailwindcss/vite` plugin)
- **GitHub Pages** (auto-deploy via GitHub Actions)

## Project Structure

```
src/
  game/           # Pure game logic (no React dependency)
    types.ts      # Type definitions
    constants.ts  # Grid size, colors, timing
    logic.ts      # Core functions: move, merge, canMove, hasWon
  hooks/          # React hooks
    useGame.ts    # Main state management
    useKeyboard.ts # Arrow key / WASD input
    useSwipe.ts   # Touch swipe detection
  components/     # UI components
    Board.tsx, Tile.tsx, Header.tsx, Controls.tsx, GameOverlay.tsx
  utils/
    storage.ts    # localStorage helpers
benchmark/
  prompt.txt      # Prompt to give to AI agents
  oneliner.md     # One-liner version of the prompt
  CHALLENGE.md    # Full benchmark specification
  play.mjs        # Preset AI auto-play script (single instance)
  dashboard-server.mjs  # Real-time race dashboard server
  dashboard.html  # Dashboard UI
  summarize.mjs   # Result aggregation
  setup-race.sh   # Multi-agent race setup (clone, symlink, Playwright)
  launch-race.sh  # Race launcher (servers + agents + dashboard)
  stop-race.sh    # Stop all race processes
  watch.sh        # Real-time log monitor
  capture-demo.mjs # Demo GIF generation
  assets/         # demo.gif, hero.png
  results/        # Agent output (progress.log, final.png) — gitignored
ai/
  game-engine.mjs       # Headless 2048 engine
  evaluate.mjs          # AI evaluation runner
  my-ai.mjs             # Baseline AI (expectimax) — agents replace this
  challenge-prompt.txt  # Challenge rules for AI agents
  dashboard-ai-server.mjs # Dashboard server (:5050)
  dashboard-ai.html     # Dashboard UI
  setup-ai-race.sh      # AI challenge setup
  launch-ai-race.sh     # AI challenge launcher
  stop-ai-race.sh       # AI challenge stop
runs/             # Per-agent cloned repos — gitignored
```

---

## Architecture: Three Tiers

This project has three tiers of AI benchmarking, each progressively harder:

```
┌─────────────────────────────────────────────────────────────┐
│  4000番台 — Browser Race (Demo)                              │
│  AI plays via Playwright (screenshot → arrow keys)          │
│  Tests: perception, browser automation, persistence         │
│  Ports: 4000-4004  |  Dashboard: localhost:4000             │
├─────────────────────────────────────────────────────────────┤
│  5000番台 — Headless Challenge (Showcase)                    │
│  Preset expectimax AI runs headlessly at high speed         │
│  Tests: heuristic quality, search depth, speed              │
│  Ports: 5050  |  Dashboard: localhost:5050                  │
├─────────────────────────────────────────────────────────────┤
│  6000番台 — AI Self-Improve                                  │
│  AI agents design & train their own algorithms from scratch │
│  Orchestrator monitors + intervenes on stalls               │
│  Tests: algorithm design, learning, iteration speed         │
│  Port: 6050  |  Dashboard: localhost:6050                   │
└─────────────────────────────────────────────────────────────┘
```

### 5. AI Self-Improve mode (6000番台)

The ultimate benchmark: each AI coding agent (Claude Code, Codex, Gemini CLI, [Local CLI](https://github.com/lutelute/local-cli)) receives only the game engine API and a goal — **design, implement, and iteratively improve a 2048 AI from scratch**.

```bash
# 1. Setup (resets all agents to random baseline)
./ai/self-improve/setup.sh

# 2. Launch race (opens terminal per agent + dashboard)
./ai/self-improve/launch.sh

# 3. Stop (dashboard only — close agent terminals manually)
./ai/self-improve/stop.sh
```

Dashboard: `http://localhost:6050` — same visualization as 5000-series (score charts, tile distribution, mini board).

> **Note**: Setup and execution are driven by AI agents. Because agent behavior is non-deterministic, exact results and execution flow may vary between runs. The orchestrator (you or Claude) monitors the dashboard and intervenes only when an agent stalls or fails to start — the actual AI improvement work is done by each agent independently.

**How it works:**

1. Each agent gets `ai/game-engine.mjs` (the Game API) and a unified instruction prompt
2. The agent must **independently** choose an algorithm (heuristics, expectimax, MCTS, TD learning, N-tuple networks, etc.)
3. The agent implements `chooseMove()`, runs evaluation, reads the results, and **self-improves** in a loop
4. An **orchestrator** watches the dashboard and intervenes when agents stall:
   - Re-inputs the prompt if an agent hasn't started
   - Nudges stuck agents to continue their improvement loop
   - Does NOT write AI code — that's each agent's job

**What makes this different from 5000番台:**

| | 5000番台 | 6000番台 |
|---|---|---|
| AI source | Pre-written baseline | Agent writes from scratch |
| Iteration | Single evaluation | Design → evaluate → improve loop |
| Learning | None (static heuristic) | Agent discovers algorithms autonomously |
| Orchestrator | None | Monitors + intervenes on stalls |
| Goal | Showcase results | Observe the *process* of AI development |

| Port | Usage |
|------|-------|
| 6050 | Dashboard |

**Evaluation criteria:**

| Metric | Description |
|---|---|
| Final win rate | How reliably the agent's AI reaches 2048 |
| Iteration speed | How fast the agent improves (win rate over time) |
| Algorithm sophistication | Depth of the approach (heuristic → search → learning) |
| Code quality | Readability and correctness of the agent's implementation |
| Self-diagnosis | Can the agent identify why it's losing and fix it? |

**Target:** Each agent should reach >80% win rate through self-improvement, starting from zero.

---

## Testing

```bash
npm test               # unit tests (game-engine + logic.ts parity + RL symmetry + run-control — 67 tests)
npm run test:sh        # bash -n syntax check for all tier scripts (4000/5000/6000)
npm run test:e2e       # 5000-tier dashboard E2E (Playwright, real data rendering + buttons)
npm run test:e2e:4000  # 4000-tier dashboard E2E (buttons incl. Stop/Reset click-through)
npm run test:e2e:6000  # 6000-tier dashboard E2E (same server on its production port 6050)
```

CI (`.github/workflows/test.yml`) runs all of the above on every push / PR.

**Reproducibility**: set `SEED` to make evaluation deterministic, e.g. `SEED=42 ./ai/launch-ai-race.sh --algo greedy`. Tile spawns are fully seeded; expectimax/montecarlo carry internal randomness, so bit-exact reproducibility holds for deterministic algorithms.

## License

MIT
