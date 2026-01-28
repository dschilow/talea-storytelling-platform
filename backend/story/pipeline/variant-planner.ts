import crypto from "crypto";
import type { NormalizedRequest, SceneBeat, StoryBlueprintBase, StoryVariantPlan } from "./types";
import { createSeededRandom } from "./utils";
import { validateVariantPlan } from "./schema-validator";

const FAIRY_VARIANTS = {
  settingVariant: ["FOREST_AUTUMN", "FOREST_WINTER", "FOREST_FOG", "FOREST_SUNSET"],
  encounterVariant: ["FLOWERS_DISTRACTION", "RIDDLE_DISTRACTION", "FALSE_MAP", "HELPFUL_STRANGER_ACT"],
  artifactFunctionVariant: ["GUIDES_TRUE", "GETS_HIJACKED", "SOLVES_RIDDLE", "WARNS_DANGER"],
  rescueVariant: ["HUNTER_RESCUE", "GRANDMA_TRICK", "AVATAR_PLAN", "TEAMWORK_TRAP"],
  twistVariant: ["WOLF_LEARNS_LESSON", "FAKE_WOLF", "DOUBLE_BLIND", "ARTIFACT_SECRET"],
};

const CATEGORY_VARIANTS: Record<string, Record<string, string[]>> = {
  "Abenteuer & Schätze": {
    settingVariant: ["JUNGLE_RUINS", "ISLAND_COVE", "DESERT_TEMPLE", "MOUNTAIN_PASS"],
    encounterVariant: ["RIVAL_CREW", "TRAP_MAZE", "STORM_NIGHT", "HIDDEN_GUARDIAN"],
    artifactFunctionVariant: ["GUIDES_TRUE", "WARNS_DANGER", "SOLVES_RIDDLE", "REVEALS_MAP"],
    rescueVariant: ["TEAMWORK_RESCUE", "CLEVER_DECOY", "AVATAR_PLAN", "HELPER_BRIDGE"],
    twistVariant: ["TREASURE_IS_KEY", "ALLY_IS_RIVAL", "MAP_REWRITES", "ARTIFACT_SECRET"],
  },
  "Märchenwelten & Magie": {
    settingVariant: ["CRYSTAL_FOREST", "SKY_CASTLE", "UNDERGROUND_GROVE", "MIST_LAKE"],
    encounterVariant: ["SPELL_GLITCH", "TRICKSTER_FAIRY", "RIDDLE_GATE", "CURSED_PATH"],
    artifactFunctionVariant: ["GUIDES_TRUE", "SOLVES_RIDDLE", "WARNS_DANGER", "RESTORES_MAGIC"],
    rescueVariant: ["MENTOR_REVEAL", "AVATAR_PLAN", "TEAMWORK_TRAP", "HELPER_SACRIFICE"],
    twistVariant: ["CURSE_BREAKS", "FALSE_VILLAIN", "DOUBLE_BLIND", "ARTIFACT_SECRET"],
  },
  "Tierwelten": {
    settingVariant: ["FOREST_RAIN", "SAVANNA_DRY", "OCEAN_REEF", "MOUNTAIN_SNOW"],
    encounterVariant: ["PREDATOR_SHADOW", "LOST_NEST", "RIVER_FLOOD", "STRANGE_TRACKS"],
    artifactFunctionVariant: ["WARNS_DANGER", "GUIDES_TRUE", "HEALS_WOUND", "CALLS_HELP"],
    rescueVariant: ["TEAMWORK_RESCUE", "AVATAR_PLAN", "NATURE_HELP", "HELPER_BRIDGE"],
    twistVariant: ["FRIEND_REVEALED", "STORM_CLEARS", "ARTIFACT_SECRET", "NEW_HOME"],
  },
  "Sci-Fi & Zukunft": {
    settingVariant: ["ORBITAL_STATION", "MARS_COLONY", "NEBULA_GATE", "UNDERWATER_CITY"],
    encounterVariant: ["ROGUE_AI", "ALIEN_SIGNAL", "GRAVITY_GLITCH", "LOST_DRONE"],
    artifactFunctionVariant: ["GUIDES_TRUE", "WARNS_DANGER", "SOLVES_RIDDLE", "TIME_BUFFER"],
    rescueVariant: ["AVATAR_PLAN", "SYSTEM_REBOOT", "TEAMWORK_TRAP", "HELPER_BRIDGE"],
    twistVariant: ["ALIEN_HELPER", "FAKE_ALARM", "DOUBLE_BLIND", "ARTIFACT_SECRET"],
  },
  "Modern & Realität": {
    settingVariant: ["CITY_PARK", "SCHOOL_EVENT", "NEIGHBORHOOD_BLOCK", "MUSEUM_DAY"],
    encounterVariant: ["LOST_ITEM", "MISUNDERSTANDING", "RIVAL_TEAM", "SURPRISE_VISITOR"],
    artifactFunctionVariant: ["GUIDES_TRUE", "SOLVES_RIDDLE", "WARNS_DANGER", "CONNECTS_PEOPLE"],
    rescueVariant: ["FRIEND_APOLOGY", "AVATAR_PLAN", "TEAMWORK_TRAP", "HELPER_BRIDGE"],
    twistVariant: ["MISTAKE_LEARNT", "NEW_FRIEND", "ARTIFACT_SECRET", "DOUBLE_BLIND"],
  },
};

