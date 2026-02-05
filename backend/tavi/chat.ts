import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { getAuthData } from "~encore/auth";
import { doku, story } from "~encore/clients";
import { logTopic } from "../log/logger";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { avatarDB } from "../avatar/db";
import type { DokuConfig } from "../doku/generate";
import type { StoryConfig } from "../story/generate";

const openAIKey = secret("OpenAIKey");

type SupportedLanguage = "de" | "en" | "fr" | "es" | "it" | "nl" | "ru";
type AgeGroup = "3-5" | "6-8" | "9-12" | "13+";
type StoryLength = "short" | "medium" | "long";
type DokuDepth = "basic" | "standard" | "deep";
type DokuTone = "fun" | "neutral" | "curious";
type DokuPerspective = "science" | "history" | "technology" | "nature" | "culture";

interface TaviChatContext {
  language?: string;
  intentHint?: TaviActionType;
  pendingRequest?: string;
}

interface TaviChatRequest {
  message: string;
  context?: TaviChatContext;
}

type TaviActionType = "story" | "doku";

interface TaviChatAction {
  type: TaviActionType;
  id: string;
  title: string;
  route: string;
}

interface TaviChatResponse {
  response: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  action?: TaviChatAction;
  intentHint?: TaviActionType;
  awaitingConfirmation?: boolean;
}

interface OpenAIChatResponse {
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

const TAVI_SYSTEM_PROMPT = `Du bist Tavi, das magische Geschichten-Genie der Talea Storytelling Platform! ðŸ§žâ€â™‚ï¸âœ¨

PersÃ¶nlichkeit:
- Freundlich, hilfsbereit und voller magischer Energie
- Sprichst auf Deutsch mit einer lebendigen, einladenden Art
- Liebst Geschichten, KreativitÃ¤t und das Helfen von Familien
- Verwendest gerne Emojis und magische Metaphern
- Bist ein Experte fÃ¼r Storytelling, Avatare und kreative Inhalte

Aufgaben:
- Hilf Benutzern bei Fragen zur Talea-Plattform
- Gib Tipps fÃ¼r bessere Geschichten und Avatare
- ErklÃ¤re Features und Funktionen
- Inspiriere zu kreativen Ideen
- Beantworte allgemeine Fragen mit magischer Note

Regeln:
- Halte Antworten unter 500 WÃ¶rtern
- Sei immer positiv und ermutigend
- Verwende "du" statt "Sie"
- Beziehe dich auf deine magische Natur als Geschichten-Genie
- Falls du etwas nicht weiÃŸt, sage es ehrlich aber bleibe hilfreich

Antworte immer auf Deutsch und mit viel Begeisterung fÃ¼r Geschichten und KreativitÃ¤t! ðŸŒŸ`;

const SUPPORTED_LANGUAGES: SupportedLanguage[] = ["de", "en", "fr", "es", "it", "nl", "ru"];

const STORY_KEYWORDS = /\b(story|stories|storys|geschichte|geschichten|maerchen|mÃ¤rchen|erzaehlung|erzÃ¤hlung|erzaehlungen|erzÃ¤hlungen)\b/i;
const DOKU_KEYWORDS = /\b(doku|dokus|wissensdoku|wissensdokus|dokumentation|dokumentationen)\b/i;
const ACTION_VERBS = /\b(mach|mache|machst|erstelle|erstellen|erstellt|generier|generiere|generieren|schreib|schreibe|schreibst|erzaehl|erzaehle|erzaehlst|create|make|generate|bitte|kannst|koenntest)\b/i;
const STORY_COMMAND = /^(\/?(?:story|geschichte|maerchen|mÃ¤rchen|erzaehlung|erzÃ¤hlung))\b/i;
const DOKU_COMMAND = /^(\/?(?:doku|wissensdoku|dokumentation))\b/i;
const TOPIC_STOP_WORDS = [
  "hallo",
  "hey",
  "hi",
  "bitte",
  "kannst",
  "koenntest",
  "du",
  "ihr",
  "mir",
  "mal",
  "dann",
  "thema",
  "mach",
  "mache",
  "machst",
  "erstelle",
  "erstellen",
  "erstellt",
  "generiere",
  "generieren",
  "schreib",
  "schreibe",
  "schreibst",
  "doku",
  "dokus",
  "wissensdoku",
  "dokumentation",
  "story",
  "stories",
  "storys",
  "geschichte",
  "geschichten",
];

function normalizeLanguage(value?: string): SupportedLanguage | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase().trim();
  if ((SUPPORTED_LANGUAGES as string[]).includes(normalized)) {
    return normalized as SupportedLanguage;
  }
  const base = normalized.split("-")[0];
  return (SUPPORTED_LANGUAGES as string[]).includes(base) ? (base as SupportedLanguage) : undefined;
}

