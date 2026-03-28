import { Page } from 'playwright';
import { wait } from '../utils/launch';
import { captureScreenshot } from '../utils/capture';

export async function captureSSH(window: Page): Promise<void> {
  console.log('[scenario:ssh] Setting up SSH screenshot...');

  await wait(5000);

  // SSH to localhost - this should show the green SSH tag after connection
  console.log('[scenario:ssh] Connecting via SSH to localhost...');
  await window.keyboard.type('ssh localhost "uname -a && hostname && uptime"');
  await wait(200);
  await window.keyboard.press('Enter');
  await wait(6000); // Wait for SSH to connect and run command

  // The tab namer should detect the SSH connection and add the green tag
  console.log('[scenario:ssh] Waiting for SSH detection...');
  await wait(2000);

  console.log('[scenario:ssh] Letting everything settle...');
  await wait(1000);

  console.log('[scenario:ssh] Capturing screenshot...');
  await captureScreenshot(window, {
    name: 'ssh',
  });

  console.log('[scenario:ssh] SSH screenshot captured!');
}
