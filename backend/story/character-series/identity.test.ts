// @ts-ignore Bun's test runner is available without a production dependency.
import { describe, expect, test } from 'bun:test';
import type { CastCandidate } from '../storybook/types';
import { castAppearance, speciesFromProfile } from '../storybook/illustration-stage';
import { seriesLeadCandidate } from './identity';

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
});