function parseAgeGroup(message: string): AgeGroup | undefined {
  const text = message.toLowerCase();
  if (/\b3\s*-\s*5\b/.test(text) || /\b3\s*bis\s*5\b/.test(text)) return "3-5";
  if (/\b6\s*-\s*8\b/.test(text) || /\b6\s*bis\s*8\b/.test(text)) return "6-8";
  if (/\b9\s*-\s*12\b/.test(text) || /\b9\s*bis\s*12\b/.test(text)) return "9-12";
  if (/\b13\s*\+?\b/.test(text) || /\bab\s*13\b/.test(text)) return "13+";
  return undefined;
}

function parseLength(message: string): StoryLength | undefined {
  const text = message.toLowerCase();
  if (/\bkurz\b|\bshort\b/.test(text)) return "short";
  if (/\blang\b|\blong\b/.test(text)) return "long";
  if (/\bmittel\b|\bmedium\b/.test(text)) return "medium";
  return undefined;
}

function parseDokuDepth(message: string): DokuDepth | undefined {
  const text = message.toLowerCase();
  if (/\bgrundlagen\b|\bbasic\b|\beinfach\b/.test(text)) return "basic";
  if (/\btief\b|\bdeep\b|\bdetailliert\b|\bexperten\b/.test(text)) return "deep";
  if (/\bstandard\b|\bnormal\b/.test(text)) return "standard";
  return undefined;
}

function parseDokuTone(message: string): DokuTone | undefined {
  const text = message.toLowerCase();
  if (/\blustig\b|\bwitzig\b|\bfun\b/.test(text)) return "fun";
  if (/\bsachlich\b|\bneutral\b/.test(text)) return "neutral";
  if (/\bneugierig\b|\bcurious\b|\bchecker\b/.test(text)) return "curious";
  return undefined;
}

function parseDokuPerspective(message: string): DokuPerspective | undefined {
  const text = message.toLowerCase();
  if (/\bgeschicht\b|\bhistor\b/.test(text)) return "history";
  if (/\btechnik\b|\btechnolog\b|\brobot\b/.test(text)) return "technology";
  if (/\bnatur\b|\btiere\b|\bpflanz\b|\bumwelt\b/.test(text)) return "nature";
  if (/\bkultur\b|\bgesellschaft\b|\bmenschen\b/.test(text)) return "culture";
  if (/\bwissenschaft\b|\bscience\b|\bphysik\b|\bchemie\b|\bbiolog\b/.test(text)) return "science";
  return undefined;
}

function parseIncludeInteractive(message: string): boolean | undefined {
  const text = message.toLowerCase();
  if (/\bohne\b.*\b(quiz|interaktiv|mitmach|fragen)\b/.test(text) || /\bkein\b.*\b(quiz|interaktiv|mitmach|fragen)\b/.test(text)) {
    return false;
  }
  if (/\bmit\b.*\b(quiz|interaktiv|mitmach|fragen)\b/.test(text) || /\bquiz\b/.test(text)) {
    return true;
  }
  return undefined;
}

