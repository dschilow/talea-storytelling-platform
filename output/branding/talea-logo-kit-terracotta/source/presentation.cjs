const fs=require('fs');
const path=require('path');
const sharp=require(process.argv[2]||'sharp');
const root=path.resolve(__dirname,'..');
const entries=[
  ['stacked','primary',24,115,312,370,'Logo untereinander'],
  ['icon','primary',364,115,312,370,'Bildmarke'],
  ['stacked','flat',704,115,312,370,'Ohne Verlauf'],
  ['stacked','white',1044,115,312,370,'Weiß auf Dunkel'],
  ['horizontal','primary',24,535,648,225,'Logo horizontal'],
  ['horizontal','dark',704,535,648,225,'Einfarbig dunkel'],
  ['wordmark','dark',24,815,648,150,'Wortmarke allein']
];
(async()=>{
  const labels=entries.map(([layout,style,x,y,w,h,label])=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${style==='white'?'#3E281F':'#FFFFFF'}"/><text x="${x+12}" y="${y+h+25}" fill="#7A685E" font-size="15">${label}</text>`).join('');
  const chips=[['#C76B50','Terrakotta'],['#A9513B','Falte'],['#D78061','Licht'],['#FFF7EC','Creme'],['#3E281F','Dunkelbraun']].map(([color,label],i)=>`<rect x="${24+i*270}" y="1060" width="43" height="43" rx="9" fill="${color}" stroke="#D6C8BE"/><text x="${80+i*270}" y="1077" font-size="14" fill="#3E281F">${label}</text><text x="${80+i*270}" y="1100" font-size="13" fill="#7A685E">${color}</text>`).join('');
  const canvas=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1380" height="1140"><rect width="1380" height="1140" fill="#F1EEEA"/><g font-family="Segoe UI,Arial,sans-serif"><text x="24" y="54" font-size="36" font-weight="600" fill="#3E281F">talea · Terrakotta Logo-Paket</text><text x="25" y="83" font-size="15" fill="#7A685E">Echte Vektoren · transparente PNGs · große und kleine Versionen</text>${labels}<rect x="704" y="815" width="648" height="150" rx="14" fill="#FFFFFF"/><text x="716" y="990" font-size="15" fill="#7A685E">Kleine Icons: 16 · 24 · 32 · 48 · 64 · 128 px</text>${chips}</g></svg>`);
  const layers=[];
  for(const [layout,style,x,y,w,h] of entries){
    const svg=fs.readFileSync(path.join(root,'svg',`talea-${layout}-${style}.svg`));
    const buffer=await sharp(svg,{density:144}).resize({width:w-44,height:h-36,fit:'inside'}).png().toBuffer();
    const meta=await sharp(buffer).metadata();
    layers.push({input:buffer,left:x+Math.round((w-meta.width)/2),top:y+Math.round((h-meta.height)/2)});
  }
  const sizes=[16,24,32,48,64,128];let left=736;
  for(const size of sizes){layers.push({input:path.join(root,'png',`talea-icon-${size}.png`),left,top:900-Math.round(size/2)});left+=size+36;}
  await sharp(canvas).composite(layers).png().toFile(path.join(root,'preview.png'));
  console.log('Created preview.png');
})().catch(e=>{console.error(e.message);process.exitCode=1});
