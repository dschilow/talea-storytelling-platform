import { api, APIError } from 'encore.dev/api';
import { SQLDatabase } from 'encore.dev/storage/sqldb';
import { getAuthData } from '~encore/auth';
import { userDB } from './db';
import { ensureAdmin } from '../admin/authz';
import { resolveImageUrlForClient } from '../helpers/bucket-storage';
import {
  applyNotificationState, DEFAULT_NOTIFICATION_PREFERENCES, isAllowedNotificationHref,
  isNotificationEnabled, type NotificationItem, type NotificationKind,
  type NotificationPreferences, type NotificationState,
} from './notification-model';

const avatarDB = SQLDatabase.named('avatar');
const dokuDB = SQLDatabase.named('doku');
const storyDB = SQLDatabase.named('story');

interface AnnouncementRow {
  id: string; kind: NotificationKind; title: string; body: string; href: string | null;
  action_label: string | null; pinned: boolean; published_at: Date;
}

interface PreferencesRow extends NotificationPreferences { read_before: Date | null }

async function preferencesFor(userId: string): Promise<PreferencesRow> {
  return await userDB.queryRow<PreferencesRow>`
    SELECT updates, audio, characters, sharing, tips, read_before
    FROM notification_preferences WHERE user_id = ${userId}
  ` ?? { ...DEFAULT_NOTIFICATION_PREFERENCES, read_before: null };
}

function viewerId(): string {
  const auth = getAuthData();
  if (!auth) throw APIError.unauthenticated('Bitte melde dich an.');
  return auth.userID;
}

function baseItem(id: string, kind: NotificationKind, title: string, body: string, createdAt: Date): NotificationItem {
  return { id, kind, title, body, createdAt: createdAt.toISOString(), pinned: false, read: false, archived: false, managed: false };
}

/** Derive live catalog entries so withdrawn content never leaves stale announcements. */
async function loadFeed(userId: string) {
  const since = new Date(Date.now() - 90 * 86400_000);
  const [preferences, states] = await Promise.all([
    preferencesFor(userId),
    userDB.queryAll<NotificationState>`SELECT notification_id, read_at, archived FROM notification_state WHERE user_id = ${userId}`,
  ]);
  // Keep explicitly handled entries beyond the discovery window, including
  // after restoring an older archived entry to the inbox.
  const retainedAudioIds = states.filter((state) => state.notification_id.startsWith('audio:')).map((state) => state.notification_id.slice(6));
  const retainedCharacterIds = states.filter((state) => state.notification_id.startsWith('character:')).map((state) => state.notification_id.slice(10));
  const [announcements, audio, characters, shares] = await Promise.all([
    userDB.queryAll<AnnouncementRow>`
      SELECT id, kind, title, body, href, action_label, pinned, published_at
      FROM notification_announcements
      WHERE withdrawn_at IS NULL AND published_at <= CURRENT_TIMESTAMP
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `,
    dokuDB.queryAll<{ id: string; title: string; description: string; cover_image_url: string | null; created_at: Date }>`
      SELECT id, title, description, cover_image_url, created_at FROM audio_dokus
      WHERE is_public = TRUE AND audio_url <> '' AND (created_at >= ${since} OR id = ANY(${retainedAudioIds}))
    `,
    storyDB.queryAll<{ id: string; name: string; image_url: string; created_at: Date }>`
      SELECT id, name, image_url, created_at FROM character_pool
      WHERE is_active = TRUE AND image_url IS NOT NULL AND image_url <> '' AND (created_at >= ${since} OR id = ANY(${retainedCharacterIds}))
    `,
    avatarDB.queryAll<{ id: string; owner_user_id: string; copied_avatar_id: string; copied_profile_id: string | null; name: string; image_url: string | null; shared_at: Date }>`
      SELECT s.id, s.owner_user_id, s.copied_avatar_id, a.profile_id AS copied_profile_id, a.name, a.image_url,
             COALESCE(s.last_copied_at, s.created_at) AS shared_at
      FROM avatar_shares s JOIN avatars a ON a.id = s.copied_avatar_id
      WHERE s.target_user_id = ${userId} AND a.user_id = ${userId}
    `,
  ]);
  const senderIds = [...new Set(shares.map((share) => share.owner_user_id))];
  const senders = senderIds.length ? await userDB.queryAll<{ id: string; name: string }>`
    SELECT id, name FROM users WHERE id = ANY(${senderIds})
  ` : [];
  const names = new Map(senders.map((sender) => [sender.id, sender.name]));

  const items: NotificationItem[] = [
    ...announcements.map((row) => ({
      ...baseItem(`news:${row.id}`, row.kind, row.title, row.body, row.published_at),
      href: row.href ?? undefined, actionLabel: row.action_label ?? undefined, pinned: row.pinned, managed: true,
    })),
    ...audio.map((row) => ({
      ...baseItem(`audio:${row.id}`, 'audio', row.title, row.description || 'Eine neue Audio-Doku wartet auf neugierige Ohren.', row.created_at),
      href: `/doku?mode=audio&episode=${encodeURIComponent(row.id)}`, actionLabel: 'Folge entdecken', imageUrl: row.cover_image_url ?? undefined,
    })),
    ...characters.map((row) => ({
      ...baseItem(`character:${row.id}`, 'character', `Dürfen wir vorstellen: ${row.name}`,
        `${row.name} ist neu in der Talea-Welt und kann in euren nächsten Geschichten auftauchen. Starte ein Abenteuer und entdecke neue Begegnungen.`, row.created_at),
      href: '/story', actionLabel: 'Geschichte gestalten', imageUrl: row.image_url,
    })),
    ...shares.map((row) => ({
      ...baseItem(`sharing:${row.id}`, 'sharing', `${row.name} wurde mit dir geteilt`,
        `${names.get(row.owner_user_id) || 'Ein Talea-Mitglied'} hat ${row.name} mit dir geteilt. Deine eigene Kopie ist bereits bei deinen Avataren und bereit für eure Geschichten.`, row.shared_at),
      href: `/avatar/${encodeURIComponent(row.copied_avatar_id)}`, actionLabel: 'Avatar kennenlernen',
      imageUrl: row.image_url ?? undefined, profileId: row.copied_profile_id ?? undefined,
    })),
  ];
  return {
    items: applyNotificationState(items, states, preferences.read_before)
      .filter((item) => isNotificationEnabled(item.kind, preferences)),
    preferences: {
      updates: preferences.updates, audio: preferences.audio, characters: preferences.characters,
      sharing: preferences.sharing, tips: preferences.tips,
    },
  };
}

