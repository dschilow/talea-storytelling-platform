import crypto from "crypto";
import { APIError } from "encore.dev/api";
import { userDB } from "../user/db";

const PIN_PATTERN = /^\d{4,8}$/;
const MAX_LIST_ITEMS = 32;
const MAX_KEYWORD_LENGTH = 64;
const MAX_DAILY_LIMIT = 30;
const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_BYTES = 32;

export const PARENTAL_BLOCKED_THEME_PRESETS = [
  { id: "violence", label: "Gewalt", keywords: ["gewalt", "kampf", "waffe", "blut"] },
  { id: "horror", label: "Horror", keywords: ["horror", "monster", "grusel", "dunkle magie"] },
  { id: "bullying", label: "Mobbing", keywords: ["mobbing", "beleidigung", "ausgrenzung"] },
  { id: "politics", label: "Politik", keywords: ["politik", "krieg", "partei"] },
  { id: "religion", label: "Religion", keywords: ["religion", "glaube", "kirche"] },
  { id: "adult", label: "Erwachsenen-Themen", keywords: ["alkohol", "drogen", "casino"] },
] as const;

export const PARENTAL_BLOCKED_WORD_PRESETS = [
  { id: "insults", label: "Schimpfwoerter", keywords: ["idiot", "dumm", "haesslich"] },
  { id: "fear", label: "Angstworte", keywords: ["tod", "sterben", "tot", "albtraum"] },
  { id: "aggressive", label: "Aggressive Sprache", keywords: ["hass", "zerstoeren", "verletzen"] },
] as const;

export const PARENTAL_GOAL_PRESETS = [
  { id: "reading", label: "Lesefreude", keywords: ["lesen", "wortschatz", "verstehen"] },
  { id: "science", label: "MINT", keywords: ["naturwissenschaft", "technik", "experiment"] },
  { id: "social", label: "Soziale Staerke", keywords: ["empathie", "teamwork", "respekt"] },
  { id: "focus", label: "Konzentration", keywords: ["aufmerksamkeit", "struktur", "ausdauer"] },
  { id: "languages", label: "Sprachen", keywords: ["englisch", "mehrsprachig", "kommunikation"] },
] as const;

type ParentalControlsRow = {
  user_id: string;
  pin_hash: string | null;
  pin_salt: string | null;
  enabled: boolean;
  onboarding_completed: boolean;
  blocked_themes: string[] | null;
  blocked_words: string[] | null;
  learning_goals: string[] | null;
  profile_keywords: string[] | null;
  daily_story_limit: number | null;
  daily_doku_limit: number | null;
  created_at: Date | null;
  updated_at: Date | null;
};

export type ParentalControls = {
  enabled: boolean;
  onboardingCompleted: boolean;
  hasPin: boolean;
  blockedThemes: string[];
  blockedWords: string[];
  learningGoals: string[];
  profileKeywords: string[];
  dailyLimits: {
    stories: number | null;
    dokus: number | null;
  };
  blockedTerms: string[];
  generationGuidance: string;
};

export type SaveParentalControlsPayload = {
  currentPin?: string;
  newPin?: string;
  enabled?: boolean;
  onboardingCompleted?: boolean;
  blockedThemes?: string[];
  blockedWords?: string[];
  learningGoals?: string[];
  profileKeywords?: string[];
  dailyStoryLimit?: number | null;
  dailyDokuLimit?: number | null;
};

function normalizeKeyword(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s\-_]/gu, " ")
    .replace(/\s+/g, " ")
    .slice(0, MAX_KEYWORD_LENGTH);
}

function normalizeKeywordList(values: unknown, maxItems = MAX_LIST_ITEMS): string[] {
  if (!Array.isArray(values)) return [];
  const dedup = new Set<string>();
  for (const item of values) {
    if (typeof item !== "string") continue;
    const normalized = normalizeKeyword(item);
    if (!normalized) continue;
    dedup.add(normalized);
    if (dedup.size >= maxItems) break;
  }
  return Array.from(dedup);
}

function normalizeDailyLimit(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.floor(parsed);
  return Math.max(0, Math.min(MAX_DAILY_LIMIT, rounded));
}

