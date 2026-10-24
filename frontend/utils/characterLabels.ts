// The character pool stores roles and archetypes as internal English slugs
// ("support", "trickster_witch"). Families must only ever see German words.

const ROLE_LABELS: Record<string, string> = {
  protagonist: 'Hauptfigur',
  hero: 'Heldenfigur',
  antagonist: 'Gegenspieler',
  villain: 'Gegenspieler',
  support: 'Nebenfigur',
  supporting: 'Nebenfigur',
  sidekick: 'Begleiter',
  companion: 'Begleiter',
  guide: 'Wegweiser',
  mentor: 'Mentor',
  helper: 'Helfer',
  special: 'Besondere Figur',
  obstacle: 'Herausforderung',
  discovery: 'Entdeckerfigur',
  trickster: 'Schelm',
  comic_relief: 'Spaßvogel',
  dreamer: 'Träumer',
  literalist: 'Wortklauber',
  fusspot: 'Pedant',
  chaos: 'Chaosstifter',
  schemer: 'Pläneschmied',
  grump: 'Griesgram',
  coward: 'Angsthase',
  boaster: 'Angeber',
  writer: 'Geschichtenschreiber',
  recurring: 'Wiederkehrende Figur',
  creature: 'Fabelwesen',
};

const slugKey = (value: string) => value.trim().toLowerCase().replace(/[\s-]+/g, '_');

/** German label for a pool role; undefined for an unknown internal slug (never show it raw). */
export function characterRoleLabel(role?: string | null): string | undefined {
  if (!role?.trim()) return undefined;
  const key = slugKey(role);
  if (ROLE_LABELS[key]) return ROLE_LABELS[key];
  return /^[a-z_]+$/.test(key) && !/[A-ZÄÖÜ]/.test(role.trim()[0]) ? undefined : role.trim();
}

/** Archetypes are only shown when someone wrote them as words, not as a slug. */
export function characterArchetypeLabel(archetype?: string | null): string | undefined {
  if (!archetype?.trim()) return undefined;
  const value = archetype.trim();
  if (/_/.test(value) || /^[a-z]+$/.test(value) || /^[A-Z]+$/.test(value)) return characterRoleLabel(value);
  return value;
}

const GERMAN_HINT = /[äöüß]|\b(und|der|die|das|ist|mit|ein|eine|nicht|sie|er|auf|für)\b/gi;
const ENGLISH_HINT = /\b(the|and|with|is|of|her|his|who|she|he|for|an)\b/gi;

function looksGerman(text: string): boolean {
  return (text.match(GERMAN_HINT)?.length ?? 0) >= (text.match(ENGLISH_HINT)?.length ?? 0);
}

/**
 * The pool contains some figures twice (an older English or picture-less entry
 * next to the finished German one). Keep one card per name: the one with a
 * picture and German text wins.
 */
export function dedupeCharactersByName<T extends { name: string; imageUrl?: string }>(
  characters: T[],
  describe: (character: T) => string,
): T[] {
  const best = new Map<string, { character: T; score: number }>();
  for (const character of characters) {
    const key = character.name.trim().toLocaleLowerCase('de');
    const text = describe(character) || '';
    const score = (character.imageUrl ? 4 : 0) + (text && looksGerman(text) ? 2 : 0) + Math.min(1, text.length / 400);
    const current = best.get(key);
    if (!current || score > current.score) best.set(key, { character, score });
  }
  return [...best.values()].map(entry => entry.character);
}
