// @ts-ignore Bun test helpers are runtime-only.
import { describe, expect, test } from 'bun:test';
import { DEFAULT_AVATAR_FORM_DATA, formDataToDescription, formDataToVisualProfile, mergeVisualProfileForEditor } from './avatarForm';

describe('plush avatar profile', () => {
  test('keeps toy identity without invented human or animal anatomy', () => {
    const form = { ...DEFAULT_AVATAR_FORM_DATA, characterType: 'plush' as const, additionalDescription: 'mit rotem Schal' };
    const profile = formDataToVisualProfile(form);
    expect(profile.characterType).toBe('stuffed toy');
    expect(profile.speciesCategory).toBe('object');
    expect(profile.locomotion).toBe('other');
    expect(profile.consistentDescriptors.join(' ')).not.toMatch(/human|quadruped|tail/);
    expect(formDataToDescription(form)).toContain('mit rotem Schal');
    const edited = mergeVisualProfileForEditor({ characterType: 'human', speciesCategory: 'human', forbiddenFeatures: ['animal ears'], consistentDescriptors: ['human child'] }, form, new Set(['characterType']));
    expect(edited.characterType).toBe('stuffed toy');
    expect(edited.forbiddenFeatures).toBeUndefined();
    expect(edited.consistentDescriptors).not.toContain('human child');
  });
});
