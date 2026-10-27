/** Small visual regression for the living path: one canonical portrait and three old failing scenes. */
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import sharp from "sharp";
import { assembleFlux3ImagePrompt, type VisualEntity } from "../../backend/story/storybook/illustration-stage";
import { figurePortraitRequest } from "../../backend/story/storybook/book/illustrations";
import { FLUX3_KLEIN_MODEL, runwareImageModelOptions } from "../../backend/ai/runware-image-model-options";
import { encodeReferenceSprite, renderIdentitySprite } from "../../backend/story/image-reference-sprite";

const root = "Logs/story-review/der-weg-macht-kringel-dd2f3935";
const phase = process.argv[2] || "portrait";
if (!["portrait", "scenes", "spatial"].includes(phase)) throw new Error("Use portrait, scenes or spatial");
const key = process.env.RUNWARE_API_KEY;
if (!key) throw new Error("RUNWARE_API_KEY missing");
await mkdir(join(root, "regression"), { recursive: true });
const ledger = join(root, "regression", "results.jsonl");
let rows: any[] = [];
try { rows = (await readFile(ledger, "utf8")).split("\n").filter(Boolean).map(line => JSON.parse(line)); } catch {}
const path: VisualEntity = { id: "schlurfo", name: "Schlurfo", role: "cast", kind: "character", species: "creature", isHuman: false, appearance: "A living ochre garden path with rounded pebble eyes, a small moss moustache, and soft grassy edges that curl into loops", forbidden: [] };
const alex: VisualEntity = { id: "alex", name: "Alexander", role: "hero", kind: "character", species: "human", isHuman: true, appearance: "brown-haired boy, green eyes, plain blue T-shirt, dark full-length trousers, dark shoes", tag: "brown-haired boy in blue T-shirt", forbidden: [] };
const adrian: VisualEntity = { id: "adrian", name: "Adrian", role: "hero", kind: "character", species: "human", isHuman: true, appearance: "blond boy, blue eyes, yellow hoodie, dark blue full-length jeans, dark shoes", tag: "blond boy in yellow hoodie", forbidden: [] };

async function draw(id: string, prompt: string, seed: number, size: number, reference?: Buffer) {
  const referenceHash = reference ? createHash("sha256").update(reference).digest("hex") : undefined;
  const cached = rows.findLast(row => row.id === id && row.file && row.prompt === prompt && row.seed === seed && row.model === FLUX3_KLEIN_MODEL && row.referenceHash === referenceHash && row.size === size);
  if (cached) { try { await readFile(cached.file); return cached.file as string; } catch {} }
  if (rows.reduce((sum, row) => sum + (row.cost || 0), 0) > .1) throw new Error("Regression budget cap reached");
  const start = Date.now();
  const task = { taskType: "imageInference", taskUUID: crypto.randomUUID(), model: FLUX3_KLEIN_MODEL, numberResults: 1, outputType: ["URL"], includeCost: true, width: size, height: size, seed,
    ...runwareImageModelOptions({ model: FLUX3_KLEIN_MODEL, outputFormat: "WEBP" }), positivePrompt: prompt,
    ...(reference ? { inputs: { referenceImages: [`data:image/jpeg;base64,${reference.toString("base64")}`] } } : {}) };
  const row: any = { id, model: FLUX3_KLEIN_MODEL, seed, prompt, size, referenceHash, referenceCount: reference ? 1 : 0 };
  try {
    const response = await fetch("https://api.runware.ai/v1", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify([task]), signal: AbortSignal.timeout(180000) });
    const payload: any = await response.json();
    if (!response.ok || payload.errors?.length) throw new Error(`HTTP ${response.status}: ${payload.errors?.[0]?.code || "provider error"}`);
    const result = payload.data?.[0];
    row.providerMs = Date.now() - start;
    if (!Number.isFinite(Number(result?.cost))) throw new Error("No cost reported");
    row.cost = Number(result.cost);
    if (!result?.imageURL || result.NSFWContent === true) throw new Error("No usable image");
    const download = await fetch(result.imageURL, { signal: AbortSignal.timeout(60000) });
    if (!download.ok) throw new Error(`Download HTTP ${download.status}`);
    row.file = join(root, "regression", `${id}.webp`);
    await writeFile(row.file, Buffer.from(await download.arrayBuffer()));
  } catch (error) { row.error = String((error as Error).message); }
  row.totalMs = Date.now() - start;
  rows.push(row); await appendFile(ledger, `${JSON.stringify(row)}\n`);
  console.log(`${id}: ${row.file ? "OK" : row.error}, $${row.cost ?? "?"}, ${row.totalMs} ms`);
  if (!row.file) throw new Error(row.error);
  return row.file as string;
}

