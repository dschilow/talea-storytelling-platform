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

export interface AudioDokuScene {
  /** Aufeinanderfolgende Szenen-Index (1-basiert) */
  index: number;
  /** Erste Skript-Zeile dieser Szene (1-basiert, inklusive) */
  startLine: number;
  /** Letzte Skript-Zeile dieser Szene (inklusive) */
  endLine: number;
  /** Kurze deutsche Beschreibung der Szene fuer das UI */
  description: string;
  /** Englischer Prompt fuer ElevenLabs Sound-Generation, beschreibt den Ambient-Sound */
  ambientPrompt: string;
  /** Default-Lautstaerke (0.0-1.0) der Ambient-Spur unter dem Dialog. Empfehlung: 0.0-0.14 */
  ambientVolume: number;
}

export interface AudioDokuScriptResponse {
  script: string;
  title: string;
  ageGroup: string;
  category: string;
  coverPrompt: string;
  description: string;
  /** Drehbuch: Aufschluesselung des Skripts in Szenen mit jeweils eigenem Hintergrund-Ambient */
  screenplay: AudioDokuScene[];
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

    const payload: Record<string, unknown> = {
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 4000,
      reasoning_effort: "low",
    };

    const data = await callOpenAI(payload, 90_000, "openai-audio-doku-topics");
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

    // 1 minute audio ≈ 130 words (kid-friendly pace, pauses, emotion tags)
    // 1 script line ≈ 10-12 words → ~11 lines/min
    const approxWords = durationMinutes * 130;
    const minLines = Math.round(durationMinutes * 11);
    const approxLines = Math.max(10, minLines);

    const speakerListText = cleanedSpeakers
      .map((name, idx) => `${idx + 1}. ${name}`)
      .join("\n");

