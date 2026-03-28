import { Page } from 'playwright';
import { wait, displayContent } from '../utils/launch';
import { captureScreenshot } from '../utils/capture';

const LOCAL_CONTENT = [
  '~/projects/vapor $ ls -la',
  'total 24',
  'drwxr-xr-x  12 user  staff   384 Mar 19 14:30 .',
  'drwxr-xr-x   6 user  staff   192 Mar 19 10:00 ..',
  '-rw-r--r--   1 user  staff  1247 Mar 19 14:30 package.json',
  '-rw-r--r--   1 user  staff   892 Mar 19 14:22 tsconfig.json',
  'drwxr-xr-x   8 user  staff   256 Mar 19 14:22 src',
  'drwxr-xr-x   4 user  staff   128 Mar 19 12:15 tests',
  'drwxr-xr-x   3 user  staff    96 Mar 19 10:00 config',
  '~/projects/vapor $',
].join('\n');

const SSH_CONTENT = [
  'Welcome to Ubuntu 22.04.3 LTS (GNU/Linux 5.15.0-91-generic x86_64)',
  '',
  '  System load:  0.42              Processes:           187',
  '  Memory usage: 34%               Users logged in:     2',
  '  Disk usage:   28%               IPv4 address:        10.0.1.42',
  '',
  'Last login: Wed Mar 19 14:23:01 2026 from 192.168.1.100',
  'deploy@prod-web-01:~$',
].join('\n');

const DOCKER_CONTENT = [
  '/ # hostname',
  'vapor-api',
  '/ # ps aux',
  'PID   USER     TIME  COMMAND',
  '    1 node     0:02  node dist/server.js',
  '   42 node     0:00  sh',
  '/ #',
].join('\n');

export async function captureSmartAwareness(window: Page): Promise<void> {
  console.log('[scenario:ssh] Setting up SSH/Docker awareness...');
  await wait(3000);

  await displayContent(window, LOCAL_CONTENT, '/tmp/ssh-local.txt');

  console.log('[scenario:ssh] Creating SSH tab...');
  const tab2Id = await window.evaluate(async () => {
    const api = (window as any).screenshotMode;
    if (!api) return '';
    return await api.createTab();
  }) as string;
  await wait(2500);

  await window.evaluate(async (tabId: string) => {
    const api = (window as any).screenshotMode;
    if (api) {
      await api.setTabSSHHost(tabId, 'prod-web-01');
      await api.renameTab(tabId, 'prod-web-01');
    }
  }, tab2Id);
  await wait(300);

  await displayContent(window, SSH_CONTENT, '/tmp/ssh-remote.txt');

  console.log('[scenario:ssh] Creating Docker tab...');
  const tab3Id = await window.evaluate(async () => {
    const api = (window as any).screenshotMode;
    if (!api) return '';
    return await api.createTab();
  }) as string;
  await wait(2500);

  await window.evaluate(async (tabId: string) => {
    const api = (window as any).screenshotMode;
    if (api) {
      await api.setTabContainerName(tabId, 'vapor-api');
      await api.renameTab(tabId, 'vapor-api');
    }
  }, tab3Id);
  await wait(300);

  await displayContent(window, DOCKER_CONTENT, '/tmp/ssh-docker.txt');

  await window.evaluate(async () => {
    const api = (window as any).screenshotMode;
    if (api) await api.switchToTab(1);
  });
  await wait(1500);

  const state = await window.evaluate(() => {
    const api = (window as any).screenshotMode;
    return api ? api.getState() : null;
  });
  console.log('[scenario:ssh] Store:', JSON.stringify(state));

  console.log('[scenario:ssh] Capturing screenshot...');
  await captureScreenshot(window, { name: 'ssh' });
  console.log('[scenario:ssh] Done');
}
