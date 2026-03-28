import { _electron as electron, ElectronApplication, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

export interface VaporApp {
  app: ElectronApplication;
  window: Page;
}

export async function launchVapor(): Promise<VaporApp> {
  console.log('[launch] Starting Vapor in screenshot mode...');
  console.log('[launch] Current directory:', process.cwd());

  // Path to the project root
  const vaporPath = path.join(__dirname, '..', '..', '..');
  console.log('[launch] Vapor path:', vaporPath);

  // Use webpack output instead of packaged app
  // Try arch-specific path first, fall back to flat structure
  let mainPath = path.join(vaporPath, '.webpack', 'arm64', 'main', 'index.js');
  if (!fs.existsSync(mainPath)) {
    mainPath = path.join(vaporPath, '.webpack', 'main', 'index.js');
  }
  console.log('[launch] Main script path:', mainPath);

  if (!fs.existsSync(mainPath)) {
    throw new Error(`Webpack main script not found at: ${mainPath}`);
  }
  console.log('[launch] Main script exists, size:', fs.statSync(mainPath).size, 'bytes');

  console.log('[launch] Launching Electron with Playwright...');

  // Pass absolute path to config file via environment variable
  const configPath = path.join(vaporPath, '.vapor-screenshot-config.json');
  console.log('[launch] Config path:', configPath);

  const app = await electron.launch({
    args: [mainPath],
    env: {
      ...process.env,
      VAPOR_SCREENSHOT_MODE: '1',
      VAPOR_DEMO_MODE: '1',
      VAPOR_CONFIG_PATH: configPath,
      NODE_ENV: 'production',
      ELECTRON_ENABLE_LOGGING: '1',
      DEBUG: 'pw:api',
    },
    timeout: 60000,
  });

  console.log('[launch] Electron launched, waiting for window...');

  const window = await app.firstWindow({ timeout: 60000 });
  console.log('[launch] Got window, waiting for load...');

  await window.waitForLoadState('domcontentloaded');
  console.log('[launch] DOM loaded');

  await app.evaluate(async ({ BrowserWindow }, targetSize) => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].setBounds({
        x: 0,
        y: 0,
        width: targetSize.width,
        height: targetSize.height,
      });
    }
  }, { width: 1200, height: 800 });

  console.log('[launch] Window resized to 2400x1500');

  await wait(2000);
  console.log('[launch] Vapor launched successfully');

  return { app, window };
}

export async function closeVapor(vaporApp: VaporApp): Promise<void> {
  console.log('[launch] Closing Vapor...');
  await vaporApp.app.close();
}

export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function displayContent(
  window: Page,
  content: string,
  tempFile = '/tmp/vapor-sc.txt',
): Promise<void> {
  // Write file from the host Node.js process (ts-node), shared via /tmp
  const fs = await import('fs');
  fs.writeFileSync(tempFile, content);

  // Clear terminal and cat the file
  await window.keyboard.type(`clear && cat ${tempFile}`, { delay: 5 });
  await window.keyboard.press('Enter');
  await wait(1500);
}

export async function sendMenuAction(app: VaporApp['app'], action: string): Promise<void> {
  console.log(`[menu] Sending menu action: ${action}`);
  await app.evaluate(({ BrowserWindow }, menuAction) => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send('menu:action', menuAction);
    }
  }, action);
}
