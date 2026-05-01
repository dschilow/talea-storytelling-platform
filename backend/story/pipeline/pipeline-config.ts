import { storyDB } from "../db";

export interface PipelineConfig {
  wpm: number;
  runwareSteps: number;
  runwareCfgScale: number;
  storyRetryMax: number;
  imageRetryMax: number;
  maxPropsVisible: number;
  releaseCandidateCount: number;
  criticModel: string;
  criticMinScore: number;
  maxSelectiveSurgeryEdits: number;
  defaultPromptVersion: "v7" | "v8";
  blueprintRetryMax: number;
  pass3TargetScore: number;
  pass3WarnFloor: number;
  /** Stage 0 (Story Soul) on/off. Quality-first default is enabled. */
  soulStageEnabled: boolean;
  /** How often the Soul generator may retry after schema/rubric failures. */
  soulRetryMax: number;
  /** Continue after a failed Soul gate (true) or abort before writing (false). */
  soulAllowOnReject: boolean;
  /** Critic release threshold after an approved Soul. */
  soulAwareCriticMinScore: number;
  /** Use a single candidate after approved Soul. Disabled for quality-first mode. */
  soulApprovedSingleCandidate: boolean;
  /** Maximum output token budget for Soul generator JSON. */
  soulGeneratorMaxOutputTokens: number;
  /** Model for Soul gate. */
  soulGateModel: string;
  /** Generate AI art-director scene descriptions. Off by default to keep story tokens low. */
  aiScenePromptEnabled: boolean;
  /** Whether strict quality release gates warn or block the user-facing generation path. */
  strictReleaseGateMode: "warn" | "block";
}

const DEFAULT_CONFIG: PipelineConfig = {
  wpm: 140,
  runwareSteps: 4,
  runwareCfgScale: 4,
  storyRetryMax: 2,
  imageRetryMax: 1,
  maxPropsVisible: 7,
  releaseCandidateCount: 1,
  criticModel: "gpt-5.4-nano",
  criticMinScore: 8.6,
  maxSelectiveSurgeryEdits: 1,
  defaultPromptVersion: "v8",
  blueprintRetryMax: 0,
  pass3TargetScore: 8.6,
  pass3WarnFloor: 7.2,
  soulStageEnabled: true,
  soulRetryMax: 0,
  soulAllowOnReject: true,
  soulAwareCriticMinScore: 8.6,
  soulApprovedSingleCandidate: true,
  soulGeneratorMaxOutputTokens: 2200,
  soulGateModel: "gemini-3.1-flash-lite-preview",
  aiScenePromptEnabled: false,
  strictReleaseGateMode: "warn",
};

let cached: PipelineConfig | null = null;
let cachedAt = 0;

export async function loadPipelineConfig(): Promise<PipelineConfig> {
  const now = Date.now();
  if (cached && now - cachedAt < 60_000) {
    return cached;
  }

  try {
    const row = await storyDB.queryRow<{ value: any }>`
      SELECT value FROM pipeline_config WHERE key = 'default' LIMIT 1
    `;
    if (row?.value) {
      const parsed = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
      cached = { ...DEFAULT_CONFIG, ...(parsed || {}) };
      cachedAt = now;
      return cached!;
    }
  } catch (error) {
    console.warn("[pipeline] Failed to load pipeline_config, using defaults", error);
  }

  cached = DEFAULT_CONFIG;
  cachedAt = now;
  return DEFAULT_CONFIG;
}
