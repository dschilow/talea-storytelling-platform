/**
 * One director scene, drawn with the production FLUX 3 prompt and identity sheet, for comparing reference portraits.
 *
 *   bun --env-file=.env.local run scripts/image-bench/flux3-scene-probe.ts --label <name> --scene "<director scene>" \
 *     --figure "Alexander|hero|human|<look>|<file>" --figure "Händler Gustav|cast|human|<look>|<file>" [--seeds 2]
 *
 * Output: Logs/image-bench/flux3-scene-probe/<label>-s<seed>.png and a results.jsonl with the provider's cost.
 */
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { assembleFlux3ImagePrompt, MODERN_CHILDRENS_BOOK_STYLE, type VisualEntity } from "../../backend/story/storybook/illustration-stage";
import { encodeReferenceSprite, renderIdentitySprite, renderSingleReference } from "../../backend/story/image-reference-sprite";
import { withTaleaImageStyle } from "../../backend/ai/image-style";

const root = "Logs/image-bench/flux3-scene-probe";
const key = process.env.RUNWARE_API_KEY;
if (!key) throw new Error("RUNWARE_API_KEY is missing");
const values = (name: string) => process.argv.flatMap((value, i) => (process.argv[i - 1] === `--${name}` ? [value] : []));
const label = values("label")[0] || "probe";
const scene = values("scene")[0];
const seeds = Number(values("seeds")[0] || 2);
if (!scene) throw new Error("--scene is missing");
const figures = values("figure").map((spec, index) => {
  const [name, role, species, appearance, file] = spec.split("|");
  return { id: `f${index}`, name, role: role as "hero" | "cast", kind: "character" as const, species, isHuman: species === "human", appearance, forbidden: [], file } satisfies VisualEntity & { file: string };
});
await mkdir(root, { recursive: true });

const buffers = await Promise.all(figures.map((figure) => readFile(figure.file)));
const sheet = await encodeReferenceSprite(figures.length === 1 ? await renderSingleReference(buffers[0]) : await renderIdentitySprite(buffers));
await writeSheet();
const prompt = withTaleaImageStyle(assembleFlux3ImagePrompt({ scene, onStage: figures, spriteOrder: figures, style: MODERN_CHILDRENS_BOOK_STYLE })).replace(/\s+/g, " ").trim();
for (let s = 0; s < seeds; s += 1) {
  const seed = 5200 + s;
  const body = [{ taskType: "imageInference", taskUUID: crypto.randomUUID(), model: "bfl:flux@3-image-klein", numberResults: 1, outputType: ["URL"], outputFormat: "WEBP", steps: 16, acceleration: "high", safety: { checkContent: true }, width: 1024, height: 1024, includeCost: true, seed, positivePrompt: prompt, inputs: { referenceImages: [`data:image/jpeg;base64,${sheet.toString("base64")}`] } }];
  const response = await fetch("https://api.runware.ai/v1", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(180_000) });
  const data: any = await response.json();
  if (!response.ok || data.errors?.length) { console.log(`${label} s${seed}: HTTP ${response.status} ${JSON.stringify(data.errors).slice(0, 200)}`); continue; }
  const file = join(root, `${label}-s${seed}.png`);
  await sharp(Buffer.from(await (await fetch(data.data[0].imageURL)).arrayBuffer())).png().toFile(file);
  await appendFile(join(root, "results.jsonl"), `${JSON.stringify({ label, seed, cost: data.data[0].cost, file })}\n`);
  console.log(`${label} s${seed}: $${data.data[0].cost} → ${file}`);
}

async function writeSheet() {
  await sharp(sheet).png().toFile(join(root, `${label}-sheet.png`));
}