if (phase === "portrait") {
  const request = figurePortraitRequest(path, "kringel-regression");
  await draw("schlurfo-flat-portrait", request.prompt, request.seed, 768);
} else {
  const refs: Buffer[] = [];
  const avatarIds = (process.env.KRINGEL_AVATAR_IDS || "").split(",").map(id => id.trim());
  for (const [index, name] of ["alexander", "adrian"].entries()) {
    const file = join(root, "regression", `${name}-reference.jpg`);
    try { refs.push(await readFile(file)); } catch {
      const id = avatarIds[index];
      if (!id) throw new Error("Supply cached reference JPGs or KRINGEL_AVATAR_IDS with the two permitted test-avatar ids");
      const response = await fetch(`https://backend-2-production-3de1.up.railway.app/story/image/avatar/${id}`, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`Reference HTTP ${response.status}`);
      const bytes = await sharp(Buffer.from(await response.arrayBuffer())).jpeg({ quality: 92 }).toBuffer();
      await writeFile(file, bytes); refs.push(bytes);
    }
  }
  refs.push(await readFile(join(root, "regression", "schlurfo-flat-portrait.webp")));
  const sheet = await encodeReferenceSprite(await renderIdentitySprite(refs));
  await writeFile(join(root, "regression", "identity-sheet.jpg"), sheet);
  const scenes = [
    { id: "cover", seed: 1193731077, scene: "Low oblique view: Alexander leaps back as the actual ochre garden path bends into a broad loop around one enormous cabbage. Adrian steadies a wicker basket at the side, eyes on the curving ground. Schlurfo's pebble eyes and moss moustache are set directly into the flat ochre surface of the connected path at their feet; the path itself is the living character. The loop stretches through the vegetable beds, with soft evening light and clear sky above." },
    { id: "plank", seed: 1110184443, scene: "Low diagonal action shot: Alexander lands a running step on a broad wooden plank as the actual flat path coils beneath it, twisting the plank sideways like a clock hand. His free arm swings out and his eyes widen; his long trousers stay as on his reference. Adrian stands clear on the left, watching the turning plank. Schlurfo's face is embedded in the same connected ochre path that passes beneath the plank. The wicker basket rests on the ground nearby; an empty wheelbarrow and fence sit beyond the vegetable bed in evening light." },
    { id: "honeybell", seed: 2147290618, scene: "Low close view: Alexander kneels at the left of a large terracotta flowerpot, grinning at the curving ground, and Adrian kneels on its right. A tall green stem grows from soil INSIDE the pot, bearing one large downward-hanging golden bell-shaped flower just above its rim. Seven tiny clay cups stand on the bare ground OUTSIDE the pot, directly under the downward-facing flower; a honey drop hangs above one cup. Schlurfo is the flat ochre path making one small connected loop around the base of the pot, his pebble eyes and moss moustache embedded in that ground surface. Soft evening garden light." },
  ];
  const refined = { id: "honeybell-spatial", seed: 2147290618, scene: "Low side view: a golden honey drop falls from a downward-facing bell flower into one of seven tiny clay cups on the ground. The tall terracotta pot stands behind and right of the cups. Its green stem arches left past the rim, placing the entire hanging flower OUTSIDE the pot, directly over the cups. Alexander kneels left and Adrian right, leaning toward the falling drop. One flat ochre path curves across the foreground, with one embedded pebble-eyed face and moss moustache at lower left. Soft evening garden light." };
  for (const scene of phase === "spatial" ? [refined] : scenes) await draw(scene.id, assembleFlux3ImagePrompt({ scene: scene.scene, onStage: [alex, adrian, path], spriteOrder: [alex, adrian, path] }), scene.seed, 1024, sheet);
}