    const system = `Du bist ein erstklassiger Autor und Sound-Designer für hochspannende, professionell produzierte Kinder-Audio-Dokus im Stil von Checker Tobi, Galileo, BBC Earth und National Geographic Kids.

Deine Aufgabe: Erstelle ein Dialog-Skript MIT Drehbuch (Szenen-Aufteilung mit Hintergrund-Ambient) für eine Audio-Doku, die per Text-zu-Sprache (ElevenLabs Eleven v3) vertont wird.

============================================================
TEIL 1 — STRENGES SKRIPT-FORMAT
============================================================
- Jede Zeile: SPRECHERNAME: gesprochener Text
- Optional darf am Zeilenanfang genau 1 sparsames Emotion-Tag stehen.
- Beispiel: TAVI: [excited] Heute tauchen wir ab in die Tiefsee!
- KEINE Leerzeilen.
- KEINE Zeile ohne gesprochenen Text. "TAVI: [clapping]" alleine ist ungültig.
- Jede Zeile MUSS gesprochenen Text enthalten neben den Tags.
- Sprechernamen ausschließlich aus der vorgegebenen Liste, GROSSBUCHSTABEN, immer gleich geschrieben.
- Maximal 1 Emotion-Tag direkt vor dem Text (am Anfang nach dem Doppelpunkt).
- Inline-Sound-FX-Tags sind erlaubt, aber selten: maximal 1 Tag pro Zeile und nur an echten dramaturgischen Momenten.
- Saubere, kurze, lebendige Sätze. Kein Wikipedia-Stil.

EMOTION-TAGS (verändern die Stimme — am Zeilenanfang):
[excited] [curious] [thoughtful] [warm] [dramatic] [serious] [awe]
[surprised] [whispers] [calmly] [nervous] [confused] [proudly]

INLINE-SOUND-FX-TAGS:
- Erlaubt als punktuelle ElevenLabs-Regie, nicht als Daueratmosphaere.
- Verwende solche Tags bewusst als Akzente: mehrere pro Doku sind erwünscht, aber nie mehrere direkt hintereinander.
- Gute Einsaetze: [gasp] fuer eine echte Ueberraschung, [heartbeat] fuer einen kurzen Koerper-Moment, [bubbles] beim konkreten Abtauchen, [applause] nur als echtes Finale.
- Keine Tags nur wegen Witz oder Dekoration. Wenn ein Effekt nicht punktgenau passt, weglassen.

============================================================
TEIL 2 — DREHBUCH (SZENEN MIT HINTERGRUND-AMBIENT)
============================================================
Zusätzlich zum Skript erzeugst du ein Drehbuch (screenplay), das das Skript in 3-7 redaktionelle Abschnitte aufteilt.
Jede Szene darf einen passenden HINTERGRUND-SOUND bekommen, wenn die Szene akustisch wirklich etwas hergibt.
Wenn kein klar passender Sound existiert, bleibt die Szene bewusst stumm.

Pro Szene:
- index: 1, 2, 3, ...
- startLine: erste Skript-Zeile dieser Szene (1-basiert, inklusive)
- endLine: letzte Skript-Zeile dieser Szene (inklusive)
- description: kurze deutsche Szenen-Beschreibung (z.B. "Briefing an Bord des Forschungsschiffs")
- ambientPrompt: ENGLISCHER Sound-Prompt für ElevenLabs Sound Generation.

  KRITISCH WICHTIG: Sound wird nur erzeugt, wenn er aus dem Inhalt der Szene logisch folgt.
  - Passend: Meer bei Ozean/Kueste/Tiefsee; Voegel bei Wald/Garten/Morgen; Bienen bei Blumen/Wiese/Insekten; Donner/Regen bei Gewitter/Wetter; Labor-/Maschinenhum bei Technik; sanfte Musik bei abstrakten Erklaer- oder Zusammenfassungsstellen.
  - Unpassend: Supermarkt, Einkaufstueten, Kantine oder Kueche nur weil es um Ernaehrung geht. Solche Orte nur nutzen, wenn das Skript wirklich dort spielt.
  - Kein Dauer-Foley mit vielen Einzelgeraeschen. Lieber 1-3 klare, ruhige Soundquellen.
  - Keine Stimmen, kein verstaendliches Gemurmel, kein Gesang. Musik nur als sehr sanftes instrumentales Doku-Bett.
  - Erklaerpassagen ohne klare akustische Szene duerfen bewusst keinen Ambient haben: ambientVolume 0.

  GUTE Beispiele (passend, atmosphaerisch, nicht ablenkend):
  * "skip ambient - voice only, no music, no voices"
  * "calm ocean shore with gentle rolling waves, soft sea breeze, distant gulls, spacious documentary atmosphere, no music, no voices"
  * "spring meadow with soft bees buzzing around flowers, light grass movement, warm afternoon air, gentle natural ambience, no music, no voices"
  * "quiet forest morning with distant birds singing, soft leaves rustling, light breeze through trees, peaceful nature documentary ambience, no music, no voices"
  * "distant thunderstorm with low rolling thunder, soft rainfall outside, muted room tone, tense but safe documentary mood, no music, no voices"
  * "soft warm instrumental documentary music bed, minimal melody, no percussion, no vocals"
  * "very subtle studio room tone with gentle air, soft warmth, no distinct foley, no music, no voices"
  * "quiet science documentary bed with low soft texture, slow gentle movement, no percussion, no vocals"

  SCHLECHTE Beispiele (NICHT verwenden - nicht aus der Szene begruendet oder als Dauerteppich stoerend):
  * "busy supermarket with shopping bags and carts"
  * "kitchen with constant knife chopping and plate clinks"
  * "school cafeteria with chatter and cutlery"

- ambientVolume: 0 fuer weglassen, 0.06 bis 0.14 fuer dezente Natur-/Raum-/Musikbetten, maximal 0.18. Der Dialog muss immer klar vorne bleiben.

REGELN für das Drehbuch:
- Die Szenen müssen lückenlos das gesamte Skript abdecken (von Zeile 1 bis zur letzten Zeile).
- Keine Lücken zwischen Szenen, keine Überlappungen.
- 3-7 Szenen je nach Skript-Länge.
- Jede Szene mindestens 4 Skript-Zeilen lang.
- Die Szenenwechsel sollen sich AUS dem Skript ergeben (Themen-/Orts-Wechsel).

DRAMATURGIE:
1. Starker Hook in den ersten 2-3 Zeilen.
2. Klare Hauptfrage / Thema-Einführung.
3. Spannender Verlauf mit Wow-Fakten, Vergleichen aus dem Kinderalltag, Aha-Momenten.
4. Mindestens 1 Twist / Überraschung.
5. Emotional starkes Finale: Der erste Sprecher fasst in 1-2 Sätzen zusammen was die Expedition/das Abenteuer bedeutet hat — themenspezifisch und emotional. Beispiel: "Mission geschafft. Wir waren dort, wo kein Sonnenlicht hinkommt… und haben trotzdem Licht gefunden." Das Skript endet HIER. Keine Verabschiedung, kein "Bis zum nächsten Mal" — das kommt automatisch danach.

INHALT:
- Faktisch korrekt, kindgerecht erklärt, niemals belehrend.
- Bildhafte Sprache, kurze Sätze, viel Kopfkino.
- Dialog mit echtem Wechselspiel: Fragen, Reaktionen, Staunen, kleine Witze (nicht zu viele).
- Natürliche Mischung aller Sprecher: jeder Sprecher kommt regelmäßig zu Wort.

ZUSÄTZLICH erzeugst du Metadaten:

- title: WICHTIG! Der Titel muss sofort Neugier wecken und Lust aufs Hören machen.
  VERBOTEN: "Alles über X", "Die Geschichte von X", "X erklärt", reine Substantiv-Ketten, langweilige Beschreibungen.
  ERLAUBT und erwünscht: "Warum...", "Wie...", "Das geheime Leben von...", "Das verrückte Geheimnis von...", "Was wäre wenn...", rhetorische Fragen, überraschende Formulierungen, Spannung erzeugende Titel.
  LÄNGE: 5–10 Wörter, in der Sprache der Doku.
  BEISPIELE für gute Titel: "Warum leuchten Tiere in der Tiefsee?", "Das geheime Leben der Pilze", "Was wäre wenn die Sonne erlischt?", "Wie ein Raketenstart die Welt verändert"

- ageGroup: Altersangabe als Bereich z.B. "6-8".

- category: Eine der Kategorien Abenteuer, Wissen, Natur, Tiere, Geschichte, Entspannung.

- coverPrompt: ENGLISCH, exakt im folgenden Format als ein zusammenhängender Absatz. PFLICHT: Die beiden Moderatoren-Figuren MÜSSEN im Vordergrund sichtbar sein!
  "Square 1:1  Theme: <one-line topic theme>. <Detailed visual scene with environment, atmosphere, lighting, foreground subjects, background details, sound visualized as particles/wind/etc>. Foreground: two cheerful cartoon hosts (<description of host 1: adult male presenter, e.g. warm parka, goggles, scientific equipment> and <description of host 2: curious young girl sidekick, e.g. colorful jacket, backpack>) standing amazed and pointing toward the scene. <Additional wildlife/detail elements>. Modern clean premium illustration, smooth gradients, soft glow, high contrast, crisp outlines, cinematic depth of field, adventurous but not scary, kid-friendly, ultra-detailed, balanced composition with open space, no writing, no symbols that resemble letters or numbers."
  Der Moderator (TAVI) ist ein erwachsener, freundlicher Männer-Presenter. Das Mädchen (LUMI) ist eine neugierige junge Sidekick. Beide MÜSSEN erkennbar im Bild sein.

- description: 2-3 Sätze auf Deutsch, die neben dem Player als Beschreibung erscheinen.

============================================================
TEIL 3 - REALISTISCHER AUDIO-MIX: DIESE REGELN HABEN VORRANG
============================================================
Ziel ist eine echte, professionelle Wissens-Doku, nicht ein Hoerspiel mit Dauer-Geraeuschen.
Die Sprache bleibt immer die Hauptspur. Sound darf nur helfen, wenn er den Inhalt wirklich klarer macht.

SPRECHER-TEXT:
- Nutze Emotion-Tags sparsam. Nicht jede Zeile braucht ein Tag.
- Erlaubt sind nur zur Stimme passende Start-Tags wie [excited], [curious], [thoughtful], [warm], [serious], [awe], [calmly], [proudly], [confused], [nervous].
- Inline-Sound-FX-Tags wie [heartbeat], [gasp], [applause] oder [bubbles] sind erlaubt, aber nur als einzelne kurze Akzente an eindeutig passenden Stellen.
- Nutze Inline-Sound-FX regelmäßig dort, wo sie inhaltlich tragen. Nie als wiederkehrenden Running Gag.
- Wenn ein Effekt nur "lustig" oder "dramatisch" waere, schreibe lieber eine natuerliche Reaktion als gesprochenen Text.

HINTERGRUND-AMBIENT:
- Ambient ist OPTIONAL. Wenn kein wirklich passender, ruhiger Sound existiert, setze ambientVolume auf 0 und ambientPrompt auf "skip ambient - voice only, no music, no voices".
- Erzeuge Hintergrund-Sound, wenn die Szene klar danach ruft: Meeresrauschen, Voegel, Bienen, Regen, Donner, Wind, Laborhum, Maschinenhum oder sanfte Musik duerfen und sollen genutzt werden, wenn sie wirklich passen.
- Erfinde keine Orte nur wegen eines Begriffs. Bei Ernaehrung also KEIN dauerhafter Supermarkt, keine Einkaufstueten, keine Kantine, kein staendiges Schneiden, nur weil Essen vorkommt.
- Weil der aktuelle Ambient pro Szene durchgehend laeuft, darf er niemals aus auffaelligen Einzelgeraeuschen bestehen. Keine permanenten Tueten, Kassen, Messer, Stimmen, Schritte, Tiere, Maschinen oder Action-Foley unter Erklaertext.
- Gute automatische Sounds sind leise, neutral und breit: soft ocean waves, distant birds, gentle bees, low rain, distant thunder, soft documentary room tone, gentle warm instrumental documentary bed, very subtle studio air, soft transition texture. Immer ohne Stimmen.
- Wenn Musik sinnvoller ist als Foley, formuliere den Prompt als "soft warm instrumental documentary music bed, minimal melody, no percussion, no vocals".
- Lautstaerke: 0 fuer weglassen, 0.05-0.10 fuer dezente Betten, 0.11-0.14 nur fuer eindeutig passende ruhige Szenen, maximal 0.18.
- Aufeinanderfolgende Szenen muessen NICHT zwanghaft unterschiedlich klingen. Konsistenz ist besser als stoerende Abwechslung.

Antworte AUSSCHLIESSLICH als JSON-Objekt:
{
  "script": "SPRECHER1: [warm] Text mit passenden Inline-FX wie [gasp] oder [heartbeat]\\nSPRECHER2: Text mit passender Reaktion\\n...",
  "title": "...",
  "ageGroup": "...",
  "category": "...",
  "coverPrompt": "...",
  "description": "...",
  "screenplay": [
    {
      "index": 1,
      "startLine": 1,
      "endLine": 6,
      "description": "Ruhiger Einstieg",
      "ambientPrompt": "soft warm instrumental documentary music bed, minimal melody, no percussion, no vocals",
      "ambientVolume": 0.08
    },
    {
      "index": 2,
      "startLine": 7,
      "endLine": 14,
      "description": "Sachliche Erklaerpassage",
      "ambientPrompt": "skip ambient - voice only, no music, no voices",
      "ambientVolume": 0
    }
  ]
}`;

