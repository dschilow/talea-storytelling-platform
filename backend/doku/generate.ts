import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { secret } from "encore.dev/config";
import { ai, avatar } from "~encore/clients";
import { logTopic } from "../log/logger";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { normalizeLanguage } from "../story/avatar-image-optimization";

const dokuDB = SQLDatabase.named("doku");
const avatarDB = SQLDatabase.named("avatar");
const openAIKey = secret("OpenAIKey");

// Pricing & model (align with stories)
const MODEL = "gpt-5-mini";
const INPUT_COST_PER_1M = 5.0;
const OUTPUT_COST_PER_1M = 15.0;
const IMAGE_COST_PER_ITEM = 0.0008;

// Domain types for Doku mode (Galileo/Checker Tobi style)
export type DokuDepth = "basic" | "standard" | "deep";
export type DokuAgeGroup = "3-5" | "6-8" | "9-12" | "13+";

export interface DokuInteractive {
  quiz?: {
    enabled: boolean;
    questions: {
      question: string;
      options: string[];
      answerIndex: number;
      explanation?: string;
    }[];
  };
  activities?: {
    enabled: boolean;
    items: {
      title: string;
      description: string;
      materials?: string[];
      durationMinutes?: number;
    }[];
  };
}

export interface DokuSection {
  title: string;
  content: string; // markdown/text
  keyFacts: string[];
  imageIdea?: string; // textual idea for possible image
  interactive?: DokuInteractive;
}

export type DokuLanguage = "de" | "en" | "fr" | "es" | "it" | "nl" | "ru";

export interface DokuConfig {
  topic: string;
  depth: DokuDepth;
  ageGroup: DokuAgeGroup;
  perspective?: "science" | "history" | "technology" | "nature" | "culture";
  includeInteractive?: boolean;
  quizQuestions?: number; // 0..10
  handsOnActivities?: number; // 0..5
  tone?: "fun" | "neutral" | "curious";
  length?: "short" | "medium" | "long";
  language?: DokuLanguage;
}

