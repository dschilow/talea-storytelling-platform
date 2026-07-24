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
  | "specialFeature"
  | "storyCategory"
  | "storyLength"
  | "storyFeeling"
  | "storyWish"
  | "dokuDomain"
  | "dokuAge"
  | "dokuDepth"
  | "dokuPerspective"
  | "dokuTone"
  | "dokuLength"
  | "navTab";

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

  // ── Story Wizard: Kategorie ───────────────────────────────────
  { group: "storyCategory", id: "fairy-tales", prompt: "an enchanted storybook castle with a king and princess silhouette, magical fairy tale scene" },
  { group: "storyCategory", id: "adventure", prompt: "a treasure chest on a mountain path with a compass, adventure scene" },
  { group: "storyCategory", id: "magic", prompt: "a sparkling magic wand casting stars, wizard hat, magical spell scene" },
  { group: "storyCategory", id: "animals", prompt: "a group of happy forest animals together, friendly animal world scene" },
  { group: "storyCategory", id: "scifi", prompt: "a cute rounded spaceship flying past a friendly planet, sci-fi scene" },
  { group: "storyCategory", id: "modern", prompt: "a cheerful house with a family silhouette, everyday modern life scene" },

  // ── Story Wizard: Länge (length) ───────────────────────────────
  { group: "storyLength", id: "short", prompt: "a single small open storybook with one page, short story icon" },
  { group: "storyLength", id: "medium", prompt: "a medium stack of two storybooks, medium story icon" },
  { group: "storyLength", id: "long", prompt: "a tall stack of three storybooks, long story icon" },

  // ── Story Wizard: Gefühle (mood) ───────────────────────────────
  { group: "storyFeeling", id: "funny", prompt: "a big laughing smiley face with stars, funny mood icon" },
  { group: "storyFeeling", id: "warm", prompt: "a glowing warm heart with soft sparkles, heartwarming mood icon" },
  { group: "storyFeeling", id: "exciting", prompt: "a bright lightning bolt with motion lines, exciting mood icon" },
  { group: "storyFeeling", id: "crazy", prompt: "a swirl of colorful confetti and stars, crazy playful mood icon" },
  { group: "storyFeeling", id: "meaningful", prompt: "a thought bubble with a glowing lightbulb, thoughtful mood icon" },

  // ── Story Wizard: Wünsche (special wishes) ─────────────────────
  { group: "storyWish", id: "rhymes", prompt: "a musical note paired with a quill pen, rhyming poem icon" },
  { group: "storyWish", id: "moral", prompt: "an open storybook with a glowing heart above it, lesson and moral icon" },
  { group: "storyWish", id: "avatarIsHero", prompt: "a small hero character wearing a golden star badge, hero icon" },
  { group: "storyWish", id: "famousCharacters", prompt: "two storybook character silhouettes shaking hands, famous characters icon" },
  { group: "storyWish", id: "happyEnd", prompt: "a bright rainbow with a smiling sun, happy ending icon" },
  { group: "storyWish", id: "surpriseEnd", prompt: "a wrapped gift box popping open with sparkles, surprise ending icon" },

  // ── Doku Wizard: Themen-Welten (domains) ────────────────────────
  { group: "dokuDomain", id: "nature", prompt: "a friendly leaf and a small forest animal together, nature and animals icon" },
  { group: "dokuDomain", id: "space", prompt: "a cute rocket flying past a ringed planet and stars, outer space icon" },
  { group: "dokuDomain", id: "history", prompt: "an ancient stone temple column with a scroll, history and cultures icon" },
  { group: "dokuDomain", id: "tech", prompt: "a friendly rounded robot with gears, technology and inventions icon" },
  { group: "dokuDomain", id: "body", prompt: "a glowing friendly brain with a heartbeat line, human body icon" },
  { group: "dokuDomain", id: "earth", prompt: "a cheerful cartoon planet earth with clouds, earth and climate icon" },
  { group: "dokuDomain", id: "arts", prompt: "a paintbrush with colorful paint splashes and a musical note, arts and music icon" },
  { group: "dokuDomain", id: "logic", prompt: "colorful jigsaw puzzle pieces fitting together, logic and puzzles icon" },
  { group: "dokuDomain", id: "dinosaurs", prompt: "a friendly cartoon dinosaur with a long neck, dinosaurs icon" },
  { group: "dokuDomain", id: "oceans", prompt: "a cheerful wave with a small fish and bubbles, oceans and deep sea icon" },
  { group: "dokuDomain", id: "myths", prompt: "a small friendly dragon curled around a glowing gem, myths and legends icon" },
  { group: "dokuDomain", id: "coding", prompt: "a friendly computer screen with colorful code blocks, coding icon" },
  { group: "dokuDomain", id: "chemistry", prompt: "a bubbling colorful test tube with sparkles, everyday chemistry icon" },
  { group: "dokuDomain", id: "sports_science", prompt: "a bouncing ball with motion lines, sports and movement icon" },

  // ── Doku Wizard: Alter (audience age) ───────────────────────────
  { group: "dokuAge", id: "3-5", prompt: "a tiny cute baby chick hatching from an egg, youngest age icon" },
  { group: "dokuAge", id: "6-8", prompt: "a small sprouting green plant, young age growing icon" },
  { group: "dokuAge", id: "9-12", prompt: "a cute rocket ready to launch, curious explorer age icon" },
  { group: "dokuAge", id: "13+", prompt: "a graduation cap with a small sparkle, teen expert age icon" },

  // ── Doku Wizard: Tiefe (depth) ──────────────────────────────────
  { group: "dokuDepth", id: "basic", prompt: "a single bright lightning bolt, quick short explanation icon" },
  { group: "dokuDepth", id: "standard", prompt: "an open storybook with a glowing page, standard explanation icon" },
  { group: "dokuDepth", id: "deep", prompt: "a magnifying glass examining a glowing gem, deep detailed exploration icon" },

  // ── Doku Wizard: Erklärweise (perspective) ───────────────────────
  { group: "dokuPerspective", id: "science", prompt: "a friendly magnifying glass over a bubbling test tube, scientist perspective icon" },
  { group: "dokuPerspective", id: "history", prompt: "a glowing hourglass with a small clock, time traveler perspective icon" },
  { group: "dokuPerspective", id: "technology", prompt: "a friendly wrench and gear together, inventor perspective icon" },
  { group: "dokuPerspective", id: "nature", prompt: "a small compass resting on a green leaf, explorer perspective icon" },
  { group: "dokuPerspective", id: "culture", prompt: "a small globe with a little airplane circling it, world traveler perspective icon" },

  // ── Doku Wizard: Stimmung (tone) ────────────────────────────────
  { group: "dokuTone", id: "fun", prompt: "a big laughing smiley face, fun playful tone icon" },
  { group: "dokuTone", id: "curious", prompt: "a magnifying glass with a curious sparkle, curious tone icon" },
  { group: "dokuTone", id: "neutral", prompt: "a calm gentle glowing star, calm clear tone icon" },

  // ── Doku Wizard: Länge (content length) ─────────────────────────
  { group: "dokuLength", id: "short", prompt: "a single small page of paper, short content icon" },
  { group: "dokuLength", id: "medium", prompt: "a small folded newspaper, medium content icon" },
  { group: "dokuLength", id: "long", prompt: "a thick stack of books, long content icon" },

  // ── Bottom navigation tabs ───────────────────────────────────────
  { group: "navTab", id: "home", prompt: "a cozy little cottage house with a heart-shaped window, home navigation icon" },
  { group: "navTab", id: "stories", prompt: "an open storybook with glowing pages, stories library navigation icon" },
  { group: "navTab", id: "avatars", prompt: "a small friendly character face with a star, avatars navigation icon" },
  { group: "navTab", id: "dokus", prompt: "a glowing lightbulb next to an open book, knowledge dokus navigation icon" },
  { group: "navTab", id: "quiz", prompt: "a friendly question mark with a checkmark, quiz navigation icon" },
  { group: "navTab", id: "tavi", prompt: "a small friendly round robot assistant waving, chat assistant navigation icon" },
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
