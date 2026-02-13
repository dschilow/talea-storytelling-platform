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
  const isClassicTale = isFairy && "taleId" in blueprint.dna;
  const variantSource = isFairy ? FAIRY_VARIANTS : (CATEGORY_VARIANTS[normalized.category] ?? FAIRY_VARIANTS);

  const variantChoices: Record<string, string> = {
    settingVariant: rng.pick(variantSource.settingVariant),
    encounterVariant: rng.pick(variantSource.encounterVariant),
    artifactFunctionVariant: rng.pick(variantSource.artifactFunctionVariant),
    rescueVariant: rng.pick(variantSource.rescueVariant),
    twistVariant: rng.pick(variantSource.twistVariant),
  };

  const baseScenes = blueprint.scenes;
  const sceneOverrides = buildSceneOverrides(baseScenes, variantChoices, rng, normalized.language, {
    isClassicTale,
  });

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
  rng: ReturnType<typeof createSeededRandom>,
  language: string,
  options?: { isClassicTale?: boolean }
): StoryVariantPlan["sceneOverrides"] {
  if (scenes.length === 0) return [];

  const overrides: NonNullable<StoryVariantPlan["sceneOverrides"]> = [];

  const settingLabel = labelVariant(variantChoices.settingVariant, language);
  const encounterLabel = labelVariant(variantChoices.encounterVariant, language);
  const artifactLabel = labelVariant(variantChoices.artifactFunctionVariant, language);
  const rescueLabel = labelVariant(variantChoices.rescueVariant, language);
  const twistLabel = labelVariant(variantChoices.twistVariant, language);

  const overrideChapters = rng.shuffle(scenes.map(s => s.sceneNumber)).slice(0, Math.min(3, scenes.length));
  const classic = options?.isClassicTale ?? false;
  const settingOverrideChapters = classic
    ? new Set(rng.shuffle(overrideChapters).slice(0, 1))
    : new Set(overrideChapters);

  for (const chapter of overrideChapters) {
    const base = scenes.find(s => s.sceneNumber === chapter);
    if (!base) continue;

    const allowSettingOverride = settingOverrideChapters.has(chapter) && shouldApplySettingVariant(base.setting, classic);
    const setting = allowSettingOverride ? `${base.setting}, ${settingLabel}` : base.setting;
    const narrative = buildNarrativeOverride({
      language,
      rng,
      encounterLabel,
      rescueLabel,
      artifactLabel,
      twistLabel,
      sceneTitle: base.sceneTitle,
    });

    overrides.push({
      chapter,
      setting,
      goal: narrative.goal,
      conflict: narrative.conflict,
      outcome: narrative.outcome,
      artifactUsageHint: narrative.artifactUsageHint,
      imageMustShowAdd: [settingLabel, encounterLabel, twistLabel],
      imageAvoidAdd: ["extra characters", "looking at camera"],
    });
  }

  return overrides;
}

