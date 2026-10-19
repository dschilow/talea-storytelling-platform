import { describe, expect, test } from 'bun:test';
import { WEB_ORIGIN, NATIVE_CHANNEL, appUrlForLink, parseNativeRequest } from './protocol';

const request = (action: string, payload = {}, origin = WEB_ORIGIN) => parseNativeRequest(JSON.stringify({ channel: NATIVE_CHANNEL, id: 1, action, payload }), origin);
describe('Android native boundary', () => {
  test('requires the host nonce even when an iframe is reported as the main URL', () => {
    const nonce = 'f2f6a260-59d4-49a9-9986-11c7a275c330';
    const raw = (supplied?: string) => JSON.stringify({ channel: NATIVE_CHANNEL, id: 1, action: 'ready', payload: {}, nonce: supplied });
    expect(parseNativeRequest(raw(), WEB_ORIGIN, nonce)).toBeNull();
    expect(parseNativeRequest(raw('wrong-host-instance'), WEB_ORIGIN, nonce)).toBeNull();
    expect(parseNativeRequest(raw(nonce), WEB_ORIGIN, nonce)).not.toBeNull();
    expect(parseNativeRequest(raw(nonce), 'https://external.example', nonce)).toBeNull();
    expect(parseNativeRequest(raw(''), WEB_ORIGIN, '')).toBeNull();
  });
  test('rejects requests from external pages and lookalike hosts', () => {
    for (const origin of ['https://www.talea.website.evil.test', 'http://www.talea.website', 'https://evil.test', 'file:///index.html', 'https://www.talea.website:444']) expect(request('exit', {}, origin)).toBeNull();
    expect(request('ready')).not.toBeNull();
    expect(request('ready', {}, `${WEB_ORIGIN}/story-reader/123`)).not.toBeNull();
  });
  test('requires explicit privacy and valid numbers for secret playback', () => {
    expect(request('gameAudio', { clip: 'kom.start', private: true, volume: 1 })).not.toBeNull();
    expect(request('gameAudio', { clip: 'figur.käptn-fröhlich.stmt', private: true, volume: 1 })).not.toBeNull();
    expect(request('gameAudio', { clip: '../../other', private: true, volume: 1 })).toBeNull();
    expect(request('gameAudio', { clip: 'kom.start', volume: 1 })).toBeNull();
    expect(request('speech', { text: 'Hallo', pitch: 1, rate: 1, volume: null, private: true })).toBeNull();
    expect(request('speech', { text: 'Hallo', pitch: 1, rate: 1, volume: 1, private: false })).not.toBeNull();
  });
  test('cannot open arbitrary local files or send arbitrary bridge actions', () => {
    expect(request('audioLoad', { generation: 1, url: 'file:///data/user/0/com.talea.app/secret' })).toBeNull();
    expect(request('audioLoad', { generation: 1, url: 'https://audio.example.test/chapter.mp3' })).not.toBeNull();
    expect(request('audioLoad', { generation: 1, url: 'data:audio/mpeg;base64,YWJj' })).not.toBeNull();
    expect(request('eval', { script: '1' })).toBeNull();
    expect(request('file', { name: 'story.pdf', mime: 'application/pdf', base64: 'YWJj' })).not.toBeNull();
    expect(request('file', { name: 'story.pdf', mime: 'application/pdf', base64: '<script>' })).toBeNull();
    expect(parseNativeRequest('null', WEB_ORIGIN)).toBeNull();
    expect(parseNativeRequest('{', WEB_ORIGIN)).toBeNull();
  });
});
describe('all web routes survive Android links', () => {
  test('preserves reader variants, cosmos, admin, topics, query and hash', () => {
    for (const route of ['/story-reader-scroll/a', '/story-reader-old/a', '/cosmos', '/cosmos/parent', '/_admin', '/mitteilungen', '/doku/create?topic=Erde%20%26%20Mond#form']) {
      expect(appUrlForLink(`https://talea.website${route}`)).toBe(`${WEB_ORIGIN}${route}`);
      expect(appUrlForLink(`talea:/${route}`)).toBe(`${WEB_ORIGIN}${route}`);
    }
    expect(appUrlForLink('talea://game')).toBe(`${WEB_ORIGIN}/spiel`);
    expect(appUrlForLink('talea://story-reader/book-1')).toBe(`${WEB_ORIGIN}/story-reader/book-1`);
  });
  test('rejects external URLs and credentials disguised as Talea links', () => {
    for (const url of ['https://evil.test/story', 'https://www.talea.website.evil.test', 'javascript:alert(1)', 'https://user:pass@www.talea.website/story', 'https://www.talea.website:444/story']) expect(appUrlForLink(url)).toBeNull();
  });
});
