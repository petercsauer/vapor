import { Page } from 'playwright';
import { wait, displayContent } from '../utils/launch';
import { captureScreenshot } from '../utils/capture';

const SERVER_TS = `import express from "express";
import { logger } from "./utils/logger";
import { authMiddleware } from "./middleware/auth";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(authMiddleware);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.get("/api/users/:id", async (req, res) => {
  const user = await db.users.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "not found" });
  res.json(user);
});

app.listen(PORT, () => {
  logger.info(\`Server running on port \${PORT}\`);
});
`;

const TERMINAL_CONTENT = [
  '$ npm test -- --watch',
  '',
  ' PASS  src/server.test.ts',
  ' PASS  src/routes.test.ts',
  '',
  'Test Suites:  2 passed, 2 total',
  'Tests:        12 passed, 12 total',
  'Time:         0.84s',
  '',
  'Watching for file changes...',
].join('\n');

export async function captureFileEditor(window: Page): Promise<void> {
  console.log('[scenario:file-editor] Setting up...');
  await wait(5000);

  const fs = await import('fs');
  const path = await import('path');
  const dirs = [
    '/tmp/vapor-demo/src/utils',
    '/tmp/vapor-demo/src/middleware',
    '/tmp/vapor-demo/tests',
  ];
  for (const d of dirs) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync('/tmp/vapor-demo/src/server.ts', SERVER_TS);
  const touchFiles = [
    'src/utils/logger.ts', 'src/middleware/auth.ts', 'src/routes.ts',
    'tests/server.test.ts', 'package.json', 'tsconfig.json', 'README.md',
  ];
  for (const f of touchFiles) {
    const p = path.join('/tmp/vapor-demo', f);
    if (!fs.existsSync(p)) fs.writeFileSync(p, '');
  }

  await window.keyboard.type('cd /tmp/vapor-demo', { delay: 0 });
  await window.keyboard.press('Enter');
  await wait(1000);

  await window.evaluate(async () => {
    const api = (window as any).screenshotMode;
    if (api) await api.setCwd('/tmp/vapor-demo');
  });
  await wait(300);

  console.log('[scenario:file-editor] Opening sidebar...');
  await window.evaluate(async () => {
    const api = (window as any).screenshotMode;
    if (api) await api.toggleSidebar();
  });
  await wait(1500);

  console.log('[scenario:file-editor] Expanding folders...');
  await window.evaluate(async () => {
    const api = (window as any).screenshotMode;
    if (!api) return;
    await api.expandPath('/tmp/vapor-demo', '/tmp/vapor-demo/src/server.ts');
    await api.expandPath('/tmp/vapor-demo', '/tmp/vapor-demo/tests');
  });
  await wait(1500);

  console.log('[scenario:file-editor] Opening editor...');
  await window.evaluate(async () => {
    const api = (window as any).screenshotMode;
    if (api) await api.openEditor('/tmp/vapor-demo/src/server.ts');
  });
  await wait(3000);

  await displayContent(window, TERMINAL_CONTENT, '/tmp/fe-term.txt');

  console.log('[scenario:file-editor] Capturing screenshot...');
  await captureScreenshot(window, { name: 'file-editor' });
  console.log('[scenario:file-editor] Done');
}