    // Build speaker descriptions for cover prompt
    const hostDesc = cleanedSpeakers.length >= 2
      ? `${cleanedSpeakers[0]} (adult male science host, friendly explorer style with simple goggles and warm jacket, holding a prop related to the topic) and ${cleanedSpeakers[1]} (curious young girl sidekick in a colorful jacket with a small backpack, wide-eyed and excited)`
      : cleanedSpeakers.length === 1
        ? `${cleanedSpeakers[0]} (friendly adult male science host, explorer style with goggles and warm jacket)`
        : "two cheerful cartoon hosts (adult male explorer/science host with simple goggles and warm jacket, and a curious young girl sidekick in a colorful jacket)";

    const user = `THEMA DER AUDIO-DOKU: "${topic}"

Zielgruppe: ${ageFrom}-${ageTo} Jahre
Geplante Audio-Dauer: ${durationMinutes} Minuten (≈ ${approxWords} gesprochene Wörter)
PFLICHT: Das Skript MUSS MINDESTENS ${approxLines} Zeilen haben. Kürzer ist ein Fehler!
Anzahl Sprecher: ${speakerCount}

SPRECHER (in dieser Reihenfolge und exakt mit diesen Namen verwenden, alle Großbuchstaben):
${speakerListText}

COVER-PROMPT PFLICHT: Beide Sprecher MÜSSEN im Vordergrund sichtbar sein.
Sprecher-Beschreibung für Cover: ${hostDesc}

Erstelle das vollständige Skript jetzt nach den oben genannten Regeln.

WICHTIG: Validiere selbst vor der Ausgabe:
- Hat das Skript MINDESTENS ${approxLines} Zeilen? -> Wenn nein, WEITER SCHREIBEN bis Mindestlänge erreicht!
- Gibt es Leerzeilen? -> Entfernen.
- Hat jede Zeile gesprochenen Text neben Tags? -> Wenn nein, korrigieren.
- Werden ALLE angegebenen Sprecher genutzt? -> Wenn nein, ergänzen.
- Sprechernamen exakt wie vorgegeben in Großbuchstaben? -> Wenn nein, korrigieren.
- Coverprompt im exakten Square-1:1-Format und auf Englisch?
- Ist der Hook stark, gibt es einen Twist, ist das Finale stark?
- Enthält das Skript Inline-Sound-FX-Tags nur selten und punktgenau passend? -> Wenn nein, reduzieren oder entfernen.
- Hat jede aktive Szene im screenplay einen englischen ambientPrompt ohne Stimmen? Bei unsicherem Kontext: ambientVolume 0 und "skip ambient - voice only, no music, no voices".
- Decken die screenplay-Szenen ALLE Skript-Zeilen ab (lückenlos, keine Überlappung)?
- Ist die LETZTE Szene endLine = letzte Skript-Zeilennummer?`;

