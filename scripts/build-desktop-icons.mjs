import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const logo = await fs.readFile(new URL('../public/logo.svg', import.meta.url), 'utf8');
const paths = logo.match(/<path\b[^>]*\/>/g)?.slice(0, 2).join('\n');
if (!paths) throw new Error('Símbolo do Daniloom não encontrado no SVG.');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs><linearGradient id="surface" x1="0" y1="0" x2="0.6" y2="1"><stop stop-color="#26272e"/><stop offset="1" stop-color="#0c0d0f"/></linearGradient></defs>
<rect x="64" y="64" width="896" height="896" rx="200" fill="url(#surface)"/>
<rect x="65" y="65" width="894" height="894" rx="199" fill="none" stroke="#35363e" stroke-width="2"/>
<svg x="182" y="252" width="660" height="520" viewBox="0 0 76.11 60">${paths}</svg>
</svg>`;
await fs.writeFile(new URL('../public/desktop-icon.svg', import.meta.url), svg);
await sharp(Buffer.from(svg)).png().toFile(fileURLToPath(new URL('../public/desktop-icon.png', import.meta.url)));

const tray = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><svg x="2" y="5.4" width="32" height="25.2" viewBox="0 0 76.11 60">${paths.replaceAll('fill="white"', 'fill="black"')}</svg></svg>`;
await sharp(Buffer.from(tray)).png().toFile(fileURLToPath(new URL('../public/trayTemplate@2x.png', import.meta.url)));
await sharp(Buffer.from(tray)).resize(18, 18).png().toFile(fileURLToPath(new URL('../public/trayTemplate.png', import.meta.url)));

if (process.platform === 'darwin') {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'daniloom-icon-'));
  const iconset = path.join(temp, 'Daniloom.iconset');
  try {
    await fs.mkdir(iconset);
    for (const size of [16, 32, 128, 256, 512]) {
      await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(iconset, `icon_${size}x${size}.png`));
      await sharp(Buffer.from(svg)).resize(size * 2, size * 2).png().toFile(path.join(iconset, `icon_${size}x${size}@2x.png`));
    }
    execFileSync('iconutil', ['-c', 'icns', iconset, '-o', fileURLToPath(new URL('../assets/desktop-icon.icns', import.meta.url))]);
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
}
console.log('Ícones desktop e barra superior gerados a partir de public/logo.svg.');
