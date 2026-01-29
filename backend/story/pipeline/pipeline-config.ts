import { storyDB } from "../db";

export interface PipelineConfig {
  wpm: number;
  runwareSteps: number;
  runwareCfgScale: number;
  storyRetryMax: number;
  imageRetryMax: number;
  maxPropsVisible: number;
}

const DEFAULT_CONFIG: PipelineConfig = {
  wpm: 140,
  runwareSteps: 28,
  runwareCfgScale: 6.5,
  storyRetryMax: 2,
  imageRetryMax: 2,
  maxPropsVisible: 7,
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
      return cached;
    }
  } catch (error) {
    console.warn("[pipeline] Failed to load pipeline_config, using defaults", error);
  }

  cached = DEFAULT_CONFIG;
  cachedAt = now;
  return DEFAULT_CONFIG;
}