export interface NotificationSummary {
  unreadCount: number;
  counts: { update: number; audio: number; character: number; sharing: number; tip: number };
  preferences: NotificationPreferences;
}

function summarize(items: NotificationItem[], preferences: NotificationPreferences): NotificationSummary {
  const counts = { update: 0, audio: 0, character: 0, sharing: 0, tip: 0 };
  for (const item of items) if (!item.read && !item.archived) counts[item.kind]++;
  return { unreadCount: Object.values(counts).reduce((sum, count) => sum + count, 0), counts, preferences };
}

export const notificationSummary = api<void, NotificationSummary>(
  { expose: true, method: 'GET', path: '/user/notifications/summary', auth: true },
  async () => {
    const feed = await loadFeed(viewerId());
    return summarize(feed.items, feed.preferences);
  },
);

interface ListNotificationsRequest {
  kind?: NotificationKind; unreadOnly?: boolean; archived?: boolean; q?: string; offset?: number; limit?: number;
}

export interface ListNotificationsResponse extends NotificationSummary {
  items: NotificationItem[]; total: number; hasMore: boolean; asOf: string;
}

export const listNotifications = api<ListNotificationsRequest, ListNotificationsResponse>(
  { expose: true, method: 'GET', path: '/user/notifications', auth: true },
  async (req) => {
    const asOf = new Date().toISOString();
    const feed = await loadFeed(viewerId());
    const q = (req.q ?? '').trim().toLocaleLowerCase('de').slice(0, 200);
    const filtered = feed.items.filter((item) => item.archived === Boolean(req.archived)
      && (!req.kind || item.kind === req.kind) && (!req.unreadOnly || !item.read)
      && (!q || `${item.title} ${item.body}`.toLocaleLowerCase('de').includes(q)));
    const offset = Math.max(0, Math.floor(req.offset ?? 0));
    const limit = Math.max(1, Math.min(50, Math.floor(req.limit ?? 20)));
    const items = await Promise.all(filtered.slice(offset, offset + limit).map(async (item) => ({
      ...item, imageUrl: item.imageUrl ? (await resolveImageUrlForClient(item.imageUrl)) ?? undefined : undefined,
    })));
    return { ...summarize(feed.items, feed.preferences), items, total: filtered.length, hasMore: offset + limit < filtered.length, asOf };
  },
);

interface SetNotificationStateRequest { id: string; read?: boolean; archived?: boolean }
interface SuccessResponse { success: boolean }

