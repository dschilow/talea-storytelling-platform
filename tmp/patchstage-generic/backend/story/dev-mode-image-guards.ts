/**
 * Dev-Mode Image-Pipeline Guards (v11 Section 12)
 *
 * Functions that protect the Runware image stage from known prompt /
 * reference contamination bugs observed in the field:
 *
 *   - LLM occasionally emits `{"prompt":"..."}` as the prompt body,
 *     which Runware then tokenises literally.
 *   - Multi-character references can make the diffusion model copy one
 *     character's traits onto another.
 *   - Prompt text can invent a cast count or entity type that contradicts
 *     the authoritative scene plan.
 *
 * Each guard is pure and side-effect free so it can be unit-tested.
 */

// ---------------------------------------------------------------------------
// §12A — strip JSON wrappers from positivePrompt
// ---------------------------------------------------------------------------

export interface PromptUnwrapResult {
  prompt: string;
  changed: boolean;
  reason?: string;
}

/**
 * If the LLM-emitted prompt accidentally starts with a JSON envelope
 * (`{"prompt":"..."}`, ```json ... ```, etc.), unwrap it back to plain
 * prose. Runware needs text, not JSON.
 *
 * Order of attempts:
 *  1. Strip ```json / ``` fences
 *  2. If trimmed body looks like `{...}` try JSON.parse and pull
 *     `prompt`, `positivePrompt`, `text`, or `description` fields.
 *  3. Otherwise return unchanged.
 */
export function unwrapJsonPrompt(input: string): PromptUnwrapResult {
  if (!input) return { prompt: "", changed: false };

  let prompt = input;

  // 1. fence strip
  const fenceMatch = prompt.match(/^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i);
  if (fenceMatch) prompt = fenceMatch[1];

  // 2. JSON envelope detection
  const trimmed = prompt.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        const candidates = [
          parsed.prompt,
          parsed.positivePrompt,
          parsed.text,
          parsed.description,
          parsed.sceneDescription,
        ];
        const inner = candidates.find((v) => typeof v === "string" && v.trim().length > 0);
        if (inner) {
          return { prompt: String(inner).trim(), changed: true, reason: "json-envelope" };
        }
      }
    } catch {
      // Fall through — not parseable JSON.
    }
  }

  // 3. Inline `{"prompt":"..."}` at the start of an otherwise text body
  //    (this is the exact bug from log 88ec895c)
  const inlineEnvelope = /^\s*\{\s*"prompt"\s*:\s*"([\s\S]+?)"\s*\}\s*,?\s*/i;
  const inline = prompt.match(inlineEnvelope);
  if (inline) {
    const rest = prompt.replace(inlineEnvelope, "").trim();
    // unescape JSON string escapes
    const innerUnescaped = inline[1]
      .replace(/\\"/g, '"')
      .replace(/\\n/g, "\n")
      .replace(/\\\\/g, "\\");
    const combined = rest ? `${innerUnescaped}, ${rest}` : innerUnescaped;
    return { prompt: combined.trim(), changed: true, reason: "inline-json-envelope" };
  }

  return { prompt, changed: false };
}

// ---------------------------------------------------------------------------
// §12D — Character manifest text (negative + positive constraints per character)
// ---------------------------------------------------------------------------

export interface CharacterManifest {
  name: string;
  description: string;
  forbiddenAttributes: string[];
}

/**
 * Generate a character manifest text block for a scene. Forbidden attributes
 * are explicitly listed as "NO X" lines so the diffusion model is steered
 * away from cross-character contamination.
 */
export function renderCharacterManifest(manifests: CharacterManifest[]): string {
  if (manifests.length === 0) return "";
  return manifests
    .map((m) => {
      const noLines = m.forbiddenAttributes.length > 0
        ? `\n  ${m.forbiddenAttributes.map((a) => `NO ${a}`).join(", ")}`
        : "";
      return `${m.name}: ${m.description}${noLines}`;
    })
    .join("\n");
}


// ---------------------------------------------------------------------------
// §12F — Negative-prompt pack (canonical cross-attribute guard list)
// ---------------------------------------------------------------------------

