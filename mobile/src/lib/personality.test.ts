import { describe, expect, test } from 'bun:test';

import {
  BASE_TRAITS,
  overallAvatarLevel,
  readDevelopments,
  readTraits,
  traitMaxValue,
} from './personality';

/**
 * The personality-trait contract.
 *
 * These rules are the product, not an implementation detail, and the backend has
 * shipped several storage shapes for them over time. Locking them down here means
 * a future refactor cannot silently break the thing the whole app is built on.
 *
 * Run with: bun test
 */

describe('a brand-new avatar', () => {
  const traits = readTraits({ personalityTraits: {} } as never);

  test('has all nine base traits', () => {
    expect(traits).toHaveLength(9);
    expect(traits.map((trait) => trait.id)).toEqual(BASE_TRAITS.map((trait) => trait.id));
  });

  test('starts every trait at 0', () => {
    expect(traits.every((trait) => trait.value === 0)).toBe(true);
  });

  test('has no subcategories at all', () => {
    expect(traits.every((trait) => trait.subcategories.length === 0)).toBe(true);
  });
});

describe('a base-trait award (e.g. Ausdauer +3)', () => {
  const traits = readTraits({ personalityTraits: { persistence: { value: 3 } } } as never);
  const persistence = traits.find((trait) => trait.id === 'persistence')!;

  test('raises only that trait', () => {
    expect(persistence.value).toBe(3);
    expect(traits.filter((trait) => trait.id !== 'persistence').every((trait) => trait.value === 0)).toBe(true);
  });

  test('does not invent a subcategory', () => {
    expect(persistence.subcategories).toHaveLength(0);
  });
});

describe('a subcategory award (e.g. Wissen.Geschichte +2)', () => {
  const traits = readTraits({
    personalityTraits: {
      knowledge: { value: 0, subcategories: { history: { value: 2, description: 'Über Ritter gelernt' } } },
    },
  } as never);
  const knowledge = traits.find((trait) => trait.id === 'knowledge')!;

  test('creates exactly one subcategory, and only the awarded one', () => {
    expect(knowledge.subcategories).toHaveLength(1);
    expect(knowledge.subcategories[0].key).toBe('history');
    expect(knowledge.subcategories[0].value).toBe(2);
  });

  test('carries the reason the AI gave', () => {
    expect(knowledge.subcategories[0].description).toBe('Über Ritter gelernt');
  });

  test('labels known subcategories in German', () => {
    expect(knowledge.subcategories[0].label).toBe('Geschichte');
  });

  test('rolls the subcategory total up into the base trait', () => {
    expect(knowledge.value).toBe(2);
  });
});

describe('storage-shape tolerance', () => {
  test('accepts the dotted form the backend also emits', () => {
    const knowledge = readTraits({ personalityTraits: { 'knowledge.physics': 5 } } as never).find(
      (trait) => trait.id === 'knowledge'
    )!;
    expect(knowledge.subcategories[0].key).toBe('physics');
    expect(knowledge.value).toBe(5);
  });

  test('accepts a plain number for a base trait', () => {
    const courage = readTraits({ personalityTraits: { courage: 12 } } as never).find((trait) => trait.id === 'courage')!;
    expect(courage.value).toBe(12);
  });

  test('humanises a subcategory the AI invented', () => {
    const knowledge = readTraits({
      personalityTraits: { knowledge: { value: 0, subcategories: { deep_sea_life: 4 } } },
    } as never).find((trait) => trait.id === 'knowledge')!;
    expect(knowledge.subcategories[0].label).toBe('Deep sea life');
  });
});

describe('ceilings', () => {
  test('knowledge and its subcategories cap at 1000', () => {
    expect(traitMaxValue('knowledge')).toBe(1000);
    expect(traitMaxValue('knowledge.history')).toBe(1000);
  });

  test('every other base trait caps at 250', () => {
    expect(traitMaxValue('courage')).toBe(250);
    expect(traitMaxValue('logic')).toBe(250);
  });
});

describe('story developments', () => {
  const developments = [
    {
      avatarId: 'a1',
      changes: [
        { trait: 'persistence', change: 3, description: 'Hat trotz Rückschlägen weitergemacht' },
        { trait: 'knowledge.history', change: 2, description: 'Hat über Ritter gelernt' },
      ],
    },
  ];

  test('surface the delta and the reason for each change', () => {
    const changes = readDevelopments(developments, 'a1');
    expect(changes).toHaveLength(2);
    expect(changes[0]).toMatchObject({
      label: 'Ausdauer',
      change: 3,
      description: 'Hat trotz Rückschlägen weitergemacht',
    });
  });

  test('name a subcategory change as parent · child', () => {
    const changes = readDevelopments(developments, 'a1');
    expect(changes[1].label).toBe('Wissen · Geschichte');
    expect(changes[1].emoji).toBe('🧠');
  });

  test('only apply to the participating avatar', () => {
    expect(readDevelopments(developments, 'someone-else')).toHaveLength(0);
  });

  test('ignore zero-value and malformed entries', () => {
    expect(readDevelopments([{ avatarId: 'a1', changes: [{ trait: 'courage', change: 0 }] }], 'a1')).toHaveLength(0);
    expect(readDevelopments([{ avatarId: 'a1', changes: [{ change: 5 }] }], 'a1')).toHaveLength(0);
    expect(readDevelopments(null, 'a1')).toHaveLength(0);
  });
});

describe('level', () => {
  test('is 1 for a fresh avatar', () => {
    expect(overallAvatarLevel({ personalityTraits: {} } as never)).toBe(1);
  });

  test('prefers the backend-computed progression when present', () => {
    expect(overallAvatarLevel({ personalityTraits: {}, progression: { overallLevel: 7 } } as never)).toBe(7);
  });
});
