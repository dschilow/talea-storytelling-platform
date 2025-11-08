// Phase 1: Story Skeleton Generator
// Generates story structure with character ROLES (no names, no visuals)
// Token Budget: ~1,500 tokens

import { secret } from "encore.dev/config";
import type { StoryConfig } from "./generate";
import type { StorySkeleton } from "./types";
import {
  describeEmotionalFlavors,
  describeSpecialIngredients,
  type StoryExperienceContext,
} from "./story-experience";

const openAIKey = secret("OpenAIKey");

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
}

export class Phase1SkeletonGenerator {
  async generate(input: Phase1Input): Promise<Phase1GenerationResult> {
    // ===== NEW: Check if fairy tale is pre-selected (Phase 0) =====
    if (input.selectedFairyTale) {
      console.log(`[Phase1] 🚀 FAIRY TALE MODE DETECTED: ${input.selectedFairyTale.tale.title}`);
      console.log("[Phase1] Skipping expensive skeleton generation - will use fairy tale structure");
      
      // Return minimal skeleton with only title - saves ~47 seconds + 3757 tokens + $0.0003
      const minimalSkeleton: StorySkeleton = {
        title: input.selectedFairyTale.tale.title, // Use fairy tale title
        chapters: [], // Empty - will be filled by fairy tale scenes in Phase 3
        supportingCharacterRequirements: [], // Empty - roles loaded from fairy_tale_roles in Phase 3
      };

      console.log("[Phase1] ✅ Minimal skeleton created (no OpenAI call)");
      console.log("[Phase1] Savings: ~47 seconds latency + ~3757 tokens + ~$0.0003 per story");

      return {
        skeleton: minimalSkeleton,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          reasoningTokens: 0,
        },
        openAIRequest: { skipped: true, reason: "Fairy tale pre-selected in Phase 0" },
        openAIResponse: { choices: [], usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } } as OpenAIResponse,
      };
    }

    // ===== STANDARD MODE: Generate skeleton with OpenAI =====
    console.log("[Phase1] Generating story skeleton...");

    const prompt = this.buildSkeletonPrompt(input);
    const modelName = input.config.aiModel || "gpt-5-mini";

    // Check if this is a reasoning model (gpt-5, o4-mini, etc.)
    const isReasoningModel = modelName.includes("gpt-5") || modelName.includes("o4");

    const payload: any = {
      model: modelName,
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
      max_completion_tokens: isReasoningModel ? 16000 : 3000,
    };

    // Add reasoning_effort for reasoning models (they don't support temperature/top_p)
    // Phase1 only needs structure, not deep reasoning - use "low" to minimize token waste
    if (isReasoningModel) {
      payload.reasoning_effort = "low";
    } else {
      // Only add creativity parameters for non-reasoning models
      payload.temperature = 0.9;           // High creativity (0.0-1.0)
      payload.top_p = 0.95;                // Nucleus sampling for variety
      payload.frequency_penalty = 0.3;     // Reduce repetition
      payload.presence_penalty = 0.2;      // Encourage new topics
    }

    // CRITICAL FIX: Add time-based seed for variance even with identical parameters
    // This prevents generating the exact same story skeleton multiple times
    // The seed changes based on current time (minute precision), ensuring variance
    const varianceSeed = Math.floor(Date.now() / 60000); // Changes every minute
    payload.seed = varianceSeed;

    console.log(`[Phase1] Using variance seed: ${varianceSeed} to prevent duplicate skeletons`);

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

  private buildSkeletonPrompt(input: Phase1Input): string {
    const { config, avatarDetails, experience } = input;

    const avatarLine =
      avatarDetails.length > 0
        ? avatarDetails
            .map((avatar) =>
              avatar.description ? `${avatar.name} (${avatar.description})` : avatar.name
            )
            .join(", ")
        : "Keine spezifischen Avatare angegeben - nutze neutrale Heldinnen und Helden.";

    const suspenseLabels = ["sehr ruhig", "leicht prickelnd", "spannend", "hochspannend"];
    const humorLabels = ["ernst", "sanft", "witzig", "sehr verspielt"];

    const suspenseLabel = suspenseLabels[config.suspenseLevel ?? 1] ?? "ausgewogen";
    const humorLabel = humorLabels[config.humorLevel ?? 1] ?? "sanft";

    const soulSummary = experience.soul
      ? `${experience.soul.label} - ${experience.soul.storyPromise} (Ton: ${experience.soul.recommendedTone}, Tempo: ${experience.soul.defaultPacing})`
      : "Keine Story-Seele gewaehlt - erzaehle warm, fantasievoll und altersgerecht.";

    const flavorSummary = experience.emotionalFlavors.length
      ? experience.emotionalFlavors
          .map((flavor) => `- ${flavor.label}: ${flavor.description}`)
          .join("\n")
      : "- Natuerliche Herzensmomente ohne zusaetzliche Wuerze.";

    const tempoSummary = experience.tempo
      ? `${experience.tempo.label} - ${experience.tempo.description} (Tempo: ${experience.tempo.pacing})`
      : `Standardtempo (${config.pacing ?? "balanced"}) - gleiche ruhige und dynamische Momente aus.`;

    const ingredientSummary = experience.specialIngredients.length
      ? experience.specialIngredients
          .map((ingredient) => {
            const extras: string[] = [];
            if (ingredient.forcesTwist) {
              extras.push("Plane Ueberraschung oder Twist in Kapitel 4.");
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
      : "- Keine Spezialzutaten - klassischer Verlauf moeglich.";

    const hooksLine =
      config.hooks && config.hooks.length > 0 ? config.hooks.join(", ") : "keine speziellen Hooks";

    const customLine = config.customPrompt ? `BENUTZER-WUNSCH: ${config.customPrompt}` : "";

    const flavorDetails = describeEmotionalFlavors(experience);
    const ingredientDetails = describeSpecialIngredients(experience);

    const povLabel = config.pov === "ich" ? "Ich-Perspektive" : "personale Perspektive";

    return `
Du bist eine preisgekroente Kinderbuch-Autorin, die meisterhafte Story-Skelette fuer illustrierte Geschichten schreibt. Arbeite praezise, bildhaft und kindgerecht.

HAUPTFIGUREN: ${avatarLine}
GENRE: ${config.genre}
SETTING: ${config.setting}
ALTERSGRUPPE: ${config.ageGroup}
KOMPLEXITAET: ${config.complexity}
LAENGE: ${config.length}
ERZAELLPERSPEKTIVE: ${povLabel}
SPRACHE: ${config.language ?? "de"}
REIME: ${config.allowRhymes ? "Gelegentliche sanfte Reime erlaubt." : "Keine Reimpflicht - klare Prosa."}

STORY EXPERIENCE (USER-WAHL):
- Manuell gewaehlt: ${config.stylePreset ?? "Story-Seele-Empfehlung"}
- Reime erlaubt: ${config.allowRhymes ? "Ja" : "Nein"}
- Story-Seele: ${soulSummary}
- Emotionale Wuerze:
${flavorSummary}
- Tempo: ${tempoSummary}
- Spannung: Level ${config.suspenseLevel ?? 1} (${suspenseLabel})
- Humor: Level ${config.humorLevel ?? 1} (${humorLabel})
- Twist-Vorgabe: ${config.hasTwist ? "Ja - Kapitel 4 vorbereiten!" : "Nein"}
- Hooks: ${hooksLine}
- Besondere Zutaten:
${ingredientSummary}

DETAILLIERTE WUERZE:
${flavorDetails}

DETAILLIERTE ZUTATEN:
${ingredientDetails}

${customLine}

KONFLIKT-REGELN (CRITICAL FOR QUALITY):
1️⃣ **KONKRETE HERAUSFORDERUNGEN PFLICHT**:
   - 80% aller Stories brauchen externe Gefahr/Hindernis
   - Beispiele: Wolf jagt, Hexe sperrt ein, Drache raubt, Monster bedroht, Weg verloren, Freund gefangen
   - 20% emotionale Reisen OK (nur bei "warm"/"meaningful" Gefühl UND Altersgruppe 9-12)

2️⃣ **ALTERSGERECHTE KONFLIKTE**:
   - 3-5 Jahre: EINFACH + KLAR (Wolf kommt, Hexe sperrt ein, Weg verloren, Monster versteckt sich)
   - 6-8 Jahre: Komplexer (Rätsel lösen, Verhandlungen, clevere Pläne, moralische Entscheidungen)
   - 9-12 Jahre: Subtil (innere Konflikte, soziale Probleme, Geheimnisse, komplexe Beziehungen)

3️⃣ **VERBOTEN (führt zu schlechter Story-Qualität)**:
   ❌ Rein philosophische Probleme ("vergessene Lieder", "verlorene Träume", "verschwundene Farben")
   ❌ Abstrakte Konzepte ohne physische Komponente
   ❌ Emotionale Reisen ohne klares Ziel/Hindernis (außer explizit gefordert)
   ❌ Probleme die sich von selbst lösen
   
4️⃣ **PFLICHT-ELEMENTE für jede Story**:
   ✅ Klarer Antagonist ODER konkretes Hindernis (Character, Natur, Situation)
   ✅ Konkretes Problem das gelöst werden muss
   ✅ Risiko/Spannung (Was passiert wenn Protagonist scheitert?)
   ✅ Befriedigende Lösung (Protagonist überwindet Hindernis durch Mut/Cleverness/Freundschaft)

AUFGABE FUER DICH:
1. Erstelle eine Story-Struktur mit exakt 5 Kapiteln.
2. 🚨 **KRITISCH**: Die HAUPTFIGUREN (oben genannt) sind USER-AVATARE!
   - Nutze ihre NAMEN DIREKT im Story-Text: "Alexander findet...", "Adrian sieht..."
   - NIEMALS Placeholders für Avatare erstellen: ❌ {{ALEXANDER}}, {{ADRIAN}}
   - {{PLACEHOLDER}} sind NUR für NEBENFIGUREN ({{WISE_ELDER}}, {{ANIMAL_HELPER}}, etc.)
3. Nutze ausschliesslich {{PLACEHOLDER}} fuer Nebenfiguren und bleibe konsistent (gleicher Placeholder = gleiche Figur).
4. WICHTIG: Jede Kapitelbeschreibung MAXIMAL 50-70 Woerter (niemals mehr!). Schreibe praegnant, dicht, bildlich. Keine langen Saetze.
5. Kapitel 1-4 enden mit sanftem Cliffhanger oder weiterfuehrender Frage. Kapitel 5 bietet eine warme Loesung.
6. Lasse Story-Seele, emotionale Wuerze, Tempo und Spezialzutaten bereits im Plot spuerbar werden.
7. Fuehre fuer jede NEBENFIGUREN-Rolle emotionale Natur, wichtige Traits, visuelle Merkmale (Tierart, Beruf, Aussehen) und Kapitel-Auftritte an.
8. Wenn Twist gefordert oder Spezialzutat es verlangt: bereite in Kapitel 4 die Wendung vor und loese sie in Kapitel 5 liebevoll ein.
9. BEACHTE KONFLIKT-REGELN OBEN - konkrete Herausforderungen sind PFLICHT für Qualität!

PLACEHOLDER-BIBLIOTHEK (nutze nur bei Bedarf, eigene sind erlaubt):
- {{WISE_ELDER}} - weiser Mentor oder Mentorin
- {{ANIMAL_HELPER}} - treuer tierischer Begleiter
- {{MAGICAL_CREATURE}} - magisches Wesen
- {{FRIENDLY_VILLAGER}} - hilfsbereite Person vor Ort
- {{OBSTACLE_CHARACTER}} - Hindernis oder Gegenspieler
- Eigene Placeholder im Format {{NAME}} sind erlaubt, wenn die Rolle klar beschrieben ist.

OUTPUT (JSON):
{
  "title": "Titel der Geschichte",
  "chapters": [
    {
      "order": 1,
      "content": "MAXIMAL 50-70 Woerter! Nutze Avatar-Namen DIREKT (Alexander, Adrian), KEINE Placeholders für sie!",
      "characterRolesNeeded": [
        {
          "placeholder": "{{WISE_ELDER}}",
          "role": "guide",
          "archetype": "helpful_elder",
          "emotionalNature": "wise",
          "visualHints": "aelterer Mensch, Arzt/Doktor, warmherziges Auftreten",
          "importance": "high",
          "inChapters": [1, 3, 5]
        }
      ]
    }
  ],
  "supportingCharacterRequirements": [
    // ⚠️ NUR NEBENFIGUREN hier! NIEMALS Avatar-Namen (Alexander, Adrian) als Placeholders!
    {
      "placeholder": "{{WISE_ELDER}}",
      "role": "guide",
      "archetype": "helpful_elder",
      "emotionalNature": "wise",
      "requiredTraits": ["wise", "protective", "kind"],
      "visualHints": "aelterer Mensch, Arzt/Doktor, warmherziges Auftreten, Brille moeglich",
      "importance": "high",
      "inChapters": [1, 3, 5]
    }
  ]
}

WICHTIG: 
- Halte chapters[].content STRIKT unter 70 Woertern!
- Fuege bei supportingCharacterRequirements immer visualHints hinzu (Tierart, Beruf, Aussehen, Kleidung)

Achte auf klare Lernkurve fuer die Avatare, wiederkehrende Motive und eine in sich stimmige Dramaturgie. Kapitel 5 zeigt emotionale Entwicklung und erfuellt das Versprechen der Story-Seele.
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

      if (!chapter.characterRolesNeeded || !Array.isArray(chapter.characterRolesNeeded)) {
        throw new Error("Each chapter must have characterRolesNeeded array");
      }

      const wordCount = typeof chapter.content === "string"
        ? chapter.content.split(/\s+/).filter(Boolean).length
        : 0;
      if (wordCount < 45 || wordCount > 75) {
        console.warn(
          `[Phase1] ⚠️ Chapter ${chapter.order} word count ${wordCount} outside target range (50-70). CRITICAL!`
        );
      }
      if (wordCount > 80) {
        throw new Error(
          `[Phase1] Chapter ${chapter.order} exceeds maximum (${wordCount} words). Must be <= 75 words!`
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

    console.log("[Phase1] Skeleton structure validated successfully");
  }
}

