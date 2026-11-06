/**
 * Does a selectable picture style's reference leak into the scenes? Builds the production prompts of real scenes with
 * generateSeriesImages (a capturing stub, free), then draws each scene with FLUX.2 klein 9B KV in three variants:
 *   preview — the wizard preview as style reference with the old style lines (production until 2026-11-06),
 *   swatch  — an abstract swatch of the medium with the current style lines,
 *   none    — the current prompt without any style reference.
 * Public portraits only (Graf, Mats as "Alexander", Ella): no family avatar leaves the machine. No review: the contact
 * sheet is for the eye. ≈ 0.17 ct per picture.
 *
 *   bun --env-file=.env.local run scripts/image-bench/style-reference-probe.ts --swatches [--count 3]
 *   bun --env-file=.env.local run scripts/image-bench/style-reference-probe.ts --probe --seeds 2 [--variants preview,swatch,none] [--styles colored-pencil,painterly-adventure]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { generateSeriesImages } from '../../backend/story/character-series/pictures';
import { SERIES_IMAGE_MODEL } from '../../backend/story/character-series/authoring';
import { createRunwareCaller } from '../../backend/story/library/images';
import { runwareImageModelOptions } from '../../backend/ai/runware-image-model-options';
import { storyImageStyleProfile, withTaleaImageStyle, type StoryImageStyleId } from '../../backend/ai/image-style';
import type { VisualEntity } from '../../backend/story/storybook/illustration-stage';

const args = process.argv.slice(2);
const opt = (name: string, fallback: string) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const out = resolve(opt('--out', 'Logs/image-bench/style-reference-probe'));
await mkdir(out, { recursive: true });
const call = createRunwareCaller(process.env.RUNWARE_API_KEY!);
const dataUri = async (file: string) => `data:image/${file.endsWith('.webp') ? 'webp' : 'jpeg'};base64,${(await readFile(file)).toString('base64')}`;
const collapse = (text: string) => text.replace(/\s+/g, ' ').trim();
let costUSD = 0;

async function draw(prompt: string, referenceImages: string[], seed: number, size = { width: 1216, height: 832 }): Promise<Buffer> {
  const task: any = { taskType: 'imageInference', taskUUID: crypto.randomUUID(), model: SERIES_IMAGE_MODEL, numberResults: 1, outputType: ['URL'],
    ...runwareImageModelOptions({ model: SERIES_IMAGE_MODEL, CFGScale: 4, outputFormat: 'JPEG' }), ...size, includeCost: true, seed, positivePrompt: collapse(prompt),
    ...(referenceImages.length ? { inputs: { referenceImages } } : {}) };
  const response = await call(task);
  costUSD += response.cost || 0;
  return Buffer.from(await (await fetch(response.imageURL)).arrayBuffer());
}

async function contactSheet(tiles: Array<{ image: Buffer; label: string }>, columns: number, file: string) {
  const w = 456, h = 312;
  const composed = await Promise.all(tiles.map(async ({ image, label }, index) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="24"><rect width="${w}" height="24" fill="black" opacity="0.75"/><text x="6" y="17" font-family="Arial" font-size="13" fill="#ffd60a">${label.replace(/[<&>]/g, '')}</text></svg>`;
    return { input: await sharp(image).resize(w, h).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).jpeg().toBuffer(), left: (index % columns) * w, top: Math.floor(index / columns) * h };
  }));
  await sharp({ create: { width: w * columns, height: h * Math.ceil(tiles.length / columns), channels: 3, background: '#111' } }).composite(composed).jpeg({ quality: 82 }).toFile(file);
}

/** Abstract swatches: the medium without a figure, an object or a place that a scene could copy. */
const SWATCH_PROMPTS: Record<Exclude<StoryImageStyleId, 'talea-originals'>, string> = {
  'colored-pencil': 'An abstract colored-pencil texture study on rough ivory drawing paper, filling the whole sheet edge to edge: soft overlapping fields of color built from clearly visible individual pencil strokes, loose parallel hatching, curved scribbles following rounded forms and denser crosshatching in the shadows, broken waxy pigment catching on the paper grain, ivory paper showing between the strokes. Fresh leaf-green, warm ochre, terracotta, rosy peach and pale sky-blue pencils with light warm-brown sketch lines. A purely abstract arrangement of hatched color fields and strokes.',
  'painterly-adventure': 'An abstract gouache texture study on paper, filling the whole sheet edge to edge: thick opaque layered brush strokes and broad rounded paint masses with broad light and shadow, visible bristle marks, chipped dry-brush edges and a matte velvety paint surface. Saturated emerald, cool ultramarine depth, warm ochre, rosy peach and luminous warm yellow highlights. A purely abstract arrangement of painted color fields and brush strokes.',
};

