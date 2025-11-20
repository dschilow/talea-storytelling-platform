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

const openAIKey = secret("OpenAIKey");

interface Phase3Input {
  skeleton: StorySkeleton;
  assignments: Map<string, CharacterTemplate>;
  config: StoryConfig;
  avatarDetails: Array<{
    name: string;
    description?: string;
    visualProfile?: any;
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
    if (isReasoningModel) {
      payload.reasoning_effort = "medium";
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

    // CRITICAL FIX: Increase timeout for fairy tale mode (more complex prompts)
    // Extended timeout for gpt-4o-mini which can be slow with reasoning
    const baseTimeout = isReasoningModel ? 120000 : 45000; // 2 minutes for reasoning models
    const requestTimeoutMs = selectedFairyTale ? baseTimeout * 1.5 : baseTimeout; // 3 minutes for fairy tales with reasoning
    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => abortController.abort(), requestTimeoutMs);

    console.log(`[Phase3] Using ${requestTimeoutMs}ms timeout (fairy tale mode: ${!!selectedFairyTale})`);

    try {
      const openAIRequest = { ...payload };
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openAIKey()}`,
        },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });

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

      const finalStory = JSON.parse(content) as FinalizedStory;

      // Validate structure
      this.validateFinalStory(finalStory);
      this.validateStoryQuality(finalStory, input.avatarDetails, selectedFairyTale, input.config.hasTwist ?? false);

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

          // Run validation
          const originalityReport = OriginalityValidator.validate(
            generatedStoryText,
            sourceTemplateText,
            {
              maxOverlapPercentage: 40,
              minPhraseLength: 4,
              maxDirectCopies: 3,
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
    avatarDetails: Array<{ name: string; description?: string; visualProfile?: any }>,
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
1. Schreibe jedes Kapitel mit 320-420 Woertern, abwechslungsreiche Saetze, klare Abschnitte.
2. Charaktere durch HANDLUNG zeigen - KEINE Aussehen-Beschreibungen!
3. Lass Story-Seele, emotionale Wuerze, Tempo und Spezialzutaten deutlich spueren.
4. Wenn Spezialzutaten gewaehlt sind, setze sie konkret in Handlung und Szenen um.
5. Nutze sanfte Cliffhanger in Kapiteln 1-4 und eine warme, poetische Aufloesung in Kapitel 5.
6. Schenke dem Finale einen Lern- oder Herzensmoment, der das Versprechen der Story-Seele einloest.

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
      "avatarName": "Name des Avatars",
      "updates": [
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
  ]
}

🎯 KRITISCH: avatarDevelopments ist MANDATORY!
- Jeder Avatar MUSS mindestens 2-4 Trait-Updates bekommen
- Verfügbare Traits: knowledge (+ subcategories), creativity, vocabulary, courage, curiosity, teamwork, empathy, persistence, logic
- Base traits max 100, knowledge subcategories max 1000
- Changes basieren auf KONKRETEN Story-Ereignissen
- Description erklärt präzise, was gelernt wurde

IMAGE DESCRIPTION GUIDE (ENGLISH):
- Use expressive action verbs and clear subject placement.
- Mention all characters with consistent visual traits and outfits.
- Highlight lighting, mood, camera angle or perspective, and environment specifics.
- Include recurring motifs or signature items from the story.
- Art style: watercolor illustration, Axel Scheffler style, warm colours, child-friendly.
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
      if (wordCount < 280) {
        console.warn(`[Phase3] Chapter ${chapter.order} word count is ${wordCount}, which is below target 320-420`);
      }

      if (wordCount > 460) {
        console.warn(`[Phase3] Chapter ${chapter.order} word count is ${wordCount}, which is above target 320-420`);
      }
    }

    console.log("[Phase3] Final story validated successfully");
  }

  /**
   * Additional quality checks: avatars present, antagonist present, twist (if requested), encoding sanity
   */
  private validateStoryQuality(
    story: FinalizedStory,
    avatars: Array<{ name: string }>,
    fairyTale: SelectedFairyTale | null,
    twistRequired: boolean
  ) {
    const text = story.chapters.map(ch => ch.content).join(" ").toLowerCase();
    const conflictPatterns = [
      /gefahr/, /bedroh/, /verfolg/, /flucht/, /kampf/, /duell/,
      /retten/, /rettung/, /falle/, /zauber/, /fluch/,
      /gefängnis/, /kerker/, /drache/, /wolf/, /hexe/, /monster/,
      /streit/, /konflikt/, /angriff/, /attacke/, /sturm/, /fluten/
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

      // Only fail if it's REALLY bad (less than 2 conflicts in a fairy tale)
      if (conflictfulChapters < 2) {
        throw new Error(`[Phase3] Konfliktdichte zu schwach: ${conflictfulChapters}/${story.chapters.length} Kapitel mit Hindernis. Fehlend: ${missingChapters}`);
      }
    }
    // Avatars must appear
    for (const av of avatars) {
      if (!text.includes(av.name.toLowerCase())) {
        throw new Error(`[Phase3] Avatar ${av.name} not present in story text`);
      }
    }

    // Antagonist presence (simple heuristics)
    // CRITICAL FIX: Relax antagonist check for fairy tales (they have various conflict types)
    const antagonistKeywords = ["antagonist", "gegner", "zauberer", "feind", "bedroh", "problem", "schwierig", "gefahr", "hindernis"];
    const hasConflict = antagonistKeywords.some(k => text.includes(k));
    if (!hasConflict && !fairyTale) {
      throw new Error("[Phase3] No antagonist/conflict presence detected in story text");
    } else if (!hasConflict) {
      console.warn("[Phase3] Weak conflict detection in fairy tale mode - may lack clear antagonist");
    }

    // Twist heuristic
    if (twistRequired) {
      const twistSignals = ["twist", "wendung", "ueberraschung", "überraschung", "plot twist"];
      const structuralTwistPatterns = [
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
        /reveal/,
        /geheimnis/,
        /verwandelt sich/,
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
    skeletonWithNames: StorySkeleton,
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

    // Build scene structure from fairy tale
    const sceneStructure = fairyTale.scenes
      .map((scene) => {
        let sceneText = `Szene ${scene.sceneNumber}: ${scene.sceneTitle}\n`;
        sceneText += `Stimmung: ${scene.mood}, Setting: ${scene.setting}\n`;
        sceneText += `Beschreibung: ${scene.sceneDescription}\n`;
        return sceneText;
      })
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

    return `
Du bist ein preisgekrönter Kinderbuch-Autor. Deine Aufgabe: Schreibe eine EIGENE, neue Geschichte, inspiriert von "${fairyTale.tale.title}" - personalisiert mit den Avataren des Benutzers. KEINE 1:1-Nacherzaehlung; Motive duerfen erkannt werden, aber Plot/Twist/Setpieces sind neu.

?? ROLLEN-BESETZUNG (Märchen ? Benutzer-Avatare):
${roleMappingText}

?? CHARAKTER-DETAILS:
Hauptcharaktere (User-Avatare):
${avatarDetailsText}

Nebencharaktere (Character Pool):
${characterDetails}

🎯 KRITISCH - CHARAKTER-INTEGRATION:
- ALLE Hauptcharaktere (User-Avatare) müssen AKTIVE Rollen spielen
- Jeder Avatar muss in MINDESTENS 3 von 5 Kapiteln aktiv handeln (nicht nur beobachten!)
- Avatare müssen EIGENE Entscheidungen treffen und Probleme lösen
- Zeige INTERAKTIONEN zwischen den Avataren (Dialoge, Zusammenarbeit, Konflikte)
- Nebencharaktere unterstützen, aber Avatare sind die HAUPTAKTEURE
- Vermeide: "Adrian stand dabei und schaute zu" ❌
- Besser: "Adrian griff ein und half mit seiner Idee" ✅

?? HANDLUNG: INSPIRATIONS-PLOT AUS "${fairyTale.tale.title}"
?? KRITISCH: Nutze die Szenen nur als Richtungsgeber. Du darfst umordnen, mischen, streichen und neue Konflikte/Twists einbauen. Leser sollen Motive erkennen, aber die Handlung muss frisch sein.

${chapterStructure}

?? KONFLIKT-PFLICHT & HINDERNISSE:
- Jedes Kapitel braucht ein konkretes Hindernis (Antagonist, Falle, Rätsel, moralisches Dilemma oder physische Gefahr).
- Kapitel 1-2: Gefahr nur anteasern, aber spürbar machen (Wolf beobachtet, Hexe wirft Fluch, Natur droht).
- Kapitel 3: Eskalation mit echtem Risiko (Gefangenschaft, Verlust, drohende Niederlage).
- Kapitel 4: Aktiver Gegenschlag der Avatare, klarer Konflikt mit Konsequenzen.
- Kapitel 5: Finale Konfrontation + Lösung, Hindernis wird überwunden (nicht übersprungen!).
- Benenne Antagonist*innen oder Hindernisse klar und lasse sie handeln ("Die Hexe sperrt sie ein", "Der Nebel verschlingt den Pfad").
- Keine rein inneren Konflikte ohne äußeres Ereignis.

?? MORALISCHE LEKTION: ${fairyTale.tale.moralLesson}

🎯 KRITISCH - MORAL UMSETZEN:
- Die Moral MUSS durch HANDLUNGEN demonstriert werden, nicht nur erwähnt
- Zeige KONSEQUENZEN wenn Charaktere falsch handeln
- Der Protagonist muss die Lektion LERNEN und ANWENDEN
- KEINE Abkürzungen oder Umgehungen der moralischen Herausforderung
- Beispiel: Wenn Moral = "Halte Versprechen", dann MUSS der Protagonist ein Versprechen halten (nicht umhandeln!)

${styleInstructions}

?? PROFESSIONAL STORYTELLING RULES:

0?? **MORALISCHE INTEGRITÄT**: Die moralische Lektion muss klar und konsequent umgesetzt werden.
   - Protagonist muss die Lektion durch eigene Erfahrung lernen
   - Zeige negative Folgen bei Fehlverhalten
   - Zeige positive Folgen bei richtigem Verhalten
   - KEINE moralischen Abkürzungen oder "Schlupflöcher"

1?? **FLEXIBLES PLOT-GERUEST**: Nutze die Szenen-Zuordnung als Vorschlag. Du DARFST Szenen mischen, streichen oder zusammenlegen, solange Tempo und Konflikt pro Kapitel klar sind.
   - Kapitel 1-2: Ausgangslage + Problem aufbauen (passende Szenen mischen)
   - Kapitel 3: Eskalation/Finte (eigener Dreh erlaubt)
   - Kapitel 4: Twist oder Wendepunkt (darf vom Original abweichen)
   - Kapitel 5: Aufloesung mit frischem Ende (kein Copy-Paste aus Vorlage)

2?? **IKONISCHE MOMENTE**: Hebe 2-3 erkennbare Motive aus "${fairyTale.tale.title}" hervor, aber erfinde neue Setpieces und Outcomes. Wiedererkennung ja, Kopie nein.

3?? **FILMISCHE SPRACHE** (Altersgruppe: ${config.ageGroup}):
   - 40% kurze Sätze (3-7 Wörter): "Der Wald war dunkel."
   - 40% mittlere Sätze (8-15 Wörter): "Alexander hörte ein Knacken zwischen den Bäumen."
   - 20% lange Sätze (16-25 Wörter): "Mit klopfendem Herzen schlich er näher, die Augen weit aufgerissen vor Angst und Neugier."
   
4?? **SENSORISCHE DETAILS** (3+ pro Kapitel):
   - Sehen: Farben, Bewegungen, Licht/Schatten
   - Hören: Geräusche, Stimmen, Stille
   - Fühlen: Texturen, Temperatur, körperliche Empfindungen
   - Riechen/Schmecken: Düfte, Geschmack
   
5?? **EMOTIONALE TIEFE**:
   - Zeige Gefühle durch Körpersprache: "Ihre Hände zitterten", "Sein Atem stockte"
   - Nutze konkrete Details statt abstrakter Konzepte
   - Vermeide: "Sie fühlte Angst" ?
   - Nutze: "Ihr Herz raste wie ein gehetztes Kaninchen" ?

6?? **DIALOGE** (2-3 pro Kapitel):
   - Kurz, natürlich, charakterspezifisch
   - Mit Begleitsätzen: "flüsterte", "rief", "fragte atemlos"
   
7?? **CINEMATIC IMAGE DESCRIPTIONS** (English, 80-120 words):
   - Start with SHOT TYPE: "WIDE SHOT", "CLOSE-UP", "HERO SHOT", "DRAMATIC ANGLE"
   - Character details: Insert avatar names and physical features
   - LIGHTING: "golden hour", "dramatic shadows", "soft moonlight"
   - COMPOSITION: Foreground, midground, background
   - MOOD/ATMOSPHERE: Specific adjectives
   - Style reference: "Watercolor illustration style, Axel Scheffler inspired"
   - Example: "HERO SHOT of {avatarName} standing at forest edge. LIGHTING: Dramatic sunset backlighting creates silhouette. FOREGROUND: Dark twisted tree roots. MIDGROUND: {avatarName} in red cloak, determined expression. BACKGROUND: Misty forest fading into darkness. MOOD: Brave but cautious. Watercolor style, rich shadows, warm-cool contrast."

8?? **STORY SOUL**: ${(experience as any).storySoul || 'magische_entdeckung'}
   ${(experience as any).storySoul === 'wilder_ritt' ? '- Temporeiche Action! Verfolgungsjagden, Rätsel, physische Herausforderungen' : ''}
   ${(experience as any).storySoul === 'herzenswaerme' ? '- Emotionale Momente, Freundschaft, Zusammenhalt, warme Gefühle' : ''}
   ${(experience as any).storySoul === 'magische_entdeckung' ? '- Staunen, Wunder, magische Entdeckungen, fantastische Elemente' : ''}

9?? **KAPITEL-LÄNGE**: 380-450 Wörter pro Kapitel
   - Genug Details für immersive Erfahrung
   - Nicht zu lang für junge Leser

?? PLOT-KOMBINATION: Verwende Story-Skelett + Maerchen-Szenen als Ideenkatalog. Original dient nur als Leitstern; neu erfundene Konflikte/Twists sind erwuenscht. Erhalte Tempo (5 Kapitel) und Genre, aber schreibe eine neue Abfolge.

${remixInstructions ? `
?? ═══════════════════════════════════════════════════════════════
   ORIGINALITY ENFORCEMENT - KRITISCH WICHTIG!
═══════════════════════════════════════════════════════════════

${remixInstructions}

?? VALIDATION: Die Geschichte wird auf Originalität geprüft!
- Maximale erlaubte Überlappung mit "${fairyTale.tale.title}": 40%
- Vermeide direkte Phrasen-Kopien aus dem Original
- Strukturelle Ähnlichkeit muss unter 80% bleiben

🚨 KRITISCH: ORIGINALITÄTS-ANFORDERUNGEN
- KEINE wörtlichen Zitate oder Phrasen aus dem Original-Märchen
- EIGENE Dialoge erfinden - nicht aus Vorlage kopieren
- Lösungen und Wendepunkte MÜSSEN anders sein als im Original
- Setting-Details variieren (nicht exakt gleicher Ort/Zeit)
- Charakternamen aus dem Original dürfen NICHT verwendet werden (außer User-Avatare)
- Die Geschichte muss in 3 Sätzen zusammenfassbar sein, OHNE das Original-Märchen zu nennen

WICHTIG: Wenn du die Remix-Strategien ignorierst, wird die Geschichte abgelehnt!
Kreative Abweichungen vom Original sind nicht nur erlaubt, sondern GEFORDERT!

` : ''}?? AUSGABE-FORMAT (JSON):
{
  "title": "[Avatar-Namen] und das [Märchen-Thema]",
  "description": "Eine personalisierte Version von ${fairyTale.tale.title}",
  "chapters": [
    {
      "order": 1,
      "title": "[Basierend auf Szenen-Titel]",
      "content": "380-450 Woerter. Filmische Erzaehlung mit kurzen Saetzen, sensorischen Details, Emotionen. Eigenstaendige Handlung (inspiriert, nicht kopiert).",
      "imageDescription": "CINEMATIC SHOT TYPE description in English. 80-120 words. Include avatar names, lighting, composition, mood, style reference."
    }
    // ... 4 weitere Kapitel
  ],
  "avatarDevelopments": [
    {
      "avatarName": "${avatarDetails.map(a => a.name).join(' oder ')}",
      "updates": [
        {
          "trait": "knowledge" oder "knowledge.subcategory" (z.B. "knowledge.fairytales", "knowledge.history"),
          "change": +2 bis +10 (positive Zahl für Wachstum),
          "description": "Warum hat der Avatar dieses Trait entwickelt? Was hat er gelernt oder erlebt?"
        },
        {
          "trait": "creativity" oder "courage" oder "empathy" etc.,
          "change": +1 bis +5,
          "description": "Konkrete Begründung basierend auf der Handlung"
        }
      ]
    }
  ]
}

🎯 KRITISCH: avatarDevelopments ist MANDATORY!
- Jeder Avatar MUSS mindestens 2-4 Trait-Updates bekommen
- Traits: knowledge (+ subcategories like .fairytales, .history), creativity, vocabulary, courage, curiosity, teamwork, empathy, persistence, logic
- Base traits (creativity, courage, etc.) max 100, knowledge subcategories max 1000
- Changes basieren auf KONKRETEN Story-Ereignissen
- Description erklärt WAS der Avatar gelernt/erlebt hat
- Beispiel: Avatar löst Rätsel → logic +3, "Hat durch das Lösen des Frosch-Rätsels logisches Denken trainiert"

? SCHREIBE JETZT: Die vollständige personalisierte ${fairyTale.tale.title}-Geschichte mit allen 5 Kapiteln UND avatarDevelopments!
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