function detectStoryGenre(message: string): string {
  const text = message.toLowerCase();
  if (/\bmaerchen\b|\bmÃ¤rchen\b|\bfairy\b|\bfee\b|\bprinz\b|\bprinzessin\b/.test(text)) return "fairy_tales";
  if (/\bsci[- ]?fi\b|\bscience fiction\b|\bweltraum\b|\bspace\b|\balien\b|\broboter\b|\bfuture\b/.test(text)) return "scifi";
  if (/\btiere\b|\btier\b|\banimals\b|\bdino\b|\bdinosaur\b/.test(text)) return "animals";
  if (/\bmagie\b|\bzauber\b|\bhex\b|\bdrache\b|\beinhorn\b/.test(text)) return "magic";
  if (/\bmodern\b|\bschule\b|\balltag\b|\bstadt\b/.test(text)) return "modern";
  if (/\babenteuer\b|\bquest\b|\breise\b|\bpirat\b/.test(text)) return "adventure";
  return "adventure";
}

function deriveStorySetting(message: string, genre: string): string {
  const text = message.toLowerCase();
  const settings: Array<{ pattern: RegExp; setting: string }> = [
    { pattern: /\bweltraum\b|\bspace\b|\bgalax\b/, setting: "space" },
    { pattern: /\bunterwasser\b|\bmeer\b|\bocean\b|\bsee\b/, setting: "ocean" },
    { pattern: /\bwald\b|\bforest\b/, setting: "forest" },
    { pattern: /\bburg\b|\bschloss\b|\bcastle\b/, setting: "castle" },
    { pattern: /\bschule\b|\bschool\b/, setting: "school" },
    { pattern: /\bstadt\b|\bcity\b/, setting: "city" },
    { pattern: /\bwuste\b|\bwÃ¼ste\b|\bdesert\b/, setting: "desert" },
    { pattern: /\bberg\b|\bberge\b|\bmountain\b/, setting: "mountains" },
    { pattern: /\binsel\b|\bisland\b/, setting: "island" },
    { pattern: /\bdschungel\b|\bjungle\b/, setting: "jungle" },
  ];

  for (const entry of settings) {
    if (entry.pattern.test(text)) return entry.setting;
  }

  if (genre === "fairy_tales" || genre === "magic") return "fantasy";
  return "varied";
}

function detectStoryTone(message: string): "warm" | "witty" | "epic" | "soothing" | "mischievous" | "wonder" {
  const text = message.toLowerCase();
  if (/\blustig\b|\bwitzig\b|\bfun\b/.test(text)) return "witty";
  if (/\bspannend\b|\bepisch\b|\babenteuer\b|\bdramatisch\b/.test(text)) return "epic";
  if (/\bberuhigend\b|\bruhe\b|\bsoothing\b|\beinschlaf\b|\bbedtime\b/.test(text)) return "soothing";
  if (/\bmagisch\b|\bzauber\b|\bwonder\b/.test(text)) return "wonder";
  if (/\bfrech\b|\bchaotisch\b|\bmischief\b/.test(text)) return "mischievous";
  return "warm";
}

function detectStoryPacing(message: string): "slow" | "balanced" | "fast" {
  const text = message.toLowerCase();
  if (/\bschnell\b|\brasant\b|\bfast\b/.test(text)) return "fast";
  if (/\blangsam\b|\bruhe\b|\bslow\b|\bbedtime\b/.test(text)) return "slow";
  return "balanced";
}

function parseStorySuspense(message: string): 0 | 1 | 2 | 3 {
  const text = message.toLowerCase();
  if (/\bsehr spannend\b|\bmega spannend\b|\bgruselig\b|\bhigh suspense\b/.test(text)) return 3;
  if (/\bspannend\b|\babenteuer\b|\bgeheimnis\b/.test(text)) return 2;
  return 1;
}

function parseStoryHumor(message: string): 0 | 1 | 2 | 3 {
  const text = message.toLowerCase();
  if (/\bsehr lustig\b|\bmega lustig\b/.test(text)) return 3;
  if (/\blustig\b|\bwitzig\b/.test(text)) return 2;
  return 1;
}

function stripCommand(message: string, intent: TaviActionType): string {
  const trimmed = message.trim();
  if (intent === "doku") {
    return trimmed.replace(/^(\/?(?:doku|wissensdoku|dokumentation))\s*[:,-]?\s*/i, "").trim();
  }
  return trimmed.replace(/^(\/?(?:story|geschichte|maerchen|mÃ¤rchen|erzaehlung|erzÃ¤hlung))\s*[:,-]?\s*/i, "").trim();
}

