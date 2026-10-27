/**
 * Talea-Folge "Das Brett bis zur Tür" (story 26fdd23f, 2026-10-27): the cover, picture 1.1 and picture 3.2 failed
 * on "text visible" after 3–4 FLUX 3 Klein calls each. This probe re-renders the director's scenes from the story log
 * with the production prompt builder, sprite and Runware parameters, so prompt changes can be compared on them.
 *
 *   bun --env-file=.env.local run scripts/image-bench/flux3-text-probe.ts <variant> [--seeds 2] [--shots cover,p1,p6]
 *
 * Variants: prod (current prompt) · fixed (current prompt builder after the fix) · ref256 / ref384 (smaller sheet
 * cells, cost probe) · steps12 / steps10 (cost probe). Images and a JSONL ledger go to Logs/image-bench/flux3-text-probe/.
 */
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { assembleFlux3ImagePrompt, MODERN_CHILDRENS_BOOK_STYLE, type VisualEntity } from "../../backend/story/storybook/illustration-stage";
import { encodeReferenceSprite, renderIdentitySprite } from "../../backend/story/image-reference-sprite";
import { withTaleaImageStyle } from "../../backend/ai/image-style";

const root = "Logs/image-bench/flux3-text-probe";
const key = process.env.RUNWARE_API_KEY;
if (!key) throw new Error("RUNWARE_API_KEY is missing");
const variant = process.argv[2] || "prod";
const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const seeds = Number(arg("seeds") || 2);
const only = (arg("shots") || "cover,p1,p6").split(",");
await mkdir(join(root, "images"), { recursive: true });

type Figure = VisualEntity & { file: string };
const figure = (id: string, name: string, appearance: string, tag: string, file: string, role: "hero" | "cast", species: string): Figure =>
  ({ id, name, appearance, tag, file, kind: "character", role, species, isHuman: species === "human", forbidden: [] });
const portraits = "Logs/image-bench/flux3-text-probe/portraits";
// --refs book: the two boys cut out of the story's own picture; Adrian's shirt carries the logo with a script word that
// FLUX 3 copied from his avatar portrait. The looks are what the looks reader writes (garments described plain).
const bookRefs = arg("refs") === "book";
const cast = {
  alexander: bookRefs
    ? figure("a", "Alexander", "young boy, light skin, short tousled brown hair, green eyes, plain turquoise T-shirt, dark blue jeans", "brown-haired boy in turquoise T-shirt", join(portraits, "alexander-book.png"), "hero", "human")
    : figure("a", "Alexander", "young boy, short tousled brown hair, green eyes, pale green T-shirt and jeans", "brown-haired boy in green T-shirt", "Logs/image-bench/roster/hero-alexander.jpg", "hero", "human"),
  adrian: bookRefs
    ? figure("b", "Adrian", "young boy, light skin, short spiky blond hair, blue eyes, plain navy T-shirt, dark blue jeans", "blond boy in navy T-shirt", join(portraits, variant === "clean" ? "adrian-clean.png" : "adrian-logo.png"), "hero", "human")
    : figure("b", "Adrian", "young boy, short blond hair, blue eyes, grey T-shirt and jeans", "blond boy in grey T-shirt", "Logs/image-bench/roster/hero-adrian.jpg", "hero", "human"),
  karo: figure("karo-spielbrett", "Karo", "A square wooden game board with red and cream tiles, a tiny carved face and flexible rolled-up edges.", "square red-and-cream wooden game board with a tiny carved face", join(portraits, "karo.png"), "cast", "thing"),
  kater: figure("gestiefelter-kater", "Der gestiefelte Kater", "An orange tabby cat with a white muzzle, a feathered green hat and oversized brown boots.", "orange tabby cat in green feathered hat and brown boots", join(portraits, "kater.png"), "cast", "animal"),
};

// The director's scenes from the story log (illustration-plan stage), unchanged.
const shots = [
  { id: "cover", onStage: [cast.alexander, cast.adrian, cast.karo], scene: "Low-angle close view: Karo fills the foreground, its red-and-cream wooden path curling invitingly around a chair. Alexander leans back with a delighted grin at left, while Adrian reaches toward the curling edge at right, watching it with wide eyes. Karo's tiny carved face looks up between them. The castle playroom opens into a calm, uncluttered background above, with no lettering." },
  { id: "p1", onStage: [cast.alexander, cast.adrian, cast.karo], scene: "Medium view: Alexander laughs as he gently pokes the painted sleeping donkey on Karo with one finger. Adrian leans toward the board from the right, smiling at Alexander's hand; his small playing piece stands beside the donkey. Karo lies flat between them on a wooden table. Soft daylight enters the castle playroom through a window overlooking the courtyard." },
  { id: "p6", onStage: [cast.alexander, cast.adrian, cast.kater], scene: "Medium close view: Alexander plants both feet firmly and holds up the tiny wool thread between his fingers, looking at Adrian with a sincere smile. Adrian smiles back beside the table, his playing piece still on the final square of Karo. The board's extended paths remain taut across the floor. Daylight shines through the castle playroom window onto the wooden tabletop. Der gestiefelte Kater is also in this picture, close to the others; the action described above stays with the figures it names. Karo is not in this picture." },
].filter((shot) => only.includes(shot.id));

