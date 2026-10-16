/**
 * The character bible of the pool — the pure part (2026-10-16, "Die Türlaunische").
 *
 * A pool figure had a catchphrase, a quirk and a speech style — seasoning for a
 * scene. What lets a figure carry a book the way the great sidekicks and
 * troublemakers of read-aloud literature do is a want, a fear, a secret, a comic
 * pattern that escalates, a gesture a child can imitate, and the permission to
 * drive the plot or to oppose the heroes. Migration 44 adds those columns and
 * seeds the 18 original figures by hand; this module reads the bible off a row,
 * builds the one prompt that fills a missing one, and checks the answer. No
 * Encore import here, so the tests can load it (the endpoint lives in character-bible.ts).
 */

import { CHILD_SAFETY_RULES_EN } from "../helpers/child-safety";
import { parseJsonObject, STORYBOOK_SUPPORT_MODEL, type StorybookLlm } from "./storybook/llm";
import type { CharacterTemplate } from "./types";

export const COMIC_ROLES = ["know-it-all", "boaster", "coward", "grump", "chaos", "literalist", "schemer", "dreamer", "fusspot"] as const;
export type ComicRole = (typeof COMIC_ROLES)[number];
const VILLAIN_STYLES = ["comic", "misunderstood", "real"] as const;
type VillainStyle = (typeof VILLAIN_STYLES)[number];

export interface CharacterBible {
  want: string;
  fear: string;
  secret: string;
  runningGag: string;
  gesture: string;
  comicRole: string;
  canLead: boolean;
  canOppose: boolean;
  villainStyle?: VillainStyle;
  introLine: string;
  signatureVisual: string;
}

function text(value: unknown, max: number): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function flag(value: unknown): boolean {
  if (value === true || value === false) return value;
  return /^(true|t|1|yes|ja)$/i.test(String(value ?? ""));
}

function villainStyle(value: unknown): VillainStyle | undefined {
  const style = text(value, 20).toLowerCase();
  return (VILLAIN_STYLES as readonly string[]).includes(style) ? (style as VillainStyle) : undefined;
}

/** The bible fields of a database row (snake_case or camelCase) as the API's CharacterTemplate carries them. Missing columns stay undefined. */
export function bibleFromRow(row: Record<string, any>): Partial<CharacterBible> & Pick<CharacterTemplate, "bibleVersion"> {
  const pick = (snake: string, camel: string, max: number) => text(row[snake] ?? row[camel], max);
  const out: Partial<CharacterBible> & Pick<CharacterTemplate, "bibleVersion"> = {};
  if (pick("want", "want", 200)) out.want = pick("want", "want", 200);
  if (pick("fear", "fear", 200)) out.fear = pick("fear", "fear", 200);
  if (pick("secret", "secret", 240)) out.secret = pick("secret", "secret", 240);
  if (pick("running_gag", "runningGag", 300)) out.runningGag = pick("running_gag", "runningGag", 300);
  if (pick("gesture", "gesture", 160)) out.gesture = pick("gesture", "gesture", 160);
  if (pick("comic_role", "comicRole", 40)) out.comicRole = pick("comic_role", "comicRole", 40);
  if ((row.can_lead ?? row.canLead) !== undefined && (row.can_lead ?? row.canLead) !== null) out.canLead = flag(row.can_lead ?? row.canLead);
  if ((row.can_oppose ?? row.canOppose) !== undefined && (row.can_oppose ?? row.canOppose) !== null) out.canOppose = flag(row.can_oppose ?? row.canOppose);
  const style = villainStyle(row.villain_style ?? row.villainStyle);
  if (style) out.villainStyle = style;
  if (pick("intro_line", "introLine", 200)) out.introLine = pick("intro_line", "introLine", 200);
  if (pick("signature_visual", "signatureVisual", 120)) out.signatureVisual = pick("signature_visual", "signatureVisual", 120);
  if ((row.bible_version ?? row.bibleVersion) !== undefined && (row.bible_version ?? row.bibleVersion) !== null) out.bibleVersion = Number(row.bible_version ?? row.bibleVersion) || 0;
  return out;
}

/** A model answer as a bible: every text field present and short, the enums valid, the flags booleans. Null when it is not a bible. */
export function parseBible(raw: unknown): CharacterBible | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const want = text(value.want, 200);
  const fear = text(value.fear, 200);
  const runningGag = text(value.runningGag, 300);
  const gesture = text(value.gesture, 160);
  const introLine = text(value.introLine, 200);
  const signatureVisual = text(value.signatureVisual, 120);
  if (!want || !fear || !runningGag || !gesture || !introLine || !signatureVisual) return null;
  const role = text(value.comicRole, 40).toLowerCase();
  const canOppose = flag(value.canOppose);
  return {
    want,
    fear,
    secret: /^(null|none|keine?|—|-)$/i.test(text(value.secret, 240)) ? "" : text(value.secret, 240),
    runningGag,
    gesture,
    comicRole: (COMIC_ROLES as readonly string[]).includes(role) ? role : "dreamer",
    canLead: flag(value.canLead),
    canOppose,
    villainStyle: canOppose ? villainStyle(value.villainStyle) || "comic" : undefined,
    introLine,
    signatureVisual,
  };
}