export function createVariantPlan(input: {
  normalized: NormalizedRequest;
  blueprint: StoryBlueprintBase;
}): StoryVariantPlan {
  const { normalized, blueprint } = input;
  const seed = normalized.variantSeed ?? crypto.randomInt(0, 2_147_483_647);
  const rng = createSeededRandom(seed);

  const isFairy = normalized.category === "Klassische Märchen";
  const variantSource = isFairy ? FAIRY_VARIANTS : (CATEGORY_VARIANTS[normalized.category] ?? FAIRY_VARIANTS);

  const variantChoices: Record<string, string> = {
    settingVariant: rng.pick(variantSource.settingVariant),
    encounterVariant: rng.pick(variantSource.encounterVariant),
    artifactFunctionVariant: rng.pick(variantSource.artifactFunctionVariant),
    rescueVariant: rng.pick(variantSource.rescueVariant),
    twistVariant: rng.pick(variantSource.twistVariant),
  };

  const baseScenes = blueprint.scenes;
  const sceneOverrides = buildSceneOverrides(baseScenes, variantChoices, rng);

  const plan: StoryVariantPlan = {
    storyInstanceId: normalized.storyId,
    taleId: "templateId" in blueprint.dna ? blueprint.dna.templateId : blueprint.dna.taleId,
    variantSeed: seed,
    variantChoices,
    sceneOverrides,
    category: normalized.category,
  };

  const validation = validateVariantPlan(plan);
  if (!validation.valid) {
    console.warn("[pipeline] Variant plan schema validation failed", validation.errors);
  }

  return plan;
}

function buildSceneOverrides(
  scenes: SceneBeat[],
  variantChoices: Record<string, string>,
  rng: ReturnType<typeof createSeededRandom>
): StoryVariantPlan["sceneOverrides"] {
  if (scenes.length === 0) return [];

  const overrides: NonNullable<StoryVariantPlan["sceneOverrides"]> = [];

  const settingDelta = variantChoices.settingVariant.replace(/_/g, " ").toLowerCase();
  const encounterDelta = variantChoices.encounterVariant.replace(/_/g, " ").toLowerCase();
  const artifactDelta = variantChoices.artifactFunctionVariant.replace(/_/g, " ").toLowerCase();
  const rescueDelta = variantChoices.rescueVariant.replace(/_/g, " ").toLowerCase();
  const twistDelta = variantChoices.twistVariant.replace(/_/g, " ").toLowerCase();

  const overrideChapters = rng.shuffle(scenes.map(s => s.sceneNumber)).slice(0, Math.min(3, scenes.length));

  for (const chapter of overrideChapters) {
    const base = scenes.find(s => s.sceneNumber === chapter);
    if (!base) continue;

    overrides.push({
      chapter,
      setting: `${base.setting}, ${settingDelta}`,
      goal: `Advance the story with a focus on ${encounterDelta}.`,
      conflict: `A challenge emerges: ${encounterDelta}.`,
      outcome: `The scene turns because of ${rescueDelta}.`,
      artifactUsageHint: `Artifact function: ${artifactDelta}.`,
      canonAnchorLineHint: `Tie the scene to ${twistDelta} without breaking canon.`,
      imageMustShowAdd: [settingDelta, encounterDelta],
      imageAvoidAdd: ["extra characters", "looking at camera"],
    });
  }

  return overrides;
}
