/**
 * CosmosEvolution.ts - The visible evolution ladder of every Lernkosmos planet.
 *
 * The backend awards "Sternenpunkte" (tracking_domain_state.evolution_index):
 * +1 per finished doku/story, +1..3 per quiz, +6 per passed recall and +10..24
 * when a topic reaches a new learning stage. Its planetLevel only rises every
 * 25 points, so a child sits on level 1-5 for weeks. This ladder is tuned to the
 * real point rates instead: almost every learning session moves a planet
 * visibly, and every stage unlocks something new on the planet itself.
 */

import type { CosmosDomain, DomainProgress } from './CosmosTypes';

/** Minimum Sternenpunkte for stage 0..8. */
export const EVOLUTION_THRESHOLDS = [0, 1, 10, 25, 45, 75, 115, 170, 240] as const;
export const MAX_EVOLUTION_STAGE = EVOLUTION_THRESHOLDS.length - 1;

export interface EvolutionStageCopy {
  name: string;
  unlock: string;
}

const BASE_STAGES: EvolutionStageCopy[] = [
  { name: 'Sternenstaub', unlock: 'Hier wartet eine Welt darauf, entdeckt zu werden.' },
  { name: 'Felsbrocken', unlock: 'Aus Sternenstaub ist ein kleiner Planet geworden.' },
  { name: 'Lufthülle', unlock: 'Eine schützende Lufthülle umgibt jetzt den Planeten.' },
  { name: 'Ozeane', unlock: 'Wasser füllt die Täler.' },
  { name: 'Wolken', unlock: 'Die ersten Wolken ziehen auf.' },
  { name: 'Leben', unlock: 'Das Leben breitet sich aus.' },
  { name: 'Lichter', unlock: 'Auf der Nachtseite gehen Lichter an.' },
  { name: 'Ring', unlock: 'Ein glitzernder Ring umkreist den Planeten.' },
  { name: 'Sternenwelt', unlock: 'Polarlichter tanzen über einer echten Sternenwelt!' },
];

/** Stages whose look differs per world get their own words. */
const THEME_STAGES: Record<CosmosDomain['planetType'], Partial<Record<number, EvolutionStageCopy>>> = {
  lush: {
    5: { name: 'Wälder', unlock: 'Wälder und Wiesen breiten sich aus.' },
    6: { name: 'Glühwürmchen', unlock: 'Nachts leuchten Millionen Glühwürmchen.' },
  },
  icy: {
    3: { name: 'Eismeere', unlock: 'Glitzernde Eismeere füllen die Täler.' },
    5: { name: 'Eiskristalle', unlock: 'Leuchtende Eiskristalle wachsen überall.' },
    6: { name: 'Sternwarten', unlock: 'Sternwarten funkeln auf der Nachtseite.' },
  },
  desert: {
    3: { name: 'Oasen', unlock: 'Blaue Oasen entstehen zwischen den Dünen.' },
    5: { name: 'Gärten', unlock: 'Grüne Gärten blühen an den Oasen auf.' },
    6: { name: 'Alte Städte', unlock: 'Alte Städte leuchten in der Nacht.' },
  },
  gaseous: {
    3: { name: 'Kühlseen', unlock: 'Kühlseen glänzen zwischen den Metallplatten.' },
    5: { name: 'Schaltkreise', unlock: 'Schaltkreise ziehen sich über den Planeten.' },
    6: { name: 'Neonlichter', unlock: 'Neonlichter flackern auf der Nachtseite.' },
  },
  terrestrial: {
    3: { name: 'Lebensmeere', unlock: 'Warme Meere füllen die Täler.' },
    5: { name: 'Korallen', unlock: 'Bunte Korallen wachsen an den Küsten.' },
    6: { name: 'Herzschlag', unlock: 'Der Planet leuchtet im Takt eines Herzens.' },
  },
  oceanic: {
    5: { name: 'Wälder', unlock: 'Wälder und Wiesen bedecken die Kontinente.' },
    6: { name: 'Städte', unlock: 'Städte leuchten auf der Nachtseite.' },
  },
  crystalline: {
    3: { name: 'Farbmeere', unlock: 'Schimmernde Farbmeere füllen die Täler.' },
    5: { name: 'Farbkristalle', unlock: 'Regenbogenkristalle wachsen aus dem Boden.' },
    6: { name: 'Funkeln', unlock: 'Die Kristalle funkeln in der Nacht.' },
  },
  volcanic: {
    3: { name: 'Lavaseen', unlock: 'Glühende Lavaseen füllen die Täler.' },
    5: { name: 'Rätselpfade', unlock: 'Leuchtende Rätselpfade ziehen sich durchs Gestein.' },
    6: { name: 'Glutadern', unlock: 'Glutadern leuchten auf der Nachtseite.' },
  },
};

