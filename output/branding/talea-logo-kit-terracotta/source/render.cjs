const fs = require('fs');
const path = require('path');
const sharp = require(process.argv[2] || 'sharp');
const root = path.resolve(__dirname, '..');
const png = path.join(root, 'png');
fs.mkdirSync(png, {recursive: true});

async function render(filename, width, output, background) {
  const buffer = fs.readFileSync(path.join(root, 'svg', filename));
  const viewWidth = Number(buffer.toString().match(/viewBox="0 0 ([\d.]+) /)[1]);
  let job = sharp(buffer, {density: Math.max(72, 72 * width / viewWidth)}).resize({width});
  if (background) job = job.flatten({background});
  await job.png().toFile(path.join(png, output));
}

(async () => {
  for (const size of [16,24,32,48,64,128,180,192,256,512,1024,2048]) {
    const small = size <= 64 ? 'small-' : '';
    await render(`talea-icon-${small}primary.svg`, size, `talea-icon-${size}.png`);
  }
  for (const size of [256,512,1024,2048]) await render('talea-stacked-primary.svg',size,`talea-stacked-${size}.png`);
  for (const size of [320,640,1280,2560]) await render('talea-horizontal-primary.svg',size,`talea-horizontal-${size}.png`);
  for (const size of [256,512,1024]) await render('talea-wordmark-dark.svg',size,`talea-wordmark-${size}.png`);
  for (const style of ['flat','dark','white']) {
    for (const layout of ['icon','stacked','horizontal']) await render(`talea-${layout}-${style}.svg`,1024,`talea-${layout}-${style}-1024.png`);
  }
  for (const size of [180,192,512,1024]) await render('talea-app-icon.svg',size,`talea-app-icon-${size}.png`);
  await render('talea-stacked-primary.svg',800,'preview-on-white.png','#FFFFFF');
  // Render every SVG independently to verify validity, including all outlined wordmarks.
  let verified = 0;
  for (const filename of fs.readdirSync(path.join(root,'svg')).filter(f=>f.endsWith('.svg'))) {
    const text = fs.readFileSync(path.join(root,'svg',filename),'utf8');
    if (/<(?:image|text|script)\b/.test(text) || /(?:href|font-family)=/.test(text)) throw new Error(`Not self-contained paths: ${filename}`);
    await sharp(Buffer.from(text)).resize({width:128}).png().toBuffer();
    verified++;
  }
  const meta = await sharp(path.join(png,'talea-icon-512.png')).metadata();
  if (!meta.hasAlpha || meta.width !== 512 || meta.height !== 512) throw new Error('Transparent icon export check failed');
  console.log(JSON.stringify({verifiedSVGs:verified,pngCount:fs.readdirSync(png).length,transparentIcon:true}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
