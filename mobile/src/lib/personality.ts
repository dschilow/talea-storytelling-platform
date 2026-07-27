import type { Avatar } from '@/types/avatar';

/**
 * Personality trait model.
 *
 * Mirrors backend/constants/personalityTraits.ts. The rules that matter:
 *   - Every avatar starts with all 9 base traits at 0.
 *   - A base trait is `{ value, subcategories? }`.
 *   - Subcategories (e.g. `knowledge.history`) exist ONLY once the AI has
 *     awarded points to them — they are never pre-created, so an untouched
 *     avatar shows nine flat rows and no children.
 *   - Every award carries a `description` explaining why it happened; the UI
 *     always shows that reason next to the change.
 *   - Ceilings: knowledge (and any subcategory) 1000, all other base traits 250.
 */

export const BASE_TRAIT_MAX_VALUE = 250;
export const KNOWLEDGE_TRAIT_MAX_VALUE = 1000;
export const SUBCATEGORY_MAX_VALUE = 1000;

export interface TraitDefinition {
  id: string;
  emoji: string;
  labels: { de: string; en: string };
  descriptions: { de: string; en: string };
  maxValue: number;
}

/** The nine base traits, in the canonical display order. */
export const BASE_TRAITS: TraitDefinition[] = [
  {
    id: 'knowledge',
    emoji: '🧠',
    labels: { de: 'Wissen', en: 'Knowledge' },
    descriptions: {
      de: 'Wissensakkumulation in verschiedenen Bereichen',
      en: 'Knowledge accumulation in various areas',
    },
    maxValue: KNOWLEDGE_TRAIT_MAX_VALUE,
  },
  {
    id: 'creativity',
    emoji: '🎨',
    labels: { de: 'Kreativität', en: 'Creativity' },
    descriptions: { de: 'Kreative Problemlösung und Fantasie', en: 'Creative problem solving and imagination' },
    maxValue: BASE_TRAIT_MAX_VALUE,
  },
  {
    id: 'vocabulary',
    emoji: '🔤',
    labels: { de: 'Wortschatz', en: 'Vocabulary' },
    descriptions: { de: 'Sprachlicher Ausdruck und Kommunikation', en: 'Linguistic expression and communication' },
    maxValue: BASE_TRAIT_MAX_VALUE,
  },
  {
    id: 'courage',
    emoji: '🦁',
    labels: { de: 'Mut', en: 'Courage' },
    descriptions: { de: 'Bereitschaft Risiken einzugehen', en: 'Willingness to take risks' },
    maxValue: BASE_TRAIT_MAX_VALUE,
  },
  {
    id: 'curiosity',
    emoji: '🔍',
    labels: { de: 'Neugier', en: 'Curiosity' },
    descriptions: { de: 'Wissensdurst und Entdeckergeist', en: 'Thirst for knowledge and exploration' },
    maxValue: BASE_TRAIT_MAX_VALUE,
  },
  {
    id: 'teamwork',
    emoji: '🤝',
    labels: { de: 'Teamgeist', en: 'Teamwork' },
    descriptions: { de: 'Zusammenarbeit und Kooperation', en: 'Collaboration and cooperation' },
    maxValue: BASE_TRAIT_MAX_VALUE,
  },
  {
    id: 'empathy',
    emoji: '💗',
    labels: { de: 'Empathie', en: 'Empathy' },
    descriptions: { de: 'Mitgefühl und Verständnis für andere', en: 'Compassion and understanding for others' },
    maxValue: BASE_TRAIT_MAX_VALUE,
  },
  {
    id: 'persistence',
    emoji: '🧗',
    labels: { de: 'Ausdauer', en: 'Persistence' },
    descriptions: { de: 'Durchhaltevermögen und Beharrlichkeit', en: 'Endurance and perseverance' },
    maxValue: BASE_TRAIT_MAX_VALUE,
  },
  {
    id: 'logic',
    emoji: '🔢',
    labels: { de: 'Logik', en: 'Logic' },
    descriptions: { de: 'Analytisches Denken und Schlussfolgerung', en: 'Analytical thinking and reasoning' },
    maxValue: BASE_TRAIT_MAX_VALUE,
  },
];

const TRAIT_BY_ID = new Map(BASE_TRAITS.map((trait) => [trait.id, trait]));

