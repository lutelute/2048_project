# 2048_project メモ

<!-- 2026-06-11: ~/Documents/GitHub/.claude/CLAUDE.md から移動（親フォルダ置きだと全プロジェクトに注入されるため） -->

## プロジェクト概要
- **リポジトリ**: https://github.com/lutelute/2048_project
- **GitHub Pages**: https://lutelute.github.io/2048_project/
- **目的**: AIエージェントのベンチマークプラットフォーム。AIがPlaywrightでブラウザを操作して2048をプレイする。

## 技術スタック
- React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS v4
- GitHub Actions で自動デプロイ (GitHub Pages)

## 現在の設定
- **GRID_SIZE = 4** (標準4×4ボード)
- **WIN_VALUE = 2048**
- localStorage キー: `best2048_4x4`

## ファイル構成
```
src/game/     types.ts, constants.ts, logic.ts (純粋関数、React非依存)
src/hooks/    useGame.ts, useKeyboard.ts, useSwipe.ts
src/components/ Board.tsx, Tile.tsx, Header.tsx, Controls.tsx, GameOverlay.tsx, ScoreBox.tsx
src/utils/    storage.ts
benchmark/
  setup-race.sh     — 初回セットアップ (runs/クローン + symlink + play.mjs配置)
  launch-race.sh    — レース起動 (vite preview ×4 + dashboard + 全エージェント)
  stop-race.sh      — レース停止
  dashboard-server.mjs — ダッシュボードサーバー (:4000)
  dashboard.html    — ダッシュボードUI
  play.mjs          — 単体テスト用プレイスクリプト
  prompt.txt        — AIに渡すメインプロンプト
  oneliner.md       — コピペ用の一発プロンプト
  CHALLENGE.md      — ベンチマーク仕様書
  watch.sh          — 複数エージェントのログ監視
  capture-demo.mjs  — デモGIF生成 (Playwright + ffmpeg)
  summarize.mjs     — 結果集計
  assets/           — demo.gif, hero.png
runs/               — エージェント別クローン (※.gitignore済)
.github/workflows/deploy.yml — GitHub Pages自動デプロイ
```

## 4000番台レース (マルチエージェント同時プレイ)

### 初回セットアップ (一度だけ)
```bash
./benchmark/setup-race.sh
```
- runs/ に4エージェント分のリポジトリをクローン
- node_modules はメインプロジェクトからシンボリックリンク (npm install 不要)
- play.mjs を各エージェントに配置 (ポート固定)
- Playwright Chromium の自動確認・インストール

### レース起動
```bash
./benchmark/launch-race.sh          # 100ゲーム (デフォルト)
./benchmark/launch-race.sh 10       # 10ゲーム
./benchmark/launch-race.sh 50       # 50ゲーム
```
- 配信サーバー4つ (vite preview = ビルド済みdistの静的配信で軽量) + ダッシュボード + 全エージェント自動起動
- ブラウザウィンドウ4つが開いて自動プレイ
- ダッシュボード http://localhost:4000 でリアルタイム監視
- `NO_OPEN=1` でブラウザの自動オープンを抑制 (テスト用、launch系3スクリプト共通)
- 起動は数秒。残骸 (旧vite/npx詰まり/ポート占有) があっても自動クリーンアップして起動する
- サーバー類のログは `logs/` に保存 (build.log, vite-PORT.log, dashboard-PORT.log)

### レース停止
```bash
./benchmark/stop-race.sh
```

### ポート割り当て
| ポート | 用途 |
|--------|------|
| 4000 | ダッシュボード |
| 4001 | claude-code |
| 4002 | codex |
| 4003 | gemini |
| 4004 | local-cli |

### 注意事項
- Node 24 では `playwright` パッケージの import がハングする。`playwright-core` を使用すること
- `npx` は解決レイヤーで遅延・ロック競合する (vite 4連発起動が数分詰まった実績)。スクリプトでは `node_modules/.bin/` のバイナリを直接実行すること
- setup-race.sh は冪等 (何度実行しても安全)
- launch-race.sh は既存プロセスを自動クリーンアップしてから起動

## 5000番台 (ヘッドレスAIチャレンジ)

### 初回セットアップ (一度だけ)
```bash
./ai/setup-ai-race.sh
```
- runs/{agent}/ai/ に game-engine, evaluate, challenge-prompt, ベースラインAI を配置
- 既に my-ai.mjs があれば上書きしない

### 評価起動
```bash
./ai/launch-ai-race.sh              # 200ゲーム (デフォルト, my-ai.mjs)
./ai/launch-ai-race.sh 50           # 50ゲーム
./ai/launch-ai-race.sh --algo montecarlo   # 全員モンテカルロ
./ai/launch-ai-race.sh --algo all          # 4アルゴリズム対決
./ai/launch-ai-race.sh 100 --algo greedy   # 100ゲーム + greedy
```
- ダッシュボード http://localhost:5050 でリアルタイム監視
- ヘッドレス実行（ブラウザ不要、高速）

### アルゴリズム選択
| アルゴリズム | 特徴 | 平均スコア |
|---|---|---|
| `random` | ランダム手（最弱ベースライン） | ~1,000-2,000 |
| `greedy` | 即時スコア最大化 | ~3,000-5,000 |
| `montecarlo` | ランダムプレイアウト80回 | ~8,000-15,000 |
| `expectimax` | Expectimax + snake heuristic（最強） | ~20,000+ |

- `--algo all`: claude-code=random, codex=greedy, gemini=montecarlo, local-cli=expectimax
- アルゴリズムファイル: `ai/algorithms/*.mjs`

### 停止
```bash
./ai/stop-ai-race.sh
```

### ポート割り当て
| ポート | 用途 |
|--------|------|
| 5050 | ダッシュボード |

### ベースラインAI
- ai/my-ai.mjs: Expectimax + snake heuristic (avg ~20,000, 勝率 ~40-50%)

## 6000番台 (AI自己改善チャレンジ)

### 初回セットアップ
```bash
./ai/self-improve/setup.sh
```
- 全エージェントの my-ai.mjs をランダムベースラインにリセット
- game-engine, evaluate, challenge-prompt を配置

### レース起動
```bash
./ai/self-improve/launch.sh
```
- 各AI CLI (claude, codex, gemini) のターミナルを開く
- AIが自分でコードを書いて evaluate → 改善のループを回す
- ダッシュボード http://localhost:6050 でリアルタイム監視

### 停止
```bash
./ai/self-improve/stop.sh
```
- ダッシュボードを停止（各CLIターミナルは手動で閉じる）

### ポート: 6050 (ダッシュボード)

## 未完了・TODO
- 特になし。3層とも運用可能
