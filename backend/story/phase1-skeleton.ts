// Phase 1: Story Skeleton Generator
// Generates story structure with character ROLES (no names, no visuals)
// Token Budget: ~1,500 tokens

import { secret } from "encore.dev/config";
import type { StoryConfig } from "./generate";
import type { StorySkeleton } from "./types";

const openAIKey = secret("OpenAIKey");

interface Phase1Input {
  config: StoryConfig;
  avatarDetails: Array<{
    name: string;
    description?: string;
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

export class Phase1SkeletonGenerator {
  async generate(input: Phase1Input): Promise<StorySkeleton> {
    console.log("[Phase1] Generating story skeleton...");

    const prompt = this.buildSkeletonPrompt(input);

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
              content: "Du bist eine professionelle Kinderbuch-Autorin, die Story-Strukturen mit generischen Charakter-Platzhaltern erstellt."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 2000,
        }),
      });

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

      // Validate structure
      this.validateSkeletonStructure(skeleton);

      console.log("[Phase1] Skeleton generated successfully:", {
        title: skeleton.title,
        chaptersCount: skeleton.chapters?.length,
        requirementsCount: skeleton.supportingCharacterRequirements?.length,
      });

      return skeleton;
    } catch (error) {
      console.error("[Phase1] Error generating skeleton:", error);
      throw error;
    }
  }

  private buildSkeletonPrompt(input: Phase1Input): string {
    const { config, avatarDetails } = input;

    const avatarNames = avatarDetails.map(a => a.name).join(", ");
    const customDesc = config.customPrompt ? `\nCUSTOM DETAILS: ${config.customPrompt}` : "";

    return `
Du bist eine professionelle Kinderbuch-Autorin.

HAUPTCHARAKTERE: ${avatarNames}
SETTING: ${config.setting}
GENRE: ${config.genre}
ALTERSGRUPPE: ${config.ageGroup}
KOMPLEXITÄT: ${config.complexity}
LÄNGE: ${config.length}${customDesc}

WICHTIGE AUFGABE:
1. Generiere eine Story-STRUKTUR für 5 Kapitel
2. SEHR WICHTIG: Verwende NUR {{PLACEHOLDER}} für Nebencharaktere, KEINE Namen!
3. Gib für jeden Placeholder genaue Rollen und Archetypen an
4. KEINE visuellen Beschreibungen! Nur Rollen und emotionale Natur
5. Die Story soll lebendig und engagierend sein

PLACEHOLDER-FORMAT:
- {{WISE_ELDER}} für weise ältere Person als Mentor
- {{ANIMAL_HELPER}} für treues Tier als Begleiter
- {{MAGICAL_CREATURE}} für magisches Wesen
- {{FRIENDLY_VILLAGER}} für hilfsbereite Dorfbewohner
- {{OBSTACLE_CHARACTER}} für Herausforderung/Hindernis
- Verwende beschreibende Namen für die Rolle!

OUTPUT FORMAT (JSON):
{
  "title": "Titel der Geschichte",
  "chapters": [
    {
      "order": 1,
      "content": "Story-Text mit {{PLACEHOLDER}} anstelle von Nebencharakteren. Der Text sollte die Handlung beschreiben und zeigen, welche Rolle die Placeholder-Charaktere spielen. Mindestens 200 Wörter pro Kapitel.",
      "characterRolesNeeded": [
        {
          "placeholder": "{{WISE_ELDER}}",
          "role": "guide",
          "archetype": "helpful_elder",
          "emotionalNature": "wise",
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
      "importance": "high",
      "inChapters": [1, 3, 5]
    }
  ]
}

WICHTIG:
- Exakt 5 Kapitel
- Jedes Kapitel mindestens 200 Wörter
- Placeholder müssen konsistent sein (gleicher Name = gleicher Charakter)
- supportingCharacterRequirements sammelt ALLE verwendeten Placeholder
- Gib emotionale Natur und Traits für jeden Placeholder an
- Die Placeholder sollten sinnvoll in die Handlung integriert sein
`;
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

      if (!chapter.characterRolesNeeded || !Array.isArray(chapter.characterRolesNeeded)) {
        throw new Error("Each chapter must have characterRolesNeeded array");
      }
    }

    // Validate character requirements
    for (const req of skeleton.supportingCharacterRequirements) {
      if (!req.placeholder || !req.role || !req.archetype) {
        throw new Error("Each character requirement must have placeholder, role, and archetype");
      }

      if (!req.placeholder.startsWith("{{") || !req.placeholder.endsWith("}}")) {
        throw new Error(`Invalid placeholder format: ${req.placeholder}`);
      }
    }

    console.log("[Phase1] Skeleton structure validated successfully");
  }
}