/** Known knowledge subcategories get a nice label; unknown ones are humanised. */
const SUBCATEGORY_LABELS: Record<string, { de: string; en: string }> = {
  biology: { de: 'Biologie', en: 'Biology' },
  history: { de: 'Geschichte', en: 'History' },
  physics: { de: 'Physik', en: 'Physics' },
  chemistry: { de: 'Chemie', en: 'Chemistry' },
  geography: { de: 'Geografie', en: 'Geography' },
  astronomy: { de: 'Astronomie', en: 'Astronomy' },
  mathematics: { de: 'Mathematik', en: 'Mathematics' },
  technology: { de: 'Technik', en: 'Technology' },
  nature: { de: 'Natur', en: 'Nature' },
  music: { de: 'Musik', en: 'Music' },
  art: { de: 'Kunst', en: 'Art' },
  sports: { de: 'Sport', en: 'Sports' },
  language: { de: 'Sprache', en: 'Language' },
  culture: { de: 'Kultur', en: 'Culture' },
  animals: { de: 'Tiere', en: 'Animals' },
  space: { de: 'Weltraum', en: 'Space' },
  ocean: { de: 'Ozean', en: 'Ocean' },
  medicine: { de: 'Medizin', en: 'Medicine' },
};

export function subcategoryLabel(key: string, language = 'de'): string {
  const known = SUBCATEGORY_LABELS[key];
  if (known) return language === 'en' ? known.en : known.de;
  // An AI-invented subcategory: turn `deep_sea_life` into `Deep sea life`.
  const humanised = key.replace(/[_-]+/g, ' ').trim();
  return humanised.charAt(0).toUpperCase() + humanised.slice(1);
}

export function traitLabel(traitId: string, language = 'de'): string {
  const definition = TRAIT_BY_ID.get(traitId);
  if (definition) return language === 'en' ? definition.labels.en : definition.labels.de;
  return subcategoryLabel(traitId, language);
}

export function traitEmoji(traitId: string): string {
  return TRAIT_BY_ID.get(traitId)?.emoji ?? '✨';
}

export function traitDescription(traitId: string, language = 'de'): string {
  const definition = TRAIT_BY_ID.get(traitId);
  if (!definition) return '';
  return language === 'en' ? definition.descriptions.en : definition.descriptions.de;
}

export function traitMaxValue(traitId: string): number {
  if (traitId === 'knowledge' || traitId.startsWith('knowledge.')) return KNOWLEDGE_TRAIT_MAX_VALUE;
  return TRAIT_BY_ID.get(traitId)?.maxValue ?? BASE_TRAIT_MAX_VALUE;
}

// ── Normalisation ──────────────────────────────────────────────────────────

export interface TraitSubcategory {
  key: string;
  label: string;
  value: number;
  /** Why the AI awarded this, if the backend recorded a reason. */
  description?: string;
}

export interface TraitView {
  id: string;
  label: string;
  emoji: string;
  description: string;
  value: number;
  maxValue: number;
  /** Present only once the AI has created at least one subcategory. */
  subcategories: TraitSubcategory[];
}

type RawTrait = number | { value?: number; subcategories?: Record<string, number | { value?: number; description?: string }>; description?: string };

/**
 * Reads the avatar's stored traits into a stable view model.
 *
 * The backend has shipped several shapes over time (flat numbers, nested
 * objects, dotted `knowledge.history` keys), so this accepts all of them and
 * always returns the full set of nine base traits — an avatar with no history
 * still renders its nine rows at 0, which is the documented starting state.
 */