    // gpt-5.4-mini is a reasoning model: reasoning tokens are INCLUDED in max_completion_tokens.
    // With reasoning_effort "low", the model uses ~2000-4000 reasoning tokens internally.
    // Content budget: 1 script line ≈ 20 tokens JSON-encoded + screenplay/metadata overhead.
    // We need: reasoning reserve (4000) + content (approxLines × 20 + 3000 overhead) → cap at 32000.
    const completionTokenLimit = Math.min(32000, 4000 + approxLines * 20 + 3000);

    const payload: Record<string, unknown> = {
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: completionTokenLimit,
      reasoning_effort: "low",
    };

    const timeoutMs = durationMinutes >= 10 ? 300_000 : 240_000;
    const data = await callOpenAI(payload, timeoutMs, "openai-audio-doku-script");
    const choice = data.choices?.[0];
    const content = choice?.message?.content;
    const finishReason = choice?.finish_reason;
    const usage = data.usage || {};

    console.log(
      `[AudioDokuScript] finish_reason=${finishReason} prompt_tokens=${usage.prompt_tokens} completion_tokens=${usage.completion_tokens} reasoning_tokens=${usage.completion_tokens_details?.reasoning_tokens} content_len=${content?.length ?? 0}`,
    );

    if (!content) {
      throw new Error(
        `OpenAI returned no content (finish_reason=${finishReason}, completion_tokens=${usage.completion_tokens}, reasoning_tokens=${usage.completion_tokens_details?.reasoning_tokens}). Try a shorter duration or increase token budget.`,
      );
    }