const cell = variant === "ref256" ? 256 : variant === "ref384" ? 384 : 512;
const steps = variant === "steps12" ? 12 : variant === "steps10" ? 10 : 16;
async function sheetFor(figures: Figure[]): Promise<Buffer> {
  const buffers = await Promise.all(figures.map((entry) => readFile(entry.file)));
  if (cell === 512) return encodeReferenceSprite(await renderIdentitySprite(buffers));
  const tiles = await Promise.all(buffers.map((buffer) => sharp(buffer).resize(cell, cell, { fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).png().toBuffer()));
  const png = await sharp({ create: { width: cell * tiles.length, height: cell, channels: 3, background: "#ffffff" } }).composite(tiles.map((input, index) => ({ input, left: index * cell, top: 0 }))).png().toBuffer();
  return encodeReferenceSprite(png);
}

/**
 * Candidate prompt changes, tried as text edits before they go into illustration-stage.ts:
 * plainA — each human's identity line says the clothes are solid colours; plainB — plainA plus a sentence that the
 * reference's shirt print is not part of the figure.
 */
function transform(prompt: string): string {
  if (!variant.startsWith("plain")) return prompt;
  let next = prompt.replace(/own clothing, with a child's face and body\./g, "own clothing in the same colours, every garment one solid unprinted colour, with a child's face and body.");
  if (variant === "plainB") next = next.replace("drawing fresh poses in this scene.", "drawing fresh poses in this scene. Copy faces, hair and garment colours from the sheet, while every shirt in the picture is one smooth solid colour.");
  return next;
}

const ledger = join(root, "results.jsonl");
for (const shot of shots) {
  const sheet = await sheetFor(shot.onStage);
  const prompt = transform(withTaleaImageStyle(assembleFlux3ImagePrompt({ scene: shot.scene, onStage: shot.onStage, spriteOrder: shot.onStage, style: MODERN_CHILDRENS_BOOK_STYLE }))).replace(/\s+/g, " ").trim();
  for (let s = 0; s < seeds; s += 1) {
    const seed = 4100 + s;
    const id = `${shot.id}-${variant}${bookRefs ? "-book" : ""}-s${seed}`;
    const request = {
      taskType: "imageInference", taskUUID: crypto.randomUUID(), model: "bfl:flux@3-image-klein", numberResults: 1, outputType: ["URL"],
      outputFormat: "WEBP", steps, acceleration: "high", safety: { checkContent: true }, width: 1024, height: 1024, includeCost: true, seed,
      positivePrompt: prompt, inputs: { referenceImages: [`data:image/jpeg;base64,${sheet.toString("base64")}`] },
    };
    const started = Date.now();
    let row: Record<string, unknown> = { id, shot: shot.id, variant, seed, steps, cell, promptChars: prompt.length };
    try {
      const response = await fetch("https://api.runware.ai/v1", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify([request]), signal: AbortSignal.timeout(180_000) });
      const data: any = await response.json();
      if (!response.ok || data.errors?.length) throw new Error(`HTTP ${response.status}: ${String(data.errors?.[0]?.message || "").slice(0, 200)}`);
      const item = data.data?.[0];
      const image = Buffer.from(await (await fetch(item.imageURL)).arrayBuffer());
      const file = join(root, "images", `${id}.png`);
      await sharp(image).png().toFile(file);
      row = { ...row, cost: Number(item.cost), ms: Date.now() - started, file };
    } catch (error) {
      row = { ...row, error: String((error as Error).message), ms: Date.now() - started };
    }
    await appendFile(ledger, `${JSON.stringify(row)}\n`);
    await writeFile(join(root, `${shot.id}-${variant}.prompt.txt`), prompt);
    console.log(`${id} ${row.error ? `ERROR ${row.error}` : `$${row.cost} ${row.ms} ms`}`);
  }
}
