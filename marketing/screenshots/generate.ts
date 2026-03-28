import { launchVapor, closeVapor, wait } from './utils/launch';
import { processAllScreenshots } from './utils/process';
import { captureHero } from './scenarios/hero';
import { captureSplitPanes } from './scenarios/split-panes';
import { captureSmartAwareness } from './scenarios/smart-awareness';
import { captureFileEditor } from './scenarios/file-editor';
import { captureFileExplorer } from './scenarios/file-explorer';
import { captureHostDropdown } from './scenarios/host-dropdown';

async function resetForNextScenario(window: any) {
  // Dismiss any open dropdowns/popups first
  await window.keyboard.press('Escape');
  await wait(200);
  await window.keyboard.press('Escape');
  await wait(200);

  await window.evaluate(async () => {
    const api = (window as any).screenshotMode;
    if (api) await api.closeAllTabs();
  });
  await wait(2500);
}

async function main() {
  console.log('='.repeat(60));
  console.log('Vapor Screenshot Generation');
  console.log('='.repeat(60));
  console.log('Start time:', new Date().toISOString());
  console.log('='.repeat(60));

  let vaporApp;

  try {
    console.log('\n[main] Step 1: Launching Vapor...');
    vaporApp = await launchVapor();
    console.log('[main] Vapor launched successfully!\n');

    console.log('[main] Step 2: Running scenarios...\n');

    // 1. Hero
    console.log('[main] Scenario 1/5: Hero (DOOM)');
    await captureHero(vaporApp.window);
    console.log('[main] Hero screenshot complete!\n');
    await resetForNextScenario(vaporApp.window);

    // 2. Split panes
    console.log('[main] Scenario 2/5: Split panes');
    await captureSplitPanes(vaporApp.window);
    console.log('[main] Split panes screenshot complete!\n');
    await resetForNextScenario(vaporApp.window);

    // 3. SSH / Docker awareness
    console.log('[main] Scenario 3/6: SSH/Docker awareness');
    await captureSmartAwareness(vaporApp.window);
    console.log('[main] SSH awareness screenshot complete!\n');
    await resetForNextScenario(vaporApp.window);

    // 4. Host dropdown
    console.log('[main] Scenario 4/6: Host dropdown');
    await captureHostDropdown(vaporApp.window);
    console.log('[main] Host dropdown screenshot complete!\n');
    await resetForNextScenario(vaporApp.window);

    // 5. File editor
    console.log('[main] Scenario 5/6: File editor');
    await captureFileEditor(vaporApp.window);
    console.log('[main] File editor screenshot complete!\n');
    await resetForNextScenario(vaporApp.window);

    // 6. File explorer
    console.log('[main] Scenario 6/6: File explorer');
    await captureFileExplorer(vaporApp.window);
    console.log('[main] File explorer screenshot complete!\n');

    console.log('[main] All scenarios completed!\n');

    console.log('[main] Step 3: Processing screenshots...\n');
    await processAllScreenshots();

    console.log('\n' + '='.repeat(60));
    console.log('Screenshot generation complete!');
    console.log('End time:', new Date().toISOString());
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('ERROR during screenshot generation');
    console.error('='.repeat(60));
    console.error('Error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    console.error('='.repeat(60));
    process.exit(1);
  } finally {
    if (vaporApp) {
      console.log('\n[main] Cleaning up...');
      await closeVapor(vaporApp);
      console.log('[main] Cleanup complete');
    }
  }
}

main();
