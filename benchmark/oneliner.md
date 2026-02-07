# One-Liner Prompt for AI Agents

Copy and paste the following as the **entire prompt** to any AI coding agent:

---

```
Clone the 2048 AI benchmark repo and play the game to reach the 2048 tile.

git clone https://github.com/lutelute/2048_project.git
cd 2048_project

Read benchmark/prompt.txt for the full instructions, then execute them. The file contains the complete game rules, setup steps, constraints, progress logging format, and strategy tips.

Key points:
- Run `npm install` and `npm run dev` to start the game server
- Use Playwright with `headless: false` (visible browser window) to play the game
- Read the board by taking screenshots, send arrow key presses to make moves
- Write progress to benchmark/results/progress.log (one JSON line per move)
- Save final screenshot as benchmark/results/final.png
- Do NOT modify source code, inject JS, or use Undo

Start now.
```

---

## Even Shorter (Minimal)

```
git clone https://github.com/lutelute/2048_project.git && cd 2048_project && cat benchmark/prompt.txt

Follow those instructions. Start now.
```
