/**
 * Which picture checker for FLUX 3? The production check (buildQaPrompt with the identity sheet) on the 30 first
 * attempts of the FLUX.2/FLUX 3 comparison of 2026-10-27, whose defects were judged by eye
 * (docs/story-examples/flux3-klein-vergleich-2026-10-27/README.md, "Auffällige Bilder"): 9 defective, 21 clean.
 *
 *   cd backend; encore exec -- bun --env-file=../.env.local ../scripts/image-bench/vision-checker-ab.ts --models openai/gpt-6.1-terra,openai/gpt-6-luna
 */
import { appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createOpenRouterStorybookLlm } from "../../backend/story/storybook/llm-openrouter";
import { buildQaPrompt, parseQaReport, qaCountNames, qaSeverityParts, qaStatus, scopeQaReport } from "../../backend/story/storybook/images";
import type { VisualEntity } from "../../backend/story/storybook/illustration-stage";
import { encodeReferenceSprite, renderIdentitySprite, renderSingleReference } from "../../backend/story/image-reference-sprite";
import sharp from "sharp";

process.chdir(join(import.meta.dir, "../.."));
const bench = "Logs/image-bench/flux3-story-comparison-2026-10-27";
const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const models = (arg("models") || "openai/gpt-6.1-terra,openai/gpt-6-luna").split(",");
const llm = createOpenRouterStorybookLlm();

// The bench roster (scripts/image-bench/flux3-story-comparison.ts).
const figure = (id: string, name: string, appearance: string, file: string, species: string, hero = false): VisualEntity & { file: string } =>
  ({ id, name, appearance, file: join("Logs/image-bench/roster", file), kind: "character", role: hero ? "hero" : "cast", species, isHuman: species === "human", forbidden: [] });
const roster = [
  figure("a", "Alexander", "young boy, short brown hair, green eyes, pale green shirt and jeans", "hero-alexander.jpg", "human", true),
  figure("b", "Adrian", "young boy, short blond hair, blue eyes, grey-green shirt and jeans", "hero-adrian.jpg", "human", true),
  figure("fox", "Bo", "orange fox, round glasses, green vest over white shirt, brown book satchel", "7cd7c99a-35cd-460e-9a4e-2e6d5fc53f53.jpg", "fox"),
  figure("dragon", "Fauchi", "small green dragon, pale belly, orange wing membranes", "7ae55808-ab5c-484b-a792-76030a875932.jpg", "dragon"),
  figure("cloud", "Wuschel", "small white cloud creature with rainbow scarf", "f738e1ed-4bf7-4a36-8d28-f289075c469e.jpg", "cloud"),
  figure("witch", "Griselda", "elderly witch in black pointed hat and long black robe", "5cba02d9-6dad-4100-96b4-afe7d88dbe67.jpg", "human"),
  figure("merchant", "Gustav", "round adult man, grey hair, colourful patterned vest and white shirt", "696c0208-7116-4e47-b04d-f289f525c3e8.jpg", "human"),
];
// First attempts with a defect, as judged in the README.
const defects: Record<string, string> = {
  "forest-cover-flux2": "Bo doubled, Adrian missing",
  "forest-3-flux2": "Alexander missing",
  "forest-4-flux2": "Bo as a human with a fox tail",
  "cloud-cover-flux2": "cloud and child merged",
  "cloud-2-flux2": "Alexander doubled",
  "cloud-4-flux2": "dragon wings on a child, Fauchi missing",
  "witch-cover-flux2": "child in witch robe and hat",
  "witch-1-flux2": "Alexander in witch robe and hat",
  "cloud-2-flux3": "Adrian doubled",
};

const rows = (await readFile(join(bench, "results.jsonl"), "utf8")).trim().split("\n").map((line) => JSON.parse(line))
  .filter((row) => row.variant === "baseline" && !row.id.endsWith("-retry") && row.file);
const tally: Record<string, { caught: number; missed: string[]; falseAlarms: string[]; costUSD: number }> = {};
for (const row of rows) {
  const key = `${row.scene}-${row.model}`;
  const onStage = (row.cast as string[]).map((name) => roster.find((entry) => entry.name === name)!);
  const portraits = await Promise.all(onStage.map((entry) => readFile(entry.file)));
  const sheet = await encodeReferenceSprite(onStage.length === 1 ? await renderSingleReference(portraits[0]) : await renderIdentitySprite(portraits));
  const image = `data:image/jpeg;base64,${(await sharp(row.file.replace(/\\/g, "/")).jpeg({ quality: 88 }).toBuffer()).toString("base64")}`;
  const names = qaCountNames(onStage, [], row.sceneText);
  for (const model of models) {
    const call = await llm({ stage: "checker-ab", role: "support", model, system: "You are a meticulous picture-book illustration checker. Answer with JSON only.", user: buildQaPrompt(onStage, row.sceneText, true), json: true, maxTokens: 3000, effort: "low", imageInputs: [image, `data:image/jpeg;base64,${sheet.toString("base64")}`], timeoutMs: 60_000 });
    const raw = parseQaReport(call.text, names);
    const qa = raw ? scopeQaReport(raw, onStage.map((entry) => entry.name), [], row.sceneText) : undefined;
    const parts = qaSeverityParts(qa, names.length, { heroNames: ["Alexander", "Adrian"], cover: row.scene.endsWith("cover") });
    const status = qaStatus(qa, parts);
    const flagged = parts.hard + parts.soft >= 10;
    const t = (tally[model] ||= { caught: 0, missed: [], falseAlarms: [], costUSD: 0 });
    t.costUSD += call.usage?.costUSD || 0;
    const notes = qa ? [...qa.anatomyDefects, ...qa.animalFeaturesOnHumans, ...(qa.featureBleed || []), ...qa.duplicates, ...qa.unexpectedCharacters, ...(qa.missing || []).map((name) => `${name} missing`), ...(qa.textVisible ? ["text"] : []), ...(qa.posing ? ["posing"] : [])] : ["unreadable"];
    if (defects[key]) { if (flagged) t.caught += 1; else t.missed.push(`${key} (${defects[key]})`); }
    else if (flagged) t.falseAlarms.push(`${key}: ${notes.join("; ")}`);
    await appendFile(join(bench, "checker-ab.jsonl"), `${JSON.stringify({ key, model, truth: defects[key] || "clean", status, severity: parts.hard + parts.soft, notes, costUSD: call.usage?.costUSD })}\n`);
    console.log(`${key.padEnd(24)} ${model.padEnd(22)} truth=${(defects[key] || "clean").padEnd(40)} ${status.padEnd(7)} ${notes.join("; ").slice(0, 120)}`);
  }
}
for (const [model, t] of Object.entries(tally)) {
  console.log(`\n${model}: caught ${t.caught}/${Object.keys(defects).length}, false alarms ${t.falseAlarms.length}/${rows.length - Object.keys(defects).length}, $${t.costUSD.toFixed(4)} for ${rows.length} checks`);
  t.missed.forEach((miss) => console.log(`  missed ${miss}`));
  t.falseAlarms.forEach((alarm) => console.log(`  false alarm ${alarm}`));
}
