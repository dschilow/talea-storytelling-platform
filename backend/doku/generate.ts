import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { secret } from "encore.dev/config";
import { ai } from "~encore/clients";
import { logTopic } from "../log/logger";

const dokuDB = SQLDatabase.named("doku");
const openAIKey = secret("OpenAIKey");

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

      const data = await res.json();

      await logTopic.publish({
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
        const coverPrompt = `Kinderfreundliches Wissens-Cover: ${parsed.coverImagePrompt}. Stil: fröhlich, lehrreich, klare Komposition, helle Farben, kindgerechte Illustration, sichere Inhalte, kein Text im Bild.`;
        const img = await ai.generateImage({
          prompt: coverPrompt,
          width: 640,
          height: 400,
          steps: 28,
          CFGScale: 8.0,
          outputFormat: "WEBP",
        });
        coverImageUrl = img.imageUrl;
      } catch (imgErr) {
        console.warn("Cover image generation failed:", imgErr);
      }

      await dokuDB.exec`
        UPDATE dokus
        SET title = ${parsed.title},
            content = ${JSON.stringify({ sections: parsed.sections })},
            cover_image_url = ${coverImageUrl ?? null},
            status = 'complete',
            updated_at = ${new Date()}
        WHERE id = ${id}
      `;

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

  const system = `Du bist ein erfahrener Kinderwissens-Moderator im Stil von "Checker Tobi" bzw. Galileo Kids.
Schreibe kindgerecht, spannend, präzise und korrekt. Nutze eine neugierige, positive Tonalität.
KEINE gefährlichen, beängstigenden oder ungeeigneten Inhalte.`;

  const user = `Erzeuge ein strukturiertes Lern-Dossier (Doku-Modus) zum Thema: "${config.topic}".

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
}`;

  return {
    model: "gpt-5-nano",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 12000,
  };
}
