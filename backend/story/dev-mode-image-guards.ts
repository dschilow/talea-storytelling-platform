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
  "text", "readable typography", "letters", "words", "captions", "speech bubbles",
  "signage", "labels", "logos", "watermarks",
  "extra character", "duplicate character", "unlisted person", "unlisted animal",
  "unlisted creature", "extra face", "same child twice", "twin copy of a listed character",
  "additional child", "identity swap", "face swap", "species swap", "age shift",
  "gender-presentation swap", "outfit swap", "accessory swap", "cross-character attribute transfer",
  "transferred hair", "transferred fur", "transferred skin", "transferred markings",
  "transferred wings", "transferred horns", "transferred tails", "transferred clothing",
  "transferred colors", "merged characters", "two characters in one body",
  "JSON fragments", "raw JSON", "accessories array", "stringified character profile",
  "unlisted wings", "unlisted horns", "unlisted tails", "unlisted crowns",
  "unlisted clothing", "unlisted accessories", "unplanned forest", "unlisted prop",
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

function normalizeNegativeConcept(value: string): string {
  return String(value || "")
    .trim()
    .replace(/^(?:no|without|avoid|do not|don't|never|must not|should not)\s+/i, "")
    .trim();
}

export function mergeNegativePrompt(
  existing: string | undefined | null,
  options?: { collageMode?: boolean }
): string {
  const tokens = new Map<string, string>();
  const add = (raw: string) => {
    const concept = normalizeNegativeConcept(raw);
    if (!concept) return;
    const key = concept.toLocaleLowerCase("en-US");
    if (!tokens.has(key)) tokens.set(key, concept);
  };
  if (existing) {
    for (const part of existing.split(/,\s*/)) add(part);
  }
  for (const token of CANONICAL_NEGATIVE_PACK) add(token);
  if (options?.collageMode) {
    for (const token of COLLAGE_STRIP_NEGATIVES) add(token);
  }
  return [...tokens.values()].join(", ");
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

function normalizeCharacterName(value: string): string {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function isSingleTokenAlias(left: string, right: string): boolean {
  const a = normalizeCharacterName(left).split(" ").filter(Boolean);
  const b = normalizeCharacterName(right).split(" ").filter(Boolean);
  if (a.length === 0 || b.length === 0) return false;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length === 1 && shorter[0].length >= 3 && longer.includes(shorter[0]);
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
  const kept = new Set<number>();
  for (const onStageName of scene.onStageNames) {
    const exactMatches = scene.availableRefs
      .map((ref, index) => ({ ref, index }))
      .filter(({ ref }) => normalizeCharacterName(ref.name) === normalizeCharacterName(onStageName));
    if (exactMatches.length === 1) {
      kept.add(exactMatches[0].index);
      continue;
    }
    if (exactMatches.length > 1) continue;
    const aliasMatches = scene.availableRefs
      .map((ref, index) => ({ ref, index }))
      .filter(({ ref }) => isSingleTokenAlias(ref.name, onStageName));
    if (aliasMatches.length === 1) kept.add(aliasMatches[0].index);
  }

  const references = scene.availableRefs.filter((_ref, index) => kept.has(index));
  const dropped = scene.availableRefs
    .filter((ref) => !references.includes(ref))
    .map((ref) => ref.name);
  return { references, dropped };
}

/** Select the authoritative cast for one frame without exceeding the image
 * model's native reference limit. Explicit scene-card names stay prioritized;
 * larger groups rotate deterministically across pages so every character gets
 * visual coverage instead of silently disappearing from all later images. */
export function selectFrameCastForReferenceLimit(args: {
  allNames: string[];
  priorityNames?: string[];
  pageOrder: number;
  maxReferences?: number;
}): string[] {
  const maxReferences = Math.max(0, Math.floor(args.maxReferences ?? 4));
  if (maxReferences === 0) return [];
  const unique = (names: string[]): string[] => {
    const seen = new Set<string>();
    return names.filter((name) => {
      const key = normalizeCharacterName(name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const available = unique(args.allNames);
  const priorities = unique(args.priorityNames || []).filter((name) =>
    available.some((candidate) => normalizeCharacterName(candidate) === normalizeCharacterName(name))
  );
  const rotate = (names: string[], count: number): string[] => {
    if (names.length <= count) return names.slice();
    const safePageOrder = Math.max(1, Number(args.pageOrder) || 1);
    const offset = ((safePageOrder - 1) * Math.max(1, count)) % names.length;
    return Array.from({ length: count }, (_value, index) => names[(offset + index) % names.length]);
  };
  if (priorities.length >= maxReferences) return rotate(priorities, maxReferences);
  const remaining = available.filter((name) =>
    !priorities.some((priority) => normalizeCharacterName(priority) === normalizeCharacterName(name))
  );
  return [...priorities, ...rotate(remaining, maxReferences - priorities.length)].slice(0, maxReferences);
}

/** Derive a stable but distinct seed for every image slot in a story.
 * Reusing one seed for cover and all reading pages caused providers to return
 * byte-identical images even when the scene prompt changed. */
export function deriveStoryImageJobSeed(args: {
  storySeed: number;
  kind: "cover" | "chapter";
  order?: number;
}): number {
  const maxSeed = 2_147_483_646;
  const normalizedBase = Math.max(1, Math.floor(Math.abs(args.storySeed)) % maxSeed);
  const slot = args.kind === "cover" ? 0 : Math.max(1, Math.floor(args.order || 1));
  const offset = args.kind === "cover" ? 104_729 : (slot * 130_363) + 17_389;
  return ((normalizedBase + offset - 1) % maxSeed) + 1;
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
  const noun = characters.length === 1 ? "character" : "characters";
  const lines = [`EXPECTED CAST: EXACTLY ${characters.length} named ${noun} total.`];
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

  if (!/\bEXPECTED CAST:\s*EXACTLY\s+\d+\s+named characters? total\b/i.test(positivePrompt)) {
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
