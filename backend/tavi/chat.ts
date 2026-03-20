import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { getAuthData } from "~encore/auth";
import { ai, avatar, doku, story } from "~encore/clients";
import { logTopic } from "../log/logger";
import { publishWithTimeout } from "../helpers/pubsubTimeout";
import { avatarDB } from "../avatar/db";
import { storyDB } from "../story/db";
import { dokuDB } from "../doku/db";
import type { DokuConfig } from "../doku/generate";
import type { StoryConfig } from "../story/generate";
import { ensureAvatarProfileLinksTable } from "../avatar/profile-links";
import {
  ageToAgeGroup,
  buildDokuProfilePrompt,
  buildStoryProfilePrompt,
  buildTaviProfilePrompt,
} from "../helpers/child-profile-personalization";
import { getProfileForUser, resolveRequestedProfileId } from "../helpers/profiles";
import { TAVI_TOOLS } from "./tavi-tools";

const openAIKey = secret("OpenAIKey");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SupportedLanguage = "de" | "en" | "fr" | "es" | "it" | "nl" | "ru";
type AgeGroup = "3-5" | "6-8" | "9-12" | "13+";

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface TaviChatContext {
  language?: string;
  profileId?: string;
}

interface TaviChatRequest {
  message: string;
  history?: HistoryMessage[];
  context?: TaviChatContext;
}

type TaviActionType =
  | "story"
  | "doku"
  | "avatar"
  | "wizard_prefill"
  | "image"
  | "list"
  | "navigate";

interface TaviListItem {
  id: string;
  name: string;
  route: string;
  imageUrl?: string;
  type?: string;
  description?: string;
}

interface TaviChatAction {
  type: TaviActionType;
  id?: string;
  title?: string;
  route?: string;
  // wizard_prefill
  wizardType?: "story" | "avatar" | "doku";
  wizardData?: Record<string, any>;
  // image
  imageUrl?: string;
  imagePrompt?: string;
  // list
  items?: TaviListItem[];
}

interface TaviChatResponse {
  response: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  actions?: TaviChatAction[];
}

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPPORTED_LANGUAGES: SupportedLanguage[] = ["de", "en", "fr", "es", "it", "nl", "ru"];
const MAX_HISTORY_MESSAGES = 10;

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

