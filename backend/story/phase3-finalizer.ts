// Phase 3: Story Finalizer with Character Injection
// Writes complete story with matched characters
// Token Budget: ~2,000 tokens

import { secret } from "encore.dev/config";
import type { StoryConfig } from "./generate";
import type { StorySkeleton, CharacterTemplate, FinalizedStory } from "./types";

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

export class Phase3StoryFinalizer {
  async finalize(input: Phase3Input): Promise<FinalizedStory> {
    console.log("[Phase3] Finalizing story with character injection...");

    // Step 1: Replace placeholders with actual character names
    const skeletonWithNames = this.injectCharacterNames(input.skeleton, input.assignments);

    // Step 2: Build finalization prompt with character details
    const prompt = this.buildFinalizationPrompt(skeletonWithNames, input.assignments, input.config, input.avatarDetails);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openAIKey()}`,
        },
        body: JSON.stringify({
          model: input.config.aiModel || "gpt-5-mini",
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
          max_completion_tokens: 3500,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as OpenAIResponse;
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("No content in Phase 3 response");
      }

      const finalStory = JSON.parse(content) as FinalizedStory;

      // Validate structure
      this.validateFinalStory(finalStory);

      console.log("[Phase3] Story finalized successfully:", {
        title: finalStory.title,
        chaptersCount: finalStory.chapters?.length,
      });

      return finalStory;
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
      const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
      result = result.replace(regex, character.name);
    }

    return result;
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
    avatarDetails: Array<{ name: string; description?: string; visualProfile?: any }>
  ): string {
    // Build character details block
    const characterDetails = Array.from(assignments.entries())
      .map(([placeholder, char]) => `
**${char.name}** (${char.role}):
- Rolle: ${char.archetype}
- Emotionale Natur: ${char.emotionalNature.dominant} (${char.emotionalNature.secondary.join(", ")})
- Aussehen: ${char.visualProfile.description}
- Spezies: ${char.visualProfile.species}
- Farben: ${char.visualProfile.colorPalette.join(", ")}
- Bild-Prompt (English): "${char.visualProfile.imagePrompt}"
      `).join("\n");

    // Build avatar details with converted visual profiles
    const avatarDetailsText = avatarDetails.map(a => {
      let line = `- ${a.name}`;
      if (a.description) line += `, ${a.description}`;
      if (a.visualProfile) {
        const visualDesc = this.visualProfileToText(a.visualProfile);
        line += `, Aussehen: ${visualDesc}`;
      }
      return line;
    }).join("\n");

    // Build style instructions based on config
    const styleInstructions = this.buildStyleInstructions(config);

    const skeletonText = skeletonWithNames.chapters.map(ch =>
      `**Kapitel ${ch.order}:**\n${ch.content}`
    ).join("\n\n");

    return `
Du bist eine professionelle Kinderbuch-Autorin.

HAUPTCHARAKTERE (Avatare):
${avatarDetailsText}

NEBENCHARAKTERE (Bereits zugewiesen):
${characterDetails}

STORY-SKELETT (mit Charakter-Namen):
Titel: ${skeletonWithNames.title}

${skeletonText}

STORY-KONFIGURATION:
- Genre: ${config.genre}
- Setting: ${config.setting}
- Altersgruppe: ${config.ageGroup}
- Komplexität: ${config.complexity}
- Länge: ${config.length}

${styleInstructions}

WICHTIGE AUFGABE:
1. Schreibe eine VOLLSTÄNDIGE, LEBENDIGE Geschichte basierend auf dem Skelett
2. Nutze EXAKT die Charakter-Namen und Beschreibungen oben
3. Integriere visuelle Details der Charaktere natürlich in den Text
4. Jedes Kapitel sollte 300-400 Wörter haben
5. Die Geschichte soll engagierend, spannend und altersgerecht sein
6. Generiere für jedes Kapitel eine detaillierte imageDescription (AUF ENGLISCH!)
7. Die imageDescriptions müssen alle Charaktere beschreiben, die in der Szene sind
8. Verwende die visuellen Details der Charaktere in den imageDescriptions
9. Behalte die Charaktere konsistent über alle Kapitel hinweg

OUTPUT FORMAT (JSON):
{
  "title": "Vollständiger Titel der Geschichte",
  "description": "Kurze Zusammenfassung der Geschichte (2-3 Sätze)",
  "chapters": [
    {
      "order": 1,
      "title": "Kapitel-Titel",
      "content": "Vollständiger Text (300-400 Worte) mit allen Charakteren lebendig beschrieben",
      "imageDescription": "Detailed English description for image generation. Include all characters present with their visual details: [character name] ([age], [appearance details]), setting details, mood, lighting, art style: watercolor illustration in Axel Scheffler style"
    }
  ]
}

WICHTIG für imageDescription:
- Immer auf Englisch!
- Alle sichtbaren Charaktere mit visuellen Details beschreiben
- Setting und Stimmung beschreiben
- Art style angeben: "watercolor illustration, Axel Scheffler style, warm colors, child-friendly"
- Hauptcharaktere (Avatare) konsistent über alle Bilder beschreiben
- Nebencharaktere mit ihren charakteristischen Features beschreiben
`;
  }

  private buildStyleInstructions(config: StoryConfig): string {
    let instructions = "";

    if (config.tone) {
      instructions += `- Tonfall: ${config.tone}\n`;
    }

    if (config.language) {
      instructions += `- Sprache: ${config.language}\n`;
    }

    if (config.pacing) {
      instructions += `- Tempo: ${config.pacing}\n`;
    }

    if (config.pov) {
      instructions += `- Perspektive: ${config.pov}\n`;
    }

    if (config.allowRhymes) {
      instructions += `- Reime erlaubt: Ja, verwende gelegentlich Reime\n`;
    }

    if (config.suspenseLevel !== undefined) {
      instructions += `- Spannungslevel: ${config.suspenseLevel}/3\n`;
    }

    if (config.humorLevel !== undefined) {
      instructions += `- Humor-Level: ${config.humorLevel}/3\n`;
    }

    if (config.hasTwist) {
      instructions += `- Twist: Ja, baue eine überraschende Wendung ein\n`;
    }

    if (config.hooks && config.hooks.length > 0) {
      instructions += `- Plot-Hooks: ${config.hooks.join(", ")}\n`;
    }

    return instructions ? `STIL-ANWEISUNGEN:\n${instructions}` : "";
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

      const wordCount = chapter.content.split(/\s+/).length;
      if (wordCount < 200) {
        console.warn(`[Phase3] Chapter ${chapter.order} word count is ${wordCount}, which is below target 300-400`);
      }

      if (wordCount > 500) {
        console.warn(`[Phase3] Chapter ${chapter.order} word count is ${wordCount}, which is above target 300-400`);
      }
    }

    console.log("[Phase3] Final story validated successfully");
  }
}