/**
 * Generic negative-prompt fragment for any cast composition. Character-specific
 * attributes are locked positively by the scene manifest; this pack only bans
 * cross-character contamination and unplanned entities.
 */
export const CANONICAL_NEGATIVE_PACK = [
  "no text", "no captions", "no speech bubbles", "no letters", "no signs",
  "no labels", "no logos",
  "no extra characters", "no duplicate characters", "no unlisted people",
  "no unlisted animals", "no unlisted creatures", "no extra faces",
  "no identity swap", "no face swap", "no species swap", "no age shift",
  "no gender-presentation swap", "do not swap outfits or accessories",
  "do not transfer hair, fur, skin, markings, wings, horns, tails, clothing, or colors between characters",
  "do not merge two characters into one body",
  // v12 §13D/F: log-runware-single-image-3b8eedfe contained raw JSON +
  // false fairy permission. Add explicit guards so even when the positive
  // prompt accidentally leaks an object stringification or generic
  // "wings"/"forest" language, the diffusion model is told not to render
  // those tokens. Per-scene location/character permissions still go in the
  // positive prompt (see image-prompt-builder.ts buildSceneSpecificPrompt).
  "no JSON fragments", "no raw JSON", "no accessories array",
  "no stringified character profile",
  "no unlisted wings, horns, tails, crowns, clothing, or accessories",
  "no forest unless the scene is outdoors",
  "no character not listed in the scene",
  "no floating unrelated props",
  // Entity-generic anatomy guards: preserve the limb/body-part count visible in
  // each canonical reference instead of assuming every figure is human.
  "wrong limb count for the referenced species", "extra body parts", "missing body parts",
  "fused body parts", "distorted anatomy", "bad anatomy", "disproportionate anatomy",
  "floating limbs", "detached limbs", "extra human fingers", "malformed human hands",
  "character intersecting furniture", "character embedded in chair", "character merged with furniture",
  "half inside furniture", "body parts disappearing into furniture",
];

/**
 * Collage-only negatives. When the reference image is the horizontal sprite
 * strip, the fast 4-step Runware render tends to PAINT the strip (framed
 * portrait cells, colored borders, panel gutters) into the output instead of
 * only borrowing the identities from it (cover of story "Karte der Wege": the
 * 3-cell purple/green/blue strip was reproduced across the top of the cover).
 * These are appended ONLY in collage mode so single-scene pages are never
 * pushed away from legitimate in-scene framing (windows, doorways, etc.).
 * Mirrors backend/story/pipeline/constants.ts COLLAGE_MODE_NEGATIVES.
 */
export const COLLAGE_STRIP_NEGATIVES = [
  "reference strip visible in the image",
  "portrait strip",
  "character lineup strip",
  "row of framed portraits",
  "framed portrait cells",
  "collage", "grid", "strip layout", "panels", "storyboard",
  "split screen", "split-screen", "triptych", "diptych", "multi-panel",
  "comic panels", "divided image", "separate scenes", "multiple scenes",
  "white gutters", "gutter", "quadrants",
  "picture frame", "framed cells", "colored rectangles", "colored borders",
  "colored outlines", "colored frame around a character",
  "colored halo", "halo behind head", "face badge", "head badge",
  "avatar frame", "profile badge", "headshot inset", "face bubble",
  "colored shape behind head", "multiple images", "inset portraits",
];

export function mergeNegativePrompt(
  existing: string | undefined | null,
  options?: { collageMode?: boolean }
): string {
  const tokens = new Set<string>();
  if (existing) {
    for (const part of existing.split(/,\s*/)) {
      const cleaned = part.trim();
      if (cleaned) tokens.add(cleaned);
    }
  }
  for (const token of CANONICAL_NEGATIVE_PACK) tokens.add(token);
  if (options?.collageMode) {
    for (const token of COLLAGE_STRIP_NEGATIVES) tokens.add(token);
  }
  return [...tokens].join(", ");
}

// ---------------------------------------------------------------------------
// §12B / §12E — Reference-slot filtering and count contract
// ---------------------------------------------------------------------------

