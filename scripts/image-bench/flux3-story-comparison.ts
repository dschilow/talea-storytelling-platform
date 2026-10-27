/** Paired Talea scene benchmark. RUNWARE_API_KEY is supplied only in the process environment. */
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { assembleImagePrompt, negativePromptFor, type VisualEntity } from "../../backend/story/storybook/illustration-stage";
import { encodeReferenceSprite, renderIdentitySprite, renderSingleReference } from "../../backend/story/image-reference-sprite";
import { boundingBoxesFor, buildScenePrompt } from "../../backend/story/library/images";

const root = "Logs/image-bench/flux3-story-comparison-2026-10-27";
const key = process.env.RUNWARE_API_KEY;
if (!key) throw new Error("RUNWARE_API_KEY is missing");
const phase = process.argv[2] || "smoke";
if (!["smoke", "batch", "retry", "origins"].includes(phase)) throw new Error("Use smoke, batch, retry or origins");
await mkdir(join(root, "images"), { recursive: true });
await mkdir(join(root, "prompts"), { recursive: true });

type Figure = VisualEntity & { file: string };
const f = (id: string, name: string, appearance: string, tag: string, file: string, human: boolean, hero = false): Figure => ({ id, name, appearance, tag, file: join("Logs/image-bench/roster", file), kind: "character", role: hero ? "hero" : "cast", species: human ? "human" : name === "Wuschel" ? "cloud" : name === "Fauchi" ? "dragon" : "fox", isHuman: human, forbidden: [] });
const figures = {
  a: f("a", "Alexander", "young boy, short brown hair, green eyes, pale green shirt and jeans", "brown-haired boy in pale green shirt", "hero-alexander.jpg", true, true),
  b: f("b", "Adrian", "young boy, short blond hair, blue eyes, grey-green shirt and jeans", "blond boy in grey-green shirt", "hero-adrian.jpg", true, true),
  fox: f("fox", "Bo", "orange fox, round glasses, green vest over white shirt, brown book satchel", "orange fox in green vest and round glasses", "7cd7c99a-35cd-460e-9a4e-2e6d5fc53f53.jpg", false),
  dragon: f("dragon", "Fauchi", "small green dragon, pale belly, orange wing membranes", "small green dragon with orange wings", "7ae55808-ab5c-484b-a792-76030a875932.jpg", false),
  cloud: f("cloud", "Wuschel", "small white cloud creature with rainbow scarf", "white cloud with rainbow scarf", "f738e1ed-4bf7-4a36-8d28-f289075c469e.jpg", false),
  witch: f("witch", "Griselda", "elderly witch in black pointed hat and long black robe", "witch in pointed black hat and black robe", "5cba02d9-6dad-4100-96b4-afe7d88dbe67.jpg", true),
  merchant: f("merchant", "Gustav", "round adult man, grey hair, colourful patterned vest and white shirt", "round grey-haired man in patterned vest", "696c0208-7116-4e47-b04d-f289f525c3e8.jpg", true),
};
type Scene = { id: string; title: string; cast: (keyof typeof figures)[]; scene: string; stress?: boolean };
// Original image-direction briefs, made for this experiment; no manuscript was generated.
const scenes: Scene[] = [
  { id: "forest-cover", title: "Die verschwundene Sternenkarte", cast: ["a", "b", "fox"], scene: "A mossy forest library at dawn: Bo the fox opens a star map across a low wooden table, Alexander points at a tiny silver star on the map and Adrian holds a glowing lantern. Books and tall ferns frame the three figures, with soft golden light through the windows." },
  { id: "forest-1", title: "Die verschwundene Sternenkarte", cast: ["a", "fox"], scene: "Inside a cosy forest library Alexander kneels beside Bo and catches a paper star sliding off the edge of an open map. Bo reaches out one paw, his round glasses glint; wooden shelves and a round window behind them." },
  { id: "forest-2", title: "Die verschwundene Sternenkarte", cast: ["a", "b"], scene: "On a narrow wooden footbridge over a forest stream Alexander holds a paper star up to the light, while Adrian leans on the railing and looks into the water. Ferns, stepping stones and a little waterfall surround them in morning light." },
  { id: "forest-3", title: "Die verschwundene Sternenkarte", cast: ["a", "b", "fox"], scene: "At a hollow tree in a clearing Adrian holds the lantern high while Bo places the paper star into a small round hollow in the tree. Alexander watches the hollow glow; fallen leaves and mushrooms fill the foreground." },
  { id: "forest-4", title: "Die verschwundene Sternenkarte", cast: ["a", "b", "fox", "merchant"], stress: true, scene: "At the forest library table Bo points at a star map, Alexander holds a blue paper star, Adrian steadies the lantern, and Gustav watches from the other side of the table. Each figure has their own place; bookshelves and a large window frame the moment." },
  { id: "cloud-cover", title: "Die Wolke mit dem Regenschluckauf", cast: ["a", "b", "cloud"], scene: "In a sunny hillside garden Wuschel the little white cloud sneezes a few sparkling raindrops over a flowerpot, Alexander holds an open umbrella above the pot and Adrian laughs as he reaches for a falling drop. A stone wall and flowers fill the garden." },
  { id: "cloud-1", title: "Die Wolke mit dem Regenschluckauf", cast: ["b", "cloud"], scene: "Beside a garden well Adrian carefully offers Wuschel a small empty teacup. Wuschel floats just above the well and looks at the cup; the cloud's rainbow scarf trails in the breeze, with green vines and buckets nearby." },
  { id: "cloud-2", title: "Die Wolke mit dem Regenschluckauf", cast: ["a", "b", "dragon"], scene: "In the herb garden Fauchi the small green dragon blows a tiny warm puff across a puddle while Alexander kneels beside it with a leaf boat and Adrian watches from a stepping stone. A stone well and flowering herbs are visible behind them." },
  { id: "cloud-3", title: "Die Wolke mit dem Regenschluckauf", cast: ["a", "b", "cloud"], scene: "Wuschel floats above a wide wooden wash tub filled with water; Alexander gently pushes a floating leaf boat and Adrian smiles beside the tub. The colourful scarf remains around the cloud, with a garden gate and flower beds in warm evening light." },
  { id: "cloud-4", title: "Die Wolke mit dem Regenschluckauf", cast: ["a", "b", "dragon", "cloud"], stress: true, scene: "In a green herb garden Alexander and Adrian crouch on separate sides of a small flowerpot. Fauchi the green dragon watches from the left, and Wuschel the white cloud floats above the pot and sprinkles rain onto it. Clear separate silhouettes and a stone well behind them." },
  { id: "witch-cover", title: "Der verzauberte Markttag", cast: ["a", "b", "witch"], scene: "At a colourful village market Griselda the witch lifts a wooden spoon from a steaming pot while Alexander holds a basket of apples and Adrian looks at a floating apple. Timber stalls and bunting fill the bright morning square." },
  { id: "witch-1", title: "Der verzauberte Markttag", cast: ["a", "witch"], scene: "Inside a warm herb cottage Griselda stirs a bubbling pot while Alexander leans forward from a wooden stool to see the steam curl into the shape of a star. Shelves of herbs and a small window make the room recognisable." },
  { id: "witch-2", title: "Der verzauberte Markttag", cast: ["b", "merchant"], scene: "At a village market stall Gustav points at a basket of apples while Adrian reaches up to catch one slowly floating away. A striped awning and wooden crates fill the scene in bright daylight." },
  { id: "witch-3", title: "Der verzauberte Markttag", cast: ["a", "b", "witch"], scene: "In the village square Alexander holds a basket steady while Adrian carefully places a floating apple inside. Griselda watches with her long wooden spoon; market stalls and a flowering tree frame the action." },
  { id: "witch-4", title: "Der verzauberte Markttag", cast: ["a", "b", "witch", "merchant"], stress: true, scene: "At the market stall Gustav holds a basket, Alexander places a red apple into it, Adrian points at a floating apple, and Griselda watches with a wooden spoon. Four separate figures, each clearly visible against the lively timber-framed village square." },
];

