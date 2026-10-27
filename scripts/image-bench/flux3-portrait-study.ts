/** Restyle two avatars and three pool figures, then hold scene prompt/seed fixed and swap only the references. */
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { MODERN_CHILDRENS_BOOK_STYLE } from "../../backend/story/storybook/illustration-stage";
import { runwareImageModelOptions } from "../../backend/ai/runware-image-model-options";
import { encodeReferenceSprite, renderIdentitySprite, renderSingleReference } from "../../backend/story/image-reference-sprite";

const root = "Logs/image-bench/flux3-portrait-study-2026-10-27";
const stylesRoot = "Logs/image-bench/flux3-style-study-2026-10-27";
const key = process.env.RUNWARE_API_KEY;
if (!key) throw new Error("RUNWARE_API_KEY missing");
await mkdir(join(root, "images"), { recursive: true });
await mkdir(join(root, "prompts"), { recursive: true });
const figures = [
  { id: "alexander", name: "Alexander", kind: "avatar", file: "hero-alexander.jpg", look: "young boy with a round child's face, light skin and rosy cheeks, large green eyes, short tousled brown hair swept to the side, a plain pale green short-sleeved T-shirt and blue jeans; keep the reference's hairstyle and age" },
  { id: "adrian", name: "Adrian", kind: "avatar", file: "hero-adrian.jpg", look: "young boy with a round child's face, light skin and rosy cheeks, large blue eyes, short side-swept blond hair, a plain grey-green short-sleeved T-shirt and blue jeans; keep the reference's hairstyle and age" },
  { id: "bo", name: "Bo", kind: "pool", file: "7cd7c99a-35cd-460e-9a4e-2e6d5fc53f53.jpg", look: "anthropomorphic orange fox with a white muzzle and inner ears, black nose, large pointed ears edged in black, round dark glasses, plain green buttoned vest over a white short-sleeved collared shirt, blue trousers and a brown cross-body book satchel, bushy orange tail with a white tip" },
  { id: "wuschel", name: "Wuschel", kind: "pool", file: "f738e1ed-4bf7-4a36-8d28-f289075c469e.jpg", look: "small friendly white cloud creature with a scalloped cloud head and soft fluffy cloud body, blue eyes and rosy cheeks, little arms and two small feet, a bright rainbow-striped scarf with fringed ends" },
  { id: "griselda", name: "Griselda", kind: "pool", file: "5cba02d9-6dad-4100-96b4-afe7d88dbe67.jpg", look: "elderly witch with light wrinkled skin, long crooked nose, expressive dark eyebrows, chin-length grey hair with a greenish tint, small gold hoop earrings, a tall floppy pointed black hat with a buckled band and a long plain black robe tied at the neck; mischievous kind smile" },
];
const styles: Record<string, string> = {
  modern: MODERN_CHILDRENS_BOOK_STYLE,
  dreamworks: "DreamWorks Animation feature-film character design, polished stylised 3D, appealing sculpted silhouettes and expressive asymmetrical features, tactile fabrics and softly groomed fur when present, warm bounced studio lighting, subtle matte materials.",
  pixar: "Pixar animated feature-film character design, appealing rounded 3D shapes, nuanced expressive face, finely shaded tactile materials and softly groomed fur when present, soft warm studio lighting and harmonious colours.",
};
const ledger = join(root, "results.jsonl");
let rows: any[] = [];
try { rows = (await readFile(ledger, "utf8")).split("\n").filter(Boolean).map(line => JSON.parse(line)); } catch {}
let spent = rows.reduce((sum, row) => sum + (row.cost || 0), 0);
const model = "bfl:flux@3-image-klein";

