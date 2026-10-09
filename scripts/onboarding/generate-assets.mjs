/** Run with Bun. Credentials are read by the existing helpers and never printed. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { CHAPTERS } from '../../frontend/screens/Onboarding/tourChapters.ts';
import { infer, pool, REPO_ROOT } from '../game-art/runware.mjs';
import { ttsClip, TAVI_VOICE_ID } from '../game-voices/eleven.mjs';
import { master } from '../game-voices/master.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const only = option('--only')?.split(',');
const chapters = CHAPTERS.filter(chapter => !only || only.includes(chapter.id));
if (only?.some(id => !CHAPTERS.some(chapter => chapter.id === id))) throw new Error('Unknown chapter id.');
const root = path.join(REPO_ROOT, 'frontend/public/onboarding');
const cache = path.join(REPO_ROOT, 'scripts/onboarding/.cache');
const manifestPath = path.join(root, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { version: 2, chapters: {} };
const model = 'bfl:flux@3-image'; // https://runware.ai/docs/models/bfl-flux-3-image

const scenes = {
  welcome: 'A welcoming cover: Tavi waves hello beside the curly-haired child and orange fox at the entrance to a magical treehouse village. A storybook cottage, telescope observatory and friendly board-game meadow are clearly visible. They are about to set off together.',
  home: 'Show the home base inside a cozy magical treehouse, as an easy-to-read cutaway. The child picks up a familiar adventure book, the fox waits on a cushion, a shelf holds illustrated science books and a tiny model solar system. On a peg hang two distinct children\'s little backpacks, conveying separate profiles. Tavi points out the three places.',
  avatar: 'The child is designing their own heroes in a magical art workshop: a living cheerful orange fox with teal neckerchief and a tiny friendly sage-green dragon stand beside the child in front of a dressing mirror. Tavi offers a paint palette and brush. A small diary and a growing seedling visibly connect heroes to learning and memories.',
  story: 'The child and fox hold an open book. Three vivid miniature worlds grow from its pages: a fairytale castle on the left, an adventurous green forest in the middle, and a little rocket with planets on the right. Tavi gently guides the story sparks into the book. Concrete visual meaning: choosing heroes, a world, and a personal idea creates a story.',
  library: 'A cozy children\'s library: the child and fox pull out a richly illustrated fox-adventure book. Other recognizable book covers show a dragon and an explorer. Tavi holds a magnifying glass beside the shelf. Book spines have illustrations and color bands, absolutely no writing. The picture clearly means finding and reopening saved adventures.',
  reading: 'One cohesive picture containing three large readable adjacent vignettes: on the left the child and fox admire a luminous cinematic picture of their adventure; in the middle the same child quietly reads an open illustrated book; on the right the same child relaxes with headphones, eyes gently closed. Tavi connects the scenes with a soft ribbon of story sparks. No screens containing fake UI.',
  doku: 'A curious child investigates three concrete wonders on a nature-and-science discovery table: a friendly little dinosaur model and fossil, a telescope and constellation globe, and a simple colorful gear machine. The fox looks through a magnifying glass. Tavi explains patiently at eye level. Scientific discovery, gentle wonder, not school exams.',
  audio: 'The child and fox wear comfortable headphones in a peaceful listening nook beside a warm wooden gramophone. From its horn float delicate visual storytelling scenes: a friendly dinosaur, an ocean with fish, and a small planet. Tavi conducts the narration gently. Make listening, rather than reading or screens, the obvious focus.',
  cosmos: 'The child, fox and Tavi float safely in a whimsical knowledge solar system. Three distinct colorful large planets stand for nature, dinosaurs and technology; tiny topic moons orbit them. The child touches a glowing planet and a small illustrated book appears near it. Wonder-filled educational universe, gentle indigo backdrop with lavender and gold highlights, no spacesuit helmet obscuring faces.',
  journey: 'A beautifully legible adventure map in a landscaped storybook world, viewed from a slight overhead angle. The child and fox walk one curved dotted path from a book cottage to a telescope stop and then a puzzle island with a little treasure chest. Tavi points at the nearest open stop. Only three main stations, one coherent path, absolutely no labels or writing.',
  games: 'A friendly family puzzle afternoon: four family members, including the main curly-haired child, sit around a board depicting a cozy village with animal character pieces. Tavi acts as a friendly detective with a magnifying glass, keeping his red turban. A smaller visual vignette shows the child doing a colorful illustrated quiz about dinosaurs. Cooperative, playful, no scary crime, no weapons.',
  treasure: 'The child and orange fox open a wooden treasure chest and admire a golden compass, a softly glowing feather and a diary with large painted adventure pictures. Beside the chest a small backpack has room for the compass, conveying taking a treasure on the next adventure. Tavi smiles approvingly. Objects are large, clear and countable.',
  tavi: 'An intimate, friendly conversation: the child and fox sit beside Tavi at eye level on cushions. Three picture-only thought bubbles contain a question about a star, an open adventure book, and a new lightbulb idea. Tavi listens warmly with open hands. No text in bubbles. The picture makes a helpful chat companion understandable without reading.',
  offline: 'A coherent two-scene story: on the left the child and fox pack an illustrated adventure book and headphones in a backpack at home; on the right the same child reads happily with headphones in a train seat while green countryside passes outside. Tavi waves from the window. The packed book and headphones visibly carry into the second scene. Travel and prepared offline adventures, no technical symbols or UI.',
  parents: 'A warm family scene: one caring parent and two children sit together preparing their adventure corner. Two small shelves, one mint and one peach, hold each child\'s own hero figures and books. Tavi offers a golden key to the parent, symbolizing protected grown-up settings. Welcoming and reassuring, no stern discipline, no barriers around children.',
  start: 'A joyful final spread: the curly-haired child, orange fox and Tavi walk through an open garden gate toward a gently glowing storybook village. A castle, observatory with planets, discovery trail and cozy library wait in the distance. They carry a little backpack and book. A hopeful first step, a clear winding path forward, same characters as the welcome cover.',
};
const style = 'Create a premium children\'s picture-book illustration for the Talea app, ages 4-9. Soft hand-painted gouache and watercolor, fine warm ink outlines, visible paper texture, rounded shapes, clear readable faces, expressive actions, gentle natural light, mint, warm apricot, dusty lavender and cream palette. Rich but calm composition with one main action, large objects and generous breathing room. Use the referenced Tavi CHARACTER ONLY: a friendly teal genie with red turban, teal feather, gold jewel, gold wrist cuffs and a small golden lamp. Discard the reference checkerboard background entirely. Main child throughout: warm medium-brown skin, curly dark hair, mustard-yellow overalls over a cream shirt, teal shoes. Fox throughout: cheerful orange fox, cream muzzle, teal neckerchief. Repaint all characters in this gouache style, not glossy 3D. Keep complete faces and key objects in the central 80% of the square composition. No written words, no letters, no numbers, no logos, no borders, no UI mockups, no checkerboard.';
const hash = text => createHash('sha256').update(text).digest('hex');

if (flag('--dry')) {
  console.log(JSON.stringify({ chapters: chapters.map(c => c.id), imageModel: model, images: flag('--audio-only') ? 0 : chapters.length, narrationCharacters: flag('--images-only') ? 0 : chapters.reduce((sum, c) => sum + c.narration.length, 0) }, null, 2));
  process.exit(0);
}
mkdirSync(cache, { recursive: true });
mkdirSync(path.join(root, 'images'), { recursive: true });
mkdirSync(path.join(root, 'audio'), { recursive: true });
const saveManifest = () => writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
let cost = 0;

const imageResults = flag('--audio-only') ? [] : await pool(chapters, 3, async chapter => {
  const prompt = `${style}\n\nSCENE: ${scenes[chapter.id]}`;
  const imageHash = hash(model + prompt);
  const out = path.join(root, 'images', `${chapter.id}.webp`);
  if (!flag('--force') && existsSync(out) && manifest.chapters[chapter.id]?.image?.hash === imageHash) return { skipped: chapter.id };
  const raw = path.join(cache, `${chapter.id}.png`);
  const result = await infer({ name: `onboarding.${chapter.id}`, out: raw, model, prompt, refs: [path.join(REPO_ROOT, 'frontend/public/tavi.png')], width: 1024, height: 1024 });
  const encoded = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', raw, '-vf', 'scale=768:768', '-c:v', 'libwebp', '-quality', '86', out], { encoding: 'utf8' });
  if (encoded.status !== 0) throw new Error(`Image encoding failed for ${chapter.id}.`);
  cost += result.cost;
  manifest.chapters[chapter.id] = { ...manifest.chapters[chapter.id], image: { model, hash: imageHash, prompt, file: `images/${chapter.id}.webp`, cost: result.cost } };
  saveManifest();
  console.log(`Image ready: ${chapter.id} ($${result.cost.toFixed(4)})`);
  return { ready: chapter.id };
});

const audioResults = flag('--images-only') ? [] : await pool(chapters, 2, async chapter => {
  const text = `[warm, friendly] ${chapter.narration}`;
  const audioHash = hash(TAVI_VOICE_ID + text);
  const out = path.join(root, 'audio', `${chapter.id}.mp3`);
  if (!flag('--force') && existsSync(out) && manifest.chapters[chapter.id]?.audio?.hash === audioHash) return { skipped: chapter.id };
  const result = await ttsClip({ voiceId: TAVI_VOICE_ID, text, seed: 12 });
  const raw = path.join(cache, `${chapter.id}.mp3`);
  writeFileSync(raw, result.audio);
  const mastered = master(raw, out);
  manifest.chapters[chapter.id] = { ...manifest.chapters[chapter.id], audio: { model: result.modelId, voice: TAVI_VOICE_ID, hash: audioHash, text: chapter.narration, file: `audio/${chapter.id}.mp3`, duration: mastered.duration, characters: result.chars } };
  saveManifest();
  console.log(`Narration ready: ${chapter.id} (${mastered.duration.toFixed(1)}s)`);
  return { ready: chapter.id };
});

const failures = [...imageResults, ...audioResults].filter(r => r?.error);
console.log(`Finished: ${chapters.length} chapters; image cost $${cost.toFixed(4)}; failures ${failures.length}.`);
if (failures.length) process.exitCode = 1;