export const setNotificationState = api<SetNotificationStateRequest, SuccessResponse>(
  { expose: true, method: 'PATCH', path: '/user/notifications/state', auth: true },
  async (req) => {
    const userId = viewerId();
    const feed = await loadFeed(userId);
    if (!feed.items.some((item) => item.id === req.id)) throw APIError.notFound('Mitteilung nicht gefunden.');
    // Read-before is a watermark. Individual messages can be marked read or archived.
    if (req.read === false) throw APIError.invalidArgument('Einzelne Mitteilungen können als gelesen markiert werden.');
    if (req.read === undefined && req.archived === undefined) throw APIError.invalidArgument('Keine Änderung angegeben.');
    const now = new Date();
    await userDB.exec`
      INSERT INTO notification_state (user_id, notification_id, read_at, archived)
      VALUES (${userId}, ${req.id}, ${req.read || req.archived ? now : null}, ${req.archived ?? false})
      ON CONFLICT (user_id, notification_id) DO UPDATE SET
        read_at = COALESCE(EXCLUDED.read_at, notification_state.read_at),
        archived = COALESCE(${req.archived ?? null}, notification_state.archived)
    `;
    return { success: true };
  },
);

interface MarkNotificationsReadRequest { asOf: string }

export const markNotificationsRead = api<MarkNotificationsReadRequest, SuccessResponse>(
  { expose: true, method: 'POST', path: '/user/notifications/read-all', auth: true },
  async ({ asOf }) => {
    const userId = viewerId();
    const date = new Date(asOf);
    if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now()) throw APIError.invalidArgument('Ungültiger Zeitpunkt.');
    await userDB.exec`
      INSERT INTO notification_preferences (user_id, read_before) VALUES (${userId}, ${date})
      ON CONFLICT (user_id) DO UPDATE SET read_before = GREATEST(notification_preferences.read_before, EXCLUDED.read_before)
    `;
    return { success: true };
  },
);

export const updateNotificationPreferences = api<NotificationPreferences, NotificationPreferences>(
  { expose: true, method: 'PUT', path: '/user/notifications/preferences', auth: true },
  async (req) => {
    const userId = viewerId();
    await userDB.exec`
      INSERT INTO notification_preferences (user_id, updates, audio, characters, sharing, tips)
      VALUES (${userId}, ${req.updates}, ${req.audio}, ${req.characters}, ${req.sharing}, ${req.tips})
      ON CONFLICT (user_id) DO UPDATE SET updates = EXCLUDED.updates, audio = EXCLUDED.audio,
        characters = EXCLUDED.characters, sharing = EXCLUDED.sharing, tips = EXCLUDED.tips
    `;
    return req;
  },
);

interface PublishAnnouncementRequest {
  kind: 'update' | 'audio' | 'character' | 'tip'; title: string; body: string;
  href?: string; actionLabel?: string; pinned?: boolean; expiresAt?: string;
}
interface PublishAnnouncementResponse { id: string }

export const publishAnnouncement = api<PublishAnnouncementRequest, PublishAnnouncementResponse>(
  { expose: true, method: 'POST', path: '/user/notifications/announcements', auth: true },
  async (req) => {
    const { userID } = ensureAdmin();
    const title = req.title.trim();
    const body = req.body.trim();
    const href = req.href?.trim() || null;
    const label = req.actionLabel?.trim() || null;
    if (!title || title.length > 140 || !body || body.length > 3000) throw APIError.invalidArgument('Titel (1–140) und Text (1–3000 Zeichen) sind erforderlich.');
    if (href && (!isAllowedNotificationHref(href) || href.length > 500)) throw APIError.invalidArgument('Bitte verwende einen gültigen Talea-Link.');
    if (label && (!href || label.length > 60)) throw APIError.invalidArgument('Ein Button braucht einen Link und höchstens 60 Zeichen.');
    const expires = req.expiresAt ? new Date(req.expiresAt) : null;
    if (expires && (!Number.isFinite(expires.getTime()) || expires.getTime() <= Date.now())) throw APIError.invalidArgument('Das Ablaufdatum muss in der Zukunft liegen.');
    const id = crypto.randomUUID();
    await userDB.exec`
      INSERT INTO notification_announcements (id, kind, title, body, href, action_label, pinned, created_by, expires_at)
      VALUES (${id}, ${req.kind}, ${title}, ${body}, ${href}, ${href ? label || 'Mehr erfahren' : null}, ${req.pinned ?? false}, ${userID}, ${expires})
    `;
    return { id };
  },
);

interface DeleteAnnouncementRequest { id: string }
export const deleteAnnouncement = api<DeleteAnnouncementRequest, SuccessResponse>(
  { expose: true, method: 'DELETE', path: '/user/notifications/announcements/:id', auth: true },
  async ({ id }) => {
    ensureAdmin();
    // Keep a tombstone so the startup seed cannot republish a withdrawn notice.
    await userDB.exec`UPDATE notification_announcements SET withdrawn_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
    return { success: true };
  },
);
