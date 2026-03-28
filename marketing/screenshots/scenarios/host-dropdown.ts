import { Page } from 'playwright';
import { wait, displayContent } from '../utils/launch';
import { captureScreenshot } from '../utils/capture';

const TERMINAL_CONTENT = [
  'Welcome to Ubuntu 22.04.3 LTS (GNU/Linux 5.15.0-91-generic x86_64)',
  '',
  '  System load:  0.42              Processes:           187',
  '  Memory usage: 34%               Users logged in:     2',
  '  Disk usage:   28%               IPv4 address:        10.0.1.42',
  '',
  'Last login: Thu Mar 27 09:15:22 2026 from 192.168.1.100',
  'deploy@prod-web-01:~$ uptime',
  ' 14:32:01 up 47 days,  3:21,  2 users,  load average: 0.42, 0.38, 0.35',
  'deploy@prod-web-01:~$ df -h /',
  'Filesystem      Size  Used Avail Use% Mounted on',
  '/dev/sda1       100G   28G   72G  28% /',
  'deploy@prod-web-01:~$',
].join('\n');

const FAKE_HOSTS = {
  ssh: ['bastion', 'dev-server', 'gpu-cluster', 'prod-db-01', 'prod-web-01', 'staging-01'],
  docker: ['nginx-proxy', 'postgres-db', 'redis-cache'],
  recent: [
    { type: 'ssh' as const, host: 'prod-web-01', lastUsed: '2026-03-27T14:30:00Z' },
    { type: 'docker' as const, host: 'postgres-db', lastUsed: '2026-03-27T12:15:00Z' },
    { type: 'ssh' as const, host: 'staging-01', lastUsed: '2026-03-26T18:00:00Z' },
  ],
};

export async function captureHostDropdown(window: Page): Promise<void> {
  console.log('[scenario:host-dropdown] Setting up host dropdown screenshot...');
  await wait(3000);

  await displayContent(window, TERMINAL_CONTENT, '/tmp/host-dropdown.txt');

  const tabId = await window.evaluate(() => {
    const api = (window as any).screenshotMode;
    return api ? api.getState().activeTabId : '';
  }) as string;

  await window.evaluate(async (args: { tabId: string }) => {
    const api = (window as any).screenshotMode;
    if (!api) return;
    await api.setPinnedHost(args.tabId, 'ssh', 'prod-web-01');
    await api.renameTab(args.tabId, 'prod-web-01');
  }, { tabId });
  await wait(500);

  await window.evaluate(async (data: typeof FAKE_HOSTS) => {
    const api = (window as any).screenshotMode;
    if (api) await api.setHostDropdownData(data);
  }, FAKE_HOSTS);
  await wait(300);

  const addButton = window.locator('button.icon-button:has-text("+")');
  await addButton.click({ button: 'right' });
  await wait(800);

  const sshCategory = window.locator('text=SSH Hosts');
  if (await sshCategory.isVisible()) {
    await sshCategory.hover();
    await wait(400);
  }

  console.log('[scenario:host-dropdown] Capturing screenshot...');
  await captureScreenshot(window, { name: 'host-dropdown' });
  console.log('[scenario:host-dropdown] Done');
}
