import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { secret } from "encore.dev/config";
import { ai, avatar } from "~encore/clients";
import { logTopic } from "../log/logger";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { normalizeLanguage } from "../story/avatar-image-optimization";
import { resolveImageUrlForClient } from "../helpers/bucket-storage";
import { getAuthData } from "~encore/auth";
import { claimGenerationUsage } from "../helpers/billing";

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
  sectionImagePrompt?: string; // English Runware-optimized prompt (AI-generated)
  imageUrl?: string; // generated section image URL
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
    const auth = getAuthData();
    const currentUserId = auth?.userID ?? req.userId;

    if (!currentUserId) {
      throw APIError.unauthenticated("Missing authenticated user for doku generation");
    }

    if (auth?.userID && req.userId && auth.userID !== req.userId) {
      console.warn("[doku.generate] Auth user mismatch detected", {
        authUserId: auth.userID,
        requestUserId: req.userId,
        dokuId: id,
      });
    }

    const clerkToken = auth?.clerkToken;
    if (!clerkToken) {
      throw APIError.unauthenticated("Missing Clerk token for billing");
    }

    await claimGenerationUsage({
      userId: currentUserId,
      kind: "doku",
      clerkToken,
    });

    await dokuDB.exec`
      INSERT INTO dokus (id, user_id, title, topic, content, cover_image_url, is_public, status, created_at, updated_at)
      VALUES (${id}, ${currentUserId}, 'Wird generiert...', ${req.config.topic}, ${JSON.stringify({ sections: [] })}, NULL, false, 'generating', ${now}, ${now})
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
      // OPTIMIZATION v4.0: Use runware:400@4 with optimized parameters
      let coverImageUrl: string | undefined = undefined;
      try {
        const coverPromptDescription = normalizeLanguage(parsed.coverImagePrompt);
        const coverPrompt = `Kid-friendly educational cover illustration: ${coverPromptDescription}. Axel Scheffler watercolor storybook style, joyful educational tone, clear composition, bright colors, child-friendly illustration, safe content, no text in the image.`;
        const img = await ai.generateImage({
          prompt: coverPrompt,
          width: 1024,
          height: 1024,
          steps: 4,     // runware:400@4 uses fewer steps
          CFGScale: 4,
          outputFormat: "JPEG",
        });
        coverImageUrl = img.imageUrl;
        imagesGenerated += 1;
      } catch (imgErr) {
        console.warn("Cover image generation failed:", imgErr);
      }

      // === SECTION IMAGE GENERATION ===
      // Generate images for each section in parallel using Promise.allSettled
      const sectionImageResults = await Promise.allSettled(
        parsed.sections.map(async (section, index) => {
          const rawPrompt = section.sectionImagePrompt || section.imageIdea;
          if (!rawPrompt) return { index, imageUrl: undefined };

          try {
            const normalizedPrompt = normalizeLanguage(rawPrompt);
            const sectionPrompt = `Kid-friendly educational illustration: ${normalizedPrompt}. Axel Scheffler watercolor storybook style, joyful educational tone, clear composition, bright colors, child-friendly illustration, safe content, no text in the image.`;

            const img = await ai.generateImage({
              prompt: sectionPrompt,
              width: 1024,
              height: 1024,
              steps: 4,
              CFGScale: 4,
              outputFormat: "JPEG",
            });
            return { index, imageUrl: img.imageUrl };
          } catch (err) {
            console.warn(`Section ${index} image generation failed:`, err);
            return { index, imageUrl: undefined };
          }
        })
      );

      // Attach imageUrl to each section
      for (const result of sectionImageResults) {
        if (result.status === "fulfilled" && result.value.imageUrl) {
          parsed.sections[result.value.index].imageUrl = result.value.imageUrl;
          imagesGenerated++;
        }
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
          SELECT id, name FROM avatars WHERE user_id = ${currentUserId}
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

      const resolvedCoverImageUrl = await resolveImageUrlForClient(coverImageUrl);

      // Resolve section image URLs for client response
      const resolvedSections = await Promise.all(
        parsed.sections.map(async (section) => {
          if (section.imageUrl) {
            const resolvedUrl = await resolveImageUrlForClient(section.imageUrl);
            return { ...section, imageUrl: resolvedUrl || section.imageUrl };
          }
          return section;
        })
      );

      return {
        id,
        userId: currentUserId,
        title: parsed.title,
        topic: req.config.topic,
        summary: parsed.summary,
        content: { sections: resolvedSections },
        coverImageUrl: resolvedCoverImageUrl ?? coverImageUrl,
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
  // Shared JSON schema for sections (language-independent structure)
  const sectionSchema = `{
      "title": "Section title",
      "content": "Flowing text (120-220 words)",
      "keyFacts": ["Fact 1", "Fact 2", "Fact 3"],
      "imageIdea": "Short description for illustration (in document language)",
      "sectionImagePrompt": "English prompt for image generation: Kid-friendly watercolor illustration of [concrete visual scene from this section]. Axel Scheffler style, bright warm colors, educational, no text.",
      "interactive": {
        "quiz": {
          "enabled": true,
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
          "enabled": true,
          "items": [
            {
              "title": "Activity title",
              "description": "Child-friendly instructions",
              "materials": ["Paper", "Pens"],
              "durationMinutes": 10
            }
          ]
        }
      }
    }`;

  const imagePromptRules = `
