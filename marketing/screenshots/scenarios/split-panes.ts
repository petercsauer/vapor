import { Page } from 'playwright';
import { wait } from '../utils/launch';
import { captureScreenshot } from '../utils/capture';

const LEFT_CONTENT = [
  '$ git log --oneline --graph --all',
  '* 4a2f8c1 (HEAD -> main) feat: add layout persistence',
  '* e7b3d09 fix: resolve split pane resize flicker',
  '|\\',
  '| * c91a4e2 (feature/tabs) feat: trackpad swipe',
  '| * 8f0e2b7 feat: auto-name tabs from git repo',
  '|/',
  '* 3d7c1f5 refactor: extract TabChrome component',
  '* a1e9b83 feat: add SSH host detection',
  '* 6c4f0d2 feat: Docker container badges',
  '* f8a2e71 feat: Monaco editor integration',
  '* 0b5d9c4 feat: file sidebar with git root',
  '* 2e8f1a6 initial commit',
  '$',
].join('\n');

const TOP_RIGHT_CONTENT = [
  '$ npm test',
  '',
  ' PASS  src/store/tabs.test.ts',
  ' PASS  src/store/panes.test.ts',
  ' PASS  src/store/editor.test.ts',
  ' PASS  src/main/pty-manager.test.ts',
  ' PASS  src/main/tab-namer.test.ts',
  '',
  'Test Suites:  5 passed, 5 total',
  'Tests:        47 passed, 47 total',
  'Time:         1.83s',
  '$',
].join('\n');

const BOTTOM_RIGHT_CONTENT = [
  '$ npm run dev',
  '',
  '> vapor@0.1.0 dev',
  '> webpack serve --mode development',
  '',
  'webpack compiled successfully in 2847ms',
  '[HMR] Waiting for update signal from WDS...',
  '[HMR] Connected.',
  'Listening on http://localhost:9000',
].join('\n');

export async function captureSplitPanes(window: Page): Promise<void> {
  console.log('[scenario:split-panes] Setting up...');
  await wait(5000);

  const fs = await import('fs');
  fs.writeFileSync('/tmp/sp-left.txt', LEFT_CONTENT);
  fs.writeFileSync('/tmp/sp-tr.txt', TOP_RIGHT_CONTENT);
  fs.writeFileSync('/tmp/sp-br.txt', BOTTOM_RIGHT_CONTENT);

  await window.keyboard.type('clear && cat /tmp/sp-left.txt', { delay: 0 });
  await window.keyboard.press('Enter');
  await wait(1000);

  console.log('[scenario:split-panes] Splitting horizontally...');
  await window.evaluate(async () => {
    const api = (window as any).screenshotMode;
    if (api) await api.splitPaneHorizontal();
  });
  await wait(2000);

  await window.keyboard.type('clear && cat /tmp/sp-tr.txt', { delay: 0 });
  await window.keyboard.press('Enter');
  await wait(1000);

  console.log('[scenario:split-panes] Splitting vertically...');
  await window.evaluate(async () => {
    const api = (window as any).screenshotMode;
    if (api) await api.splitPaneVertical();
  });
  await wait(2000);

  await window.keyboard.type('clear && cat /tmp/sp-br.txt', { delay: 0 });
  await window.keyboard.press('Enter');
  await wait(1500);

  console.log('[scenario:split-panes] Capturing screenshot...');
  await captureScreenshot(window, { name: 'split-panes' });
  console.log('[scenario:split-panes] Done');
}
