import { Page } from 'playwright';
import { wait, displayContent } from '../utils/launch';
import { captureScreenshot } from '../utils/capture';

const TREE_OUTPUT = [
  '$ tree',
  '.',
  '├── config/',
  '│   └── webpack.config.ts',
  '├── docs/',
  '├── src/',
  '│   ├── components/',
  '│   │   ├── Header.tsx',
  '│   │   ├── Sidebar.tsx',
  '│   │   ├── SplitView.tsx',
  '│   │   ├── Tab.tsx',
  '│   │   └── TerminalPane.tsx',
  '│   ├── main/',
  '│   │   ├── index.ts',
  '│   │   └── pty-manager.ts',
  '│   ├── store/',
  '│   │   ├── editor.ts',
  '│   │   ├── sidebar.ts',
  '│   │   └── tabs.ts',
  '│   └── utils/',
  '│       ├── ipc.ts',
  '│       └── logger.ts',
  '├── tests/',
  '│   ├── panes.test.ts',
  '│   └── tabs.test.ts',
  '├── package.json',
  '├── tsconfig.json',
  '└── README.md',
  '',
  '9 directories, 16 files',
  '$',
].join('\n');

export async function captureFileExplorer(window: Page): Promise<void> {
  console.log('[scenario:file-explorer] Setting up...');

  // Dismiss any lingering dropdowns from previous scenarios
  await window.keyboard.press('Escape');
  await wait(300);
  await window.keyboard.press('Escape');
  await wait(300);
  // Click on terminal area to clear focus from any dropdown trigger
  await window.click('body', { position: { x: 600, y: 400 } });
  await wait(500);

  await wait(5000);

  const fs = await import('fs');
  const dirs = [
    '/tmp/vapor-app/src/components', '/tmp/vapor-app/src/store',
    '/tmp/vapor-app/src/utils', '/tmp/vapor-app/src/main',
    '/tmp/vapor-app/tests', '/tmp/vapor-app/config', '/tmp/vapor-app/docs',
  ];
  for (const d of dirs) fs.mkdirSync(d, { recursive: true });
  const files = [
    'src/components/Header.tsx', 'src/components/Tab.tsx',
    'src/components/SplitView.tsx', 'src/components/Sidebar.tsx',
    'src/components/TerminalPane.tsx', 'src/store/tabs.ts',
    'src/store/editor.ts', 'src/store/sidebar.ts',
    'src/utils/logger.ts', 'src/utils/ipc.ts',
    'src/main/index.ts', 'src/main/pty-manager.ts',
    'tests/tabs.test.ts', 'tests/panes.test.ts',
    'config/webpack.config.ts', 'package.json', 'tsconfig.json', 'README.md',
  ];
  for (const f of files) {
    const p = '/tmp/vapor-app/' + f;
    if (!fs.existsSync(p)) fs.writeFileSync(p, '');
  }

  await window.keyboard.type('cd /tmp/vapor-app', { delay: 0 });
  await window.keyboard.press('Enter');
  await wait(1000);

  await window.evaluate(async () => {
    const api = (window as any).screenshotMode;
    if (api) await api.setCwd('/tmp/vapor-app');
  });
  await wait(300);

  console.log('[scenario:file-explorer] Opening sidebar...');
  await window.evaluate(async () => {
    const api = (window as any).screenshotMode;
    if (api) await api.toggleSidebar();
  });
  await wait(1500);

  console.log('[scenario:file-explorer] Expanding folders...');
  await window.evaluate(async () => {
    const api = (window as any).screenshotMode;
    if (!api) return;
    await api.expandPath('/tmp/vapor-app', '/tmp/vapor-app/src/components/TerminalPane.tsx');
    await api.expandPath('/tmp/vapor-app', '/tmp/vapor-app/src/main/pty-manager.ts');
    await api.expandPath('/tmp/vapor-app', '/tmp/vapor-app/src/store/tabs.ts');
    await api.expandPath('/tmp/vapor-app', '/tmp/vapor-app/src/utils/logger.ts');
    await api.expandPath('/tmp/vapor-app', '/tmp/vapor-app/tests/panes.test.ts');
    await api.expandPath('/tmp/vapor-app', '/tmp/vapor-app/config/webpack.config.ts');
  });
  await wait(1500);

  await displayContent(window, TREE_OUTPUT, '/tmp/fe-tree.txt');

  console.log('[scenario:file-explorer] Capturing screenshot...');
  await captureScreenshot(window, { name: 'file-explorer' });
  console.log('[scenario:file-explorer] Done');
}