IMAGE PROMPT RULES (for "sectionImagePrompt" and "coverImagePrompt"):
- MUST be written in ENGLISH regardless of document language.
- Describe a CONCRETE visual scene that captures the section's core concept.
- Style: "Axel Scheffler watercolor storybook style, bright warm colors, educational, joyful, child-friendly"
- NO text in image, NO scary or dangerous scenes, NO human faces in close-up.
- Max 2 sentences, visually descriptive. Example: "A curious child examining a giant magnifying glass over a colorful butterfly wing, Axel Scheffler watercolor storybook style, bright warm colors, educational."`;

  const prompts: Record<DokuLanguage, {
    system: string;
    user: (config: DokuConfig, sectionsCount: number, quizCount: number, activitiesCount: number) => string;
  }> = {
    de: {
      system: `Du bist ein erfahrener Kinderwissens-Moderator im Stil von "Checker Tobi" und "Galileo Kids".

QUALITÄTSREGELN:
1) Schreibe kindgerecht, spannend, präzise und wissenschaftlich korrekt.
2) Nutze direkte Ansprache: "Stell dir vor...", "Wusstest du...?", "Hast du schon mal...?"
3) Jeder Abschnitt erzählt eine kleine Wissensgeschichte mit konkreten Beispielen aus dem Kinderalltag.
4) Nutze bildhafte Vergleiche die Kinder verstehen (z.B. "So schwer wie 10 Elefanten", "So schnell wie ein Rennwagen").
5) ANTI-WIEDERHOLUNG: Jeder Abschnitt bringt NEUE Informationen und eine NEUE Perspektive. Keine Wiederholung von Fakten.
6) SPANNUNGSBÖGEN: Beende jeden Abschnitt (außer den letzten) mit einer neugierig machenden Frage oder einem Cliffhanger zum nächsten Thema.
7) KEINE generischen Sätze wie "Das ist sehr interessant", "Das ist wichtig", "Es gibt viele Beispiele" - IMMER konkret und spezifisch.
8) KEINE gefährlichen, beängstigenden oder ungeeigneten Inhalte.
9) Variiere Satzanfänge: Nie zwei aufeinanderfolgende Sätze mit dem gleichen Wort beginnen.
10) Maximal 1 Ausrufezeichen pro Abschnitt.

${imagePromptRules}`,
      user: (config, sectionsCount, quizCount, activitiesCount) => `Erzeuge ein strukturiertes Lern-Dossier (Doku-Modus) zum Thema: "${config.topic}".

