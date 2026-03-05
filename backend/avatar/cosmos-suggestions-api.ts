import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { secret } from "encore.dev/config";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { avatarDB } from "./db";
import { ensureCosmosMvpSchema } from "./cosmos-mvp-schema";
import { normalizeDomainId, type CosmosDomainId } from "./cosmos-mvp-logic";
import { resolveChildIdForCosmos } from "./cosmos-mvp-service";

const userDB = SQLDatabase.named("user");
const openAIKey = secret("OpenAIKey");

const SUGGESTION_MODEL = "gpt-5-nano";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_LIST_CHARS = 1500;
const MAX_SUGGESTIONS_IN_CACHE = 56;
const INITIAL_SUGGESTION_COUNT = 18;

type SuggestionAgeBand = "3-5" | "6-8" | "9-12" | "13+";
type SuggestionKind = "broaden" | "deepen" | "retention";
type SkillFocus = "remember" | "understand" | "compare" | "apply" | "transfer";

interface TopicSuggestionItem {
  suggestionId: string;
  topicTitle: string;
  topicSlug: string;
  kind: SuggestionKind;
  difficulty: number;
  teaserKid: string;
  reasonParent: string;
  skillFocus: SkillFocus;
}

interface TopicSuggestionsResponse {
  domainId: string;
  generatedAt: string;
  items: TopicSuggestionItem[];
}

interface SuggestionsQueryRequest {
  childId?: string;
  profileId?: string;
  avatarId?: string;
  domainId: string;
}

interface RefreshOneRequest {
  childId?: string;
  profileId?: string;
  avatarId?: string;
  domainId: string;
}

interface RefreshOneResponse {
  item: TopicSuggestionItem;
}

interface SelectSuggestionRequest {
  childId?: string;
  profileId?: string;
  avatarId?: string;
  domainId: string;
  topicSlug: string;
  topicTitle: string;
}

interface SelectSuggestionResponse {
  ok: true;
}

const SYSTEM_PROMPT = [
  "You generate topic suggestions for children's documentaries inside an app.",
  "Return ONLY valid JSON. No markdown. No extra text.",
  "",
  "Rules:",
  "- Age-appropriate for ageBand.",
  "- No duplicate topics: avoid any titles/aliases in excludeTitles.",
  "- Keep titles short (max 60 chars) and concrete.",
  "- Provide a mix of kinds: broaden, deepen, retention (prefer broaden/deepen).",
  "- No sensitive content. Keep it safe for kids.",
  "- Output schema exactly as requested.",
].join("\n");