export interface SceneCast {
  /** Names of characters that are actually on-stage in this scene */
  onStageNames: string[];
  /** All available reference entries with their character name */
  availableRefs: Array<{ name: string; imageUrl: string; kind: "avatar" | "pool" }>;
}

export interface FilteredReferences {
  references: Array<{ name: string; imageUrl: string; kind: "avatar" | "pool" }>;
  dropped: string[];
}

/**
 * Drop reference images for characters that are NOT in the scene. Prevents
 * off-stage traits from leaking onto visible characters.
 *
 * Name matching prefers exact names. A shortened token alias such as
 * "Rosalie" -> "Fee Rosalie" is accepted only when it resolves to exactly
 * one available reference. Prefix collisions such as "Alex"/"Alexander"
 * are never treated as the same name.
 */
export function filterReferencesForScene(scene: SceneCast): FilteredReferences {
  const normalized = (value: string): string => value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
  const tokenAlias = (left: string, right: string): boolean => {
    const a = normalized(left).split(" ").filter(Boolean);
    const b = normalized(right).split(" ").filter(Boolean);
    if (a.length === 0 || b.length === 0) return false;
    const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
    if (shorter.length !== 1 || shorter[0].length < 3) return false;
    return longer.includes(shorter[0]);
  };

  const kept = new Set<number>();
  for (const onStageName of scene.onStageNames) {
    const exactMatches = scene.availableRefs
      .map((ref, index) => ({ ref, index }))
      .filter(({ ref }) => normalized(ref.name) === normalized(onStageName));
    if (exactMatches.length === 1) {
      kept.add(exactMatches[0].index);
      continue;
    }
    if (exactMatches.length > 1) continue;
    const aliasMatches = scene.availableRefs
      .map((ref, index) => ({ ref, index }))
      .filter(({ ref }) => tokenAlias(ref.name, onStageName));
    if (aliasMatches.length === 1) kept.add(aliasMatches[0].index);
  }

  const references = scene.availableRefs.filter((_ref, index) => kept.has(index));
  const dropped = scene.availableRefs
    .filter((ref) => !references.includes(ref))
    .map((ref) => ref.name);
  return { references, dropped };
}

/** Minimal visual source used to classify a character without assuming that
 * avatars are human or that pool figures are animals/fairies. */
export interface VisualEntitySource {
  visualProfile?: any;
  physicalTraits?: any;
  species?: string | null;
  ageCategory?: string | null;
  description?: string | null;
}

export interface SceneCastCharacterContract {
  name: string;
  entityType: string;
  sourceKind: "avatar" | "pool" | "story";
  referenceIndex?: number;
}