export function getStageCopy(
  stage: number,
  planetType: CosmosDomain['planetType'] | undefined
): EvolutionStageCopy {
  const safeStage = clampStage(stage);
  const override = planetType ? THEME_STAGES[planetType]?.[safeStage] : undefined;
  return override ?? BASE_STAGES[safeStage];
}

export interface PlanetEvolution {
  points: number;
  /** Discrete stage 0..8. */
  stage: number;
  /** Continuous stage (stage + progress inside it); drives the shader. */
  evo: number;
  progressToNext: number;
  pointsToNext: number;
  nextThreshold: number | null;
  current: EvolutionStageCopy;
  next: EvolutionStageCopy | null;
}

/**
 * Sternenpunkte of a domain. Older sessions without a remote cosmos state only
 * know mastery/confidence from personality traits; they get an estimate so the
 * planets still reflect what was learned.
 */
export function evolutionPointsFor(progress: Pick<DomainProgress, 'evolutionIndex' | 'mastery' | 'confidence' | 'topicsExplored'>): number {
  const remote = Number(progress.evolutionIndex);
  let points = Number.isFinite(remote) && remote > 0 ? remote : 0;
  if (points <= 0 && (progress.mastery > 0 || progress.confidence > 0)) {
    points = progress.mastery * 2.2 + progress.confidence * 0.8;
  }
  if (points < 1 && (progress.topicsExplored || 0) > 0) {
    points = 1;
  }
  return Math.max(0, Math.floor(points));
}

export function evoFromPoints(points: number): number {
  if (!Number.isFinite(points) || points < EVOLUTION_THRESHOLDS[1]) return 0;
  for (let stage = MAX_EVOLUTION_STAGE; stage >= 1; stage -= 1) {
    const threshold = EVOLUTION_THRESHOLDS[stage];
    if (points < threshold) continue;
    if (stage === MAX_EVOLUTION_STAGE) return MAX_EVOLUTION_STAGE;
    const span = EVOLUTION_THRESHOLDS[stage + 1] - threshold;
    return stage + Math.min(0.999, (points - threshold) / span);
  }
  return 0;
}

export function computePlanetEvolution(
  progress: Pick<DomainProgress, 'evolutionIndex' | 'mastery' | 'confidence' | 'topicsExplored'>,
  planetType?: CosmosDomain['planetType']
): PlanetEvolution {
  const points = evolutionPointsFor(progress);
  const evo = evoFromPoints(points);
  const stage = Math.floor(evo);
  const nextThreshold = stage < MAX_EVOLUTION_STAGE ? EVOLUTION_THRESHOLDS[stage + 1] : null;
  const progressToNext = nextThreshold === null ? 1 : evo - stage;

  return {
    points,
    stage,
    evo,
    progressToNext,
    pointsToNext: nextThreshold === null ? 0 : Math.max(0, nextThreshold - points),
    nextThreshold,
    current: getStageCopy(stage, planetType),
    next: nextThreshold === null ? null : getStageCopy(stage + 1, planetType),
  };
}

export interface EvolutionFeatures {
  /** 0 = loose stardust, 1 = solid planet. */
  form: number;
  atmosphere: number;
  water: number;
  clouds: number;
  life: number;
  lights: number;
  ring: number;
  aurora: number;
  /** Visual planet radius in scene units. */
  radius: number;
}

/**
 * Every feature fades in around its stage: it starts to show in the second half
 * of the previous stage (anticipation) and is ~90% there when the stage unlocks.
 */
export function featuresFromEvo(evo: number): EvolutionFeatures {
  const feature = (stage: number) => smoothstep(stage - 0.45, stage + 0.1, evo);
  return {
    form: feature(1),
    atmosphere: feature(2),
    water: feature(3),
    clouds: feature(4),
    life: feature(5),
    lights: feature(6),
    ring: feature(7),
    aurora: feature(8),
    radius: 0.75 + Math.min(MAX_EVOLUTION_STAGE, Math.max(0, evo)) * 0.085,
  };
}

/**
 * Earning rules shown to kids, matching backend/avatar/cosmos-mvp-logic.ts.
 * Recalls (+6) are left out: the app has no recall screen yet.
 */
export const STAR_POINT_RULES: Array<{ label: string; points: string }> = [
  { label: 'Doku oder Geschichte', points: '+1' },
  { label: 'Quiz', points: '+1 bis 3' },
  { label: 'Thema eine Stufe weiter', points: '+10 bis 24' },
];

function clampStage(stage: number): number {
  return Math.max(0, Math.min(MAX_EVOLUTION_STAGE, Math.floor(stage)));
}

function smoothstep(min: number, max: number, value: number): number {
  if (value <= min) return 0;
  if (value >= max) return 1;
  const t = (value - min) / (max - min);
  return t * t * (3 - 2 * t);
}
