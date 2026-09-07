import type { StoryConfig } from "../generate";
import type { BookBrief, Person } from "./types";

/** An explicit allowlist prevents operational flags and secrets entering prose.
 * All narrative Wizard controls are retained, including false/zero values.
 */
export function wizardWishes(config: StoryConfig): Record<string, unknown> {
  const keys = ["genre", "setting", "complexity", "learningMode", "stylePreset", "allowRhymes", "tone", "suspenseLevel", "humorLevel", "pacing", "pov", "hooks", "hasTwist", "requireMoral", "avatarIsHero", "allowFamousCharacters", "requireHappyEnd", "customPrompt", "storySoul", "emotionalFlavors", "storyTempo", "specialIngredients", "preferences", "parentalGuidance"] as const;
  return Object.fromEntries(keys.filter(k => config[k] !== undefined).map(k => [k, config[k]]));
}
export function makeBrief(config: StoryConfig, heroes: Person[], seed: string, extra?: Partial<Pick<BookBrief, "candidates" | "artifacts" | "recentPremises" | "blockedTerms">>): BookBrief {
  const brief: BookBrief = { seed, ageBand: config.ageGroup, length: config.length, language: config.language || "de", heroes, candidates: [], artifacts: [], recentPremises: [], blockedTerms: [], ...extra, wishes: wizardWishes(config) };
  if (config.broughtArtifact) {
    const { avatarId, artifactId } = config.broughtArtifact;
    const artifact = brief.artifacts.find(a => a.id === artifactId);
    if (!artifact || !heroes.some(h => h.id === avatarId)) throw new Error("The brought artifact and its selected avatar must be supplied");
    // Ownership is checked by the platform adapter. Local fixtures only supply
    // the narrative contract; they cannot grant ownership or a reward.
    brief.artifacts = [{ ...artifact, broughtBy: avatarId }];
  }
  return brief;
}
export function writerModel(config: StoryConfig): string {
  if (config.aiProvider === "openrouter") return config.openRouterModel || "moonshotai/kimi-k2.6";
  const model = config.aiModel;
  if (!model) return "moonshotai/kimi-k2.6";
  if (model === "claude-sonnet-4-6") return "anthropic/claude-sonnet-4.6";
  if (model === "minimax-m2.7") return "minimax/minimax-m2.7";
  return `${model.startsWith("gemini-") ? "google" : "openai"}/${model}`;
}
