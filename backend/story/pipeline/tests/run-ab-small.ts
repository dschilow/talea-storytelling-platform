import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { storyDB } from "../../db";
import { avatarDB } from "../../../avatar/db";
import { StoryPipelineOrchestrator } from "../orchestrator";
import type { AvatarDetail } from "../types";

const FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(FILE_DIR, "../../../");
const REPO_ROOT = path.resolve(BACKEND_DIR, "..");
const LOGS_DIR = path.join(REPO_ROOT, "Logs", "logs");
const ANALYSIS_DIR = path.join(REPO_ROOT, "Logs", "analysis");

type Phase6TokenSource =
  | "phase6-story-llm"
  | "phase6-story-critic-llm"
  | "phase6-story-release-surgery-llm";

interface UsageSample {
  source: Phase6TokenSource;
  total: number;
  prompt: number;
  completion: number;
}

interface Phase6Metrics {
  storyId: string;
  samples: UsageSample[];
  summary?: {
    qualityScore?: number;
    criticScore?: number;
    errorCount?: number;
    warningCount?: number;
    releaseCandidateCount?: number;
  };
}

class MockImageGenerator {
  async generateImages(input: {
    imageSpecs: Array<{ chapter: number; finalPromptText?: string }>;
    logContext?: { phase?: string };
  }): Promise<Array<{ chapter: number; imageUrl?: string; prompt: string; provider?: string }>> {
    const phase = input.logContext?.phase || "phase9-imagegen";
    return (input.imageSpecs || []).map((spec, idx) => ({
      chapter: Number(spec.chapter || idx + 1),
      imageUrl: `mock://image/${phase}/${spec.chapter || idx + 1}`,
      prompt: String(spec.finalPromptText || ""),
      provider: "mock",
    }));
  }
}

