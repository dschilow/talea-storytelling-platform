import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { logTopic } from "../log/logger";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { dokuDB } from "./db";
import { claimMeteredUsage } from "../helpers/billing";

import { callOpenRouterChatCompletion } from "../story/openrouter-generation";
import { resolveStorybookReasoning } from "../story/storybook/llm-guards";

// Sol 6.1 via OpenRouter (same writer the Bilderbuch pipeline uses).
const MODEL = "openai/gpt-6.1-sol";

export interface AudioDokuTopicsRequest {
  ageFrom: number;
  ageTo: number;
  durationMinutes: number;
  speakerCount: number;
  direction?: string;
}

export interface AudioDokuExtraSpeakerSuggestion {
  /** Kurzer Sprechername in Großbuchstaben, z.B. "PROFESSOR KAUZ" */
  name: string;
  /** Kurze Rollenbeschreibung, z.B. "schrulliger Tiefsee-Experte" */
  role: string;
  /** Stimm-Hinweis fuer die automatische Stimmenwahl im Frontend. */
  gender?: "female" | "male";
  age?: "young" | "adult" | "old";
}

export interface AudioDokuTopicSuggestion {
  topic: string;
  /** Empfohlene Gesamtzahl Sprecher (inkl. TAVI & LUMI) fuer dieses Thema */
  recommendedSpeakerCount: number;
  /** Zusaetzliche Gast-Personas neben TAVI & LUMI */
  extraSpeakers: AudioDokuExtraSpeakerSuggestion[];
  /** Kurze Begruendung, warum diese Besetzung das Thema unterhaltsamer macht */
  castingReason: string;
}

export interface AudioDokuTopicsResponse {
  topics: string[];
  /** Detaillierte Vorschlaege inkl. Besetzungs-Empfehlung, parallel zu topics */
  suggestions: AudioDokuTopicSuggestion[];
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
  /** Deutscher Prompt fuer ElevenLabs Sound-Generation, beschreibt den Ambient-Sound */
  ambientPrompt: string;
  /** Default-Lautstaerke (0.0-1.0) der Ambient-Spur unter dem Dialog. Empfehlung: 0.0-0.14 */
  ambientVolume: number;
  /** Gewuenschte Laenge des generierten Sound-Clips in Sekunden. Kurze Clips werden im Mix geloopt. */
  durationSeconds: number;
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

  const send = () =>
    callOpenRouterChatCompletion({
      messages: payload.messages as Array<{ role: "system" | "user"; content: string }>,
      model: String(payload.model),
      responseFormat: "json_object",
      maxTokens: Number(payload.max_completion_tokens),
      reasoning: resolveStorybookReasoning(String(payload.model), "low", "writer"),
      includeReasoning: false,
      signal: abortController.signal,
    });

