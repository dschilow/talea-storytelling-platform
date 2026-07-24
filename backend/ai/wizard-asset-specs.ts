/**
 * Wizard Asset Specs
 * ------------------
 * Declarative catalog of every avatar-wizard option that gets a pre-generated
 * Talea-styled illustration instead of a standard emoji/icon.
 *
 * Each spec produces exactly one image, stored under a STABLE, deterministic
 * bucket key: `wizard-assets/<group>/<id>.webp`. Because the key is stable the
 * frontend can reference it directly and the generator is idempotent (it can
 * skip assets that already exist).
 *
 * The `prompt` fragment is the SUBJECT only; the shared Talea illustration
 * style (watercolor storybook look, clean background, framing) is appended by
 * the generator so every tile looks like it belongs to the same set.
 *
 * Keep the ids in sync with `frontend/types/avatarForm.ts`.
 */

export type WizardAssetGroup =
  | "character"
  | "gender"
  | "bodyBuild"
  | "hairColor"
  | "hairStyle"
  | "eyeColor"
  | "specialFeature";

export interface WizardAssetSpec {
  group: WizardAssetGroup;
  id: string;
  /** English subject fragment describing what to draw. */
  prompt: string;
}

/** Shared, single-source-of-truth prefix for all wizard-asset bucket keys. */
export const WIZARD_ASSET_PREFIX = "wizard-assets";

export function wizardAssetKey(group: WizardAssetGroup, id: string): string {
  return `${WIZARD_ASSET_PREFIX}/${group}/${id}.webp`;
}

/**
 * Full catalog. Order is irrelevant; ids are unique within a group.
 * Every prompt describes a friendly, child-safe storybook icon subject.
 */
