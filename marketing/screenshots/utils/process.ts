import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';

export async function processScreenshot(inputPath: string): Promise<void> {
  console.log(`[process] Processing ${path.basename(inputPath)}...`);
  console.log(`[process] Input path: ${inputPath}`);

  const outputDir = path.join(__dirname, '..', '..', 'website', 'public', 'screenshots');
  console.log(`[process] Output directory: ${outputDir}`);

  if (!fs.existsSync(outputDir)) {
    console.log(`[process] Creating output directory...`);
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const baseName = path.basename(inputPath, '.png');
  console.log(`[process] Base name: ${baseName}`);

  const image = sharp(inputPath);

  const metadata = await image.metadata();
  const width = metadata.width || 2560;
  const height = metadata.height || 1600;
  console.log(`[process] Original dimensions: ${width}x${height}`);

  console.log(`[process] Generating @2x version...`);
  await image
    .clone()
    .png({ quality: 90, compressionLevel: 9 })
    .toFile(path.join(outputDir, `${baseName}@2x.png`));

  console.log(`[process] Generating 1x version...`);
  await image
    .clone()
    .resize(Math.floor(width / 2), Math.floor(height / 2))
    .png({ quality: 90, compressionLevel: 9 })
    .toFile(path.join(outputDir, `${baseName}.png`));

  console.log(`[process] Generating WebP version...`);
  await image
    .clone()
    .resize(Math.floor(width / 2), Math.floor(height / 2))
    .webp({ quality: 85 })
    .toFile(path.join(outputDir, `${baseName}.webp`));

  console.log(`[process] Generating HQ WebP version...`);
  await image
    .clone()
    .webp({ quality: 90 })
    .toFile(path.join(outputDir, `${baseName}-hq.webp`));

  console.log(`[process] Generating thumbnail...`);
  await image
    .clone()
    .resize(Math.floor(width / 4), Math.floor(height / 4))
    .webp({ quality: 80 })
    .toFile(path.join(outputDir, `${baseName}-thumb.webp`));

  console.log(`[process] ✓ Generated 4 versions of ${baseName}`);
}

export async function processAllScreenshots(): Promise<void> {
  const outputDir = path.join(__dirname, '..', 'output');
  console.log(`[process] Looking for screenshots in: ${outputDir}`);

  if (!fs.existsSync(outputDir)) {
    console.log('[process] Output directory does not exist - no screenshots to process');
    return;
  }

  const allFiles = fs.readdirSync(outputDir);
  console.log(`[process] Found ${allFiles.length} files in output directory:`, allFiles);

  const files = allFiles.filter(f => f.endsWith('.png'));
  console.log(`[process] Found ${files.length} PNG screenshots to process`);

  if (files.length === 0) {
    console.log('[process] No PNG screenshots found to process');
    return;
  }

  for (const file of files) {
    const filePath = path.join(outputDir, file);
    console.log(`[process] Processing file ${files.indexOf(file) + 1}/${files.length}: ${file}`);
    await processScreenshot(filePath);
  }

  console.log('[process] ✓ All screenshots processed!');
}
