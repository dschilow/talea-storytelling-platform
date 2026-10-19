/** Freeze the same Google Fonts responses used by the web app into the APK. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export async function mirrorWebFonts(frontend, out, cache) {
  const sources = await Promise.all(['index.html', 'screens/Game/game.css'].map(file => fs.readFile(path.join(frontend, file), 'utf8')));
  const urls = [...new Set(sources.flatMap(source => source.match(/https:\/\/fonts\.googleapis\.com\/[^"'\s)]+/g) || []))];
  await fs.mkdir(cache, { recursive: true });
  await fs.mkdir(path.join(out, 'fonts/native'), { recursive: true });
  const hash = value => createHash('sha256').update(value).digest('hex');
  async function cached(url, extension) {
    const file = path.join(cache, `${hash(url)}.${extension}`);
    try { return await fs.readFile(file); } catch {}
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' }, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Could not package the original web font (${response.status}).`);
    const bytes = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(file, bytes);
    return bytes;
  }
  let css = '';
  let count = 0;
  for (const url of urls) {
    let fontCss = (await cached(url.replaceAll('&amp;', '&'), 'css')).toString('utf8');
    if (!fontCss.includes('@font-face')) throw new Error('Google Fonts returned no font faces.');
    for (const fontUrl of new Set(fontCss.match(/https:\/\/fonts\.gstatic\.com\/[^)\s]+/g) || [])) {
      const bytes = await cached(fontUrl, 'woff2');
      const file = `${hash(bytes).slice(0, 24)}.woff2`;
      await fs.writeFile(path.join(out, 'fonts/native', file), bytes);
      fontCss = fontCss.replaceAll(fontUrl, `/fonts/native/${file}`);
      count++;
    }
    css += `\n${fontCss}`;
  }
  await fs.writeFile(path.join(out, 'fonts/native.css'), css);
  const indexPath = path.join(out, 'index.html');
  const html = (await fs.readFile(indexPath, 'utf8')).replace(/<link\b[^>]*href=["']https:\/\/fonts\.googleapis\.com\/[^"']*["'][^>]*>/g, '').replace('</head>', '<link rel="stylesheet" href="/fonts/native.css"></head>');
  await fs.writeFile(indexPath, html);
  for (const file of await fs.readdir(path.join(out, 'assets'))) {
    if (!file.endsWith('.css')) continue;
    const target = path.join(out, 'assets', file);
    const source = await fs.readFile(target, 'utf8');
    const local = source.replace(/@import\s*(?:url\(\s*)?["']https:\/\/fonts\.googleapis\.com\/[^"']*["']\s*\)?\s*;/g, '');
    if (source !== local) await fs.writeFile(target, local);
  }
  console.log(`Android: ${count} original web fonts available offline.`);
}