export const WIZARD_ASSET_SPECS: WizardAssetSpec[] = [
  // ── Character types ──────────────────────────────────────────
  { group: "character", id: "human", prompt: "a cheerful child character, friendly face, half-body" },
  { group: "character", id: "dog", prompt: "a happy cartoon dog sitting, fluffy, big friendly eyes" },
  { group: "character", id: "cat", prompt: "a cute cartoon cat sitting, soft fur, gentle smile" },
  { group: "character", id: "rabbit", prompt: "an adorable cartoon rabbit with long ears, soft fur" },
  { group: "character", id: "fox", prompt: "a clever little cartoon fox, orange fur, bushy tail" },
  { group: "character", id: "bear", prompt: "a cuddly cartoon bear cub, round ears, warm expression" },
  { group: "character", id: "unicorn", prompt: "a magical pastel unicorn with a shimmering horn and flowing mane" },
  { group: "character", id: "fairy", prompt: "a tiny friendly fairy with delicate glowing wings and a wand" },
  { group: "character", id: "robot", prompt: "a friendly rounded toy robot with glowing eyes, playful" },
  { group: "character", id: "alien", prompt: "a cute friendly little alien creature, big curious eyes" },
  { group: "character", id: "wizard", prompt: "a young friendly wizard child with a starry pointed hat" },
  { group: "character", id: "dragon", prompt: "a small friendly baby dragon with little wings, not scary" },
  { group: "character", id: "other", prompt: "a whimsical friendly fantasy creature, sparkles around it" },

  // ── Gender ───────────────────────────────────────────────────
  { group: "gender", id: "male", prompt: "a smiling young boy character, half-body, friendly" },
  { group: "gender", id: "female", prompt: "a smiling young girl character, half-body, friendly" },

  // ── Body build ───────────────────────────────────────────────
  { group: "bodyBuild", id: "slim", prompt: "a slim slender child figure standing, full body silhouette-style" },
  { group: "bodyBuild", id: "normal", prompt: "an average-build child figure standing, full body" },
  { group: "bodyBuild", id: "sturdy", prompt: "a sturdy strong child figure standing, full body" },

  // ── Hair color (portrait heads) ──────────────────────────────
  { group: "hairColor", id: "blonde", prompt: "a child's head with bright blonde hair, front portrait" },
  { group: "hairColor", id: "brown", prompt: "a child's head with warm brown hair, front portrait" },
  { group: "hairColor", id: "black", prompt: "a child's head with glossy black hair, front portrait" },
  { group: "hairColor", id: "red", prompt: "a child's head with coppery red hair, front portrait" },
  { group: "hairColor", id: "gray", prompt: "a child's head with silver gray hair, front portrait" },
  { group: "hairColor", id: "colorful", prompt: "a child's head with playful rainbow-colored hair, front portrait" },
  { group: "hairColor", id: "none", prompt: "a friendly bald child's head, front portrait, no hair" },

  // ── Hair style ───────────────────────────────────────────────
  { group: "hairStyle", id: "short", prompt: "a child's head with a neat short haircut, front portrait" },
  { group: "hairStyle", id: "long", prompt: "a child's head with long flowing hair, front portrait" },
  { group: "hairStyle", id: "curly", prompt: "a child's head with bouncy curly hair, front portrait" },
  { group: "hairStyle", id: "braids", prompt: "a child's head with two neat braids, front portrait" },
  { group: "hairStyle", id: "ponytail", prompt: "a child's head with a cheerful ponytail, front portrait" },
  { group: "hairStyle", id: "none", prompt: "a friendly bald child's head, front portrait, no hair at all" },

  // ── Eye color (expressive eyes close-up) ─────────────────────
  { group: "eyeColor", id: "blue", prompt: "a pair of big friendly bright blue cartoon eyes, close-up" },
  { group: "eyeColor", id: "green", prompt: "a pair of big friendly green cartoon eyes, close-up" },
  { group: "eyeColor", id: "brown", prompt: "a pair of big friendly warm brown cartoon eyes, close-up" },
  { group: "eyeColor", id: "gray", prompt: "a pair of big friendly soft gray cartoon eyes, close-up" },
  { group: "eyeColor", id: "amber", prompt: "a pair of big friendly amber golden cartoon eyes, close-up" },
  { group: "eyeColor", id: "other", prompt: "a pair of big friendly magical multicolored cartoon eyes, close-up" },

  // ── Special features (icon objects) ──────────────────────────
  { group: "specialFeature", id: "glasses", prompt: "a pair of round childrens glasses, single object icon" },
  { group: "specialFeature", id: "hat", prompt: "a cheerful little hat, single object icon" },
  { group: "specialFeature", id: "crown", prompt: "a small golden crown with gems, single object icon" },
  { group: "specialFeature", id: "scarf", prompt: "a cozy knitted scarf, single object icon" },
  { group: "specialFeature", id: "bow", prompt: "a cute ribbon bow, single object icon" },
  { group: "specialFeature", id: "wings", prompt: "a pair of small delicate fairy wings, single object icon" },
  { group: "specialFeature", id: "tail", prompt: "a fluffy animal tail, single object icon" },
  { group: "specialFeature", id: "horns", prompt: "a pair of small friendly curved horns, single object icon" },
  { group: "specialFeature", id: "freckles", prompt: "a smiling child's cheeks with cute freckles, close-up" },
  { group: "specialFeature", id: "scar", prompt: "a friendly child's face with a small brave scar, close-up" },
  { group: "specialFeature", id: "beard", prompt: "a small friendly beard, single object icon" },
  { group: "specialFeature", id: "earrings", prompt: "a pair of sparkly little earrings, single object icon" },
];

/** Shared style suffix so every generated tile matches the Talea look. */
export const WIZARD_ASSET_STYLE =
  "soft hand-painted children's storybook watercolor illustration, warm pastel palette, " +
  "clean simple flat background, centered subject, gentle rim light, rounded shapes, " +
  "child-safe, friendly, no text, no watermark, icon-style single subject";

export const WIZARD_ASSET_NEGATIVE =
  "photo, realistic, scary, dark, horror, text, watermark, letters, multiple subjects, " +
  "cluttered background, deformed, extra limbs, low quality";

export function buildWizardAssetPrompt(spec: WizardAssetSpec): string {
  return `${spec.prompt}. ${WIZARD_ASSET_STYLE}`;
}
