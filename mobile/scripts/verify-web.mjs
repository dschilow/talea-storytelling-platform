/** Verify every packaged public asset against its canonical frontend source. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const mobile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontend = path.resolve(mobile, '../frontend');
const out = path.join(mobile, 'android/app/src/main/assets/talea');
const manifest = JSON.parse(await fs.readFile(path.join(out, 'native-assets.json'), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
let checked = 0;
async function verify(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const source = path.join(dir, entry.name);
    if (entry.isDirectory()) await verify(source);
    else {
      const relative = path.relative(path.join(frontend, 'public'), source).replaceAll('\\', '/');
      assert.equal(manifest.files[relative]?.sha256, sha(await fs.readFile(source)), `Android public asset differs: ${relative}`);
      checked++;
    }
  }
}
await verify(path.join(frontend, 'public'));
for (const [file, expected] of Object.entries(manifest.files)) {
  const bytes = await fs.readFile(path.join(out, file));
  assert.equal(bytes.length, expected.bytes, file);
  assert.equal(sha(bytes), expected.sha256, file);
}
const config = await fs.readFile(path.join(out, 'config.js'), 'utf8');
const data = JSON.parse(config.slice(config.indexOf('{'), config.lastIndexOf('}') + 1));
assert.deepEqual(Object.keys(data).sort(), ['BACKEND_URL', 'CLERK_PUBLISHABLE_KEY']);
assert.match(data.CLERK_PUBLISHABLE_KEY, /^pk_(live|test)_/);
assert.equal(manifest.files['sw.js'], undefined, 'Android must not ship a website service worker');
const html = await fs.readFile(path.join(out, 'index.html'), 'utf8');
assert.ok(html.includes('/fonts/native.css'));
assert.ok(!html.includes('href="https://fonts.googleapis.com/css'));
assert.ok(Object.keys(manifest.files).some(name => /CosmosScreen.*\.js$/.test(name)), '3D cosmos is missing');
assert.ok(Object.keys(manifest.files).some(name => /pdfExport.*\.js$/.test(name)), 'PDF export is missing');
console.log(`PASS: ${checked} public assets identical; ${Object.keys(manifest.files).length} packaged files intact; complete cosmos, PDF export, offline fonts and public configuration.`);