    let parsed: {
      script?: unknown;
      title?: unknown;
      ageGroup?: unknown;
      category?: unknown;
      coverPrompt?: unknown;
      description?: unknown;
      screenplay?: unknown;
    };
    try {
      parsed = JSON.parse(stripJsonFences(content));
    } catch (err) {
      throw new Error(
        `OpenAI returned invalid JSON for audio doku script (finish_reason=${finishReason}, content_len=${content.length}). First 200 chars: ${content.slice(0, 200)}`,
      );
    }

    const rawScript = typeof parsed.script === "string" ? parsed.script : "";
    const sanitizedScript = sanitizeScript(rawScript, cleanedSpeakers);
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

    const totalLines = sanitizedScript.split("\n").length;
    const screenplay = normalizeScreenplay(parsed.screenplay, totalLines, topic);

    return {
      script: sanitizedScript,
      title,
      ageGroup,
      category,
      coverPrompt,
      description,
      screenplay,
    };
  },
);

/**
 * Normalisiert das Drehbuch:
 * - Stellt sicher, dass jede Zeile (1..totalLines) genau EINER Szene zugeordnet ist.
 * - Lücken werden mit der vorigen oder einer Default-Szene gefüllt.
 * - Falls kein gültiges screenplay vorhanden, wird ein einzelnes Default-Szenario erzeugt.
 */
