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
  /** Stage 0 (Story Soul) ein/aus. Default false, bis Rollout stabil ist. */
  soulStageEnabled: boolean;
  /** Wie oft der Soul-Generator bei Schema-/Rubrik-Fehlern nachlegen darf. */
  soulRetryMax: number;
  /** Bei `reject_with_fixes`: trotzdem weitermachen (true) oder harter Abbruch (false). */
  soulAllowOnReject: boolean;
}

const DEFAULT_CONFIG: PipelineConfig = {
  wpm: 140,
  runwareSteps: 4,
  runwareCfgScale: 4,
  storyRetryMax: 2,
  imageRetryMax: 2,
  maxPropsVisible: 7,
  releaseCandidateCount: 2,
  criticModel: "gemini-3.1-flash-lite-preview",
  criticMinScore: 8.2,
  maxSelectiveSurgeryEdits: 3,
  defaultPromptVersion: "v8",
  blueprintRetryMax: 2,
  pass3TargetScore: 8.2,
  pass3WarnFloor: 6.5,
  soulStageEnabled: false,
  soulRetryMax: 2,
  soulAllowOnReject: true,
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
