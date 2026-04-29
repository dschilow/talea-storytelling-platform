import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { getAuthData } from "~encore/auth";
import { logTopic } from "../log/logger";
import { publishWithTimeout } from "../helpers/pubsubTimeout";

const openAIKey = secret("OpenAIKey");
const MODEL = "gpt-5.4-mini";

export interface AudioDokuTopicsRequest {
  ageFrom: number;
  ageTo: number;
  durationMinutes: number;
  speakerCount: number;
  direction?: string;
}

export interface AudioDokuTopicsResponse {
  topics: string[];
}

export interface AudioDokuScriptRequest {
  topic: string;
  ageFrom: number;
  ageTo: number;
  durationMinutes: number;
  speakerNames: string[];
}

export interface AudioDokuScriptResponse {
  script: string;
  title: string;
  ageGroup: string;
  category: string;
  coverPrompt: string;
  description: string;
}

const stripJsonFences = (raw: string): string =>
  raw.replace(/```json\s*|\s*```/g, "").trim();

type AudioDokuLogSource = "openai-audio-doku-topics" | "openai-audio-doku-script";

const callOpenAI = async (
  payload: Record<string, unknown>,
  timeoutMs: number,
  source: AudioDokuLogSource,
): Promise<any> => {
  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAIKey()}`,
      },
      body: JSON.stringify(payload),
      signal: abortController.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI error ${res.status}: ${errText}`);
    }

    const data = await res.json();

    await publishWithTimeout(logTopic, {
      source,
      timestamp: new Date(),
      request: payload,
      response: data,
    });

    return data;
  } catch (error) {
    if ((error as any)?.name === "AbortError") {
      throw new Error(`OpenAI request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
};

export const generateAudioDokuTopics = api<AudioDokuTopicsRequest, AudioDokuTopicsResponse>(
  { expose: true, method: "POST", path: "/doku/audio-script/topics", auth: true },
  async (req) => {
    const auth = getAuthData();
    if (!auth?.userID) {
      throw APIError.unauthenticated("Login required");
    }

    const ageFrom = Math.max(2, Math.min(18, Math.floor(req.ageFrom || 6)));
    const ageTo = Math.max(ageFrom, Math.min(18, Math.floor(req.ageTo || 8)));
    const durationMinutes = Math.max(1, Math.min(60, Math.floor(req.durationMinutes || 5)));
    const speakerCount = Math.max(1, Math.min(8, Math.floor(req.speakerCount || 2)));
    const direction = (req.direction || "").trim();

    const directionInstruction = direction
      ? `Themenrichtung des Nutzers: "${direction}". Schlage 10 unterschiedliche, konkrete Doku-Themen vor, die zu dieser Richtung passen.`
      : `Es wurde keine Themenrichtung angegeben. Schlage 10 spannende, abwechslungsreiche Doku-Themen frei aus verschiedenen Bereichen vor (Natur, Weltall, Geschichte, Technik, Tiere, Erfindungen, Mensch & Körper, Erde & Klima, Kunst & Kultur, Mysterien).`;

    const system = `Du bist ein Redakteur für eine erstklassige Kinder-Audio-Doku-Reihe (Stil: Checker Tobi / WDR Maus / Galileo für Kinder).
Deine Aufgabe: konkrete, neugierig machende Doku-Themen für eine Audio-Doku zu erstellen.

REGELN:
- Jedes Thema ist EIN kurzer, packender Titel (max 8 Wörter).
- KEINE generischen Titel wie "Alles über Tiere" oder "Die Welt der...".
- Nutze Formulierungen wie "Warum...", "Wie...", "Das geheime Leben von...", "Das verrückte Geheimnis...".
- Themen müssen für die angegebene Altersgruppe passend sein.
- Themen müssen für eine Audio-Doku der angegebenen Dauer realistisch erzählbar sein.
- KEINE doppelten oder zu ähnlichen Themen.
- Themen sind kindgerecht, sicher, faszinierend.

Antworte AUSSCHLIESSLICH als JSON: { "topics": ["Thema 1", "Thema 2", ...] }`;

    const user = `Zielgruppe: ${ageFrom}-${ageTo} Jahre
Geplante Dauer der Audio-Doku: ${durationMinutes} Minuten
Anzahl Sprecher im Dialog: ${speakerCount}

${directionInstruction}

Liefere genau 10 Themenvorschläge.`;

    const payload = {
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1200,
    };

    const data = await callOpenAI(payload, 60_000, "openai-audio-doku-topics");
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI returned no content");
    }

    let parsed: { topics?: unknown };
    try {
      parsed = JSON.parse(stripJsonFences(content));
    } catch (err) {
      throw new Error("OpenAI returned invalid JSON for topics");
    }

    const rawTopics = Array.isArray(parsed.topics) ? parsed.topics : [];
    const topics = rawTopics
      .map((t) => (typeof t === "string" ? t.trim() : ""))
      .filter((t) => t.length > 0)
      .slice(0, 10);

    if (topics.length === 0) {
      throw new Error("Keine Themen generiert");
    }

    return { topics };
  },
);

export const generateAudioDokuScript = api<AudioDokuScriptRequest, AudioDokuScriptResponse>(
  { expose: true, method: "POST", path: "/doku/audio-script/generate", auth: true },
  async (req) => {
    const auth = getAuthData();
    if (!auth?.userID) {
      throw APIError.unauthenticated("Login required");
    }

    const topic = (req.topic || "").trim();
    if (!topic) {
      throw APIError.invalidArgument("topic is required");
    }

    const ageFrom = Math.max(2, Math.min(18, Math.floor(req.ageFrom || 6)));
    const ageTo = Math.max(ageFrom, Math.min(18, Math.floor(req.ageTo || 8)));
    const durationMinutes = Math.max(1, Math.min(60, Math.floor(req.durationMinutes || 5)));

    const cleanedSpeakers = (req.speakerNames || [])
      .map((name) => (typeof name === "string" ? name.trim() : ""))
      .filter((name) => name.length > 0);

    if (cleanedSpeakers.length < 1) {
      throw APIError.invalidArgument("At least one speaker name is required");
    }

    const speakerCount = cleanedSpeakers.length;

    // Roughly: 1 minute audio ≈ 150 words spoken in dialogue (slower pace, kid-friendly)
    const approxWords = durationMinutes * 150;
    const approxLines = Math.max(8, Math.round(durationMinutes * 12));

    const speakerListText = cleanedSpeakers
      .map((name, idx) => `${idx + 1}. ${name}`)
      .join("\n");

    const system = `Du bist ein erstklassiger Autor für hochspannende Kinder-Audio-Dokus im Stil von Checker Tobi und Galileo für Kinder.

Deine Aufgabe: Erstelle ein Dialog-Skript für eine Audio-Doku, die per Text-zu-Sprache (ElevenLabs) vertont wird.

STRENGES SKRIPT-FORMAT (MUSS EXAKT EINGEHALTEN WERDEN):
- Jede Zeile: SPRECHERNAME: [emotion] gesprochener Text
- Beispiel: TAVI: [excited] Heute tauchen wir ab in die Tiefsee!
- KEINE Leerzeilen.
- KEINE Zeile ohne gesprochenen Text. "TAVI: [clapping]" alleine ist ungültig.
- Jede Zeile MUSS gesprochenen Text enthalten neben den Emotion-Tags.
- Sound-Effekte wie [submarine hum] oder [water splash] dürfen am Zeilenende stehen, aber nur wenn auch gesprochener Text in der Zeile vorkommt.
- Sprechernamen ausschließlich aus der vorgegebenen Liste, GROSSBUCHSTABEN, immer gleich geschrieben.
- Erlaubte Emotion-Tags: [excited], [curious], [mischievously], [thoughtful], [giggles], [warm], [dramatic], [serious], [awe], [surprised], [laughs], [whispers], [inhales deeply], [woo].
- Maximal 1 Emotion-Tag am Anfang jeder Zeile (Sound-Effekte sind extra).
- Saubere, kurze, lebendige Sätze. Kein Wikipedia-Stil.

DRAMATURGIE:
1. Starker Hook in den ersten 2-3 Zeilen.
2. Klare Hauptfrage / Thema-Einführung.
3. Spannender Verlauf mit Wow-Fakten, Vergleichen aus dem Kinderalltag, Aha-Momenten.
4. Mindestens 1 Twist / Überraschung.
5. Emotional starkes Finale, kein abruptes Ende.

INHALT:
- Faktisch korrekt, kindgerecht erklärt, niemals belehrend.
- Bildhafte Sprache, kurze Sätze, viel Kopfkino.
- Dialog mit echtem Wechselspiel: Fragen, Reaktionen, Staunen, kleine Witze (nicht zu viele).
- Natürliche Mischung aller Sprecher: jeder Sprecher kommt regelmäßig zu Wort.

ZUSÄTZLICH erzeugst du Metadaten:
- title: Titel der Doku (max 10 Wörter, neugierig machend, KEIN "Alles über..."), in der Sprache der Doku.
- ageGroup: Altersangabe als Bereich z.B. "6-8".
- category: Eine der Kategorien Abenteuer, Wissen, Natur, Tiere, Geschichte, Entspannung.
- coverPrompt: ENGLISCH, exakt im folgenden Format als ein zusammenhängender Absatz:
  "Square 1:1  Theme: <one-line topic theme>. <Detailed visual scene with hosts/characters, environment, atmosphere, lighting, foreground subjects, animals/details, sound visualized as particles/wind/etc>. Modern clean premium illustration, smooth gradients, soft glow, high contrast, crisp outlines, cinematic depth of field, adventurous but not scary, kid-friendly, ultra-detailed, balanced composition with open space, no writing, no symbols that resemble letters or numbers."
- description: 2-3 Sätze auf Deutsch, die neben dem Player als Beschreibung erscheinen.

Antworte AUSSCHLIESSLICH als JSON-Objekt:
{
  "script": "SPRECHER1: [emotion] Text\\nSPRECHER2: [emotion] Text\\n...",
  "title": "...",
  "ageGroup": "...",
  "category": "...",
  "coverPrompt": "...",
  "description": "..."
}`;

    const user = `THEMA DER AUDIO-DOKU: "${topic}"

Zielgruppe: ${ageFrom}-${ageTo} Jahre
Geplante Audio-Dauer: ${durationMinutes} Minuten (≈ ${approxWords} gesprochene Wörter, ≈ ${approxLines} Skript-Zeilen)
Anzahl Sprecher: ${speakerCount}

SPRECHER (in dieser Reihenfolge und exakt mit diesen Namen verwenden, alle Großbuchstaben):
${speakerListText}

Erstelle das vollständige Skript jetzt nach den oben genannten Regeln.

WICHTIG: Validiere selbst vor der Ausgabe:
- Gibt es Leerzeilen? -> Entfernen.
- Hat jede Zeile gesprochenen Text neben Tags? -> Wenn nein, korrigieren.
- Werden ALLE angegebenen Sprecher genutzt? -> Wenn nein, ergänzen.
- Sprechernamen exakt wie vorgegeben in Großbuchstaben? -> Wenn nein, korrigieren.
- Coverprompt im exakten Square-1:1-Format und auf Englisch?
- Ist der Hook stark, gibt es einen Twist, ist das Finale stark?`;

    const payload = {
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 12000,
    };

    const timeoutMs = durationMinutes >= 10 ? 240_000 : 180_000;
    const data = await callOpenAI(payload, timeoutMs, "openai-audio-doku-script");
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI returned no content");
    }

    let parsed: {
      script?: unknown;
      title?: unknown;
      ageGroup?: unknown;
      category?: unknown;
      coverPrompt?: unknown;
      description?: unknown;
    };
    try {
      parsed = JSON.parse(stripJsonFences(content));
    } catch (err) {
      throw new Error("OpenAI returned invalid JSON for audio doku script");
    }

    const rawScript = typeof parsed.script === "string" ? parsed.script : "";
    const sanitizedScript = sanitizeScript(rawScript);
    if (!sanitizedScript) {
      throw new Error("OpenAI script was empty after sanitization");
    }

    const title = (typeof parsed.title === "string" && parsed.title.trim()) || topic.slice(0, 80);
    const ageGroup =
      (typeof parsed.ageGroup === "string" && parsed.ageGroup.trim()) || `${ageFrom}-${ageTo}`;
    const category = (typeof parsed.category === "string" && parsed.category.trim()) || "Wissen";
    const coverPrompt =
      (typeof parsed.coverPrompt === "string" && parsed.coverPrompt.trim()) ||
      `Square 1:1  Theme: ${topic}. Modern clean premium illustration, kid-friendly, ultra-detailed, no text, no letters.`;
    const description =
      (typeof parsed.description === "string" && parsed.description.trim()) ||
      `Eine spannende Audio-Doku über ${topic}.`;

    return {
      script: sanitizedScript,
      title,
      ageGroup,
      category,
      coverPrompt,
      description,
    };
  },
);

const sanitizeScript = (raw: string): string => {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const cleaned: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    cleaned.push(trimmed);
  }
  return cleaned.join("\n");
};
