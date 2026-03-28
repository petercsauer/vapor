import { Page } from 'playwright';
import { wait } from '../utils/launch';
import { captureScreenshot } from '../utils/capture';
import * as fs from 'fs';

const VAPOR_ART = [
  '\u2588\u2588\u2557   \u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557',
  '\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557',
  '\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d',
  '\u255a\u2588\u2588\u2557 \u2588\u2588\u2554\u255d\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2550\u255d \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557',
  ' \u255a\u2588\u2588\u2588\u2588\u2554\u255d \u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551     \u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255d\u2588\u2588\u2551  \u2588\u2588\u2551',
  '  \u255a\u2550\u2550\u2550\u255d  \u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u255d      \u255a\u2550\u2550\u2550\u2550\u2550\u255d \u255a\u2550\u255d  \u255a\u2550\u255d',
];

const SUBTITLE = 'Press ENTER to start...';
const ART_WIDTH = 41;

export async function captureHero(window: Page): Promise<void> {
  console.log('[scenario:hero] Setting up VAPOR hero screenshot...');
  await wait(5000);

  // Clear any pending input
  await window.keyboard.press('Control+C');
  await wait(300);

  // Build a shell script that centers everything using tput
  const script = [
    '#!/bin/bash',
    'COLS=$(tput cols)',
    'LINES=$(tput lines)',
    `ART_W=${ART_WIDTH}`,
    `SUB_W=${SUBTITLE.length}`,
    'BLOCK_H=9',  // 6 art + 2 blank + 1 subtitle
    'TOP=$(( (LINES - BLOCK_H) / 2 - 1 ))',
    'ART_PAD=$(( (COLS - ART_W) / 2 ))',
    'SUB_PAD=$(( (COLS - SUB_W) / 2 ))',
    'clear',
    ...VAPOR_ART.map((line, i) =>
      `tput cup $((TOP + ${i})) $ART_PAD; printf '%s' '${line.replace(/'/g, "'\\''")}'`
    ),
    `tput cup $((TOP + 8)) $SUB_PAD; printf '%s' '${SUBTITLE}'`,
    // Position cursor at the bottom so the shell prompt renders there
    'tput cup $((LINES - 1)) 0',
  ].join('\n');

  fs.writeFileSync('/tmp/vapor-hero.sh', script, { mode: 0o755 });

  await window.keyboard.type('bash /tmp/vapor-hero.sh', { delay: 5 });
  await window.keyboard.press('Enter');
  await wait(3000);

  console.log('[scenario:hero] Capturing screenshot...');
  await captureScreenshot(window, { name: 'hero' });
  console.log('[scenario:hero] Done');
}