Zielgruppe: ${config.ageGroup}
Tiefe: ${config.depth}
Perspektive (Schwerpunkt): ${config.perspective ?? "science"}
Tonalität: ${config.tone ?? "curious"}
Abschnitte: ${sectionsCount}

Interaktion:
- Quizfragen: ${config.includeInteractive ? quizCount : 0}
- Hands-on Aktivitäten: ${config.includeInteractive ? activitiesCount : 0}

ALTERSGERECHTE ANPASSUNG:
- 3-5: Sehr kurze Sätze, sanfte Wiederholung, einfache Wörter, 1 Hauptidee pro Abschnitt.
- 6-8: Mehr Dialog-Elemente, kleine Rätsel, spielerische Spannung.
- 9-12: Tiefere Zusammenhänge, überraschende Fakten, "Aha-Momente".
- 13+: Komplexere Konzepte, kritisches Denken, Querverbindungen zu anderen Fachgebieten.

INHALTSREGELN:
- Begriffe kindgerecht erklären, dabei Beispiele aus der Lebenswelt der Zielgruppe nutzen.
- Jeder Abschnitt mit 3-5 "keyFacts" als kurze, knackige Merkpunkte.
- Jeder Abschnitt mit einem konkreten Einstieg (Szenario, Frage, oder "Stell dir vor...").
- Der ROTE FADEN: Abschnitte bauen logisch aufeinander auf, jeder baut auf dem vorherigen auf.
- Wenn Interaktionen aktiv sind: Quizfragen sollen zum Nachdenken anregen, nicht nur Fakten abfragen.
- Aktivitäten sollen mit Alltagsmaterialien durchführbar sein.

Antworte AUSSCHLIESSLICH als JSON-Objekt mit folgender Struktur:

{
  "title": "Kurzer, spannender Titel (max 8 Wörter, neugierig machend)",
  "summary": "1-3 Sätze kindgerechte Zusammenfassung die Lust auf mehr macht",
  "sections": [
    ${sectionSchema}
  ],
  "coverImagePrompt": "English: Kid-friendly watercolor cover illustration showing [main topic visual]. Axel Scheffler style, bright warm colors, educational, joyful, no text."
}`
    },
    en: {
      system: `You are an experienced children's educational moderator in the style of popular science shows for kids.

QUALITY RULES:
1) Write in a child-friendly, exciting, precise and scientifically correct manner.
2) Use direct address: "Imagine...", "Did you know...?", "Have you ever...?"
3) Each section tells a small knowledge story with concrete examples from children's everyday life.
4) Use vivid comparisons children understand (e.g., "As heavy as 10 elephants", "As fast as a race car").
5) ANTI-REPETITION: Each section brings NEW information and a NEW perspective. No repeating facts.
6) TENSION ARCS: End each section (except the last) with a curiosity-sparking question or cliffhanger.
7) NO generic sentences like "This is very interesting", "This is important" - ALWAYS be concrete and specific.
8) NO dangerous, frightening or inappropriate content.
9) Vary sentence starters: Never begin two consecutive sentences with the same word.
10) Maximum 1 exclamation mark per section.

${imagePromptRules}`,
      user: (config, sectionsCount, quizCount, activitiesCount) => `Create a structured learning document (Doku mode) on the topic: "${config.topic}".

Target audience: ${config.ageGroup}
Depth: ${config.depth}
Perspective (focus): ${config.perspective ?? "science"}
Tone: ${config.tone ?? "curious"}
Sections: ${sectionsCount}

Interaction:
- Quiz questions: ${config.includeInteractive ? quizCount : 0}
- Hands-on activities: ${config.includeInteractive ? activitiesCount : 0}

AGE ADAPTATION:
- 3-5: Very short sentences, gentle repetition, simple words, 1 main idea per section.
- 6-8: More dialogue elements, small riddles, playful tension.
- 9-12: Deeper connections, surprising facts, "aha moments".
- 13+: Complex concepts, critical thinking, cross-references to other fields.

