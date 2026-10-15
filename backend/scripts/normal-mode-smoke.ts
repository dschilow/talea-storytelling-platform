/**
 * Text-only run of the normal-mode engine (the same engine the customer path uses) against the
 * local Encore database — no images, no writes, no personality updates.
 *
 *   cd backend
 *   $env:OPENROUTER_API_KEY = "…"            (and $env:TALEA_HEART_AND_WIT = "off" for the old prompts)
 *   encore exec -- npx tsx scripts/normal-mode-smoke.ts <out-dir> <genre> <age> <flavors> [length]
 *
 * Writes story.md and result.json (title, chapters, cost, score) to <out-dir>.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateStoryDevMode, pickDevModePoolCharacters } from "../story/dev-mode-generation";
import { DEFAULT_OPENROUTER_STORY_MODEL } from "../story/openrouter-generation";

const [out, genre = "magic", ageGroup = "6-8", flavorList = "lachfreude", length = "medium"] = process.argv.slice(2);
if (!out) throw new Error("usage: normal-mode-smoke.ts <out-dir> <genre> <age> <flavors> [length]");
const flavors = flavorList.split(",").filter(Boolean);
const heroes = JSON.parse(readFileSync("../Logs/test-heroes-alexander-adrian.json", "utf8"));
const config: any = {
  avatarIds: heroes.map((hero: any) => hero.id),
  genre, setting: genre === "fairy_tales" ? "fantasy" : "varied", ageGroup, length, complexity: "medium", language: "de",
  emotionalFlavors: flavors, humorLevel: flavors.includes("lachfreude") ? 2 : 1, suspenseLevel: flavors.includes("prickeln") ? 2 : 1,
  requireHappyEnd: true, aiProvider: "openrouter", openRouterModel: DEFAULT_OPENROUTER_STORY_MODEL,
};
const poolCharacters = await pickDevModePoolCharacters({
  setting: config.setting, genre, ageGroup, userId: "smoke-normal-mode",
  excludeNames: new Set(heroes.map((hero: any) => String(hero.name).toLowerCase())), heroCount: heroes.length,
});
const started = Date.now();
const story: any = await generateStoryDevMode({
  config,
  userId: "smoke-normal-mode",
  avatars: heroes.map((hero: any) => ({ id: hero.id, name: hero.name, description: hero.description, visualProfile: hero.visualProfile })),
  poolCharacters,
  qualityMode: "premium",
  debug: true,
  disableArtifactSelection: true,
  disablePersistenceSideEffects: true,
});
mkdirSync(out, { recursive: true });
const chapters = (story.chapters || []).map((chapter: any) => `## ${chapter.title}\n\n${chapter.content}`).join("\n\n");
const cost = story.metadata?.totalCost ?? story.metadata?.costUSD ?? null;
writeFileSync(join(out, "story.md"), `# ${story.title}\n\n_${story.description}_\n\n${chapters}\n`, "utf8");
writeFileSync(join(out, "result.json"), JSON.stringify({ config, pool: poolCharacters.map((c) => c.name), title: story.title, description: story.description, chapters: story.chapters, metadata: { qualityScore: story.metadata?.qualityScore, status: story.metadata?.status, cost, stages: (story.metadata?.devModeStages || []).map((s: any) => ({ stage: s.stage, model: s.modelUsed, costUSD: s.costUSD })) } }, null, 2), "utf8");
console.log(`■ ${story.title} — score ${story.metadata?.qualityScore ?? "–"}, ${Math.round((Date.now() - started) / 1000)} s, cost ${JSON.stringify(cost)} → ${out}`);
process.exit(0);
