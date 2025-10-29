import type {
  StylePresetKey,
  StoryTone,
  StoryPacing,
  PlotHookKey,
} from "./generate";

export type StorySoulKey =
  | "maerchenzauber"
  | "lieder_reime"
  | "wilder_ritt"
  | "traeumerei"
  | "heldenmut"
  | "entdeckergeist";

export type EmotionalFlavorKey =
  | "warmherzigkeit"
  | "lachfreude"
  | "prickeln"
  | "geborgenheit"
  | "uebermut"
  | "staunen"
  | "zusammenhalt";

export type StoryTempoKey = "cozy" | "balanced" | "fast";

export type SpecialIngredientKey =
  | "surprise"
  | "mystery"
  | "transformation"
  | "magic"
  | "trial"
  | "aha";

export interface StoryExperienceContext {
  soul?: StorySoulMeta;
  emotionalFlavors: EmotionalFlavorMeta[];
  tempo?: StoryTempoMeta;
  specialIngredients: SpecialIngredientMeta[];
}

export interface StorySoulMeta {
  key: StorySoulKey;
  label: string;
  description: string;
  storyPromise: string;
  recommendedStylePreset: StylePresetKey;
  recommendedTone: StoryTone;
  defaultSuspense: 0 | 1 | 2 | 3;
  defaultHumor: 0 | 1 | 2 | 3;
  defaultPacing: StoryPacing;
  allowRhymes?: boolean;
}

export interface EmotionalFlavorMeta {
  key: EmotionalFlavorKey;
  label: string;
  description: string;
  effect: string;
}

export interface StoryTempoMeta {
  key: StoryTempoKey;
  label: string;
  description: string;
  pacing: StoryPacing;
}

export interface SpecialIngredientMeta {
  key: SpecialIngredientKey;
  label: string;
  description: string;
  hookHint?: PlotHookKey;
  forcesTwist?: boolean;
  emphasis?: string;
}

const STORY_SOULS: Record<StorySoulKey, StorySoulMeta> = {
  maerchenzauber: {
    key: "maerchenzauber",
    label: "Märchenzauber",
    description: "Zeitlos-magisches \"Es war einmal\"-Gefühl mit einem gemütlichen Spannungsbogen.",
    storyPromise: "Verheißung eines klassischen Märchens voller Wärme und Magie.",
    recommendedStylePreset: "classic_fantasy",
    recommendedTone: "warm",
    defaultSuspense: 1,
    defaultHumor: 1,
    defaultPacing: "slow",
  },
  lieder_reime: {
    key: "lieder_reime",
    label: "Lieder & Reime",
    description: "Rhythmisch und mitreissend wie der Grüsselo – perfekt zum Mitsprechen.",
    storyPromise: "Sanfte Reime, musikalische Sprache und spielerische Wiederholungen.",
    recommendedStylePreset: "rhymed_playful",
    recommendedTone: "mischievous",
    defaultSuspense: 1,
    defaultHumor: 2,
    defaultPacing: "balanced",
    allowRhymes: true,
  },
  wilder_ritt: {
    key: "wilder_ritt",
    label: "Wilder Ritt",
    description: "Actionreicher Wirbelsturm – keine Sekunde Stillstand.",
    storyPromise: "Dynamische Szenen, kleine Cliffhanger und mutige Entscheidungen.",
    recommendedStylePreset: "wild_imaginative",
    recommendedTone: "mischievous",
    defaultSuspense: 2,
    defaultHumor: 2,
    defaultPacing: "fast",
  },
  traeumerei: {
    key: "traeumerei",
    label: "Träumerei",
    description: "Poetisch, sanft und verträumt wie ein Sternenspaziergang.",
    storyPromise: "Schwebende Bilder, ruhige Dialoge und ein leiser Zauber.",
    recommendedStylePreset: "philosophical_warm",
    recommendedTone: "wonder",
    defaultSuspense: 0,
    defaultHumor: 1,
    defaultPacing: "slow",
  },
  heldenmut: {
    key: "heldenmut",
    label: "Heldenmut",
    description: "Epische Kinderabenteuer mit klaren Quests und mutigen Momenten.",
    storyPromise: "Größere Herausforderungen, Teamgeist und triumphale Wendungen.",
    recommendedStylePreset: "adventure_epic",
    recommendedTone: "epic",
    defaultSuspense: 3,
    defaultHumor: 1,
    defaultPacing: "balanced",
  },
  entdeckergeist: {
    key: "entdeckergeist",
    label: "Entdeckergeist",
    description: "Neugier, Rätsel und Wunder an jeder Ecke.",
    storyPromise: "Geheime Orte, Aha-Momente und freundliche Begegnungen.",
    recommendedStylePreset: "imaginative_meta",
    recommendedTone: "wonder",
    defaultSuspense: 2,
    defaultHumor: 1,
    defaultPacing: "balanced",
  },
};

