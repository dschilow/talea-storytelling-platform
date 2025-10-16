import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
// Pub/Sub logging disabled (no NSQ on Railway)
// import { logTopic } from "../log/logger";
// import { publishWithTimeout } from "../helpers/pubsubTimeout";

const openAIKey = secret("OpenAIKey");
const MODEL = "gpt-5-nano";

export interface PersonalityAnalysisRequest {
  avatarId: string;
  avatarProfile: {
    name: string;
    description: string;
    currentPersonality: {
      [trait: string]: number; // Current trait values 0-100
    };
  };
  contentType: "story" | "doku" | "quiz";
  contentData: {
    title: string;
    summary?: string;
    learningMode?: {
      enabled: boolean;
      subjects: string[];
      difficulty: string;
      objectives: string[];
    };
    // For stories
    storyContent?: string;
    // For dokus  
    dokuSections?: Array<{
      title: string;
      content: string;
      topic: string;
    }>;
    // For quizzes
    quizData?: {
      topic: string;
      questions: Array<{
        question: string;
        correctAnswer: string;
        userAnswer: string;
        isCorrect: boolean;
      }>;
      score: number; // 0-100%
    };
  };
}

export interface PersonalityAnalysisResponse {
  success: boolean;
  changes: Array<{
    trait: string;
    oldValue: number;
    newValue: number;
    change: number;
    reason: string;
  }>;
  summary: string;
  processingTime: number;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export const analyzePersonalityDevelopment = api<PersonalityAnalysisRequest, PersonalityAnalysisResponse>(
  { expose: true, method: "POST", path: "/ai/analyze-personality" },
  async (req) => {
    const startTime = Date.now();
    
    try {
      console.log("🧠 Starting KI personality analysis for avatar:", req.avatarId);
      
      const prompt = buildPersonalityAnalysisPrompt(req);
      
      const payload = {
        model: MODEL,
        messages: [
          {
            role: "system",
            content: `Du bist ein Experte für Persönlichkeitsentwicklung und Kinderpsychologie. Analysiere, wie sich die Persönlichkeit eines Avatars durch eine Geschichte, Doku oder Quiz entwickeln sollte.

WICHTIGE REGELN:
1. Persönlichkeitsänderungen sollen realistisch und begründet sein
2. Maximal +/- 5 Punkte pro Eigenschaft pro Aktivität
3. Nur relevante Eigenschaften verändern (nicht alle)
4. Lernmodus-Themen verstärken entsprechende Eigenschaften
5. Antworten nur als gültiges JSON ohne zusätzlichen Text

PERSÖNLICHKEITSEIGENSCHAFTEN:
- Mut (0-100): Bereitschaft Risiken einzugehen, Herausforderungen zu meistern
- Kreativität (0-100): Fantasie, innovative Problemlösung, künstlerisches Denken  
- Empathie (0-100): Verständnis für andere, emotionale Intelligenz
- Intelligenz (0-100): Logisches Denken, Wissenserwerb, analytische Fähigkeiten
- Sozialität (0-100): Teamwork, Kommunikation, Beziehungsfähigkeit
- Energie (0-100): Enthusiasmus, Aktivität, Ausdauer`
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        max_completion_tokens: 1000,
        response_format: { type: "json_object" },
      };

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAIKey()}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API Fehler: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Pub/Sub logging disabled (no NSQ on Railway)
      // await publishWithTimeout(logTopic, {
      //   source: 'openai-tavi-chat',
      //   timestamp: new Date(),
      //   request: payload,
      //   response: data,
      // });

      console.log("🔍 OpenAI response data:", JSON.stringify({
        choices: data.choices?.length || 0,
        hasChoices: !!data.choices,
        firstChoice: data.choices?.[0] ? {
          hasMessage: !!data.choices[0].message,
          hasContent: !!data.choices[0].message?.content,
          contentLength: data.choices[0].message?.content?.length || 0,
          finishReason: data.choices[0].finish_reason
        } : null,
        usage: data.usage,
        error: data.error
      }, null, 2));

      const choice = data.choices?.[0];
      if (!choice?.message?.content) {
        console.error("❌ OpenAI response missing content:", {
          hasChoices: !!data.choices,
          choicesLength: data.choices?.length || 0,
          choice: choice,
          fullData: data
        });
        throw new Error("Keine Antwort von OpenAI erhalten");
      }

      let parsed;
      try {
        const cleanContent = choice.message.content.replace(/```json\s*|\s*```/g, "").trim();
        parsed = JSON.parse(cleanContent);
      } catch (e) {
        console.error("JSON Parse Fehler:", e);
        console.error("Raw content:", choice.message.content);
        throw new Error(`JSON Parse Fehler: ${e instanceof Error ? e.message : String(e)}`);
      }

      // Validate and process the response
      const changes = parsed.changes || [];
      const validChanges = changes.filter((change: any) => 
        change.trait && 
        typeof change.change === 'number' && 
        Math.abs(change.change) <= 5 && // Max 5 points change
        change.reason
      );

      const processingTime = Date.now() - startTime;
      const tokensUsed = {
        prompt: data.usage?.prompt_tokens ?? 0,
        completion: data.usage?.completion_tokens ?? 0,
        total: data.usage?.total_tokens ?? 0,
      };

      console.log("✅ Personality analysis completed:", validChanges.length, "changes");

      return {
        success: true,
        changes: validChanges,
        summary: parsed.summary || "Persönlichkeitsentwicklung analysiert",
        processingTime,
        tokensUsed
      };

    } catch (error) {
      console.error("❌ Error in personality analysis:", error);
      
      return {
        success: false,
        changes: [],
        summary: "Fehler bei der Persönlichkeitsanalyse",
        processingTime: Date.now() - startTime,
        tokensUsed: { prompt: 0, completion: 0, total: 0 }
      };
    }
  }
);

function buildPersonalityAnalysisPrompt(req: PersonalityAnalysisRequest): string {
  const { avatarProfile, contentType, contentData } = req;
  
  let prompt = `AVATAR-PROFIL:
Name: ${avatarProfile.name}
Beschreibung: ${avatarProfile.description}
Aktuelle Persönlichkeit:
${Object.entries(avatarProfile.currentPersonality)
  .map(([trait, value]) => `- ${trait}: ${value}/100`)
  .join('\n')}

AKTIVITÄT: ${contentType.toUpperCase()}
Titel: ${contentData.title}`;

  if (contentData.summary) {
    prompt += `\nZusammenfassung: ${contentData.summary}`;
  }

  if (contentData.learningMode?.enabled) {
    prompt += `\n\nLERNMODUS AKTIV:
Fächer: ${contentData.learningMode.subjects.join(', ')}
Schwierigkeit: ${contentData.learningMode.difficulty}
Lernziele: ${contentData.learningMode.objectives.join(', ')}`;
  }

  switch (contentType) {
    case 'story':
      if (contentData.storyContent) {
        prompt += `\n\nGESCHICHTEN-INHALT:\n${contentData.storyContent.substring(0, 1500)}...`;
      }
      break;
      
    case 'doku':
      if (contentData.dokuSections) {
        prompt += `\n\nDOKU-ABSCHNITTE:`;
        contentData.dokuSections.forEach(section => {
          prompt += `\n\n${section.title}:\n${section.content.substring(0, 300)}...`;
        });
      }
      break;
      
    case 'quiz':
      if (contentData.quizData) {
        const { topic, score, questions } = contentData.quizData;
        prompt += `\n\nQUIZ-DATEN:
Thema: ${topic}
Ergebnis: ${score}% (${questions.filter(q => q.isCorrect).length}/${questions.length} richtig)

Fragen und Antworten:`;
        questions.forEach((q, i) => {
          prompt += `\n${i+1}. ${q.question}
   Korrekt: ${q.correctAnswer}
   Avatar: ${q.userAnswer} ${q.isCorrect ? '✓' : '✗'}`;
        });
      }
      break;
  }

  prompt += `\n\nAUFGABE:
Analysiere, wie sich die Persönlichkeit von "${avatarProfile.name}" durch diese Aktivität entwickeln sollte.
Berücksichtige: Avatar-Persönlichkeit, Inhalt, Lernmodus, Performance (bei Quiz).

Antworte nur mit diesem JSON-Format:
{
  "changes": [
    {
      "trait": "Eigenschaftsname",
      "oldValue": aktueller_wert,
      "newValue": neuer_wert,
      "change": differenz_plus_oder_minus,
      "reason": "Detaillierte Begründung warum diese Änderung sinnvoll ist"
    }
  ],
  "summary": "Kurze Zusammenfassung der Persönlichkeitsentwicklung"
}`;

  return prompt;
}