function buildNarrativeOverride(input: {
  language: string;
  rng: ReturnType<typeof createSeededRandom>;
  encounterLabel: string;
  rescueLabel: string;
  artifactLabel: string;
  twistLabel: string;
  sceneTitle: string;
}): { goal: string; conflict: string; outcome: string; artifactUsageHint: string } {
  const { language, rng, encounterLabel, rescueLabel, artifactLabel, twistLabel, sceneTitle } = input;

  if (language === "de") {
    const goal = rng.pick([
      `In "${sceneTitle}" versuchen die Kinder trotz ${encounterLabel} ihr Ziel zu halten.`,
      `Die Szene startet mit ${encounterLabel}; die Gruppe muss sofort umplanen.`,
      `Der Fokus liegt auf ${encounterLabel}: jemand braucht einen mutigen Gegenzug.`,
    ]);
    const conflict = rng.pick([
      `${encounterLabel} blockiert den einfachen Weg und macht die Entscheidung riskant.`,
      `Durch ${encounterLabel} droht ein klarer Verlust, wenn niemand schnell handelt.`,
      `${encounterLabel} verschiebt die Machtbalance und setzt die Hauptfigur unter Druck.`,
    ]);
    const outcome = rng.pick([
      `Durch ${rescueLabel} kippt die Lage; ${twistLabel} bleibt als neuer Hinweis zurueck.`,
      `${rescueLabel} rettet den Moment, aber ${twistLabel} veraendert die naechste Szene.`,
      `${rescueLabel} bringt einen Vorteil, waehrend ${twistLabel} die Regeln neu setzt.`,
    ]);
    const artifactUsageHint = rng.pick([
      `Artefakt-Einsatz: ${artifactLabel}. Die Wirkung muss sichtbar Folgen fuer die Szene haben.`,
      `Das Artefakt wird so genutzt, dass es ${artifactLabel}; danach veraendert sich die Lage sofort.`,
      `Artefaktregel: ${artifactLabel}. Nicht erwaehnen, sondern als konkrete Aktion zeigen.`,
    ]);
    return { goal, conflict, outcome, artifactUsageHint };
  }

  const goal = rng.pick([
    `In "${sceneTitle}", the children must stay on target despite ${encounterLabel}.`,
    `The scene opens with ${encounterLabel}, forcing an immediate plan change.`,
    `The beat centers on ${encounterLabel}, and someone must make a brave move.`,
  ]);
  const conflict = rng.pick([
    `${encounterLabel} blocks the easy path and turns the next decision risky.`,
    `${encounterLabel} creates a real cost if nobody acts quickly.`,
    `${encounterLabel} shifts control and puts the lead under pressure.`,
  ]);
  const outcome = rng.pick([
    `${rescueLabel} flips the situation, while ${twistLabel} sets up the next beat.`,
    `${rescueLabel} saves the moment, but ${twistLabel} changes what comes next.`,
    `${rescueLabel} buys time, and ${twistLabel} rewrites the plan.`,
  ]);
  const artifactUsageHint = rng.pick([
    `Artifact use: ${artifactLabel}. Show a visible consequence in the scene.`,
    `Use the artifact so it ${artifactLabel}; the situation must change immediately.`,
    `Artifact rule: ${artifactLabel}. Show it as concrete action, not exposition.`,
  ]);
  return { goal, conflict, outcome, artifactUsageHint };
}

function labelVariant(token: string, language: string): string {
  if (language === "de") {
    return VARIANT_LABELS_DE[token] ?? token.replace(/_/g, " ").toLowerCase();
  }
  return token.replace(/_/g, " ").toLowerCase();
}

function shouldApplySettingVariant(setting: string, isClassicTale: boolean): boolean {
  if (!setting) return false;
  if (!isClassicTale) return true;

  const value = setting.toLowerCase();
  const allowed = [
    "wald", "forest", "grove", "lichtung", "clearing",
    "garten", "garden", "wiese", "meadow",
    "berg", "mountain", "gebirge", "cave", "höhle", "hoehle",
    "see", "lake", "meer", "sea", "strand", "beach",
    "insel", "island", "fluss", "river",
  ];

  return allowed.some(token => value.includes(token));
}

