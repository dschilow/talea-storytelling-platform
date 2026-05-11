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
  /** Use one candidate after approved Soul; adaptive fallback can still buy a second weak-draft candidate. */
  soulApprovedSingleCandidate: boolean;
  /** Maximum output token budget for Soul generator JSON. */
  soulGeneratorMaxOutputTokens: number;
  /** Model for Soul gate. */
  soulGateModel: string;
  /** Run a cheap structured Soul gate before spending on full prose. */
  soulGateEnabled: boolean;
  /** Allow cross-provider Soul rescue after invalid JSON/schema. Off by default to avoid double Soul cost. */
  soulRescueEnabled: boolean;
  /** Blueprint strategy. "deterministic" uses the local V8 skeleton builder with zero LLM tokens. */
  blueprintMode: "llm" | "deterministic";
  /** Default max full-story rewrite passes unless the request overrides it. */
  maxRewritePasses: 0 | 1 | 2;
  /** Default chapter expansion calls unless the request overrides it. */
  maxExpandCalls: number;
  /** Default warning polish calls unless the request overrides it. */
  maxWarningPolishCalls: number;
  /** Story-writer token ceiling for the selected candidate path. */
  maxStoryTokens: number;
  /** Spawn one second candidate only when the first draft is weak but salvageable. */
  enableAdaptiveSecondCandidate: boolean;
  /** Cap the nano sentence-tightening pass by chapter count. */
  maxSentenceTighteningChapters: number;
  /** Re-run semantic critic after selective surgery. Expensive; default false. */
  enablePostSurgeryCritic: boolean;
  /** Re-run semantic critic after deterministic local repairs. Expensive; default false. */
  enablePostLocalRepairCritic: boolean;
  /** Generate AI art-director scene descriptions. Off by default to keep story tokens low. */
  aiScenePromptEnabled: boolean;
  /** Whether strict quality release gates warn or block the user-facing generation path. */
  strictReleaseGateMode: "warn" | "block";
  /**
   * When true, the polish step sends the whole story (all chapters together)
   * to a single LLM call with all critic patch tasks. The model sees the full
   * narrative context and can keep voice and continuity coherent. When false
   * (legacy default), the per-chapter `applySelectiveSurgery` runs instead,
   * editing each chapter in isolation.
   */
  wholeStoryEditMode: boolean;
  /**
   * When true, skip the Story Soul stage entirely and let the writer work
   * directly from cast/blueprint inputs. Use to test whether Soul is helping
   * or hurting quality on a given catalog of inputs.
   */
  soulStageDisabled: boolean;
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
  maxSelectiveSurgeryEdits: 3,
  defaultPromptVersion: "v8",
  blueprintRetryMax: 0,
  pass3TargetScore: 8.6,
  pass3WarnFloor: 7.2,
  soulStageEnabled: false,
  soulRetryMax: 1,
  soulAllowOnReject: true,
  soulAwareCriticMinScore: 8.6,
  soulApprovedSingleCandidate: true,
  soulGeneratorMaxOutputTokens: 3000,
  soulGateModel: "gemini-3.1-flash-lite-preview",
  soulGateEnabled: true,
  soulRescueEnabled: false,
  blueprintMode: "deterministic",
  maxRewritePasses: 1,
  maxExpandCalls: 1,
  maxWarningPolishCalls: 1,
  maxStoryTokens: 22000,
  enableAdaptiveSecondCandidate: true,
  maxSentenceTighteningChapters: 1,
  enablePostSurgeryCritic: true,
  enablePostLocalRepairCritic: true,
  aiScenePromptEnabled: false,
  strictReleaseGateMode: "warn",
  wholeStoryEditMode: false,
  soulStageDisabled: true,
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
