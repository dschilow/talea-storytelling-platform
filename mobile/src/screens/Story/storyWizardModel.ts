import type { AIModel, AIProvider, OpenRouterStoryModel } from '@/types/story';
import { DEFAULT_OPENROUTER_STORY_MODEL } from '@/types/story';

/**
 * Story wizard state and the mapping to the backend's StoryConfig.
 *
 * `mapWizardStateToAPI` is a direct port of the web wizard
 * (frontend/screens/Story/TaleaStoryWizard.tsx) — the derived fields (tone,
 * suspenseLevel, humorLevel, pacing) are how the backend interprets the child's
 * "how should it feel?" choices, so they must match exactly or the same
 * selection would produce a differently-toned story on each platform.
 */

export type MainCategory = 'fairy-tales' | 'adventure' | 'magic' | 'animals' | 'scifi' | 'modern';
export type AgeGroup = '3-5' | '6-8' | '9-12' | '13+';
export type StoryLength = 'short' | 'medium' | 'long';
export type Feeling = 'funny' | 'warm' | 'exciting' | 'crazy' | 'meaningful';

export interface BroughtArtifactSelection {
  artifactId: string;
  avatarId: string;
  name?: string;
}

export interface WizardState {
  selectedAvatars: string[];
  mainCategory: MainCategory | null;
  subCategory: string | null;
  ageGroup: AgeGroup | null;
  length: StoryLength | null;
  feelings: Feeling[];
  rhymes: boolean;
  moral: boolean;
  avatarIsHero: boolean;
  famousCharacters: boolean;
  happyEnd: boolean;
  surpriseEnd: boolean;
  customWish: string;
  aiModel: AIModel;
  aiProvider: AIProvider;
  openRouterModel: OpenRouterStoryModel;
  developerMode: boolean;
  broughtArtifact: BroughtArtifactSelection | null;
}

export const initialWizardState: WizardState = {
  selectedAvatars: [],
  mainCategory: null,
  subCategory: null,
  ageGroup: null,
  length: null,
  feelings: [],
  rhymes: false,
  moral: false,
  avatarIsHero: true,
  famousCharacters: false,
  happyEnd: true,
  surpriseEnd: false,
  customWish: '',
  aiModel: 'gemini-3-flash-preview',
  aiProvider: 'native',
  openRouterModel: DEFAULT_OPENROUTER_STORY_MODEL,
  developerMode: false,
  broughtArtifact: null,
};

const GENRE_MAP: Record<MainCategory, string> = {
  'fairy-tales': 'fairy_tales',
  adventure: 'adventure',
  magic: 'magic',
  animals: 'animals',
  scifi: 'scifi',
  modern: 'modern',
};

export function mapWizardStateToAPI(state: WizardState, userLanguage: string) {
  let tone: 'warm' | 'witty' | 'epic' | 'soothing' | 'mischievous' | 'wonder' = 'warm';
  if (state.feelings.includes('funny')) tone = 'witty';
  else if (state.feelings.includes('exciting')) tone = 'epic';
  else if (state.feelings.includes('warm')) tone = 'warm';
  else if (state.feelings.includes('crazy')) tone = 'mischievous';
  else if (state.feelings.includes('meaningful')) tone = 'soothing';
  else if (state.mainCategory === 'magic') tone = 'wonder';

  const genre = state.mainCategory ? (GENRE_MAP[state.mainCategory] ?? 'adventure') : 'adventure';

  return {
    avatarIds: state.selectedAvatars,
    ageGroup: (state.ageGroup ?? '6-8') as AgeGroup,
    genre,
    length: (state.length ?? 'medium') as StoryLength,
    complexity: 'medium' as const,
    setting: state.mainCategory === 'fairy-tales' ? 'fantasy' : 'varied',
    suspenseLevel: state.feelings.includes('exciting') ? 2 : 1,
    humorLevel: state.feelings.includes('funny') ? 2 : 1,
    tone,
    pacing: (state.feelings.includes('exciting') ? 'fast' : 'balanced') as 'fast' | 'balanced' | 'slow',
    allowRhymes: state.rhymes,
    hasTwist: state.surpriseEnd,
    customPrompt: state.customWish || undefined,
    language: userLanguage as 'de' | 'en' | 'fr' | 'es' | 'it' | 'nl' | 'ru',
    aiModel: state.aiModel,
    aiProvider: state.aiProvider,
    openRouterModel: state.aiProvider === 'openrouter' ? state.openRouterModel : undefined,
    preferences: {
      useFairyTaleTemplate: state.mainCategory === 'fairy-tales' || state.mainCategory === 'magic',
    },
    developerMode: state.developerMode || undefined,
    broughtArtifact:
      state.broughtArtifact && state.selectedAvatars.includes(state.broughtArtifact.avatarId)
        ? { artifactId: state.broughtArtifact.artifactId, avatarId: state.broughtArtifact.avatarId }
        : undefined,
  };
}

