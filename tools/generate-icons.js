const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

async function generate() {
  try {
    const svg192 = path.join(__dirname, '..', 'images', 'icon-192.svg');
    const svg512 = path.join(__dirname, '..', 'images', 'icon-512.svg');
    const out192 = path.join(__dirname, '..', 'images', 'icon-192.png');
    const out512 = path.join(__dirname, '..', 'images', 'icon-512.png');

    const s192 = await fs.readFile(svg192);
    await sharp(s192).resize(192, 192, { fit: 'contain' }).png().toFile(out192);

    const s512 = await fs.readFile(svg512);
    await sharp(s512).resize(512, 512, { fit: 'contain' }).png().toFile(out512);

    console.log('Generated:', out192, out512);
  } catch (err) {
    console.error('Failed to generate icons:', err.message);
    process.exit(1);
  }
}

generate();