function buildSystemPrompt(params: {
  profilePrompt?: string;
  avatarNames: string[];
  language: SupportedLanguage;
}): string {
  const { profilePrompt, avatarNames, language } = params;

  const avatarList =
    avatarNames.length > 0
      ? `\nVerfuegbare Avatare des Nutzers: ${avatarNames.join(", ")}`
      : "\nDer Nutzer hat noch keine Avatare erstellt.";

  const languageHint =
    language !== "de" ? `\nAntworte in der Sprache: ${language}` : "";

  return `Du bist Tavi, das magische Geschichten-Genie der Talea Storytelling Platform!

Persoenlichkeit:
- Freundlich, hilfsbereit und voller magischer Energie
- Sprichst lebendig und einladend
- Liebst Geschichten, Kreativitaet und das Helfen von Familien
- Verwendest gerne Emojis und magische Metaphern
- Bist ein Experte fuer Storytelling, Avatare und kreative Inhalte

WICHTIG - Deine Faehigkeiten:
Du kannst folgende Aktionen ausfuehren. Nutze die passenden Funktionen:

1. GESCHICHTEN ERSTELLEN (create_story): Generiere personalisierte Geschichten mit Avataren.
   - Frage nach Genre, Stimmung, Laenge wenn der Nutzer es nicht nennt
   - Nutze die verfuegbaren Avatare automatisch

2. DOKUS ERSTELLEN (create_doku): Erstelle Wissensdokumente zu jedem Thema.
   - Frage nach dem Thema wenn unklar

3. AVATARE ERSTELLEN (create_avatar): Erstelle neue Avatar-Charaktere.
   - Braucht mindestens einen Namen und Typ (Mensch, Katze, Drache, etc.)
   - Frage nach fehlenden Details

4. BILDER GENERIEREN (generate_image): Erstelle Bilder/Illustrationen mit dem Flux-Modell.
   - Schreibe den Prompt IMMER auf Englisch fuer beste Ergebnisse
   - Nutze "Axel Scheffler watercolor children's book illustration" als Stil-Basis
   - Beschreibe Details wie Farben, Komposition, Stimmung

5. WIZARDS OEFFNEN (open_story_wizard, open_avatar_wizard, open_doku_wizard):
   - Nutze diese um den Nutzer zum Wizard weiterzuleiten mit vorausgefuellten Daten
   - Wenn der Nutzer mehr Kontrolle haben moechte oder Details anpassen will

6. INHALTE AUFLISTEN (list_content): Zeige Avatare, Geschichten oder Dokus des Nutzers.

7. NAVIGATION (navigate_to): Leite zu bestimmten Seiten weiter.

Regeln:
- Halte Antworten kurz und praegnant (max 200 Woerter)
- Sei positiv und ermutigend, verwende "du" statt "Sie"
- Wenn du eine Aktion ausfuehrst, erklaere kurz was du machst
- Bei laengeren Aktionen (Story/Doku generieren) informiere den Nutzer ueber die Wartezeit
- Wenn der Nutzer etwas will das unklar ist, frage nach - rufe NICHT sofort eine Funktion auf
- Fuer Geschichten: Nutze immer die Avatare des Nutzers wenn verfuegbar
- Basiere Altersgruppe und Inhalt auf dem aktiven Kinderprofil
- Bei Bildgenerierung: Erstelle immer einen detaillierten englischen Prompt
${avatarList}${languageHint}${profilePrompt ? `\n\nAKTIVES KINDERPROFIL:\n${profilePrompt}\nBegruesse das Kind direkt mit Namen, wenn es natuerlich passt.` : ""}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeLanguage(value?: string): SupportedLanguage {
  if (!value) return "de";
  const normalized = value.toLowerCase().trim();
  if ((SUPPORTED_LANGUAGES as string[]).includes(normalized)) {
    return normalized as SupportedLanguage;
  }
  const base = normalized.split("-")[0];
  return (SUPPORTED_LANGUAGES as string[]).includes(base)
    ? (base as SupportedLanguage)
    : "de";
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function loadProfileScopedAvatars(params: {
  userId: string;
  profileId: string;
  childAvatarId?: string;
  preferredAvatarIds?: string[];
}): Promise<Array<{ id: string; name: string; imageUrl?: string }>> {
  await ensureAvatarProfileLinksTable();
  const rows = await avatarDB.queryAll<{
    id: string;
    name: string;
    avatar_role: string | null;
    image_url: string | null;
    created_at: Date;
  }>`
    SELECT a.id, a.name, a.avatar_role, a.image_url, a.created_at
    FROM avatars a
    WHERE a.user_id = ${params.userId}
      AND (
        a.profile_id = ${params.profileId}
        OR EXISTS (
          SELECT 1 FROM avatar_profile_links apl
          WHERE apl.avatar_id = a.id
            AND apl.user_id = ${params.userId}
            AND apl.profile_id = ${params.profileId}
        )
      )
    ORDER BY a.created_at DESC
  `;

  const preferred = new Set(
    (params.preferredAvatarIds || []).map((v) => v.trim()).filter(Boolean)
  );
  const childAvatarId = params.childAvatarId?.trim();

  return rows
    .slice()
    .sort((a, b) => {
      const aChild = a.id === childAvatarId || a.avatar_role === "child" ? 1 : 0;
      const bChild = b.id === childAvatarId || b.avatar_role === "child" ? 1 : 0;
      if (aChild !== bChild) return bChild - aChild;
      const aPref = preferred.has(a.id) ? 1 : 0;
      const bPref = preferred.has(b.id) ? 1 : 0;
      if (aPref !== bPref) return bPref - aPref;
      return a.name.localeCompare(b.name, "de");
    })
    .map((row) => ({ id: row.id, name: row.name, imageUrl: row.image_url ?? undefined }));
}

function selectAvatarIds(
  requestedNames: string[] | undefined,
  avatars: Array<{ id: string; name: string }>
): string[] {
  if (requestedNames && requestedNames.length > 0) {
    const matched: string[] = [];
    for (const reqName of requestedNames) {
      const lower = reqName.toLowerCase().trim();
      const found = avatars.find(
        (a) => a.name.toLowerCase() === lower
      );
      if (found) matched.push(found.id);
    }
    if (matched.length > 0) return matched.slice(0, 3);
  }
  return avatars.slice(0, 3).map((a) => a.id);
}

function mergePromptBlocks(...blocks: Array<string | undefined>): string | undefined {
  const merged = blocks
    .map((b) => b?.trim())
    .filter((b): b is string => Boolean(b))
    .join("\n\n");
  return merged.length > 0 ? merged : undefined;
}

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

async function handleCreateStory(params: {
  args: Record<string, any>;
  userId: string;
  profileId: string;
  avatars: Array<{ id: string; name: string }>;
  language: SupportedLanguage;
  fallbackAgeGroup?: AgeGroup;
  profilePrompt?: string;
}): Promise<TaviChatAction> {
  const { args, userId, profileId, avatars, language, fallbackAgeGroup, profilePrompt } = params;

  if (avatars.length === 0) {
    throw new Error("NO_AVATARS");
  }

  const avatarIds = selectAvatarIds(args.avatarNames, avatars);
  const config: StoryConfig = {
    avatarIds,
    genre: args.genre || "adventure",
    setting: args.setting || "varied",
    length: args.length || "medium",
    complexity: "medium",
    ageGroup: args.ageGroup || fallbackAgeGroup || "6-8",
    tone: args.tone || "warm",
    pacing: args.pacing || "balanced",
    suspenseLevel: args.suspenseLevel ?? 1,
    humorLevel: args.humorLevel ?? 1,
    allowRhymes: args.allowRhymes ?? false,
    hasTwist: args.hasTwist ?? false,
    customPrompt: mergePromptBlocks(args.customPrompt, profilePrompt),
    language,
    aiModel: "gemini-3-flash-preview",
    preferences: {
      useFairyTaleTemplate:
        args.genre === "fairy_tales" || args.genre === "magic",
    },
  };

  const created = await story.generate({ userId, profileId, config });
  return {
    type: "story",
    id: created.id,
    title: created.title,
    route: `/story-reader/${created.id}`,
  };
}

async function handleCreateDoku(params: {
  args: Record<string, any>;
  userId: string;
  profileId: string;
  language: SupportedLanguage;
  fallbackAgeGroup?: AgeGroup;
  profilePrompt?: string;
}): Promise<TaviChatAction> {
  const { args, userId, profileId, language, fallbackAgeGroup, profilePrompt } = params;

  const includeInteractive = args.includeInteractive ?? true;
  const config: DokuConfig = {
    topic: args.topic,
    ageGroup: args.ageGroup || fallbackAgeGroup || "6-8",
    depth: args.depth || "standard",
    perspective: args.perspective || "science",
    tone: args.tone || "curious",
    length: args.length || "medium",
    includeInteractive,
    quizQuestions: includeInteractive ? 3 : 0,
    handsOnActivities: includeInteractive ? 1 : 0,
    language,
    personalizationPrompt: profilePrompt,
  };

  const created = await doku.generateDoku({ userId, profileId, config });
  return {
    type: "doku",
    id: created.id,
    title: created.title,
    route: `/doku-reader/${created.id}`,
  };
}

async function handleCreateAvatar(params: {
  args: Record<string, any>;
  userId: string;
  profileId: string;
}): Promise<TaviChatAction> {
  const { args, userId, profileId } = params;

  // Generate avatar image first
  let imageUrl: string | undefined;
  try {
    const imageResult = await ai.generateAvatarImage({
      characterType: args.characterType || "human",
      appearance: args.appearance || "",
      personalityTraits: {},
      style: "disney",
    });
    imageUrl = imageResult.imageUrl;
  } catch (e) {
    console.error("Tavi avatar image generation failed:", e);
  }

  const created = await avatar.create({
    profileId,
    name: args.name,
    description: args.appearance || undefined,
    physicalTraits: {
      characterType: args.characterType || "human",
      appearance: args.appearance || `A ${args.characterType || "human"} named ${args.name}`,
    },
    personalityTraits: {
      knowledge: { value: 0 },
      creativity: { value: 0 },
      vocabulary: { value: 0 },
      courage: { value: 0 },
      curiosity: { value: 0 },
      teamwork: { value: 0 },
      empathy: { value: 0 },
      persistence: { value: 0 },
      logic: { value: 0 },
    },
    imageUrl,
    creationType: "ai-generated",
    avatarRole: "companion",
    sourceType: "profile",
  });

  return {
    type: "avatar",
    id: created.id,
    title: created.name,
    route: `/avatar/${created.id}`,
  };
}

async function handleGenerateImage(params: {
  args: Record<string, any>;
}): Promise<TaviChatAction> {
  const { args } = params;

  let prompt = args.prompt || "";
  const style = args.style || "disney";

  // Add style prefix for consistent quality
  if (style === "disney") {
    prompt = `Axel Scheffler watercolor children's book illustration style. ${prompt}. Soft colors, whimsical, warm lighting, detailed, high quality.`;
  } else if (style === "anime") {
    prompt = `Anime illustration style. ${prompt}. Vibrant colors, detailed, clean lines, high quality.`;
  }
  // realistic: use prompt as-is

  const imageResult = await ai.generateImage({
    prompt,
    width: 1024,
    height: 1024,
    steps: 4,
    outputFormat: "WEBP",
  });

  return {
    type: "image",
    imageUrl: imageResult.imageUrl,
    imagePrompt: args.prompt,
  };
}

