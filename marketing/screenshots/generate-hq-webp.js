const sharp = require('sharp');
const path = require('path');

async function generateHQWebP() {
  const inputPath = path.join(__dirname, 'output', 'hero.png');
  const outputPath = path.join(__dirname, '..', 'website', 'public', 'screenshots', 'hero-hq.webp');

  await sharp(inputPath)
    .webp({ quality: 95, alphaQuality: 100, lossless: false })
    .toFile(outputPath);

  console.log('Generated high-quality WebP:', outputPath);
}

generateHQWebP().catch(console.error);