function validatePin(pin: string) {
  if (!PIN_PATTERN.test(pin)) {
    throw APIError.invalidArgument("PIN muss 4 bis 8 Ziffern enthalten.");
  }
}

function hashPin(pin: string, salt?: string) {
  const pinSalt = salt ?? crypto.randomBytes(16).toString("hex");
  const pinHash = crypto
    .pbkdf2Sync(pin, pinSalt, PBKDF2_ITERATIONS, PBKDF2_BYTES, "sha256")
    .toString("hex");
  return { pinHash, pinSalt };
}

function verifyHashedPin(pin: string, hash: string, salt: string): boolean {
  const hashed = hashPin(pin, salt).pinHash;
  const hashBuffer = Buffer.from(hash, "hex");
  const candidateBuffer = Buffer.from(hashed, "hex");
  if (hashBuffer.length !== candidateBuffer.length) return false;
  return crypto.timingSafeEqual(hashBuffer, candidateBuffer);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const BLOCKED_TERM_SAFE_REPLACEMENTS: Record<string, string> = {
  gewalt: "Konflikt",
  kampf: "Wettstreit",
  waffe: "Werkzeug",
  blut: "Farbfleck",
  horror: "Aufregung",
  grusel: "Nervenkitzel",
  "dunkle magie": "Geheimtrick",
  mobbing: "Ausschluss",
  beleidigung: "Gemeinheit",
  ausgrenzung: "Ausschluss",
  religion: "Tradition",
  glaube: "Idee",
  kirche: "Gebaeude",
  politik: "Regeln",
  krieg: "Streit",
  partei: "Gruppe",
  alkohol: "Getraenk",
  drogen: "Substanz",
  casino: "Spielhaus",
  monster: "Wesen",
  idiot: "Raufbold",
  dumm: "unfair",
  haesslich: "gemein",
  tod: "Abschied",
  sterben: "verschwinden",
  tot: "still",
  albtraum: "schlimmer Traum",
  hass: "Wut",
  zerstoeren: "kaputtmachen",
  verletzen: "wehtun",
};

function applyCaseTemplate(source: string, replacement: string): string {
  if (!source) return replacement;
  if (source === source.toUpperCase()) return replacement.toUpperCase();
  const first = source.charAt(0);
  if (first && first === first.toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function normalizeSpacingAfterFiltering(text: string): string {
  return text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .replace(/([(\[{])[ \t]+/g, "$1")
    .replace(/[ \t]+([)\]}])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function resolveSafeReplacement(term: string): string {
  const normalized = normalizeKeyword(term);
  if (!normalized) return "Thema";
  return BLOCKED_TERM_SAFE_REPLACEMENTS[normalized] || "Thema";
}

function buildControlsFromRow(row: ParentalControlsRow): ParentalControls {
  const blockedThemes = normalizeKeywordList(row.blocked_themes);
  const blockedWords = normalizeKeywordList(row.blocked_words);
  const learningGoals = normalizeKeywordList(row.learning_goals);
  const profileKeywords = normalizeKeywordList(row.profile_keywords);
  const blockedTerms = Array.from(new Set([...blockedThemes, ...blockedWords]));

  const controls: ParentalControls = {
    enabled: Boolean(row.enabled),
    onboardingCompleted: Boolean(row.onboarding_completed),
    hasPin: Boolean(row.pin_hash && row.pin_salt),
    blockedThemes,
    blockedWords,
    learningGoals,
    profileKeywords,
    dailyLimits: {
      stories: row.daily_story_limit ?? null,
      dokus: row.daily_doku_limit ?? null,
    },
    blockedTerms,
    generationGuidance: "",
  };

  controls.generationGuidance = buildGenerationGuidanceFromControls(controls);
  return controls;
}

export function buildGenerationGuidanceFromControls(controls: ParentalControls): string {
  if (!controls.enabled) return "";

  const lines: string[] = [
    "PARENTAL SAFETY INSTRUCTIONS (HARD RULES):",
    "- Keep language child-safe, calm, and constructive.",
    "- Do not include the blocked topics or blocked words listed below.",
  ];

  if (controls.blockedTerms.length > 0) {
    lines.push(`- Blocked terms: ${controls.blockedTerms.join(", ")}.`);
  }

  if (controls.learningGoals.length > 0) {
    lines.push(`- Prioritize these learning goals: ${controls.learningGoals.join(", ")}.`);
  }

  if (controls.profileKeywords.length > 0) {
    lines.push(`- Prefer this profile path/tone: ${controls.profileKeywords.join(", ")}.`);
  }

  lines.push("- If a topic is sensitive, replace it with a safe, age-appropriate alternative.");
  return lines.join("\n");
}

export function sanitizeTextWithBlockedTerms(
  text: string,
  blockedTerms: string[]
): { text: string; replacements: number } {
  if (!text || blockedTerms.length === 0) return { text, replacements: 0 };

  let next = text;
  let replacements = 0;

  for (const term of blockedTerms) {
    const normalized = normalizeKeyword(term);
    const escaped = escapeRegExp(normalized);
    if (!escaped) continue;
    const replacement = resolveSafeReplacement(normalized);
    const isSingleToken = /^[\p{L}\p{N}_-]+$/u.test(normalized);
    const pattern = isSingleToken
      ? new RegExp(`\\b${escaped}\\b`, "giu")
      : new RegExp(escaped, "giu");

    next = next.replace(pattern, (match) => {
      replacements += 1;
      return applyCaseTemplate(match, replacement);
    });
  }

  return {
    text: normalizeSpacingAfterFiltering(next),
    replacements,
  };
}

async function ensureParentalControlsTable() {
  await userDB.exec`
    CREATE TABLE IF NOT EXISTS parental_controls (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      pin_hash TEXT,
      pin_salt TEXT,
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
      blocked_themes TEXT[] NOT NULL DEFAULT '{}',
      blocked_words TEXT[] NOT NULL DEFAULT '{}',
      learning_goals TEXT[] NOT NULL DEFAULT '{}',
      profile_keywords TEXT[] NOT NULL DEFAULT '{}',
      daily_story_limit INTEGER,
      daily_doku_limit INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await userDB.exec`
    CREATE INDEX IF NOT EXISTS idx_parental_controls_enabled
    ON parental_controls (enabled)
  `;
}

async function ensureParentalControlsRow(userId: string) {
  const now = new Date();
  await userDB.exec`
    INSERT INTO parental_controls (
      user_id,
      enabled,
      onboarding_completed,
      blocked_themes,
      blocked_words,
      learning_goals,
      profile_keywords,
      daily_story_limit,
      daily_doku_limit,
      created_at,
      updated_at
    )
    VALUES (
      ${userId},
      FALSE,
      FALSE,
      ARRAY[]::TEXT[],
      ARRAY[]::TEXT[],
      ARRAY[]::TEXT[],
      ARRAY[]::TEXT[],
      NULL,
      NULL,
      ${now},
      ${now}
    )
    ON CONFLICT (user_id) DO NOTHING
  `;
}

async function readParentalControlsRow(userId: string): Promise<ParentalControlsRow> {
  await ensureParentalControlsTable();
  await ensureParentalControlsRow(userId);

  const row = await userDB.queryRow<ParentalControlsRow>`
    SELECT
      user_id,
      pin_hash,
      pin_salt,
      enabled,
      onboarding_completed,
      blocked_themes,
      blocked_words,
      learning_goals,
      profile_keywords,
      daily_story_limit,
      daily_doku_limit,
      created_at,
      updated_at
    FROM parental_controls
    WHERE user_id = ${userId}
  `;

  if (!row) {
    throw APIError.notFound("Parental controls not found");
  }

  return row;
}

export async function getParentalControlsForUser(userId: string): Promise<ParentalControls> {
  const row = await readParentalControlsRow(userId);
  return buildControlsFromRow(row);
}

export async function verifyParentalPinForUser(params: {
  userId: string;
  pin: string;
}): Promise<{ ok: boolean; hasPin: boolean }> {
  const row = await readParentalControlsRow(params.userId);
  const hasPin = Boolean(row.pin_hash && row.pin_salt);
  if (!hasPin) return { ok: false, hasPin: false };
  if (!PIN_PATTERN.test(params.pin)) return { ok: false, hasPin: true };

  const ok = verifyHashedPin(params.pin, row.pin_hash!, row.pin_salt!);
  return { ok, hasPin: true };
}

export async function saveParentalControlsForUser(
  userId: string,
  payload: SaveParentalControlsPayload
): Promise<ParentalControls> {
  const row = await readParentalControlsRow(userId);
  const hasPin = Boolean(row.pin_hash && row.pin_salt);
  const wantsToWrite =
    payload.enabled !== undefined ||
    payload.onboardingCompleted !== undefined ||
    payload.blockedThemes !== undefined ||
    payload.blockedWords !== undefined ||
    payload.learningGoals !== undefined ||
    payload.profileKeywords !== undefined ||
    payload.dailyStoryLimit !== undefined ||
    payload.dailyDokuLimit !== undefined;

  if (hasPin) {
    if (!payload.currentPin) {
      throw APIError.permissionDenied("PIN erforderlich, um Eltern-Einstellungen zu aendern.");
    }
    if (!verifyHashedPin(payload.currentPin, row.pin_hash!, row.pin_salt!)) {
      throw APIError.permissionDenied("PIN ist ungueltig.");
    }
  } else if (wantsToWrite && !payload.newPin) {
    throw APIError.invalidArgument("Bitte zuerst einen Eltern-PIN festlegen.");
  }

  let nextPinHash = row.pin_hash;
  let nextPinSalt = row.pin_salt;

  if (payload.newPin) {
    validatePin(payload.newPin);
    const hashed = hashPin(payload.newPin);
    nextPinHash = hashed.pinHash;
    nextPinSalt = hashed.pinSalt;
  }

  const blockedThemes =
    payload.blockedThemes !== undefined
      ? normalizeKeywordList(payload.blockedThemes)
      : normalizeKeywordList(row.blocked_themes);
  const blockedWords =
    payload.blockedWords !== undefined
      ? normalizeKeywordList(payload.blockedWords)
      : normalizeKeywordList(row.blocked_words);
  const learningGoals =
    payload.learningGoals !== undefined
      ? normalizeKeywordList(payload.learningGoals)
      : normalizeKeywordList(row.learning_goals);
  const profileKeywords =
    payload.profileKeywords !== undefined
      ? normalizeKeywordList(payload.profileKeywords)
      : normalizeKeywordList(row.profile_keywords);

  const dailyStoryLimit =
    payload.dailyStoryLimit !== undefined
      ? normalizeDailyLimit(payload.dailyStoryLimit)
      : row.daily_story_limit;
  const dailyDokuLimit =
    payload.dailyDokuLimit !== undefined
      ? normalizeDailyLimit(payload.dailyDokuLimit)
      : row.daily_doku_limit;

  const nextEnabled = payload.enabled ?? row.enabled;
  const nextOnboarding =
    payload.onboardingCompleted ??
    row.onboarding_completed ??
    false;

  const now = new Date();
  await userDB.exec`
    UPDATE parental_controls
    SET
      pin_hash = ${nextPinHash},
      pin_salt = ${nextPinSalt},
      enabled = ${nextEnabled},
      onboarding_completed = ${nextOnboarding},
      blocked_themes = ${blockedThemes},
      blocked_words = ${blockedWords},
      learning_goals = ${learningGoals},
      profile_keywords = ${profileKeywords},
      daily_story_limit = ${dailyStoryLimit},
      daily_doku_limit = ${dailyDokuLimit},
      updated_at = ${now}
    WHERE user_id = ${userId}
  `;

  return getParentalControlsForUser(userId);
}

export function assertParentalDailyLimit(params: {
  controls: ParentalControls;
  kind: "story" | "doku";
  usedToday: number;
}) {
  if (!params.controls.enabled) return;

  const limit =
    params.kind === "story"
      ? params.controls.dailyLimits.stories
      : params.controls.dailyLimits.dokus;

  if (limit === null || limit === undefined) return;
  if (params.usedToday < limit) return;

  const label = params.kind === "story" ? "Story" : "Doku";
  throw APIError.permissionDenied(
    `Taegliches Eltern-Limit erreicht: ${limit} ${label}-Generierungen pro Tag.`
  );
}
