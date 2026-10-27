/**
 * Re-checks the pictures of a finished Talea-Folge story with other vision models: every attempt in the complete-stage
 * log (imageQa[].history, with picture URLs since 5fa58c4) is read again with the production check, against the scene
 * the director wrote. Without the identity sheet (portraits are not in the log), so identity is judged from the looks.
 *
 *   cd backend; encore exec -- bun --env-file=../.env.local ../scripts/image-bench/recheck-story.ts --log <logs.json> --models openai/gpt-6.1-terra,openai/gpt-6-luna [--pages 2,3] [--portraits <id>=<file>,…]
 *
 * --portraits: local stand-ins for the figures' portraits; when every figure of a picture has one, the check gets the
 * identity sheet like production does.
 */
import { appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { createOpenRouterStorybookLlm } from "../../backend/story/storybook/llm-openrouter";
import { buildQaPrompt, parseQaReport, qaCountNames, qaSeverityParts, qaStatus, scopeQaReport } from "../../backend/story/storybook/images";
import type { VisualEntity } from "../../backend/story/storybook/illustration-stage";
import { encodeReferenceSprite, renderIdentitySprite, renderSingleReference } from "../../backend/story/image-reference-sprite";

process.chdir(join(import.meta.dir, "../.."));
const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const models = (arg("models") || "openai/gpt-6.1-terra,openai/gpt-6-luna").split(",");
const only = arg("pages")?.split(",").map(Number);
const proxy = "https://backend-2-production-3de1.up.railway.app/story/image?key=";
const logs = JSON.parse(await readFile(arg("log")!, "utf8")).logs as any[];
const stage = (name: string) => logs.find((entry) => entry.metadata?.stage === name)?.response;
const plan = stage("episode-plan").plan;
const direction = stage("illustration-plan").illustrations;
const complete = stage("complete");
const llm = createOpenRouterStorybookLlm();
const portraits = new Map((arg("portraits") || "").split(",").filter(Boolean).map((pair) => pair.split("=") as [string, string]));
const sheetFor = async (figures: VisualEntity[]) => {
  if (!figures.length || !figures.every((entity) => portraits.has(entity.id))) return undefined;
  const buffers = await Promise.all(figures.map((entity) => readFile(portraits.get(entity.id)!)));
  return `data:image/jpeg;base64,${(await encodeReferenceSprite(figures.length === 1 ? await renderSingleReference(buffers[0]) : await renderIdentitySprite(buffers))).toString("base64")}`;
};

const entities: VisualEntity[] = [
  ...plan.heroes.map((hero: any) => ({ id: hero.id, name: hero.name, kind: "character", role: "hero", species: "human", isHuman: true, appearance: "young child, one of the story's two boys", forbidden: [] })),
  ...plan.cast.map((member: any) => ({ id: member.id, name: member.name, kind: "character", role: "cast", species: member.species, isHuman: member.species === "human", appearance: member.lookEn || member.comicPattern || member.name, forbidden: [] })),
];
const shots = [direction.cover, ...direction.pages];
for (const outcome of complete.imageQa as any[]) {
  if (only && !only.includes(outcome.page)) continue;
  const shot = shots.find((entry: any) => entry.page === outcome.page);
  const onStage = shot.onStage.map((id: string) => entities.find((entity) => entity.id === id)).filter(Boolean) as VisualEntity[];
  const names = qaCountNames(onStage, [], shot.scene);
  const sheet = await sheetFor(onStage);
  for (const [index, attempt] of (outcome.history || []).entries()) {
    if (!attempt.url || attempt.kind === "vignette") continue;
    const key = String(attempt.url).replace(/^bucket:\/\/[^/]+\//, "");
    const image = Buffer.from(await (await fetch(`${proxy}${encodeURIComponent(key)}`)).arrayBuffer());
    const uri = `data:image/jpeg;base64,${(await sharp(image).jpeg({ quality: 88 }).toBuffer()).toString("base64")}`;
    for (const model of models) {
      const call = await llm({ stage: "recheck", role: "support", model, system: "You are a meticulous picture-book illustration checker. Answer with JSON only.", user: buildQaPrompt(onStage, shot.scene, Boolean(sheet)), json: true, maxTokens: 3000, effort: "low", imageInputs: sheet ? [uri, sheet] : [uri], timeoutMs: 60_000 });
      const raw = parseQaReport(call.text, names);
      const qa = raw ? scopeQaReport(raw, onStage.map((entity) => entity.name), [], shot.scene) : undefined;
      const parts = qaSeverityParts(qa, names.length, { heroNames: onStage.filter((entity) => entity.role === "hero").map((entity) => entity.name), cover: outcome.page === 0 });
      const notes = qa ? [...qa.anatomyDefects, ...qa.duplicates, ...qa.unexpectedCharacters, ...(qa.featureBleed || []), ...(qa.missing || []).map((name) => `${name} missing`), ...(qa.textVisible ? [`text: ${qa.textSeen || "?"}`] : []), ...(qa.posing ? ["posing"] : [])] : ["unreadable"];
      const row = { story: complete.title, sheet: Boolean(sheet), page: outcome.page, attempt: index + 1, kind: attempt.kind, production: attempt.status, model, status: qaStatus(qa, parts), notes, costUSD: call.usage?.costUSD };
      await appendFile("Logs/image-bench/recheck.jsonl", `${JSON.stringify(row)}\n`);
      console.log(`${sheet ? "sheet " : ""}picture ${outcome.page} #${index + 1} ${attempt.kind.padEnd(8)} prod=${attempt.status.padEnd(7)} ${model.padEnd(22)} ${String(row.status).padEnd(7)} ${notes.join("; ").slice(0, 150)}`);
    }
  }
}