CONTENT RULES:
- Explain terms in a child-friendly way with examples from the target audience's life.
- Each section with 3-5 "keyFacts" as short, punchy bullet points.
- Each section starts with a concrete hook (scenario, question, or "Imagine...").
- RED THREAD: Sections build logically on each other.
- If interactions are active: Quiz questions should provoke thought, not just test facts.
- Activities should use everyday materials.

Respond EXCLUSIVELY as a JSON object with the following structure:

{
  "title": "Short, exciting title (max 8 words, curiosity-sparking)",
  "summary": "1-3 sentences child-friendly summary that makes you want more",
  "sections": [
    ${sectionSchema}
  ],
  "coverImagePrompt": "Kid-friendly watercolor cover illustration showing [main topic visual]. Axel Scheffler style, bright warm colors, educational, joyful, no text."
}`
    },
    fr: {
      system: `Tu es un modérateur expérimenté de connaissances pour enfants, dans le style des émissions éducatives populaires.

RÈGLES DE QUALITÉ:
1) Écris de manière adaptée aux enfants, passionnante, précise et scientifiquement correcte.
2) Utilise l'adresse directe: "Imagine...", "Savais-tu...?", "As-tu déjà...?"
3) Chaque section raconte une petite histoire de savoir avec des exemples concrets du quotidien des enfants.
4) Utilise des comparaisons imagées que les enfants comprennent.
5) ANTI-RÉPÉTITION: Chaque section apporte de NOUVELLES informations et une NOUVELLE perspective.
6) ARCS DE TENSION: Termine chaque section (sauf la dernière) avec une question qui éveille la curiosité.
7) PAS de phrases génériques - TOUJOURS concret et spécifique.
8) AUCUN contenu dangereux, effrayant ou inapproprié.

${imagePromptRules}`,
      user: (config, sectionsCount, quizCount, activitiesCount) => `Crée un dossier d'apprentissage structuré sur le sujet: "${config.topic}".

Public cible: ${config.ageGroup}
Profondeur: ${config.depth}
Perspective: ${config.perspective ?? "science"}
Ton: ${config.tone ?? "curious"}
Sections: ${sectionsCount}

Interaction:
- Questions quiz: ${config.includeInteractive ? quizCount : 0}
- Activités pratiques: ${config.includeInteractive ? activitiesCount : 0}

Règles de contenu:
- Expliquer les termes avec des exemples du monde des enfants.
- Chaque section avec 3-5 "keyFacts" en points courts.
- Chaque section commence avec un accroche concrète.
- FIL ROUGE: Les sections s'enchaînent logiquement.

Réponds EXCLUSIVEMENT avec un objet JSON de la structure suivante:

{
  "title": "Titre court et passionnant (max 8 mots)",
  "summary": "Résumé adapté aux enfants en 1-3 phrases",
  "sections": [
    ${sectionSchema}
  ],
  "coverImagePrompt": "English: Kid-friendly watercolor cover illustration showing [main topic visual]. Axel Scheffler style, bright warm colors, educational, joyful, no text."
}`
    },
    es: {
      system: `Eres un moderador experimentado de conocimientos para niños, al estilo de programas educativos populares.

REGLAS DE CALIDAD:
1) Escribe de manera adecuada para niños, emocionante, precisa y científicamente correcta.
2) Usa la dirección directa: "Imagina...", "¿Sabías que...?", "¿Alguna vez has...?"
3) Cada sección cuenta una pequeña historia de conocimiento con ejemplos concretos del día a día de los niños.
4) Usa comparaciones vívidas que los niños entiendan.
5) ANTI-REPETICIÓN: Cada sección aporta información NUEVA y una perspectiva NUEVA.
6) ARCOS DE TENSIÓN: Termina cada sección (excepto la última) con una pregunta que despierte curiosidad.
7) SIN frases genéricas - SIEMPRE concreto y específico.
8) SIN contenido peligroso, aterrador o inapropiado.

${imagePromptRules}`,
      user: (config, sectionsCount, quizCount, activitiesCount) => `Crea un documento de aprendizaje estructurado sobre el tema: "${config.topic}".

