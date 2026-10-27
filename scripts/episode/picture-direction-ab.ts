/**
 * Talea-Folge picture direction on a finished story: the art director (directEpisodePictures, production code) runs on
 * the story's chapters and plan, and with --render every picture is drawn once with FLUX 3 Klein (production prompt and
 * sprite, no vision check), so two director versions can be compared on the same text.
 *
 *   cd backend; encore exec -- bun --env-file=../.env.local ../scripts/episode/picture-direction-ab.ts --label new [--render] [--from-log] [--heroes roster]
 *
 * --from-log draws the direction the story was printed with (its illustration-plan log) instead of asking the director;
 * --heroes roster takes the clean bench portraits of the two boys instead of the crops from the story's picture;
 * --adrian <file> another portrait for Adrian (adrian-portrait-logo.png: clean, with the shirt logo of his avatar);
 * --check runs the picture stage as production does: looks reader (marks), vision check, the whole ladder.
 *
 * Inputs (story 26fdd23f "Das Brett bis zur Tür"): Logs/image-bench/flux3-text-probe/story-26fdd23f-{chapters,logs}.json
 * and the portraits there. Output: Logs/image-bench/flux3-text-probe/direction-<label>/.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { createOpenRouterStorybookLlm } from "../../backend/story/storybook/llm-openrouter";
import { directEpisodePictures } from "../../backend/story/episode/pictures";
import { toStoryPlan } from "../../backend/story/episode/engine";
import { generateStorybookImages, type ImageProvider } from "../../backend/story/storybook/images";
import { describeReferenceLooks, MODERN_CHILDRENS_BOOK_STYLE, type VisualEntity } from "../../backend/story/storybook/illustration-stage";
import { episodeVisionModel } from "../../backend/story/episode/craft";
import { withTaleaImageStyle } from "../../backend/ai/image-style";
import type { StoryBrief } from "../../backend/story/storybook/context";

process.chdir(join(import.meta.dir, "../.."));
const root = "Logs/image-bench/flux3-text-probe";
const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const label = arg("label") || "run";
const model = arg("model") || "openai/gpt-6.1-terra";
const out = join(root, `direction-${label}`);
await mkdir(out, { recursive: true });

const chapters = JSON.parse(await readFile(join(root, "story-26fdd23f-chapters.json"), "utf8")) as Array<{ order: number; title: string; content: string }>;
const logs = JSON.parse(await readFile(join(root, "story-26fdd23f-logs.json"), "utf8"));
const episodePlan = logs.logs.find((entry: any) => entry.metadata?.stage === "episode-plan").response.plan;
const plan = toStoryPlan(episodePlan, chapters.map((chapter) => ({ text: chapter.content })));

const portrait = async (file: string) => `data:image/jpeg;base64,${(await sharp(join(root, "portraits", file)).jpeg({ quality: 90 }).toBuffer()).toString("base64")}`;
const entity = async (id: string, name: string, appearance: string, tag: string, file: string, role: "hero" | "cast", species: string): Promise<VisualEntity> =>
  ({ id, name, appearance, tag, kind: "character", role, species, isHuman: species === "human", forbidden: [], referenceUrl: await portrait(file) });
const roster = arg("heroes") === "roster";
const entities = await Promise.all([
  roster
    ? entity("bd2874ac-ee2c-4bf5-b65c-44b95ff2da2d", "Alexander", "young boy, light skin, short tousled brown hair, green eyes, plain pale green T-shirt, blue jeans", "brown-haired boy in green T-shirt", "../../roster/hero-alexander.jpg", "hero", "human")
    : entity("bd2874ac-ee2c-4bf5-b65c-44b95ff2da2d", "Alexander", "young boy, light skin, short tousled brown hair, green eyes, plain turquoise T-shirt, dark blue jeans", "brown-haired boy in turquoise T-shirt", "alexander-book.png", "hero", "human"),
  roster
    ? entity("67cf4daa-95da-414b-98aa-2a904ae89948", "Adrian", "young boy, light skin, short blond hair, blue eyes, plain grey T-shirt, blue jeans", "blond boy in grey T-shirt", arg("adrian") || "../../roster/hero-adrian.jpg", "hero", "human")
    : entity("67cf4daa-95da-414b-98aa-2a904ae89948", "Adrian", "young boy, light skin, short spiky blond hair, blue eyes, plain navy T-shirt, dark blue jeans", "blond boy in navy T-shirt", arg("adrian") || "adrian-clean.png", "hero", "human"),
  entity("karo-spielbrett", "Karo", "A square wooden game board with red and cream tiles, a tiny carved face and flexible rolled-up edges.", "square red-and-cream wooden game board", "karo.png", "cast", "thing"),
  entity("gestiefelter-kater", "Der gestiefelte Kater", "An orange tabby cat with a white muzzle, a feathered green hat and oversized brown boots.", "orange tabby cat in feathered hat and boots", "kater.png", "cast", "animal"),
  entity("0eaed1d5-1c97-476e-acdb-e14bef133b6e", "Prinzessin Rosalinde", "young woman, long wavy rose-red hair, pink puffed-sleeve gown, a flower in her hair", "red-haired princess in pink gown", "rosalinde-book.png", "cast", "human"),
]);
const brief = { budget: { maxCharactersPerImage: 3 }, config: { genre: "fairy_tales", setting: "castle" } } as unknown as StoryBrief;
const llm = createOpenRouterStorybookLlm();
const check = process.argv.includes("--check");
if (check) {
  // Production reads the looks (and now the marks) off every portrait with the support model before directing.
  const known = await describeReferenceLooks(llm, entities, model);
  entities.splice(0, entities.length, ...known.entities);
  for (const entry of entities) console.log(`looks ${entry.name}: ${entry.appearance}${entry.marks?.length ? ` · marks ${JSON.stringify(entry.marks)}` : ""}`);
  console.log(`looks $${known.call?.usage?.costUSD?.toFixed(4)}
`);
}

const printed = logs.logs.find((entry: any) => entry.metadata?.stage === "illustration-plan")?.response;
const direction = process.argv.includes("--from-log")
  ? { illustrations: printed.illustrations, slots: printed.pictures.map((picture: any) => ({ chapter: picture.chapter })), placed: printed.pictures.map((picture: any) => ({ afterParagraph: picture.afterParagraph })), director: {} as any }
  : await directEpisodePictures({ llm, model, brief, title: episodePlan.title, pages: chapters.map((chapter) => ({ order: chapter.order, title: chapter.title, content: chapter.content })), plan, entities });
const nameOf = (id: string) => entities.find((entry) => entry.id === id)?.name || id;
const shots = [direction.illustrations.cover, ...direction.illustrations.pages].map((shot) => ({
  page: shot.page,
  ...(shot.page > 0 ? { chapter: direction.slots[shot.page - 1].chapter, afterParagraph: direction.placed[shot.page - 1]?.afterParagraph, paragraph: shot.paragraph } : {}),
  onStage: shot.onStage.map(nameOf),
  scene: shot.scene,
}));
await writeFile(join(out, "direction.json"), JSON.stringify({ model, costUSD: direction.director.call?.usage?.costUSD, shots }, null, 1));
for (const shot of shots) console.log(`${shot.page === 0 ? "cover" : `${shot.chapter}.${shot.page - (shot.chapter! - 1) * 2} after p${shot.afterParagraph}`}: [${shot.onStage.join(", ")}] ${shot.scene}\n`);
console.log(`director $${direction.director.call?.usage?.costUSD?.toFixed(4)}`);

if (process.argv.includes("--render")) {
  const key = process.env.RUNWARE_API_KEY;
  if (!key) throw new Error("RUNWARE_API_KEY is missing");
  let spent = 0;
  const provider: ImageProvider = async (request) => {
    const body = [{ taskType: "imageInference", taskUUID: crypto.randomUUID(), model: "bfl:flux@3-image-klein", numberResults: 1, outputType: ["URL"], outputFormat: "WEBP", steps: 16, acceleration: "high", safety: { checkContent: true }, width: request.width, height: request.height, includeCost: true, seed: request.seed, positivePrompt: withTaleaImageStyle(request.prompt).replace(/\s+/g, " ").trim(), ...(request.referenceImages.length ? { inputs: { referenceImages: request.referenceImages } } : {}) }];
    const response = await fetch("https://api.runware.ai/v1", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(180_000) });
    const data: any = await response.json();
    if (!response.ok || data.errors?.length) return { httpStatus: response.status };
    spent += Number(data.data[0].cost) || 0;
    const file = join(out, `${request.page === 0 ? "cover" : `page-${request.page}`}-${request.seed}.png`);
    const image = Buffer.from(await (await fetch(data.data[0].imageURL)).arrayBuffer());
    await sharp(image).png().toFile(file);
    return { url: file, viewUrl: `data:image/jpeg;base64,${(await sharp(image).jpeg({ quality: 88 }).toBuffer()).toString("base64")}`, costUSD: Number(data.data[0].cost) };
  };
  const result = await generateStorybookImages({ illustrations: direction.illustrations, entities, provider, seed: "26fdd23f", imageStyle: MODERN_CHILDRENS_BOOK_STYLE, imagePromptProfile: "flux3-modern", concurrency: 8,
    ...(check ? { llm, visionModel: episodeVisionModel(), fallbackVisionModel: model, parallelRedraw: true, pageTexts: Object.fromEntries((direction.pages || []).map((page: any) => [page.order, page.content])) } : {}) });
  const outcomes = [result.cover, ...direction.illustrations.pages.map((shot: any) => result.pages.get(shot.page))];
  for (const outcome of outcomes) if (outcome) console.log(`${outcome.page === 0 ? "cover" : `picture ${outcome.page}`}: ${outcome.status}, ${outcome.attempts} attempt(s)${outcome.vignette ? ", vignette" : ""} — ${(outcome.history || []).map((entry) => `${entry.kind} ${entry.status}${entry.notes.length ? ` (${entry.notes.join("; ")})` : ""}`).join(" → ")}`);
  const checkUSD = result.qaCalls.reduce((sum, call) => sum + (call.usage?.costUSD || 0), 0);
  console.log(`image calls ${result.imageCalls}, checks ${result.qaCalls.length} ($${checkUSD.toFixed(4)})`);
  const files = outcomes.map((outcome) => outcome?.url).filter((file): file is string => Boolean(file));
  const tiles = await Promise.all(files.map((file) => sharp(file).resize(512, 512).toBuffer()));
  await sharp({ create: { width: 512 * 4 + 24, height: 512 * 2 + 8, channels: 3, background: "#000" } })
    .composite(tiles.map((input, i) => ({ input, left: (i % 4) * 520, top: Math.floor(i / 4) * 520 }))).png().toFile(join(out, "sheet.png"));
  console.log(`images $${spent.toFixed(4)} → ${join(out, "sheet.png")}`);
}