function cleanupTopic(raw: string): string {
  let topic = raw.trim();
  topic = topic.replace(/\b(fuer|fÃ¼r|for)\s+\d+\s*-\s*\d+\s*(jahre|years)?\b/gi, "");
  topic = topic.replace(/\b(fuer|fÃ¼r|for)\s+\d+\+?\s*(jahre|years)?\b/gi, "");
  topic = topic.replace(/\b(kurz|lang|mittel|short|long|medium|basic|standard|deep|grundlagen|tief)\b/gi, "");
  topic = topic.replace(/\b(doku|dokus|wissensdoku|wissensdokus|dokumentation|dokumentationen)\b/gi, "");
  topic = topic.replace(/\b(bitte|mach|mache|erstelle|generiere|schreibe|schreib|create|make)\b/gi, "");
  topic = topic.replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, "");
  return topic.trim();
}

function stripStopWords(candidate: string): string {
  let cleaned = candidate.toLowerCase();
  for (const word of TOPIC_STOP_WORDS) {
    cleaned = cleaned.replace(new RegExp(`\\b${escapeRegex(word)}\\b`, "gi"), " ");
  }
  return cleaned.replace(/[^a-z0-9Ã¤Ã¶Ã¼ÃŸ-]/gi, " ").replace(/\s+/g, " ").trim();
}

function extractTopic(message: string): string | undefined {
  const stripped = stripCommand(message, "doku");
  const match = stripped.match(/(?:ueber|Ã¼ber|zum thema|zum|zu|about|on)\s+(.+)/i);
  if (match?.[1]) {
    const topic = cleanupTopic(match[1]);
    const cleaned = stripStopWords(topic);
    return cleaned.length > 1 ? cleaned : undefined;
  }
  const fallback = cleanupTopic(stripped);
  const cleanedFallback = stripStopWords(fallback);
  return cleanedFallback.length > 1 ? cleanedFallback : undefined;
}

function detectIntent(message: string): "story" | "doku" | "ambiguous" | null {
  const wantsStory = STORY_COMMAND.test(message) || (STORY_KEYWORDS.test(message) && ACTION_VERBS.test(message));
  const wantsDoku = DOKU_COMMAND.test(message) || (DOKU_KEYWORDS.test(message) && ACTION_VERBS.test(message));
  if (wantsStory && wantsDoku) return "ambiguous";
  if (wantsStory) return "story";
  if (wantsDoku) return "doku";
  return null;
}

function isConfirmation(message: string): boolean {
  const trimmed = message.toLowerCase().trim();
  if (!trimmed) return false;
  if (/^(ja|jap|jep|jo|klar|ok|okay|yes|yep|bitte|mach|mache|go)$/.test(trimmed)) {
    return true;
  }
  const words = trimmed.split(/\s+/);
  if (words.length <= 3 && /(ja|klar|ok|okay|yes|bitte)/.test(trimmed)) {
    return true;
  }
  return false;
}

