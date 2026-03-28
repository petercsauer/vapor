const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function generateAllHQWebPs() {
  const inputDir = path.join(__dirname, 'output');
  const outputDir = path.join(__dirname, '..', 'website', 'public', 'screenshots');

  const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.png'));

  for (const file of files) {
    const baseName = path.basename(file, '.png');
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, `${baseName}-hq.webp`);

    await sharp(inputPath)
      .webp({ quality: 95, alphaQuality: 100, lossless: false })
      .toFile(outputPath);

    console.log(`Generated: ${baseName}-hq.webp`);
  }

  console.log('All high-quality WebPs generated!');
}

generateAllHQWebPs().catch(console.error);