export function readTraits(avatar: Pick<Avatar, 'personalityTraits'> | null | undefined, language = 'de'): TraitView[] {
  const raw = (avatar?.personalityTraits ?? {}) as Record<string, RawTrait>;

  const views = new Map<string, TraitView>(
    BASE_TRAITS.map((definition) => [
      definition.id,
      {
        id: definition.id,
        label: language === 'en' ? definition.labels.en : definition.labels.de,
        emoji: definition.emoji,
        description: language === 'en' ? definition.descriptions.en : definition.descriptions.de,
        value: 0,
        maxValue: definition.maxValue,
        subcategories: [],
      },
    ])
  );

  const pushSubcategory = (baseId: string, key: string, value: number, description?: string) => {
    const view = views.get(baseId);
    if (!view || !Number.isFinite(value)) return;
    const existing = view.subcategories.find((entry) => entry.key === key);
    if (existing) {
      existing.value = value;
      if (description) existing.description = description;
      return;
    }
    view.subcategories.push({ key, label: subcategoryLabel(key, language), value, description });
  };

  for (const [key, entry] of Object.entries(raw)) {
    // Dotted form: `knowledge.history: 12`
    if (key.includes('.')) {
      const [baseId, subKey] = key.split('.');
      const value = typeof entry === 'number' ? entry : (entry?.value ?? 0);
      const description = typeof entry === 'object' ? entry?.description : undefined;
      pushSubcategory(baseId, subKey, value, description);
      continue;
    }

    const view = views.get(key);
    if (!view) continue;

    if (typeof entry === 'number') {
      view.value = entry;
      continue;
    }

    view.value = entry?.value ?? 0;

    for (const [subKey, subEntry] of Object.entries(entry?.subcategories ?? {})) {
      const value = typeof subEntry === 'number' ? subEntry : (subEntry?.value ?? 0);
      const description = typeof subEntry === 'object' ? subEntry?.description : undefined;
      pushSubcategory(key, subKey, value, description);
    }
  }

  for (const view of views.values()) {
    view.subcategories.sort((a, b) => b.value - a.value);
    // Knowledge's headline number is the sum of what has actually been learned,
    // matching the backend rollup (base = max(base, sum(subcategories))).
    if (view.id === 'knowledge' && view.subcategories.length > 0) {
      const total = view.subcategories.reduce((sum, entry) => sum + entry.value, 0);
      view.value = Math.max(view.value, total);
    }
  }

  return BASE_TRAITS.map((definition) => views.get(definition.id)!);
}

/** The strongest traits, for compact displays like cards. */
export function getTopTraits(avatar: Pick<Avatar, 'personalityTraits'> | null | undefined, count = 3, language = 'de') {
  return readTraits(avatar, language)
    .filter((trait) => trait.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, count);
}

/**
 * Overall level.
 *
 * Prefers the backend's computed progression when present so the app and the
 * server never disagree; otherwise derives a level from the trait total using
 * the same 40-points-per-level curve the web uses.
 */
export function overallAvatarLevel(avatar: Avatar | null | undefined): number {
  if (avatar?.progression?.overallLevel) return avatar.progression.overallLevel;

  const total = readTraits(avatar).reduce((sum, trait) => sum + trait.value, 0);
  return Math.max(1, Math.floor(total / 40) + 1);
}

/** Sum across all nine base traits — the "experience" number. */
export function totalTraitPoints(avatar: Avatar | null | undefined): number {
  return readTraits(avatar).reduce((sum, trait) => sum + trait.value, 0);
}

export interface TraitChange {
  trait: string;
  label: string;
  emoji: string;
  change: number;
  description?: string;
  subcategory?: string;
}

/**
 * Normalises the `avatarDevelopments` a finished story returns into displayable
 * changes. The `description` is required by the trait contract, so a change
 * without one is still shown but flagged as unexplained rather than dropped.
 */
export function readDevelopments(
  developments: unknown,
  avatarId?: string,
  language = 'de'
): TraitChange[] {
  if (!Array.isArray(developments)) return [];

  const changes: TraitChange[] = [];

  for (const development of developments as Array<Record<string, any>>) {
    if (avatarId && development.avatarId && development.avatarId !== avatarId) continue;

    const entries: Array<Record<string, any>> = Array.isArray(development.changes)
      ? development.changes
      : Array.isArray(development.personalityChanges)
        ? development.personalityChanges
        : Array.isArray(development.traitChanges)
          ? development.traitChanges
          : [];

    for (const entry of entries) {
      const traitId: string = entry.trait ?? entry.traitId ?? entry.id ?? '';
      if (!traitId) continue;

      const change = Number(entry.change ?? entry.delta ?? entry.value ?? 0);
      if (!Number.isFinite(change) || change === 0) continue;

      const [baseId, subKey] = traitId.includes('.') ? traitId.split('.') : [traitId, undefined];

      changes.push({
        trait: baseId,
        subcategory: subKey,
        label: subKey ? `${traitLabel(baseId, language)} · ${subcategoryLabel(subKey, language)}` : traitLabel(baseId, language),
        emoji: traitEmoji(baseId),
        change,
        description: entry.description ?? entry.reason ?? development.description,
      });
    }
  }

  return changes;
}