const FALLBACK_TITLES: Record<string, string[]> = {
  space: [
    "Warum funkeln Sterne?",
    "Wie leben Astronauten im All?",
    "Was ist ein Exoplanet?",
    "Warum hat der Mars rote Farbe?",
    "Wie entstehen Sternschnuppen?",
    "Saturnringe einfach erklaert",
    "Warum gibt es Tag und Nacht?",
    "Wie misst man Entfernungen im All?",
    "Warum haben Planeten Monde?",
    "Wie startet eine Rakete?",
    "Was macht ein Weltraumteleskop?",
    "Wie alt ist das Universum?",
  ],
  nature: [
    "Wie sprechen Tiere miteinander?",
    "Warum wechseln Blaetter die Farbe?",
    "Wie bauen Ameisen ihre Stadt?",
    "Wieso brauchen wir Bestaeuber?",
    "Wie schlafen Tiere im Winter?",
    "Warum wachsen Pilze im Wald?",
    "Wie atmen Fische unter Wasser?",
    "Wie entsteht Honig?",
    "Wie wandern Zugvoegel?",
    "Was passiert im Boden unter uns?",
    "Wie funktioniert ein Regenwald?",
    "Warum sind Korallen wichtig?",
  ],
  history: [
    "Wie lebten Kinder im Mittelalter?",
    "Warum bauten Menschen Burgen?",
    "Wie entstanden alte Schriftzeichen?",
    "Was war ein Marktplatz frueher?",
    "Wie reisten Menschen ohne Autos?",
    "Wie entstand die erste Stadt?",
    "Warum gab es Ritterturniere?",
    "Wie arbeiteten Handwerker frueher?",
    "Wie wurde Wissen frueher weitergegeben?",
    "Warum wurden Mauern um Staedte gebaut?",
    "Wie funktionierte eine alte Schule?",
    "Was lernten Menschen aus Entdeckungsreisen?",
  ],
  tech: [
    "Wie denkt ein Roboter?",
    "Wie kommt Strom in die Steckdose?",
    "Warum brauchen Computer Codes?",
    "Wie funktioniert ein 3D-Drucker?",
    "Wie entstehen Videospiele?",
    "Wie arbeiten Sensoren im Alltag?",
    "Was ist ein Algorithmus fuer Kinder?",
    "Wie lernen Maschinen Muster?",
    "Warum koennen Drohnen fliegen?",
    "Wie funktioniert eine Suchmaschine?",
    "Was macht ein Mikrochip?",
    "Wie baut man eine stabile Bruecke?",
  ],
  body: [
    "Warum schlaegt das Herz schneller?",
    "Wie heilt eine Wunde?",
    "Warum brauchen wir Schlaf?",
    "Wie arbeitet das Immunsystem?",
    "Wie sendet das Gehirn Signale?",
    "Warum muessen wir trinken?",
    "Wie entsteht Muskelkraft?",
    "Warum bekommen wir Gansehaut?",
    "Wie funktioniert unser Gleichgewicht?",
    "Was macht die Haut den ganzen Tag?",
    "Wie verdaut der Magen Essen?",
    "Warum atmen wir schneller beim Laufen?",
  ],
  earth: [
    "Wie entstehen Wolken?",
    "Warum gibt es Jahreszeiten?",
    "Wie bilden sich Berge?",
    "Wie entsteht ein Vulkan?",
    "Warum bewegen sich Erdplatten?",
    "Wie funktioniert der Wasserkreislauf?",
    "Warum sind Moore wichtig?",
    "Wie entsteht Wind?",
    "Was passiert bei einer Flut?",
    "Wie messen wir Wetter?",
    "Warum wird das Meer salzig?",
    "Wie schuetzen Waelder das Klima?",
  ],
  arts: [
    "Wie macht Musik Stimmung?",
    "Warum harmonieren Farben?",
    "Wie entsteht ein Comic?",
    "Was macht eine gute Melodie?",
    "Wie funktioniert Stop-Motion?",
    "Wie erzaehlen Bilder Geschichten?",
    "Wie baut man ein Instrument?",
    "Warum hat Kunst verschiedene Stile?",
    "Wie entstehen Soundeffekte?",
    "Wie trainiert man den Rhythmus?",
    "Was ist Perspektive beim Zeichnen?",
    "Wie arbeitet ein Orchester zusammen?",
  ],
  logic: [
    "Wie loest man Knobelraetsel?",
    "Was ist ein Denkmuster?",
    "Wie erkennt man Regeln in Zahlen?",
    "Warum hilft Schach beim Denken?",
    "Wie prueft man eine Vermutung?",
    "Was ist ein guter Hinweis?",
    "Wie findet man Fehler in einer Loesung?",
    "Wie plant man mehrere Schritte voraus?",
    "Warum sind Vergleiche wichtig?",
    "Wie funktionieren Wenn-Dann-Regeln?",
    "Wie sortiert man Informationen klug?",
    "Wie trainiert man logisches Denken im Alltag?",
  ],
};

const DOMAIN_LABELS: Record<string, string> = {
  space: "Weltraum",
  nature: "Natur & Tiere",
  history: "Geschichte & Kulturen",
  tech: "Technik & Erfindungen",
  body: "Mensch & Koerper",
  earth: "Erde & Klima",
  arts: "Kunst & Musik",
  logic: "Logik & Raetsel",
};

let ensureTopicSuggestionSchemaPromise: Promise<void> | null = null;

function requireUserId(): string {
  const auth = getAuthData();
  if (!auth?.userID) {
    throw APIError.unauthenticated("Unauthorized");
  }
  return auth.userID;
}