async function handleListContent(params: {
  args: Record<string, any>;
  userId: string;
  profileId: string;
}): Promise<TaviChatAction> {
  const { args, userId, profileId } = params;
  const contentType = args.contentType as "avatars" | "stories" | "dokus";
  const limit = Math.min(args.limit || 5, 10);

  const items: TaviListItem[] = [];

  if (contentType === "avatars") {
    const rows = await avatarDB.queryAll<{
      id: string;
      name: string;
      image_url: string | null;
      avatar_role: string | null;
    }>`
      SELECT id, name, image_url, avatar_role
      FROM avatars
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    for (const row of rows) {
      items.push({
        id: row.id,
        name: row.name,
        route: `/avatar/${row.id}`,
        imageUrl: row.image_url ?? undefined,
        type: row.avatar_role ?? "companion",
      });
    }
  } else if (contentType === "stories") {
    const rows = await storyDB.queryAll<{
      id: string;
      title: string;
      cover_image_url: string | null;
      genre: string | null;
    }>`
      SELECT id, title, cover_image_url,
        config->>'genre' as genre
      FROM stories
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    for (const row of rows) {
      items.push({
        id: row.id,
        name: row.title,
        route: `/story-reader/${row.id}`,
        imageUrl: row.cover_image_url ?? undefined,
        type: row.genre ?? undefined,
      });
    }
  } else if (contentType === "dokus") {
    const rows = await dokuDB.queryAll<{
      id: string;
      title: string;
      topic: string;
      cover_image_url: string | null;
    }>`
      SELECT id, title, topic, cover_image_url
      FROM dokus
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    for (const row of rows) {
      items.push({
        id: row.id,
        name: row.title,
        route: `/doku-reader/${row.id}`,
        imageUrl: row.cover_image_url ?? undefined,
        description: row.topic,
      });
    }
  }

  return { type: "list", items };
}

function handleWizardPrefill(
  wizardType: "story" | "avatar" | "doku",
  args: Record<string, any>,
  avatars?: Array<{ id: string; name: string }>
): TaviChatAction {
  const routeMap = {
    story: "/story",
    avatar: "/avatar/create",
    doku: "/doku/create",
  };

  const wizardData: Record<string, any> = { ...args };

  // Resolve avatar names to IDs for story wizard
  if (wizardType === "story" && args.avatarNames && avatars) {
    const ids = selectAvatarIds(args.avatarNames, avatars);
    wizardData.avatarIds = ids;
    delete wizardData.avatarNames;
  }

  return {
    type: "wizard_prefill",
    wizardType,
    wizardData,
    route: routeMap[wizardType],
  };
}

function handleNavigate(args: Record<string, any>): TaviChatAction {
  const routeMap: Record<string, string> = {
    home: "/",
    avatars: "/avatars",
    stories: "/stories",
    dokus: "/dokus",
    settings: "/settings",
    avatar_detail: `/avatar/${args.id || ""}`,
    story_reader: `/story-reader/${args.id || ""}`,
    doku_reader: `/doku-reader/${args.id || ""}`,
    avatar_create: "/avatar/create",
    story_create: "/story",
    doku_create: "/doku/create",
    fairy_tales: "/fairytales",
  };

  return {
    type: "navigate",
    route: routeMap[args.destination] || "/",
    title: args.name,
  };
}

// ---------------------------------------------------------------------------
// Main endpoint
// ---------------------------------------------------------------------------

export const taviChat = api<TaviChatRequest, TaviChatResponse>(
  { expose: true, method: "POST", path: "/tavi/chat", auth: true },
  async ({ message, history, context }) => {
    const auth = getAuthData()!;

    // Validate
    const wordCount = message.trim().split(/\s+/).length;
    if (wordCount > 100) {
      throw new Error("Nachricht zu lang! Bitte halte deine Frage unter 100 Woertern.");
    }
    if (!message.trim()) {
      throw new Error("Bitte stelle eine Frage!");
    }

    const language = normalizeLanguage(context?.language);
    const activeProfileId = await resolveRequestedProfileId({
      userId: auth.userID,
      requestedProfileId: context?.profileId,
      fallbackName: auth.email ?? undefined,
    });
    const activeProfile = await getProfileForUser({
      userId: auth.userID,
      profileId: activeProfileId,
    });
    const profileAgeGroup = ageToAgeGroup(activeProfile.age);
    const storyProfilePrompt = buildStoryProfilePrompt(activeProfile);
    const dokuProfilePrompt = buildDokuProfilePrompt(activeProfile);
    const taviProfilePrompt = buildTaviProfilePrompt(activeProfile);

    // Load avatars for context
    const avatars = await loadProfileScopedAvatars({
      userId: auth.userID,
      profileId: activeProfileId,
      childAvatarId: activeProfile.childAvatarId,
      preferredAvatarIds: activeProfile.preferredAvatarIds,
    });

    // Build messages array with history
    const messages: OpenAIMessage[] = [
      {
        role: "system",
        content: buildSystemPrompt({
          profilePrompt: taviProfilePrompt,
          avatarNames: avatars.map((a) => a.name),
          language,
        }),
      },
    ];

    // Add conversation history (last N messages)
    if (history && history.length > 0) {
      const trimmedHistory = history.slice(-MAX_HISTORY_MESSAGES);
      for (const msg of trimmedHistory) {
        messages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        });
      }
    }

    // Add current message
    messages.push({ role: "user", content: message });

    console.log(
      `Tavi processing message from user ${auth.userID}:`,
      message.substring(0, 100)
    );

    try {
      // Call OpenAI with function calling
      const payload = {
        model: "gpt-5.4-mini",
        messages,
        tools: TAVI_TOOLS,
        tool_choice: "auto",
        max_completion_tokens: 4000,
        reasoning_effort: "low" as const,
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
        console.error(`Tavi OpenAI error ${response.status}:`, errorText);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = (await response.json()) as OpenAIChatResponse;
      const choice = data.choices?.[0];
      const tokensUsed = {
        prompt: data.usage?.prompt_tokens || 0,
        completion: data.usage?.completion_tokens || 0,
        total: data.usage?.total_tokens || 0,
      };

      // Log interaction
      await publishWithTimeout(logTopic, {
        source: "openai-tavi-chat",
        timestamp: new Date(),
        request: { message, historyLength: history?.length || 0 },
        response: {
          content: choice?.message?.content?.substring(0, 200),
          toolCalls: choice?.message?.tool_calls?.map((tc) => tc.function.name),
        },
        metadata: {
          userId: auth.userID,
          tokens: tokensUsed.total,
        },
      });

      // Handle tool calls
      const toolCalls = choice?.message?.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        const actions: TaviChatAction[] = [];
        let textResponse = choice?.message?.content || "";
        const errors: string[] = [];

        for (const toolCall of toolCalls) {
          const fnName = toolCall.function.name;
          let args: Record<string, any> = {};
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch {
            console.error(`Failed to parse tool args for ${fnName}`);
            continue;
          }

          console.log(`Tavi executing tool: ${fnName}`, args);

          try {
            switch (fnName) {
              case "create_story": {
                const action = await handleCreateStory({
                  args,
                  userId: auth.userID,
                  profileId: activeProfileId,
                  avatars,
                  language,
                  fallbackAgeGroup: profileAgeGroup,
                  profilePrompt: storyProfilePrompt,
                });
                actions.push(action);
                if (!textResponse) {
                  textResponse = `Deine Geschichte "${action.title}" ist fertig!`;
                }
                break;
              }
              case "create_doku": {
                const action = await handleCreateDoku({
                  args,
                  userId: auth.userID,
                  profileId: activeProfileId,
                  language,
                  fallbackAgeGroup: profileAgeGroup,
                  profilePrompt: dokuProfilePrompt,
                });
                actions.push(action);
                if (!textResponse) {
                  textResponse = `Deine Doku "${action.title}" ist fertig!`;
                }
                break;
              }
              case "create_avatar": {
                const action = await handleCreateAvatar({
                  args,
                  userId: auth.userID,
                  profileId: activeProfileId,
                });
                actions.push(action);
                if (!textResponse) {
                  textResponse = `Dein Avatar "${action.title}" wurde erstellt!`;
                }
                break;
              }
              case "generate_image": {
                const action = await handleGenerateImage({ args });
                actions.push(action);
                if (!textResponse) {
                  textResponse = "Hier ist dein Bild!";
                }
                break;
              }
              case "list_content": {
                const action = await handleListContent({
                  args,
                  userId: auth.userID,
                  profileId: activeProfileId,
                });
                actions.push(action);
                if (!textResponse) {
                  const count = action.items?.length || 0;
                  const typeLabel =
                    args.contentType === "avatars"
                      ? "Avatare"
                      : args.contentType === "stories"
                        ? "Geschichten"
                        : "Dokus";
                  textResponse =
                    count > 0
                      ? `Hier sind deine ${typeLabel}:`
                      : `Du hast noch keine ${typeLabel}.`;
                }
                break;
              }
              case "open_story_wizard": {
                const action = handleWizardPrefill("story", args, avatars);
                actions.push(action);
                if (!textResponse) {
                  textResponse =
                    "Ich oeffne den Story-Wizard fuer dich mit den vorausgefuellten Einstellungen!";
                }
                break;
              }
              case "open_avatar_wizard": {
                const action = handleWizardPrefill("avatar", args);
                actions.push(action);
                if (!textResponse) {
                  textResponse =
                    "Ich oeffne den Avatar-Wizard fuer dich!";
                }
                break;
              }
              case "open_doku_wizard": {
                const action = handleWizardPrefill("doku", args);
                actions.push(action);
                if (!textResponse) {
                  textResponse =
                    "Ich oeffne den Doku-Wizard fuer dich mit den vorausgefuellten Einstellungen!";
                }
                break;
              }
              case "navigate_to": {
                const action = handleNavigate(args);
                actions.push(action);
                if (!textResponse) {
                  textResponse = "Ich leite dich weiter!";
                }
                break;
              }
              default:
                console.warn(`Unknown tool call: ${fnName}`);
            }
          } catch (err) {
            console.error(`Tavi tool ${fnName} failed:`, err);
            if (err instanceof Error && err.message === "NO_AVATARS") {
              errors.push(
                "Du hast noch keine Avatare. Erstelle zuerst einen Avatar, dann kann ich dir eine Geschichte generieren!"
              );
            } else {
              errors.push(
                `Die Aktion konnte leider nicht ausgefuehrt werden. Versuch es gleich nochmal.`
              );
            }
          }
        }

        if (errors.length > 0) {
          textResponse = errors.join("\n\n");
        }

        return {
          response: textResponse,
          tokensUsed,
          actions: actions.length > 0 ? actions : undefined,
        };
      }

      // No tool calls - just text response
      const responseText =
        choice?.message?.content ||
        "Entschuldige, meine magischen Kraefte sind momentan erschoepft! Versuche es gleich nochmal.";

      return { response: responseText, tokensUsed };
    } catch (error) {
      console.error("Tavi chat error:", error);

      if (error instanceof Error) {
        if (error.message.includes("rate limit") || error.message.includes("429")) {
          return {
            response:
              "Zu viele Anfragen auf einmal! Warte einen Moment und versuche es dann nochmal.",
            tokensUsed: { prompt: 0, completion: 0, total: 0 },
          };
        }
        if (error.message.includes("quota") || error.message.includes("insufficient")) {
          return {
            response:
              "Meine magischen Ressourcen sind aufgebraucht! Der Administrator muss sie wieder auffuellen.",
            tokensUsed: { prompt: 0, completion: 0, total: 0 },
          };
        }
      }

      return {
        response:
          "Entschuldige, etwas ist schiefgelaufen. Versuche es in einem Moment nochmal.",
        tokensUsed: { prompt: 0, completion: 0, total: 0 },
      };
    }
  }
);
