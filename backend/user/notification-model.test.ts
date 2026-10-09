import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyNotificationState, DEFAULT_NOTIFICATION_PREFERENCES, isAllowedNotificationHref,
  isNotificationEnabled, type NotificationItem, type NotificationKind,
} from './notification-model';

function item(id: string, createdAt: string, kind: NotificationKind = 'audio'): NotificationItem {
  return { id, kind, createdAt, title: id, body: '', pinned: false, read: false, archived: false, managed: false };
}

describe('notification read state', () => {
  it('keeps entries arriving after the read-all snapshot unread', () => {
    const items = [item('old', '2026-10-08T08:00:00Z'), item('new', '2026-10-08T08:00:01Z')];
    const result = applyNotificationState(items, [], new Date('2026-10-08T08:00:00Z'));
    assert.equal(result.find((entry) => entry.id === 'old')?.read, true);
    assert.equal(result.find((entry) => entry.id === 'new')?.read, false);
  });

  it('applies individual reads and archive state without changing other entries or the source', () => {
    const items = [item('audio:same', '2026-10-08T08:00:00Z'), item('sharing:same', '2026-10-08T08:00:00Z', 'sharing')];
    const result = applyNotificationState(items, [{ notification_id: 'sharing:same', read_at: new Date(), archived: true }], null);
    assert.equal(result.find((entry) => entry.id === 'sharing:same')?.archived, true);
    assert.equal(result.find((entry) => entry.id === 'sharing:same')?.read, true);
    assert.equal(result.find((entry) => entry.id === 'audio:same')?.read, false);
    assert.equal(items[1].read, false);
  });

  it('sorts pinned announcements first, then dates, with a stable tie breaker', () => {
    const pinned = { ...item('pinned', '2026-10-01T08:00:00Z'), pinned: true };
    const result = applyNotificationState([item('b', '2026-10-08T08:00:00Z'), pinned, item('a', '2026-10-08T08:00:00Z')], [], null);
    assert.deepEqual(result.map((entry) => entry.id), ['pinned', 'a', 'b']);
  });
});

describe('notification topics', () => {
  it('disabling one topic leaves all other topics available', () => {
    const preferences = { ...DEFAULT_NOTIFICATION_PREFERENCES, characters: false };
    for (const kind of ['update', 'audio', 'sharing', 'tip'] as const) assert.equal(isNotificationEnabled(kind, preferences), true);
    assert.equal(isNotificationEnabled('character', preferences), false);
  });
});

describe('announcement links', () => {
  it('accepts regular Talea destinations including audio episode links', () => {
    for (const href of ['/', '/settings', '/doku?mode=audio&episode=abc', '/avatar/uuid-123', '/cosmos/parent', '/story-reader/abc']) {
      assert.equal(isAllowedNotificationHref(href), true, href);
    }
  });

  it('rejects external, administrative, malformed and path-traversal destinations', () => {
    for (const href of ['https://example.com', '//example.com', '/\\example.com', 'javascript:alert(1)', '/_admin', '/characters', '/avatar/../_admin', '/avatar/%2e%2e/_admin', '/avatar/%5cexample', '/avatar/%ZZ', '/avatar/a\n', '/doku/not-a-route']) {
      assert.equal(isAllowedNotificationHref(href), false, href);
    }
  });
});