function trimText(input: unknown, limit: number, fallback = ""): string {
  const raw = String(input ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return fallback;
  if (raw.length <= limit) return raw;
  return raw.slice(0, limit).trim();
}

function normalizeForKey(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_")
    .slice(0, 80);
}

function toAsciiSlug(value: string): string {
  return normalizeForKey(value).slice(0, 72);
}

function domainLabelFromId(domainId: string): string {
  const direct = DOMAIN_LABELS[domainId];
  if (direct) return direct;
  const title = String(domainId || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return title || "diesen Bereich";
}

function normalizeSkillFocus(input: unknown): SkillFocus {
  const value = String(input || "").trim().toLowerCase();
  if (value === "remember") return "remember";
  if (value === "understand") return "understand";
  if (value === "compare") return "compare";
  if (value === "apply") return "apply";
  if (value === "transfer") return "transfer";
  if (value === "explain") return "understand";
  return "understand";
}

function normalizeKind(input: unknown, allowRetention: boolean): SuggestionKind {
  const value = String(input || "").trim().toLowerCase();
  if (value === "broaden") return "broaden";
  if (value === "deepen") return "deepen";
  if (allowRetention && value === "retention") return "retention";
  return "broaden";
}

function clampDifficulty(value: unknown): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return 2;
  if (parsed < 1) return 1;
  if (parsed > 5) return 5;
  return parsed;
}

function topicDedupKey(topicTitle: string, topicSlug: string): string {
  return `${normalizeForKey(topicTitle)}|${normalizeForKey(topicSlug)}`;
}

function listToPromptText(values: string[], maxItems: number): string {
  const unique = Array.from(
    new Set(
      values
        .map((value) => trimText(value, 120))
        .filter((value) => value.length > 0)
    )
  ).slice(0, maxItems);
  if (unique.length === 0) return "(none)";
  const combined = unique.join(" | ");
  if (combined.length <= MAX_LIST_CHARS) return combined;
  return `${combined.slice(0, MAX_LIST_CHARS - 4)} ...`;
}

function mapAgeToSuggestionBand(age: number | null | undefined): SuggestionAgeBand {
  if (!Number.isFinite(Number(age))) return "6-8";
  const safeAge = Math.max(0, Math.floor(Number(age)));
  if (safeAge <= 5) return "3-5";
  if (safeAge <= 8) return "6-8";
  if (safeAge <= 12) return "9-12";
  return "13+";
}

async function ensureTopicSuggestionSchema(): Promise<void> {
  if (ensureTopicSuggestionSchemaPromise) {
    return ensureTopicSuggestionSchemaPromise;
  }

  ensureTopicSuggestionSchemaPromise = (async () => {
    await avatarDB.exec`
      CREATE TABLE IF NOT EXISTS topic_suggestions_cache (
          child_id TEXT NOT NULL,
          domain_id TEXT NOT NULL REFERENCES domains(domain_id),
          age_band TEXT NOT NULL,
          items_json JSONB NOT NULL DEFAULT '{"domainId":"","generatedAt":"","items":[]}'::jsonb,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (child_id, domain_id, age_band)
      )
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_topic_suggestions_cache_child
      ON topic_suggestions_cache(child_id, updated_at DESC)
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_topic_suggestions_cache_domain
      ON topic_suggestions_cache(domain_id, updated_at DESC)
    `;
    await avatarDB.exec`
      CREATE TABLE IF NOT EXISTS topic_suggestion_events (
          id TEXT PRIMARY KEY,
          child_id TEXT NOT NULL,
          domain_id TEXT NOT NULL REFERENCES domains(domain_id),
          action TEXT NOT NULL,
          payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_topic_suggestion_events_child
      ON topic_suggestion_events(child_id, created_at DESC)
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_topic_suggestion_events_domain
      ON topic_suggestion_events(domain_id, created_at DESC)
    `;
    await avatarDB.exec`
      CREATE INDEX IF NOT EXISTS idx_topic_suggestion_events_action
      ON topic_suggestion_events(action, created_at DESC)
    `;
  })();

  try {
    await ensureTopicSuggestionSchemaPromise;
  } catch (error) {
    ensureTopicSuggestionSchemaPromise = null;
    throw error;
  }
}

async function getChildAgeBand(childId: string): Promise<SuggestionAgeBand> {
  const row = await userDB.queryRow<{ age: number | null }>`
    SELECT age
    FROM child_profiles
    WHERE id = ${childId}
    LIMIT 1
  `;
  return mapAgeToSuggestionBand(row?.age);
}

async function getAlreadyTopics(childId: string, domainId: CosmosDomainId): Promise<string[]> {
  const rows = await avatarDB.queryAll<{ title: string }>`
    SELECT t.title
    FROM tracking_topic_state tts
    JOIN topics t
      ON t.topic_id = tts.topic_id
    WHERE tts.child_id = ${childId}
      AND t.domain_id = ${domainId}
    ORDER BY tts.updated_at DESC
    LIMIT 80
  `;
  return Array.from(
    new Set(
      rows
        .map((row) => trimText(row.title, 120))
        .filter((value) => value.length > 0)
    )
  ).slice(0, 60);
}

async function getRecentDokus(childId: string, domainId: CosmosDomainId): Promise<string[]> {
  const rows = await avatarDB.queryAll<{ title: string }>`
    SELECT COALESCE(NULLIF(ci.package_json->>'title', ''), t.title, '') AS title
    FROM content_items ci
    LEFT JOIN topics t
      ON t.topic_id = ci.topic_id
    WHERE ci.child_id = ${childId}
      AND ci.domain_id = ${domainId}
      AND ci.type = 'doku'
    ORDER BY ci.created_at DESC
    LIMIT 16
  `;
  return Array.from(
    new Set(
      rows
        .map((row) => trimText(row.title, 120))
        .filter((value) => value.length > 0)
    )
  ).slice(0, 10);
}

function normalizeSuggestionItem(params: {
  raw: unknown;
  domainId: CosmosDomainId;
  allowRetention: boolean;
}): TopicSuggestionItem | null {
  if (!params.raw || typeof params.raw !== "object") return null;
  const item = params.raw as Record<string, unknown>;
  const topicTitle = trimText(item.topicTitle, 60);
  if (!topicTitle) return null;

  const rawSlug = trimText(item.topicSlug, 72);
  const baseSlug = toAsciiSlug(rawSlug || topicTitle);
  if (!baseSlug) return null;
  const topicSlug = baseSlug.startsWith(`${params.domainId}_`)
    ? baseSlug
    : `${params.domainId}_${baseSlug}`.slice(0, 72);

  return {
    suggestionId: trimText(item.suggestionId, 60) || `sug_${crypto.randomUUID()}`,
    topicTitle,
    topicSlug,
    kind: normalizeKind(item.kind, params.allowRetention),
    difficulty: clampDifficulty(item.difficulty),
    teaserKid: trimText(item.teaserKid, 90, "Spannendes Thema zum Entdecken."),
    reasonParent: trimText(
      item.reasonParent,
      140,
      "Passt zum bisherigen Lernweg und erweitert das Verstaendnis."
    ),
    skillFocus: normalizeSkillFocus(item.skillFocus),
  };
}

function enforceMixRules(items: TopicSuggestionItem[]): TopicSuggestionItem[] {
  const adjusted = [...items];

  let retentionCount = adjusted.filter((item) => item.kind === "retention").length;
  if (retentionCount > 3) {
    for (const item of adjusted) {
      if (retentionCount <= 3) break;
      if (item.kind === "retention") {
        item.kind = "deepen";
        retentionCount -= 1;
      }
    }
  }

  let broadenCount = adjusted.filter((item) => item.kind === "broaden").length;
  if (broadenCount < 10) {
    for (const item of adjusted) {
      if (broadenCount >= 10) break;
      if (item.kind !== "broaden") {
        item.kind = "broaden";
        broadenCount += 1;
      }
    }
  }

  return adjusted;
}

function fallbackSkillByIndex(index: number): SkillFocus {
  const order: SkillFocus[] = ["understand", "compare", "apply", "transfer", "remember"];
  return order[index % order.length];
}

function fallbackKindByIndex(index: number, allowRetention: boolean): SuggestionKind {
  if (allowRetention && index > 0 && index % 7 === 0) return "retention";
  if (index % 5 === 0) return "deepen";
  return "broaden";
}

function buildFallbackItem(params: {
  domainId: CosmosDomainId;
  title: string;
  index: number;
  allowRetention: boolean;
}): TopicSuggestionItem {
  const skillFocus = fallbackSkillByIndex(params.index);
  const topicTitle = trimText(params.title, 60, "Spannendes Thema");
  const slugBase = toAsciiSlug(topicTitle) || `topic_${params.index + 1}`;
  const topicSlug = slugBase.startsWith(`${params.domainId}_`)
    ? slugBase
    : `${params.domainId}_${slugBase}`.slice(0, 72);
  const label = domainLabelFromId(params.domainId);
  return {
    suggestionId: `sug_${crypto.randomUUID()}`,
    topicTitle,
    topicSlug,
    kind: fallbackKindByIndex(params.index, params.allowRetention),
    difficulty: Math.min(5, Math.max(1, 1 + (params.index % 4))),
    teaserKid: trimText(`Was steckt hinter "${topicTitle}"?`, 90, "Lass uns etwas Neues entdecken."),
    reasonParent: trimText(
      `Passt zu ${label} und staerkt besonders ${skillFocus}.`,
      140,
      "Passt zum Lernstand und erweitert den Horizont."
    ),
    skillFocus,
  };
}

function withFallbackItems(params: {
  domainId: CosmosDomainId;
  items: TopicSuggestionItem[];
  excludeKeys: Set<string>;
  targetCount: number;
  allowRetention: boolean;
}): TopicSuggestionItem[] {
  const out = [...params.items];
  const fallbackTitles = FALLBACK_TITLES[params.domainId] || [
    `Warum ist ${domainLabelFromId(params.domainId)} spannend?`,
    `Wie entdeckt man Neues in ${domainLabelFromId(params.domainId)}?`,
    `Welche Geheimnisse hat ${domainLabelFromId(params.domainId)}?`,
    `Wie erklaert man ${domainLabelFromId(params.domainId)} Kindern?`,
    `Welche Experimente passen zu ${domainLabelFromId(params.domainId)}?`,
  ];
  let fallbackIndex = 0;

  while (out.length < params.targetCount && fallbackIndex < fallbackTitles.length) {
    const fallback = buildFallbackItem({
      domainId: params.domainId,
      title: fallbackTitles[fallbackIndex],
      index: fallbackIndex,
      allowRetention: params.allowRetention,
    });
    fallbackIndex += 1;
    const key = topicDedupKey(fallback.topicTitle, fallback.topicSlug);
    if (params.excludeKeys.has(key)) continue;
    params.excludeKeys.add(key);
    out.push(fallback);
  }

  return out;
}

function parseSuggestionsPayload(raw: unknown, domainId: CosmosDomainId): TopicSuggestionsResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const rawItems = Array.isArray(source.items) ? source.items : [];
  const keys = new Set<string>();
  const normalized: TopicSuggestionItem[] = [];

  for (const rawItem of rawItems) {
    const candidate = normalizeSuggestionItem({
      raw: rawItem,
      domainId,
      allowRetention: true,
    });
    if (!candidate) continue;
    const key = topicDedupKey(candidate.topicTitle, candidate.topicSlug);
    if (keys.has(key)) continue;
    keys.add(key);
    normalized.push(candidate);
  }

  if (normalized.length === 0) return null;
  return {
    domainId,
    generatedAt: trimText(source.generatedAt, 40) || new Date().toISOString(),
    items: normalized,
  };
}

