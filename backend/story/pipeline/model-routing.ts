export const GEMINI_MAIN_STORY_MODEL = "gemini-3-flash-preview";
export const GEMINI_SUPPORT_MODEL = "gemini-3.1-flash-lite-preview";

export function isGeminiFamilyModel(model?: string): boolean {
  return String(model || "").trim().toLowerCase().startsWith("gemini-");
}

export function isGeminiFlashFamilyModel(model?: string): boolean {
  const normalized = String(model || "").trim().toLowerCase();
  return normalized.startsWith("gemini-") && normalized.includes("flash");
}

export function resolveGeminiSupportFallback(selectedStoryModel?: string): string | undefined {
  if (!isGeminiFamilyModel(selectedStoryModel)) return undefined;
  const selected = String(selectedStoryModel || "").trim();
  if (selected && selected !== GEMINI_SUPPORT_MODEL) return selected;
  return GEMINI_MAIN_STORY_MODEL;
}

export function resolveSupportTaskModel(selectedStoryModel?: string): string {
  const normalized = String(selectedStoryModel || "").trim().toLowerCase();
  if (!normalized) return GEMINI_SUPPORT_MODEL;
  if (normalized.startsWith("gemini-")) return GEMINI_SUPPORT_MODEL;
  if (normalized.startsWith("gpt-") || normalized.startsWith("o4-")) return "gpt-5-nano";
  return "gpt-5-nano";
}

export function resolveCriticModelForPipeline(input: {
  selectedStoryModel?: string;
  explicitCriticModel?: string;
  defaultModel?: string;
}): string {
  const explicit = String(input.explicitCriticModel || "").trim();
  if (explicit) return explicit;
  if (isGeminiFamilyModel(input.selectedStoryModel)) return GEMINI_SUPPORT_MODEL;
  return String(input.defaultModel || "gpt-5-mini");
}

export function resolveSurgeryModelForPipeline(selectedStoryModel?: string): string {
  if (isGeminiFamilyModel(selectedStoryModel)) return GEMINI_SUPPORT_MODEL;
  const model = String(selectedStoryModel || "").trim();
  if (!model) return "gpt-5-mini";
  if (model.startsWith("gpt-5.4")) return "gpt-5.4";
  return "gpt-5-mini";
}
