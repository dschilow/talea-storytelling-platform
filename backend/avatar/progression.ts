import type { PersonalityTraits } from "./avatar";

export type BaseTraitKey =
  | "knowledge"
  | "creativity"
  | "vocabulary"
  | "courage"
  | "curiosity"
  | "teamwork"
  | "empathy"
  | "persistence"
  | "logic";

export interface ProgressionStats {
  storiesRead: number;
  dokusRead: number;
  memoryCount: number;
}

export interface MasteryTier {
  level: number;
  name: string;
  nameEn: string;
  icon: string;
  minValue: number;
  maxValue: number;
}

export interface TraitMasterySnapshot {
  trait: BaseTraitKey;
  label: string;
  value: number;
  rank: MasteryTier;
  nextRankAt: number | null;
  progressToNext: number;
  displayProgress: number;
}

export interface PerkSnapshot {
  id: string;
  title: string;
  description: string;
  rarity: "core" | "rare" | "epic";
  trait: string;
  requiredValue: number;
  currentValue: number;
  unlocked: boolean;
}

export interface QuestSnapshot {
  id: string;
  title: string;
  description: string;
  reward: string;
  progress: number;
  target: number;
  status: "active" | "completed";
}

export interface AvatarProgressionSummary {
  overallLevel: number;
  headline: string;
  focusTrait: BaseTraitKey;
  traitMastery: TraitMasterySnapshot[];
  perks: PerkSnapshot[];
  quests: QuestSnapshot[];
  stats: ProgressionStats & { completedQuests: number };
  topKnowledgeDomains: Array<{ name: string; value: number }>;
  memoryFocusHint: string;
}

export interface MasteryEvent {
  trait: string;
  traitDisplayName: string;
  oldTier: MasteryTier;
  newTier: MasteryTier;
  newValue: number;
}

export interface PerkUnlockEvent {
  id: string;
  title: string;
  description: string;
  rarity: "core" | "rare" | "epic";
  trait: string;
  requiredValue: number;
  currentValue: number;
}

export interface QuestUnlockEvent {
  id: string;
  title: string;
  reward: string;
}

export interface ProgressionEventResult {
  masteryEvents: MasteryEvent[];
  perkUnlocks: PerkUnlockEvent[];
  questUnlocks: QuestUnlockEvent[];
  progressionSummary: AvatarProgressionSummary;
}

export interface ProgressionInput {
  traits: PersonalityTraits;
  stats: ProgressionStats;
}

export interface PromptMemoryInput {
  storyTitle: string;
  experience?: string;
  emotionalImpact?: "positive" | "negative" | "neutral";
  personalityChanges?: Array<{ trait: string; change: number }>;
}

export interface PromptMemorySnippet {
  title: string;
  summary: string;
  emotionalImpact: "positive" | "negative" | "neutral";
  dominantTraits: string[];
}

type PerkDefinition = {
  id: string;
  title: string;
  description: string;
  rarity: "core" | "rare" | "epic";
  trait: string;
  requiredValue: number;
};

type QuestDefinition = {
  id: string;
  title: string;
  description: string;
  reward: string;
  target: number;
  progress: (context: QuestContext) => number;
};

type QuestContext = {
  traits: PersonalityTraits;
  stats: ProgressionStats;
  knowledgeSubcategories: Record<string, number>;
};

const BASE_TRAIT_KEYS: BaseTraitKey[] = [
  "knowledge",
  "creativity",
  "vocabulary",
  "courage",
  "curiosity",
  "teamwork",
  "empathy",
  "persistence",
  "logic",
];

const TRAIT_LABELS: Record<string, string> = {
  knowledge: "Wissen",
  creativity: "Kreativitaet",
  vocabulary: "Wortschatz",
  courage: "Mut",
  curiosity: "Neugier",
  teamwork: "Teamgeist",
  empathy: "Empathie",
  persistence: "Ausdauer",
  logic: "Logik",
  history: "Geschichte",
  science: "Wissenschaft",
  geography: "Geografie",
  physics: "Physik",
  biology: "Biologie",
  chemistry: "Chemie",
  mathematics: "Mathematik",
  astronomy: "Astronomie",
};