function json(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, any>;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** The one call that writes a figure's bible from its existing data. English instructions, German texts (the pool is German), English visual tag. */
export function buildBiblePrompt(row: Record<string, any>): { system: string; user: string } {
  const emotional = json(row.emotional_nature ?? row.emotionalNature);
  const visual = json(row.visual_profile ?? row.visualProfile);
  const list = (value: unknown) => (Array.isArray(value) ? value.map((entry) => text(entry, 60)).filter(Boolean) : []);
  const lines = [
    `FIGURE: ${text(row.name, 80)}`,
    `- role in stories: ${text(row.role, 40) || "—"} | archetype: ${text(row.archetype, 60) || "—"} | species: ${text(row.species_category ?? row.speciesCategory, 40) || text(visual.species, 40) || "—"} | age: ${text(row.age_category ?? row.ageCategory, 20) || "—"}`,
    `- nature: ${[text(row.dominant_personality ?? row.dominantPersonality, 40), ...list(row.secondary_traits ?? row.secondaryTraits), text(emotional.dominant, 40), ...list(emotional.secondary)].filter(Boolean).slice(0, 6).join(", ") || "—"}`,
    `- speaks: ${list(row.speech_style ?? row.speechStyle).join(", ") || "—"}`,
    `- catchphrase: ${text(row.catchphrase, 120) || "—"}${text(row.catchphrase_context ?? row.catchphraseContext, 160) ? ` (${text(row.catchphrase_context ?? row.catchphraseContext, 160)})` : ""}`,
    `- quirk: ${text(row.quirk, 160) || "—"}`,
    `- reacts strongly to: ${list(row.emotional_triggers ?? row.emotionalTriggers).join(", ") || "—"}`,
    `- backstory: ${text(row.backstory, 400) || "—"}`,
    `- looks: ${text(row.physical_description ?? row.physicalDescription, 300) || text(visual.description, 300) || "—"}`,
    "",
    "WRITE THE BIBLE (texts in German, child-safe, concrete, no abstractions; nothing that contradicts the data above):",
    "- want: what this figure ALWAYS wants, in a child's words — the thing that drives its moves in any story (at most 20 words).",
    "- fear: what it fears or its one sore spot (at most 18 words).",
    "- secret: what it hides at first — something a listening child may learn before the heroes (at most 25 words; an empty string only if nothing fits).",
    "- runningGag: ONE comic pattern that can repeat three times in a book and escalate (appears, escalates, tips over the third time) — built from its quirk or nature, told as a pattern, not a scene (at most 45 words).",
    "- gesture: one gesture or habit a child can imitate, different from the quirk if the quirk is not a gesture (at most 15 words).",
    `- comicRole: one of ${COMIC_ROLES.join(", ")}.`,
    "- canLead: true if this figure could carry a whole book as its engine (a mission of its own, a will, a voice) — false for a pure helper or a background grown-up.",
    "- canOppose: true if this figure could be the opposing figure with a plan of its own (a trickster, a grump, a schemer, a guardian) — never cruel. villainStyle (only if canOppose): comic (outwitted, may simply lose), misunderstood (its need is answered) or real (a real opponent for older children).",
    "- introLine: how it introduces itself in its own words, one or two short sentences in its voice (at most 25 words).",
    "- signatureVisual: in ENGLISH, 4-8 words: the one visual tag that tells it apart at a glance in a picture.",
    "",
    JSON.stringify({ want: "…", fear: "…", secret: "…", runningGag: "…", gesture: "…", comicRole: "dreamer", canLead: false, canOppose: false, villainStyle: null, introLine: "…", signatureVisual: "…" }),
  ];
  return {
    system: [
      "You are the character editor of a German children's book publisher. You write the bible of a recurring figure: what makes it recognisable from book to book and able to drive a story — like the great sidekicks and troublemakers of read-aloud literature, without naming or copying any of them.",
      "Character data may spell umlauts as ae/oe/ue; you write proper umlauts.",
      CHILD_SAFETY_RULES_EN,
      "Answer with one valid JSON object only.",
    ].join("\n"),
    user: lines.join("\n"),
  };
}

export interface EnrichBiblesResult {
  enriched: string[];
  skipped: string[];
  failed: Array<{ id: string; reason: string }>;
  costUSD: number;
}

/** Writes bibles for the given rows with the given port, one support-model call each; `write` stores the result. */
export async function enrichBibleRows(rows: Array<Record<string, any>>, llm: StorybookLlm, write: (id: string, bible: CharacterBible) => Promise<void>): Promise<EnrichBiblesResult> {
  const result: EnrichBiblesResult = { enriched: [], skipped: [], failed: [], costUSD: 0 };
  for (const row of rows) {
    const id = String(row.id || "");
    if (!id) continue;
    const prompt = buildBiblePrompt(row);
    try {
      const call = await llm({ stage: "character-bible", role: "support", model: STORYBOOK_SUPPORT_MODEL, system: prompt.system, user: prompt.user, json: true, maxTokens: 1500, effort: "low", timeoutMs: 90_000, temperature: 0.6 });
      result.costUSD += Number(call.usage?.costUSD || 0);
      const bible = parseBible(parseJsonObject<unknown>(call.text));
      if (!bible) {
        result.failed.push({ id, reason: "answer was not a bible" });
        continue;
      }
      await write(id, bible);
      result.enriched.push(id);
    } catch (err) {
      result.failed.push({ id, reason: String((err as Error)?.message || err).slice(0, 200) });
    }
  }
  result.costUSD = Number(result.costUSD.toFixed(6));
  return result;
}