const VARIANT_LABELS_DE: Record<string, string> = {
  FOREST_AUTUMN: "Herbstwald",
  FOREST_WINTER: "Winterwald",
  FOREST_FOG: "Nebelwald",
  FOREST_SUNSET: "Wald bei Sonnenuntergang",
  JUNGLE_RUINS: "Dschungelruinen",
  ISLAND_COVE: "Inselbucht",
  DESERT_TEMPLE: "Wüstentempel",
  MOUNTAIN_PASS: "Gebirgspass",
  CRYSTAL_FOREST: "Kristallwald",
  SKY_CASTLE: "Himmelschloss",
  UNDERGROUND_GROVE: "unterirdischer Hain",
  MIST_LAKE: "Nebelsee",
  FOREST_RAIN: "Wald im Regen",
  SAVANNA_DRY: "trockene Savanne",
  OCEAN_REEF: "Ozeanriff",
  MOUNTAIN_SNOW: "Schneebirge",
  ORBITAL_STATION: "Orbitstation",
  MARS_COLONY: "Marskolonie",
  NEBULA_GATE: "Nebel-Pforte",
  UNDERWATER_CITY: "Unterwasserstadt",
  CITY_PARK: "Stadtpark",
  SCHOOL_EVENT: "Schulfest",
  NEIGHBORHOOD_BLOCK: "Wohnviertel",
  MUSEUM_DAY: "Museumstag",
  FLOWERS_DISTRACTION: "Ablenkung durch Blumen",
  RIDDLE_DISTRACTION: "Ablenkung durch ein Rätsel",
  FALSE_MAP: "falsche Karte",
  HELPFUL_STRANGER_ACT: "hilfsbereiter Fremder",
  RIVAL_CREW: "Rivalen-Crew",
  TRAP_MAZE: "Fallenlabyrinth",
  STORM_NIGHT: "Sturmnacht",
  HIDDEN_GUARDIAN: "verborgener Wächter",
  SPELL_GLITCH: "Zauberstörung",
  TRICKSTER_FAIRY: "Schelmenfee",
  RIDDLE_GATE: "Rätsel-Tor",
  CURSED_PATH: "verfluchter Pfad",
  PREDATOR_SHADOW: "Schatten eines Raubtiers",
  LOST_NEST: "verlorenes Nest",
  RIVER_FLOOD: "Flussflut",
  STRANGE_TRACKS: "seltsame Spuren",
  ROGUE_AI: "abtrünnige KI",
  ALIEN_SIGNAL: "Alien-Signal",
  GRAVITY_GLITCH: "Schwerkraft-Störung",
  LOST_DRONE: "verlorene Drohne",
  LOST_ITEM: "verlorener Gegenstand",
  MISUNDERSTANDING: "Missverständnis",
  RIVAL_TEAM: "Rivalen-Team",
  SURPRISE_VISITOR: "Überraschungsbesuch",
  GUIDES_TRUE: "weist den wahren Weg",
  GETS_HIJACKED: "wird gekapert",
  SOLVES_RIDDLE: "löst ein Rätsel",
  WARNS_DANGER: "warnt vor Gefahr",
  REVEALS_MAP: "enthüllt die Karte",
  RESTORES_MAGIC: "stellt Magie wieder her",
  HEALS_WOUND: "heilt eine Wunde",
  CALLS_HELP: "ruft Hilfe",
  TIME_BUFFER: "verschafft Zeit",
  CONNECTS_PEOPLE: "verbindet Menschen",
  HUNTER_RESCUE: "Rettung durch den Jäger",
  GRANDMA_TRICK: "Trick der Großmutter",
  AVATAR_PLAN: "Plan der Avatare",
  TEAMWORK_TRAP: "Teamarbeit-Falle",
  TEAMWORK_RESCUE: "Rettung durch Teamarbeit",
  CLEVER_DECOY: "cleverer Köder",
  HELPER_BRIDGE: "Helfer-Brücke",
  MENTOR_REVEAL: "Enthüllung durch Mentor",
  HELPER_SACRIFICE: "Helfer-Opfer",
  SYSTEM_REBOOT: "System-Neustart",
  FRIEND_APOLOGY: "Entschuldigung eines Freundes",
  NATURE_HELP: "Hilfe der Natur",
  WOLF_LEARNS_LESSON: "der Wolf lernt eine Lektion",
  FAKE_WOLF: "falscher Wolf",
  DOUBLE_BLIND: "doppelter Bluff",
  ARTIFACT_SECRET: "Artefakt-Geheimnis",
  TREASURE_IS_KEY: "der Schatz ist der Schlüssel",
  ALLY_IS_RIVAL: "Verbündeter ist Rivale",
  MAP_REWRITES: "die Karte schreibt sich um",
  CURSE_BREAKS: "der Fluch bricht",
  FALSE_VILLAIN: "falscher Schurke",
  FRIEND_REVEALED: "ein Freund wird enthüllt",
  STORM_CLEARS: "der Sturm legt sich",
  NEW_HOME: "neues Zuhause",
  ALIEN_HELPER: "Alien-Helfer",
  FAKE_ALARM: "falscher Alarm",
  MISTAKE_LEARNT: "aus einem Fehler gelernt",
  NEW_FRIEND: "neuer Freund",
};
