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
}

export class Phase3StoryFinalizer {
  async finalize(input: Phase3Input): Promise<Phase3FinalizationResult> {
    console.log("[Phase3] Finalizing story with character injection...");

    // Step 1: Replace placeholders with actual character names
    const skeletonWithNames = this.injectCharacterNames(input.skeleton, input.assignments);

    // Step 2: Build finalization prompt with character details
    const prompt = this.buildFinalizationPrompt(
      skeletonWithNames,
      input.assignments,
      input.config,
      input.avatarDetails,
      input.experience
    );
    const modelName = input.config.aiModel || "gpt-5-mini";

    // Check if this is a reasoning model (gpt-5, o4-mini, etc.)
    const isReasoningModel = modelName.includes("gpt-5") || modelName.includes("o4");

    const payload: any = {
      model: modelName,
      messages: [
        {
          role: "system",
          content: "Du bist eine professionelle Kinderbuch-Autorin, die vollständige, lebendige Geschichten mit etablierten Charakteren schreibt."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: isReasoningModel ? 16000 : 5000,
    };

    // Add reasoning_effort for reasoning models
    if (isReasoningModel) {
      payload.reasoning_effort = "medium";
    }

    try {
      const openAIRequest = { ...payload };
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openAIKey()}`,
        },
        body: JSON.stringify(payload),
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

      return {
        story: finalStory,
        usage,
        openAIRequest,
        openAIResponse: data,
      };
    } catch (error) {
      console.error("[Phase3] Error finalizing story:", error);
      throw error;
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
    let result = text;

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
   * Convert structured visual profile to text description
   */
  private visualProfileToText(vp: any): string {
    if (!vp) return 'Keine visuelle Beschreibung verfügbar';

    const parts: string[] = [];

    if (vp.ageApprox) parts.push(`${vp.ageApprox} Jahre alt`);
    if (vp.gender) parts.push(vp.gender);

    if (vp.hair) {
      const hairParts = [];
      if (vp.hair.color) hairParts.push(vp.hair.color);
      if (vp.hair.length) hairParts.push(vp.hair.length);
      if (vp.hair.type) hairParts.push(vp.hair.type);
      if (vp.hair.style) hairParts.push(vp.hair.style);
      if (hairParts.length > 0) parts.push(`Haare: ${hairParts.join(', ')}`);
    }

    if (vp.eyes?.color) parts.push(`${vp.eyes.color} Augen`);

    if (vp.skin?.tone) parts.push(`Hautton: ${vp.skin.tone}`);

    if (vp.clothingCanonical) {
      const clothingParts = [];
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

  /**
   * Build comprehensive finalization prompt
   */
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

QUALITAETSREGELN:
- Dialog-Anteil: 40-50 % lebendige Dialoge (Kinderstimmen authentisch, Erwachsene freundlich).
- Sinneseindruecke: mind. drei Sinne pro Kapitel (sehen, hoeren, fuehlen, riechen, schmecken).
- Show, dont tell: Emotionen ueber Aktionen, Koerpersprache, Details vermitteln.
- Wiederkehrende Motive: Baue 2-3 Leitmotive (z. B. Licht, Symbol, Klang) an mehreren Stellen ein.
- Rhythmus: Wechsle zwischen Action, Humor und ruhigen Momenten; jede Szene treibt die Handlung voran.
- Charakterentwicklung: Zeige, wie die Avatare lernen, wachsen oder sich naeher kommen.
- Twist-Regel: ${twistGuidance}

AUFGABE:
1. Schreibe jedes Kapitel mit 320-420 Woertern, abwechslungsreiche Saetze, klare Abschnitte.
2. Integriere alle Charakterdetails organisch und halte sie ueber die ganze Geschichte konsistent.
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
      "imageDescription": "Detailed English scene description with action verbs, consistent character traits, lighting, mood, camera perspective, environment specifics, recurring motifs. Art style: watercolor illustration, Axel Scheffler style, warm colours, child-friendly."
    }
  ]
}

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
}