async function readSuggestionCache(params: {
  childId: string;
  domainId: CosmosDomainId;
  ageBand: SuggestionAgeBand;
}): Promise<{ payload: TopicSuggestionsResponse; updatedAt: number } | null> {
  const row = await avatarDB.queryRow<{
    items_json: unknown;
    updated_at: string;
  }>`
    SELECT items_json, updated_at
    FROM topic_suggestions_cache
    WHERE child_id = ${params.childId}
      AND domain_id = ${params.domainId}
      AND age_band = ${params.ageBand}
    LIMIT 1
  `;

  if (!row) return null;
  const payload = parseSuggestionsPayload(row.items_json, params.domainId);
  if (!payload) return null;
  return {
    payload,
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

async function writeSuggestionCache(params: {
  childId: string;
  domainId: CosmosDomainId;
  ageBand: SuggestionAgeBand;
  payload: TopicSuggestionsResponse;
}): Promise<void> {
  await avatarDB.exec`
    INSERT INTO topic_suggestions_cache (
      child_id,
      domain_id,
      age_band,
      items_json,
      updated_at
    )
    VALUES (
      ${params.childId},
      ${params.domainId},
      ${params.ageBand},
      ${JSON.stringify(params.payload)}::jsonb,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (child_id, domain_id, age_band)
    DO UPDATE
    SET
      items_json = EXCLUDED.items_json,
      updated_at = CURRENT_TIMESTAMP
  `;
}

async function logSuggestionEvent(params: {
  childId: string;
  domainId: CosmosDomainId;
  action: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await avatarDB.exec`
    INSERT INTO topic_suggestion_events (
      id,
      child_id,
      domain_id,
      action,
      payload_json,
      created_at
    )
    VALUES (
      ${`evt_${crypto.randomUUID()}`},
      ${params.childId},
      ${params.domainId},
      ${params.action},
      ${JSON.stringify(params.payload || {})}::jsonb,
      CURRENT_TIMESTAMP
    )
  `;
}

async function callSuggestionLlm(params: {
  userPrompt: string;
  maxCompletionTokens: number;
  timeoutMs?: number;
}): Promise<Record<string, unknown>> {
  const controller =
    typeof AbortController !== "undefined" && params.timeoutMs
      ? new AbortController()
      : null;
  const timeout =
    controller && params.timeoutMs
      ? setTimeout(() => controller.abort(), params.timeoutMs)
      : null;

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAIKey()}`,
      },
      signal: controller?.signal,
      body: JSON.stringify({
        model: SUGGESTION_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: params.userPrompt },
        ],
        response_format: { type: "json_object" },
        reasoning_effort: "low",
        max_completion_tokens: params.maxCompletionTokens,
        seed: 13,
      }),
    });
  } catch (error) {
    if (
      params.timeoutMs &&
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new Error(
        `OpenAI suggestion request timed out after ${params.timeoutMs}ms`
      );
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${err}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = String(data.choices?.[0]?.message?.content || "").trim();
  if (!content) {
    throw new Error("OpenAI returned empty suggestion payload");
  }
  return JSON.parse(content) as Record<string, unknown>;
}

function buildInitialPrompt(params: {
  ageBand: SuggestionAgeBand;
  domainId: CosmosDomainId;
  alreadyTopics: string[];
  recentDokus: string[];
  excludeTitles: string[];
  strict: boolean;
}): string {
  return [
    `Generate ${INITIAL_SUGGESTION_COUNT} topic suggestions for:`,
    "- language: de",
    `- ageBand: ${params.ageBand}`,
    `- domainId: ${params.domainId}`,
    "",
    `Already known topics (avoid): ${listToPromptText(params.alreadyTopics, 60)}`,
    `Recent dokus (avoid repeating): ${listToPromptText(params.recentDokus, 10)}`,
    `ExcludeTitles (strictly avoid): ${listToPromptText(params.excludeTitles, 100)}`,
    "",
    "Return JSON:",
    "{",
    '  "items": [',
    "    {",
    '      "topicTitle": "...",',
    '      "topicSlug": "...",',
    '      "kind": "broaden|deepen|retention",',
    '      "difficulty": 1,',
    '      "teaserKid": "...",',
    '      "reasonParent": "...",',
    '      "skillFocus": "remember|understand|compare|apply|transfer"',
    "    }",
    "  ]",
    "}",
    "",
    "Constraints:",
    `- ${INITIAL_SUGGESTION_COUNT} items, all different.`,
    "- At least 10 broaden, max 3 retention.",
    "- No topicTitle similar to excluded.",
    params.strict
      ? "- STRICT: If uncertain, prefer returning fewer but valid unique items."
      : "- Keep outputs concise and deterministic.",
  ].join("\n");
}

function buildRefreshPrompt(params: {
  ageBand: SuggestionAgeBand;
  domainId: CosmosDomainId;
  alreadyTopics: string[];
  recentDokus: string[];
  excludeTitles: string[];
  strict: boolean;
}): string {
  return [
    "Generate 1 NEW topic suggestion for:",
    "- language: de",
    `- ageBand: ${params.ageBand}`,
    `- domainId: ${params.domainId}`,
    "",
    `ExcludeTitles (strictly avoid): ${listToPromptText(params.excludeTitles, 120)}`,
    `Already known topics (avoid): ${listToPromptText(params.alreadyTopics, 60)}`,
    `Recent dokus: ${listToPromptText(params.recentDokus, 10)}`,
    "",
    "Return JSON:",
    "{",
    '  "item": {',
    '    "topicTitle": "...",',
    '    "topicSlug": "...",',
    '    "kind": "broaden|deepen",',
    '    "difficulty": 1,',
    '    "teaserKid": "...",',
    '    "reasonParent": "...",',
    '    "skillFocus": "remember|understand|compare|apply|transfer"',
    "  }",
    "}",
    "",
    "Constraints:",
    "- Exactly one item.",
    "- Must be new compared to excluded titles.",
    "- Keep title concrete and <= 60 chars.",
    params.strict
      ? "- STRICT: no duplicates, no retention kind."
      : "- Prefer broaden/deepen.",
  ].join("\n");
}

async function generateInitialSuggestions(params: {
  domainId: CosmosDomainId;
  ageBand: SuggestionAgeBand;
  alreadyTopics: string[];
  recentDokus: string[];
  excludeTitles: string[];
}): Promise<TopicSuggestionsResponse> {
  const excludeKeys = new Set<string>();
  for (const title of params.excludeTitles) {
    const key = topicDedupKey(title, toAsciiSlug(title));
    if (key) excludeKeys.add(key);
  }

  const prompts = [
    buildInitialPrompt({ ...params, strict: false }),
    buildInitialPrompt({ ...params, strict: true }),
  ];

  const collected: TopicSuggestionItem[] = [];
  for (const [index, userPrompt] of prompts.entries()) {
    try {
      const raw = await callSuggestionLlm({
        userPrompt,
        maxCompletionTokens: 1400,
      });
      const rawItems = Array.isArray(raw.items) ? raw.items : [];
      for (const rawItem of rawItems) {
        const candidate = normalizeSuggestionItem({
          raw: rawItem,
          domainId: params.domainId,
          allowRetention: true,
        });
        if (!candidate) continue;
        const key = topicDedupKey(candidate.topicTitle, candidate.topicSlug);
        if (excludeKeys.has(key)) continue;
        excludeKeys.add(key);
        collected.push(candidate);
      }
      if (collected.length >= INITIAL_SUGGESTION_COUNT) break;
    } catch (error) {
      if (index === prompts.length - 1) {
        console.warn("[suggestions] initial generation failed, using fallback", error);
      }
    }
  }

  let finalized = withFallbackItems({
    domainId: params.domainId,
    items: collected.slice(0, INITIAL_SUGGESTION_COUNT),
    excludeKeys,
    targetCount: INITIAL_SUGGESTION_COUNT,
    allowRetention: true,
  }).slice(0, INITIAL_SUGGESTION_COUNT);

  finalized = enforceMixRules(finalized);

  return {
    domainId: params.domainId,
    generatedAt: new Date().toISOString(),
    items: finalized,
  };
}

async function generateOneSuggestion(params: {
  domainId: CosmosDomainId;
  ageBand: SuggestionAgeBand;
  alreadyTopics: string[];
  recentDokus: string[];
  excludeTitles: string[];
}): Promise<TopicSuggestionItem> {
  const excludeKeys = new Set<string>();
  for (const title of params.excludeTitles) {
    const key = topicDedupKey(title, toAsciiSlug(title));
    if (key) excludeKeys.add(key);
  }

  const attempts = [
    buildRefreshPrompt({ ...params, strict: false }),
    buildRefreshPrompt({ ...params, strict: true }),
  ];

  for (const userPrompt of attempts) {
    try {
      const raw = await callSuggestionLlm({
        userPrompt,
        maxCompletionTokens: 260,
        timeoutMs: 2200,
      });
      const candidate = normalizeSuggestionItem({
        raw: raw.item,
        domainId: params.domainId,
        allowRetention: false,
      });
      if (!candidate) continue;
      const key = topicDedupKey(candidate.topicTitle, candidate.topicSlug);
      if (excludeKeys.has(key)) continue;
      return candidate;
    } catch (error) {
      console.warn("[suggestions] refresh-one attempt failed", error);
    }
  }

  const fallbackItems = withFallbackItems({
    domainId: params.domainId,
    items: [],
    excludeKeys,
    targetCount: 1,
    allowRetention: false,
  });
  if (fallbackItems.length > 0) {
    return fallbackItems[0];
  }

  throw APIError.internal("Could not generate a unique suggestion");
}

function mergeExcludeTitles(parts: string[][]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const source of parts) {
    for (const value of source) {
      const clean = trimText(value, 120);
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(clean);
    }
  }
  return out;
}

function appendUniqueItem(items: TopicSuggestionItem[], next: TopicSuggestionItem): TopicSuggestionItem[] {
  const seen = new Set<string>();
  const out: TopicSuggestionItem[] = [];
  for (const item of items) {
    const key = topicDedupKey(item.topicTitle, item.topicSlug);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  const nextKey = topicDedupKey(next.topicTitle, next.topicSlug);
  if (!seen.has(nextKey)) {
    out.push(next);
  }
  if (out.length > MAX_SUGGESTIONS_IN_CACHE) {
    return out.slice(out.length - MAX_SUGGESTIONS_IN_CACHE);
  }
  return out;
}

async function resolveSuggestionContext(params: {
  userId: string;
  childId?: string;
  profileId?: string;
  avatarId?: string;
  domainId: string;
}): Promise<{ childId: string; domainId: CosmosDomainId; ageBand: SuggestionAgeBand }> {
  const childId = await resolveChildIdForCosmos({
    userId: params.userId,
    childId: params.childId,
    profileId: params.profileId,
    avatarId: params.avatarId,
  });
  const domainId = normalizeDomainId(params.domainId);
  const ageBand = await getChildAgeBand(childId);
  return { childId, domainId, ageBand };
}

export const getTopicSuggestions = api<SuggestionsQueryRequest, TopicSuggestionsResponse>(
  { expose: true, method: "GET", path: "/api/suggestions", auth: true },
  async (req) => {
    const userId = requireUserId();
    if (!req.domainId) {
      throw APIError.invalidArgument("domainId is required");
    }

    await ensureCosmosMvpSchema();
    await ensureTopicSuggestionSchema();

    const context = await resolveSuggestionContext({
      userId,
      childId: req.childId,
      profileId: req.profileId,
      avatarId: req.avatarId,
      domainId: req.domainId,
    });

    const cached = await readSuggestionCache(context);
    if (cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) {
      if (cached.payload.items.length >= INITIAL_SUGGESTION_COUNT) {
        return cached.payload;
      }

      const [alreadyTopics, recentDokus] = await Promise.all([
        getAlreadyTopics(context.childId, context.domainId),
        getRecentDokus(context.childId, context.domainId),
      ]);
      const excludeTitles = mergeExcludeTitles([
        alreadyTopics,
        recentDokus,
        cached.payload.items.map((item) => item.topicTitle),
        cached.payload.items.map((item) => item.topicSlug),
      ]);

      const generated = await generateInitialSuggestions({
        domainId: context.domainId,
        ageBand: context.ageBand,
        alreadyTopics,
        recentDokus,
        excludeTitles,
      });

      const dedup = new Map<string, TopicSuggestionItem>();
      for (const item of [...cached.payload.items, ...generated.items]) {
        const key = topicDedupKey(item.topicTitle, item.topicSlug);
        if (!dedup.has(key)) {
          dedup.set(key, item);
        }
      }
      const upgradedPayload: TopicSuggestionsResponse = {
        domainId: context.domainId,
        generatedAt: new Date().toISOString(),
        items: Array.from(dedup.values()).slice(0, INITIAL_SUGGESTION_COUNT),
      };

      await writeSuggestionCache({
        ...context,
        payload: upgradedPayload,
      });

      await logSuggestionEvent({
        childId: context.childId,
        domainId: context.domainId,
        action: "upgraded_cached_initial",
        payload: {
          previousCount: cached.payload.items.length,
          newCount: upgradedPayload.items.length,
        },
      });

      return upgradedPayload;
    }

    const [alreadyTopics, recentDokus] = await Promise.all([
      getAlreadyTopics(context.childId, context.domainId),
      getRecentDokus(context.childId, context.domainId),
    ]);
    const excludeTitles = mergeExcludeTitles([alreadyTopics, recentDokus]);

    const payload = await generateInitialSuggestions({
      domainId: context.domainId,
      ageBand: context.ageBand,
      alreadyTopics,
      recentDokus,
      excludeTitles,
    });

    await writeSuggestionCache({
      ...context,
      payload,
    });

    await logSuggestionEvent({
      childId: context.childId,
      domainId: context.domainId,
      action: "generated_initial",
      payload: { count: payload.items.length },
    });

    return payload;
  }
);

export const refreshOneTopicSuggestion = api<RefreshOneRequest, RefreshOneResponse>(
  { expose: true, method: "POST", path: "/api/suggestions/refresh-one", auth: true },
  async (req) => {
    const userId = requireUserId();
    if (!req.domainId) {
      throw APIError.invalidArgument("domainId is required");
    }

    await ensureCosmosMvpSchema();
    await ensureTopicSuggestionSchema();

    const context = await resolveSuggestionContext({
      userId,
      childId: req.childId,
      profileId: req.profileId,
      avatarId: req.avatarId,
      domainId: req.domainId,
    });

    const [alreadyTopics, recentDokus] = await Promise.all([
      getAlreadyTopics(context.childId, context.domainId),
      getRecentDokus(context.childId, context.domainId),
    ]);

    let cached = await readSuggestionCache(context);
    if (!cached || cached.payload.items.length === 0) {
      const initialPayload = await generateInitialSuggestions({
        domainId: context.domainId,
        ageBand: context.ageBand,
        alreadyTopics,
        recentDokus,
        excludeTitles: mergeExcludeTitles([alreadyTopics, recentDokus]),
      });
      await writeSuggestionCache({
        ...context,
        payload: initialPayload,
      });
      cached = { payload: initialPayload, updatedAt: Date.now() };
    }

    const excludeTitles = mergeExcludeTitles([
      alreadyTopics,
      recentDokus,
      cached.payload.items.map((item) => item.topicTitle),
      cached.payload.items.map((item) => item.topicSlug),
    ]);

    const item = await generateOneSuggestion({
      domainId: context.domainId,
      ageBand: context.ageBand,
      alreadyTopics,
      recentDokus,
      excludeTitles,
    });

    const nextPayload: TopicSuggestionsResponse = {
      domainId: context.domainId,
      generatedAt: new Date().toISOString(),
      items: appendUniqueItem(cached.payload.items, item),
    };

    await writeSuggestionCache({
      ...context,
      payload: nextPayload,
    });

    await logSuggestionEvent({
      childId: context.childId,
      domainId: context.domainId,
      action: "refresh_one",
      payload: {
        topicTitle: item.topicTitle,
        topicSlug: item.topicSlug,
      },
    });

    return { item };
  }
);

export const selectTopicSuggestion = api<SelectSuggestionRequest, SelectSuggestionResponse>(
  { expose: true, method: "POST", path: "/api/suggestions/select", auth: true },
  async (req) => {
    const userId = requireUserId();
    if (!req.domainId) {
      throw APIError.invalidArgument("domainId is required");
    }
    if (!req.topicTitle || !req.topicSlug) {
      throw APIError.invalidArgument("topicTitle and topicSlug are required");
    }

    await ensureCosmosMvpSchema();
    await ensureTopicSuggestionSchema();

    const context = await resolveSuggestionContext({
      userId,
      childId: req.childId,
      profileId: req.profileId,
      avatarId: req.avatarId,
      domainId: req.domainId,
    });

    await logSuggestionEvent({
      childId: context.childId,
      domainId: context.domainId,
      action: "select",
      payload: {
        topicSlug: trimText(req.topicSlug, 80),
        topicTitle: trimText(req.topicTitle, 80),
      },
    });

    return { ok: true };
  }
);
