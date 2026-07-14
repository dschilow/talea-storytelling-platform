import type { SceneCastCharacterContract } from "./dev-mode-image-guards";

const GERMAN_FUNCTION_WORD = /\b(?:der|die|das|den|dem|des|ein|eine|einen|einem|einer|und|oder|nicht|ist|war|sind|sich|nach|sie|ihn|ihm|ihr|aber|bei|mit|von|vom|zum|zur|auf|aus|durch|gegen|ohne|um|zu|im|am|jeder|jedem|jeden|wenn|dann|noch|nur|auch|sehr|schon|immer|wieder|hier|dort)\b/i;
const GERMAN_MORPHOLOGY = /\b\w{3,}(?:ung|keit|heit|lich|isch|karte|gasse|strasse|wunsch)\b/i;

/**
 * Cheap language guard for image prompts. The old blanket "-chen" suffix
 * rule rejected ordinary English prompts containing "kitchen".
 *
 * `allowedProperNouns` are canonical character names that legitimately carry
 * umlauts or German morphology ("Hexe Kr\u00E4uterweis", "B\u00E4cker Bruno" \u2014 most of
 * the pool cast). Prompts must keep those names verbatim, so they are masked
 * before the language checks run. Without this, EVERY director and refill
 * prompt that names such a character is rejected and the pipeline degrades to
 * the generic fallback illustration (log e8cad1bf, reading page 2: cauldron
 * scene instead of the belt-and-puddle beat).
 */
export function looksLikeEnglishImagePrompt(value: string, allowedProperNouns: string[] = []): boolean {
  let text = String(value || "").trim();
  if (text.length < 30) return false;
  if (/^\s*[\[{]/.test(text)) return false;
  if (/"error"\s*:|developer instruction requires|can't provide|cannot provide|requested json|plain single-paragraph prompt|no json/i.test(text)) {
    return false;
  }
  for (const noun of allowedProperNouns) {
    const full = String(noun || "").trim();
    if (full.length < 3) continue;
    const parts = new Set<string>([full]);
    for (const word of full.split(/\s+/)) {
      // Never mask standalone German function words ("K\u00F6nig Karl der Weise"
      // must not whitelist "der"), otherwise real German prose slips through.
      if (word.length >= 3 && !GERMAN_FUNCTION_WORD.test(word)) parts.add(word);
    }
    for (const part of parts) {
      const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // \b only works next to ASCII word chars; fall back to a plain global
      // replace when the name starts/ends with a non-ASCII letter.
      const useBoundary = /^[A-Za-z0-9]/.test(part) && /[A-Za-z0-9]$/.test(part);
      const pattern = useBoundary ? `\\b${escaped}\\b` : escaped;
      text = text.replace(new RegExp(pattern, "gi"), " ");
    }
  }
  if (/[\u00E4\u00F6\u00FC\u00DF\u00C4\u00D6\u00DC]/.test(text)) return false;
  if (GERMAN_FUNCTION_WORD.test(text)) return false;
  if (GERMAN_MORPHOLOGY.test(text)) return false;
  return true;
}

function requiresCompleteBody(character: SceneCastCharacterContract): boolean {
  const entityType = String(character.entityType || "").toLowerCase();
  if (!entityType) return true;
  return !/\bhuman\s+(?:child|adult|character)\b/.test(entityType);
}

/**
 * Framing contract that works for humans, animals, robots, fantasy beings,
 * plants, living objects, and arbitrary mixed casts.
 */
export function buildEntityNeutralCompositionPrompt(
  characters: SceneCastCharacterContract[]
): string {
  const completeBodyNames = characters.filter(requiresCompleteBody).map((character) => character.name);
  const completeBodyRule = completeBodyNames.length > 0
    ? `Show the complete body or full canonical silhouette of: ${completeBodyNames.join(", ")}.`
    : "Keep every body readable with anatomically connected limbs.";

  return [
    "COMPOSITION: one coherent moment, medium-wide or wider framing sized to the cast and action.",
    "Keep each character's complete canonical identity-defining region fully inside the frame and unobstructed; for entities that canonically have them, this includes the head, face and neck.",
    completeBodyRule,
    "Never crop through a canonical head, neck, torso, limb, major joint, articulation, or identity-defining feature; preserve the full silhouette of entities without those parts.",
    "Keep figures clearly separated, with each canonical body, limb, wheel, branch, or silhouette outside chairs, tables, beds, walls, and other furniture; never invent a head, face, neck, limb, or joint.",
    "Environmental magic stays faceless and non-humanoid.",
  ].join(" ");
}
