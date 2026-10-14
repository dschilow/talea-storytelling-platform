import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const directories = process.argv.slice(2);
const reports = directories.map(directory => {
  const manifest = JSON.parse(readFileSync(path.join(directory, '.vite/manifest.json'), 'utf8'));
  const entry = manifest['index.html'];
  const route = manifest['screens/Landing/LandingPage.tsx'];
  const files = new Set();
  const visit = key => {
    const chunk = manifest[key];
    if (!chunk || files.has(chunk.file)) return;
    files.add(chunk.file);
    for (const dependency of chunk.imports || []) visit(dependency);
  };
  visit('index.html');
  visit('screens/Landing/LandingPage.tsx');
  const scripts = [...files].filter(file => file.endsWith('.js'));
  assertNoHeavyStartup(scripts);
  return { directory, entryFile: entry.file, entryBytes: statSync(path.join(directory, entry.file)).size,
    entryGzipBytes: gzipSync(readFileSync(path.join(directory, entry.file))).length,
    landingScriptCount: scripts.length,
    landingScriptBytes: scripts.reduce((sum, file) => sum + statSync(path.join(directory, file)).size, 0),
    landingScriptGzipBytes: scripts.reduce((sum, file) => sum + gzipSync(readFileSync(path.join(directory, file))).length, 0),
    routeFile: route.file };
});
function assertNoHeavyStartup(files) {
  if (files.some(file => /three-vendor|pdfExport|LottieLoader/.test(file))) throw new Error('Heavy feature leaked into startup');
}
writeFileSync('.performance/bundle-results.json', JSON.stringify(reports, null, 2));
console.log(JSON.stringify(reports, null, 2));
