/** Build the actual web app into Android assets. There is no second UI to port. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { mirrorWebFonts } from './mirror-web-fonts.mjs';

const mobile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontend = path.resolve(mobile, '../frontend');
const out = path.resolve(mobile, 'android/app/src/main/assets/talea');
if (path.dirname(out) !== path.resolve(mobile, 'android/app/src/main/assets') || path.basename(out) !== 'talea') {
  throw new Error('Unexpected Android asset directory');
}
const requireWeb = createRequire(path.join(frontend, 'package.json'));
const { build, loadEnv } = await import(pathToFileURL(requireWeb.resolve('vite')).href);
await import('./sync-brand.mjs');
const webEnv = loadEnv('production', frontend, 'VITE_');
const mobileEnv = loadEnv('production', mobile, 'EXPO_PUBLIC_');
const clerkKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || mobileEnv.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || webEnv.VITE_CLERK_PUBLISHABLE_KEY;
const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || mobileEnv.EXPO_PUBLIC_BACKEND_URL || 'https://backend-2-production-3de1.up.railway.app';
if (!clerkKey || !/^pk_(live|test)_/.test(clerkKey)) {
  throw new Error('Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in mobile/.env before building Android.');
}

await build({
  root: frontend, configFile: path.join(frontend, 'vite.config.ts'), mode: 'android',
  build: { outDir: out, emptyOutDir: true },
});
// Only public runtime configuration goes into the APK, just as on the website.
await fs.writeFile(path.join(out, 'config.js'), `window.ENV = ${JSON.stringify({ CLERK_PUBLISHABLE_KEY: clerkKey, BACKEND_URL: backendUrl })};\n`);
await mirrorWebFonts(frontend, out, path.join(mobile, '.cache/web-fonts'));
const files = {};
async function index(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) await index(absolute);
    else {
      const bytes = await fs.readFile(absolute);
      files[path.relative(out, absolute).replaceAll('\\', '/')] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    }
  }
}
await index(out);
await fs.writeFile(path.join(out, 'native-assets.json'), JSON.stringify({ source: 'frontend/', files }, null, 2));
console.log(`Android: ${Object.keys(files).length} original web files packaged (${(Object.values(files).reduce((n, f) => n + f.bytes, 0) / 1024 / 1024).toFixed(1)} MB).`);