function cleanEntityLabel(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[{}\[\]"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 90);
}

/** Derive the most specific available entity label from canonical metadata. */
export function deriveVisualEntityType(source: VisualEntitySource): string {
  const profile = source.visualProfile && typeof source.visualProfile === "object"
    ? source.visualProfile
    : {};
  const physical = source.physicalTraits && typeof source.physicalTraits === "object"
    ? source.physicalTraits
    : {};
  const specificType = [
    profile.characterType,
    profile.species,
    physical.characterType,
    source.species,
    profile.speciesCategory,
  ].map(cleanEntityLabel).find(Boolean) || "character with type defined by its canonical reference";

  const normalized = specificType.toLowerCase();
  const isHuman = /\b(human|person|mensch|boy|girl|child|kid|adult|woman|man)\b/i.test(normalized)
    || cleanEntityLabel(profile.speciesCategory).toLowerCase() === "human";
  if (!isHuman) return specificType;

  const ageNumeric = Number(profile.ageNumeric);
  const ageText = [profile.ageApprox, profile.ageDescription, source.ageCategory, specificType]
    .map(cleanEntityLabel)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const child = (Number.isFinite(ageNumeric) && ageNumeric < 18)
    || /\b(child|kid|boy|girl|teen|baby|toddler|kind|junge|mädchen|maedchen)\b/i.test(ageText);
  const adult = (Number.isFinite(ageNumeric) && ageNumeric >= 18)
    || /\b(adult|woman|man|elder|senior|erwachsen|frau|mann)\b/i.test(ageText);
  return child ? "human child" : adult ? "human adult" : "human character";
}

/** Render one authoritative, entity-agnostic cast contract. */
export function renderSceneCastContract(characters: SceneCastCharacterContract[]): string {
  const lines = [`EXPECTED CAST: EXACTLY ${characters.length} named characters total.`];
  characters.forEach((character, index) => {
    const reference = character.referenceIndex
      ? `; canonical identity = attached reference image ${character.referenceIndex}`
      : character.sourceKind === "story"
        ? "; no canonical image — follow only the scene description"
        : "; canonical metadata/description is authoritative";
    lines.push(`${index + 1}. ${character.name} — ${character.entityType}${reference}; appears exactly once.`);
  });
  lines.push("No other people, children, animals, creatures, robots, living objects, faces, silhouettes, or background characters.");
  lines.push("Preserve each listed character's own species, anatomy, age, gender presentation, face, markings, colors, clothing, and accessories. Never transfer attributes between characters.");
  lines.push("Every complete body remains readable and outside furniture; characters never merge with each other or the environment.");
  return lines.join("\n");
}

/** Remove model-invented visible-cast counts before the deterministic cast
 * contract is prepended, avoiding contradictions for any entity type. */
export function stripModelCastCountClaims(prompt: string): { prompt: string; removedClaims: string[] } {
  const removedClaims: string[] = [];
  const countClaim = /\b(?:exactly\s+)?(?:one|two|three|four|five|six|seven|eight|\d+)\s+(?:named\s+)?(?:human\s+)?(?:characters?|figures?|people|persons?|children|child|boys?|girls?|kids?|animals?|creatures?|robots?)\b/gi;
  const cleaned = String(prompt || "")
    .replace(countClaim, (match) => {
      removedClaims.push(match);
      return "the named cast";
    })
    .replace(/\s{2,}/g, " ")
    .trim();
  return { prompt: cleaned, removedClaims: [...new Set(removedClaims)] };
}
// ---------------------------------------------------------------------------
// §12 image-preflight: assert prompt is ready before sending to Runware
// ---------------------------------------------------------------------------

export interface PromptPreflightIssue {
  code: "json_wrapper" | "missing_count_contract" | "ref_for_absent_character" | "empty_prompt";
  detail: string;
}

export interface PromptPreflightResult {
  ok: boolean;
  issues: PromptPreflightIssue[];
}

export function preflightImagePrompt(args: {
  positivePrompt: string;
  references: Array<{ name: string }>;
  onStageNames: string[];
}): PromptPreflightResult {
  const issues: PromptPreflightIssue[] = [];
  const { positivePrompt, references, onStageNames } = args;

  if (!positivePrompt || positivePrompt.trim().length < 30) {
    issues.push({ code: "empty_prompt", detail: "positivePrompt is empty or too short" });
  }

  // Detect leftover JSON envelopes
  const trimmed = positivePrompt.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    issues.push({ code: "json_wrapper", detail: "positivePrompt looks like a JSON object" });
  }
  if (/^\s*\{\s*"prompt"\s*:/.test(positivePrompt)) {
    issues.push({ code: "json_wrapper", detail: 'positivePrompt starts with `{"prompt":` envelope' });
  }

  if (!/\bEXPECTED CAST:\s*EXACTLY\s+\d+\s+named characters total\b/i.test(positivePrompt)) {
    issues.push({
      code: "missing_count_contract",
      detail: "positivePrompt has no deterministic generic cast contract",
    });
  }

  const onStageNorm = onStageNames.map((n) => n.toLowerCase());
  for (const ref of references) {
    const refLower = ref.name.toLowerCase();
    const inScene = onStageNorm.some((on) => on.includes(refLower) || refLower.includes(on));
    if (!inScene) {
      issues.push({
        code: "ref_for_absent_character",
        detail: `Reference for "${ref.name}" but character is not in the scene cast.`,
      });
    }
  }

  return { ok: issues.length === 0, issues };
}
