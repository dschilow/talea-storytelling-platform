/**
 * Runs the production picture check (buildQaPrompt → parseQaReport → scopeQaReport) on images of flux3-text-probe with
 * one or more vision models, so the readers can be compared on the same pictures (story 26fdd23f: 3 of 7 pictures
 * failed on "text visible").
 *
 *   cd backend; encore exec -- bun --env-file=../.env.local ../scripts/image-bench/flux3-qa-probe.ts --models openai/gpt-6.1-terra,openai/gpt-6-luna [--match prod]
 *
 * (The OpenRouter port reads an Encore secret, hence encore exec; the script works from the repo root.)
 */
import { appendFile, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { createOpenRouterStorybookLlm } from "../../backend/story/storybook/llm-openrouter";
import { buildQaPrompt, parseQaReport, qaCountNames, qaSeverityParts, qaStatus, scopeQaReport } from "../../backend/story/storybook/images";
import type { VisualEntity } from "../../backend/story/storybook/illustration-stage";
import { encodeReferenceSprite, renderIdentitySprite } from "../../backend/story/image-reference-sprite";

process.chdir(join(import.meta.dir, "../.."));
const root = "Logs/image-bench/flux3-text-probe";
const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const models = (arg("models") || "openai/gpt-6.1-terra").split(",");
const match = arg("match") || "";
const llm = createOpenRouterStorybookLlm();

const figure = (id: string, name: string, appearance: string, role: "hero" | "cast", species: string): VisualEntity =>
  ({ id, name, appearance, kind: "character", role, species, isHuman: species === "human", forbidden: [] });
const alexander = figure("a", "Alexander", "young boy, short tousled brown hair, green eyes, pale green T-shirt and jeans", "hero", "human");
const adrian = figure("b", "Adrian", "young boy, short blond hair, blue eyes, grey T-shirt and jeans", "hero", "human");
const karo = figure("karo-spielbrett", "Karo", "A square wooden game board with red and cream tiles, a tiny carved face and flexible rolled-up edges.", "cast", "thing");
const kater = figure("gestiefelter-kater", "Der gestiefelte Kater", "An orange tabby cat with a white muzzle, a feathered green hat and oversized brown boots.", "cast", "animal");
const cast: Record<string, VisualEntity[]> = { cover: [alexander, adrian, karo], p1: [alexander, adrian, karo], p6: [alexander, adrian, kater] };
const scenes: Record<string, string> = Object.fromEntries(await Promise.all(Object.keys(cast).map(async (shot) => {
  const files = (await readdir(root)).filter((file) => file.startsWith(`${shot}-`) && file.endsWith(".prompt.txt"));
  return [shot, files.length ? (await readFile(join(root, files[0]), "utf8")).split(/(?<=\.)\s/).slice(0, 4).join(" ") : ""];
})));

// --prod-like: what production sends besides the picture — the identity sheet and the reading segment (story 26fdd23f).
const prodLike = process.argv.includes("--prod-like");
const pageTexts: Record<string, string> = {
  p1: "Alexander fuhr mit dem Finger über die Spielfelder. Wege merkte er sich besonders gern. Diesen kannte er bereits auswendig. „Beim Brunnen rechts, beim Apfelbaum geradeaus“, sagte Alexander. „Dann am schlafenden Esel vorbei.“ Adrian setzte seine Figur neben den gemalten Esel. „Vielleicht schläft der nur, weil du alles aufsagst.“ Alexander lachte und stupste den Esel an. Das alte Spielbrett knarrte unter seinem Finger. „Nicht kitzeln“, sagte es. „Ich bin Karo. Meine Esel schlafen ordentlich.“ Im Spielzimmer roch es nach Bienenwachs und Birnen. „Wir könnten ihr unseren Weg zeigen“, sagte Alexander. Adrian beugte sich über das letzte Feld. „Hier steht Ziel. Dort endet die Runde.“ „Auch ohne Verbeugung“, ergänzte Karo knarrend. Karo ließ seinen hölzernen Drehpfeil kreisen. Die Spitze zeigte Adrian vier Schritte. Adrian zählte langsam und setzte seine Figur weiter. „Brunnen, Baum, Esel, Ziel.“ „Genau“, sagte Karo. „Die Runde ist beendet. Adrian hat gewonnen.“",
  p6: "„Ich war aber wirklich knapp dran“, sagte Alexander. „Nur zwei Felder. Und den Weg kannte ich schon.“ Adrian ließ seine Hand los. Seine Figur stand noch immer auf dem Ziel. Daneben klebte ein winziger Wollfaden von der Decke. Alexander zupfte den Faden ab. Adrian hatte langsam gezählt und kein Feld übersprungen. Hinter ihnen knarrte die gespannte Bahn. Der Kater hielt seinen Hut fest. Alexander stellte beide Füße fest auf den Boden. Seine Finger drückten noch immer den Wollfaden. „Adrian hat gewonnen. Gut gespielt!“ Im selben Moment löste sich der Knoten. SIRRR! Alle drei Bahnen glitten über den Boden.",
};
const portraitFiles: Record<string, string> = { a: "Logs/image-bench/roster/hero-alexander.jpg", b: "Logs/image-bench/roster/hero-adrian.jpg", "karo-spielbrett": `${root}/portraits/karo.png`, "gestiefelter-kater": `${root}/portraits/kater.png` };
// Pictures drawn from the book's own crops (--refs book in flux3-text-probe) are checked against those crops.
const portraitFor = (entity: VisualEntity, file: string) => !file.includes("-book-") ? portraitFiles[entity.id]
  : entity.id === "a" ? `${root}/portraits/alexander-book.png` : entity.id === "b" ? `${root}/portraits/${file.includes("-clean-") ? "adrian-clean" : "adrian-logo"}.png` : portraitFiles[entity.id];
const sheetUri = async (entities: VisualEntity[], file: string) => `data:image/jpeg;base64,${(await encodeReferenceSprite(await renderIdentitySprite(await Promise.all(entities.map((entity) => readFile(portraitFor(entity, file))))))).toString("base64")}`;
const dataUri = async (file: string) => `data:image/jpeg;base64,${(await sharp(file).jpeg({ quality: 88 }).toBuffer()).toString("base64")}`;
const files = (await readdir(join(root, "images"))).filter((file) => file.endsWith(".png") && match.split(",").some((part) => file.includes(part))).sort();
for (const file of files) {
  const shot = file.split("-")[0];
  const onStage = cast[shot];
  if (!onStage) continue;
  const image = await dataUri(join(root, "images", file));
  const names = qaCountNames(onStage, [], scenes[shot]);
  for (const model of models) {
    const user = buildQaPrompt(onStage, scenes[shot], prodLike, [], prodLike ? pageTexts[shot] : undefined);
    const imageInputs = prodLike ? [image, await sheetUri(onStage, file)] : [image];
    const call = await llm({ stage: "qa-probe", role: "support", model, system: "You are a meticulous picture-book illustration checker. Answer with JSON only.", user, json: true, maxTokens: 3000, effort: "low", imageInputs, timeoutMs: 60_000 });
    const raw = parseQaReport(call.text, names);
    const qa = raw ? scopeQaReport(raw, onStage.map((entity) => entity.name), [], scenes[shot]) : undefined;
    const parts = qaSeverityParts(qa, names.length, { heroNames: ["Alexander", "Adrian"], cover: shot === "cover" });
    const row = { file, model, prodLike, status: qaStatus(qa, parts), severity: parts.hard + parts.soft, text: qa?.textVisible, posing: qa?.posing, scene: qa?.sceneMatch, identity: qa?.identityMatch, notes: qa ? [...qa.anatomyDefects, ...qa.duplicates, ...qa.unexpectedCharacters, ...(qa.missing || []).map((name) => `${name} missing`)] : ["unreadable"], costUSD: call.usage?.costUSD, ms: call.durationMs };
    await appendFile(join(root, "qa.jsonl"), `${JSON.stringify(row)}\n`);
    console.log(`${file.padEnd(28)} ${model.padEnd(24)} ${String(row.status).padEnd(7)} sev ${String(row.severity).padStart(3)} text=${row.text} posing=${row.posing} scene=${row.scene} $${row.costUSD?.toFixed(5)} ${row.notes.join("; ")}`);
  }
}