Público objetivo: ${config.ageGroup}
Profundidad: ${config.depth}
Perspectiva: ${config.perspective ?? "science"}
Tono: ${config.tone ?? "curious"}
Secciones: ${sectionsCount}

Interacción:
- Preguntas de quiz: ${config.includeInteractive ? quizCount : 0}
- Actividades prácticas: ${config.includeInteractive ? activitiesCount : 0}

Reglas de contenido:
- Explicar términos con ejemplos del mundo de los niños.
- Cada sección con 3-5 "keyFacts" en puntos cortos.
- Cada sección comienza con un gancho concreto.
- HILO CONDUCTOR: Las secciones se construyen lógicamente unas sobre otras.

Responde EXCLUSIVAMENTE como un objeto JSON con la siguiente estructura:

{
  "title": "Título corto y emocionante (máx 8 palabras)",
  "summary": "Resumen adaptado a niños en 1-3 frases",
  "sections": [
    ${sectionSchema}
  ],
  "coverImagePrompt": "English: Kid-friendly watercolor cover illustration showing [main topic visual]. Axel Scheffler style, bright warm colors, educational, joyful, no text."
}`
    },
    it: {
      system: `Sei un moderatore esperto di conoscenze per bambini, nello stile dei programmi educativi popolari.

REGOLE DI QUALITÀ:
1) Scrivi in modo adatto ai bambini, emozionante, preciso e scientificamente corretto.
2) Usa l'indirizzo diretto: "Immagina...", "Sapevi che...?", "Hai mai...?"
3) Ogni sezione racconta una piccola storia di conoscenza con esempi concreti dalla vita quotidiana dei bambini.
4) Usa paragoni vividi che i bambini capiscono.
5) ANTI-RIPETIZIONE: Ogni sezione porta informazioni NUOVE e una prospettiva NUOVA.
6) ARCHI DI TENSIONE: Termina ogni sezione (tranne l'ultima) con una domanda che suscita curiosità.
7) NESSUNA frase generica - SEMPRE concreto e specifico.
8) NESSUN contenuto pericoloso, spaventoso o inappropriato.

${imagePromptRules}`,
      user: (config, sectionsCount, quizCount, activitiesCount) => `Crea un documento di apprendimento strutturato sul tema: "${config.topic}".

Pubblico target: ${config.ageGroup}
Profondità: ${config.depth}
Prospettiva: ${config.perspective ?? "science"}
Tono: ${config.tone ?? "curious"}
Sezioni: ${sectionsCount}

Interazione:
- Domande quiz: ${config.includeInteractive ? quizCount : 0}
- Attività pratiche: ${config.includeInteractive ? activitiesCount : 0}

Regole di contenuto:
- Spiegare i termini con esempi dal mondo dei bambini.
- Ogni sezione con 3-5 "keyFacts" in punti brevi.
- Ogni sezione inizia con un aggancio concreto.
- FILO ROSSO: Le sezioni si costruiscono logicamente una sull'altra.

Rispondi ESCLUSIVAMENTE come un oggetto JSON con la seguente struttura:

{
  "title": "Titolo breve ed emozionante (max 8 parole)",
  "summary": "Riassunto adatto ai bambini in 1-3 frasi",
  "sections": [
    ${sectionSchema}
  ],
  "coverImagePrompt": "English: Kid-friendly watercolor cover illustration showing [main topic visual]. Axel Scheffler style, bright warm colors, educational, joyful, no text."
}`
    },
    nl: {
      system: `Je bent een ervaren kinderkennis-moderator, in de stijl van populaire educatieve programma's.

KWALITEITSREGELS:
1) Schrijf kindvriendelijk, spannend, nauwkeurig en wetenschappelijk correct.
2) Gebruik directe aanspreking: "Stel je voor...", "Wist je dat...?", "Heb je ooit...?"
3) Elke sectie vertelt een klein kennisverhaal met concrete voorbeelden uit het dagelijks leven van kinderen.
4) Gebruik beeldende vergelijkingen die kinderen begrijpen.
5) ANTI-HERHALING: Elke sectie brengt NIEUWE informatie en een NIEUW perspectief.
6) SPANNINGSLIJNEN: Eindig elke sectie (behalve de laatste) met een nieuwsgierig makende vraag.
7) GEEN generieke zinnen - ALTIJD concreet en specifiek.
8) GEEN gevaarlijke, angstaanjagende of ongepaste inhoud.