const normalizeScreenplay = (
  raw: unknown,
  totalLines: number,
  topic: string,
): AudioDokuScene[] => {
  const fallbackPrompt = `skip ambient - voice only for "${topic}", no music, no voices`;

  const fallback: AudioDokuScene[] = [
    {
      index: 1,
      startLine: 1,
      endLine: Math.max(1, totalLines),
      description: "Hauptszene",
      ambientPrompt: fallbackPrompt,
      ambientVolume: 0,
    },
  ];

  if (!Array.isArray(raw) || raw.length === 0) return fallback;

  const candidates: AudioDokuScene[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const startLine = Number(obj.startLine);
    const endLine = Number(obj.endLine);
    if (!Number.isFinite(startLine) || !Number.isFinite(endLine)) continue;
    if (endLine < startLine) continue;
    const ambientPrompt = typeof obj.ambientPrompt === "string" ? obj.ambientPrompt.trim() : "";
    if (!ambientPrompt) continue;
    const description = typeof obj.description === "string" ? obj.description.trim() : "";
    const volRaw = Number(obj.ambientVolume);
    const ambientVolume = Number.isFinite(volRaw)
      ? Math.max(0, Math.min(0.18, volRaw))
      : 0;

    candidates.push({
      index: candidates.length + 1,
      startLine: Math.max(1, Math.floor(startLine)),
      endLine: Math.max(1, Math.floor(endLine)),
      description: description || `Szene ${candidates.length + 1}`,
      ambientPrompt,
      ambientVolume,
    });
  }

  if (candidates.length === 0) return fallback;

  // Sort by startLine, then patch overlaps and gaps.
  candidates.sort((a, b) => a.startLine - b.startLine);

  // Clamp to [1, totalLines] and ensure contiguous coverage.
  const fixed: AudioDokuScene[] = [];
  let cursor = 1;
  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i];
    const start = Math.max(cursor, Math.min(c.startLine, totalLines));
    const end = Math.max(start, Math.min(c.endLine, totalLines));
    if (start > totalLines) break;
    fixed.push({
      index: fixed.length + 1,
      startLine: start,
      endLine: end,
      description: c.description,
      ambientPrompt: c.ambientPrompt,
      ambientVolume: c.ambientVolume,
    });
    cursor = end + 1;
    if (cursor > totalLines) break;
  }

  if (fixed.length === 0) return fallback;

  // If last scene didn't reach totalLines, extend it.
  const last = fixed[fixed.length - 1];
  if (last.endLine < totalLines) {
    last.endLine = totalLines;
  }

  return fixed;
};