export interface Doku {
  id: string;
  userId: string;
  title: string;
  topic: string;
  summary: string;
  content: {
    sections: DokuSection[];
  };
  coverImageUrl?: string;
  isPublic: boolean;
  status: "generating" | "complete" | "error";
  metadata?: {
    tokensUsed?: {
      prompt: number;
      completion: number;
      total: number;
    };
    model?: string;
    processingTime?: number;
    imagesGenerated?: number;
    totalCost?: {
      text: number;
      images: number;
      total: number;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerateDokuRequest {
  userId: string;
  config: DokuConfig;
}

export const generateDoku = api<GenerateDokuRequest, Doku>(
  { expose: true, method: "POST", path: "/doku/generate", auth: true },
  async (req) => {
    const id = crypto.randomUUID();
    const now = new Date();

    await dokuDB.exec`
      INSERT INTO dokus (id, user_id, title, topic, content, cover_image_url, is_public, status, created_at, updated_at)
      VALUES (${id}, ${req.userId}, 'Wird generiert...', ${req.config.topic}, ${JSON.stringify({ sections: [] })}, NULL, false, 'generating', ${now}, ${now})
    `;

    const startTime = Date.now();
    let imagesGenerated = 0;

    try {
      const payload = buildOpenAIPayload(req.config);

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAIKey()}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI error ${res.status}: ${errText}`);
      }

      const data = await res.json() as any;

      await publishWithTimeout(logTopic, {
        source: "openai-doku-generation",
        timestamp: new Date(),
        request: payload,
        response: data,
      });

      const choice = data.choices?.[0];
      if (!choice?.message?.content) {
        throw new Error("OpenAI returned no content");
      }
      const clean = choice.message.content.replace(/```json\s*|\s*```/g, "").trim();
      const parsed = JSON.parse(clean) as {
        title: string;
        summary: string;
        sections: DokuSection[];
        coverImagePrompt: string;
      };

      // Optional: generate a cover image
      let coverImageUrl: string | undefined = undefined;
      try {
        const coverPromptDescription = normalizeLanguage(parsed.coverImagePrompt);
        const coverPrompt = `Kid-friendly educational cover illustration: ${coverPromptDescription}. Axel Scheffler watercolor storybook style, joyful educational tone, clear composition, bright colors, child-friendly illustration, safe content, no text in the image.`;
        const img = await ai.generateImage({
          prompt: coverPrompt,
          width: 640,
          height: 400,
          steps: 28,
          CFGScale: 3.5,
          outputFormat: "JPEG",
        });
        coverImageUrl = img.imageUrl;
        imagesGenerated += 1;
      } catch (imgErr) {
        console.warn("Cover image generation failed:", imgErr);
      }

      const processingTime = Date.now() - startTime;
      const tokensUsed = {
        prompt: data.usage?.prompt_tokens ?? 0,
        completion: data.usage?.completion_tokens ?? 0,
        total: data.usage?.total_tokens ?? 0,
      };
      const textCost =
        (tokensUsed.prompt / 1_000_000) * INPUT_COST_PER_1M +
        (tokensUsed.completion / 1_000_000) * OUTPUT_COST_PER_1M;
      const imagesCost = imagesGenerated * IMAGE_COST_PER_ITEM;

      const metadata = {
        tokensUsed,
        model: MODEL,
        processingTime,
        imagesGenerated,
        totalCost: {
          text: textCost,
          images: imagesCost,
          total: textCost + imagesCost,
        },
      };

      await dokuDB.exec`
        UPDATE dokus
        SET title = ${parsed.title},
            content = ${JSON.stringify({ sections: parsed.sections, summary: parsed.summary, title: parsed.title })},
            cover_image_url = ${coverImageUrl ?? null},
            status = 'complete',
            metadata = ${JSON.stringify(metadata)},
            updated_at = ${new Date()}
        WHERE id = ${id}
      `;

      // Apply personality & memory updates for ALL user avatars based on Doku topic
      try {
        const knowledgeTrait = inferKnowledgeSubcategory(req.config.topic, req.config.perspective);
        const basePoints = 2
          + (req.config.depth === "standard" ? 1 : 0)
          + (req.config.depth === "deep" ? 2 : 0)
          + (req.config.length === "long" ? 1 : 0);
        const knowledgePoints = Math.max(1, Math.min(10, basePoints));

        // Build changes with detailed descriptions
        const subjectName = req.config.topic;
        const changes = [
          {
            trait: knowledgeTrait,
            change: knowledgePoints,
            description: `+${knowledgePoints} ${knowledgeTrait.split('.')[1]} durch Doku "${parsed.title}" über ${subjectName}`
          },
          {
            trait: "curiosity",
            change: 1,
            description: `+1 Neugier durch Doku-Lektüre über ${subjectName}`
          },
        ];

        // Load all avatars for this user
        const userAvatars = await avatarDB.queryAll<{ id: string; name: string }>`
          SELECT id, name FROM avatars WHERE user_id = ${req.userId}
        `;

        for (const a of userAvatars) {
          try {
            await avatar.updatePersonality({
              id: a.id,
              changes,
              storyId: id,
              contentTitle: parsed.title,
              contentType: 'doku'
            });

            // Create detailed development description
            const developmentSummary = changes
              .map(c => c.description || `${c.trait}: +${c.change}`)
              .join(', ');

            await avatar.addMemory({
              id: a.id,
              storyId: id,
              storyTitle: parsed.title,
              experience: `Ich habe die Doku "${parsed.title}" gelesen. Thema: ${req.config.topic}.`,
              emotionalImpact: "positive",
              personalityChanges: changes,
              developmentDescription: `Wissensentwicklung: ${developmentSummary}`,
              contentType: 'doku'
            });
          } catch (e) {
            console.warn("Failed to update avatar from doku:", a.id, e);
          }
        }
      } catch (applyErr) {
        console.warn("Applying doku personality/memory updates failed:", applyErr);
      }

      return {
        id,
        userId: req.userId,
        title: parsed.title,
        topic: req.config.topic,
        summary: parsed.summary,
        content: { sections: parsed.sections },
        coverImageUrl,
        isPublic: false,
        status: "complete",
        metadata,
        createdAt: now,
        updatedAt: new Date(),
      };
    } catch (err) {
      await dokuDB.exec`
        UPDATE dokus SET status = 'error', updated_at = ${new Date()} WHERE id = ${id}
      `;
      throw err;
    }
  }
);

function buildOpenAIPayload(config: DokuConfig) {
  const sectionsCount =
    config.length === "short" ? 3 : config.length === "long" ? 7 : 5;
  const quizCount = Math.max(0, Math.min(config.quizQuestions ?? 3, 10));
  const activitiesCount = Math.max(0, Math.min(config.handsOnActivities ?? 1, 5));
  const language = config.language ?? "de";

  const prompts = getLanguagePrompts(language);

  const system = prompts.system;

  const user = prompts.user(config, sectionsCount, quizCount, activitiesCount);

  return {
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 12000,
  };
}

function getLanguagePrompts(language: DokuLanguage) {
  const prompts: Record<DokuLanguage, {
    system: string;
    user: (config: DokuConfig, sectionsCount: number, quizCount: number, activitiesCount: number) => string;
  }> = {
    de: {
      system: `Du bist ein erfahrener Kinderwissens-Moderator im Stil von "Checker Tobi" bzw. Galileo Kids.
Schreibe kindgerecht, spannend, präzise und korrekt. Nutze eine neugierige, positive Tonalität.
KEINE gefährlichen, beängstigenden oder ungeeigneten Inhalte.`,
      user: (config, sectionsCount, quizCount, activitiesCount) => `Erzeuge ein strukturiertes Lern-Dossier (Doku-Modus) zum Thema: "${config.topic}".

Zielgruppe: ${config.ageGroup}
Tiefe: ${config.depth}
Perspektive (Schwerpunkt): ${config.perspective ?? "science"}
Tonalität: ${config.tone ?? "curious"}
Abschnitte: ${sectionsCount}

Interaktion:
- Quizfragen: ${config.includeInteractive ? quizCount : 0}
- Hands-on Aktivitäten: ${config.includeInteractive ? activitiesCount : 0}

Regeln:
- Begriffe erklären, Beispiele aus Kinderwelt.
- Jeder Abschnitt mit "keyFacts" in kurzen Punkten.
- Wenn Interaktionen aktiv sind: sinnvolle Fragen/Antworten und Aktivitäten vorschlagen.
- Antworte AUSSCHLIESSLICH als JSON-Objekt mit folgender Struktur:

{
  "title": "Kurzer, spannender Titel",
  "summary": "1-3 Sätze kindgerechte Zusammenfassung",
  "sections": [
    {
      "title": "Abschnittstitel",
      "content": "Fließtext (120-220 Wörter) mit Beispielen, bildhaft, leicht verständlich.",
      "keyFacts": ["Punkt 1", "Punkt 2", "Punkt 3"],
      "imageIdea": "kurze Beschreibung für mögliche Illustration",
      "interactive": {
        "quiz": {
          "enabled": true|false,
          "questions": [
            {
              "question": "Frage?",
              "options": ["A", "B", "C", "D"],
              "answerIndex": 0,
              "explanation": "Warum ist das richtig?"
            }
          ]
        },
        "activities": {
          "enabled": true|false,
          "items": [
            {
              "title": "Aktivität",
              "description": "Kindgerechte Anleitung",
              "materials": ["Papier", "Stifte"],
              "durationMinutes": 10
            }
          ]
        }
      }
    }
  ],
  "coverImagePrompt": "Kurzer Prompt für eine freundliche Cover-Illustration ohne Text"
}`
    },
    en: {
      system: `You are an experienced children's educational moderator in the style of educational shows.
Write in a child-friendly, exciting, precise and correct manner. Use a curious, positive tone.
NO dangerous, frightening or inappropriate content.`,
      user: (config, sectionsCount, quizCount, activitiesCount) => `Create a structured learning document (Doku mode) on the topic: "${config.topic}".

Target audience: ${config.ageGroup}
Depth: ${config.depth}
Perspective (focus): ${config.perspective ?? "science"}
Tone: ${config.tone ?? "curious"}
Sections: ${sectionsCount}

Interaction:
- Quiz questions: ${config.includeInteractive ? quizCount : 0}
- Hands-on activities: ${config.includeInteractive ? activitiesCount : 0}

Rules:
- Explain terms, use examples from children's world.
- Each section with "keyFacts" in short points.
- If interactions are active: suggest meaningful questions/answers and activities.
- Respond EXCLUSIVELY as a JSON object with the following structure:

{
  "title": "Short, exciting title",
  "summary": "1-3 sentences child-friendly summary",
  "sections": [
    {
      "title": "Section title",
      "content": "Flowing text (120-220 words) with examples, vivid, easy to understand.",
      "keyFacts": ["Point 1", "Point 2", "Point 3"],
      "imageIdea": "short description for possible illustration",
      "interactive": {
        "quiz": {
          "enabled": true|false,
          "questions": [
            {
              "question": "Question?",
              "options": ["A", "B", "C", "D"],
              "answerIndex": 0,
              "explanation": "Why is this correct?"
            }
          ]
        },
        "activities": {
          "enabled": true|false,
          "items": [
            {
              "title": "Activity",
              "description": "Child-friendly instructions",
              "materials": ["Paper", "Pens"],
              "durationMinutes": 10
            }
          ]
        }
      }
    }
  ],
  "coverImagePrompt": "Short prompt for a friendly cover illustration without text"
}`
    },
    fr: {
      system: `Tu es un modérateur expérimenté de connaissances pour enfants.
Écris de manière adaptée aux enfants, passionnante, précise et correcte. Utilise une tonalité curieuse et positive.
AUCUN contenu dangereux, effrayant ou inapproprié.`,
      user: (config, sectionsCount, quizCount, activitiesCount) => `Crée un dossier d'apprentissage structuré sur le sujet: "${config.topic}".

Public cible: ${config.ageGroup}
Profondeur: ${config.depth}
Perspective: ${config.perspective ?? "science"}
Ton: ${config.tone ?? "curious"}
Sections: ${sectionsCount}

Interaction:
- Questions quiz: ${config.includeInteractive ? quizCount : 0}
- Activités pratiques: ${config.includeInteractive ? activitiesCount : 0}

Règles:
- Expliquer les termes, utiliser des exemples du monde des enfants.
- Chaque section avec "keyFacts" en points courts.
- Répondre EXCLUSIVEMENT avec un objet JSON de la structure suivante:

{
  "title": "Titre court et passionnant",
  "summary": "Résumé adapté aux enfants en 1-3 phrases",
  "sections": [...],
  "coverImagePrompt": "Prompt court pour une illustration de couverture amicale sans texte"
}`
    },
    es: {
      system: `Eres un moderador experimentado de conocimientos para niños.
Escribe de manera adecuada para niños, emocionante, precisa y correcta. Usa un tono curioso y positivo.
SIN contenido peligroso, aterrador o inapropiado.`,
      user: (config, sectionsCount, quizCount, activitiesCount) => `Crea un documento de aprendizaje estructurado sobre el tema: "${config.topic}".

Público objetivo: ${config.ageGroup}
Profundidad: ${config.depth}
Perspectiva: ${config.perspective ?? "science"}
Tono: ${config.tone ?? "curious"}
Secciones: ${sectionsCount}

Interacción:
- Preguntas de quiz: ${config.includeInteractive ? quizCount : 0}
- Actividades prácticas: ${config.includeInteractive ? activitiesCount : 0}

Reglas:
- Explicar términos, usar ejemplos del mundo de los niños.
- Cada sección con "keyFacts" en puntos cortos.
- Responder EXCLUSIVAMENTE como un objeto JSON con la siguiente estructura:

{
  "title": "Título corto y emocionante",
  "summary": "Resumen adaptado a niños en 1-3 frases",
  "sections": [...],
  "coverImagePrompt": "Prompt corto para una ilustración de portada amigable sin texto"
}`
    },
    it: {
      system: `Sei un moderatore esperto di conoscenze per bambini.
Scrivi in modo adatto ai bambini, emozionante, preciso e corretto. Usa un tono curioso e positivo.
NESSUN contenuto pericoloso, spaventoso o inappropriato.`,
      user: (config, sectionsCount, quizCount, activitiesCount) => `Crea un documento di apprendimento strutturato sul tema: "${config.topic}".

Pubblico target: ${config.ageGroup}
Profondità: ${config.depth}
Prospettiva: ${config.perspective ?? "science"}
Tono: ${config.tone ?? "curious"}
Sezioni: ${sectionsCount}

Interazione:
- Domande quiz: ${config.includeInteractive ? quizCount : 0}
- Attività pratiche: ${config.includeInteractive ? activitiesCount : 0}

Regole:
- Spiegare i termini, usare esempi dal mondo dei bambini.
- Ogni sezione con "keyFacts" in punti brevi.
- Rispondere ESCLUSIVAMENTE come un oggetto JSON con la seguente struttura:

{
  "title": "Titolo breve ed emozionante",
  "summary": "Riassunto adatto ai bambini in 1-3 frasi",
  "sections": [...],
  "coverImagePrompt": "Prompt breve per un'illustrazione di copertina amichevole senza testo"
}`
    },
    nl: {
      system: `Je bent een ervaren kinderkennis-moderator.
Schrijf kindvriendelijk, spannend, nauwkeurig en correct. Gebruik een nieuwsgierige, positieve toon.
GEEN gevaarlijke, angstaanjagende of ongepaste inhoud.`,
      user: (config, sectionsCount, quizCount, activitiesCount) => `Maak een gestructureerd leerdocument over het onderwerp: "${config.topic}".

Doelgroep: ${config.ageGroup}
Diepte: ${config.depth}
Perspectief: ${config.perspective ?? "science"}
Toon: ${config.tone ?? "curious"}
Secties: ${sectionsCount}

Interactie:
- Quiz vragen: ${config.includeInteractive ? quizCount : 0}
- Praktische activiteiten: ${config.includeInteractive ? activitiesCount : 0}

Regels:
- Termen uitleggen, voorbeelden uit de kinderwereld gebruiken.
- Elke sectie met "keyFacts" in korte punten.
- Reageer UITSLUITEND als een JSON-object met de volgende structuur:

{
  "title": "Korte, spannende titel",
  "summary": "Kindvriendelijke samenvatting in 1-3 zinnen",
  "sections": [...],
  "coverImagePrompt": "Korte prompt voor een vriendelijke omslag illustratie zonder tekst"
}`
    },
    ru: {
      system: `Вы опытный модератор детских образовательных программ.
Пишите доступно для детей, увлекательно, точно и правильно. Используйте любознательный, позитивный тон.
НИКАКОГО опасного, пугающего или неподходящего контента.`,
      user: (config, sectionsCount, quizCount, activitiesCount) => `Создайте структурированный обучающий документ на тему: "${config.topic}".

Целевая аудитория: ${config.ageGroup}
Глубина: ${config.depth}
Перспектива: ${config.perspective ?? "science"}
Тон: ${config.tone ?? "curious"}
Разделы: ${sectionsCount}

Интерактивность:
- Вопросы викторины: ${config.includeInteractive ? quizCount : 0}
- Практические активности: ${config.includeInteractive ? activitiesCount : 0}

Правила:
- Объясняйте термины, используйте примеры из детского мира.
- Каждый раздел с "keyFacts" в коротких пунктах.
- Отвечайте ИСКЛЮЧИТЕЛЬНО в виде JSON-объекта следующей структуры:

{
  "title": "Короткий, увлекательный заголовок",
  "summary": "Резюме для детей в 1-3 предложениях",
  "sections": [...],
  "coverImagePrompt": "Короткий промпт для дружелюбной обложки без текста"
}`
    },
  };

  return prompts[language];
}

// Infer a knowledge subcategory ID from topic/perspective
function inferKnowledgeSubcategory(topic: string, perspective?: string): string {
  const t = `${topic} ${perspective ?? ""}`.toLowerCase();
  const map: Array<{ keywords: string[]; id: string }> = [
    { keywords: ["bio", "tier", "pflanz", "zoo", "mensch", "körper"], id: "knowledge.biology" },
    { keywords: ["geschichte", "histor", "antike", "mittelalter", "krieg"], id: "knowledge.history" },
    { keywords: ["physik", "kraft", "energie", "bewegung", "elektr", "licht"], id: "knowledge.physics" },
    { keywords: ["erde", "karte", "kontinent", "geografie", "ocean", "meer"], id: "knowledge.geography" },
    { keywords: ["stern", "planet", "weltall", "galax", "kosmos", "astronom"], id: "knowledge.astronomy" },
    { keywords: ["mathe", "zahl", "rechnen", "geometr", "bruch"], id: "knowledge.mathematics" },
    { keywords: ["chemie", "stoff", "reaktion", "element", "molekül"], id: "knowledge.chemistry" },
  ];

  for (const entry of map) {
    if (entry.keywords.some(k => t.includes(k))) return entry.id;
  }
  // Default to general knowledge
  return "knowledge.history";
}
