// Single source of truth for AI model identifiers — keep in sync with backend/story/generate.ts AIModel type
export type AIModel =
  | 'claude-sonnet-4-6'
  | 'gpt-5.4'
  | 'gpt-5.4-mini'
  | 'gemini-3-flash-preview'
  | 'gemini-3-pro-preview'
  | 'gemini-3.1-pro-preview'
  | 'minimax-m2.7';

export type AIProvider = 'native' | 'openrouter';

export type OpenRouterStoryModel =
  | 'moonshotai/kimi-k2.6'
  | 'aion-labs/aion-3.0-mini'
  | '~moonshotai/kimi-latest'
  | 'aion-labs/aion-3.0'
  | 'moonshotai/kimi-k2.5'
  | 'minimax/minimax-m2.7'
  | 'minimax/minimax-m3'
  | 'z-ai/glm-5.2'
  | 'qwen/qwen3.7-max'
  | 'qwen/qwen3.7-plus'
  | 'deepseek/deepseek-v4-pro'
  | 'deepseek/deepseek-v4-flash'
  | 'x-ai/grok-4.5'
  | 'google/gemini-3.6-flash'
  | 'x-ai/grok-4.3'
  | 'openrouter/owl-alpha'
  | 'google/gemini-3.5-flash'
  | '~google/gemini-pro-latest'
  | '~google/gemini-flash-latest'
  | '~anthropic/claude-sonnet-latest'
  | '~openai/gpt-mini-latest'
  | 'qwen/qwen3.6-max-preview'
  | 'openai/gpt-5.6-luna'
  | 'openai/gpt-5.6-terra';

export const DEFAULT_OPENROUTER_STORY_MODEL: OpenRouterStoryModel = 'moonshotai/kimi-k2.6';

export interface StoryConfig {
  genre: string;
  style: string;
  ageGroup: string;
  moral?: string;
  avatars?: Avatar[];
  characters?: Character[];
  aiProvider?: AIProvider;
  openRouterModel?: string;
  contentType?: 'standard' | 'character_life';
  characterId?: string;
}

export interface Avatar {
  id: string;
  name: string;
  imageUrl?: string;
  description?: string;
  physicalTraits?: {
    characterType?: string;
    appearance?: string;
  };
  visualProfile?: Record<string, unknown>;
}

export interface Character {
  id: string;
  name: string;
  imageUrl?: string;
  role?: string;
  archetype?: string;
  visualProfile?: {
    description?: string;
    species?: string;
    colorPalette?: string[];
  };
  emotionalNature?: {
    dominant?: string;
    secondary?: string[];
  };
  physicalDescription?: string;
  backstory?: string;
  dominantPersonality?: string;
  secondaryTraits?: string[];
  personalityKeywords?: string[];
  catchphrase?: string;
  quirk?: string;
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  ttsText?: string;
  imageUrl?: string;
  scenicImageUrl?: string;
  scenicImagePrompt?: string;
  order: number;
}

export interface AdminGenerationMetricRow {
  key: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalCostUSD: number;
}

export interface AdminGenerationMetricsData {
  version: 1;
  currency: 'USD';
  calculatedAt: string;
  tokens: { input: number; cachedInput: number; output: number; total: number };
  costs: {
    cachedInputUSD: number;
    inputUSD: number;
    outputUSD: number;
    storyUSD: number;
    imagesUSD: number;
    totalUSD: number;
    imageCredits: number;
  };
  calls: { llm: number; images: number };
  durationMs: number;
  imageCostEstimated: boolean;
  stages: AdminGenerationMetricRow[];
  models: AdminGenerationMetricRow[];
}
export interface Story {
  id: string;
  userId: string;
  title: string;
  summary: string;
  description?: string;
  config: StoryConfig;
  chapters?: Chapter[];
  pages?: Chapter[];
  coverImageUrl?: string;
  estimatedReadingTime?: number;
  status: 'generating' | 'complete' | 'error';
  isPublic: boolean;
  avatarDevelopments?: any[];
  avatarParticipants?: Avatar[];
  metadata?: {
    tokensUsed?: {
      prompt: number;
      completion: number;
      total: number;
    };
    model?: string;
    processingTime?: number;
    imagesGenerated?: number;
    developerMode?: boolean;
    releaseReady?: boolean;
    status?: "ok" | "quality_gate_failed";
    imagesSkippedDueToQualityGate?: boolean;
    qualityGatePassed?: boolean;
    qualityGateFailureReason?: string;
    returnedWithQualityGateWarnings?: boolean;
    hardIssueList?: string[];
    devModeStages?: Array<{
      stage: string;
      usage?: { prompt: number; completion: number; total: number };
      modelUsed?: string;
      modelRole?: 'support' | 'selected-story';
      durationMs?: number;
      score?: number;
    }>;
    adminGenerationMetrics?: AdminGenerationMetricsData;
    totalCost?: {
      text: number;
      images: number;
      total: number;
    };
  };
  createdAt: string;
  updatedAt: string;
}