const ALLOWED_AUDIO_DOKU_VOICE_TAGS = new Set([
  "excited",
  "curious",
  "mischievously",
  "thoughtful",
  "giggles",
  "warm",
  "dramatic",
  "serious",
  "awe",
  "surprised",
  "laughs",
  "whispers",
  "inhales deeply",
  "shouts",
  "sighs",
  "calmly",
  "nervous",
  "confused",
  "proudly",
]);

const ALLOWED_AUDIO_DOKU_INLINE_FX_TAGS = new Set([
  "applause",
  "clapping",
  "laughter",
  "gasp",
  "heartbeat",
  "explosion",
  "bubbles",
  "water splash",
  "submarine hum",
  "whale call",
  "ocean waves",
  "thunder",
  "rainfall",
  "wind howling",
  "storm",
  "hail",
  "bird chirping",
  "wolf howl",
  "lion roar",
  "dog barking",
  "horse galloping",
  "rocket boost",
  "radio static",
  "engine roar",
  "beeping",
  "door slam",
  "door creaks",
  "crackling fire",
  "leaves rustling",
  "stones falling",
  "river flowing",
  "crickets chirping",
  "footsteps",
  "glass shatter",
  "sword clash",
  "running",
  "climbing",
]);

const normalizeAudioDokuTagName = (value: string): string =>
  value.replace(/\s+/g, " ").trim().toLowerCase();

const spokenTextWithoutTags = (value: string): string =>
  value.replace(/\[[^\]\r\n]*\]/g, " ").replace(/\s+/g, " ").trim();

const sanitizeSpokenTextWithInlineFx = (value: string): string =>
  value
    .replace(/\[([^\]\r\n]{1,60})\]/g, (_full, rawTag: string) => {
      const tagName = normalizeAudioDokuTagName(rawTag);
      if (ALLOWED_AUDIO_DOKU_INLINE_FX_TAGS.has(tagName)) {
        return ` [${tagName}] `;
      }
      return " ";
    })
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

const sanitizeDialogueLineTags = (line: string): string => {
  const match = line.match(/^(\s*[^:\n]{1,80}:\s*)(.*)$/);
  if (!match) {
    return sanitizeSpokenTextWithInlineFx(line);
  }

  const prefix = match[1];
  let text = match[2].trim();
  const leadingTag = text.match(/^\[([^\]\r\n]{1,40})\]\s*/);
  let safeLeadingTag = "";

  if (leadingTag) {
    const tagName = normalizeAudioDokuTagName(leadingTag[1]);
    if (ALLOWED_AUDIO_DOKU_VOICE_TAGS.has(tagName)) {
      text = text.slice(leadingTag[0].length).trim();
      safeLeadingTag = `[${tagName}] `;
    }
  }

  const spoken = sanitizeSpokenTextWithInlineFx(text);
  return `${prefix}${safeLeadingTag}${spoken}`.trim();
};

const sanitizeScript = (raw: string, speakers: string[]): string => {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const cleaned: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const sanitized = sanitizeDialogueLineTags(trimmed);
    if (!spokenTextWithoutTags(sanitized.split(":").slice(1).join(":"))) continue;
    cleaned.push(sanitized);
  }

  // Remove any AI-generated sign-off lines to avoid duplicates before appending our outro.
  const signOffPatterns = [
    /bis zur nächsten/i,
    /bis zum nächsten/i,
    /tschüss/i,
    /auf wiedersehen/i,
    /see you/i,
    /bye/i,
  ];
  while (cleaned.length > 0) {
    const last = cleaned[cleaned.length - 1];
    const afterColon = last.split(":").slice(1).join(":").toLowerCase();
    if (signOffPatterns.some((p) => p.test(afterColon) || p.test(last))) {
      cleaned.pop();
    } else {
      break;
    }
  }

  // Die thematische Abschlusszeile (host1) kommt vom Modell.
  // Wir hängen nur die feste Verabschiedung des zweiten Sprechers an.
  const host2 = speakers[1] ?? speakers[0] ?? "LUMI";
  cleaned.push(`${host2}: [excited] Bis zur naechsten Doku! [applause] Tschuess!`);

  return cleaned.join("\n");
};
