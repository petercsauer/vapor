import { Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';

export interface CaptureOptions {
  name: string;
  fullPage?: boolean;
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export async function captureScreenshot(
  window: Page,
  options: CaptureOptions
): Promise<string> {
  const outputDir = path.join(__dirname, '..', 'output');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `${options.name}.png`);

  console.log(`[capture] Capturing ${options.name}...`);

  const dimensions = await window.evaluate(() => {
    const doc = (globalThis as any).document;
    return {
      width: doc.documentElement.clientWidth,
      height: doc.documentElement.clientHeight,
    };
  });

  console.log(`[capture] Page dimensions: ${dimensions.width}x${dimensions.height}`);

  const tempPath = path.join(outputDir, `${options.name}-temp.png`);
  await window.screenshot({
    path: tempPath,
    type: 'png',
    clip: options.clip || {
      x: 0,
      y: 0,
      width: dimensions.width,
      height: dimensions.height,
    },
  });

  const width = dimensions.width;
  const height = dimensions.height;

  const cornerRadius = 12;
  const shadowBlur = 40;
  // const shadowOpacity = 0.25; // Reserved for future shadow implementation
  const shadowOffsetY = 10;
  const padding = shadowBlur;

  // const canvasWidth = width + (padding * 2); // Reserved for future canvas implementation
  // const canvasHeight = height + (padding * 2) + shadowOffsetY; // Reserved for future canvas implementation

  const mask = Buffer.from(
    `<svg width="${width}" height="${height}">
      <rect x="0" y="0" width="${width}" height="${height}"
            rx="${cornerRadius}" ry="${cornerRadius}" fill="white"/>
    </svg>`
  );

  const roundedImage = await sharp(tempPath)
    .resize(width, height)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const roundedMeta = await sharp(roundedImage).metadata();
  console.log(`[capture] Rounded image: ${roundedMeta.width}x${roundedMeta.height}`);

  const trafficLightsSvg = `
    <svg width="${width}" height="${height}">
      <g transform="translate(20, 20)">
        <circle cx="0" cy="0" r="6" fill="#FF5F57"/>
        <circle cx="20" cy="0" r="6" fill="#FFBD2E"/>
        <circle cx="40" cy="0" r="6" fill="#28CA42"/>
      </g>
    </svg>
  `;

  await sharp(roundedImage)
  .composite([
    {
      input: Buffer.from(trafficLightsSvg),
      top: 0,
      left: 0
    }
  ])
  .png()
  .toFile(outputPath);

  if (fs.existsSync(tempPath)) {
    fs.unlinkSync(tempPath);
  }

  console.log(`[capture] Saved to ${outputPath}`);

  return outputPath;
}