const MASTERY_TIERS: MasteryTier[] = [
  { level: 1, name: "Anfaenger", nameEn: "Beginner", icon: "seed", minValue: 0, maxValue: 20 },
  { level: 2, name: "Lehrling", nameEn: "Apprentice", icon: "leaf", minValue: 21, maxValue: 40 },
  { level: 3, name: "Geselle", nameEn: "Journeyman", icon: "tree", minValue: 41, maxValue: 60 },
  { level: 4, name: "Meister", nameEn: "Master", icon: "star", minValue: 61, maxValue: 80 },
  { level: 5, name: "Legende", nameEn: "Legend", icon: "crown", minValue: 81, maxValue: 110 },
  { level: 6, name: "Veteran", nameEn: "Veteran", icon: "shield", minValue: 111, maxValue: 145 },
  { level: 7, name: "Ikone", nameEn: "Icon", icon: "flame", minValue: 146, maxValue: 190 },
  { level: 8, name: "Mythos", nameEn: "Mythic", icon: "comet", minValue: 191, maxValue: 250 },
  { level: 9, name: "Transzendent", nameEn: "Transcendent", icon: "infinity", minValue: 251, maxValue: 999999 },
];

const PERK_DEFINITIONS: PerkDefinition[] = [
  {
    id: "perk_creative_spark",
    title: "Ideenfunke",
    description: "Kann kreative Loesungswege in neuen Geschichten anstossen.",
    rarity: "core",
    trait: "creativity",
    requiredValue: 35,
  },
  {
    id: "perk_creative_director",
    title: "Szenenregie",
    description: "Erzeugt lebendige Details und starke Bildmomente.",
    rarity: "rare",
    trait: "creativity",
    requiredValue: 90,
  },
  {
    id: "perk_courage_anchor",
    title: "Mutanker",
    description: "Bleibt in schwierigen Kapiteln handlungsfaehig.",
    rarity: "core",
    trait: "courage",
    requiredValue: 35,
  },
  {
    id: "perk_courage_frontline",
    title: "Vorhut",
    description: "Uebernimmt in riskanten Situationen die Initiative.",
    rarity: "rare",
    trait: "courage",
    requiredValue: 90,
  },
  {
    id: "perk_empathy_bridge",
    title: "Herzensbruecke",
    description: "Loest Konflikte durch Verstaendnis und gute Worte.",
    rarity: "core",
    trait: "empathy",
    requiredValue: 35,
  },
  {
    id: "perk_empathy_guardian",
    title: "Gefuehlskompass",
    description: "Erkennt Stimmungen frueh und staerkt Teamdynamik.",
    rarity: "rare",
    trait: "empathy",
    requiredValue: 90,
  },
  {
    id: "perk_logic_solver",
    title: "Raetselloeser",
    description: "Kann komplexe Hinweise in klare Schritte zerlegen.",
    rarity: "core",
    trait: "logic",
    requiredValue: 35,
  },
  {
    id: "perk_logic_architect",
    title: "Planarchitekt",
    description: "Baut robuste Strategien fuer lange Handlungsboegen.",
    rarity: "rare",
    trait: "logic",
    requiredValue: 90,
  },
  {
    id: "perk_team_hub",
    title: "Teamknoten",
    description: "Verbindet Staerken mehrerer Figuren in einer Szene.",
    rarity: "core",
    trait: "teamwork",
    requiredValue: 35,
  },
  {
    id: "perk_team_captain",
    title: "Kapitaenstaktik",
    description: "Fuehrt Gruppen durch wechselnde Herausforderungen.",
    rarity: "rare",
    trait: "teamwork",
    requiredValue: 90,
  },
  {
    id: "perk_knowledge_mapmaker",
    title: "Wissenskarte",
    description: "Verknuepft mehrere Wissensbereiche zu einer Storyspur.",
    rarity: "rare",
    trait: "knowledge",
    requiredValue: 130,
  },
  {
    id: "perk_knowledge_archivist",
    title: "Archivmeister",
    description: "Kann fruehere Lernerfolge in neue Kapitel tragen.",
    rarity: "epic",
    trait: "knowledge",
    requiredValue: 220,
  },
];