function asObj(v: unknown): Record<string, any> {
  return v && typeof v === "object" ? (v as Record<string, any>) : {};
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function cleanMojibake(text: string): string {
  return text
    .replace(/Ã¤/g, "ä")
    .replace(/Ã¶/g, "ö")
    .replace(/Ã¼/g, "ü")
    .replace(/Ã„/g, "Ä")
    .replace(/Ã–/g, "Ö")
    .replace(/Ãœ/g, "Ü")
    .replace(/ÃŸ/g, "ß");
}

function normalizeLanguage(raw: unknown): "de" | "en" | "fr" | "es" | "it" | "nl" | "ru" {
  const value = String(raw || "de").toLowerCase();
  if (value === "en" || value === "fr" || value === "es" || value === "it" || value === "nl" || value === "ru") {
    return value;
  }
  return "de";
}

function toLength(chapterCount: number): "short" | "medium" | "long" {
  if (chapterCount <= 3) return "short";
  if (chapterCount >= 7) return "long";
  return "medium";
}

function toAgeGroup(ageMin: number, ageMax: number): "3-5" | "6-8" | "9-12" | "13+" {
  if (ageMax <= 5) return "3-5";
  if (ageMax <= 8) return "6-8";
  if (ageMax <= 12) return "9-12";
  return "13+";
}

function isFairyTaleCategory(rawCategory: string): boolean {
  const category = cleanMojibake(rawCategory).toLowerCase();
  return category.includes("klassische") && (category.includes("märchen") || category.includes("maerchen"));
}

function uniq(values: string[]): string[] {
  const out: string[] = [];
  for (const value of values) {
    if (!value || out.includes(value)) continue;
    out.push(value);
  }
  return out;
}

async function readJsonFile(path: string): Promise<any | null> {
  try {
    const content = await fs.readFile(path, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function listAllLogFiles(): Promise<string[]> {
  const entries = await fs.readdir(LOGS_DIR, { withFileTypes: true });
  return entries.filter(e => e.isFile() && e.name.endsWith(".json")).map(e => path.join(LOGS_DIR, e.name));
}

async function findStoryLog(source: string, storyId: string): Promise<any | null> {
  const files = await listAllLogFiles();
  for (const file of files) {
    const obj = await readJsonFile(file);
    if (!obj) continue;
    if (String(obj?.source) !== source) continue;
    if (!logBelongsToStory(obj, storyId)) continue;
    return obj;
  }
  return null;
}

async function listLogFiles(): Promise<string[]> {
  const entries = await fs.readdir(LOGS_DIR, { withFileTypes: true });
  return entries
    .filter(e => e.isFile() && e.name.startsWith("log-phase6-") && e.name.endsWith(".json"))
    .map(e => path.join(LOGS_DIR, e.name));
}

function parsePhase6Usage(obj: any): UsageSample | null {
  const source = String(obj?.source || "");
  if (
    source !== "phase6-story-llm" &&
    source !== "phase6-story-critic-llm" &&
    source !== "phase6-story-release-surgery-llm"
  ) {
    return null;
  }
  const usage = asObj(obj?.response?.usage);
  return {
    source,
    total: toNum(usage.total_tokens),
    prompt: toNum(usage.prompt_tokens),
    completion: toNum(usage.completion_tokens),
  };
}

function logBelongsToStory(obj: any, storyId: string): boolean {
  const req = asObj(obj?.request);
  const meta = asObj(obj?.metadata);
  return req.storyId === storyId || meta.storyId === storyId;
}

async function collectPhase6Metrics(storyId: string): Promise<Phase6Metrics> {
  const files = await listLogFiles();
  const samples: UsageSample[] = [];
  let summary: Phase6Metrics["summary"] | undefined;

  for (const file of files) {
    const obj = await readJsonFile(file);
    if (!obj || !logBelongsToStory(obj, storyId)) continue;

    const usage = parsePhase6Usage(obj);
    if (usage) {
      samples.push(usage);
      continue;
    }

    if (String(obj?.source) === "phase6-story") {
      const res = asObj(obj?.response);
      summary = {
        qualityScore: Number.isFinite(Number(res.qualityScore)) ? Number(res.qualityScore) : undefined,
        criticScore: Number.isFinite(Number(res.criticScore)) ? Number(res.criticScore) : undefined,
        errorCount: Number.isFinite(Number(res.errorCount)) ? Number(res.errorCount) : undefined,
        warningCount: Number.isFinite(Number(res.warningCount)) ? Number(res.warningCount) : undefined,
        releaseCandidateCount: Number.isFinite(Number(res.releaseCandidateCount)) ? Number(res.releaseCandidateCount) : undefined,
      };
    }
  }

  return { storyId, samples, summary };
}

function aggregate(samples: UsageSample[]) {
  const bySource: Record<string, { calls: number; total: number; prompt: number; completion: number }> = {};
  for (const s of samples) {
    const cur = bySource[s.source] || { calls: 0, total: 0, prompt: 0, completion: 0 };
    cur.calls += 1;
    cur.total += s.total;
    cur.prompt += s.prompt;
    cur.completion += s.completion;
    bySource[s.source] = cur;
  }
  const all = Object.values(bySource).reduce(
    (acc, v) => {
      acc.calls += v.calls;
      acc.total += v.total;
      acc.prompt += v.prompt;
      acc.completion += v.completion;
      return acc;
    },
    { calls: 0, total: 0, prompt: 0, completion: 0 },
  );
  return { bySource, all };
}

function pctChange(before: number, after: number): string {
  if (!before) return "n/a";
  const pct = ((after - before) / before) * 100;
  return `${pct.toFixed(1)}%`;
}

async function resolveBaseSeed(storyId: string): Promise<number | undefined> {
  const entries = await fs.readdir(LOGS_DIR);
  for (const name of entries) {
    if (!name.startsWith("log-phase2-variant-") || !name.endsWith(".json")) continue;
    const obj = await readJsonFile(path.join(LOGS_DIR, name));
    if (!obj) continue;
    if (asObj(obj?.request).storyId === storyId) {
      const seed = Number(asObj(obj?.request).variantSeed);
      if (Number.isFinite(seed)) return seed;
    }
  }
  return undefined;
}

async function loadStoryConfig(storyId: string): Promise<{ userId: string; config: any }> {
  try {
    const row = await storyDB.queryRow<{ user_id: string; config: any }>`
      SELECT user_id, config
      FROM stories
      WHERE id = ${storyId}
      LIMIT 1
    `;
    if (row) {
      const rawConfig = typeof row.config === "string" ? JSON.parse(row.config) : row.config;
      return { userId: row.user_id, config: rawConfig };
    }
  } catch (error) {
    console.warn(
      `[ab-small] stories lookup failed, using log-derived fallback: ${(error as Error)?.message || String(error)}`,
    );
  }

  const phase0 = await findStoryLog("phase0-normalization", storyId);
  if (!phase0) {
    throw new Error(`Story ${storyId} not found in DB and no phase0-normalization log available`);
  }

  const req = asObj(phase0.request);
  const res = asObj(phase0.response);
  const category = cleanMojibake(String(req.category || ""));
  const chapterCount = Math.max(3, Math.min(7, toNum(req.chapterCount) || 5));
  const ageMin = Math.max(3, toNum(res.ageMin) || 6);
  const ageMax = Math.max(ageMin, toNum(res.ageMax) || 8);
  const avatarCount = Math.max(1, Math.min(2, toNum(res.avatarCount) || 2));
  const avatarIds = Array.from({ length: avatarCount }, (_, idx) => `ab-avatar-${idx + 1}`);
  const fairyTaleMode = isFairyTaleCategory(category);

  const config: any = {
    avatarIds,
    genre: fairyTaleMode ? "Klassische Märchen" : (category || "Abenteuer & Schätze"),
    setting: fairyTaleMode ? "Klassische Märchen" : (category || "Abenteuer & Schätze"),
    length: toLength(chapterCount),
    complexity: "medium",
    ageGroup: toAgeGroup(ageMin, ageMax),
    language: normalizeLanguage(req.language),
    useCharacterPool: true,
    releaseMode: true,
    preferences: fairyTaleMode ? { useFairyTaleTemplate: true } : undefined,
  };

  const phase05 = await findStoryLog("phase0.5-fairy-tale-selection", storyId);
  const selectedTaleId = cleanMojibake(String(asObj(phase05?.response).selectedTaleId || "")).trim();
  if (selectedTaleId) config.taleId = selectedTaleId;

  const phase2 = await findStoryLog("phase2-variant", storyId);
  const variantSeed = Number(asObj(phase2?.request).variantSeed);
  if (Number.isFinite(variantSeed)) config.variantSeed = variantSeed;

  console.warn(`[ab-small] Using log-derived fallback config for story ${storyId}`);
  return { userId: `ab-user-${storyId.slice(0, 8)}`, config };
}

function parseAvatarNamesFromPromptText(text: string): string[] {
  const cleaned = cleanMojibake(text);
  const names: string[] = [];
  const childRegex = /\*\*([^*]+)\*\*\s*\(Kind\)/g;
  let match: RegExpExecArray | null;
  while ((match = childRegex.exec(cleaned)) !== null) {
    const name = String(match[1] || "").trim();
    if (name) names.push(name);
  }
  if (names.length > 0) return uniq(names);

  const castLockMatch = cleaned.match(/Cast lock:\s*Only these (?:characters|names) allowed:\s*([^\n]+)/i);
  if (!castLockMatch?.[1]) return [];

  const rawNames = castLockMatch[1]
    .replace(/\.$/, "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  return uniq(
    rawNames.filter(
      name =>
        !/Kapitän Blubbert/i.test(name) &&
        !/Bäcker Bruno/i.test(name),
    ),
  );
}

async function inferAvatarNamesFromLogs(storyId: string, wantedCount: number): Promise<string[]> {
  const names: string[] = [];
  const phase6Log = await findStoryLog("phase6-story-llm", storyId);
  const messages = Array.isArray(phase6Log?.request?.messages) ? phase6Log.request.messages : [];
  for (const msg of messages) {
    const content = typeof msg?.content === "string" ? msg.content : "";
    if (!content) continue;
    const parsed = parseAvatarNamesFromPromptText(content);
    for (const name of parsed) names.push(name);
    if (names.length >= wantedCount) break;
  }

  const unique = uniq(names);
  if (unique.length >= wantedCount) return unique.slice(0, wantedCount);

  const defaults = ["Adrian", "Alexander", "Mia", "Luca"];
  return uniq([...unique, ...defaults]).slice(0, wantedCount);
}

function buildFallbackAvatar(avatarId: string, name: string, index: number): AvatarDetail {
  const isFirst = index === 0;
  return {
    id: avatarId,
    name,
    description: isFirst ? "Impulsives Kind mit viel Neugier." : "Ruhiges Kind mit klarem Blick.",
    physicalTraits: {
      characterType: "kind",
      appearance: isFirst ? "lebhaftes Kind mit schnellen Bewegungen" : "aufmerksames Kind mit ruhiger Haltung",
    },
    personalityTraits: {
      knowledge: isFirst ? 0.52 : 0.65,
      creativity: isFirst ? 0.7 : 0.6,
      vocabulary: isFirst ? 0.56 : 0.64,
      courage: isFirst ? 0.74 : 0.58,
      curiosity: isFirst ? 0.78 : 0.62,
      teamwork: 0.72,
      empathy: 0.66,
      persistence: 0.68,
      logic: isFirst ? 0.5 : 0.78,
    },
    creationType: "ai-generated",
    isPublic: false,
    imageUrl: undefined,
    visualProfile: {
      characterType: "human_child",
      speciesCategory: "human",
      ageApprox: "6-8",
      ageNumeric: 7,
      gender: "child",
      skin: { tone: "light" },
      hair: {
        color: isFirst ? "brown" : "dark blond",
        type: "straight",
        length: "short",
        style: "simple",
      },
      eyes: { color: "brown" },
      face: {},
      accessories: [],
      consistentDescriptors: ["human child", "storybook face", "friendly expression"],
    },
    inventory: [],
    skills: [],
  } as AvatarDetail;
}

async function loadAvatars(avatarIds: string[], storyId: string): Promise<AvatarDetail[]> {
  try {
    const out: AvatarDetail[] = [];
    for (const avatarId of avatarIds) {
      const row = await avatarDB.queryRow<{
        id: string;
        name: string;
        description: string | null;
        physical_traits: string;
        personality_traits: string;
        image_url: string | null;
        visual_profile: string | null;
        creation_type: "ai-generated" | "photo-upload";
        is_public: boolean;
        inventory: string | null;
        skills: string | null;
      }>`
        SELECT id, name, description, physical_traits, personality_traits, image_url, visual_profile, creation_type, is_public, inventory, skills
        FROM avatars
        WHERE id = ${avatarId}
        LIMIT 1
      `;
      if (!row) {
        throw new Error(`Avatar ${avatarId} not found`);
      }
      out.push({
        id: row.id,
        name: row.name,
        description: row.description || undefined,
        physicalTraits: row.physical_traits ? JSON.parse(row.physical_traits) : {},
        personalityTraits: row.personality_traits ? JSON.parse(row.personality_traits) : {},
        imageUrl: row.image_url || undefined,
        visualProfile: row.visual_profile ? JSON.parse(row.visual_profile) : undefined,
        creationType: row.creation_type,
        isPublic: row.is_public,
        inventory: row.inventory ? JSON.parse(row.inventory) : [],
        skills: row.skills ? JSON.parse(row.skills) : [],
      } as AvatarDetail);
    }
    return out;
  } catch (error) {
    console.warn(
      `[ab-small] avatar lookup failed, using synthetic avatars: ${(error as Error)?.message || String(error)}`,
    );
    const names = await inferAvatarNamesFromLogs(storyId, avatarIds.length);
    return avatarIds.map((avatarId, idx) => buildFallbackAvatar(avatarId, names[idx] || `Kind ${idx + 1}`, idx));
  }
}

async function writeReport(input: {
  baseline: Phase6Metrics;
  candidate: Phase6Metrics;
  baselineSeed?: number;
  runStoryId: string;
  runTokenUsage?: any;
}) {
  const a = aggregate(input.baseline.samples);
  const b = aggregate(input.candidate.samples);
  const now = new Date().toISOString();

  const lines = [
    `# Small A/B Run (${now})`,
    "",
    "## Setup",
    `- A (baseline): historical logs for story \`${input.baseline.storyId}\``,
    `- B (current): fresh pipeline run \`${input.runStoryId}\``,
    `- Seed used for B: \`${input.baselineSeed ?? "n/a"}\``,
    `- Scope: phase6 text generation + critic + release surgery token logs`,
    "",
    "## Token Comparison (A vs B)",
    `- Total tokens: A=\`${a.all.total}\`, B=\`${b.all.total}\`, delta=\`${b.all.total - a.all.total}\` (\`${pctChange(a.all.total, b.all.total)}\`)`,
    `- Prompt tokens: A=\`${a.all.prompt}\`, B=\`${b.all.prompt}\`, delta=\`${b.all.prompt - a.all.prompt}\` (\`${pctChange(a.all.prompt, b.all.prompt)}\`)`,
    `- Completion tokens: A=\`${a.all.completion}\`, B=\`${b.all.completion}\`, delta=\`${b.all.completion - a.all.completion}\` (\`${pctChange(a.all.completion, b.all.completion)}\`)`,
    "",
    "## By Source",
    "| source | A calls | A total | B calls | B total | delta |",
    "|---|---:|---:|---:|---:|---:|",
  ];

  const sources: Phase6TokenSource[] = [
    "phase6-story-llm",
    "phase6-story-critic-llm",
    "phase6-story-release-surgery-llm",
  ];
  for (const src of sources) {
    const av = a.bySource[src] || { calls: 0, total: 0, prompt: 0, completion: 0 };
    const bv = b.bySource[src] || { calls: 0, total: 0, prompt: 0, completion: 0 };
    lines.push(`| ${src} | ${av.calls} | ${av.total} | ${bv.calls} | ${bv.total} | ${bv.total - av.total} |`);
  }

  lines.push(
    "",
    "## Quality Snapshot",
    `- A critic score: \`${input.baseline.summary?.criticScore ?? "n/a"}\``,
    `- B critic score: \`${input.candidate.summary?.criticScore ?? "n/a"}\``,
    `- A quality score: \`${input.baseline.summary?.qualityScore ?? "n/a"}\``,
    `- B quality score: \`${input.candidate.summary?.qualityScore ?? "n/a"}\``,
    `- A errors/warnings: \`${input.baseline.summary?.errorCount ?? "n/a"}/${input.baseline.summary?.warningCount ?? "n/a"}\``,
    `- B errors/warnings: \`${input.candidate.summary?.errorCount ?? "n/a"}/${input.candidate.summary?.warningCount ?? "n/a"}\``,
    "",
    "## Raw B Token Usage (orchestrator result)",
    "```json",
    JSON.stringify(input.runTokenUsage ?? null, null, 2),
    "```",
  );

  await fs.mkdir(ANALYSIS_DIR, { recursive: true });
  const outPath = path.join(ANALYSIS_DIR, `ab-small-run-${new Date().toISOString().slice(0, 10)}.md`);
  await fs.writeFile(outPath, lines.join("\n"), "utf8");
  console.log(`[ab-small] Report written: ${outPath}`);
}

async function main() {
  const baseStoryId = process.argv[2] || "27b77afa-cae1-4489-ad98-a8ed92e868e8";
  console.log(`[ab-small] Baseline story: ${baseStoryId}`);

  const baseline = await collectPhase6Metrics(baseStoryId);
  if (baseline.samples.length === 0) {
    throw new Error(`No baseline phase6 token logs found for story ${baseStoryId}`);
  }

  const { userId, config } = await loadStoryConfig(baseStoryId);
  const avatarIds = Array.isArray(config?.avatarIds) ? config.avatarIds : [];
  if (avatarIds.length === 0) {
    throw new Error(`No avatarIds in baseline story config for ${baseStoryId}`);
  }
  const avatars = await loadAvatars(avatarIds, baseStoryId);

  const baselineSeed = await resolveBaseSeed(baseStoryId);
  const runStoryId = `ab-small-${crypto.randomUUID()}`;
  const runConfig = {
    ...config,
    useCharacterPool: true,
    releaseMode: true,
    aiModel: config?.aiModel || "gpt-4.1-mini",
    variantSeed: baselineSeed ?? config.variantSeed,
  };

  console.log(`[ab-small] Running B candidate story: ${runStoryId}`);
  const orchestrator = new StoryPipelineOrchestrator({
    imageGenerator: new MockImageGenerator() as any,
  });

  const result = await orchestrator.run({
    storyId: runStoryId,
    userId,
    config: runConfig,
    avatars,
    enableVisionValidation: false,
  });

  await new Promise(resolve => setTimeout(resolve, 1500));
  const candidate = await collectPhase6Metrics(runStoryId);
  if (candidate.samples.length === 0) {
    const usage = asObj(result.tokenUsage);
    const total = toNum(usage.totalTokens ?? usage.total_tokens);
    if (total > 0) {
      candidate.samples.push({
        source: "phase6-story-llm",
        total,
        prompt: toNum(usage.promptTokens ?? usage.prompt_tokens),
        completion: toNum(usage.completionTokens ?? usage.completion_tokens),
      });
      console.warn("[ab-small] Candidate phase6 file logs missing, using orchestrator aggregate tokenUsage fallback.");
    }
  }

  if (!candidate.summary) {
    candidate.summary = asObj(result.validationReport?.story) as any;
  }

  await writeReport({
    baseline,
    candidate,
    baselineSeed,
    runStoryId,
    runTokenUsage: result.tokenUsage,
  });

  const a = aggregate(baseline.samples).all;
  const b = aggregate(candidate.samples).all;
  console.log(`[ab-small] Done. A total=${a.total} vs B total=${b.total} (${pctChange(a.total, b.total)})`);
}

main().catch((error) => {
  console.error("[ab-small] Failed:", error);
  process.exitCode = 1;
});
