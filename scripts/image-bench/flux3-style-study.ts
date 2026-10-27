/** Three fixed Talea scenes × seven prompt/style variants. Image costs only; art direction is authored in Codex. */
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { assembleFlux3ImagePrompt, assembleImagePrompt, MODERN_CHILDRENS_BOOK_STYLE, type VisualEntity } from "../../backend/story/storybook/illustration-stage";
import { ORIGINALS_IMAGE_STYLE } from "../../backend/story/library/images";
import { runwareImageModelOptions } from "../../backend/ai/runware-image-model-options";
import { encodeReferenceSprite, renderIdentitySprite } from "../../backend/story/image-reference-sprite";

const root = "Logs/image-bench/flux3-style-study-2026-10-27";
const apiKey = process.env.RUNWARE_API_KEY;
if (!apiKey) throw new Error("RUNWARE_API_KEY missing");
await mkdir(join(root, "images"), { recursive: true });
await mkdir(join(root, "prompts"), { recursive: true });
const figures: Record<string, VisualEntity & { file: string }> = {
  a: { id: "a", name: "Alexander", role: "hero", kind: "character", species: "human", isHuman: true, appearance: "brown-haired boy with green eyes, pale green T-shirt, blue jeans, brown shoes", forbidden: [], file: "hero-alexander.jpg" },
  b: { id: "b", name: "Adrian", role: "hero", kind: "character", species: "human", isHuman: true, appearance: "blond boy with blue eyes, grey-green T-shirt, blue jeans, brown shoes", forbidden: [], file: "hero-adrian.jpg" },
  fox: { id: "fox", name: "Bo", role: "cast", kind: "character", species: "fox", isHuman: false, appearance: "orange fox, round glasses, green vest over a white shirt, brown book satchel", forbidden: [], file: "7cd7c99a-35cd-460e-9a4e-2e6d5fc53f53.jpg" },
  cloud: { id: "cloud", name: "Wuschel", role: "cast", kind: "character", species: "cloud", isHuman: false, appearance: "small white cloud creature with a rainbow scarf", forbidden: [], file: "f738e1ed-4bf7-4a36-8d28-f289075c469e.jpg" },
};
const scenes = [
  { id: "map", cast: ["a", "b", "fox"], seed: 731,
    original: "A mossy forest library at dawn: Bo opens a star map across a low wooden table, Alexander points at a tiny silver star on the map and Adrian holds a glowing lantern. Books and tall ferns frame the three figures, with soft golden light through the windows.",
    directed: "Medium shot from table height, the star map angled diagonally across the foreground. At the right Bo leans across the low wooden table with one paw spread on the map, peering through his glasses at its silver star. At the left Alexander bends forward on his toes, one finger hovering just above that star, eyebrows lifted in discovery. Behind the table Adrian lifts the lantern to light the exact spot, tilting his head toward it with a small delighted smile. The three gazes meet on the map. The open round window and two bookshelves frame the mossy forest library; dawn light catches the paper and lantern glass." },
  { id: "rain", cast: ["a", "b", "cloud"], seed: 736,
    original: "In a sunny hillside garden Wuschel sneezes a few sparkling raindrops over a flowerpot, Alexander holds an open umbrella above the pot and Adrian laughs as he reaches for a falling drop. A stone wall and flowers fill the garden.",
    directed: "Low, slightly oblique medium-wide view at flowerpot height. Wuschel hovers at the upper right, cheeks puffed in the instant of a tiny rain sneeze, rainbow scarf streaming behind the cloud. At the left Alexander leans sideways while keeping the umbrella over the terracotta flowerpot, knees bent and eyes following the drops. Near the pot Adrian reaches one open palm toward a drop and grins at the cloud, his other arm balancing his forward lean. A few drops sparkle between them; the garden wall recedes diagonally into soft green hills. Clear sunny light and one bright patch of flowers surround the focal pot." },
  { id: "stream", cast: ["a", "b"], seed: 733,
    original: "On a narrow wooden footbridge over a forest stream Alexander holds a paper star up to the light, while Adrian leans on the railing and looks into the water. Ferns, stepping stones and a little waterfall surround them in morning light.",
    directed: "Quiet medium-wide view from the stream bank, the wooden footbridge crossing the picture diagonally. On its near side Alexander stands in three-quarter profile, one elbow bent as he turns a paper star between finger and thumb toward a shaft of light, lips slightly parted with concentration. Farther along the bridge Adrian rests his forearms on the rail and leans his chin forward, looking down into the ripples with a thoughtful half-smile. Their poses and gazes differ naturally. A foreground fern frames one corner; stepping stones lead toward a small waterfall beyond the bridge. Airy morning light makes the paper translucent and leaves open space above the stream." },
];
const styles = {
  modern: MODERN_CHILDRENS_BOOK_STYLE,
  dreamworks: "DreamWorks Animation feature-film visual style: polished stylised 3D animation, sculpted appealing silhouettes, expressive asymmetrical faces, tactile fabrics, lively but believable body language, rich cinematic colour with warm bounced light and clear foreground-to-background staging. These are the original Talea characters from the reference, translated into this medium with the same identifying colours and clothing. A wordless finished scene.",
  pixar: "Pixar animated feature-film visual style: appealing rounded 3D characters, finely shaded tactile materials, expressive nuanced faces, soft cinematic lighting and warm colour harmony, graceful readable poses and a carefully staged environment. These are the original Talea characters from the reference, translated into this medium with the same identifying colours and clothing. A wordless finished scene.",
  jansson: "Children's book illustration in the style of Tove Jansson: supple expressive black ink lines, airy spare composition, delicate cross-hatched natural details and restrained watercolour washes, lyrical woodland atmosphere, quiet humour and characterful gestures. Keep the original Talea characters and their identifying colours and clothing; the whole environment belongs to this illustration. Wordless picture.",
  sendak: "Children's picture-book illustration in the style of Maurice Sendak: finely hatched ink drawing with warm muted watercolour, compact expressive figures, richly observed foliage and textured surroundings, theatrical yet intimate storytelling and subtle humour. Keep the original Talea characters and their identifying colours and clothing. Wordless picture.",
};
const variants = ["previous", "caption", "directed", "dreamworks", "pixar", "jansson", "sendak"];
const ledger = join(root, "results.jsonl");
let rows: any[] = [];
try { rows = (await readFile(ledger, "utf8")).split("\n").filter(Boolean).map((line) => JSON.parse(line)); } catch {}
let spent = rows.reduce((n, row) => n + (row.cost || 0), 0);
for (const scene of scenes) {
  const cast = scene.cast.map((id) => figures[id]);
  const sheet = await encodeReferenceSprite(await renderIdentitySprite(await Promise.all(cast.map((figure) => readFile(join("Logs/image-bench/roster", figure.file))))));
  await writeFile(join(root, `${scene.id}-reference.jpg`), sheet);
  for (const variant of variants) {
    const id = `${scene.id}-${variant}`;
    if (rows.some((row) => row.id === id && row.file)) continue;
    if (spent > .5) throw new Error("Study budget reached");
    const prompt = variant === "previous"
      ? assembleImagePrompt({ scene: scene.original, onStage: cast, spriteOrder: cast, style: ORIGINALS_IMAGE_STYLE, actionDirection: "Characters are engaged in the action, looking at each other or the event, in side or three-quarter view." })
      : assembleFlux3ImagePrompt({ scene: variant === "caption" ? scene.original : scene.directed, onStage: cast, spriteOrder: cast, style: variant === "caption" || variant === "directed" ? styles.modern : styles[variant as keyof typeof styles] });
    await writeFile(join(root, "prompts", `${id}.txt`), prompt);
    const model = "bfl:flux@3-image-klein";
    const task = { taskType: "imageInference", taskUUID: crypto.randomUUID(), model, numberResults: 1, outputType: ["URL"], includeCost: true, width: 1024, height: 1024, seed: scene.seed,
      ...runwareImageModelOptions({ model, steps: 16, outputFormat: "WEBP" }), positivePrompt: prompt,
      inputs: { referenceImages: [`data:image/jpeg;base64,${sheet.toString("base64")}`] } };
    const start = Date.now();
    let row: any = { id, scene: scene.id, variant, seed: scene.seed, model, prompt, figures: cast.map((figure) => figure.name) };
    try {
      const response = await fetch("https://api.runware.ai/v1", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify([task]), signal: AbortSignal.timeout(180000) });
      const data: any = await response.json();
      if (!response.ok || data.errors?.length) throw new Error(`HTTP ${response.status}: ${data.errors?.[0]?.code || "provider error"}`);
      const image = data.data?.[0];
      const cost = Number(image?.cost);
      if (!Number.isFinite(cost)) throw new Error("Provider did not report a cost");
      row.cost = cost; row.providerMs = Date.now() - start; spent += cost;
      if (!image?.imageURL || image.NSFWContent === true) throw new Error("No publishable output");
      const download = await fetch(image.imageURL, { signal: AbortSignal.timeout(60000) });
      if (!download.ok) throw new Error(`Download HTTP ${download.status}`);
      const bytes = Buffer.from(await download.arrayBuffer());
      const file = join(root, "images", `${id}.webp`);
      await writeFile(file, bytes); await sharp(bytes).metadata();
      row.file = file;
    } catch (error) { row.error = String((error as Error).message); }
    row.totalMs = Date.now() - start;
    await appendFile(ledger, `${JSON.stringify(row)}\n`);
    console.log(`${id}: ${row.file ? "OK" : row.error}, $${row.cost ?? "?"}, ${row.totalMs} ms`);
  }
}
console.log(`Total recorded cost: $${spent.toFixed(4)}`);
