// Phase 3: Story Finalizer with Character Injection
// Writes complete story with matched characters
// Token Budget: ~2,000 tokens

import { secret } from "encore.dev/config";
import type { StoryConfig } from "./generate";
import type { StorySkeleton, CharacterTemplate, FinalizedStory } from "./types";
import {
  describeEmotionalFlavors,
  describeSpecialIngredients,
  type StoryExperienceContext,
} from "./story-experience";
import { FairyTaleSelector, type SelectedFairyTale } from "./fairy-tale-selector";
import {
  FAIRY_TALE_ROLE_MAPPINGS,
  applyRoleTransformation,
  getAdaptedRoleTitle,
  getAdaptedPronouns,
} from "../fairytales/role-transformations";
import { OriginalityValidator } from "./originality-validator";
import type { InventoryItem } from "../avatar/avatar";
// NEW: Import professional storytelling rules v2.0
import { generateCompleteRulesBlockEN, containsMetaPatterns } from "./professional-storytelling-rules";
import StoryPostProcessor, { getQualityLabel } from "./story-post-processor";

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
      message.includes('network') ||
      message.includes('aborted')) {
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

interface Phase3Input {
  skeleton: StorySkeleton;
  assignments: Map<string, CharacterTemplate>;
  config: StoryConfig;
  avatarDetails: Array<{
    name: string;
    description?: string;
    visualProfile?: any;
    inventory?: InventoryItem[];  // 🎁 NEW: Avatar's existing artifacts
  }>;
  experience: StoryExperienceContext;
  useFairyTaleTemplate?: boolean; // NEW: Enable fairy tale mode
  remixInstructions?: string; // NEW: Remix transformation summary from Phase1
  selectedFairyTale?: SelectedFairyTale; // NEW: For originality validation
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
  };
  error?: any;
}

export interface Phase3FinalizationResult {
  story: FinalizedStory;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  openAIRequest: any;
  openAIResponse: OpenAIResponse;
  fairyTaleUsed?: {
    id: string;
    title: string;
    matchScore: number;
    matchReason: string;
  };
}

export class Phase3StoryFinalizer {
  private fairyTaleSelector: FairyTaleSelector;

  constructor() {
    this.fairyTaleSelector = new FairyTaleSelector();
  }