  try {
    let { data } = await send();
    // Sol 6.1 sometimes answers instantly with zero output tokens: a provider blip, ask again once.
    if (!data?.choices?.[0]?.message?.content && !data?.usage?.completion_tokens) {
      console.warn(`[AudioDoku] ${source}: empty reply from ${MODEL}, retrying once`);
      ({ data } = await send());
    }

    await publishWithTimeout(logTopic, {
      source,
      timestamp: new Date(),
      request: payload,
      response: data,
    });

    return data;
  } catch (error) {
    if ((error as any)?.name === "AbortError") {
      throw new Error(`Audio doku request timed out after ${Math.round(timeoutMs / 1000)}s`);
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
    if (direction.length > 500) {
      throw APIError.invalidArgument("direction is too long");
    }
    await claimMeteredUsage({
      userId: auth.userID,
      kind: "chat",
      units: 1,
      clerkToken: auth.clerkToken,
    });

    const directionInstruction = direction
      ? `Themenrichtung des Nutzers: "${direction}". Schlage 10 unterschiedliche, konkrete Doku-Themen vor, die zu dieser Richtung passen.`
      : `Es wurde keine Themenrichtung angegeben. Schlage 10 spannende, abwechslungsreiche Doku-Themen frei aus verschiedenen Bereichen vor (Natur, Weltall, Geschichte, Technik, Tiere, Erfindungen, Mensch & Körper, Erde & Klima, Kunst & Kultur, Mysterien).`;

    // Existierende Dokus laden, damit keine Wiederholungen vorgeschlagen werden.
    const existingTitles: string[] = [];
    try {
      const rows = dokuDB.query<{ title: string }>`
        SELECT title FROM audio_dokus
        WHERE user_id = ${auth.userID} OR is_public = true
        ORDER BY created_at DESC
        LIMIT 100
      `;
      const seen = new Set<string>();
      for await (const row of rows) {
        const title = (row.title || "").trim();
        if (!title) continue;
        const key = title.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        existingTitles.push(title);
      }
    } catch (err) {
      console.warn("[AudioDokuTopics] Konnte existierende Dokus nicht laden:", err);
    }

    const existingTitlesText =
      existingTitles.length > 0
        ? existingTitles.map((t) => `- ${t}`).join("\n")
        : "- (noch keine)";

    const system = `Du bist Chefredakteur für eine Kinder-Audio-Doku-Reihe im Reportage-Format von "Checker Tobi": Ein Moderator nimmt sich EINE Frage vor, geht dorthin, wo die Antwort zu finden ist, trifft echte Fachleute, probiert selbst aus und fasst am Ende zusammen, was er gecheckt hat.
Feste Besetzung: TAVI (erwachsener Moderator, der "Checker") und LUMI (Kind im Check-Team). Dazu kommen pro Doku 1-2 echte Fachleute vor Ort.
Deine Aufgabe: 10 Doku-Themen vorschlagen, die Kinder SOFORT hören wollen — plus eine Besetzungs-Empfehlung pro Thema.

REGELN FÜR THEMEN:
- Jedes Thema ist EIN kurzer, packender Titel (max 8 Wörter).
- Jedes Thema ist CHECKBAR: Es gibt einen echten Ort, an den man hingehen kann (Feuerwache, Zoo-Tierklinik, Sternwarte, Bäckerei um 3 Uhr nachts, Kläranlage, Bauernhof, Forschungsschiff, Vulkan-Observatorium, Ausgrabung, Windpark, Flughafen-Vorfeld), und echte Menschen mit Beruf, die es erklären können.
- Jedes Thema hat eine konkrete Leitfrage mit AHA-Kern ("Wie kommt...?", "Warum...?", "Was passiert, wenn...?"). Titelmuster wie "Der Feuerwehr-Check: Wie schnell ist schnell?" sind ausdrücklich erwünscht.
- Gute Mischung: Alltags-Rätsel (wo kommt das her, wo geht das hin?), Berufe & Orte hinter den Kulissen, Tiere & Natur, Technik & Maschinen, Körper, Weltall, Geschichte zum Anfassen (Burg, Museum, Ausgrabung).
- Kinder lieben: Rekorde & Extreme, Ekliges & Kurioses (wahr und altersgerecht), Verborgenes hinter verschlossenen Türen, große Maschinen, Tiere aus nächster Nähe, ungefährlich erzählte Gefahr.
- KEINE generischen Titel wie "Alles über Tiere" oder "Die Welt der...".
- Themen müssen zur Altersgruppe passen und in der angegebenen Dauer realistisch erzählbar sein.
- KEINE doppelten oder zu ähnlichen Themen — auch NICHT ähnlich zu den bereits existierenden Dokus aus der Nutzer-Nachricht.
- Themen sind kindgerecht, sicher, faszinierend, faktisch wahr.

BESETZUNGS-EMPFEHLUNG PRO THEMA:
- recommendedSpeakerCount: Gesamtzahl Sprecher (2-4), inkl. TAVI und LUMI.
- 3 = Standard: TAVI, LUMI und EINE Fachperson vor Ort.
- 4 = wenn die Doku zwei Stationen mit zwei verschiedenen Fachleuten braucht (z.B. erst Förster im Wald, dann Tischlerin in der Werkstatt).
- 2 = nur, wenn wirklich kein Mensch vor Ort nötig ist (z.B. reines Gedankenexperiment).
- extraSpeakers: pro Fachperson BERUF + VORNAME in GROSSBUCHSTABEN (z.B. "FÖRSTERIN MARA", "VULKANOLOGE BEN", "TIERPFLEGER JONAS"), eine Rolle in 3-8 Wörtern ("zeigt die Tierklinik im Zoo"), gender ("female" oder "male", passend zu Beruf und Vorname) und age ("young", "adult" oder "old").
- Mische die Besetzung über die 10 Themen: Frauen und Männer, jünger und älter.
- castingReason: 1 kurzer Satz, was die Fachleute zeigen oder ausprobieren lassen.

Antworte AUSSCHLIESSLICH als JSON:
{ "topics": [ { "topic": "Thema 1", "recommendedSpeakerCount": 3, "extraSpeakers": [{ "name": "VULKANOLOGE BEN", "role": "misst am Ätna, wann es brodelt", "gender": "male", "age": "adult" }], "castingReason": "..." }, { "topic": "Thema 2", "recommendedSpeakerCount": 4, "extraSpeakers": [{ "name": "FÖRSTERIN MARA", "role": "zeigt, welcher Baum gefällt wird", "gender": "female", "age": "old" }, { "name": "TISCHLERIN IDA", "role": "macht aus dem Stamm ein Brett", "gender": "female", "age": "young" }], "castingReason": "..." } ] }`;

    const user = `Zielgruppe: ${ageFrom}-${ageTo} Jahre
Geplante Dauer der Audio-Doku: ${durationMinutes} Minuten
Aktuell konfigurierte Sprecher: ${speakerCount}

${directionInstruction}

BEREITS EXISTIERENDE DOKUS (nicht wiederholen, auch nichts sehr Ähnliches):
${existingTitlesText}

Liefere genau 10 Themenvorschläge mit Besetzungs-Empfehlung.`;

    const payload: Record<string, unknown> = {
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      // Reasoning-Tokens zaehlen bei Sol 6.1 mit; Objekt-Antworten (Besetzung) brauchen mehr Platz.
      max_completion_tokens: 8000,
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
    const topics: string[] = [];
    const suggestions: AudioDokuTopicSuggestion[] = [];

    for (const entry of rawTopics) {
      if (topics.length >= 10) break;

      // Altes Format: reiner Themen-String.
      if (typeof entry === "string") {
        const topic = entry.trim();
        if (!topic) continue;
        topics.push(topic);
        suggestions.push({ topic, recommendedSpeakerCount: 2, extraSpeakers: [], castingReason: "" });
        continue;
      }

      if (!entry || typeof entry !== "object") continue;
      const obj = entry as Record<string, unknown>;
      const topic = typeof obj.topic === "string" ? obj.topic.trim() : "";
      if (!topic) continue;

      const extraRaw = Array.isArray(obj.extraSpeakers) ? obj.extraSpeakers : [];
      const extraSpeakers: AudioDokuExtraSpeakerSuggestion[] = [];
      for (const extra of extraRaw) {
        if (extraSpeakers.length >= 2) break;
        if (!extra || typeof extra !== "object") continue;
        const eo = extra as Record<string, unknown>;
        const name = typeof eo.name === "string" ? eo.name.trim().toUpperCase() : "";
        const role = typeof eo.role === "string" ? eo.role.trim() : "";
        if (!name) continue;
        const gender = eo.gender === "female" || eo.gender === "male" ? eo.gender : undefined;
        const age = eo.age === "young" || eo.age === "adult" || eo.age === "old" ? eo.age : undefined;
        extraSpeakers.push({ name, role, gender, age });
      }

      const castingReason =
        typeof obj.castingReason === "string" ? obj.castingReason.trim() : "";

      topics.push(topic);
      suggestions.push({
        topic,
        // Konsistent aus den Gast-Sprechern abgeleitet (2 feste + Extras, max 4).
        recommendedSpeakerCount: Math.min(4, 2 + extraSpeakers.length),
        extraSpeakers,
        castingReason,
      });
    }

    if (topics.length === 0) {
      throw new Error("Keine Themen generiert");
    }

    return { topics, suggestions };
  },
);

// Feste Personas der Reihe: TAVI (erwachsener Erzähler) und LUMI (neugieriges Kind).
// Checker-Format: TAVI checkt vor Ort, LUMI ist das Kind im Team, Gäste sind echte Fachleute.
const FIXED_SPEAKER_ROLES: Record<string, string> = {
  TAVI: "DER CHECKER (erwachsener Moderator & Reporter): geht vor Ort, stellt die Fragen, die Kinder stellen würden, probiert alles selbst aus (auch wenn es schiefgeht), übersetzt Fachwissen in Kindersprache ('Also heißt das...?') und fasst zusammen. Ehrlich neugierig, begeistert, lacht über sich selbst — nie besserwisserisch.",
  LUMI: "KIND IM CHECK-TEAM: ist mit dabei, sagt ehrlich, was sie denkt ('Iiih!', 'Das glaub ich nicht!'), stellt die einfachsten und damit besten Fragen, rät vor Auflösungen mit und darf auch selbst ausprobieren.",
};

// Rollen-Pool für zusätzliche Sprecher (Zuweisung in dieser Reihenfolge). Der Beruf steht
// im Sprechernamen (z.B. "FÖRSTERIN MARA"), die Rolle beschreibt nur die Funktion im Check.
const EXTRA_SPEAKER_ROLES = [
  "FACHPERSON VOR ORT (Station 1): echter Beruf laut Name. Stellt sich mit Beruf vor, erklärt am echten Objekt, erzählt eine kurze wahre Anekdote aus dem Berufsalltag und lässt das Team selbst ausprobieren. Spricht einfach und konkret; wird bei Fachwörtern nach einer Kinder-Übersetzung gefragt.",
  "ZWEITE FACHPERSON (Station 2 oder anderer Blickwinkel): echter Beruf laut Name. Bringt den Twist der Doku, zeigt etwas, das man nicht erwartet, und lässt das Team noch einmal ran.",
  "WEITERE FACHPERSON: echter Beruf laut Name, ergänzt einen eigenen Blickwinkel mit einem Aha-Moment zum Anfassen.",
];

const FIXED_SPEAKER_VISUALS: Record<string, string> = {
  TAVI: "adult male reporter host, friendly explorer style with simple goggles and warm jacket, holding a prop related to the topic",
  LUMI: "curious young girl team member in a colorful jacket with a small backpack, wide-eyed and excited",
};

// Cover-Beschreibungen für die Fachleute — gleiche Reihenfolge wie EXTRA_SPEAKER_ROLES.
const EXTRA_SPEAKER_VISUALS = [
  "friendly real-world expert in authentic work clothes of their profession, proudly holding a typical tool of their trade",
  "second friendly expert in different authentic work clothes, showing an object from their workplace",
  "cheerful specialist in practical work gear, pointing at something surprising",
];

type SpeakerCastingEntry = { name: string; role: string; visual: string };

const buildSpeakerCasting = (speakers: string[]): SpeakerCastingEntry[] => {
  let extraIdx = 0;
  return speakers.map((name, idx) => {
    const upper = name.toUpperCase();
    if (FIXED_SPEAKER_ROLES[upper]) {
      return { name, role: FIXED_SPEAKER_ROLES[upper], visual: FIXED_SPEAKER_VISUALS[upper] };
    }
    if (idx === 0) return { name, role: FIXED_SPEAKER_ROLES.TAVI, visual: FIXED_SPEAKER_VISUALS.TAVI };
    if (idx === 1) return { name, role: FIXED_SPEAKER_ROLES.LUMI, visual: FIXED_SPEAKER_VISUALS.LUMI };
    const poolIdx = extraIdx;
    extraIdx += 1;
    return {
      name,
      role:
        EXTRA_SPEAKER_ROLES[poolIdx] ??
        "FACHPERSON: echter Beruf laut Name, bringt einen eigenen Blickwinkel zum Anfassen mit.",
      visual:
        EXTRA_SPEAKER_VISUALS[poolIdx] ?? "cheerful cartoon co-host in a distinctive colorful outfit",
    };
  });
};

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
    if (topic.length > 200) {
      throw APIError.invalidArgument("topic is too long");
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
    if (cleanedSpeakers.length > 8 || cleanedSpeakers.some((name) => name.length > 80)) {
      throw APIError.invalidArgument("Too many speakers or speaker name too long");
    }

    await claimMeteredUsage({
      userId: auth.userID,
      kind: "chat",
      units: Math.max(1, Math.ceil(durationMinutes / 5)),
      clerkToken: auth.clerkToken,
    });

    const speakerCount = cleanedSpeakers.length;

    // 1 minute audio ≈ 130 words (kid-friendly pace, pauses, emotion tags)
    // 1 script line ≈ 10-12 words → ~11 lines/min
    const approxWords = durationMinutes * 130;
    const minLines = Math.round(durationMinutes * 11);
    const approxLines = Math.max(10, minLines);
    // Checker-Format: kurze Dokus bleiben an einem Ort, lange besuchen mehrere Stationen.
    const stationCount = durationMinutes <= 4 ? 1 : durationMinutes <= 9 ? 2 : 3;

    const casting = buildSpeakerCasting(cleanedSpeakers);
    const speakerListText = casting
      .map((entry, idx) => `${idx + 1}. ${entry.name} — ${entry.role}`)
      .join("\n");

    const system = `Du bist Autor und Redakteur einer Kinder-Audio-Doku-Reihe im Reportage-Format von "Checker Tobi": Der Moderator nimmt sich EINE Frage vor, geht dorthin, wo die Antwort zu finden ist, trifft echte Fachleute, probiert selbst aus und fasst am Ende zusammen, was er gecheckt hat.
Die Doku ist reines Audio und wird mit ElevenLabs Eleven v4 (Text-to-Dialogue) vertont. Weil man nichts sieht, muss jeder Ort, jedes Objekt und jede Handlung HÖRBAR werden: durch Beschreibung, Reaktion und Geräusch-Anlass im Text.

Deine Aufgabe: ein Dialog-Skript MIT Drehbuch (Szenen = Stationen mit Hintergrund-Ambient) plus Metadaten.

============================================================
TEIL 1 — SKRIPT-FORMAT (streng)
============================================================
- Jede Zeile: SPRECHERNAME: gesprochener Text
- Sprechernamen ausschließlich aus der vorgegebenen Liste, exakt so geschrieben (GROSSBUCHSTABEN).
- KEINE Leerzeilen. Jede Zeile enthält gesprochenen Text — "TAVI: [laughs]" allein ist ungültig.
- Kurze, gesprochene Sätze wie im echten Gespräch: Unterbrechungen, Nachfragen, "Moment mal...", "Echt jetzt?". Kein Vorlese- oder Wikipedia-Stil.
- Umlaute und ß normal schreiben (ä, ö, ü, ß) — niemals ae/oe/ue, das wird falsch ausgesprochen.
- Zahlen, die vorgelesen werden, ausschreiben, wenn sie sonst holpern ("dreißigtausend", "minus zweihundert Grad").

AUDIO-TAGS (Eleven v4 — Regie für die Stimme, werden nicht gesprochen):
- Emotion am Zeilenanfang, höchstens 1 pro Zeile, nicht in jeder Zeile:
  [excited] [curious] [thoughtful] [warm] [serious] [awe] [surprised] [whispers] [calmly] [nervous] [confused] [proudly] [mischievously] [dramatic] [sighs] [shouts]
- Im Satz erlaubt, sparsam und nur wo es wirklich passiert:
  [pause] vor einer Auflösung oder Pointe, [long pause] höchstens 1-2 Mal pro Doku für echte Spannung,
  [laughs] [giggles] [gasp] [sighs] [inhales deeply] als echte Reaktionen.
- Geräusch-Tags ([heartbeat], [applause], [bubbles] ...) nur ganz selten (höchstens 3 pro Doku). Umgebungsgeräusche legt die Tonregie später selbst an — schreibe stattdessen den Anlass in den Text ("Hörst du das? Da zischt es!").

============================================================
TEIL 2 — DAS CHECK-TEAM (Rollen)
============================================================
Die konkrete Rolle pro Sprecher steht in der Nutzer-Nachricht — halte dich exakt daran.
- TAVI ist der Checker: geht hin, fragt nach, probiert selbst, übersetzt ("Also heißt das...?"), fasst zusammen. Er weiß NICHT schon alles — er findet es heraus.
- LUMI ist das Kind im Team: ehrliche Reaktionen, einfache Fragen, rät mit, darf ausprobieren.
- Fachleute sind echte Menschen mit echtem Beruf (steht im Namen). Sie stellen sich beim ersten Auftritt mit Beruf vor, erklären am echten Objekt, erzählen eine kurze wahre Anekdote aus dem Berufsalltag und lassen das Team selbst ran. Sie reden einfach, aber nie babyhaft.
- Jeder Sprecher kommt regelmäßig zu Wort und hat mindestens einen eigenen Moment.
- Bei nur 1 Sprecher: TAVI spricht die Fachleute indirekt ("Die Försterin hat mir erklärt...") und spricht die Hörer direkt an.

============================================================
TEIL 3 — ABLAUF EINES CHECKS
============================================================
Die Anzahl der Stationen steht in der Nutzer-Nachricht.

1. EINSTIEG (erste 2-4 Zeilen): TAVI startet mitten in einer Situation oder mit einer Alltagsbeobachtung und nennt die Leitfrage: "Heute checke ich: ...". Dazu EINE Rate-Frage an die Hörer, die erst im Finale aufgelöst wird ("Rate mal mit: ... Am Ende verrat ich's.").
2. STATION VOR ORT: Ankommen mit 1-2 Sätzen Kopfkino ("Ich steh hier direkt neben..., und es riecht nach..."). Fachperson begrüßen. Erklären am echten Objekt, TAVI und LUMI fragen nach, TAVI übersetzt in Kindersprache, die Fachperson bestätigt oder korrigiert.
3. SELBST AUSPROBIEREN (pro Station mindestens einmal): TAVI oder LUMI probiert etwas selbst — es ist schwerer, lauter, kälter oder ekliger als gedacht; echte Reaktion. Hier entsteht der meiste Humor.
4. CHECK-WISSEN (einmal pro Doku, bei langen Dokus zweimal): TAVI erklärt in 3-6 Zeilen ruhig den Kern-Mechanismus mit EINEM starken Vergleich aus dem Kinderalltag. Die anderen dürfen kurz reagieren.
5. ZWISCHEN-CHECK (bei 2+ Stationen, vor jedem Stationswechsel): 1-2 Zeilen "Was haben wir bis jetzt gecheckt?" plus ein Satz, der neugierig auf die nächste Station macht.
6. TWIST: Mindestens eine echte Überraschung, die die Leitfrage in neues Licht rückt.
7. FINALE: Auflösung der Rate-Frage, dann TAVI: "Das hab ich heute gecheckt:" mit genau 3 kurzen Punkten (verteilt auf 1-3 Zeilen), dann eine emotionale Schlusszeile von TAVI, die zeigt, was ihn persönlich beeindruckt hat. Das Skript endet HIER — keine Verabschiedung, die kommt automatisch danach.

HUMOR & STAUNEN:
- Humor entsteht aus echten Situationen: beim Ausprobieren, aus ehrlichen Reaktionen, aus der Anekdote der Fachperson — nicht aus eingestreuten Gags.
- Pro Station mindestens ein Wow-Fakt und ein absurder, aber wahrer Vergleich aus der Kinderwelt ("Der Schlauch spritzt so weit wie drei Schulbusse hintereinander.").
- Ein wahrer kurioser oder ekliger Fakt ist willkommen, wenn er zum Thema gehört.
- HUMOR NACH ALTER: 2-5 Jahre: Geräuschwörter, Wiederholungen, einfache Quatsch-Momente. 6-9 Jahre: Ausprobieren-geht-schief, Ekel-Fakten, Falsch-Raten. Ab 10: Wortwitz, leichte Ironie, "Was wäre wenn"-Gedankenspiele.
- Witze gehen NIE auf Kosten der Fakten und NIE auf Kosten eines Kindes, einer Gruppe oder der Fachleute.

INHALT:
- Faktisch korrekt, kindgerecht, niemals belehrend. Lieber eine Sache richtig verstehen als zehn Fakten aufzählen.
- Fachwörter nur, wenn sie sofort erklärt werden — am besten fragt LUMI nach.
- Nichts erfinden, was man nachprüfen könnte: Zahlen und Rekorde nur, wenn sie stimmen.

SO SOLL DAS KLINGEN (nur Ton-Beispiel — verwende die echten Sprechernamen aus der Liste):
MODERATOR: [excited] Ich steh hier in der Fahrzeughalle der Feuerwache, und vor mir parkt ein knallrotes Löschfahrzeug. Hallo Jana!
FEUERWEHRFRAU: [warm] Hallo! Ich bin Jana, Feuerwehrfrau hier auf der Wache. Willst du mal die Jacke anziehen?
MODERATOR: [laughs] Klar! Moment... [pause] Die ist ja schwer wie ein voller Schulranzen!
KIND: [mischievously] Und jetzt rennen!
FEUERWEHRFRAU: Genau. Beim Alarm haben wir dafür nur eine Minute.
MODERATOR: [surprised] Eine Minute?! Also heißt das: Anziehen, einsteigen, losfahren — alles in sechzig Sekunden?

============================================================
TEIL 4 — DREHBUCH (Szenen mit Hintergrund-Ambient)
============================================================
Teile das Skript in 3-7 Szenen. Szenen folgen den Stationen: Einstieg, jede Station, Check-Wissen, Finale.
Pro Szene:
- index: 1, 2, 3, ...
- startLine / endLine: erste und letzte Skript-Zeile (1-basiert, inklusive). Lückenlos von Zeile 1 bis zur letzten Zeile, keine Überlappungen, jede Szene mindestens 4 Zeilen.
- description: kurze deutsche Beschreibung (z.B. "Station 1: Fahrzeughalle der Feuerwache").
- ambientPrompt: DEUTSCHER Sound-Prompt für ElevenLabs Sound Generation — der Klang des ORTES, an dem die Szene spielt. Klar, kurz, 1-3 ruhige Soundquellen, immer mit "keine Stimmen".
- ambientVolume: 0 für weglassen, 0.05-0.10 für dezente Betten, 0.11-0.14 für eindeutig passende Orte, maximal 0.18. Die Stimmen bleiben immer klar vorne.
- durationSeconds: 8-16 Sekunden für ruhige Betten, bis 30 für komplexere Atmosphären (wird im Mix geloopt).

AMBIENT-REGELN:
- Stationen vor Ort bekommen den Klang ihres Ortes (Wald, Werkstatt, Stall, Meer, Halle, Labor), weil die Szene wirklich dort spielt.
- Check-Wissen, Zwischen-Check und Finale: sanftes Musikbett oder gar nichts ("sanftes warmes instrumentales Doku-Musikbett, minimale Melodie, keine Percussion, keine Stimmen, kein Gesang").
- Wenn kein klar passender Sound existiert: ambientVolume 0 und ambientPrompt "reine Stimme - kein Hintergrundsound, keine Musik, keine Stimmen".
- Weil das Ambient durchgehend unter der Szene läuft, keine auffälligen Einzelgeräusche als Dauerschleife (keine Stimmen, Kassen, Messer, Schritte, Sirenen, Hupen). Lieber breite, ruhige Flächen: fernes Vogelzwitschern, leiser Hallenraumton, sanfte Wellen, leises Maschinenbrummen.
- Erfinde keine Orte nur wegen eines Begriffs: Bei Ernährung KEIN Supermarkt, nur weil Essen vorkommt — nur, wenn die Station wirklich dort spielt.

============================================================
TEIL 5 — METADATEN
============================================================
- title: weckt sofort Neugier, 4-10 Wörter, in der Sprache der Doku. Erwünscht: "Der Feuerwehr-Check: Wie schnell ist schnell?", "Warum...", "Wie kommt...", "Was passiert, wenn...". VERBOTEN: "Alles über X", "Die Geschichte von X", "X erklärt", reine Substantiv-Ketten.
- ageGroup: Altersbereich z.B. "6-8".
- category: eine von Abenteuer, Wissen, Natur, Tiere, Geschichte, Entspannung.
- coverPrompt: ENGLISCH, exakt in diesem Format als ein zusammenhängender Absatz. PFLICHT: ALLE Sprecher-Figuren im Vordergrund sichtbar!
  "Square 1:1  Theme: <one-line topic theme>. <Detailed visual scene at the main on-location station: environment, atmosphere, lighting, background details, sound visualized as particles/wind/etc>. Foreground: the show's cheerful cartoon hosts (<one short visual description per host, exactly as provided in the user message>) on location, amazed and pointing toward the scene. <Additional detail elements>. Modern clean premium illustration, smooth gradients, soft glow, high contrast, crisp outlines, cinematic depth of field, adventurous but not scary, kid-friendly, ultra-detailed, balanced composition with open space, no writing, no symbols that resemble letters or numbers."
- description: 2-3 Sätze auf Deutsch für die Anzeige neben dem Player: Leitfrage + wohin der Check geht.

Antworte AUSSCHLIESSLICH als JSON-Objekt:
{
  "script": "SPRECHER1: [excited] Text\\nSPRECHER2: Text mit [pause] Auflösung\\n...",
  "title": "...",
  "ageGroup": "...",
  "category": "...",
  "coverPrompt": "...",
  "description": "...",
  "screenplay": [
    {
      "index": 1,
      "startLine": 1,
      "endLine": 5,
      "description": "Einstieg: die Leitfrage",
      "ambientPrompt": "sanftes warmes instrumentales Doku-Musikbett, minimale Melodie, keine Percussion, keine Stimmen, kein Gesang",
      "ambientVolume": 0.08,
      "durationSeconds": 10
    },
    {
      "index": 2,
      "startLine": 6,
      "endLine": 18,
      "description": "Station 1: Fahrzeughalle der Feuerwache",
      "ambientPrompt": "große hallige Fahrzeughalle, leiser Raumton, fernes gleichmäßiges Brummen der Lüftung, keine Stimmen, keine Sirenen",
      "ambientVolume": 0.1,
      "durationSeconds": 14
    }
  ]
}`;

    // Build speaker descriptions for cover prompt — one visual per speaker so ALL hosts land on the cover.
    const hostDesc = casting.map((entry) => `${entry.name} (${entry.visual})`).join(", ");

    const user = `THEMA DER AUDIO-DOKU: "${topic}"

Zielgruppe: ${ageFrom}-${ageTo} Jahre
Geplante Audio-Dauer: ${durationMinutes} Minuten (≈ ${approxWords} gesprochene Wörter)
PFLICHT: Das Skript MUSS MINDESTENS ${approxLines} Zeilen haben. Kürzer ist ein Fehler!
Anzahl Sprecher: ${speakerCount}
Anzahl Stationen vor Ort: ${stationCount}

CHECK-TEAM (exakt diese Namen in Großbuchstaben verwenden; jeder spielt konsequent seine Rolle):
${speakerListText}

COVER-PROMPT PFLICHT: ALLE Sprecher MÜSSEN im Vordergrund sichtbar sein.
Sprecher-Beschreibung für Cover: ${hostDesc}

Erstelle das vollständige Skript jetzt nach den oben genannten Regeln.

WICHTIG: Validiere selbst vor der Ausgabe:
- Hat das Skript MINDESTENS ${approxLines} Zeilen? -> Wenn nein, WEITER SCHREIBEN bis Mindestlänge erreicht!
- Keine Leerzeilen, jede Zeile hat gesprochenen Text, Sprechernamen exakt wie vorgegeben?
- Werden ALLE angegebenen Sprecher genutzt, jeder mit eigenem Moment?
- Nennt TAVI am Anfang die Leitfrage und stellt eine Rate-Frage, die im Finale aufgelöst wird?
- Gibt es ${stationCount} Station(en) vor Ort mit Kopfkino-Ankunft, und wird an jeder Station etwas selbst ausprobiert?
- Stellen sich die Fachleute mit Beruf vor und erzählen eine echte Anekdote?
- Gibt es ein Check-Wissen-Stück mit einem starken Alltagsvergleich${stationCount > 1 ? " und einen Zwischen-Check vor jedem Stationswechsel" : ""}?
- Gibt es einen echten Twist?
- Endet das Skript mit "Das hab ich heute gecheckt:" (3 Punkte) und einer emotionalen Schlusszeile von TAVI — ohne Verabschiedung?
- Umlaute korrekt (ä, ö, ü, ß), keine ae/oe/ue-Umschreibungen?
- Audio-Tags sparsam, Geräusch-Tags höchstens 3 insgesamt?
- Decken die screenplay-Szenen ALLE Skript-Zeilen lückenlos ab, letzte endLine = letzte Skript-Zeile?
- Coverprompt im exakten Square-1:1-Format und auf Englisch?`;

    // Sol 6.1 is a reasoning model: reasoning tokens are INCLUDED in max_completion_tokens.
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
  const fallbackPrompt = `reine Stimme fuer "${topic}" - kein Hintergrundsound, keine Musik, keine Stimmen`;

  const fallback: AudioDokuScene[] = [
    {
      index: 1,
      startLine: 1,
      endLine: Math.max(1, totalLines),
      description: "Hauptszene",
      ambientPrompt: fallbackPrompt,
      ambientVolume: 0,
      durationSeconds: 10,
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
    const durationRaw = Number(obj.durationSeconds);
    const durationSeconds = Number.isFinite(durationRaw)
      ? Math.max(0.5, Math.min(30, durationRaw))
      : 10;

    candidates.push({
      index: candidates.length + 1,
      startLine: Math.max(1, Math.floor(startLine)),
      endLine: Math.max(1, Math.floor(endLine)),
      description: description || `Szene ${candidates.length + 1}`,
      ambientPrompt,
      ambientVolume,
      durationSeconds,
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
      durationSeconds: c.durationSeconds,
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

// Reactions and Eleven v4 pause tags may also sit mid-sentence ("Moment... [pause] DREISSIG!").
const ALLOWED_AUDIO_DOKU_INLINE_VOICE_TAGS = new Set([
  "pause",
  "long pause",
  "laughs",
  "giggles",
  "sighs",
  "inhales deeply",
  "whispers",
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
      if (
        ALLOWED_AUDIO_DOKU_INLINE_FX_TAGS.has(tagName) ||
        ALLOWED_AUDIO_DOKU_INLINE_VOICE_TAGS.has(tagName)
      ) {
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
  cleaned.push(`${host2}: [excited] Bis zum nächsten Check! [applause] Tschüss!`);

  return cleaned.join("\n");
};
