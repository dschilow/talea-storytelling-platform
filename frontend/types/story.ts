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
  | '~moonshotai/kimi-latest'
  | 'moonshotai/kimi-k2.5'
  | 'minimax/minimax-m2.7'
  | 'x-ai/grok-4.3'
  | 'openrouter/owl-alpha'
  | '~google/gemini-pro-latest'
  | '~google/gemini-flash-latest'
  | '~anthropic/claude-sonnet-latest'
  | '~openai/gpt-mini-latest'
  | 'deepseek/deepseek-v4-pro'
  | 'qwen/qwen3.6-max-preview';

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
}

export interface Avatar {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface Character {
  id: string;
  name: string;
  imageUrl?: string;
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
    totalCost?: {
      text: number;
      images: number;
      total: number;
    };
  };
  createdAt: string;
  updatedAt: string;
}
