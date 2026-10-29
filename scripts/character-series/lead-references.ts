/**
 * Clean series portraits of the five series leads: the whole figure alone on plain white, no props, drawn by FLUX 3 Klein
 * from the pool portrait. The pool portraits carry a workbench with jars (Tilda), ships, sea and a pipe (Blubbert) or a
 * dark wash (Graf Griesgram) and end at the waist; FLUX 3 copied the workbench into six of nine failed pictures of a
 * Tilda pilot (2026-10-29) and drew her without legs. The ensemble figures already have such portraits.
 *
 *   bun --env-file=.env.local run scripts/character-series/lead-references.ts [--series tilda-tueftel,…] [--seeds 7,42] [--out <dir>]
 *   bun run scripts/character-series/lead-references.ts --out <dir> --publish tilda-tueftel=7,kapitaen-blubbert=23,…
 *
 * Drawing puts every variant into --out for a look (≈ 0.37 ¢ each). --publish copies the chosen, inspected variants to
 * frontend/public/library/character-series/leads/<series>.webp and records them in its manifest; it draws nothing.
 * 2026-10-29: Blubbert seed 11 brought the pipe back, the first adults were drawn dwarf-like until the looks asked
 * for adult proportions.
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import bibles from '../../backend/story/character-series/series-bibles.json';
import { buildRunwareTask, createRunwareCaller, ORIGINALS_IMAGE_STYLE, PORTRAIT_SIZE } from '../../backend/story/library/images';

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const proxy = 'https://backend-2-production-3de1.up.railway.app/story/image?key=';
const pool = JSON.parse(await readFile('exports/character-pool/2026-10-26/talea-characters-2026-10-26-optimiert.json', 'utf8')) as any[];
const out = arg('out') || 'Logs/character-series-v2/lead-references';
const target = 'frontend/public/library/character-series/leads';
const seeds = (arg('seeds') || '7,42').split(',').map(Number);
const only = arg('series')?.split(',');
const picks = new Map((arg('publish') || '').split(',').filter(Boolean).map(pair => pair.split('=') as [string, string]));

/** The look as the portrait shows it, minus every prop and backdrop. */
const LOOKS: Record<string, string> = {
  'tilda-tueftel': 'nine-year-old girl inventor with big curly dark-brown hair, large round grey safety goggles over her eyes, light blue long-sleeved shirt with rolled sleeves, yellow overalls with a bib pocket, a black wristwatch, dark shoes, empty hands',
  'kapitaen-blubbert': 'tall stout old sea captain with full adult proportions (the head about one seventh of his height), a full white beard and moustache, white captain\'s cap with a dark blue band and a gold badge, blue-and-white striped shirt with rolled sleeves, brown belt, dark grey trousers, dark boots, empty hands',
  'funkelflug': 'small round golden-yellow baby dragon with tiny pink-lined wings, big brown eyes, pink nose, cream belly scales, short tail, a few golden sparks at its nose',
  'nebelfee': 'slender young fairy with very long flowing silver-white hair, translucent pale-blue wings, light blue knee-length dress with short puffed sleeves, bare feet',
  'graf-griesgram': 'tall, thin grumpy old count with full adult proportions (the head about one seventh of his height), swept-back white hair, bushy white beard and moustache, stern frown, black high-collared buttoned coat over a dark waistcoat, dark trousers, polished black shoes, empty hands',
};
const leads = bibles.filter(b => !only || only.includes(b.id)).map(bible => {
  const row = pool.find(r => r.id === bible.characterId);
  const source = String(row?.image_url || row?.imageUrl || '');
  const prompt = `Character reference picture: ${LOOKS[bible.id]}. Exactly the character of the reference image: same face, age, hair, eyes, species, clothes and colours. The whole figure is visible from head to feet in the calm, natural pose of what it is, three-quarter view, centered with space around it, alone on a plain pure white background; no furniture, tools, props, scenery, water or sky. ${ORIGINALS_IMAGE_STYLE}.`;
  return { bible, source, prompt };
});

if (picks.size) {
  const manifest: Record<string, unknown> = JSON.parse(await readFile(join(target, 'manifest.json'), 'utf8').catch(() => '{}'));
  await mkdir(target, { recursive: true });
  for (const { bible, source, prompt } of leads.filter(l => picks.has(l.bible.id))) {
    const seed = Number(picks.get(bible.id));
    await copyFile(join(out, `${bible.id}-${seed}.webp`), join(target, `${bible.id}.webp`));
    manifest[bible.id] = { seriesId: bible.id, poolId: bible.characterId, name: bible.characterName, localUrl: `/library/character-series/leads/${bible.id}.webp`, source, seed, model: 'bfl:flux@3-image-klein', prompt };
    console.log(`${bible.id}: seed ${seed} published`);
  }
  await writeFile(join(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  process.exit(0);
}

const key = process.env.RUNWARE_API_KEY;
if (!key) throw new Error('RUNWARE_API_KEY missing.');
const call = createRunwareCaller(key);
await mkdir(out, { recursive: true });
for (const { bible, source, prompt } of leads) {
  const response = await fetch(proxy + encodeURIComponent(source.replace(/^bucket:\/\/[^/]+\//, '')));
  if (!response.ok) throw new Error(`${bible.id}: pool portrait HTTP ${response.status}`);
  const reference = `data:image/jpeg;base64,${(await sharp(Buffer.from(await response.arrayBuffer())).jpeg({ quality: 92 }).toBuffer()).toString('base64')}`;
  for (const seed of seeds) {
    const result = await call(buildRunwareTask({ prompt, ...PORTRAIT_SIZE, seed, referenceImages: [reference] }));
    const image = Buffer.from(await (await fetch(result.imageURL)).arrayBuffer());
    const file = join(out, `${bible.id}-${seed}.webp`);
    await writeFile(file, await sharp(image).webp({ quality: 86 }).toBuffer());
    console.log(`${bible.id} seed ${seed}: ${file} (${result.cost} $)`);
  }
}