const QUEST_DEFINITIONS: QuestDefinition[] = [
  {
    id: "quest_story_pathfinder",
    title: "Story-Pfadfinder",
    description: "Lies mehrere Geschichten und baue narrative Erfahrung auf.",
    reward: "Perk-Paket: Storyfokus",
    target: 12,
    progress: ({ stats }) => stats.storiesRead,
  },
  {
    id: "quest_doku_researcher",
    title: "Doku-Forscher",
    description: "Sammle Wissen aus Dokus und erweitere Themenkompetenz.",
    reward: "Perk-Paket: Wissensfokus",
    target: 8,
    progress: ({ stats }) => stats.dokusRead,
  },
  {
    id: "quest_memory_archivist",
    title: "Erinnerungsarchiv",
    description: "Baue ein belastbares Avatar-Gedaechtnis auf.",
    reward: "Memory-Boost fuer Story-Prompting",
    target: 24,
    progress: ({ stats }) => stats.memoryCount,
  },
  {
    id: "quest_balanced_mind",
    title: "Balance-Meister",
    description: "Entwickle mehrere Kernkompetenzen parallel.",
    reward: "Titel: Vielseitiger Held",
    target: 5,
    progress: ({ traits }) =>
      BASE_TRAIT_KEYS.filter((trait) => trait !== "knowledge")
        .map((trait) => getTraitNumericValue(traits, trait))
        .filter((value) => value >= 60).length,
  },
  {
    id: "quest_knowledge_web",
    title: "Wissensnetz",
    description: "Staerke verschiedene Wissensgebiete statt nur eines.",
    reward: "Titel: Themennavigator",
    target: 4,
    progress: ({ knowledgeSubcategories }) =>
      Object.values(knowledgeSubcategories).filter((value) => value >= 45).length,
  },
  {
    id: "quest_dual_track",
    title: "Duale Reise",
    description: "Halte Story- und Doku-Lernen im Gleichgewicht.",
    reward: "Titel: Weltenverbinder",
    target: 6,
    progress: ({ stats }) => Math.min(stats.storiesRead, stats.dokusRead),
  },
];

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const normalizeNumber = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, value);
};

export function getTraitLabel(trait: string): string {
  if (TRAIT_LABELS[trait]) {
    return TRAIT_LABELS[trait];
  }
  if (trait.startsWith("knowledge.")) {
    const [, subcategory] = trait.split(".");
    if (subcategory && TRAIT_LABELS[subcategory]) {
      return TRAIT_LABELS[subcategory];
    }
    return subcategory || "Wissen";
  }
  return trait;
}

export function getMasteryTier(value: number): MasteryTier {
  const normalized = Math.max(0, value);
  for (let index = MASTERY_TIERS.length - 1; index >= 0; index -= 1) {
    if (normalized >= MASTERY_TIERS[index].minValue) {
      return MASTERY_TIERS[index];
    }
  }
  return MASTERY_TIERS[0];
}

function getNextTier(level: number): MasteryTier | null {
  const tier = MASTERY_TIERS.find((entry) => entry.level === level + 1);
  return tier || null;
}

export function getKnowledgeSubcategoryValues(
  traits: PersonalityTraits
): Record<string, number> {
  const knowledge = traits.knowledge;
  if (!knowledge || typeof knowledge !== "object") {
    return {};
  }

  const subcategoriesRaw = (knowledge as { subcategories?: unknown }).subcategories;
  if (!subcategoriesRaw || typeof subcategoriesRaw !== "object") {
    return {};
  }

  const result: Record<string, number> = {};
  for (const [subcategory, value] of Object.entries(
    subcategoriesRaw as Record<string, unknown>
  )) {
    result[subcategory] = normalizeNumber(value);
  }
  return result;
}

export function getTraitNumericValue(traits: PersonalityTraits, trait: string): number {
  if (trait.startsWith("knowledge.")) {
    const [, subcategory] = trait.split(".");
    if (!subcategory) {
      return 0;
    }
    const subcategories = getKnowledgeSubcategoryValues(traits);
    return subcategories[subcategory] || 0;
  }

  const traitRecord = traits as unknown as Record<string, unknown>;
  const rawValue = traitRecord[trait];
  if (typeof rawValue === "number") {
    return normalizeNumber(rawValue);
  }

  if (rawValue && typeof rawValue === "object") {
    const valueFromObject = normalizeNumber((rawValue as { value?: unknown }).value);
    if (trait !== "knowledge") {
      return valueFromObject;
    }

    const subcategories = (rawValue as { subcategories?: unknown }).subcategories;
    if (!subcategories || typeof subcategories !== "object") {
      return valueFromObject;
    }

    const subcategoryTotal = Object.values(
      subcategories as Record<string, unknown>
    ).reduce<number>((total, entry) => total + normalizeNumber(entry), 0);

    return Math.max(valueFromObject, subcategoryTotal);
  }

  return 0;
}

function getTraitDisplayProgress(trait: BaseTraitKey, value: number): number {
  if (trait === "knowledge") {
    if (value <= 100) {
      return clamp(value, 0, 100);
    }
    const normalized = (Math.log10(value + 10) / Math.log10(1010)) * 100;
    return clamp(Math.round(normalized), 0, 100);
  }

  if (value <= 100) {
    return clamp(Math.round(value), 0, 100);
  }
  const normalized = 100 - 100 / (1 + (value - 100) / 70);
  return clamp(Math.round(normalized), 0, 100);
}

