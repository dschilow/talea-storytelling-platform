import { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Headphones, Sparkles, UserRoundPlus, X } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationsContext';
import type { NotificationSummary } from '../../../backend/user/notification-model';
import './NotificationsNotice.css';

function Notice({ userId, summary }: { userId: string; summary: NotificationSummary }) {
  const storageKey = `talea:notifications:dismissed:${userId}`;
  const [dismissedThrough, setDismissedThrough] = useState(() => {
    try { return sessionStorage.getItem(storageKey) ?? ''; }
    catch { return ''; }
  });
  // The generated client revives date strings as Date objects at runtime.
  const latest = summary.latestUnreadAt ? new Date(summary.latestUnreadAt).toISOString() : undefined;
  if (!summary.unreadCount || !latest || Date.parse(latest) <= Date.parse(dismissedThrough || '1970-01-01')) return null;

  const highlights = [
    summary.counts.audio && `${summary.counts.audio} ${summary.counts.audio === 1 ? 'neue Audio-Doku' : 'neue Audio-Dokus'}`,
    summary.counts.character && `${summary.counts.character} ${summary.counts.character === 1 ? 'neuer Charakter' : 'neue Charaktere'}`,
  ].filter(Boolean).join(' · ');
  const Icon = summary.counts.audio ? Headphones : summary.counts.character ? UserRoundPlus : Sparkles;
  function dismiss() {
    setDismissedThrough(latest!);
    try { sessionStorage.setItem(storageKey, latest!); }
    catch { /* The notice can still be dismissed when storage is unavailable. */ }
  }

  return (
    <aside className="notifications-notice" aria-label="Neue Mitteilungen">
      <span className="notifications-notice-icon" aria-hidden="true"><Icon size={26} /></span>
      <div className="notifications-notice-copy" role="status">
        <span className="notifications-notice-eyebrow">NEU IN DEINER TALEA-WELT</span>
        <p>Es gibt etwas Neues!</p>
        <span>{highlights || `${summary.unreadCount} ${summary.unreadCount === 1 ? 'Neuigkeit wartet' : 'Neuigkeiten warten'} auf dich.`}</span>
      </div>
      <Link to="/mitteilungen" onClick={dismiss} className="notifications-notice-action">Zeig mal! <ArrowRight size={17} aria-hidden="true" /></Link>
      <button type="button" className="notifications-notice-dismiss" onClick={dismiss} aria-label="Neuigkeiten-Hinweis für jetzt schließen"><X size={18} /></button>
    </aside>
  );
}

export default function NotificationsNotice() {
  const { user } = useUser();
  const summary = useNotifications()?.summary;
  const { pathname } = useLocation();
  // Keep the notice on browsing pages, outside reading, games and creation flows.
  if (!user || !summary || !['/', '/stories', '/avatar', '/doku', '/community', '/map', '/characters'].includes(pathname)) return null;
  return <Notice key={user.id} userId={user.id} summary={summary} />;
}