const EMOTIONAL_FLAVORS: Record<EmotionalFlavorKey, EmotionalFlavorMeta> = {
  warmherzigkeit: {
    key: "warmherzigkeit",
    label: "Warmherzigkeit",
    description: "Herzen fühlen sich warm an – Umarmungen, Freundschaft, Nähe.",
    effect: "Hebt warme Dialoge und Fürsorge hervor.",
  },
  lachfreude: {
    key: "lachfreude",
    label: "Lachfreude",
    description: "Der Bauch kitzelt vor Lachen – witzige Szenen und Wortspiele.",
    effect: "Erhöht Humor und spielerische Elemente.",
  },
  prickeln: {
    key: "prickeln",
    label: "Prickeln",
    description: "Ein kleines Herzklopfen – sanfte Spannung, Rätsel, Gänsehaut.",
    effect: "Erhöht sanfte Spannung und Cliffhanger.",
  },
  geborgenheit: {
    key: "geborgenheit",
    label: "Geborgenheit",
    description: "Wie eine kuschelige Decke – sichere Orte, beruhigende Szenen.",
    effect: "Senkt Tempo und stärkt Wohlfühlmomente.",
  },
  uebermut: {
    key: "uebermut",
    label: "Übermut",
    description: "Quatsch & Schelmerei – Spontane Ideen, lustiges Chaos.",
    effect: "Hebt Humor an und sorgt für spritzige Überraschungen.",
  },
  staunen: {
    key: "staunen",
    label: "Staunen",
    description: "Große Augen – magische Details, neue Welten, leuchtende Bilder.",
    effect: "Betont wundervolle, sensorische Beschreibungen.",
  },
  zusammenhalt: {
    key: "zusammenhalt",
    label: "Zusammenhalt",
    description: "Gemeinsam sind wir stark – Teamwork, Freundschaft, Loyalität.",
    effect: "Unterstreicht Kooperation und gemeinsame Lösungen.",
  },
};

const STORY_TEMPOS: Record<StoryTempoKey, StoryTempoMeta> = {
  cozy: {
    key: "cozy",
    label: "Gemütlich",
    description: "Zeit zum Verweilen | ruhige Szenen | viel Atmosphäre.",
    pacing: "slow",
  },
  balanced: {
    key: "balanced",
    label: "Ausgewogen",
    description: "Guter Mix aus Action und Ruhe | perfektes Bilderbuchtiming.",
    pacing: "balanced",
  },
  fast: {
    key: "fast",
    label: "Rasant",
    description: "Ständig Bewegung | viele Wendungen | aufregender Fluss.",
    pacing: "fast",
  },
};

const SPECIAL_INGREDIENTS: Record<SpecialIngredientKey, SpecialIngredientMeta> = {
  surprise: {
    key: "surprise",
    label: "Überraschung",
    description: "Eine unerwartete Wendung mitten in der Geschichte.",
    forcesTwist: true,
    hookHint: "time_glitch",
  },
  mystery: {
    key: "mystery",
    label: "Geheimnis",
    description: "Ein Rätsel, das gelöst werden muss – verborgene Hinweise.",
    hookHint: "secret_door",
  },
  transformation: {
    key: "transformation",
    label: "Verwandlung",
    description: "Etwas oder jemand verändert sich überraschend.",
    hookHint: "friend_turns_foe",
  },
  magic: {
    key: "magic",
    label: "Magie",
    description: "Zauberhafte Momente, glitzernde Funken, geheimnisvolle Kräfte.",
    hookHint: "mysterious_guide",
  },
  trial: {
    key: "trial",
    label: "Mutprobe",
    description: "Eine Herausforderung, die mit Herz und Teamgeist gemeistert wird.",
    hookHint: "moral_choice",
    emphasis: "Mut, Entschlossenheit und Zusammenhalt.",
  },
  aha: {
    key: "aha",
    label: "Aha-Moment",
    description: "Eine wichtige Erkenntnis bringt alles zusammen.",
    hookHint: "lost_map",
    emphasis: "Cleveres Denken und Einsicht.",
  },
};

const clampLevel = (value: number): 0 | 1 | 2 | 3 => {
  if (value <= 0) return 0;
  if (value >= 3) return 3;
  return value as 1 | 2;
};

