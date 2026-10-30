// @ts-ignore Bun's test runner is available without a production dependency.
import { describe, expect, test } from 'bun:test';
import type { CastCandidate } from '../storybook/types';
import { castAppearance, speciesFromProfile } from '../storybook/illustration-stage';
import { seriesAvatarReferenceContext, seriesLeadCandidate, seriesLeadReference, seriesReferenceAppearance } from './identity';

const lead = (fields: Partial<CastCandidate> = {}): CastCandidate => ({
  id: 'captain', name: 'Kapitän Blubbert', species: 'human', whoTheyAre: 'ein Kapitän',
  personality: [], speechStyle: [], ...fields,
});

describe('series lead identity follows the canonical pool portrait', () => {
  test('the real public captain appearance survives a conflicting editorial brown-beard outline', () => {
    // Canonical fields from exports/character-pool/2026-10-26; no private avatars or URLs.
    const profile = {
      description: 'Seebaer mit wetterfester Jacke, schiefer Kapitaensmuetze und Muschelkompass.',
      imagePrompt: 'Portrait of Captain Blubbert, old sailor with a white beard, captains hat, pipe, blue striped shirt. Storybook illustration style, maritime theme.',
      species: 'human_sailor',
    };
    const source = lead({ physicalDescription: profile.description, visualProfile: profile });
    const selected = seriesLeadCandidate(source);
    const renderedLook = castAppearance(selected.visualProfile, selected.physicalDescription);
    expect(renderedLook).toContain('white beard');
    expect(renderedLook).toContain('blue striped shirt');
    expect(renderedLook).not.toContain('brown beard');
    expect(selected.visualProfile).toBe(profile);
    expect(source.canLead).toBeUndefined();
    expect(selected.canLead).toBe(true);
  });

  test('a nonhuman pool figure keeps its registered species and visual invariants', () => {
    const source = lead({ species: 'magical_creature', visualProfile: { species: 'dragon', imagePrompt: 'Small golden dragon with tiny wings and long spiked tail.', distinctiveFeatures: ['tiny wings'] } });
    const selected = seriesLeadCandidate(source);
    expect(selected.species).toBe('magical_creature');
    expect(speciesFromProfile(selected.visualProfile, selected.species)).toEqual({ species: 'dragon', isHuman: false });
    expect(selected.visualProfile.distinctiveFeatures).toEqual(['tiny wings']);
  });

  test('an existing physical description also takes precedence when no portrait prompt exists', () => {
    const selected = seriesLeadCandidate(lead({ physicalDescription: 'White-bearded sailor in a blue striped shirt.', visualProfile: { species: 'human' } }));
    expect(castAppearance(selected.visualProfile, selected.physicalDescription)).toContain('White-bearded');
    expect(selected.visualProfile.imagePrompt).toBeUndefined();
  });

  test('an incomplete profile does not invent a second identity from the story outline', () => {
    const selected = seriesLeadCandidate(lead({ visualProfile: { species: 'human', imagePrompt: '', description: ' ' } }));
    expect(castAppearance(selected.visualProfile, selected.physicalDescription)).toBe('');
    expect(selected.visualProfile.species).toBe('human');
  });
  test('the clean series portrait is used only once the frontend serves it as an image', async () => {
    const answer = (type: string, ok = true) => (async () => new Response(null, { status: ok ? 200 : 404, headers: { 'content-type': type } })) as unknown as typeof fetch;
    expect(await seriesLeadReference('tilda-tueftel', answer('image/webp'))).toBe('https://www.talea.website/library/character-series/leads/tilda-tueftel.webp');
    // Before the deploy the single-page app answers every path with its HTML.
    expect(await seriesLeadReference('tilda-tueftel', answer('text/html'))).toBeUndefined();
    expect(await seriesLeadReference('tilda-tueftel', answer('image/webp', false))).toBeUndefined();
    expect(await seriesLeadReference('tilda-tueftel', (async () => { throw new Error('offline'); }) as unknown as typeof fetch)).toBeUndefined();
    expect(await seriesLeadReference('unknown-series', answer('image/webp'))).toBeUndefined();
  });
  test('avatar reference context includes valid scale and stable hair and eye anchors', () => {
    const hero: any = { visualProfile: { ageNumeric: 7, heightCm: 120, hair: { color: 'purple' } } };
    expect(seriesAvatarReferenceContext(hero)).toBe('7 years old, 120 cm tall, purple hair');
    expect(seriesAvatarReferenceContext({ visualProfile: { ageNumeric: -1, heightCm: 10000 } } as any)).toBe('');
    expect(seriesAvatarReferenceContext({ visualProfile: {
      ageNumeric: 8, hair: { color: 'brown', length: 'short', style: 'short', type: 'short' }, eyes: { color: 'green' },
      mustIncludeFeatures: [{ promptDescription: 'very large protruding ears' }],
    } } as any)).toBe('8 years old, short brown hair, green eyes');
    expect(seriesAvatarReferenceContext({ visualProfile: {
      ageNumeric: 5, hair: { color: 'blonde', length: 'short', style: 'short' }, eyes: { color: 'blue' },
    } } as any)).toBe('5 years old, short blonde hair, blue eyes');
    expect(seriesAvatarReferenceContext({ visualProfile: {
      hair: { color: {}, length: 'unknown' }, eyes: { color: 'unknown' },
    } } as any)).toBe('');
  });
  test('portrait props such as a pipe or tools do not enter the series look', () => {
    expect(seriesReferenceAppearance('Tilda Tueftel, nine-year-old girl inventor with curly dark hair, round safety goggles, yellow overalls and colorful tools'))
      .toBe('Tilda Tueftel, nine-year-old girl inventor with curly dark hair, round safety goggles, yellow overalls');
  });
});