${imagePromptRules}`,
      user: (config, sectionsCount, quizCount, activitiesCount) => `Maak een gestructureerd leerdocument over het onderwerp: "${config.topic}".

Doelgroep: ${config.ageGroup}
Diepte: ${config.depth}
Perspectief: ${config.perspective ?? "science"}
Toon: ${config.tone ?? "curious"}
Secties: ${sectionsCount}

Interactie:
- Quiz vragen: ${config.includeInteractive ? quizCount : 0}
- Praktische activiteiten: ${config.includeInteractive ? activitiesCount : 0}

Inhoudsregels:
- Termen uitleggen met voorbeelden uit de kinderwereld.
- Elke sectie met 3-5 "keyFacts" in korte punten.
- Elke sectie begint met een concrete haak.
- RODE DRAAD: Secties bouwen logisch op elkaar voort.

Reageer UITSLUITEND als een JSON-object met de volgende structuur:

{
  "title": "Korte, spannende titel (max 8 woorden)",
  "summary": "Kindvriendelijke samenvatting in 1-3 zinnen",
  "sections": [
    ${sectionSchema}
  ],
  "coverImagePrompt": "English: Kid-friendly watercolor cover illustration showing [main topic visual]. Axel Scheffler style, bright warm colors, educational, joyful, no text."
}`
    },
    ru: {
      system: `Вы опытный модератор детских образовательных программ, в стиле популярных научных шоу для детей.

ПРАВИЛА КАЧЕСТВА:
1) Пишите доступно для детей, увлекательно, точно и научно правильно.
2) Используйте прямое обращение: "Представь...", "Знал ли ты...?", "Ты когда-нибудь...?"
3) Каждый раздел рассказывает маленькую историю знаний с конкретными примерами из повседневной жизни детей.
4) Используйте яркие сравнения, понятные детям.
5) АНТИ-ПОВТОРЕНИЕ: Каждый раздел несёт НОВУЮ информацию и НОВЫЙ взгляд.
6) АРКИ НАПРЯЖЕНИЯ: Завершайте каждый раздел (кроме последнего) вопросом, пробуждающим любопытство.
7) НИКАКИХ общих фраз - ВСЕГДА конкретно и специфично.
8) НИКАКОГО опасного, пугающего или неподходящего контента.

${imagePromptRules}`,
      user: (config, sectionsCount, quizCount, activitiesCount) => `Создайте структурированный обучающий документ на тему: "${config.topic}".

Целевая аудитория: ${config.ageGroup}
Глубина: ${config.depth}
Перспектива: ${config.perspective ?? "science"}
Тон: ${config.tone ?? "curious"}
Разделы: ${sectionsCount}

Интерактивность:
- Вопросы викторины: ${config.includeInteractive ? quizCount : 0}
- Практические активности: ${config.includeInteractive ? activitiesCount : 0}

Правила содержания:
- Объясняйте термины с примерами из мира детей.
- Каждый раздел с 3-5 "keyFacts" в коротких пунктах.
- Каждый раздел начинается с конкретного захвата внимания.
- КРАСНАЯ НИТЬ: Разделы логически строятся друг на друге.

Отвечайте ИСКЛЮЧИТЕЛЬНО в виде JSON-объекта следующей структуры:

{
  "title": "Короткий, увлекательный заголовок (макс 8 слов)",
  "summary": "Резюме для детей в 1-3 предложениях",
  "sections": [
    ${sectionSchema}
  ],
  "coverImagePrompt": "English: Kid-friendly watercolor cover illustration showing [main topic visual]. Axel Scheffler style, bright warm colors, educational, joyful, no text."
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
