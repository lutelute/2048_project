/**
 * Capture demo GIF of the 2048 game being played.
 *
 * Usage:
 *   1. Start dev server: npm run dev
 *   2. Run: node benchmark/capture-demo.mjs
 *
 * Produces: benchmark/assets/demo.gif, benchmark/assets/hero.png
 */

import { chromium } from 'playwright';
import { execSync } from 'child_process';
import { mkdirSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(__dirname, 'assets');
const FRAMES_DIR = join(__dirname, '_frames');
const GAME_URL = process.argv[2] || 'http://localhost:5173/2048_project/';

const STRATEGY = ['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp'];

async function main() {
  if (existsSync(FRAMES_DIR)) rmSync(FRAMES_DIR, { recursive: true });
  mkdirSync(FRAMES_DIR, { recursive: true });
  mkdirSync(ASSETS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 520, height: 680 } });

  await page.goto(GAME_URL, { waitUntil: 'networkidle', timeout: 10000 });
  await page.waitForTimeout(800);

  // Click first "New Game" button
  const btn = page.getByRole('button', { name: 'New Game' }).first();
  await btn.click({ timeout: 5000 });
  await page.waitForTimeout(400);

  let frame = 0;
  const maxMoves = 250;

  await snap(page, frame++);

  for (let move = 0; move < maxMoves; move++) {
    const scoreBefore = await getScore(page);
    let moved = false;

    for (const key of STRATEGY) {
      const tileCntBefore = await tileCount(page);
      await page.keyboard.press(key);
      await page.waitForTimeout(200);
      const tileCntAfter = await tileCount(page);
      const scoreAfter = await getScore(page);

      if (tileCntBefore !== tileCntAfter || scoreBefore !== scoreAfter) {
        moved = true;
        break;
      }
    }

    if (!moved) break;

    // Capture every 3rd move to keep GIF short
    if (move % 3 === 0) {
      await snap(page, frame++);
    }

    // Check game end overlay
    const overlayVisible = await page.evaluate(() => {
      const el = document.querySelector('.overlay-fade');
      return el ? getComputedStyle(el).opacity === '1' : false;
    });
    if (overlayVisible) {
      await page.waitForTimeout(400);
      await snap(page, frame++);
      break;
    }
  }

  // Hero screenshot (static)
  await page.screenshot({ path: join(ASSETS_DIR, 'hero.png') });

  await browser.close();

  // Build GIF
  console.log(`${frame} frames captured. Building GIF...`);
  try {
    execSync(
      `ffmpeg -y -framerate 8 -i "${FRAMES_DIR}/frame_%04d.png" ` +
      `-vf "scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" ` +
      `"${ASSETS_DIR}/demo.gif"`,
      { stdio: 'inherit' }
    );
    console.log(`GIF saved: ${ASSETS_DIR}/demo.gif`);
  } catch (e) {
    console.error('ffmpeg error:', e.message);
  }

  rmSync(FRAMES_DIR, { recursive: true });
  console.log('Done!');
}

async function snap(page, idx) {
  await page.screenshot({ path: join(FRAMES_DIR, `frame_${String(idx).padStart(4, '0')}.png`) });
}

async function getScore(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.text-\\[22px\\]');
    return el ? el.textContent : '0';
  });
}

async function tileCount(page) {
  return page.evaluate(() => document.querySelectorAll('.tile-slide').length);
}

main().catch(console.error);
