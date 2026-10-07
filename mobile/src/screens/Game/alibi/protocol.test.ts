import { describe, expect, test } from 'bun:test';
import { parseAlibiRequest } from './protocol';

describe('Android game bridge', () => {
  test('permits collection saves but cannot write other app state', () => {
    expect(parseAlibiRequest(JSON.stringify({ type: 'save', id: 1, key: 'talea.alibi.vault.v1', value: '{}' }))).not.toBeNull();
    expect(parseAlibiRequest(JSON.stringify({ type: 'save', id: 1, key: 'clerk-token', value: '{}' }))).toBeNull();
  });
  test('has no arbitrary backend or navigation capability', () => {
    for (const type of ['fetch', 'migration', 'openUrl', 'token']) expect(parseAlibiRequest(JSON.stringify({ type, id: 1 }))).toBeNull();
  });
  test('rejects broken, oversized and invalid playback requests', () => {
    for (const raw of ['null', '{}', '{', 'x'.repeat(2_000_001), '{"type":"characters","id":-1}', '{"type":"vibrate","pattern":-50}']) {
      expect(parseAlibiRequest(raw)).toBeNull();
    }
    expect(parseAlibiRequest(JSON.stringify({ type: 'speak', id: 4, text: 'secret', volume: 'loud', pitch: 1, rate: 1 }))).toBeNull();
  });
  test('requires explicit privacy on both MP3 and fallback speech', () => {
    const speech = { type: 'speak', id: 1, text: 'Geheimnis', pitch: 1, rate: 1, volume: 0.1 };
    const clip = { type: 'audioPlay', id: 2, clip: 'w.remember', volume: 0.1 };
    for (const m of [speech, clip]) {
      expect(parseAlibiRequest(JSON.stringify(m))).toBeNull();
      expect(parseAlibiRequest(JSON.stringify({ ...m, priv: true }))).not.toBeNull();
      expect(parseAlibiRequest(JSON.stringify({ ...m, priv: false }))).not.toBeNull();
    }
  });
  test('native audio can open Unicode game clips but no arbitrary paths', () => {
    for (const clip of ['character.Grünkäppchen.stmt', 'w.remember']) {
      expect(parseAlibiRequest(JSON.stringify({ type: 'audioPlay', id: 1, clip, volume: 0.2, priv: true }))).not.toBeNull();
    }
    for (const clip of ['../secret', 'file:///data/token', 'https://host/a.mp3', 'w/remember', 'w..remember']) {
      expect(parseAlibiRequest(JSON.stringify({ type: 'audioPlay', id: 1, clip, volume: 0.2, priv: true }))).toBeNull();
    }
    expect(parseAlibiRequest(JSON.stringify({ type: 'audioPrivacy', id: 1, on: true }))).not.toBeNull();
    expect(parseAlibiRequest(JSON.stringify({ type: 'audioPrivacy', id: 1, on: 'yes' }))).toBeNull();
  });
});
