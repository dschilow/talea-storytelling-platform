export const GEMINI_MAIN_STORY_MODEL = "gemini-3-flash-preview";
export const GEMINI_SUPPORT_MODEL = "gemini-3.1-flash-lite-preview";
export const CLAUDE_SONNET_46_WIZARD_MODEL = "claude-sonnet-4-6";
export const CLAUDE_SONNET_46_MODEL = "claude-sonnet-4-6";
export const MINIMAX_M27_MODEL = "minimax-m2.7";
export const GPT_54_MINI_MODEL = "gpt-5.4-mini";
export const GPT_54_NANO_MODEL = "gpt-5.4-nano";

export function isGeminiFamilyModel(model?: string): boolean {
  return String(model || "").trim().toLowerCase().startsWith("gemini-");
}

export function isClaudeFamilyModel(model?: string): boolean {
  const normalized = String(model || "").trim().toLowerCase();
  return normalized.startsWith("claude-") || normalized === CLAUDE_SONNET_46_WIZARD_MODEL;
}

export function isMiniMaxFamilyModel(model?: string): boolean {
  return String(model || "").trim().toLowerCase().startsWith("minimax-");
}

export function resolveClaudeStoryModel(model?: string): string {
  const normalized = String(model || "").trim().toLowerCase();
  if (
    normalized === CLAUDE_SONNET_46_WIZARD_MODEL
    || normalized === CLAUDE_SONNET_46_MODEL
    || normalized === "claude-sonnet-4-20250514"
  ) {
    return CLAUDE_SONNET_46_MODEL;
  }
  return String(model || "").trim();
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
  if (isMiniMaxFamilyModel(normalized)) return GPT_54_MINI_MODEL;
  if (normalized.startsWith("gemini-")) return GEMINI_SUPPORT_MODEL;
  if (isClaudeFamilyModel(normalized)) return GEMINI_SUPPORT_MODEL;
  if (normalized.startsWith("gpt-") || normalized.startsWith("o4-")) return GPT_54_NANO_MODEL;
  return GPT_54_NANO_MODEL;
}

export function resolveCriticModelForPipeline(input: {
  selectedStoryModel?: string;
  explicitCriticModel?: string;
  defaultModel?: string;
}): string {
  const explicit = String(input.explicitCriticModel || "").trim();
  if (explicit) return explicit;
  if (isMiniMaxFamilyModel(input.selectedStoryModel)) return GPT_54_MINI_MODEL;
  if (isGeminiFamilyModel(input.selectedStoryModel) || isClaudeFamilyModel(input.selectedStoryModel)) {
    return GEMINI_SUPPORT_MODEL;
  }
  return String(input.defaultModel || GPT_54_NANO_MODEL);
}

export function resolveSurgeryModelForPipeline(selectedStoryModel?: string): string {
  if (isMiniMaxFamilyModel(selectedStoryModel)) return GPT_54_MINI_MODEL;
  if (isGeminiFamilyModel(selectedStoryModel) || isClaudeFamilyModel(selectedStoryModel)) {
    return GEMINI_SUPPORT_MODEL;
  }
  const model = String(selectedStoryModel || "").trim();
  if (!model) return GPT_54_NANO_MODEL;
  if (model.startsWith("gpt-5.4-mini")) return GPT_54_NANO_MODEL;
  if (model.startsWith("gpt-5.4")) return "gpt-5.4";
  return GPT_54_NANO_MODEL;
}