function isDecline(message: string): boolean {
  const trimmed = message.toLowerCase().trim();
  if (!trimmed) return false;
  if (/^(nein|nee|no|nope|spaeter|später|nicht|abbruch)$/.test(trimmed)) {
    return true;
  }
  if (/(doch nicht|lieber nicht|kein danke)/.test(trimmed)) {
    return true;
  }
  return false;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function selectAvatarIds(message: string, avatars: Array<{ id: string; name: string }>): { ids: string[]; matched: string[] } {
  const matches: Array<{ id: string; name: string }> = [];
  for (const avatar of avatars) {
    const name = avatar.name.trim();
    if (!name) continue;
    const pattern = new RegExp(`\\b${escapeRegex(name.toLowerCase())}\\b`, "i");
    if (pattern.test(message.toLowerCase())) {
      matches.push(avatar);
    }
  }

  if (matches.length > 0) {
    return {
      ids: matches.slice(0, 3).map((m) => m.id),
      matched: matches.slice(0, 3).map((m) => m.name),
    };
  }

  return {
    ids: avatars.slice(0, 3).map((a) => a.id),
    matched: [],
  };
}

function buildStoryConfig(params: {
  message: string;
  avatarIds: string[];
  language: SupportedLanguage;
}): StoryConfig {
  const { message, avatarIds, language } = params;
  const ageGroup = parseAgeGroup(message) ?? "6-8";
  const length = parseLength(message) ?? "medium";
  const genre = detectStoryGenre(message);
  const setting = deriveStorySetting(message, genre);
  const tone = detectStoryTone(message);
  const pacing = detectStoryPacing(message);
  const suspenseLevel = parseStorySuspense(message);
  const humorLevel = parseStoryHumor(message);
  const allowRhymes = /\breim\b|\bgereimt\b|\brhym(e|es)\b/.test(message.toLowerCase());
  const hasTwist = /\btwist\b|\bueberraschung\b|\bÃ¼berraschung\b|\bplot twist\b/.test(message.toLowerCase());
  const customPrompt = stripCommand(message, "story");

  return {
    avatarIds,
    genre,
    setting,
    length,
    complexity: "medium",
    ageGroup,
    tone,
    pacing,
    suspenseLevel,
    humorLevel,
    allowRhymes,
    hasTwist,
    customPrompt: customPrompt.length > 0 ? customPrompt : undefined,
    language,
    aiModel: "gemini-3-flash-preview",
    preferences: {
      useFairyTaleTemplate: genre === "fairy_tales" || genre === "magic",
    },
  };
}

function buildDokuConfig(params: {
  message: string;
  language: SupportedLanguage;
}): DokuConfig {
  const { message, language } = params;
  const ageGroup = parseAgeGroup(message) ?? "6-8";
  const depth = parseDokuDepth(message) ?? "standard";
  const perspective = parseDokuPerspective(message) ?? "science";
  const tone = parseDokuTone(message) ?? "curious";
  const length = parseLength(message) ?? "medium";
  const includeInteractive = parseIncludeInteractive(message) ?? true;

  return {
    topic: extractTopic(message) ?? "",
    ageGroup,
    depth,
    perspective,
    tone,
    length,
    includeInteractive,
    quizQuestions: includeInteractive ? 3 : 0,
    handsOnActivities: includeInteractive ? 1 : 0,
    language,
  };
}

export const taviChat = api<TaviChatRequest, TaviChatResponse>(
  { expose: true, method: "POST", path: "/tavi/chat", auth: true },
  async ({ message, context }) => {
    const auth = getAuthData()!;

    // Validate message length (50 words max)
    const wordCount = message.trim().split(/\s+/).length;
    if (wordCount > 50) {
      throw new Error("Nachricht zu lang! Bitte halte deine Frage unter 50 WÃ¶rtern. âœ¨");
    }

    if (!message.trim()) {
      throw new Error("Bitte stelle eine Frage! Ich bin hier, um dir zu helfen. ðŸ§žâ€â™‚ï¸");
    }

    const language = normalizeLanguage(context?.language) ?? "de";
    const intentHint = context?.intentHint;
    const pendingRequest = context?.pendingRequest;
    let intent = detectIntent(message);

    if (intent === "ambiguous") {
      if (intentHint) {
        intent = intentHint;
      } else {
        return {
          response: "Meinst du eine Geschichte oder eine Doku? Sag mir kurz, was du erstellen moechtest.",
          tokensUsed: { prompt: 0, completion: 0, total: 0 },
        };
      }
    }

    if (!intent && intentHint) {
      intent = intentHint;
    }

    if (intent === "story") {
      if (isDecline(message)) {
        return {
          response: "Alles klar! Sag Bescheid, wenn du eine Geschichte generieren moechtest.",
          tokensUsed: { prompt: 0, completion: 0, total: 0 },
        };
      }

      const confirmed = isConfirmation(message);
      const requestText = confirmed
        ? (pendingRequest && pendingRequest.trim().length > 0 ? pendingRequest : message)
        : message;

      if (!confirmed) {
        return {
          response: "Soll ich dir dazu eine Story generieren? Sag einfach \"ja\" oder gib mir noch Details.",
          tokensUsed: { prompt: 0, completion: 0, total: 0 },
          intentHint: "story",
          awaitingConfirmation: true,
        };
      }

      const avatars = await avatarDB.queryAll<{ id: string; name: string }>`
        SELECT id, name FROM avatars WHERE user_id = ${auth.userID} ORDER BY created_at DESC
      `;

      if (avatars.length === 0) {
        return {
          response: "Ich kann noch keine Geschichte erstellen, weil du noch keinen Avatar hast. Erstelle zuerst einen Avatar.",
          tokensUsed: { prompt: 0, completion: 0, total: 0 },
        };
      }

      const selection = selectAvatarIds(requestText, avatars);
      const config = buildStoryConfig({
        message: requestText,
        avatarIds: selection.ids,
        language,
      });

      try {
        const created = await story.generate({ userId: auth.userID, config });
        const responseText = `Deine Geschichte "${created.title}" ist fertig. Ich kann sie dir oeffnen.`;
        return {
          response: responseText,
          tokensUsed: { prompt: 0, completion: 0, total: 0 },
          action: {
            type: "story",
            id: created.id,
            title: created.title,
            route: `/story-reader/${created.id}`,
          },
        };
      } catch (error) {
        console.error("Tavi story generation error:", error);
        return {
          response: "Uups, die Geschichte konnte gerade nicht erstellt werden. Bitte versuch es gleich nochmal.",
          tokensUsed: { prompt: 0, completion: 0, total: 0 },
        };
      }
    }

    if (intent === "doku") {
      if (isDecline(message)) {
        return {
          response: "Alles klar! Sag Bescheid, wenn du eine Doku generieren moechtest.",
          tokensUsed: { prompt: 0, completion: 0, total: 0 },
        };
      }

      const confirmed = isConfirmation(message);
      const requestText = confirmed
        ? (pendingRequest && pendingRequest.trim().length > 0 ? pendingRequest : message)
        : message;
      const config = buildDokuConfig({ message: requestText, language });

      if (!config.topic || config.topic.length < 2) {
        return {
          response: "Welches Thema soll die Doku haben? Nenne mir kurz ein Thema.",
          tokensUsed: { prompt: 0, completion: 0, total: 0 },
          intentHint: "doku",
        };
      }

      if (!confirmed) {
        return {
          response: `Soll ich dir eine Doku zu "${config.topic}" generieren? Sag einfach "ja".`,
          tokensUsed: { prompt: 0, completion: 0, total: 0 },
          intentHint: "doku",
          awaitingConfirmation: true,
        };
      }

      try {
        const created = await doku.generateDoku({ userId: auth.userID, config });
        const responseText = `Deine Doku "${created.title}" ist fertig. Ich kann sie dir oeffnen.`;
        return {
          response: responseText,
          tokensUsed: { prompt: 0, completion: 0, total: 0 },
          action: {
            type: "doku",
            id: created.id,
            title: created.title,
            route: `/doku-reader/${created.id}`,
          },
        };
      } catch (error) {
        console.error("Tavi doku generation error:", error);
        return {
          response: "Uups, die Doku konnte gerade nicht erstellt werden. Bitte versuch es gleich nochmal.",
          tokensUsed: { prompt: 0, completion: 0, total: 0 },
        };
      }
    }
    try {
      console.log(`ðŸ§žâ€â™‚ï¸ Tavi processing message from user ${auth.userID}:`, message);
      
      const payload = {
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: TAVI_SYSTEM_PROMPT },
          { role: "user", content: message },
        ],
        max_completion_tokens: 4000, // Increased for longer responses (riddles, stories, etc.)
        reasoning_effort: "low" as const, // Minimize reasoning tokens
      };

      console.log("ðŸ“¤ Sending request to OpenAI with payload:", {
        model: payload.model,
        messageCount: payload.messages.length,
        maxTokens: payload.max_completion_tokens,
        userMessageLength: message.length
      });

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openAIKey()}`,
        },
        body: JSON.stringify(payload),
      });

      console.log(`ðŸ“¥ OpenAI response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`âŒ Tavi OpenAI error ${response.status}:`, errorText);
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as OpenAIChatResponse;
      console.log("âœ… OpenAI response received:", {
        choicesCount: data.choices?.length || 0,
        tokensUsed: data.usage,
        finishReason: data.choices?.[0]?.finish_reason
      });

      // Log the Tavi chat interaction
      console.log(`ðŸ”¥ TAVI: About to publish log to logTopic...`);
      await publishWithTimeout(logTopic, {
        source: "openai-tavi-chat",
        timestamp: new Date(),
        request: payload,
        response: data,
        metadata: {
          userId: auth.userID,
          messageLength: message.length,
          wordCount: message.trim().split(/\s+/).length
        }
      });
      console.log(`âœ… TAVI: Log published successfully to logTopic!`);

      // Check for incomplete responses
      const finishReason = data.choices?.[0]?.finish_reason;
      if (finishReason === 'length') {
        console.warn("âš ï¸ Response was cut off due to token limit!");
      }
      
      const responseText = data.choices?.[0]?.message?.content || 
        "Entschuldige, meine magischen KrÃ¤fte sind momentan erschÃ¶pft! ðŸŒŸ Versuche es gleich nochmal.";

      const tokensUsed = {
        prompt: data.usage?.prompt_tokens || 0,
        completion: data.usage?.completion_tokens || 0,
        total: data.usage?.total_tokens || 0,
      };

      console.log(`ðŸŽ‰ Tavi chat success - User: ${auth.userID}, Tokens: ${tokensUsed.total}, Response length: ${responseText.length} chars`);
      
      // Warn if response might be too long
      if (responseText.length > 500) {
        console.warn(`âš ï¸ Tavi response is quite long: ${responseText.length} characters`);
      }

      return {
        response: responseText,
        tokensUsed,
      };

    } catch (error) {
      console.error("âŒ Tavi chat error occurred:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId: auth.userID,
        messageLength: message.length,
        timestamp: new Date().toISOString()
      });
      
      // More specific error handling
      if (error instanceof Error) {
        // Rate limiting
        if (error.message.includes('rate limit') || error.message.includes('429')) {
          console.warn("ðŸš¦ Rate limit hit for Tavi chat");
          return {
            response: "Ups! Zu viele magische Anfragen auf einmal! ðŸŒªï¸ Warte einen Moment und versuche es dann nochmal.",
            tokensUsed: { prompt: 0, completion: 0, total: 0 }
          };
        }
        
        // API quota exceeded
        if (error.message.includes('quota') || error.message.includes('insufficient')) {
          console.error("ðŸ’³ API quota/billing issue");
          return {
            response: "Meine magischen Ressourcen sind aufgebraucht! ðŸ’« Der Administrator muss sie wieder auffÃ¼llen.",
            tokensUsed: { prompt: 0, completion: 0, total: 0 }
          };
        }
        
        // Token limit issues
        if (error.message.includes('token') || error.message.includes('length')) {
          console.warn("ðŸ“ Token limit related issue");
          return {
            response: "Deine Frage ist zu komplex fÃ¼r meine magischen KrÃ¤fte! âœ¨ Versuche eine kÃ¼rzere, einfachere Frage.",
            tokensUsed: { prompt: 0, completion: 0, total: 0 }
          };
        }
        
        // Model issues
        if (error.message.includes('model') || error.message.includes('gpt')) {
          console.error("ðŸ¤– Model-related issue:", error.message);
          return {
            response: "Mein magisches Gehirn hat einen Aussetzer! ðŸ§ âœ¨ Versuche es in einem Moment nochmal.",
            tokensUsed: { prompt: 0, completion: 0, total: 0 }
          };
        }
      }

      // Generic fallback
      console.error("ðŸ”¥ Unexpected Tavi error - falling back to generic response");
      return {
        response: "Entschuldige, meine magischen Verbindungen sind gestÃ¶rt! âš¡ Versuche es in einem Moment nochmal.",
        tokensUsed: { prompt: 0, completion: 0, total: 0 }
      };
    }
  }
);

