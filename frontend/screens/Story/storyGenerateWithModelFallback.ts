const GEMINI_PRO_PREVIEW_MODELS = new Set([
  "gemini-3-pro-preview",
  "gemini-3.1-pro-preview",
]);
const GEMINI_FLASH_PREVIEW_MODEL = "gemini-3-flash-preview";
// A duplicate/in-flight generation (e.g. an edge-proxy retry that the backend
// rejects with a clean "already in progress" conflict) keeps generating in the
// background and can take a few minutes. Poll long enough to pick up that
// completed story instead of giving up after a few seconds. The poll
// short-circuits as soon as the story reaches a terminal "error" status, so
// genuine failures still surface quickly.
const GENERATION_RECOVERY_ATTEMPTS = 90;
const GENERATION_RECOVERY_DELAY_MS = 2000;

type StoryLookupClient = {
  get: (request: { id: string; profileId?: string }) => Promise<any>;
};

function isGemini31SchemaRejection(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : String(error ?? "");
  const lowered = message.toLowerCase();

  return (
    lowered.includes("config.aimodel") &&
    (
      lowered.includes("gemini-3.1-pro-preview") ||
      lowered.includes("gemini-3-pro-preview")
    ) &&
    (lowered.includes("invalid type") || lowered.includes("expected"))
  );
}

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

    const fallbackRequest = {
      ...request,
      config: {
        ...request.config,
        aiModel: GEMINI_FLASH_PREVIEW_MODEL,
      },
    } as TRequest;

    console.warn(
      `[StoryWizard] Backend rejects ${requestedModel}; retrying with ${GEMINI_FLASH_PREVIEW_MODEL}`
    );

    return callGenerate(fallbackRequest);
  }
}

export function createStoryGenerationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isGeneratedStoryReady(story: any): boolean {
  if (!story || typeof story !== "object") {
    return false;
  }

  const chapters = Array.isArray(story.chapters) ? story.chapters : [];
  return story.status === "complete" && chapters.length > 0;
}

export function shouldAttemptStoryGenerationRecovery(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lowered = message.toLowerCase();

  if (
    lowered.includes("unauthenticated") ||
    lowered.includes("invalid token") ||
    lowered.includes("abo-limit erreicht") ||
    lowered.includes("length limit exceeded")
  ) {
    return false;
  }

  return (
    lowered.includes("timeout") ||
    lowered.includes("timed out") ||
    lowered.includes("failed to fetch") ||
    lowered.includes("network") ||
    lowered.includes("aborted") ||
    lowered.includes("cancelled") ||
    lowered.includes("deadline") ||
    lowered.includes("internal") ||
    lowered.includes("story generation failed") ||
    // A duplicate/in-flight generation surfaces as an "already in progress"
    // conflict; the original request keeps generating, so poll for its result.
    lowered.includes("already") ||
    lowered.includes("in progress") ||
    lowered.includes("bereits eine generierung") ||
    lowered.includes("alreadyexists") ||
    /\b409\b/.test(lowered) ||
    /\b50[234]\b/.test(lowered)
  );
}

export async function recoverGeneratedStoryAfterFailure(
  storyClient: StoryLookupClient,
  storyId: string,
  profileId?: string
): Promise<any | null> {
  for (let attempt = 0; attempt < GENERATION_RECOVERY_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await sleep(GENERATION_RECOVERY_DELAY_MS);
    }

    try {
      const story = await storyClient.get({ id: storyId, profileId });
      if (isGeneratedStoryReady(story)) {
        return story;
      }
      // Stop early if the in-flight generation reached a terminal failure
      // state — there is nothing left to wait for.
      if (story && typeof story === "object" && story.status === "error") {
        return null;
      }
    } catch {
      // The row may not exist yet, or the original failure may be genuine.
    }
  }

  return null;
}