if (args.includes('--swatches')) {
  const count = Number(opt('--count', '3'));
  const tiles: Array<{ image: Buffer; label: string }> = [];
  for (const [style, prompt] of Object.entries(SWATCH_PROMPTS)) {
    for (let n = 1; n <= count; n++) {
      const image = await draw(prompt, [], 7100 + n, { width: 1216, height: 832 });
      await writeFile(join(out, `swatch-${style}-${n}.jpg`), image);
      tiles.push({ image, label: `${style} #${n}` });
      console.log(`swatch ${style} #${n}`);
    }
  }
  await contactSheet(tiles, count, join(out, 'swatches.jpg'));
  console.log(`${tiles.length} swatches · ${(costUSD * 100).toFixed(2)} ct → ${join(out, 'swatches.jpg')}`);
}

if (args.includes('--probe')) {
  const seeds = Number(opt('--seeds', '2'));
  const variants = opt('--variants', 'preview,swatch,none').split(',');
  const styles = opt('--styles', 'colored-pencil,painterly-adventure').split(',') as Array<Exclude<StoryImageStyleId, 'talea-originals'>>;
  const portrait = (file: string) => dataUri(`frontend/public/library/${file}`);
  const entities: VisualEntity[] = [
    { id: 'graf', name: 'Graf Griesgram', kind: 'character', role: 'cast', species: 'human', isHuman: true, forbidden: [],
      appearance: 'Graf Griesgram, elderly nobleman with stern expression, trimmed grey beard, dark formal old-fashioned clothes', referenceUrl: await portrait('character-series/leads/graf-griesgram.webp') },
    { id: 'alex', name: 'Alexander', kind: 'character', role: 'hero', species: 'human', isHuman: true, forbidden: [], appearance: 'boy, short light-blond hair, orange T-shirt',
      referenceContext: '8 years old, 132 cm tall, male, short light-blond hair', referenceUrl: await portrait('series/bruno-der-flunkerfisch/characters/mats.webp') },
    { id: 'ella', name: 'Ella', kind: 'character', role: 'hero', species: 'human', isHuman: true, forbidden: [], appearance: 'girl, long brown hair in a ponytail, round red glasses, mustard jacket',
      referenceContext: '7 years old, 122 cm tall, female, long brown hair, round red glasses', referenceUrl: await portrait('series/bruno-der-flunkerfisch/characters/ella.webp') },
  ] as VisualEntity[];
  const shot = (page: number, onStage: string[], scene: string, actorId: string, action: string, result: string, framing: 'wide' | 'medium' | 'close') =>
    ({ page, onStage, scene, focus: 'scene', artifactVisible: false, elements: [], visualBeat: { actorId, action, result, framing }, actionKey: `${action}; ${result}`, ...(page ? { paragraph: 1, storyQuote: scene.slice(0, 120) } : {}) });
  // Real captions of the stories of 2026-11-04 (db0d92d8 Johann, 429dd9c9 Graf, 6fa2cd2e Aufräummaschine), Adrian played by Ella.
  const scenes = [
    shot(1, ['graf'], 'At a food-preparation table, Graf Griesgram presses a cucumber scrap out of a tiny cutter; it drops straight into his vest pocket. He pauses over the unexpected result, his precise little task ending in a private comic mishap, shown in a clear medium view.', 'graf', 'Presses the cucumber scrap out of the tiny cutter', 'The scrap drops into his vest pocket', 'medium'),
    shot(2, ['graf', 'alex'], 'In the kitchen, Graf Griesgram grips the lower corners of his apron and catches the round loaf as it rolls toward him. Alexander stands beside the empty board that redirected it. The loaf rests safely in the apron, turning a near spill into a practical, expressive medium-framed rescue.', 'graf', 'Catches the rolling loaf in his apron', 'The round loaf lies safely in the open apron', 'medium'),
    shot(3, ['graf', 'alex', 'ella'], 'Beside the broad curtain at the garden door, Graf Griesgram stands still with the long tie of his apron tangled around his legs. Ella holds out a hand while Alexander loosens the band. Their careful pause keeps the real rescue clear, with the curtain adding depth to the medium scene.', 'alex', "Loosens the apron tie around Graf Griesgram's legs", 'The band slackens as the Graf stands still and Ella holds out a hand', 'medium'),
    shot(4, ['alex'], 'Inside the workshop, Alexander kneels in front of a low wooden collection box and peers over its painted front panel, where only a tiny scrap of blue cloth shows between plain wooden shelves and tools.', 'alex', "Kneels and peers over the box's painted front panel", 'Only a tiny scrap of blue cloth shows inside the box', 'medium'),
    shot(5, ['graf', 'alex'], 'At the outdoor garden gate, Alexander reaches through the bars toward a loose sheet of paper as it flaps against Graf Griesgram beneath the nose. The two face each other across the gate, the flying paper making the mishap easy to read.', 'alex', 'Reaches through the gate toward a flying sheet', 'The sheet slaps Graf Griesgram beneath the nose', 'medium'),
  ];
  // The style lines production sent until 2026-11-06, for the "preview" variant.
  const OLD_PENCIL = 'Hand-drawn COLORED PENCIL on rough ivory paper. Build every colored area from clearly visible individual pencil strokes: loose parallel hatching, curved scribbles following form and crosshatching in shadows. Broken waxy pigment catches on the paper grain; ivory paper remains visible between strokes, including on faces, hair and clothes. Light warm-brown sketch contours, tangled curls, rosy cheeks, gentle flat shapes and supple informal gestures. Fresh leaf-green, warm ochre, terracotta and sky-blue pencils. Every figure and surface must look drawn with colored pencils, without watercolor washes, smooth paint fills or airbrushed gradients. The story scene determines place, light and emotion.';
  const OLD_GUIDE = (n: number, art: string) => `STYLE REFERENCE, image ${n}: transfer its mark-making, pigment texture, facial design language, shapes and palette throughout this picture. Re-draw the identity-sheet figures in this selected medium, retaining their identifying face, hair, species, clothing and colors but replacing the portraits' original rendering and shading. The story scene supplies this picture's place and objects; only the identity sheet supplies its cast. Characters, creatures, poses and scenery from the style example are not part of the new scene. Make one continuous scene in this medium. ${art}`;
  const PREVIEW: Record<string, string> = { 'colored-pencil': 'colored-pencil.webp', 'painterly-adventure': 'painterly-adventure-v2.webp' };
  const tiles: Array<{ image: Buffer; label: string }> = [];
  const rows: any[] = [];
  for (const style of styles) {
    const profile = storyImageStyleProfile(style)!;
    const swatchFile = resolve(opt(`--swatch-${style}`, `frontend/public/library/image-styles/${style}-swatch.webp`));
    if (variants.includes('swatch') && !existsSync(swatchFile)) throw new Error(`Swatch missing: ${swatchFile}`);
    const captured = new Map<number, { prompt: string; references: string[] }>();
    await generateSeriesImages({ illustrations: { cover: { ...scenes[1], page: 0 }, pages: scenes, storyElements: [] } as any, entities, seed: 'capture', visionModel: 'stub', pageTexts: {},
      imageModel: SERIES_IMAGE_MODEL, imageStyle: style, styleReferenceCheck: async url => url,
      provider: async request => { captured.set(request.page!, { prompt: request.prompt, references: request.referenceImages }); return { url: `https://example.test/${request.page}.jpg` }; },
      llm: async () => ({ text: '{}', modelUsed: 'stub', usage: { prompt: 0, completion: 0, total: 0, costUSD: 0 }, durationMs: 0 }),
      policy: { maxImageCalls: 20, imageRetries: 0, imageConcurrency: 1 } } as any);
    for (const scene of scenes) {
      const { prompt, references } = captured.get(scene.page)!;
      const [base] = prompt.split('\nSTYLE REFERENCE, image ');
      const sheet = references[0];
      const sheetCount = references.length - 1;
      for (const variant of variants) {
        const art = style === 'colored-pencil' ? OLD_PENCIL : profile.artDirection;
        const variantPrompt = variant === 'preview' ? `${base.split(profile.artDirection).join(art)}\n${OLD_GUIDE(sheetCount + 1, art)}`
          : variant === 'swatch' ? prompt : base;
        const refs = variant === 'preview' ? [sheet, await dataUri(`frontend/public/library/image-styles/${PREVIEW[style]}`)]
          : variant === 'swatch' ? [sheet, await dataUri(swatchFile)] : [sheet];
        // The provider adds the profile's medium when the prompt lacks it; the old lines are the old profile's own text.
        const finalPrompt = variant === 'preview' ? variantPrompt : withTaleaImageStyle(variantPrompt, style);
        await writeFile(join(out, `prompt-${style}-p${scene.page}-${variant}.txt`), finalPrompt);
        for (let seed = 1; seed <= seeds; seed++) {
          const image = await draw(finalPrompt, refs, 9100 + scene.page * 10 + seed);
          const file = `${style}-p${scene.page}-${variant}-s${seed}.jpg`;
          await writeFile(join(out, file), image);
          tiles.push({ image, label: `${style} p${scene.page} ${variant} s${seed}` });
          rows.push({ style, page: scene.page, variant, seed, file });
          console.log(file);
        }
      }
    }
  }
  await contactSheet(tiles, variants.length * seeds, join(out, 'probe.jpg'));
  await writeFile(join(out, 'probe.json'), JSON.stringify({ rows, costUSD }, null, 2));
  console.log(`${rows.length} pictures · ${(costUSD * 100).toFixed(2)} ct → ${join(out, 'probe.jpg')}`);
}