const sprite = async (cast: Figure[]) => encodeReferenceSprite(cast.length === 1 ? await renderSingleReference(await readFile(cast[0].file)) : await renderIdentitySprite(await Promise.all(cast.map((x) => readFile(x.file)))));
const dataUri = (b: Buffer) => `data:image/jpeg;base64,${b.toString("base64")}`;
type Task = { scene: Scene; model: "flux2" | "flux3"; variant: "baseline" | "multi" | "style" | "origins" | "origins-landscape" | "origins-boxes"; seed: number; retry?: boolean; correction?: string };
const base: Task[] = scenes.flatMap((scene, index) => ([{ scene, model: "flux2", variant: "baseline", seed: 731 + index }, { scene, model: "flux3", variant: "baseline", seed: 731 + index }] as Task[]));
const extra: Task[] = scenes.filter((s) => s.stress).flatMap((scene, i) => ([{ scene, model: "flux3", variant: "multi", seed: 731 + scenes.indexOf(scene) }, { scene, model: "flux3", variant: "style", seed: 831 + i }] as Task[]));
const origins: Task[] = scenes.filter((scene) => scene.id.endsWith("cover") || scene.stress).flatMap((scene) => ["origins", ...(scene.stress ? ["origins-landscape", "origins-boxes"] : [])].map((variant) => ({ scene, model: "flux3", variant, seed: 731 + scenes.indexOf(scene) } as Task)));
const retrySpecs = phase === "retry" ? JSON.parse(await readFile("docs/story-examples/flux3-klein-vergleich-2026-10-27/retry-plan.json", "utf8")) as Array<{ scene: string; model: "flux2" | "flux3"; correction: string }> : [];
const tasks: Task[] = phase === "smoke" ? base.slice(0, 2) : phase === "batch" ? [...base, ...extra] : phase === "origins" ? origins : retrySpecs.map((spec) => {
  const original = base.find((task) => task.scene.id === spec.scene && task.model === spec.model);
  if (!original) throw new Error(`Unknown retry ${spec.scene}/${spec.model}`);
  return { ...original, retry: true, seed: original.seed + 1000, correction: spec.correction };
});
const ledgerFile = join(root, "results.jsonl");
let existing: any[] = [];
try { existing = (await readFile(ledgerFile, "utf8")).trim().split("\n").filter(Boolean).map((x) => JSON.parse(x)); } catch {}
let spent = existing.reduce((sum, row) => sum + (row.cost || 0), 0);
const cap = 2;
for (const t of tasks) {
  const id = `${t.scene.id}-${t.model}-${t.variant}${t.retry ? "-retry" : ""}`;
  if (existing.some((row) => row.id === id && row.file)) { console.log(`cached ${id}`); continue; }
  if (spent + 0.04 > cap) throw new Error("Budget cap reached before next request");
  const cast = t.scene.cast.map((x) => figures[x]);
  const sheet = await sprite(cast);
  const refs = t.variant === "multi" ? await Promise.all(cast.map(async (x) => dataUri(await encodeReferenceSprite(await renderSingleReference(await readFile(x.file)))))) : [dataUri(sheet)];
  let prompt = assembleImagePrompt({ scene: t.scene.scene, onStage: cast, spriteOrder: cast, ...(t.correction ? { correction: t.correction } : {}) });
  if (t.variant === "multi") {
    prompt = `${t.scene.scene}\nCreate one full-bleed children's picture-book scene, hand-painted watercolour and coloured pencil, warm natural light and a detailed setting. Exactly ${cast.length} distinct characters, each once. ${cast.map((x, i) => `Reference image ${i + 1} shows ${x.name}: ${x.tag}. Preserve this character's face, species, colors and outfit only for ${x.name}.`).join(" ")} Each character has a separate body and silhouette; keep every character's own features and clothes. Show the described action. No lettering, labels, panels or reference sheet.`;
  }
  if (t.variant === "style") prompt += "\nArt direction: sophisticated European picture-book gouache, subtly textured paper, luminous layered colours, considered composition with foreground and background, expressive yet natural faces; preserve the exact reference identities and outfits. No text.";
  let boxes: ReturnType<typeof boundingBoxesFor> = [];
  if (t.variant.startsWith("origins")) {
    const libraryFigures = cast.map((x) => ({ id: x.id, name: x.name, visualProfileEn: x.appearance }));
    const style = "Warm hand-drawn children's book illustration, soft ink outlines, gouache textures, rounded friendly shapes, expressive faces, gentle saturated colors, cozy lighting, a wordless picture where every surface stays plain and unmarked";
    let sceneText = t.scene.scene;
    if (t.variant === "origins-boxes") {
      for (const x of cast) sceneText = sceneText.replace(new RegExp(`\\b${x.name}\\b`, "g"), `[${x.id}]`);
      const targets = Object.fromEntries(cast.map((x, i) => [x.id, [180, i * 250, 980, (i + 1) * 250]]));
      boxes = boundingBoxesFor(libraryFigures, targets);
    }
    prompt = buildScenePrompt(sceneText, style, libraryFigures, [], {}, new Set(boxes.map((x) => x.id)));
  }
  const landscape = t.variant === "origins-landscape" || t.variant === "origins-boxes";
  const request: Record<string, unknown> = { taskType: "imageInference", taskUUID: crypto.randomUUID(), model: t.model === "flux2" ? "runware:400@4" : "bfl:flux@3-image-klein", positivePrompt: prompt, width: landscape ? 1216 : 1024, height: landscape ? 832 : 1024, seed: t.seed, steps: t.model === "flux2" ? 4 : 16, numberResults: 1, outputType: ["URL"], outputFormat: t.model === "flux2" ? "JPEG" : "JPG", includeCost: true, inputs: { referenceImages: refs }, ...(boxes.length ? { settings: { boundingBoxes: boxes } } : {}), ...(t.model === "flux2" ? { CFGScale: 4, acceleration: "high", negativePrompt: negativePromptFor(cast, true) } : {}) };
  await writeFile(join(root, "prompts", `${id}.json`), JSON.stringify({ ...request, taskUUID: undefined, inputs: { references: cast.map((x) => x.name), mode: t.variant === "multi" ? "separate" : "sprite", referenceSha256: await crypto.subtle.digest("SHA-256", sheet).then((x) => Buffer.from(x).toString("hex")) } }, null, 2));
  const started = Date.now();
  let row: Record<string, unknown> = { id, story: t.scene.title, scene: t.scene.id, cast: cast.map((x) => x.name), sceneText: t.scene.scene, model: t.model, variant: t.variant, seed: t.seed };
  try {
    const response = await fetch("https://api.runware.ai/v1", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify([request]), signal: AbortSignal.timeout(180000) });
    const data: any = await response.json();
    if (!response.ok || data.errors?.length) throw new Error(`HTTP ${response.status}: ${String(data.errors?.[0]?.code || "provider error")}: ${String(data.errors?.[0]?.message || "").slice(0, 300)}`);
    const item = data.data?.[0];
    const cost = Number(item?.cost);
    if (!Number.isFinite(cost)) throw new Error("provider did not report cost");
    spent += cost;
    row = { ...row, cost, providerMs: Date.now() - started, returnedSeed: item.seed };
    if (!item?.imageURL || item.NSFWContent === true) throw new Error("No usable image URL or safety rejection");
    const imageResponse = await fetch(item.imageURL, { signal: AbortSignal.timeout(60000) });
    if (!imageResponse.ok) throw new Error(`Image download HTTP ${imageResponse.status}`);
    const image = Buffer.from(await imageResponse.arrayBuffer());
    await sharp(image).metadata();
    const file = join(root, "images", `${id}.jpg`);
    await writeFile(file, image);
    await writeFile(join(root, "images", `${t.scene.id}-reference.jpg`), sheet);
    row = { ...row, file, totalMs: Date.now() - started };
  } catch (error) { row = { ...row, error: String((error as Error).message).slice(0, 400), totalMs: Date.now() - started }; }
  await appendFile(ledgerFile, `${JSON.stringify(row)}\n`);
  console.log(`${id} ${row.file ? "OK" : "ERROR"} ${row.cost ?? "?"} USD ${row.totalMs} ms${row.error ? `: ${row.error}` : ""}`);
}
console.log(`Recorded image spend: $${spent.toFixed(4)}; ${phase} complete`);