async function generate(id: string, prompt: string, references: Buffer[], size: number, seed: number, metadata: Record<string, unknown>) {
  const cached = rows.find(row => row.id === id && row.file);
  if (cached) return cached;
  if (spent + .02 > .35) throw new Error("Portrait study budget cap reached");
  await writeFile(join(root, "prompts", `${id}.txt`), prompt);
  const started = Date.now();
  const row: any = { id, ...metadata, model, seed, width: size, height: size, prompt, referenceCount: references.length };
  try {
    const task = { taskType: "imageInference", taskUUID: crypto.randomUUID(), model, numberResults: 1, includeCost: true, outputType: ["URL"], width: size, height: size, seed,
      ...runwareImageModelOptions({ model, steps: 16, outputFormat: "WEBP" }), positivePrompt: prompt,
      ...(references.length ? { inputs: { referenceImages: references.map(bytes => `data:image/jpeg;base64,${bytes.toString("base64")}`) } } : {}) };
    const response = await fetch("https://api.runware.ai/v1", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify([task]), signal: AbortSignal.timeout(180000) });
    const data: any = await response.json();
    if (!response.ok || data.errors?.length) throw new Error(`HTTP ${response.status}: ${data.errors?.[0]?.code || "provider error"}`);
    const result = data.data?.[0];
    const cost = Number(result?.cost);
    if (!Number.isFinite(cost)) throw new Error("Provider did not report a cost");
    row.cost = cost; spent += cost; row.providerMs = Date.now() - started;
    if (!result?.imageURL || result.NSFWContent === true) throw new Error("No publishable image");
    const download = await fetch(result.imageURL, { signal: AbortSignal.timeout(60000) });
    if (!download.ok) throw new Error(`Image download HTTP ${download.status}`);
    const bytes = Buffer.from(await download.arrayBuffer());
    await sharp(bytes).metadata();
    row.file = join(root, "images", `${id}.webp`);
    await writeFile(row.file, bytes);
  } catch (error) { row.error = String((error as Error).message); }
  row.totalMs = Date.now() - started;
  await appendFile(ledger, `${JSON.stringify(row)}\n`); rows.push(row);
  console.log(`${id}: ${row.file ? "OK" : row.error}, $${row.cost ?? "?"}, ${row.totalMs} ms`);
  return row;
}

for (const [i, figure] of figures.entries()) {
  const ref = await encodeReferenceSprite(await renderSingleReference(await readFile(join("Logs/image-bench/roster", figure.file))));
  for (const [style, styleText] of Object.entries(styles)) {
    const prompt = [
      `A single reference portrait of ${figure.name}, the same individual as in the attached image, translated into this illustration medium.`,
      styleText,
      `${figure.name}: ${figure.look}. Preserve the reference's facial structure, age, species, distinctive features, hair or fur colours and own clothing.`,
      "One complete figure alone, head to feet with comfortable space around the silhouette, in a relaxed three-quarter standing pose, arms comfortably separate from the torso, a small welcoming expression. The entire figure fits inside the frame, including the hat, tail or scarf when present.",
      "Plain warm ivory background and a faint soft grounding shadow. Clothes and accessories have plain surfaces. The image is a wordless character reference with a clear, reusable silhouette.",
    ].join("\n");
    await generate(`portrait-${figure.id}-${style}`, prompt, [ref], 768, 1140 + i, { phase: "portrait", figure: figure.name, figureId: figure.id, kind: figure.kind, style, original: join("Logs/image-bench/roster", figure.file) });
  }
}

// These nine original-reference controls were already rendered in the style study.
// Reuse their exact prompt, model, seed and options; change only the one collaged identity sheet.
const controls = (await readFile(join(stylesRoot, "results.jsonl"), "utf8")).split("\n").filter(Boolean).map(line => JSON.parse(line));
const casts: Record<string, string[]> = { map: ["alexander", "adrian", "bo"], rain: ["alexander", "adrian", "wuschel"], stream: ["alexander", "adrian"] };
for (const [scene, cast] of Object.entries(casts)) {
  for (const style of Object.keys(styles)) {
    const control = controls.find(row => row.id === `${scene}-${style === "modern" ? "directed" : style}` && row.file);
    if (!control) throw new Error(`Missing old-reference control: ${scene}/${style}`);
    const portraits = cast.map(id => rows.find(row => row.id === `portrait-${id}-${style}` && row.file));
    if (portraits.some(row => !row)) { console.log(`Skipping scene ${scene}/${style}: missing portrait`); continue; }
    const sheet = await encodeReferenceSprite(await renderIdentitySprite(await Promise.all(portraits.map(row => readFile(row.file)))));
    const sheetFile = join(root, `${scene}-${style}-reference.jpg`);
    await writeFile(sheetFile, sheet);
    await generate(`scene-${scene}-${style}`, control.prompt, [sheet], 1024, control.seed, { phase: "scene", scene, style, controlFile: control.file, figures: control.figures, referenceFile: sheetFile });
  }
}
console.log(`Portrait study cost: $${spent.toFixed(4)}`);