function buildTraitMasterySnapshots(traits: PersonalityTraits): TraitMasterySnapshot[] {
  return BASE_TRAIT_KEYS.map((trait) => {
    const value = getTraitNumericValue(traits, trait);
    const rank = getMasteryTier(value);
    const nextRank = getNextTier(rank.level);

    let progressToNext = 100;
    if (nextRank) {
      const bandWidth = Math.max(1, nextRank.minValue - rank.minValue);
      progressToNext = clamp(
        Math.round(((value - rank.minValue) / bandWidth) * 100),
        0,
        100
      );
    }

    return {
      trait,
      label: getTraitLabel(trait),
      value,
      rank,
      nextRankAt: nextRank ? nextRank.minValue : null,
      progressToNext,
      displayProgress: getTraitDisplayProgress(trait, value),
    };
  });
}

function buildPerkSnapshots(traits: PersonalityTraits): PerkSnapshot[] {
  return PERK_DEFINITIONS.map((definition) => {
    const currentValue = getTraitNumericValue(traits, definition.trait);
    return {
      ...definition,
      currentValue,
      unlocked: currentValue >= definition.requiredValue,
    };
  }).sort((left, right) => {
    if (left.unlocked !== right.unlocked) {
      return left.unlocked ? -1 : 1;
    }
    if (left.currentValue !== right.currentValue) {
      return right.currentValue - left.currentValue;
    }
    return left.requiredValue - right.requiredValue;
  });
}

function buildQuestSnapshots(context: QuestContext): QuestSnapshot[] {
  return QUEST_DEFINITIONS.map((definition) => {
    const rawProgress = definition.progress(context);
    const progress = clamp(Math.round(rawProgress), 0, definition.target);
    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      reward: definition.reward,
      progress,
      target: definition.target,
      status: progress >= definition.target ? "completed" : "active",
    };
  });
}

function getHeadlineForLevel(level: number): string {
  if (level >= 70) return "Transzendente Legende";
  if (level >= 52) return "Mythischer Mentor";
  if (level >= 38) return "Erfahrener Wegweiser";
  if (level >= 26) return "Starker Entdecker";
  if (level >= 14) return "Lernheld";
  return "Neugieriger Start";
}

function getMemoryHint(focusTrait: BaseTraitKey, quests: QuestSnapshot[]): string {
  const activeQuest = quests.find((quest) => quest.status === "active");
  if (activeQuest) {
    return `Naechster Fokus: ${activeQuest.title} (${activeQuest.progress}/${activeQuest.target})`;
  }

  const traitHintMap: Record<BaseTraitKey, string> = {
    knowledge: "Setze auf neue Doku-Themen fuer breiteres Wissen.",
    creativity: "Waehle Geschichten mit offenen Enden fuer mehr Kreativitaet.",
    vocabulary: "Lies Dialog-lastige Kapitel fuer Wortschatz-Zuwachs.",
    courage: "Nutze Abenteuer mit Risiko-Entscheidungen fuer Mut.",
    curiosity: "Folge Mystery- und Forschungsplots fuer Neugier.",
    teamwork: "Waehle Team-Aufgaben in Storys fuer Teamgeist.",
    empathy: "Nutze empathische Perspektiven fuer Gefuehlskompetenz.",
    persistence: "Lange Handlungsboegen staerken Ausdauer.",
    logic: "Raetsel und Problemketten trainieren Logik.",
  };

  return traitHintMap[focusTrait];
}

export function buildAvatarProgressionSummary(input: ProgressionInput): AvatarProgressionSummary {
  const traitMastery = buildTraitMasterySnapshots(input.traits);
  const perks = buildPerkSnapshots(input.traits);
  const knowledgeSubcategories = getKnowledgeSubcategoryValues(input.traits);
  const quests = buildQuestSnapshots({
    traits: input.traits,
    stats: input.stats,
    knowledgeSubcategories,
  });

  const focusTrait =
    [...traitMastery]
      .sort((left, right) => {
        if (left.value !== right.value) return right.value - left.value;
        return right.rank.level - left.rank.level;
      })[0]?.trait || "knowledge";

  const completedQuests = quests.filter((quest) => quest.status === "completed").length;
  const unlockedPerks = perks.filter((perk) => perk.unlocked).length;
  const averageTier =
    traitMastery.reduce((sum, entry) => sum + entry.rank.level, 0) /
    Math.max(1, traitMastery.length);
  const overallLevel = Math.max(
    1,
    Math.round(averageTier * 7 + completedQuests * 3 + unlockedPerks * 0.6)
  );

  const topKnowledgeDomains = Object.entries(knowledgeSubcategories)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([name, value]) => ({
      name: getTraitLabel(name),
      value,
    }));

  return {
    overallLevel,
    headline: getHeadlineForLevel(overallLevel),
    focusTrait,
    traitMastery,
    perks,
    quests,
    stats: {
      ...input.stats,
      completedQuests,
    },
    topKnowledgeDomains,
    memoryFocusHint: getMemoryHint(focusTrait, quests),
  };
}

