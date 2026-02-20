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
  const classic = options?.isClassicTale ?? false;

  const settingLabel = labelVariant(variantChoices.settingVariant, language);
  const encounterLabelRaw = labelVariant(variantChoices.encounterVariant, language);
  const artifactLabel = labelVariant(variantChoices.artifactFunctionVariant, language);
  const rescueLabelRaw = labelVariant(variantChoices.rescueVariant, language);
  const twistLabelRaw = labelVariant(variantChoices.twistVariant, language);
  const encounterLabel = classic
    ? adaptClassicFairyLabel({
      token: variantChoices.encounterVariant,
      label: encounterLabelRaw,
      kind: "encounter",
      language,
    })
    : encounterLabelRaw;
  const rescueLabel = classic
    ? adaptClassicFairyLabel({
      token: variantChoices.rescueVariant,
      label: rescueLabelRaw,
      kind: "rescue",
      language,
    })
    : rescueLabelRaw;
  const twistLabel = classic
    ? adaptClassicFairyLabel({
      token: variantChoices.twistVariant,
      label: twistLabelRaw,
      kind: "twist",
      language,
    })
    : twistLabelRaw;

  const allChapters = scenes.map(s => s.sceneNumber);
  const sampledOverrideChapters = rng.shuffle([...allChapters]).slice(0, Math.min(3, scenes.length));
  // Classic tales tend to carry legacy scene summaries (e.g. cat/king phrasing).
  // Override narrative goals/conflicts/outcomes for ALL chapters to keep cast-consistent beats.
  const narrativeOverrideChapters = classic ? allChapters : sampledOverrideChapters;
  // Setting variants stay sparse for classic tales to preserve recognizable fairy-tale locations.
  const settingOverrideChapters = classic
    ? new Set(rng.shuffle([...allChapters]).slice(0, 1))
    : new Set(sampledOverrideChapters);

  // Deduplicate adjacent settings: if beat N and N+1 share the same base setting,
  // skip the setting override for the second one so they don't feel repetitive.
  const usedSettings = new Set<string>();

  for (const chapter of narrativeOverrideChapters) {
    const base = scenes.find(s => s.sceneNumber === chapter);
    if (!base) continue;

    const allowSettingOverride = settingOverrideChapters.has(chapter) && shouldApplySettingVariant(base.setting, classic);
    let setting = allowSettingOverride ? `${base.setting}, ${settingLabel}` : base.setting;

    // If this exact setting was already used by a previous override, fall back to base
    const settingKey = setting.toLowerCase().trim();
    if (usedSettings.has(settingKey) && allowSettingOverride) {
      setting = base.setting;
    }
    usedSettings.add(setting.toLowerCase().trim());
    const narrative = buildNarrativeOverride({
      language,
      rng,
      encounterLabel,
      rescueLabel,
      artifactLabel,
      twistLabel,
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
}): { goal: string; conflict: string; outcome: string; artifactUsageHint: string } {
  const { language, rng, encounterLabel, rescueLabel, artifactLabel, twistLabel } = input;

  if (language === "de") {
    const goal = rng.pick([
      `Die Kinder wollen trotz ${encounterLabel} den naechsten Hinweis erreichen.`,
      `Wegen ${encounterLabel} muss die Gruppe ihren Plan in wenigen Minuten neu ordnen.`,
      `Jemand geht voran, damit ${encounterLabel} die Gruppe nicht vom Ziel trennt.`,
    ]);
    const conflict = rng.pick([
      `${encounterLabel} sperrt den direkten Weg; wenn sie zoegern, verlieren sie Zeit und Spur.`,
      `Durch ${encounterLabel} droht ein klarer Preis: Karte, Mut oder Zusammenhalt gehen verloren.`,
      `${encounterLabel} zwingt die Hauptfigur zu einer riskanten Entscheidung ohne sichere Hilfe.`,
    ]);
    const outcome = rng.pick([
      `${rescueLabel} bringt die Gruppe knapp durch die Krise, doch ${twistLabel} oeffnet das naechste Problem.`,
      `Mit ${rescueLabel} retten sie den Moment, aber ${twistLabel} macht den alten Plan unbrauchbar.`,
      `${rescueLabel} sichert einen kleinen Sieg; der Preis zeigt sich sofort durch ${twistLabel}.`,
    ]);
    const artifactUsageHint = rng.pick([
      `Artefakt-Aktion: ${artifactLabel}. Das Artefakt loest eine sichtbare Veraenderung aus (Licht, Geraeusch, Bewegung oder Spur).`,
      `Artefakt-Aktion: ${artifactLabel}. Zeige eine konkrete Handlung mit direkter Folge im Raum.`,
      `Artefakt-Aktion: ${artifactLabel}. Nicht erklaeren, sondern tun: einsetzen, Reaktion, Ergebnis.`,
    ]);
    return { goal, conflict, outcome, artifactUsageHint };
  }

  const goal = rng.pick([
    `The children must reach the next clue despite ${encounterLabel}.`,
    `${encounterLabel} forces the group to rework the plan within minutes.`,
    `Someone has to lead so ${encounterLabel} does not split the group from their goal.`,
  ]);
  const conflict = rng.pick([
    `${encounterLabel} blocks the direct path; if they hesitate, they lose time and trail.`,
    `${encounterLabel} creates a clear price: map, courage, or trust may be lost.`,
    `${encounterLabel} forces the lead into a risky decision without safe backup.`,
  ]);
  const outcome = rng.pick([
    `${rescueLabel} pulls them through the crisis, but ${twistLabel} opens the next problem.`,
    `${rescueLabel} saves the moment, yet ${twistLabel} makes the old plan unusable.`,
    `${rescueLabel} secures a small win; the price appears immediately through ${twistLabel}.`,
  ]);
  const artifactUsageHint = rng.pick([
    `Artifact action: ${artifactLabel}. Show a visible change in the scene (light, sound, movement, or trace).`,
    `Artifact action: ${artifactLabel}. Show one concrete use with an immediate effect in the environment.`,
    `Artifact action: ${artifactLabel}. No exposition: use it, show reaction, show result.`,
  ]);
  return { goal, conflict, outcome, artifactUsageHint };
}

function labelVariant(token: string, language: string): string {
  if (language === "de") {
    return VARIANT_LABELS_DE[token] ?? token.replace(/_/g, " ").toLowerCase();
  }
  return token.replace(/_/g, " ").toLowerCase();
}

function adaptClassicFairyLabel(input: {
  token: string;
  label: string;
  kind: "encounter" | "rescue" | "twist";
  language: string;
}): string {
  const { token, label, kind, language } = input;
  const isDE = language === "de";

  const encounterMapDE: Record<string, string> = {
    FLOWERS_DISTRACTION: "eine verlockende Ablenkung",
    RIDDLE_DISTRACTION: "eine knifflige Ablenkung",
    FALSE_MAP: "eine irreführende Spur",
    HELPFUL_STRANGER_ACT: "eine unerwartete Begegnung",
  };
  const rescueMapDE: Record<string, string> = {
    HUNTER_RESCUE: "Hilfe im letzten Moment",
    GRANDMA_TRICK: "ein cleverer Haus-Trick",
    AVATAR_PLAN: "ein Plan der Kinder",
    TEAMWORK_TRAP: "eine Teamarbeit-Falle",
  };
  const twistMapDE: Record<string, string> = {
    WOLF_LEARNS_LESSON: "jemand lernt eine Lektion",
    FAKE_WOLF: "ein falscher Verdacht",
    DOUBLE_BLIND: "ein doppelter Bluff",
    ARTIFACT_SECRET: "ein Artefakt-Geheimnis",
  };

  const encounterMapEN: Record<string, string> = {
    FLOWERS_DISTRACTION: "a tempting distraction",
    RIDDLE_DISTRACTION: "a tricky distraction",
    FALSE_MAP: "a misleading clue",
    HELPFUL_STRANGER_ACT: "an unexpected encounter",
  };
  const rescueMapEN: Record<string, string> = {
    HUNTER_RESCUE: "last-minute help",
    GRANDMA_TRICK: "a clever household trick",
    AVATAR_PLAN: "a child-led plan",
    TEAMWORK_TRAP: "a teamwork trap",
  };
  const twistMapEN: Record<string, string> = {
    WOLF_LEARNS_LESSON: "someone learns a lesson",
    FAKE_WOLF: "a false suspicion",
    DOUBLE_BLIND: "a double bluff",
    ARTIFACT_SECRET: "an artifact secret",
  };

  if (kind === "encounter") {
    return isDE ? (encounterMapDE[token] ?? label) : (encounterMapEN[token] ?? label);
  }
  if (kind === "rescue") {
    return isDE ? (rescueMapDE[token] ?? label) : (rescueMapEN[token] ?? label);
  }
  return isDE ? (twistMapDE[token] ?? label) : (twistMapEN[token] ?? label);
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