  async finalize(input: Phase3Input): Promise<Phase3FinalizationResult> {
    console.log("[Phase3] Finalizing story with character injection...");

    // NEW: Check if we should use fairy tale template
    let selectedFairyTale: SelectedFairyTale | null = null;

    if (input.selectedFairyTale) {
      selectedFairyTale = input.selectedFairyTale;
      console.log(`[Phase3] Using provided fairy tale from Phase 1: ${selectedFairyTale.tale.title}`);
    } else if (input.useFairyTaleTemplate) {
      console.log("[Phase3] Fairy tale mode enabled but no tale provided - selecting best match...");
      selectedFairyTale = await this.fairyTaleSelector.selectBestMatch(
        input.config,
        input.avatarDetails.length
      );

      if (selectedFairyTale) {
        console.log(`[Phase3] Using fairy tale: ${selectedFairyTale.tale.title}`);
        console.log(`[Phase3] Match score: ${selectedFairyTale.matchScore}, Reason: ${selectedFairyTale.matchReason}`);
      } else {
        console.log("[Phase3] No suitable fairy tale found, falling back to normal mode");
      }
    }

    // Step 1: Replace placeholders with actual character names
    const skeletonWithNames = this.injectCharacterNames(input.skeleton, input.assignments);

    // Step 2: Build finalization prompt with character details (and optional fairy tale)
    const prompt = selectedFairyTale
      ? this.buildFairyTalePrompt(
        skeletonWithNames,
        input.assignments,
        input.config,
        input.avatarDetails,
        input.experience,
        input.selectedFairyTale || selectedFairyTale,
        input.remixInstructions // NEW: Pass remix instructions
      )
      : this.buildFinalizationPrompt(
        skeletonWithNames,
        input.assignments,
        input.config,
        input.avatarDetails,
        input.experience
      );
    const normalizedPrompt = this.normalizeText(prompt);
    const modelName = input.config.aiModel || "gpt-5-mini";

    // Check if this is a reasoning model (gpt-5, o4-mini, etc.)
    const isReasoningModel = modelName.includes("gpt-5") || modelName.includes("o4");

    // 🔧 CRITICAL FIX: GPT-5-mini reasoning tokens are SEPARATE from completion tokens
    // When reasoning_effort="medium", the model uses ~8000 reasoning tokens
    // We need to increase max_completion_tokens to allow for BOTH reasoning + actual content
    const completionTokenLimit = selectedFairyTale
      ? (isReasoningModel ? 16000 : 3500)  // 16K for reasoning models (reasoning tokens are separate!)
      : (isReasoningModel ? 12000 : 2800); // 12K for non-fairy-tale stories

    const payload: any = {
      model: modelName,
      messages: [
        {
          role: "system",
          content: this.normalizeText("Du bist eine professionelle Kinderbuch-Autorin. Schreibe vollständige, neue Geschichten mit etablierten Charakteren. Nutze Vorlagen nur als Inspiration, niemals als Copy/Paste.")
        },
        {
          role: "user",
          content: normalizedPrompt
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: completionTokenLimit,
    };

    console.log(`[Phase3] Using max_completion_tokens: ${completionTokenLimit} (fairy tale mode: ${!!selectedFairyTale})`);

    // Add reasoning_effort for reasoning models (they don't support temperature/top_p)
    // OPTIMIZATION: Use "low" for Phase 3 - story finalization doesn't need deep reasoning
    // This reduces reasoning tokens from ~2600 to <1000 while maintaining quality
    if (isReasoningModel) {
      payload.reasoning_effort = "low";
    } else {
      // Only add creativity parameters for non-reasoning models
      payload.temperature = 0.9;           // High creativity for unique stories
      payload.top_p = 0.95;                // Nucleus sampling
      payload.frequency_penalty = 0.3;     // Reduce repetition within story
      payload.presence_penalty = 0.2;      // Encourage diverse vocabulary
    }

    // CRITICAL FIX: Add time-based seed for variance even with identical parameters
    // This prevents generating the exact same story multiple times
    // The seed changes based on current time (minute precision), ensuring variance
    const varianceSeed = Math.floor(Date.now() / 60000); // Changes every minute
    payload.seed = varianceSeed;

    console.log(`[Phase3] Using variance seed: ${varianceSeed} to prevent duplicate stories`);

    // CRITICAL FIX: Increase timeout for reasoning models (gpt-5-mini can be slow)
    // Extended timeout for gpt-5-mini which needs time for reasoning tokens
    const baseTimeout = isReasoningModel ? 180000 : 60000; // 3 minutes for reasoning models, 1 minute for others
    const requestTimeoutMs = selectedFairyTale ? baseTimeout * 1.5 : baseTimeout; // 4.5 minutes for fairy tales with reasoning
    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => abortController.abort(), requestTimeoutMs);

    console.log(`[Phase3] Using ${requestTimeoutMs}ms timeout (fairy tale mode: ${!!selectedFairyTale})`);

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
          signal: abortController.signal,
        },
        "Phase3"
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Phase3] OpenAI API error response:", errorText);
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as OpenAIResponse;
      console.log("[Phase3] OpenAI API response received, checking content...");

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        console.error("[Phase3] No content in response. Full response:", JSON.stringify(data, null, 2));
        throw new Error("No content in Phase 3 response");
      }

      let finalStory = JSON.parse(content) as FinalizedStory;

      // Validate structure
      this.validateFinalStory(finalStory);

      // Debug: Log artifact status after validation
      console.log("[Phase3] 🎁 Artifact status after validation:", {
        hasArtifact: !!finalStory.newArtifact,
        artifactName: finalStory.newArtifact?.name || 'none',
        artifactType: finalStory.newArtifact?.type || 'none'
      });

      // NEW: Post-processing with professional quality rules v2.0
      console.log("[Phase3] 📝 Running professional quality post-processor...");
      const postProcessor = new StoryPostProcessor(input.config.ageGroup || '6-8');
      const postProcessResult = postProcessor.process(finalStory);

      // Log quality score
      const qualityLabel = getQualityLabel(postProcessResult.qualityScore.overall);
      console.log(`[Phase3] 📊 Quality Score: ${postProcessResult.qualityScore.overall}/10 ${qualityLabel}`);
      console.log(`[Phase3] 📊 Breakdown:`, {
        title: postProcessResult.qualityScore.titleScore,
        dialogue: postProcessResult.qualityScore.dialogueScore,
        showDontTell: postProcessResult.qualityScore.showDontTellScore,
        sentenceLength: postProcessResult.qualityScore.sentenceLengthScore,
        sensory: postProcessResult.qualityScore.sensoryScore,
        structure: postProcessResult.qualityScore.structureScore,
        metaPenalty: postProcessResult.qualityScore.metaPatternPenalty,
      });

      // Log issues and suggestions
      if (postProcessResult.qualityScore.issues.length > 0) {
        console.warn(`[Phase3] ⚠️ Quality Issues:`, postProcessResult.qualityScore.issues);
      }
      if (postProcessResult.qualityScore.suggestions.length > 0) {
        console.log(`[Phase3] 💡 Suggestions:`, postProcessResult.qualityScore.suggestions);
      }

      // Apply cleaned story if modifications were made
      if (postProcessResult.wasModified) {
        console.log(`[Phase3] 🔧 Applied modifications:`, postProcessResult.modifications);
        finalStory = postProcessResult.story;
      }

      // Check for critical meta-pattern issues
      const metaCheck = containsMetaPatterns(finalStory.chapters.map(c => c.content).join('\n'));
      if (metaCheck.hasMeta) {
        console.error(`[Phase3] ❌ CRITICAL: Meta-patterns still present after post-processing:`, metaCheck.patterns);
        // Don't throw - just log warning for now, as we want to see the output
      }

      this.validateStoryQuality(finalStory, input.avatarDetails, selectedFairyTale, input.config.hasTwist ?? false, input.config.language);

      // NEW: Validate originality if fairy tale was used
      if (selectedFairyTale || input.selectedFairyTale) {
        const fairyTale = input.selectedFairyTale || selectedFairyTale;
        if (fairyTale) {
          console.log("[Phase3] 🎨 Running originality validation...");

          // Combine all chapter content for validation
          const generatedStoryText = finalStory.chapters
            .map(ch => ch.content)
            .join('\n\n');

          // Combine all fairy tale scenes as source template
          const sourceTemplateText = fairyTale.scenes
            .map(scene => scene.sceneDescription)
            .join('\n\n');

          // Run validation (relaxed for fairy tales - allow traditional moral phrases)
          const originalityReport = OriginalityValidator.validate(
            generatedStoryText,
            sourceTemplateText,
            {
              maxOverlapPercentage: 40,
              minPhraseLength: 4,
              maxDirectCopies: 8, // Higher limit for fairy tales to allow traditional moral phrases
              strictMode: false,
            }
          );

          console.log(`[Phase3] 📊 Originality: ${originalityReport.overlapPercentage.toFixed(1)}% overlap (threshold: ${originalityReport.threshold}%)`);
          console.log(`[Phase3] ✅ Verdict: ${originalityReport.verdictReason}`);

          if (!originalityReport.isOriginal) {
            console.error("[Phase3] ❌ ORIGINALITY VALIDATION FAILED!");
            console.error(`[Phase3] Issues: ${originalityReport.issues.join(', ')}`);
            console.error(`[Phase3] Suggestions: ${originalityReport.suggestions.join(', ')}`);

            throw new Error(
              `Story failed originality validation: ${originalityReport.overlapPercentage.toFixed(1)}% overlap ` +
              `(max ${originalityReport.threshold}%). Issues: ${originalityReport.issues.join(', ')}`
            );
          }

          console.log("[Phase3] ✅ Originality validation passed!");
        }
      }

      console.log("[Phase3] Story finalized successfully:", {
        title: finalStory.title,
        chaptersCount: finalStory.chapters?.length,
        hasNewArtifact: !!finalStory.newArtifact,
        artifactName: finalStory.newArtifact?.name || 'none'
      });

      const usage = data.usage
        ? {
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? 0,
          totalTokens: data.usage.total_tokens ?? 0,
        }
        : undefined;

      const result: Phase3FinalizationResult = {
        story: finalStory,
        usage,
        openAIRequest,
        openAIResponse: data,
      };

      // Add fairy tale info if used
      if (selectedFairyTale) {
        result.fairyTaleUsed = {
          id: selectedFairyTale.tale.id,
          title: selectedFairyTale.tale.title,
          matchScore: selectedFairyTale.matchScore,
          matchReason: selectedFairyTale.matchReason,
        };
      }

      return result;
    } catch (error) {
      if ((error as any)?.name === "AbortError") {
        console.error(`[Phase3] Timeout after ${requestTimeoutMs}ms while waiting for OpenAI`);
        throw new Error(`[Phase3] Timeout after ${requestTimeoutMs}ms waiting for OpenAI response`);
      }
      console.error("[Phase3] Error finalizing story:", error);
      throw error;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  /**
   * Replace all placeholders with actual character names
   */
  private injectCharacterNames(
    skeleton: StorySkeleton,
    assignments: Map<string, CharacterTemplate>
  ): StorySkeleton {
    return {
      ...skeleton,
      chapters: skeleton.chapters.map(ch => ({
        ...ch,
        content: this.replaceAllPlaceholders(ch.content, assignments),
      })),
    };
  }

  /**
   * Replace placeholder tokens with character names
   */
  private replaceAllPlaceholders(
    text: string,
    assignments: Map<string, CharacterTemplate>
  ): string {
    let result = this.normalizeText(text);

    for (const [placeholder, character] of assignments) {
      if (!placeholder || typeof placeholder !== "string") {
        continue;
      }
      const regex = new RegExp(this.escapeRegex(placeholder), 'g');
      result = result.replace(regex, character.name ?? "Unbenannter Charakter");
    }

    return result;
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Normalize text to safe UTF-8 (NFC) and fix common mojibake for German umlauts.
   */
  private normalizeText(text: string): string {
    if (!text) return "";
    const replacements: Record<string, string> = {
      "Ã¤": "ä",
      "Ã¶": "ö",
      "Ã¼": "ü",
      "ÃŸ": "ß",
      "�": ""
    };
    let normalized = text;
    for (const [bad, good] of Object.entries(replacements)) {
      normalized = normalized.replace(new RegExp(bad, "g"), good);
    }
    return normalized.normalize("NFC");
  }

  /**
   * Convert structured visual profile to text description
   */
  private visualProfileToText(vp: any): string {
    if (!vp) return 'Keine visuelle Beschreibung verfügbar';

    const parts: string[] = [];

    if (vp.ageApprox) parts.push(`${vp.ageApprox} Jahre alt`);
    if (vp.gender) parts.push(vp.gender);

    if (vp.hair) {
      const hairParts: string[] = [];
      if (vp.hair.color) hairParts.push(vp.hair.color);
      if (vp.hair.length) hairParts.push(vp.hair.length);
      if (vp.hair.type) hairParts.push(vp.hair.type);
      if (vp.hair.style) hairParts.push(vp.hair.style);
      if (hairParts.length > 0) parts.push(`Haare: ${hairParts.join(', ')}`);
    }

    if (vp.eyes?.color) parts.push(`${vp.eyes.color} Augen`);

    if (vp.skin?.tone) parts.push(`Hautton: ${vp.skin.tone}`);

    if (vp.clothingCanonical) {
      const clothingParts: string[] = [];
      if (vp.clothingCanonical.outfit) clothingParts.push(vp.clothingCanonical.outfit);
      else {
        if (vp.clothingCanonical.top) clothingParts.push(vp.clothingCanonical.top);
        if (vp.clothingCanonical.bottom) clothingParts.push(vp.clothingCanonical.bottom);
      }
      if (vp.clothingCanonical.footwear) clothingParts.push(vp.clothingCanonical.footwear);
      if (clothingParts.length > 0) parts.push(`Kleidung: ${clothingParts.join(', ')}`);
    }

    if (vp.accessories && vp.accessories.length > 0) {
      parts.push(`Accessoires: ${vp.accessories.join(', ')}`);
    }

    if (vp.consistentDescriptors && vp.consistentDescriptors.length > 0) {
      parts.push(vp.consistentDescriptors.join(', '));
    }

    return parts.join('; ');
  }
  private buildFinalizationPrompt(
    skeletonWithNames: StorySkeleton,
    assignments: Map<string, CharacterTemplate>,
    config: StoryConfig,
    avatarDetails: Array<{ name: string; description?: string; visualProfile?: any; inventory?: InventoryItem[] }>,
    experience: StoryExperienceContext
  ): string {
    const characterDetails = Array.from(assignments.entries())
      .map(([placeholder, char]) => [
        `Character ${char.name} (${char.role})`,
        `- Placeholder: ${placeholder}`,
        `- Archetyp: ${char.archetype}`,
        `- Emotionale Natur: ${char.emotionalNature.dominant} (${char.emotionalNature.secondary.join(", ")})`,
        `- Visuelles Profil: ${char.visualProfile.description}`,
        `- Spezies: ${char.visualProfile.species}`,
        `- Farbpalette: ${char.visualProfile.colorPalette.join(", ")}`,
        `- Prompt (English): ${char.visualProfile.imagePrompt}`,
      ].join("\n"))
      .join("\n\n");

    const avatarDetailsText = avatarDetails
      .map((avatar) => {
        let line = `- ${avatar.name}`;
        if (avatar.description) {
          line += `, ${avatar.description}`;
        }
        if (avatar.visualProfile) {
          line += `, Aussehen: ${this.visualProfileToText(avatar.visualProfile)}`;
        }
        return line;
      })
      .join("\n");

    // 🎁 Build inventory section for artifact injection
    const allInventoryItems = avatarDetails.flatMap(avatar =>
      (avatar.inventory || []).map(item => ({
        ownerName: avatar.name,
        item
      }))
    );

    const inventorySection = allInventoryItems.length > 0
      ? `\n🎒 AVATAR-AUSRÜSTUNG (kann in der Geschichte genutzt werden):\n${allInventoryItems.map(({ ownerName, item }) =>
        `- ${ownerName} besitzt: "${item.name}" (${item.type}) - ${item.storyEffect || item.description}`
      ).join("\n")}\n\nANWEISUNG: Wähle höchstens EIN passendes Artefakt und lass den Besitzer es EINMAL aktiv im Plot nutzen (Erinnerung oder Werkzeug). Wenn keines passt, ignoriere sie. In Kapitel 5 MUSS trotzdem ein neues Belohnungs-Artefakt auftauchen.\n`
      : "";

    const soulSummary = experience.soul
      ? `${experience.soul.label} - ${experience.soul.storyPromise}`
      : "Keine Story-Seele gewaehlt - waehle warmes, freundliches Grundgefuehl.";

    const flavorSummary = experience.emotionalFlavors.length
      ? experience.emotionalFlavors.map((flavor) => `- ${flavor.label}: ${flavor.effect}`).join("\n")
      : "- Natuerliche Emotionen ohne Zusatz - Fokus auf Herz und Neugier.";

    const tempoSummary = experience.tempo
      ? `${experience.tempo.label} - ${experience.tempo.description}`
      : `Standardtempo (${config.pacing ?? "balanced"}) - kombiniere ruhige und lebendige Momente.`;

    const ingredientSummary = experience.specialIngredients.length
      ? experience.specialIngredients
        .map((ingredient) => {
          const extras: string[] = [];
          if (ingredient.forcesTwist) {
            extras.push("Wende in Kapitel 4 vorbereiten und in Kapitel 5 aufloesen.");
          }
          if (ingredient.hookHint) {
            extras.push(`Nutze Plot-Hook "${ingredient.hookHint}".`);
          }
          if (ingredient.emphasis) {
            extras.push(ingredient.emphasis);
          }
          const extraText = extras.length ? ` (${extras.join(" ")})` : "";
          return `- ${ingredient.label}: ${ingredient.description}${extraText}`;
        })
        .join("\n")
      : "- Kein Spezial-Element - konzentriere dich auf Charakterentwicklung.";

    const flavorDetails = describeEmotionalFlavors(experience);
    const ingredientDetails = describeSpecialIngredients(experience);

    const hooksLine =
      config.hooks && config.hooks.length > 0 ? config.hooks.join(", ") : "keine speziellen Hooks";

    const styleInstructions = this.buildStyleInstructions(config, experience);

    const skeletonText = skeletonWithNames.chapters
      .map((chapter) => `Kapitel ${chapter.order}: ${chapter.content}`)
      .join("\n\n");

    const twistRequired = Boolean(config.hasTwist) || experience.specialIngredients.some((ingredient) => ingredient.forcesTwist);
    const twistGuidance = twistRequired
      ? "Baue eine sanfte Wende ab Kapitel 4 ein und loese sie Kapitel 5 warmherzig auf."
      : "Kein Pflicht-Twist - sorge trotzdem fuer einen emotionalen Hoehepunkt in Kapitel 4.";

    return `
Du bist eine meisterhafte Kinderbuch-Autorin. Schreibe eine vollstaendige, filmisch wirkende Geschichte, die wie ein preisgekroentes Bilderbuch wirkt.

HAUPTCHARAKTERE (Avatare):
${avatarDetailsText}
${inventorySection}
NEBENCHARAKTERE AUS DEM POOL:
${characterDetails}

STORY-SKELETT MIT NAMEN:
Titel: ${skeletonWithNames.title}

${skeletonText}

STORY EXPERIENCE (GUIDE):
- Story-Seele: ${soulSummary}
- Emotionale Wuerze:
${flavorSummary}
- Tempo: ${tempoSummary}
- Hooks: ${hooksLine}
- Besondere Zutaten:
${ingredientSummary}

DETAILLIERTE WUERZE:
${flavorDetails}

DETAILLIERTE ZUTATEN:
${ingredientDetails}

${styleInstructions}

?? KONFLIKT-PFLICHT (CRITICAL FOR 10/10 QUALITY):
Jede Geschichte braucht ein konkretes Problem das gelöst wird!
- VERBOTEN: Rein emotionale Reisen ohne äußere Handlung
- PFLICHT: 
  * Kapitel 1-2: Problem etablieren (Wolf taucht auf, Weg verloren, Hexe erscheint, Monster bedroht)
  * Kapitel 3-4: Konflikt eskaliert (Gefahr steigt, Hindernis wird größer, Spannung wächst)
  * Kapitel 5: Konkrete Lösung (Problem wird überwunden, Gefahr gebannt, Ziel erreicht)

?? STORY-MUSTER (wähle passend zum Skelett):
- QUEST: Charakter sucht etwas (Weg nach Hause, verlorener Schatz, Freund finden)
- KONFLIKT: Charakter vs Antagonist (Wolf, Hexe, Monster, Bully, Natur)
- HERAUSFORDERUNG: Charakter überwindet Hindernis (Angst, Rätsel, Prüfung, Aufgabe)
- RETTUNG: Charakter rettet jemanden (Freund gefangen, Gefahr droht, Hilfe nötig)

? VERMEIDE (führt zu niedrigen Qualitäts-Scores):
- Abstrakte Konzepte als Hauptplot ("vergessene Lieder", "verlorene Träume")
- Nur emotionale Entwicklung ohne externe Handlung
- Probleme die sich von selbst lösen (Deus ex machina)
- Zu philosophisch für Zielgruppe

? NUTZE (führt zu hohen Qualitäts-Scores):
- Konkrete Action-Verben: jagen, fangen, retten, entkommen, finden, besiegen, klettern, laufen
- Physische Herausforderungen: verstecken, kämpfen, suchen, bauen, überqueren
- Klare Stakes: Was passiert wenn sie verlieren? (Wolf fängt sie, Hexe sperrt ein, Freund bleibt verloren)

QUALITAETSREGELN:
- Dialog-Anteil: 40-50 % lebendige Dialoge (Kinderstimmen authentisch, Erwachsene freundlich).
- Sinneseindruecke: mind. drei Sinne pro Kapitel (sehen, hoeren, fuehlen, riechen, schmecken).
  WICHTIG: Vermeide Klischees! Statt "riecht nach Brot und Zimt" ? verwende spezifische, unerwartete Details.
  Beispiele: "riecht nach feuchter Erde und Honig", "schmeckt nach sauren Aepfeln", "klingt wie raschelndes Papier".
- Show, dont tell: Emotionen ueber Aktionen, Koerpersprache, Details vermitteln.
- Wiederkehrende Motive: Baue 2-3 Leitmotive (z. B. Licht, Symbol, Klang) an mehreren Stellen ein.
- Rhythmus: Wechsle zwischen Action, Humor und ruhigen Momenten; jede Szene treibt die Handlung voran.
- Charakterentwicklung: Zeige, wie die Avatare lernen, wachsen oder sich naeher kommen.
- Twist-Regel: ${twistGuidance}

KRITISCHE VERBOTE (QUALITY GATES):
? NIEMALS aeussere Merkmale im Story-Text beschreiben!
   - VERBOTEN: "kurze braune Haare", "gruene Augen", "helle Haut", "rote Jacke"
   - ERLAUBT: Nur Aktionen, Emotionen, Dialoge, Gedanken
   - Visuelle Details gehoeren AUSSCHLIESSLICH in imageDescription!
? KEINE generischen Sinneseindruecke!
   - VERBOTEN: "riecht nach Brot und Zimt", "schmeckt suess", "fuehlt sich weich an"
   - PFLICHT: Spezifische, ueberraschende Details die zur Szene passen

AUFGABE:
1. Schreibe jedes Kapitel mit EXAKT 310-330 Woertern, abwechslungsreiche Saetze, klare Abschnitte.
2. KRITISCH: Kapitel unter 310 Woertern werden ABGELEHNT und muessen nachgeneriert werden!
3. Charaktere durch HANDLUNG zeigen - KEINE Aussehen-Beschreibungen!
4. Lass Story-Seele, emotionale Wuerze, Tempo und Spezialzutaten deutlich spueren.
5. Wenn Spezialzutaten gewaehlt sind, setze sie konkret in Handlung und Szenen um.
6. Nutze sanfte Cliffhanger in Kapiteln 1-4 und eine warme, poetische Aufloesung in Kapitel 5.
7. Schenke dem Finale einen Lern- oder Herzensmoment, der das Versprechen der Story-Seele einloest.

OUTPUT (JSON):
{
  "title": "Vollstaendiger Titel der Geschichte",
  "description": "2-3 Saetze, die das Herz der Story beschreiben",
  "chapters": [
    {
      "order": 1,
      "title": "Kapitel-Titel",
      "content": "320-420 Woerter, reich an Dialogen, Sinneseindruecken und Emotionen.",
      "imageDescription": "STRICTLY ENGLISH: Detailed visual scene description. NO GERMAN! Describe physical actions, lighting, environment, and mood. Use 'wide shot' or 'close up'. Example: 'Wide shot of a magical forest with glowing mushrooms, Adrian (8yo boy) looking at a firefly.'"
    }
  ],
  "avatarDevelopments": [
    {
      "name": "Name des Avatars",
      "changedTraits": [
        {
          "trait": "knowledge" oder "knowledge.subcategory" (z.B. "knowledge.science", "knowledge.history"),
          "change": +2 bis +10 (positive Zahl),
          "description": "Konkreter Grund basierend auf Story-Ereignissen"
        },
        {
          "trait": "creativity" oder "courage" oder "empathy" etc.,
          "change": +1 bis +5,
          "description": "Was hat der Avatar gelernt oder erlebt?"
        }
      ]
    }
  ],
  "newArtifact": {
    "name": "Name des Artefakts (in Sprache: ${config.language || 'de'})",
    "description": "Kurze Beschreibung was es ist (in Sprache: ${config.language || 'de'})",
    "type": "TOOL | WEAPON | KNOWLEDGE | COMPANION",
    "storyEffect": "Was kann dieses Artefakt in zukuenftigen Geschichten bewirken? (in Sprache: ${config.language || 'de'})",
    "visualDescriptorKeywords": ["ENGLISH keyword 1", "ENGLISH keyword 2", "material", "color", "glow effect"]
  }
}

🎯 KRITISCH: avatarDevelopments ist MANDATORY!
- Jeder Avatar MUSS mindestens 2-4 Trait-Updates bekommen
- Verfügbare Traits: knowledge (+ subcategories), creativity, vocabulary, courage, curiosity, teamwork, empathy, persistence, logic
- Base traits max 100, knowledge subcategories max 1000
- Changes basieren auf KONKRETEN Story-Ereignissen
- Description erklärt präzise, was gelernt wurde

🎁 KRITISCH: newArtifact ist MANDATORY!
- Am Ende von Kapitel 5 MUSS der Held einen besonderen Gegenstand finden, erhalten oder entdecken
- Beschreibe diesen Gegenstand kurz im Story-Text
- name, description, storyEffect: In der Sprache ${config.language || 'de'}
- visualDescriptorKeywords: IMMER auf ENGLISCH (fuer Bildgenerierung)
- Beispiele: ["golden compass", "glowing blue core", "ancient runes", "floating particles"]
- type: TOOL (nuetzliches Werkzeug), WEAPON (magische Waffe), KNOWLEDGE (Buch/Schriftrolle), COMPANION (kleines Wesen)

IMAGE DESCRIPTION GUIDE (ENGLISH):
- Use expressive action verbs and clear subject placement.
- Mention all characters with consistent visual traits and outfits.
- Highlight lighting, mood, camera angle or perspective, and environment specifics.
- Include recurring motifs or signature items from the story.
- Art style: watercolor illustration, Axel Scheffler style, warm colours, child-friendly.

IMPORTANT LANGUAGE INSTRUCTION:
- Write the story content (title, description, chapters content) in the requested language: ${config.language || 'de'}.
- Write the imageDescription STRICTLY in ENGLISH.
- Write newArtifact.visualDescriptorKeywords STRICTLY in ENGLISH.
    `.trim();
  }

  private buildStyleInstructions(config: StoryConfig, experience: StoryExperienceContext): string {
    const parts: string[] = [];

    if (config.tone) {
      parts.push(`- Tonfall: ${config.tone}\n`);
    }

    if (config.language) {
      parts.push(`- Sprache: ${config.language}\n`);
    }

    if (config.pacing) {
      parts.push(`- Tempo: ${config.pacing}\n`);
    }

    if (config.stylePreset) {
      parts.push(`- Stil-Preset: ${config.stylePreset}\n`);
    }

    if (config.pov) {
      parts.push(`- Perspektive: ${config.pov}\n`);
    }

    if (config.allowRhymes) {
      parts.push("- Reime: sanfte Reimstrukturen sind erlaubt\n");
    }

    if (config.suspenseLevel !== undefined) {
      parts.push(`- Spannung: Level ${config.suspenseLevel}/3\n`);
    }

    if (config.humorLevel !== undefined) {
      parts.push(`- Humor: Level ${config.humorLevel}/3\n`);
    }

    if (config.hooks && config.hooks.length > 0) {
      parts.push(`- Plot-Hooks: ${config.hooks.join(", ")}\n`);
    }

    const soul = experience.soul;
    if (soul) {
      parts.push(`- Story-Seele Leitmotiv: ${soul.label} (Ton ${soul.recommendedTone}, Tempo ${soul.defaultPacing})\n`);
    }

    if (experience.emotionalFlavors.length) {
      const flavorLabels = experience.emotionalFlavors.map((flavor) => flavor.label).join(", ");
      parts.push(`- Emotionale Wuerze: ${flavorLabels}\n`);
    }

    if (experience.tempo) {
      parts.push(`- Nutzer-Tempo: ${experience.tempo.label} (${experience.tempo.pacing})\n`);
    }

    if (experience.specialIngredients.length) {
      const ingredientLabels = experience.specialIngredients.map((ingredient) => ingredient.label).join(", ");
      parts.push(`- Spezialzutaten: ${ingredientLabels}\n`);
    }

    return parts.length ? `STIL-ANWEISUNGEN:\n${parts.join("")}` : "";
  }

  /**
   * Validate final story structure
   */
  private validateFinalStory(story: any): void {
    if (!story.title || typeof story.title !== 'string') {
      throw new Error("Final story must have a title");
    }

    if (!story.description || typeof story.description !== 'string') {
      throw new Error("Final story must have a description");
    }

    if (!story.chapters || !Array.isArray(story.chapters)) {
      throw new Error("Final story must have chapters array");
    }

    if (story.chapters.length !== 5) {
      throw new Error(`Final story must have exactly 5 chapters, got ${story.chapters.length}`);
    }

    for (const chapter of story.chapters) {
      if (!chapter.order || !chapter.title || !chapter.content || !chapter.imageDescription) {
        throw new Error(`Chapter ${chapter.order} is missing required fields (order, title, content, imageDescription)`);
      }

      const wordCount = chapter.content.split(/\s+/).filter(Boolean).length;
      if (wordCount < 330) {
        throw new Error(`Chapter ${chapter.order} has only ${wordCount} words (minimum: 330). This chapter is REJECTED. Please regenerate with at least 330 words.`);
      }

      if (wordCount > 350) {
        throw new Error(`Chapter ${chapter.order} has ${wordCount} words (maximum: 350). This chapter is REJECTED. Please reduce to 330-350 words.`);
      }
      
      console.log(`[Phase3] ✅ Chapter ${chapter.order}: ${wordCount} words (target: 330-350)`);
    }

    // Validate newArtifact if present
    if (story.newArtifact) {
      if (!story.newArtifact.name || typeof story.newArtifact.name !== 'string') {
        console.warn("[Phase3] newArtifact missing valid name");
      }
      if (!story.newArtifact.description || typeof story.newArtifact.description !== 'string') {
        console.warn("[Phase3] newArtifact missing valid description");
      }
      if (!story.newArtifact.visualDescriptorKeywords || !Array.isArray(story.newArtifact.visualDescriptorKeywords)) {
        console.warn("[Phase3] newArtifact missing visualDescriptorKeywords array");
      }
      console.log("[Phase3] ✅ newArtifact validated:", story.newArtifact.name);
    } else {
      console.warn("[Phase3] ⚠️ No newArtifact in AI response - generating fallback artifact");
      // Generate a fallback artifact based on story theme
      story.newArtifact = this.generateFallbackArtifact(story);
    }

    console.log("[Phase3] Final story validated successfully");
  }

  /**
   * Generate a fallback artifact when AI doesn't provide one
   */
  private generateFallbackArtifact(_story: any): any {
    const types = ['TOOL', 'WEAPON', 'KNOWLEDGE', 'COMPANION'] as const;
    const randomType = types[Math.floor(Math.random() * types.length)];
    
    const artifacts = [
      { name: "Glücksbringer", desc: "Ein magischer Talisman", effect: "Bringt Glück in schwierigen Situationen", keywords: ["golden amulet", "glowing runes", "ancient charm", "magical pendant"] },
      { name: "Sternenstaub-Phiole", desc: "Eine Flasche voller Sternenstaub", effect: "Leuchtet in der Dunkelheit", keywords: ["glass vial", "sparkling stardust", "cosmic glow", "ethereal particles"] },
      { name: "Weisheitskristall", desc: "Ein Kristall voller alter Weisheit", effect: "Hilft bei schwierigen Entscheidungen", keywords: ["purple crystal", "ancient wisdom", "mystical glow", "floating runes"] },
      { name: "Freundschaftsband", desc: "Ein Band das Freunde verbindet", effect: "Stärkt die Verbindung zwischen Freunden", keywords: ["woven bracelet", "colorful threads", "magical bond", "friendship symbol"] },
      { name: "Mut-Amulett", desc: "Ein Amulett das Mut verleiht", effect: "Gibt Stärke in Momenten der Angst", keywords: ["lion pendant", "golden metal", "brave heart symbol", "radiant aura"] },
    ];
    
    const artifact = artifacts[Math.floor(Math.random() * artifacts.length)];
    
    console.log(`[Phase3] 🎁 Generated fallback artifact: ${artifact.name}`);
    
    return {
      name: artifact.name,
      description: artifact.desc,
      type: randomType,
      storyEffect: artifact.effect,
      visualDescriptorKeywords: artifact.keywords
    };
  }

  /**
   * Additional quality checks: avatars present, antagonist present, twist (if requested), encoding sanity
   */
  private validateStoryQuality(
    story: FinalizedStory,
    avatars: Array<{ name: string }>,
    fairyTale: SelectedFairyTale | null,
    twistRequired: boolean,
    _language?: string
  ) {
    console.log("[Phase3] 🛡️ Validating story quality (Logic v2 - Relaxed)");
    const text = story.chapters.map(ch => ch.content).join(" ").toLowerCase();

    // German conflict patterns
    const germanConflictPatterns = [
      /gefahr/, /bedroh/, /verfolg/, /flucht/, /kampf/, /duell/,
      /retten/, /rettung/, /falle/, /zauber/, /fluch/,
      /gefängnis/, /kerker/, /drache/, /wolf/, /hexe/, /monster/,
      /streit/, /konflikt/, /angriff/, /attacke/, /sturm/, /fluten/,
      /hindernis/, /problem/, /schwierig/, /rätsel/, /aufgabe/, /prüfung/,
      /angst/, /sorge/, /schreck/, /dunkel/, /schatten/, /verloren/,
      /blockiert/, /versperrt/, /suche/, /geheimnis/
    ];

    // English conflict patterns
    const englishConflictPatterns = [
      /danger/, /threat/, /chase/, /escape/, /fight/, /duel/,
      /rescue/, /saving/, /trap/, /magic/, /curse/, /spell/,
      /prison/, /dungeon/, /dragon/, /wolf/, /witch/, /monster/,
      /conflict/, /attack/, /storm/, /flood/, /peril/, /menace/,
      /struggle/, /battle/, /flee/, /hunt/, /capture/, /defend/,
      /obstacle/, /challenge/, /risk/, /fear/, /trouble/, /problem/
    ];

    // Russian conflict patterns (for ru language stories)
    const russianConflictPatterns = [
      /опасност/, /угроз/, /погон/, /побег/, /борьб/, /дуэл/,
      /спаса/, /спасен/, /ловушк/, /магия/, /закля/, /проклят/,
      /тюрьм/, /темниц/, /дракон/, /волк/, /ведьм/, /монстр/,
      /конфликт/, /атак/, /шторм/, /потоп/, /опасен/, /угрож/,
      /сраж/, /битв/, /бег/, /охот/, /захват/, /защит/,
      /препятств/, /вызов/, /риск/, /страх/, /беда/, /проблем/,
      /тайн/, /загадк/, /секрет/, /тень/, /тёмн/, /ночь/,
      /туман/, /шёпот/, /крик/, /помощ/, /храбр/, /смел/
    ];

    // French conflict patterns
    const frenchConflictPatterns = [
      /danger/, /menace/, /poursuite/, /fuite/, /combat/, /duel/,
      /sauver/, /sauvetage/, /piège/, /magie/, /malédiction/, /sort/,
      /prison/, /donjon/, /dragon/, /loup/, /sorcière/, /monstre/,
      /conflit/, /attaque/, /tempête/, /inondation/, /péril/,
      /lutte/, /bataille/, /fuir/, /chasse/, /capturer/, /défendre/,
      /obstacle/, /défi/, /risque/, /peur/, /problème/, /difficulté/
    ];

    // Use all language patterns for validation (stories might be in any language)
    const conflictPatterns = [
      ...germanConflictPatterns,
      ...englishConflictPatterns,
      ...russianConflictPatterns,
      ...frenchConflictPatterns
    ];
    const chapterConflicts = story.chapters.map((ch) => this.hasConflictSignal(ch.content, conflictPatterns));
    const conflictfulChapters = chapterConflicts.filter(Boolean).length;
    const requiredConflicts = fairyTale ? 2 : 3; // Relaxed from 5 to 2 for fairy tales

    if (conflictfulChapters < requiredConflicts) {
      const missingChapters = story.chapters
        .filter((_, idx) => !chapterConflicts[idx])
        .map((ch) => ch.order)
        .join(", ");

      // Just warn instead of failing, but log heavily
      console.warn(`[Phase3] ⚠️ Konfliktdichte grenzwertig: ${conflictfulChapters}/${story.chapters.length} Kapitel mit Hindernis. Fehlend: ${missingChapters}`);

      // Only fail if it's REALLY bad (0 conflicts)
      if (conflictfulChapters < 1) {
        console.warn(`[Phase3] ⚠️ Critical conflict shortage (${conflictfulChapters} chapters), but allowing to proceed to prevent user frustration.`);
        // throw new Error(`[Phase3] Konfliktdichte zu schwach: ${conflictfulChapters}/${story.chapters.length} Kapitel mit Hindernis. Fehlend: ${missingChapters}`);
      }
    }

    // Avatars must appear - check for both original name and transliterated/translated versions
    // Common name translations: German/English <-> Russian
    const nameVariants: Record<string, string[]> = {
      'alexander': ['alexander', 'александр', 'саша', 'алекс'],
      'adrian': ['adrian', 'адриан'],
      'anna': ['anna', 'анна', 'аня'],
      'maria': ['maria', 'мария', 'маша'],
      'max': ['max', 'макс', 'максим'],
      'paul': ['paul', 'павел', 'паша'],
      'peter': ['peter', 'пётр', 'петя'],
      'michael': ['michael', 'михаил', 'миша'],
      'sophie': ['sophie', 'софия', 'соня'],
      'emma': ['emma', 'эмма'],
      'leon': ['leon', 'леон', 'лев'],
      'felix': ['felix', 'феликс'],
      'lucas': ['lucas', 'лукас', 'лука'],
      'noah': ['noah', 'ной'],
      'elias': ['elias', 'илья'],
      'jonas': ['jonas', 'йонас'],
      'david': ['david', 'давид'],
      'niklas': ['niklas', 'никлас', 'николай', 'коля'],
      'tim': ['tim', 'тим', 'тимофей'],
      'tom': ['tom', 'том', 'тома'],
      'jan': ['jan', 'ян'],
      'lena': ['lena', 'лена', 'елена'],
      'lisa': ['lisa', 'лиза', 'елизавета'],
      'laura': ['laura', 'лаура'],
      'julia': ['julia', 'юлия', 'юля'],
      'sarah': ['sarah', 'сара'],
      'hannah': ['hannah', 'ханна', 'анна'],
      'emily': ['emily', 'эмили'],
      'mia': ['mia', 'мия'],
    };

    for (const av of avatars) {
      const nameLower = av.name.toLowerCase();
      const variants = nameVariants[nameLower] || [nameLower];
      const found = variants.some(variant => text.includes(variant.toLowerCase()));

      if (!found) {
        // Log warning but don't fail - the story might use a nickname or different spelling
        console.warn(`[Phase3] ⚠️ Avatar ${av.name} not found in story text (checked variants: ${variants.join(', ')})`);
        // Only fail if it's a very short/unique name that should definitely be present
        if (av.name.length >= 4 && variants.length === 1) {
          throw new Error(`[Phase3] Avatar ${av.name} not present in story text`);
        }
      }
    }

    // Antagonist presence (simple heuristics)
    // CRITICAL FIX: Relax antagonist check for fairy tales (they have various conflict types)
    // Support German, English, Russian, and French keywords
    const antagonistKeywords = [
      // German
      "antagonist", "gegner", "zauberer", "feind", "bedroh", "problem", "schwierig", "gefahr", "hindernis",
      // English
      "enemy", "villain", "foe", "threat", "danger", "obstacle", "problem", "difficult", "challenge",
      "wizard", "witch", "monster", "dragon", "troll", "giant", "evil", "wicked", "menace",
      // Russian
      "враг", "злодей", "угроза", "опасность", "препятствие", "проблема", "сложность", "вызов",
      "колдун", "ведьма", "монстр", "дракон", "тролль", "великан", "зло", "злой", "тень",
      "тайна", "загадка", "страх", "беда", "ночь", "туман", "шторм",
      // French
      "ennemi", "méchant", "menace", "danger", "obstacle", "problème", "difficulté", "défi",
      "sorcier", "sorcière", "monstre", "dragon", "troll", "géant", "mal", "maléfique"
    ];
    const lowerText = text.toLowerCase();
    const hasConflict = antagonistKeywords.some(k => lowerText.includes(k.toLowerCase()));

    if (!hasConflict) {
      console.warn(`[Phase3] ⚠️ Weak conflict detection - story may lack clear antagonist keywords (fairyTaleMode: ${fairyTale})`);
      // We do NOT throw here anymore, as it causes unnecessary failures for valid stories that just use different wording.
    }

    // Twist heuristic - support German, English, Russian, and French
    if (twistRequired) {
      const twistSignals = [
        // German
        "twist", "wendung", "ueberraschung", "überraschung", "plot twist",
        // English
        "surprise", "unexpected", "revelation", "secret", "discover",
        // Russian
        "поворот", "сюрприз", "неожиданно", "оказывается", "секрет", "открытие", "тайна",
        // French
        "surprise", "inattendu", "révélation", "secret", "découvrir"
      ];
      const structuralTwistPatterns = [
        // German
        /ploetzlich/,
        /plötzlich/,
        /unerwartet/,
        /auf einmal/,
        /doch dann/,
        /aber dann/,
        /stellt sich heraus/,
        /stellt sich raus/,
        /enthüllt/,
        /enthuellt/,
        /geheimnis/,
        /verwandelt sich/,
        // English
        /suddenly/,
        /unexpectedly/,
        /but then/,
        /however/,
        /turns out/,
        /revealed/,
        /discover/,
        /transform/,
        /realize/,
        /secret/,
        // Russian
        /вдруг/,
        /неожиданно/,
        /оказалось/,
        /оказывается/,
        /но потом/,
        /однако/,
        /выяснилось/,
        /открылось/,
        /секрет/,
        /превратился/,
        /понял/,
        // French
        /soudain/,
        /tout à coup/,
        /mais alors/,
        /cependant/,
        /révèle/,
        /découvre/,
        /transforme/,
      ];

      const hasTwistSignal = twistSignals.some((k) => text.includes(k));
      const hasStructuralTwist = structuralTwistPatterns.some((pattern) => pattern.test(text));

      if (!hasTwistSignal && !hasStructuralTwist) {
        const context = fairyTale
          ? "Fairy tale mode: allow soft pass, twist heuristics are unreliable for classic tales."
          : "No explicit twist signal found; heuristics may miss subtle reveals. Allowing story but logging warning.";
        console.warn(`[Phase3] Twist heuristic weak: ${context}`);
      }
    }

    // Simple overlap guard: title of fairy tale should not dominate chapter titles 1..5
    if (fairyTale) {
      const ft = fairyTale.tale.title.toLowerCase();
      const sameTitleCount = story.chapters.filter(ch => ch.title.toLowerCase().includes(ft)).length;
      if (sameTitleCount > 2) {
        throw new Error("[Phase3] Too many chapter titles mirror original fairy tale title");
      }
    }
  }

  private hasConflictSignal(text: string, patterns: RegExp[]): boolean {
    const normalized = text.toLowerCase();
    return patterns.some((pattern) => pattern.test(normalized));
  }

  /**
   * Build prompt using fairy tale template
   */
  private buildFairyTalePrompt(
    _skeletonWithNames: StorySkeleton, // Skeleton is used indirectly via chapter structure
    assignments: Map<string, CharacterTemplate>,
    config: StoryConfig,
    avatarDetails: Array<{ name: string; description?: string; visualProfile?: any }>,
    experience: StoryExperienceContext,
    fairyTale: SelectedFairyTale,
    remixInstructions?: string // NEW: Remix transformation summary from Phase1
  ): string {
    const characterDetails = Array.from(assignments.entries())
      .map(([placeholder, char]) => [
        `Character ${char.name} (${char.role})`,
        `- Placeholder: ${placeholder}`,
        `- Archetyp: ${char.archetype}`,
        `- Emotionale Natur: ${char.emotionalNature.dominant} (${char.emotionalNature.secondary.join(", ")})`,
        `- Visuelles Profil: ${char.visualProfile.description}`,
        `- Spezies: ${char.visualProfile.species}`,
        `- Farbpalette: ${char.visualProfile.colorPalette.join(", ")}`,
        `- Prompt (English): ${char.visualProfile.imagePrompt}`,
      ].join("\n"))
      .join("\n\n");

    // ===== NEW: Apply role transformations to avatar visual profiles =====
    const roleTransformations = FAIRY_TALE_ROLE_MAPPINGS[fairyTale.tale.id];

    const avatarDetailsText = avatarDetails
      .map((avatar, idx) => {
        let line = `- ${avatar.name}`;
        if (avatar.description) {
          line += `, ${avatar.description}`;
        }
        if (avatar.visualProfile) {
          // Apply transformation if role mapping exists for this avatar
          const avatarGender = avatar.visualProfile.gender || 'neutral';
          const protagonistTransformation = roleTransformations?.roles['{protagonist}']?.transformation;

          let visualDescription = this.visualProfileToText(avatar.visualProfile);

          // Transform avatar appearance for fairy tale role (e.g., human ? mermaid)
          if (protagonistTransformation && idx === 0) { // First avatar = protagonist
            visualDescription = applyRoleTransformation(
              visualDescription,
              avatarGender,
              protagonistTransformation
            );
            console.log(`[Phase3] ?? Transformed avatar ${avatar.name} visual profile:`);
            console.log(`[Phase3] Original: ${this.visualProfileToText(avatar.visualProfile)}`);
            console.log(`[Phase3] Transformed: ${visualDescription}`);
          }

          line += `, Aussehen: ${visualDescription}`;
        }
        return line;
      })
      .join("\n");

    // Map fairy tale roles to user avatars
    const roleMapping = this.mapAvatarsToFairyTaleRoles(
      fairyTale.roles,
      avatarDetails,
      assignments
    );

    const roleMappingText = roleMapping
      .map((mapping) => `- ${mapping.fairyTaleRole} ? ${mapping.avatarName} (${mapping.roleType})`)
      .join("\n");

    // ==================== SCENE-TO-CHAPTER MAPPING ====================
    // Map fairy tale scenes (6-9 scenes) to exactly 5 chapters
    const sceneChapterMapping = this.mapScenesToChapters(fairyTale.scenes);

    // ===== NEW: Get gender-adapted pronouns and role titles =====
    const protagonistAvatar = avatarDetails[0]; // First avatar is protagonist
    const protagonistGender = protagonistAvatar?.visualProfile?.gender || 'neutral';
    const adaptedPronouns = roleTransformations
      ? getAdaptedPronouns(roleTransformations.roles['{protagonist}'], protagonistGender)
      : {};
    const adaptedRoleTitle = roleTransformations
      ? getAdaptedRoleTitle(roleTransformations.roles['{protagonist}'], protagonistGender)
      : fairyTale.tale.title;

    console.log(`[Phase3] ?? Gender adaptation for ${protagonistAvatar.name} (${protagonistGender}):`);
    console.log(`[Phase3] Role title: ${fairyTale.tale.title} ? ${adaptedRoleTitle}`);
    console.log(`[Phase3] Pronouns: ${JSON.stringify(adaptedPronouns)}`);

    const chapterStructure = sceneChapterMapping
      .map((mapping: any, idx: number) => {
        const sceneDetails = mapping.scenes.map((s: any) => {
          // Replace gender placeholders in scene description
          let sceneDescription = s.sceneDescription || '';
          sceneDescription = sceneDescription.replace(/{protagonist_title}/g, adaptedRoleTitle);
          sceneDescription = sceneDescription.replace(/{protagonist_sie}/g, adaptedPronouns.sie || 'sie');
          sceneDescription = sceneDescription.replace(/{protagonist_sie_cap}/g, adaptedPronouns.sie_cap || 'Sie');
          sceneDescription = sceneDescription.replace(/{protagonist_ihr}/g, adaptedPronouns.ihr || 'ihr');
          sceneDescription = sceneDescription.replace(/{protagonist_ihre}/g, adaptedPronouns.ihre || 'ihre');
          sceneDescription = sceneDescription.replace(/{protagonist_name}/g, protagonistAvatar.name);

          return `  - Szene ${s.sceneNumber}: ${s.sceneTitle}\n` +
            `    Setting: ${s.setting}\n` +
            `    Stimmung: ${s.mood}\n` +
            `    Handlung: ${sceneDescription}\n` +
            `    Bild-Template: ${s.illustrationPromptTemplate}`;
        }).join('\n');

        return `KAPITEL ${idx + 1}: ${mapping.chapterTitle}\n${sceneDetails}`;
      })
      .join('\n\n');

    const styleInstructions = this.buildStyleInstructions(config, experience);

    // Determine target language name for the prompt
    const languageMap: Record<string, string> = {
      'de': 'German',
      'en': 'English',
      'ru': 'Russian',
      'fr': 'French',
      'es': 'Spanish',
      'it': 'Italian',
    };
    const targetLanguage = languageMap[config.language || 'de'] || 'German';

    // NEW v3.0: Generate professional quality rules in English (better AI understanding)
    // Now includes genre for style reference selection
    const professionalRules = generateCompleteRulesBlockEN(
      config.ageGroup || '6-8',
      targetLanguage,
      config.genre || 'fairy_tales'
    );

    return `
You are an award-winning children's book author. Your task: Write an ORIGINAL, new story inspired by "${fairyTale.tale.title}" - personalized with the user's avatars. NO 1:1 retelling; motifs may be recognized, but plot/twists/setpieces are new.

CRITICAL: Write all story content in ${targetLanguage}. Only imageDescription fields should be in English.

## ROLE CASTING (Fairy Tale → User Avatars):
${roleMappingText}

## CHARACTER DETAILS:
Main Characters (User Avatars):
${avatarDetailsText}

Supporting Characters (Character Pool):
${characterDetails}

## CRITICAL - CHARACTER INTEGRATION:
- ALL main characters (User Avatars) must play ACTIVE roles
- Each avatar must act in AT LEAST 3 of 5 chapters (not just observe!)
- Avatars must make their OWN decisions and solve problems
- Show INTERACTIONS between avatars (dialogues, cooperation, conflicts)
- Supporting characters assist, but avatars are the MAIN ACTORS
- AVOID: "Adrian stood by and watched" ❌
- BETTER: "Adrian stepped in and helped with his idea" ✅

## PLOT: INSPIRATION FROM "${fairyTale.tale.title}"
CRITICAL: Use scenes only as direction. You MAY reorder, mix, delete and add new conflicts/twists. Readers should recognize motifs, but the plot must be fresh.

${chapterStructure}

## CONFLICT REQUIREMENT & OBSTACLES:
- Every chapter needs a concrete obstacle (antagonist, trap, puzzle, moral dilemma, or physical danger)
- Chapters 1-2: Only tease danger, but make it palpable (wolf watches, witch casts curse, nature threatens)
- Chapter 3: Escalation with real risk (captivity, loss, impending defeat)
- Chapter 4: Active counterattack by avatars, clear conflict with consequences
- Chapter 5: Final confrontation + resolution, obstacle is overcome (not skipped!)
- Name antagonists or obstacles clearly and let them act ("The witch locks them up", "The fog swallows the path")
- No purely internal conflicts without external events

## MORAL LESSON: ${fairyTale.tale.moralLesson}

CRITICAL - IMPLEMENT THE MORAL:
- The moral MUST be demonstrated through ACTIONS, not just mentioned
- Show CONSEQUENCES when characters act wrongly
- The protagonist must LEARN and APPLY the lesson
- NO shortcuts or circumventions of the moral challenge
- Example: If moral = "Keep promises", then the protagonist MUST keep a promise (not negotiate around it!)

${styleInstructions}

${professionalRules}

## RECURRING MOTIFS - LEITMOTIF REQUIREMENTS
══════════════════════════════════════════════════════════════════════════════
CRITICAL: Choose 2-3 RECURRING MOTIFS that appear throughout the story:

1. SOUND MOTIF (must appear in 5 chapters):
   Examples: "nightingale's song", "wind chimes", "bell tower", "crackling fire"
   Chapter 1: Introduce subtly
   Chapter 2: Reinforce (appears again)
   Chapter 3: Threaten/challenge (motif in danger)
   Chapter 4: Transform/use (motif becomes important)
   Chapter 5: Resolution payoff (motif completes arc)

2. OBJECT MOTIF (must appear in 4 chapters):
   Examples: "silver thread", "golden key", "magic feather", "porcelain heart"
   Must be introduced Ch1, used Ch2, crucial Ch4, symbolic resolution Ch5

3. PHRASE MOTIF (must appear in 3 chapters, same exact phrase):
   Examples: "echte Stimme" (true voice), "das wahre Lied", "der richtige Weg"
   Character says it, then it becomes the moral lesson

MOTIF TRACKING VALIDATION:
✅ Each motif must appear EXACTLY as specified (count appearances!)
✅ Motifs must be woven naturally into narrative (not forced)
✅ At least ONE motif must connect to the story's moral lesson

EXAMPLE ("Der Silberfaden" story):
- Sound Motif: "Windspiele" (wind chimes) → appears 5x across all chapters ✅
- Object Motif: "Silberfaden" (silver thread) → introduced Ch1, used Ch2, crucial Ch4, symbolic Ch5 ✅
- Phrase Motif: "echte Stimme" (true voice) → Ch3, Ch5 ✅

## CINEMATIC IMAGE DESCRIPTIONS (ALWAYS in English, 80-120 words):
- Start with SHOT TYPE: "WIDE SHOT", "CLOSE-UP", "HERO SHOT", "DRAMATIC ANGLE"
- Character details: Insert avatar names and physical features
- LIGHTING: "golden hour", "dramatic shadows", "soft moonlight"
- COMPOSITION: Foreground, midground, background
- MOOD/ATMOSPHERE: Specific adjectives
- Style reference: "Watercolor illustration style, Axel Scheffler inspired"
- Example: "HERO SHOT of {avatarName} standing at forest edge. LIGHTING: Dramatic sunset. FOREGROUND: Dark twisted roots. MIDGROUND: {avatarName} in red cloak, determined expression. BACKGROUND: Misty forest. MOOD: Brave but cautious. Watercolor style."

## WRITING STYLE - SIMPLE RULES
══════════════════════════════════════════════════════════════════════════════
1. Mix SHORT (3-7 words) and MEDIUM (8-15 words) sentences.
2. Avoid starting 3+ sentences with the same word.
3. Use varied sentence starts.

## SHOW, DON'T TELL - CORE RULE
══════════════════════════════════════════════════════════════════════════════
SHOW emotions through BODY LANGUAGE, not words:
❌ "war ängstlich" → ✅ "Seine Hände zitterten"
❌ "war glücklich" → ✅ "Ein Lächeln breitete sich aus"

## STORY SOUL: ${(experience as any).storySoul || 'magische_entdeckung'}
${(experience as any).storySoul === 'wilder_ritt' ? '- Fast-paced action! Chases, puzzles, physical challenges' : ''}
${(experience as any).storySoul === 'herzenswaerme' ? '- Emotional moments, friendship, togetherness, warm feelings' : ''}
${(experience as any).storySoul === 'magische_entdeckung' ? '- Wonder, magic discoveries, fantastic elements' : ''}

## CHAPTER LENGTH: UNIFIED WORD TARGET
CRITICAL: ALL chapters must have EXACTLY 330-350 words!
- Chapter 1: 330-350 words
- Chapter 2: 330-350 words  
- Chapter 3: 330-350 words
- Chapter 4: 330-350 words
- Chapter 5: 330-350 words

TARGET: 340 words per chapter | MAXIMUM VARIANCE: 20 words total
DO NOT exceed 350 words. DO NOT go below 330 words.
CRITICAL: Chapters with fewer than 330 words will be IMMEDIATELY REJECTED AND REGENERATED!
IMPORTANT: Aim for 340 words to ensure you meet the 330-word minimum with safety margin.

${remixInstructions ? `
## ORIGINALITY ENFORCEMENT - CRITICAL!
══════════════════════════════════════════════════════════════════════════════

${remixInstructions}

VALIDATION: The story will be checked for originality!
- Maximum allowed overlap with "${fairyTale.tale.title}": 40%
- Avoid direct phrase copies from the original
- Structural similarity must stay under 80%

CRITICAL ORIGINALITY REQUIREMENTS:
- NO verbatim quotes or phrases from the original fairy tale
- INVENT your own dialogues - don't copy from template
- Solutions and turning points MUST differ from original
- Vary setting details (not exact same place/time)
- Character names from original may NOT be used (except user avatars)
- The story must be summarizable in 3 sentences WITHOUT mentioning the original

IMPORTANT: If you ignore remix strategies, the story will be rejected!
Creative deviations from the original are not only allowed, but REQUIRED!

` : ''}## POV (POINT OF VIEW) - SIMPLIFIED RULE
══════════════════════════════════════════════════════════════════════════════
BOTH avatars are MAIN CHARACTERS and should be ACTIVE in EVERY chapter.
Show their INTERACTIONS, DIALOGUES, and COOPERATION throughout.

RULE: Write from a NEUTRAL third-person perspective that follows BOTH characters.
Both ${avatarDetails[0]?.name || 'Avatar 1'} and ${avatarDetails[1]?.name || avatarDetails[0]?.name || 'Avatar 2'} 
should speak, act, and contribute in each chapter.

## OUTPUT FORMAT (JSON):
{
  "title": "SHORT TITLE (max 4 words, mysterious object/place - NOT '[Name] and the...')",
  "description": "A personalized version of ${fairyTale.tale.title} (in ${targetLanguage})",
  "chapters": [
    {
      "order": 1,
      "title": "Chapter title (in ${targetLanguage})",
      "content": "TARGET: 340 words (±10) - ABSOLUTE MINIMUM 330 words! in ${targetLanguage}. POV: ${avatarDetails[0]?.name || 'Primary Avatar'} ONLY. Cinematic narrative with SENTENCE RHYTHM (3 short, 1 medium pattern). Short sentences (3-7 words), sensory details, emotions shown through body language. Original plot (inspired, not copied). NO META-LABELS like 'Dialogues:', 'Senses:', etc.! CRITICAL: Count your words BEFORE submitting! Chapters under 330 words = INSTANT REJECTION!",
      "imageDescription": "CINEMATIC SHOT TYPE description in English. 80-120 words. Include avatar names, lighting, composition, mood, style reference."
    }
    // ... 4 more chapters
  ],
  "avatarDevelopments": [
    {
      "avatarName": "${avatarDetails.map(a => a.name).join(' or ')}",
      "updates": [
        {
          "trait": "knowledge" or "knowledge.subcategory" (e.g., "knowledge.fairytales", "knowledge.history"),
          "change": +2 to +10 (positive number for growth),
          "description": "Why did the avatar develop this trait? What did they learn or experience? (in ${targetLanguage})"
        },
        {
          "trait": "creativity" or "courage" or "empathy" etc.,
          "change": +1 to +5,
          "description": "Concrete reason based on the plot (in ${targetLanguage})"
        }
      ]
    }
  ]
}

## CRITICAL: avatarDevelopments is MANDATORY!
- Every avatar MUST get at least 2-4 trait updates
- Traits: knowledge (+ subcategories like .fairytales, .history), creativity, vocabulary, courage, curiosity, teamwork, empathy, persistence, logic
- Base traits (creativity, courage, etc.) max 100, knowledge subcategories max 1000
- Changes based on CONCRETE story events
- Description explains WHAT the avatar learned/experienced

## FINAL INSTRUCTION:
Write the complete personalized "${fairyTale.tale.title}" story with all 5 chapters AND avatarDevelopments NOW!
Remember: Story content in ${targetLanguage}, imageDescription in English, NO meta-labels in the text!
`;
  }

  /**
   * Map fairy tale scenes (6-9 scenes) to exactly 5 chapters
   * Distributes scenes evenly across chapters for optimal pacing
   */
  private mapScenesToChapters(scenes: Array<{
    sceneNumber: number;
    sceneTitle: string;
    sceneDescription: string;
    setting: string;
    mood: string;
    illustrationPromptTemplate: string;
  }>): Array<{
    chapterNumber: number;
    chapterTitle: string;
    scenes: Array<{
      sceneNumber: number;
      sceneTitle: string;
      sceneDescription: string;
      setting: string;
      mood: string;
      illustrationPromptTemplate: string;
    }>;
  }> {
    const totalScenes = scenes.length;
    const chapters = 5;

    // Calculate base scenes per chapter and remainder
    const baseScenesPerChapter = Math.floor(totalScenes / chapters);
    const remainder = totalScenes % chapters;

    const mapping: Array<{
      chapterNumber: number;
      chapterTitle: string;
      scenes: Array<{
        sceneNumber: number;
        sceneTitle: string;
        sceneDescription: string;
        setting: string;
        mood: string;
        illustrationPromptTemplate: string;
      }>;
    }> = [];

    let sceneIndex = 0;

    for (let chapterNum = 1; chapterNum <= chapters; chapterNum++) {
      // First chapters get +1 scene if there's remainder
      const scenesInThisChapter = baseScenesPerChapter + (chapterNum <= remainder ? 1 : 0);
      const chapterScenes = scenes.slice(sceneIndex, sceneIndex + scenesInThisChapter);

      // Chapter title from first scene
      const chapterTitle = chapterScenes[0]?.sceneTitle || `Kapitel ${chapterNum}`;

      mapping.push({
        chapterNumber: chapterNum,
        chapterTitle,
        scenes: chapterScenes,
      });

      sceneIndex += scenesInThisChapter;
    }

    return mapping;
  }

  /**
   * Map user avatars to fairy tale roles
   */
  private mapAvatarsToFairyTaleRoles(
    roles: Array<{ roleType: string; roleName: string; required: boolean }>,
    avatars: Array<{ name: string; description?: string }>,
    assignments: Map<string, CharacterTemplate>
  ): Array<{ fairyTaleRole: string; avatarName: string; roleType: string }> {
    const mapping: Array<{ fairyTaleRole: string; avatarName: string; roleType: string }> = [];

    // Prioritize required protagonist roles
    const protagonistRoles = roles.filter((r) => r.roleType === "protagonist" && r.required);
    const antagonistRoles = roles.filter((r) => r.roleType === "antagonist");
    const supportingRoles = roles.filter((r) => r.roleType === "supporting" || r.roleType === "helper");

    let avatarIndex = 0;

    // Map protagonists first
    for (const role of protagonistRoles) {
      if (avatarIndex < avatars.length) {
        mapping.push({
          fairyTaleRole: role.roleName,
          avatarName: avatars[avatarIndex].name,
          roleType: role.roleType,
        });
        avatarIndex++;
      }
    }

    // OPTIMIZATION v2.4: Avatar-Rollen-Schutz
    // KRITISCH: User-Avatare dürfen NIE Antagonisten werden!
    // Antagonisten kommen IMMER aus dem Character Pool
    for (const role of antagonistRoles) {
      // IMMER Character Pool für Antagonisten verwenden
      const poolCharacter = Array.from(assignments.values()).find((c) =>
        c.role === "antagonist" ||
        c.role === "obstacle" ||
        c.archetype?.includes("villain") ||
        c.archetype?.includes("trickster")
      );

      if (poolCharacter) {
        mapping.push({
          fairyTaleRole: role.roleName,
          avatarName: poolCharacter.name,
          roleType: role.roleType,
        });
        console.log(`[Phase3] ✅ Antagonist "${role.roleName}" mapped to pool character: ${poolCharacter.name} (NOT a user avatar)`);
      } else {
        console.warn(`[Phase3] ⚠️ No antagonist found in pool for role: ${role.roleName}`);
      }
      // WICHTIG: avatarIndex wird NICHT erhöht - Avatare werden übersprungen!
    }

    // Map supporting roles
    for (const role of supportingRoles) {
      if (avatarIndex < avatars.length) {
        mapping.push({
          fairyTaleRole: role.roleName,
          avatarName: avatars[avatarIndex].name,
          roleType: role.roleType,
        });
        avatarIndex++;
      } else {
        // Use character pool
        const poolCharacter = Array.from(assignments.values()).find(
          (c) => c.role === "supporting" || c.role === "guide" || c.role === "companion"
        );
        if (poolCharacter) {
          mapping.push({
            fairyTaleRole: role.roleName,
            avatarName: poolCharacter.name,
            roleType: role.roleType,
          });
        }
      }
    }

    return mapping;
  }
}







