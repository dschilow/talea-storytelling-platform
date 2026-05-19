/**
 * Dev-Mode Image-Pipeline Guards (v11 Section 12)
 *
 * Functions that protect the Runware image stage from known prompt /
 * reference contamination bugs observed in the field:
 *
 *   - LLM occasionally emits `{"prompt":"..."}` as the prompt body,
 *     which Runware then tokenises literally.
 *   - Sprite-collage references mix Adrian + Alexander + Fee Rosalie,
 *     and the diffusion model copies Rosalie's dress / wings onto Adrian.
 *   - Prompt text sometimes claims "3 on-stage children" when the scene
 *     contains 2 boys + 1 fairy.
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

/**
 * Canonical boy-on-stage clothing constraints used by the
 * `whole-story-first-v11` cast (Adrian / Alexander). Centralised so a
 * future cast change only edits one place.
 */
export const BOY_FORBIDDEN_ATTRIBUTES = [
  "dress",
  "skirt",
  "fairy wings",
  "flower crown",
  "pink fairy outfit",
  "fairy dress",
  "tutu",
];

/**
 * Canonical fairy attributes that ONLY the fairy character may wear.
 */
export const FAIRY_EXCLUSIVE_ATTRIBUTES = [
  "wings",
  "flower crown",
  "fairy dress",
];

// ---------------------------------------------------------------------------
// §12F — Negative-prompt pack (canonical cross-attribute guard list)
// ---------------------------------------------------------------------------

/**
 * Canonical negative-prompt fragment for the boy + fairy mixed cast. Append
 * to any scene-specific negative prompt. The dedupe step keeps the final
 * payload short even if the caller already added some tokens.
 */
export const CANONICAL_NEGATIVE_PACK = [
  "no text", "no captions", "no speech bubbles", "no letters", "no signs",
  "no labels", "no logos",
  "no extra children", "no duplicate characters", "no third boy",
  "no girl replacing a boy", "no extra background children",
  "no dress on boys", "no skirt on boys", "no fairy wings on boys",
  "no flower crown on boys", "no pink fairy outfit on Adrian",
  "no pink dress on Adrian", "no fairy dress on Alexander",
  "do not copy Fee Rosalie clothing onto boys",
  "do not swap character outfits", "do not merge fairy with boy",
  "no gender swap",
];

export function mergeNegativePrompt(existing: string | undefined | null): string {
  const tokens = new Set<string>();
  if (existing) {
    for (const part of existing.split(/,\s*/)) {
      const cleaned = part.trim();
      if (cleaned) tokens.add(cleaned);
    }
  }
  for (const token of CANONICAL_NEGATIVE_PACK) tokens.add(token);
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
 * Rosalie's wings from leaking onto Adrian when she is not even present.
 *
 * Name matching is case-insensitive substring match in both directions so
 * "Fee Rosalie" matches "Rosalie" and vice versa.
 */
export function filterReferencesForScene(scene: SceneCast): FilteredReferences {
  const onStageNorm = scene.onStageNames.map((n) => n.toLowerCase().trim());
  const references = scene.availableRefs.filter((ref) => {
    const refLower = ref.name.toLowerCase().trim();
    return onStageNorm.some((on) => on.includes(refLower) || refLower.includes(on));
  });
  const dropped = scene.availableRefs
    .filter((ref) => !references.includes(ref))
    .map((ref) => ref.name);
  return { references, dropped };
}

/**
 * Build the explicit character-count contract block for a scene prompt.
 * Distinguishes boys vs fairy so the prompt cannot say "3 on-stage children"
 * when the cast is actually "2 boys + 1 fairy".
 */
export interface CountContract {
  boysCount: number;
  fairyCount: number;
  otherHumansCount: number;
}

export function renderCountContract(contract: CountContract, boyNames: string[], fairyNames: string[]): string {
  const lines: string[] = [];
  if (contract.boysCount > 0) {
    const word = contract.boysCount === 1 ? "boy" : "boys";
    lines.push(`EXACTLY ${contract.boysCount} human ${word}: ${boyNames.join(" and ")}.`);
  }
  if (contract.fairyCount > 0) {
    lines.push(`EXACTLY ${contract.fairyCount} tiny female fairy: ${fairyNames.join(" and ")}.`);
  }
  if (contract.otherHumansCount === 0) {
    lines.push("No other children. No duplicate characters. No extra faces. No adults.");
  }
  lines.push("Boys must wear casual boy clothes, not fairy clothes.");
  return lines.join("\n");
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
