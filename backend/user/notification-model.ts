export type NotificationKind = 'update' | 'audio' | 'character' | 'sharing' | 'tip';

export interface NotificationPreferences {
  updates: boolean;
  audio: boolean;
  characters: boolean;
  sharing: boolean;
  tips: boolean;
}

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  href?: string;
  actionLabel?: string;
  imageUrl?: string;
  profileId?: string;
  pinned: boolean;
  read: boolean;
  archived: boolean;
  managed: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  updates: true, audio: true, characters: true, sharing: true, tips: true,
};

const PREFERENCE_KEYS: Record<NotificationKind, keyof NotificationPreferences> = {
  update: 'updates', audio: 'audio', character: 'characters', sharing: 'sharing', tip: 'tips',
};

export function isNotificationEnabled(kind: NotificationKind, preferences: NotificationPreferences): boolean {
  return preferences[PREFERENCE_KEYS[kind]];
}

export interface NotificationState {
  notification_id: string;
  read_at: Date | null;
  archived: boolean;
}

export function applyNotificationState(
  items: NotificationItem[], states: NotificationState[], readBefore: Date | null,
): NotificationItem[] {
  const byId = new Map(states.map((state) => [state.notification_id, state]));
  return items.map((item) => {
    const state = byId.get(item.id);
    return {
      ...item,
      read: Boolean(state?.read_at) || Boolean(readBefore && new Date(item.createdAt) <= readBefore),
      archived: state?.archived ?? false,
    };
  }).sort((a, b) => Number(b.pinned) - Number(a.pinned)
    || Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id));
}

/** Only routes intended for regular users can be published in announcements. */
export function isAllowedNotificationHref(href: string): boolean {
  if (/\s|\\|[\u0000-\u001f]/.test(href) || !href.startsWith('/') || href.startsWith('//')) return false;
  let path: string;
  try { path = decodeURIComponent(href.split(/[?#]/)[0]); }
  catch { return false; }
  const routes = ['/', '/stories', '/story', '/avatar', '/avatar/create', '/doku', '/doku/create',
    '/spiel', '/quiz', '/settings', '/cosmos', '/cosmos/parent', '/map', '/community'];
  return routes.includes(path) || /^\/(avatar|story-reader|doku-reader|character-life-story)\/[a-zA-Z0-9_-]+$/.test(path);
}
