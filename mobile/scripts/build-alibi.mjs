/** Packs the CURRENT web game and its complete media into the APK, without a server. */
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const mobile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.dirname(mobile);
const frontend = path.join(repo, 'frontend');
const requireWeb = createRequire(path.join(frontend, 'package.json'));
const requireMobile = createRequire(path.join(mobile, 'package.json'));
// Font URLs contain semicolons in their query strings; strip the whole quoted
// directive rather than treating the first semicolon as the end of the rule.
const stripRemoteFonts = code => code.replace(/@import\s*(?:url\(\s*)?["']https:\/\/fonts\.googleapis\.com\/[^"']*["']\s*\)?\s*;/g, '');
const { build } = await import(pathToFileURL(requireWeb.resolve('vite')).href);
const { default: react } = await import(pathToFileURL(requireWeb.resolve('@vitejs/plugin-react')).href);
const { default: tailwindcss } = await import(pathToFileURL(requireWeb.resolve('@tailwindcss/vite')).href);
const qa = process.argv.includes('--qa');
const out = qa ? path.join(repo, 'scripts/game-qa/out/android-alibi') : path.join(mobile, 'android/app/src/main/assets/alibi');
// Only this generated directory is replaced. Deleted web media must disappear
// from the next APK as well; otherwise a stale asset silently survives builds.
const allowedRoot = qa ? path.join(repo, 'scripts/game-qa/out') : path.join(mobile, 'android/app/src/main/assets');
if (path.dirname(out) !== allowedRoot || path.basename(out) !== (qa ? 'android-alibi' : 'alibi')) throw new Error('Unexpected generated asset directory');
await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(out, { recursive: true });

const result = await build({
  configFile: false, root: frontend, publicDir: false, base: './',
  define: { 'import.meta.env.VITE_ALIBI_QA': JSON.stringify(qa), 'process.env.NODE_ENV': JSON.stringify('production') },
  resolve: { alias: [
    { find: '@/hooks/useBackend', replacement: path.join(mobile, 'alibi-web/backend.ts') },
    { find: '@', replacement: frontend },
  ] },
  plugins: [
    {
      name: 'alibi-local-assets', enforce: 'pre',
      transform(code, id) {
        if (id.endsWith('.css')) return stripRemoteFonts(code);
        if (id.includes('/screens/Game/alibi/') || id.includes('\\screens\\Game\\alibi\\')) {
          return code.replace(/(["'`])\/game\//g, '$1game/');
        }
      },
    },
    react(), tailwindcss(),
  ],
  build: {
    write: false, minify: true, target: 'es2020',
    lib: { entry: path.join(mobile, 'alibi-web/main.tsx'), formats: ['iife'], name: 'TaleaAlibi' },
    rollupOptions: { output: { inlineDynamicImports: true, entryFileNames: 'alibi.js' } },
  },
});
const chunks = (Array.isArray(result) ? result : [result]).flatMap(r => r.output);
const js = chunks.find(c => c.type === 'chunk');
if (!js) throw new Error('Alibi bundle missing');
// CSS is built separately to preserve the exact Tailwind utilities and game styles.
const cssResult = await build({
  configFile: false, root: frontend, publicDir: false, base: './',
  plugins: [
    { name: 'offline-fonts', enforce: 'pre', transform(code, id) { if (id.endsWith('.css')) return stripRemoteFonts(code); } },
    tailwindcss(),
  ],
  build: { write: false, cssMinify: true, rollupOptions: { input: path.join(mobile, 'alibi-web/mobile.css'), external: ['./fonts/manrope.ttf', './fonts/fraunces.ttf'] } },
});
const css = cssResult.output.filter(c => c.type === 'asset' && c.fileName.endsWith('.css')).map(c => c.source).join('\n');
await fs.writeFile(path.join(out, 'alibi.js'), js.code);
// live.css is emitted by the JS build as well.
const liveCss = chunks.filter(c => c.type === 'asset' && c.fileName.endsWith('.css')).map(c => c.source).join('\n');
const packedCss = stripRemoteFonts(`${css}\n${liveCss}`);
await fs.writeFile(path.join(out, 'alibi.css'), packedCss);
for (const name of ['alibi', 'tavi', 'nav']) await fs.cp(path.join(frontend, 'public/game', name), path.join(out, 'game', name), { recursive: true });
await fs.mkdir(path.join(out, 'game/keyart'), { recursive: true });
await fs.copyFile(path.join(frontend, 'public/game/keyart/alibi.webp'), path.join(out, 'game/keyart/alibi.webp'));
await fs.mkdir(path.join(out, 'fonts'), { recursive: true });
for (const [pkg, font, to] of [
  ['@expo-google-fonts/manrope', '400Regular/Manrope_400Regular.ttf', 'manrope.ttf'],
  ['@expo-google-fonts/fraunces', '700Bold/Fraunces_700Bold.ttf', 'fraunces.ttf'],
]) {
  await fs.copyFile(path.join(path.dirname(requireMobile.resolve(`${pkg}/package.json`)), font), path.join(out, 'fonts', to));
}
const json = {};
for (const name of ['manifest.json', 'lips.json']) json[name] = JSON.parse(await fs.readFile(path.join(out, 'game/alibi/voices', name), 'utf8'));
await fs.writeFile(path.join(out, 'index.html'), `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Mitternachts-Alibi</title><link rel="stylesheet" href="alibi.css"></head><body><div id="root"></div><script>window.__ALIBI_JSON__=${JSON.stringify(json).replace(/</g, '\\u003c')};</script><script src="alibi.js"></script></body></html>`);
const hash = createHash('sha256').update(js.code).update(packedCss).digest('hex');
await fs.writeFile(path.join(out, 'build.json'), JSON.stringify({ source: 'frontend/screens/Game/alibi', hash, builtAt: new Date().toISOString() }, null, 2));
console.log(`Mitternachts-Alibi packed into ${out}`);
