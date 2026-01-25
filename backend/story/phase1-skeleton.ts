// Phase 1: Story Skeleton Generator
// Generates story structure with character ROLES (no names, no visuals)
// Token Budget: ~1,500 tokens

import { secret } from "encore.dev/config";
import type { StoryConfig } from "./generate";
import type { StorySkeleton, ArtifactRequirement } from "./types";
import {
  describeEmotionalFlavors,
  describeSpecialIngredients,
  type StoryExperienceContext,
} from "./story-experience";
import { StoryRemixer } from "./story-remixer";
import { deterministicSeedFrom } from "./seed-utils";

const openAIKey = secret("OpenAIKey");

// Retry configuration for transient network errors
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

/**
 * Helper to determine if an error is a transient network error that should be retried
 */
function isTransientNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const cause = (error as any).cause;

    // Check for socket/network errors
    if (message.includes('fetch failed') ||
      message.includes('socket') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('etimedout') ||
      message.includes('network')) {
      return true;
    }

    // Check cause for socket errors (like UND_ERR_SOCKET)
    if (cause && typeof cause === 'object') {
      const causeCode = (cause as any).code;
      if (causeCode === 'UND_ERR_SOCKET' ||
        causeCode === 'ECONNRESET' ||
        causeCode === 'ETIMEDOUT') {
        return true;
      }
    }
  }
  return false;
}

