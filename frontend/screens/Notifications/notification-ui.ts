import { Headphones, Lightbulb, Share2, Sparkles, UserRoundPlus } from 'lucide-react';
import type { NotificationKind, NotificationPreferences } from '../../../backend/user/notification-model';

export const NOTIFICATION_TOPICS: Array<{
  kind: NotificationKind;
  key: keyof NotificationPreferences;
  label: string;
  description: string;
  icon: typeof Sparkles;
}> = [
  { kind: 'update', key: 'updates', label: 'Updates', description: 'Neue Funktionen & Verbesserungen', icon: Sparkles },
  { kind: 'audio', key: 'audio', label: 'Audio-Dokus', description: 'Neue Folgen zum Entdecken', icon: Headphones },
  { kind: 'character', key: 'characters', label: 'Charaktere', description: 'Neue Gesichter in der Talea-Welt', icon: UserRoundPlus },
  { kind: 'sharing', key: 'sharing', label: 'Mit dir geteilt', description: 'Avatare von Familie & Freunden', icon: Share2 },
  { kind: 'tip', key: 'tips', label: 'Tipps & Hinweise', description: 'Ideen für mehr aus Talea', icon: Lightbulb },
];

export function notificationDate(value: string): string {
  const date = new Date(value);
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return 'Gerade eben';
  if (minutes < 60) return `Vor ${minutes} Min.`;
  if (minutes < 24 * 60) return `Vor ${Math.floor(minutes / 60)} Std.`;
  return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

export function notificationGroup(createdAt: string, pinned: boolean): string {
  if (pinned) return 'Im Fokus';
  const date = new Date(createdAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date >= today) return 'Heute';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date >= yesterday) return 'Gestern';
  const week = new Date(today);
  week.setDate(week.getDate() - 7);
  return date >= week ? 'Diese Woche' : 'Früher';
}
