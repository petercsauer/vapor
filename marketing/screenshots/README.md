# Vapor Screenshot Automation

Automated screenshot generation using Playwright and Electron.

## Overview

This system generates high-quality, consistent screenshots of Vapor for the marketing website. Screenshots are captured in retina resolution and processed into multiple formats for web optimization.

## Setup

```bash
cd marketing/screenshots
npm install
```

## Usage

### Generate All Screenshots

```bash
npm run generate
```

This will:
1. Launch Vapor in screenshot mode
2. Run all scenario scripts
3. Capture screenshots
4. Process into multiple formats
5. Save to `marketing/website/public/screenshots/`

### Test Launch

```bash
npm run test
```

Tests that Vapor can be launched successfully in screenshot mode.

## How It Works

### 1. Screenshot Mode

Vapor is launched with environment variables:
- `VAPOR_SCREENSHOT_MODE=1` - Loads optimized config
- `VAPOR_DEMO_MODE=1` - Demo mode flag

### 2. Configuration

`.vapor-screenshot-config.json` provides:
- Larger fonts (16px vs 14px)
- Brighter colors for visibility
- Retina window size (2560x1600)

### 3. Scenarios

Each scenario script:
- Sets up specific layout
- Types commands
- Waits for rendering
- Captures screenshot

### 4. Processing

Screenshots are processed into:
- `@2x.png` - Full retina resolution
- `.png` - Standard resolution (50%)
- `.webp` - WebP format (50%, 85% quality)
- `-thumb.webp` - Thumbnail (25%, 80% quality)

## Adding New Scenarios

1. Create `scenarios/my-scenario.ts`:

```typescript
import { Page } from 'playwright';
import { wait } from '../utils/launch';
import { captureScreenshot } from '../utils/capture';

export async function captureMyScenario(window: Page): Promise<void> {
  // Setup your layout
  await window.keyboard.press('Meta+d');
  await wait(500);

  // Type commands
  await window.keyboard.type('echo "Hello"');
  await wait(200);

  // Capture
  await captureScreenshot(window, {
    name: 'my-scenario',
  });
}
```

2. Add to `generate.ts`:

```typescript
import { captureMyScenario } from './scenarios/my-scenario';

// In main():
await captureMyScenario(vaporApp.window);
```

## File Structure

```
marketing/screenshots/
├── scenarios/          # Screenshot scenario scripts
│   ├── hero.ts
│   ├── split-panes.ts
│   ├── file-editor.ts
│   ├── file-explorer.ts
│   ├── host-dropdown.ts
│   ├── smart-awareness.ts
│   └── ssh.ts
├── utils/             # Utilities
│   ├── launch.ts     # Launch Vapor
│   ├── capture.ts    # Capture screenshots
│   └── process.ts    # Process images
├── output/            # Raw screenshots
├── generate.ts        # Main entry point
├── test-launch.ts     # Test script
└── package.json
```

## Requirements

- macOS (for Vapor)
- Vapor built with `npm run package`
- Node.js 18+

## Troubleshooting

### "Cannot find Vapor app"

Build Vapor first:
```bash
cd ../..
npm run package
```

### "Screenshot mode config not found"

Ensure `.vapor-screenshot-config.json` exists in project root.

### Screenshots look wrong

Check:
1. Config is loading correctly (check console output)
2. Timing waits are sufficient
3. Vapor window is focused

## CI/CD

Screenshot generation can be integrated into CI workflows. See the marketing deployment guide for details.