/**
 * Fetch with retry for transient network errors
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  context: string
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      lastError = error as Error;

      if (isTransientNetworkError(error) && attempt < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[${context}] Transient network error on attempt ${attempt}/${MAX_RETRIES}, retrying in ${delay}ms...`, {
          error: (error as Error).message,
          cause: (error as any).cause?.code
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }

  throw lastError;
}

// Import SelectedFairyTale type from fairy-tale-selector
import type { SelectedFairyTale } from "./fairy-tale-selector";

interface Phase1Input {
  config: StoryConfig;
  avatarDetails: Array<{
    name: string;
    description?: string;
  }>;
  experience: StoryExperienceContext;
  selectedFairyTale?: SelectedFairyTale | null; // NEW: If provided, skip expensive skeleton generation
}

interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    completion_tokens_details?: {
      reasoning_tokens?: number;
      accepted_prediction_tokens?: number;
      audio_tokens?: number;
      rejected_prediction_tokens?: number;
    };
  };
  error?: any;
}

export interface Phase1GenerationResult {
  skeleton: StorySkeleton;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    reasoningTokens?: number;
  };
  openAIRequest: any;
  openAIResponse: OpenAIResponse;
  remixInstructions?: string; // NEW: Remix transformation summary for Phase3
}

export class Phase1SkeletonGenerator {
  async generate(input: Phase1Input): Promise<Phase1GenerationResult> {
    // CRITICAL CHANGE: We NO LONGER skip skeleton generation for fairy tales.
    // Instead, we use the fairy tale as a "guide" for the LLM to create a unique remix.
    if (input.selectedFairyTale) {
      console.log(
        `[Phase1] ✨ FAIRY TALE MODE: Using "${input.selectedFairyTale.tale.title}" as creative inspiration (REMIX MODE)`
      );
      // We intentionally do NOT return early here. We want the LLM to generate the skeleton.
    }

    // Normal mode: generate skeleton via OpenAI
    console.log("[Phase1] Generating story skeleton...");

    const prompt = this.buildSkeletonPrompt(input, input.selectedFairyTale);
    const modelName = input.config.aiModel || "gpt-5-mini";

    // Check if this is a reasoning model (gpt-5, o4-mini, etc.)
    const isReasoningModel = modelName.includes("gpt-5") || modelName.includes("o4");

    const payload: any = {
      model: modelName,
      messages: [
        {
          role: "system",
          content: "You are a professional children's book author who creates story structures using generic character placeholders."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: isReasoningModel ? 16000 : 3000,
    };

    // Add reasoning_effort for reasoning models (they don't support temperature/top_p)
    // Phase1 only needs structure, not deep reasoning - use "low" to minimize token waste
    if (isReasoningModel) {
      payload.reasoning_effort = "low";
    } else {
      // Only add creativity parameters for non-reasoning models
      payload.temperature = 1.0;           // MAX creativity (0.0-1.0)
      payload.top_p = 0.98;                // Wider sampling for variety
      payload.frequency_penalty = 0.5;     // Strongly reduce repetition
      payload.presence_penalty = 0.4;      // Strongly encourage new topics
    }

    // OPTIMIZATION v2.3: Enhanced Variance Seed & History Check
    // 1. Use secure random + time + user ID + inputs for seed
    // 2. This seed ensures standard OpenAI calls vary even with identical inputs
    const randomComponent = Math.floor(Math.random() * 1000000);
    const inputHash = deterministicSeedFrom(
      input.config.setting +
      input.config.genre +
      JSON.stringify(input.avatarDetails.map(a => a.name))
    );

    const varianceSeed = (Date.now() % 1000000) + inputHash + randomComponent;
    payload.seed = varianceSeed;

    console.log(`[Phase1] 🎲 Using HIGH-ENTROPY variance seed: ${varianceSeed}`);

    try {
      const openAIRequest = { ...payload };
      const response = await fetchWithRetry(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openAIKey()}`,
          },
          body: JSON.stringify(payload),
        },
        "Phase1"
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Phase1] OpenAI API error response:", errorText);
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as OpenAIResponse;
      console.log("[Phase1] OpenAI API response:", JSON.stringify(data, null, 2));

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        console.error("[Phase1] No content in response. Full response:", JSON.stringify(data, null, 2));
        throw new Error("No content in Phase 1 response");
      }

      const skeleton = JSON.parse(content) as StorySkeleton;

      // 🔧 CHECK FOR AI REFUSAL: Sometimes OpenAI returns an error object instead of the skeleton
      if ((skeleton as any).error) {
        console.error("[Phase1] ❌ AI refused to generate skeleton:", (skeleton as any).error);
        throw new Error(`AI refused to generate skeleton: ${(skeleton as any).error}`);
      }

      // Validate structure
      this.validateSkeletonStructure(skeleton);

      console.log("[Phase1] Skeleton generated successfully:", {
        title: skeleton.title,
        chaptersCount: skeleton.chapters?.length,
        requirementsCount: skeleton.supportingCharacterRequirements?.length,
      });

      const usage = data.usage
        ? {
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? 0,
          totalTokens: data.usage.total_tokens ?? 0,
          reasoningTokens: data.usage.completion_tokens_details?.reasoning_tokens ?? 0,
        }
        : undefined;

      // Log reasoning token breakdown if available
      if (usage && usage.reasoningTokens > 0) {
        console.log("[Phase1] Reasoning tokens breakdown:", {
          total: usage.completionTokens,
          reasoning: usage.reasoningTokens,
          text: usage.completionTokens - usage.reasoningTokens,
          reasoningPercentage: ((usage.reasoningTokens / usage.completionTokens) * 100).toFixed(1) + '%'
        });
      }

      return {
        skeleton,
        usage,
        openAIRequest,
        openAIResponse: data,
      };
    } catch (error) {
      console.error("[Phase1] Error generating skeleton:", error);
      throw error;
    }
  }

  private buildSkeletonPrompt(input: Phase1Input, selectedFairyTale?: SelectedFairyTale | null): string {
    const { config, avatarDetails, experience } = input;

    const avatarLine =
      avatarDetails.length > 0
        ? avatarDetails
          .map((avatar) =>
            avatar.description ? `${avatar.name} (${avatar.description})` : avatar.name
          )
          .join(", ")
        : "No specific avatars provided - use neutral protagonists.";

    const suspenseLabels = ["very calm", "light tension", "exciting", "high suspense"];
    const humorLabels = ["serious", "gentle", "funny", "very playful"];

    const suspenseLabel = suspenseLabels[config.suspenseLevel ?? 1] ?? "balanced";
    const humorLabel = humorLabels[config.humorLevel ?? 1] ?? "gentle";

    const soulSummary = experience.soul
      ? `${experience.soul.label} - ${experience.soul.storyPromise} (Tone: ${experience.soul.recommendedTone}, Pacing: ${experience.soul.defaultPacing})`
      : "No story soul selected - tell it warm, imaginative, and age-appropriate.";

    const flavorSummary = experience.emotionalFlavors.length
      ? experience.emotionalFlavors
        .map((flavor) => `- ${flavor.label}: ${flavor.description}`)
        .join("\n")
      : "- Natural heart moments without extra spice.";

    const tempoSummary = experience.tempo
      ? `${experience.tempo.label} - ${experience.tempo.description} (Pacing: ${experience.tempo.pacing})`
      : `Standard pace (${config.pacing ?? "balanced"}) - balance calm and dynamic moments.`;

    const ingredientSummary = experience.specialIngredients.length
      ? experience.specialIngredients
        .map((ingredient) => {
          const extras: string[] = [];
          if (ingredient.forcesTwist) {
            extras.push("Plan a surprise or twist in chapter 4.");
          }
          if (ingredient.hookHint) {
            extras.push(`Use plot hook "${ingredient.hookHint}".`);
          }
          if (ingredient.emphasis) {
            extras.push(ingredient.emphasis);
          }
          const extraText = extras.length ? ` (${extras.join(" ")})` : "";
          return `- ${ingredient.label}: ${ingredient.description}${extraText}`;
        })
        .join("\n")
      : "- No special ingredients - classic structure is fine.";

    const fairyTaleLine = selectedFairyTale
      ? `FAIRY TALE INSPIRATION (ONLY a raw starting point!): ${selectedFairyTale.tale.title}.
         IMPORTANT: You MUST reinvent the story!
         - Change the setting or time (e.g., space, underwater, big city, future).
         - Change character motivations.
         - Invent a COMPLETELY NEW twist no one expects.
         - Use motifs, but never copy the plot 1:1.`
      : "No fairy-tale template - fully original structure.";

    const fairyTaleScenes = selectedFairyTale
      ? selectedFairyTale.scenes
        .slice(0, 6)
        .map((scene) => `- Scene ${scene.sceneNumber}: ${scene.sceneTitle} | Mood: ${scene.mood} | Setting: ${scene.setting}`)
        .join("\n")
      : "";

    const hooksLine =
      config.hooks && config.hooks.length > 0 ? config.hooks.join(", ") : "no special hooks";

    const customLine = config.customPrompt ? `USER REQUEST: ${config.customPrompt}` : "";

    const flavorDetails = describeEmotionalFlavors(experience);
    const ingredientDetails = describeSpecialIngredients(experience);

    const povLabel = config.pov === "ich" ? "first-person" : "limited third-person";

    return `
You are an award-winning children's book author who writes masterful story skeletons for illustrated stories. Be precise, vivid, and age-appropriate.

MAIN CHARACTERS: ${avatarLine}
GENRE: ${config.genre}
SETTING: ${config.setting}
AGE GROUP: ${config.ageGroup}
COMPLEXITY: ${config.complexity}
LENGTH: ${config.length}
POV: ${povLabel}
LANGUAGE: ${config.language ?? "de"}
RHYMES: ${config.allowRhymes ? "Light rhymes are allowed when natural." : "No rhyme requirement - clear prose."}

STORY EXPERIENCE (USER CHOICE):
- Style preset: ${config.stylePreset ?? "story-soul recommendation"}
- Rhymes allowed: ${config.allowRhymes ? "yes" : "no"}
- Story soul: ${soulSummary}
- Emotional flavor:
${flavorSummary}
- Pacing: ${tempoSummary}
- Suspense: Level ${config.suspenseLevel ?? 1} (${suspenseLabel})
- Humor: Level ${config.humorLevel ?? 1} (${humorLabel})
- Twist requested: ${config.hasTwist ? "yes - set up in chapter 4" : "no"}
- Hooks: ${hooksLine}
- Special ingredients:
${ingredientSummary}

FAIRY TALE GUIDE: ${fairyTaleLine}
FAIRY TALE SCENES (loose guidance, order may vary):
${fairyTaleScenes || "- no templates"}

DETAILED EMOTIONAL FLAVOR:
${flavorDetails}

DETAILED SPECIAL INGREDIENTS:
${ingredientDetails}

${customLine}

CONFLICT RULES (CRITICAL FOR QUALITY):
1. CONCRETE CHALLENGES REQUIRED:
   - 80% of stories need an external danger/obstacle
   - Examples: wolf hunts, witch locks in, dragon steals, monster threatens, lost path, friend trapped
   - 20% emotional journeys OK (only for "warm/meaningful" and age group 9-12)

2. AGE-APPROPRIATE CONFLICT:
   - Ages 3-5: simple and clear (wolf arrives, witch locks in, lost path, monster hides)
   - Ages 6-8: more complex (solve puzzles, negotiate, clever plans, moral choices)
   - Ages 9-12: subtle (inner conflict, social problems, secrets, complex relationships)

3. FORBIDDEN (low quality):
   - purely philosophical problems ("forgotten songs", "lost dreams", "vanished colors")
   - abstract concepts without physical component
   - emotional journeys without a clear goal/obstacle (unless explicitly requested)
   - problems that solve themselves

4. REQUIRED ELEMENTS:
   - clear antagonist OR concrete obstacle (character, nature, situation)
   - concrete problem that must be solved
   - risk/stakes (what happens if the protagonist fails?)
   - satisfying resolution (overcome via courage/cleverness/friendship)

YOUR TASK:
1. Create a story structure with exactly 5 chapters.
2. CRITICAL: The MAIN CHARACTERS above are USER AVATARS.
   - Use their NAMES directly in the story text: "Alexander finds...", "Adrian sees..."
   - NEVER create placeholders for avatars: DO NOT use {{ALEXANDER}}, {{ADRIAN}}
   - {{PLACEHOLDER}} is ONLY for supporting characters ({{WISE_ELDER}}, {{ANIMAL_HELPER}}, etc.)
3. Use placeholders only for supporting characters and keep them consistent (same placeholder = same character).
4. Each chapter description around 50-80 words (flexible). Write dense, vivid, concise. Short sentences (3-10 words). Avoid filler.
5. Chapters 1-4 end with a gentle cliffhanger or forward question. Chapter 5 provides a warm resolution.
6. Let story soul, emotional flavor, pacing, and special ingredients already be felt in the plot.
7. For each SUPPORTING ROLE, include emotional nature, key traits, visual hints (species/job/appearance), and chapter appearances.
8. If a twist is requested or a special ingredient forces it: prepare in chapter 4 and resolve warmly in chapter 5.
9. FOLLOW THE CONFLICT RULES ABOVE - concrete challenges are required for quality.

PLACEHOLDER LIBRARY (use only when needed, custom allowed):
- {{WISE_ELDER}} - wise mentor
- {{ANIMAL_HELPER}} - loyal animal companion
- {{MAGICAL_CREATURE}} - magical being
- {{FRIENDLY_VILLAGER}} - helpful local person
- {{OBSTACLE_CHARACTER}} - obstacle or antagonist
- Custom placeholders in {{NAME}} format are allowed if the role is clear.

ARTIFACT REWARD SYSTEM:
Every story MUST include a magical artifact that the protagonist discovers and uses.
- The artifact is found in an early chapter (discoveryChapter: 2 or 3)
- The artifact is used to solve a problem in a later chapter (usageChapter: 4 or 5)
- Choose a category that fits the story: weapon, clothing, magic, book, tool, tech, nature, potion, jewelry, armor, map
- Describe what ability the artifact should have (navigation, protection, communication, healing, courage, wisdom, discovery, stealth, combat, magic, light, time)
- The artifact should feel earned and meaningful to the story

OUTPUT (JSON):
{
  "title": "CREATIVE TITLE RULES (CRITICAL!):
    - 2-3 words ideal, max 4
    - Choose a MYSTERIOUS object/place that creates wonder
    - EXCELLENT: 'The Whispering Oak', 'The Glass Mountain', 'The Dream Spinner', 'The Forgotten Door', 'The Starlight Key'
    - FORBIDDEN (OVERUSED!): 'Mondkompass', 'Silberfaden', 'Sternenstaub', 'Zauberwald', 'Kompass'
    - FORBIDDEN PATTERNS: '[Name] and the...', 'The [Adjective] [Common Noun]'
    - NEVER start with avatar names!",
  "chapters": [
    {
      "order": 1,
      "content": "TARGET: 50-80 words. Use avatar names directly (Alexander, Adrian), NO placeholders for them.",
      "characterRolesNeeded": [
        {
          "placeholder": "{{WISE_ELDER}}",
          "role": "guide",
          "archetype": "helpful_elder",
          "emotionalNature": "wise",
          "visualHints": "ENGLISH ONLY! Example: 'elderly human, grey beard, walking stick, warm wool cloak, kind wrinkles' - NEVER use German descriptions!",
          "importance": "high",
          "inChapters": [1, 3, 5]
        }
      ]
    }
  ],
  "supportingCharacterRequirements": [
    {
      "placeholder": "{{WISE_ELDER}}",
      "role": "guide",
      "archetype": "helpful_elder",
      "emotionalNature": "wise",
      "requiredTraits": ["wise", "protective", "kind"],
      "visualHints": "ENGLISH ONLY! Species, job, appearance, clothing. Example: 'elderly human, kind eyes, grey beard, brown cloak with hood, wooden walking stick'",
      "importance": "high",
      "inChapters": [1, 3, 5]
    }
  ],
  "artifactRequirement": {
    "placeholder": "{{ARTIFACT_REWARD}}",
    "preferredCategory": "magic",
    "requiredAbility": "navigation",
    "contextHint": "A magical compass that helps the hero find their way through the enchanted forest",
    "discoveryChapter": 2,
    "usageChapter": 4,
    "importance": "high"
  }
}

IMPORTANT:
- Keep chapters[].content around 50-80 words (flexible; quality over length).
- ALL visualHints MUST be in ENGLISH ONLY (no German descriptions!). Example: 'elderly wizard, blue robe, white beard' NOT 'älterer Mensch, Heiler'.
- Title must be UNIQUE and CREATIVE - never use common words like 'Kompass', 'Wald', 'Stern'.

VISUALHINTS LANGUAGE RULE (CRITICAL FOR IMAGE GENERATION):
All visualHints must be in ENGLISH to ensure proper image prompt generation.
- CORRECT: "elderly human with grey beard, brown cloak, kind expression"
- WRONG: "älterer Mensch, Heiler, warme Miene"

Ensure a clear learning arc for the avatars, recurring motifs, and cohesive dramatic structure. Chapter 5 shows emotional growth and fulfills the story-soul promise.
`.trim();
  }

  private validateSkeletonStructure(skeleton: any): void {
    if (!skeleton.chapters || !Array.isArray(skeleton.chapters)) {
      throw new Error("Skeleton must have chapters array");
    }

    if (skeleton.chapters.length !== 5) {
      throw new Error(`Skeleton must have exactly 5 chapters, got ${skeleton.chapters.length}`);
    }

    if (!skeleton.supportingCharacterRequirements || !Array.isArray(skeleton.supportingCharacterRequirements)) {
      throw new Error("Skeleton must have supportingCharacterRequirements array");
    }

    // Validate each chapter
    for (const chapter of skeleton.chapters) {
      if (!chapter.order || !chapter.content) {
        throw new Error("Each chapter must have order and content");
      }

      // 🔧 RELAXED VALIDATION: If characterRolesNeeded is missing, initialize as empty array
      // This handles cases where OpenAI omits the array for chapters without supporting characters
      if (!chapter.characterRolesNeeded || !Array.isArray(chapter.characterRolesNeeded)) {
        console.warn(`[Phase1] ⚠️ Chapter ${chapter.order} missing characterRolesNeeded - initializing to [].`);
        chapter.characterRolesNeeded = [];
      }

      const wordCount = typeof chapter.content === "string"
        ? chapter.content.split(/\s+/).filter(Boolean).length
        : 0;
      // 🔧 RELAXED VALIDATION: Allow 35-100 words (very flexible)
      if (wordCount < 35) {
        throw new Error(
          `[Phase1] Chapter ${chapter.order} has only ${wordCount} words (minimum: 35). REJECTED!`
        );
      }
      if (wordCount < 50 || wordCount > 80) {
        console.warn(
          `[Phase1] ⚠ Chapter ${chapter.order} word count ${wordCount} outside ideal range (50-80). Proceeding anyway.`
        );
      }
      if (wordCount > 100) {
        console.warn(
          `[Phase1] ⚠ Chapter ${chapter.order} has ${wordCount} words (max recommended: 100). Proceeding but may be trimmed.`
        );
      }
    }

    // Validate character requirements
    for (const req of skeleton.supportingCharacterRequirements) {
      const hasPlaceholder = typeof req.placeholder === "string" && req.placeholder.length > 0;
      const hasName = typeof (req as any).name === "string" && (req as any).name.length > 0;

      if (!hasPlaceholder && !hasName) {
        throw new Error("Each character requirement must declare either placeholder or name");
      }

      if (!req.role || !req.archetype) {
        throw new Error("Each character requirement must have role and archetype");
      }

      if (hasPlaceholder) {
        if (req.placeholder.startsWith("{{") && req.placeholder.endsWith("}}")) {
          continue;
        }

        // Allow placeholder values that are not wrapped when they match known avatar names,
        // but warn so we can monitor underlying prompt regressions.
        console.warn(
          `[Phase1] Warning: character requirement placeholder "${req.placeholder}" is not wrapped in {{ }}.`
        );
      }
    }

    // Validate artifact requirement (optional for backwards compatibility, but expected)
    if (skeleton.artifactRequirement) {
      const artifact = skeleton.artifactRequirement;

      if (!artifact.contextHint || typeof artifact.contextHint !== "string") {
        console.warn("[Phase1] ⚠️ artifactRequirement missing contextHint - adding default");
        artifact.contextHint = "A magical item that helps the hero";
      }

      if (!artifact.discoveryChapter || artifact.discoveryChapter < 1 || artifact.discoveryChapter > 5) {
        console.warn("[Phase1] ⚠️ artifactRequirement has invalid discoveryChapter - defaulting to 2");
        artifact.discoveryChapter = 2;
      }

      if (!artifact.usageChapter || artifact.usageChapter < 1 || artifact.usageChapter > 5) {
        console.warn("[Phase1] ⚠️ artifactRequirement has invalid usageChapter - defaulting to 4");
        artifact.usageChapter = 4;
      }

      if (artifact.usageChapter <= artifact.discoveryChapter) {
        console.warn("[Phase1] ⚠️ usageChapter must be after discoveryChapter - adjusting");
        artifact.usageChapter = Math.min(5, artifact.discoveryChapter + 2);
      }

      if (!artifact.importance) {
        artifact.importance = "high";
      }

      if (!artifact.placeholder) {
        artifact.placeholder = "{{ARTIFACT_REWARD}}";
      }

      console.log("[Phase1] ✅ Artifact requirement validated:", {
        category: artifact.preferredCategory,
        ability: artifact.requiredAbility,
        discovery: artifact.discoveryChapter,
        usage: artifact.usageChapter,
      });
    } else {
      // Generate a default artifact requirement if missing
      console.warn("[Phase1] ⚠️ No artifactRequirement in skeleton - generating default");
      skeleton.artifactRequirement = {
        placeholder: "{{ARTIFACT_REWARD}}",
        preferredCategory: "magic",
        requiredAbility: "courage",
        contextHint: "A magical item that helps the hero overcome challenges",
        discoveryChapter: 2,
        usageChapter: 4,
        importance: "high",
      };
    }

    console.log("[Phase1] Skeleton structure validated successfully");
  }
}



