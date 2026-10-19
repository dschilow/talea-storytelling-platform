/** Rasterize the web app's original SVGs for Android launcher/splash resources. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const mobile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.dirname(mobile);
const requireRepo = createRequire(path.join(repo, 'package.json'));
const { createCanvas, loadImage } = requireRepo('@napi-rs/canvas');
const brand = path.join(repo, 'frontend/public/brand');
async function render(name, target, width, height = width) {
  const image = await loadImage(await fs.readFile(path.join(brand, `${name}.svg`)));
  const canvas = createCanvas(width, height);
  canvas.getContext('2d').drawImage(image, 0, 0, width, height);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, canvas.toBuffer(target.endsWith('.webp') ? 'image/webp' : 'image/png'));
}
await fs.copyFile(path.join(repo, 'frontend/public/pwa-512x512.png'), path.join(mobile, 'assets/icon.png'));
await render('talea-adaptive-foreground-color', path.join(mobile, 'assets/adaptive-icon.png'), 1024);
await render('talea-splash-logo', path.join(mobile, 'assets/splash-icon.png'), 1024);
await render('talea-horizontal-primary', path.join(mobile, 'assets/talea-logo.png'), 920, 317);
const res = path.join(mobile, 'android/app/src/main/res');
for (const [density, scale] of [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]]) {
  for (const file of ['ic_launcher', 'ic_launcher_round']) await render('talea-app-icon-cream', path.join(res, `mipmap-${density}/${file}.webp`), Math.round(48 * scale));
  await render('talea-adaptive-foreground-color', path.join(res, `mipmap-${density}/ic_launcher_foreground.webp`), Math.round(108 * scale));
  await render('talea-splash-logo', path.join(res, `drawable-${density}/splashscreen_logo.png`), Math.round(200 * scale));
}
console.log('Android icons, logo and splash now use frontend/public/brand originals.');
