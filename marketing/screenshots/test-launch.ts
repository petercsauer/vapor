import { launchVapor, closeVapor, wait } from './utils/launch';

async function test() {
  console.log('Testing Vapor launch...');

  try {
    const vaporApp = await launchVapor();
    console.log('✓ Vapor launched successfully');

    await wait(5000);

    console.log('✓ Waiting complete');

    await closeVapor(vaporApp);
    console.log('✓ Vapor closed successfully');

    console.log('\nTest passed!');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

test();
