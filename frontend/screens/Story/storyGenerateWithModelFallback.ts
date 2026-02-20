const GEMINI_PRO_PREVIEW_MODELS = new Set([
  "gemini-3.0-pro-preview",
  "gemini-3.1-pro-preview",
]);
const GEMINI_FLASH_PREVIEW_MODEL = "gemini-3-flash-preview";

function isGemini31SchemaRejection(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : String(error ?? "");
  const lowered = message.toLowerCase();

  return (
    lowered.includes("config.aimodel") &&
    (lowered.includes("gemini-3.1-pro-preview") || lowered.includes("gemini-3.0-pro-preview")) &&
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
