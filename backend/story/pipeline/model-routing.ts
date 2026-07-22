export const GEMINI_MAIN_STORY_MODEL = "gemini-3-flash-preview";
export const GEMINI_SUPPORT_MODEL = "google/gemini-3.5-flash-lite";
export const CLAUDE_SONNET_46_WIZARD_MODEL = "claude-sonnet-4-6";
export const CLAUDE_SONNET_46_MODEL = "claude-sonnet-4-6";
export const MINIMAX_M27_MODEL = "minimax-m2.7";
export const GPT_54_MINI_MODEL = "gpt-5.4-mini";
export const GPT_54_NANO_MODEL = "gpt-5.4-nano";
export const OPENROUTER_PROVIDER = "openrouter";
export const OPENROUTER_STORY_FALLBACK_MODELS = [
  "~google/gemini-flash-latest",
  "~openai/gpt-mini-latest",
  "qwen/qwen3.6-max-preview",
  "~anthropic/claude-sonnet-latest",
];

export function isGeminiFamilyModel(model?: string): boolean {
  return String(model || "").trim().toLowerCase().startsWith("gemini-");
}

export function isOpenRouterProvider(provider?: string): boolean {
  return String(provider || "").trim().toLowerCase() === OPENROUTER_PROVIDER;
}

export function isOpenRouterFamilyModel(model?: string): boolean {
  const normalized = String(model || "").trim();
  return normalized.includes("/") || normalized.startsWith("~");
}

export function resolveOpenRouterFallbackModels(
  selectedModel?: string,
  explicitFallbacks?: string[],
): string[] {
  const selected = String(selectedModel || "").trim();
  const selectedKey = selected.toLowerCase();
  const out: string[] = [];
  const seen = new Set<string>(selectedKey ? [selectedKey] : []);

  for (const raw of [...(explicitFallbacks || []), ...OPENROUTER_STORY_FALLBACK_MODELS]) {
    const model = String(raw || "").trim();
    const key = model.toLowerCase();
    if (!model || seen.has(key) || !isOpenRouterFamilyModel(model)) continue;
    seen.add(key);
    out.push(model);
  }

  return out;
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
  const selected = String(selectedStoryModel || "").trim();
  const normalized = selected.toLowerCase();
  if (!normalized) return GEMINI_SUPPORT_MODEL;
  // Keep planning / critique / repair work on cheap, predictable support models.
  // OpenRouter story models are often premium prose models; using them for every
  // support task multiplies cost and has caused truncated JSON in production logs.
  if (isOpenRouterFamilyModel(selected)) return GEMINI_SUPPORT_MODEL;
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
  const selected = String(input.selectedStoryModel || "").trim();
  if (isOpenRouterFamilyModel(selected)) {
    return explicit || GEMINI_SUPPORT_MODEL;
  }
  if (explicit) return explicit;
  if (isMiniMaxFamilyModel(input.selectedStoryModel)) return GPT_54_MINI_MODEL;
  if (isGeminiFamilyModel(input.selectedStoryModel) || isClaudeFamilyModel(input.selectedStoryModel)) {
    return GEMINI_SUPPORT_MODEL;
  }
  return String(input.defaultModel || GPT_54_NANO_MODEL);
}

export function resolveSurgeryModelForPipeline(selectedStoryModel?: string): string {
  const selected = String(selectedStoryModel || "").trim();
  if (isOpenRouterFamilyModel(selected)) return GEMINI_SUPPORT_MODEL;
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

export function resolveConfiguredStoryModel(rawConfig?: {
  aiProvider?: string;
  aiModel?: string;
  openRouterModel?: string;
}): string {
  if (isOpenRouterProvider(rawConfig?.aiProvider)) {
    const openRouterModel = String(rawConfig?.openRouterModel || "").trim();
    const aiModel = String(rawConfig?.aiModel || "").trim();
    return (isOpenRouterFamilyModel(openRouterModel) ? openRouterModel : "")
      || (isOpenRouterFamilyModel(aiModel) ? aiModel : "")
      || "moonshotai/kimi-k2.6";
  }

  return String(rawConfig?.aiModel || "").trim() || GEMINI_MAIN_STORY_MODEL;
}