export function evaluateProgressionEvents(args: {
  previousTraits: PersonalityTraits;
  nextTraits: PersonalityTraits;
  previousStats: ProgressionStats;
  nextStats: ProgressionStats;
}): ProgressionEventResult {
  const previousSummary = buildAvatarProgressionSummary({
    traits: args.previousTraits,
    stats: args.previousStats,
  });
  const nextSummary = buildAvatarProgressionSummary({
    traits: args.nextTraits,
    stats: args.nextStats,
  });

  const previousRanks = new Map(
    previousSummary.traitMastery.map((entry) => [entry.trait, entry.rank])
  );
  const masteryEvents: MasteryEvent[] = nextSummary.traitMastery
    .filter((entry) => {
      const previousRank = previousRanks.get(entry.trait);
      return previousRank ? entry.rank.level > previousRank.level : false;
    })
    .map((entry) => ({
      trait: entry.trait,
      traitDisplayName: entry.label,
      oldTier: previousRanks.get(entry.trait)!,
      newTier: entry.rank,
      newValue: entry.value,
    }));

  const previouslyUnlockedPerks = new Set(
    previousSummary.perks.filter((perk) => perk.unlocked).map((perk) => perk.id)
  );
  const perkUnlocks: PerkUnlockEvent[] = nextSummary.perks
    .filter((perk) => perk.unlocked && !previouslyUnlockedPerks.has(perk.id))
    .map((perk) => ({
      id: perk.id,
      title: perk.title,
      description: perk.description,
      rarity: perk.rarity,
      trait: perk.trait,
      requiredValue: perk.requiredValue,
      currentValue: perk.currentValue,
    }));

  const previouslyCompletedQuests = new Set(
    previousSummary.quests
      .filter((quest) => quest.status === "completed")
      .map((quest) => quest.id)
  );
  const questUnlocks: QuestUnlockEvent[] = nextSummary.quests
    .filter(
      (quest) =>
        quest.status === "completed" && !previouslyCompletedQuests.has(quest.id)
    )
    .map((quest) => ({
      id: quest.id,
      title: quest.title,
      reward: quest.reward,
    }));

  return {
    masteryEvents,
    perkUnlocks,
    questUnlocks,
    progressionSummary: nextSummary,
  };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);
}

function compactSummary(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= 140) {
    return normalized;
  }
  return `${normalized.slice(0, 137).trimEnd()}...`;
}

export function selectRelevantMemoryForPrompt(
  memories: PromptMemoryInput[],
  contextSeed: string
): PromptMemorySnippet | null {
  if (!Array.isArray(memories) || memories.length === 0) {
    return null;
  }

  const seedTokens = new Set(tokenize(contextSeed));
  const scored = memories
    .map((memory) => {
      const source = `${memory.storyTitle} ${memory.experience || ""}`.toLowerCase();
      const memoryTokens = tokenize(source);
      const overlap = memoryTokens.reduce(
        (score, token) => score + (seedTokens.has(token) ? 1 : 0),
        0
      );
      const emotionalBonus = memory.emotionalImpact === "positive" ? 1 : 0;
      const changeBonus = Array.isArray(memory.personalityChanges)
        ? Math.min(2, memory.personalityChanges.length)
        : 0;

      return {
        memory,
        score: overlap * 2 + emotionalBonus + changeBonus,
      };
    })
    .sort((left, right) => right.score - left.score);

  const best = scored[0]?.memory;
  if (!best) {
    return null;
  }

  const dominantTraits = (best.personalityChanges || [])
    .slice()
    .sort((left, right) => Math.abs(right.change) - Math.abs(left.change))
    .slice(0, 2)
    .map((change) => getTraitLabel(change.trait));

  return {
    title: best.storyTitle,
    summary: compactSummary(best.experience || best.storyTitle),
    emotionalImpact: best.emotionalImpact || "neutral",
    dominantTraits,
  };
}