export function buildStoryExperienceContext(config: {
  storySoul?: StorySoulKey;
  emotionalFlavors?: EmotionalFlavorKey[];
  storyTempo?: StoryTempoKey;
  specialIngredients?: SpecialIngredientKey[];
}): StoryExperienceContext {
  return {
    soul: config.storySoul ? STORY_SOULS[config.storySoul] : undefined,
    emotionalFlavors: (config.emotionalFlavors ?? [])
      .filter((key): key is EmotionalFlavorKey => key in EMOTIONAL_FLAVORS)
      .map((key) => EMOTIONAL_FLAVORS[key]),
    tempo: config.storyTempo ? STORY_TEMPOS[config.storyTempo] : undefined,
    specialIngredients: (config.specialIngredients ?? [])
      .filter((key): key is SpecialIngredientKey => key in SPECIAL_INGREDIENTS)
      .map((key) => SPECIAL_INGREDIENTS[key]),
  };
}

export function applyStoryExperienceToConfig<
  T extends {
    storySoul?: StorySoulKey;
    emotionalFlavors?: EmotionalFlavorKey[];
    storyTempo?: StoryTempoKey;
    specialIngredients?: SpecialIngredientKey[];
    stylePreset?: StylePresetKey;
    allowRhymes?: boolean;
    tone?: StoryTone;
    language?: "de" | "en";
    suspenseLevel?: 0 | 1 | 2 | 3;
    humorLevel?: 0 | 1 | 2 | 3;
    pacing?: StoryPacing;
    hasTwist?: boolean;
    hooks?: PlotHookKey[];
  }
>(config: T): T {
  const result: T = { ...config };
  const context = buildStoryExperienceContext(config);

  if (context.soul) {
    const soul = context.soul;
    result.stylePreset = result.stylePreset ?? soul.recommendedStylePreset;
    if (result.allowRhymes === undefined) {
      result.allowRhymes = soul.allowRhymes ?? false;
    }
    if (!result.tone) {
      result.tone = soul.recommendedTone;
    }
    result.suspenseLevel = result.suspenseLevel ?? soul.defaultSuspense;
    result.humorLevel = result.humorLevel ?? soul.defaultHumor;
    result.pacing = result.pacing ?? soul.defaultPacing;
  } else {
    result.suspenseLevel = result.suspenseLevel ?? 1;
    result.humorLevel = result.humorLevel ?? 1;
    result.pacing = result.pacing ?? "balanced";
    result.tone = result.tone ?? "warm";
    result.allowRhymes = result.allowRhymes ?? false;
  }

  if (context.tempo) {
    result.pacing = context.tempo.pacing;
  }

  for (const flavor of context.emotionalFlavors) {
    switch (flavor.key) {
      case "warmherzigkeit":
        result.tone = "warm";
        result.humorLevel = clampLevel((result.humorLevel ?? 1) + 0);
        break;
      case "lachfreude":
        result.humorLevel = clampLevel((result.humorLevel ?? 1) + 1);
        break;
      case "prickeln":
        result.suspenseLevel = clampLevel((result.suspenseLevel ?? 1) + 1);
        break;
      case "geborgenheit":
        result.pacing = "slow";
        result.suspenseLevel = clampLevel((result.suspenseLevel ?? 1) - 1);
        break;
      case "uebermut":
        result.tone = "mischievous";
        result.humorLevel = clampLevel((result.humorLevel ?? 1) + 2);
        break;
      case "staunen":
        result.tone = "wonder";
        result.suspenseLevel = clampLevel((result.suspenseLevel ?? 1) + 0);
        break;
      case "zusammenhalt":
        // Encourage balanced pacing and warm tone
        if (result.pacing === "fast") {
          result.pacing = "balanced";
        }
        break;
      default:
        break;
    }
  }

  const hooks = new Set<PlotHookKey>(result.hooks ?? []);
  result.hasTwist = result.hasTwist ?? false;

  for (const ingredient of context.specialIngredients) {
    if (ingredient.forcesTwist) {
      result.hasTwist = true;
    }
    if (ingredient.hookHint) {
      hooks.add(ingredient.hookHint);
    }
  }

  result.hooks = Array.from(hooks);

  return result;
}

export function describeEmotionalFlavors(context: StoryExperienceContext): string {
  if (!context.emotionalFlavors.length) {
    return "Keine besondere emotionale Würze ausgewählt – nutze natürliche Herzensmomente.";
  }
  return context.emotionalFlavors
    .map((flavor) => `${flavor.label}: ${flavor.description}`)
    .join("\n");
}

export function describeSpecialIngredients(context: StoryExperienceContext): string {
  if (!context.specialIngredients.length) {
    return "Keine extra Zutaten – klassischer Verlauf ohne Spezialelemente.";
  }
  return context.specialIngredients
    .map((ingredient) => `${ingredient.label}: ${ingredient.description}`)
    .join("\n");
}
