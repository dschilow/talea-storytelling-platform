/**
 * Pure input handling for the audio-doku automation: types, request validation,
 * key comparison and script word counting. No Encore imports, so it runs under plain `bun test`.
 */

import { createHash, timingSafeEqual } from "crypto";

export const AUTOMATION_MIN_KEY_LENGTH = 32;

const digest = (value: string): Buffer => createHash("sha256").update(value).digest();

/** Constant-time key check; a missing or too short expected key never matches. */
export function automationKeyMatches(provided: string | undefined, expected: string | undefined): boolean {
  const want = (expected ?? "").trim();
  if (want.length < AUTOMATION_MIN_KEY_LENGTH) return false;
  return timingSafeEqual(digest((provided ?? "").trim()), digest(want));
}

export class AutomationInputError extends Error {}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutomationGuestSpeaker {
  /** BERUF + VORNAME in capitals, e.g. "FÖRSTERIN MARA". TAVI and LUMI are always cast. */
  name: string;
  role?: string;
  gender?: "female" | "male";
  age?: "young" | "adult" | "old";
  /** Optional ElevenLabs voice id (see GET /voices) to cast this guest explicitly. */
  voiceId?: string;
}

export interface AutomationJobItem {
  topic: string;
  /** Default 6. */
  ageFrom?: number;
  /** Default 10. */
  ageTo?: number;
  /** Default 14, max 20. */
  durationMinutes?: number;
  /** 0-2 guests (experts on location) next to TAVI and LUMI. */
  extraSpeakers?: AutomationGuestSpeaker[];
  /** Default false: the episode is created private and published after a listen-through. */
  autoPublish?: boolean;
}

export type NormalizedJobItem = Required<Omit<AutomationJobItem, "extraSpeakers">> & {
  extraSpeakers: AutomationGuestSpeaker[];
};

export interface AutomationJobView {
  id: string;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  stage?: string;
  topic: string;
  title?: string;
  audioDokuId?: string;
  error?: string;
  attempts: number;
  notes: string[];
  params: AutomationJobItem;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  updatedAt: Date;
}

export interface AutomationCatalogEntry {
  id: string;
  title: string;
  description: string;
  category?: string;
  ageGroup?: string;
  isPublic: boolean;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

export const MAX_ITEMS_PER_REQUEST = 10;
const MAX_DURATION_MINUTES = 20;
const SPEAKER_NAME = /^[A-ZÄÖÜ][A-ZÄÖÜß .'-]{1,39}$/;
const RESERVED_SPEAKERS = new Set(["TAVI", "LUMI"]);

const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};

/** Normalises one request item or throws invalidArgument. */
export function normalizeJobItem(raw: AutomationJobItem, index = 0): NormalizedJobItem {
  const where = `items[${index}]`;
  const topic = typeof raw?.topic === "string" ? raw.topic.replace(/\s+/g, " ").trim() : "";
  if (topic.length < 5 || topic.length > 200) {
    throw new AutomationInputError(`${where}.topic must be 5-200 characters.`);
  }

  const ageFrom = clampInt(raw.ageFrom, 2, 18, 6);
  const ageTo = clampInt(raw.ageTo, ageFrom, 18, Math.max(ageFrom, 10));
  const durationMinutes = clampInt(raw.durationMinutes, 1, MAX_DURATION_MINUTES, 14);

  const guestsRaw = Array.isArray(raw.extraSpeakers) ? raw.extraSpeakers : [];
  if (guestsRaw.length > 2) {
    throw new AutomationInputError(`${where}.extraSpeakers: at most 2 guests next to TAVI and LUMI.`);
  }
  const seen = new Set<string>();
  const extraSpeakers = guestsRaw.map((guest, g) => {
    const name = typeof guest?.name === "string" ? guest.name.replace(/\s+/g, " ").trim().toUpperCase() : "";
    // A colon or newline in a name would corrupt the "NAME: text" script format.
    if (!SPEAKER_NAME.test(name) || RESERVED_SPEAKERS.has(name) || seen.has(name)) {
      throw new AutomationInputError(
        `${where}.extraSpeakers[${g}].name must be a unique capitalised name like "FÖRSTERIN MARA" (not TAVI/LUMI, no colon).`,
      );
    }
    seen.add(name);
    const role = typeof guest.role === "string" ? guest.role.replace(/\s+/g, " ").trim().slice(0, 120) : "";
    const gender = guest.gender === "female" || guest.gender === "male" ? guest.gender : undefined;
    const age = guest.age === "young" || guest.age === "adult" || guest.age === "old" ? guest.age : undefined;
    const voiceId = typeof guest.voiceId === "string" ? guest.voiceId.trim() : "";
    if (voiceId && !/^[A-Za-z0-9]{10,40}$/.test(voiceId)) {
      throw new AutomationInputError(`${where}.extraSpeakers[${g}].voiceId is not a valid voice id.`);
    }
    return { name, role, gender, age, voiceId: voiceId || undefined } as AutomationGuestSpeaker;
  });

  return { topic, ageFrom, ageTo, durationMinutes, extraSpeakers, autoPublish: raw.autoPublish === true };
}

/** Spoken words of a "NAME: [tag] text" script, without speaker labels and audio tags. */
export function countSpokenWords(script: string): number {
  return script
    .split("\n")
    .map((line) => line.replace(/^[^:\n]{1,80}:\s*/, "").replace(/\[[^\]]*\]/g, " "))
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
}