/** Per-step gating, ported from the web wizard's `canProceed`. */
export function canProceed(step: number, state: WizardState): boolean {
  switch (step) {
    case 0:
      return state.selectedAvatars.length > 0;
    case 1:
      return state.mainCategory !== null;
    case 2:
      return state.ageGroup !== null && state.length !== null;
    case 3:
      return state.feelings.length > 0;
    case 4:
    case 5:
      return true;
    default:
      return false;
  }
}

export const WIZARD_STEP_LABELS = ['Avatare', 'Thema', 'Umfang', 'Stimmung', 'Wünsche', 'Start'] as const;

// ── Generation-side helpers (ported from storyGenerateWithModelFallback.ts) ──

const GEMINI_PRO_PREVIEW_MODELS = new Set(['gemini-3-pro-preview', 'gemini-3.1-pro-preview']);
const GEMINI_FLASH_PREVIEW_MODEL = 'gemini-3-flash-preview';

const GENERATION_RECOVERY_ATTEMPTS = 90;
const GENERATION_RECOVERY_DELAY_MS = 2000;

function isGemini31SchemaRejection(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const lowered = message.toLowerCase();
  return (
    lowered.includes('config.aimodel') &&
    (lowered.includes('gemini-3.1-pro-preview') || lowered.includes('gemini-3-pro-preview')) &&
    (lowered.includes('invalid type') || lowered.includes('expected'))
  );
}

/** Retries once on Flash when the backend rejects a Pro preview model's schema. */
export async function generateStoryWithModelFallback<TResponse, TRequest extends { config: Record<string, any> }>(
  callGenerate: (request: TRequest) => Promise<TResponse>,
  request: TRequest
): Promise<TResponse> {
  try {
    return await callGenerate(request);
  } catch (error) {
    const requestedModel = request.config?.aiModel;
    if (!GEMINI_PRO_PREVIEW_MODELS.has(String(requestedModel)) || !isGemini31SchemaRejection(error)) {
      throw error;
    }

    console.warn(`[StoryWizard] Backend rejects ${requestedModel}; retrying with ${GEMINI_FLASH_PREVIEW_MODEL}`);
    return callGenerate({ ...request, config: { ...request.config, aiModel: GEMINI_FLASH_PREVIEW_MODEL } } as TRequest);
  }
}

export function createStoryGenerationId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

/**
 * Whether a failed generation is worth polling for.
 *
 * Mobile networks make this more important than on the web: a request that dies
 * on a tunnel handoff usually still completed server-side, and giving up would
 * lose a story the user already paid a credit for.
 */
export function shouldAttemptStoryGenerationRecovery(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const lowered = message.toLowerCase();

  if (
    lowered.includes('unauthenticated') ||
    lowered.includes('invalid token') ||
    lowered.includes('abo-limit erreicht') ||
    lowered.includes('length limit exceeded')
  ) {
    return false;
  }

  return (
    lowered.includes('timeout') ||
    lowered.includes('timed out') ||
    lowered.includes('failed to fetch') ||
    lowered.includes('network') ||
    lowered.includes('aborted') ||
    lowered.includes('cancelled') ||
    lowered.includes('deadline') ||
    lowered.includes('internal') ||
    lowered.includes('story generation failed') ||
    lowered.includes('already') ||
    lowered.includes('in progress') ||
    lowered.includes('bereits eine generierung') ||
    lowered.includes('alreadyexists') ||
    /\b409\b/.test(lowered) ||
    /\b50[234]\b/.test(lowered)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isGeneratedStoryReady(story: any): boolean {
  if (!story || typeof story !== 'object') return false;
  const chapters = Array.isArray(story.chapters) ? story.chapters : [];
  return story.status === 'complete' && chapters.length > 0;
}

export async function recoverGeneratedStoryAfterFailure(
  storyClient: { get: (request: { id: string; profileId?: string }) => Promise<any> },
  storyId: string,
  profileId?: string,
  onAttempt?: (attempt: number, total: number) => void
): Promise<any | null> {
  for (let attempt = 0; attempt < GENERATION_RECOVERY_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await sleep(GENERATION_RECOVERY_DELAY_MS);
    onAttempt?.(attempt + 1, GENERATION_RECOVERY_ATTEMPTS);

    try {
      const story = await storyClient.get({ id: storyId, profileId });
      if (isGeneratedStoryReady(story)) return story;
      // Terminal failure — nothing left to wait for.
      if (story && typeof story === 'object' && story.status === 'error') return null;
    } catch {
      // The row may not exist yet, or the original failure may be genuine.
    }
  }

  return null;
}
