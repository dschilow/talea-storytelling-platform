import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Archive, ArchiveRestore, ArrowUpRight, Bell, BellOff, Check, CheckCheck,
  ChevronDown, Inbox, LoaderCircle, MailCheck, Pin, Plus, RefreshCw, Search, SlidersHorizontal, Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useBackend } from '@/hooks/useBackend';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useOptionalUserAccess } from '@/contexts/UserAccessContext';
import { useOptionalChildProfiles } from '@/contexts/ChildProfilesContext';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { NotificationItem, NotificationKind, NotificationPreferences } from '../../../backend/user/notification-model';
import type { ListNotificationsResponse } from '../../../backend/user/notifications';
import { NOTIFICATION_TOPICS, notificationDate, notificationGroup } from './notification-ui';
import AnnouncementComposer from './AnnouncementComposer';
import './NotificationsScreen.css';

function PreferencesPanel({ preferences, busy, onChange }: {
  preferences: NotificationPreferences | undefined;
  busy: boolean;
  onChange: (key: keyof NotificationPreferences, enabled: boolean) => void;
}) {
  const idPrefix = useId();
  return (
    <div className="notification-preferences">
      <div className="notification-panel-heading"><SlidersHorizontal size={18} /><h2>Deine Themen</h2></div>
      <p className="notification-caption">Du entscheidest, was in deinem Eingang landet.</p>
      <div className="notification-preference-list">
        {NOTIFICATION_TOPICS.map(({ kind, key, label, description, icon: Icon }) => (
          <div className="notification-preference-row" key={key}>
            <span className={`notification-small-icon notification-kind-${kind}`}><Icon size={17} /></span>
            <div><span id={`${idPrefix}-${key}`}>{label}</span><p>{description}</p></div>
            <button type="button" role="switch" aria-checked={preferences?.[key] ?? true}
              aria-labelledby={`${idPrefix}-${key}`} disabled={busy || !preferences}
              className="notification-switch" onClick={() => onChange(key, !preferences?.[key])}>
              <span />
            </button>
          </div>
        ))}
      </div>
      <div className="notification-preference-note"><Bell size={14} /><span>Diese Auswahl gilt für Mitteilungen in Talea.</span></div>
    </div>
  );
}

function NotificationCard({ item, busy, isAdmin, onRead, onArchive, onOpen, onDelete }: {
  item: NotificationItem; busy: boolean; isAdmin: boolean;
  onRead: () => void; onArchive: () => void; onOpen: () => void; onDelete: () => void;
}) {
  const topic = NOTIFICATION_TOPICS.find((entry) => entry.kind === item.kind)!;
  const Icon = topic.icon;
  const [imageFailed, setImageFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  return (
    <article className={`notification-card notification-kind-${item.kind} ${item.read ? '' : 'is-unread'}`} aria-label={`${item.title}${item.read ? '' : ', ungelesen'}`}>
      <div className="notification-card-visual" aria-hidden="true">
        {item.imageUrl && !imageFailed ? <img src={item.imageUrl} alt="" loading="lazy" onError={() => setImageFailed(true)} /> : <Icon size={27} strokeWidth={1.5} />}
      </div>
      <div className="notification-card-content">
        <div className="notification-card-meta">
          <span className="notification-topic">{topic.label}</span>
          <span className="notification-meta-dot" aria-hidden="true">·</span>
          <time dateTime={new Date(item.createdAt).toISOString()} title={new Date(item.createdAt).toLocaleString('de-DE')}>{notificationDate(item.createdAt)}</time>
          {item.pinned && <span className="notification-pin"><Pin size={11} /> Im Fokus</span>}
          {!item.read && <span className="notification-unread-label"><span /> Neu</span>}
        </div>
        <h3>{item.title}</h3>
        <p className={`notification-card-body${item.body.length > 300 && !expanded ? ' is-collapsed' : ''}`}>{item.body}</p>
        {item.body.length > 300 && <button type="button" className="notification-expand" aria-expanded={expanded} disabled={busy} onClick={() => { setExpanded(!expanded); if (!expanded && !item.read) onRead(); }}>{expanded ? 'Weniger anzeigen' : 'Weiterlesen'}</button>}
        <div className="notification-card-footer">
          {item.href && <button type="button" className="notification-action" disabled={busy} onClick={onOpen}>{item.actionLabel || 'Mehr erfahren'}<ArrowUpRight size={16} /></button>}
          <div className="notification-card-tools">
            {item.read ? <span className="notification-read-label"><Check size={14} /> Gelesen</span> : (
              <button type="button" className="notification-tool" disabled={busy} onClick={onRead} aria-label={`„${item.title}“ als gelesen markieren`} title="Als gelesen markieren"><CheckCheck size={17} /><span>Gelesen</span></button>
            )}
            <button type="button" className="notification-tool notification-icon-button" disabled={busy} onClick={onArchive}
              aria-label={`${item.archived ? 'Wiederherstellen' : 'Archivieren'}: ${item.title}`} title={item.archived ? 'Zurück in den Eingang' : 'Archivieren'}>
              {item.archived ? <ArchiveRestore size={17} /> : <Archive size={17} />}
            </button>
            {isAdmin && item.managed && <button type="button" className="notification-tool notification-icon-button" disabled={busy} onClick={onDelete} aria-label={`Für alle entfernen: ${item.title}`} title="Für alle entfernen"><Trash2 size={16} /></button>}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function NotificationsScreen() {
  const backend = useBackend();
  const notifications = useNotifications();
  const updateSummary = notifications?.updateSummary;
  const refreshSummary = notifications?.refresh;
  const navigate = useNavigate();
  const profiles = useOptionalChildProfiles();
  const { isAdmin } = useOptionalUserAccess();
  const reducedMotion = useReducedMotion();
  const [feed, setFeed] = useState<ListNotificationsResponse | null>(null);
  const [kind, setKind] = useState<NotificationKind | undefined>();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [archived, setArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NotificationItem | null>(null);
  const requestVersion = useRef(0);
  const preferences = notifications?.summary?.preferences ?? feed?.preferences;
  const summary = notifications?.summary ?? feed;

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async (quiet = false) => {
    const version = ++requestVersion.current;
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const next = await backend.user.listNotifications({ kind, unreadOnly, archived, q: query, limit: 20 });
      if (version !== requestVersion.current) return;
      setFeed(next);
      updateSummary?.(next);
    } catch {
      if (version === requestVersion.current) setError('Deine Mitteilungen konnten gerade nicht geladen werden. Bitte versuche es erneut.');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [backend, kind, unreadOnly, archived, query, updateSummary]);

  useEffect(() => {
    setFeed(null);
    setLoadingMore(false);
    void load();
    return () => { requestVersion.current++; };
  }, [load]);

  async function loadMore() {
    if (!feed || loadingMore || loading) return;
    const version = requestVersion.current;
    setLoadingMore(true);
    try {
      const next = await backend.user.listNotifications({ kind, unreadOnly, archived, q: query, offset: feed.items.length, limit: 20 });
      if (version !== requestVersion.current) return;
      setFeed((current) => current ? { ...next, items: [...current.items, ...next.items.filter((item) => !current.items.some((old) => old.id === item.id))] } : next);
      updateSummary?.(next);
    } catch { toast.error('Weitere Mitteilungen konnten nicht geladen werden.'); }
    finally { if (version === requestVersion.current) setLoadingMore(false); }
  }

  async function mutate(action: () => Promise<unknown>, success?: string) {
    setBusy(true);
    try {
      await action();
      if (success) toast.success(success);
      await load(true);
      return true;
    } catch {
      toast.error('Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.');
      return false;
    } finally { setBusy(false); }
  }

  async function openItem(item: NotificationItem) {
    if (!item.href) return;
    // Switch to the profile that actually received the copy before navigating.
    if (item.profileId && profiles?.activeProfileId !== item.profileId) {
      if (!profiles?.profiles.some((profile) => profile.id === item.profileId && !profile.isArchived)) {
        toast.error('Das zugehörige Kinderprofil ist nicht verfügbar. Prüfe bitte eure Profile in den Einstellungen.');
        return;
      }
      profiles.setActiveProfileId(item.profileId);
    }
    if (!item.read) {
      try { await backend.user.setNotificationState({ id: item.id, read: true }); }
      catch { toast.error('Der Lesestatus konnte nicht gespeichert werden.'); }
      void refreshSummary?.();
    }
    navigate(item.href);
  }

  const changePreferences = (key: keyof NotificationPreferences, enabled: boolean) => {
    if (!preferences) return;
    void mutate(() => backend.user.updateNotificationPreferences({ ...preferences, [key]: enabled }), 'Deine Themen wurden gespeichert.');
  };
  const clearFilters = () => { setSearch(''); setQuery(''); setKind(undefined); setUnreadOnly(false); };
  const allDisabled = preferences && !Object.values(preferences).some(Boolean);
  const personalCount = summary?.counts.sharing ?? 0;
  const contentCount = (summary?.counts.audio ?? 0) + (summary?.counts.character ?? 0);

  return (
    <div className="notifications-page">
      <motion.header className="notification-hero" initial={reducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <div>
          <span className="notification-eyebrow"><span className="notification-live-dot" /> NEUES AUS DEINER TALEA-WELT</span>
          <h1>Mitteilungen<span className="notification-heading-dot">.</span></h1>
          <p>Frische Ideen, neue Abenteuer und kleine Überraschungen.<br className="hidden sm:block" /> Alles, was dich und deine Talea-Welt weiterbringt.</p>
        </div>
        <div className="notification-hero-mark" aria-hidden="true"><span className="notification-stamp-label">TALEA POST</span><Bell size={43} strokeWidth={1.15} /><span className="notification-stamp-line" /><span>FÜR DICH</span></div>
      </motion.header>

      <div className="notification-overview" aria-label="Übersicht">
        <button type="button" onClick={() => { setArchived(false); setKind(undefined); setUnreadOnly(true); }} className="notification-overview-item">
          <span className="notification-overview-icon"><Inbox size={18} /></span><div><strong>{summary ? summary.unreadCount : '–'}</strong><span>Ungelesen</span></div><ArrowUpRight size={16} />
        </button>
        <button type="button" onClick={() => { setArchived(false); setKind('sharing'); setUnreadOnly(false); }} className="notification-overview-item">
          <span className="notification-overview-icon"><MailCheck size={18} /></span><div><strong>{summary ? personalCount : '–'}</strong><span>Mit dir geteilt · neu</span></div><ArrowUpRight size={16} />
        </button>
        <div className="notification-overview-item">
          <span className="notification-overview-icon"><Bell size={18} /></span><div><strong>{summary ? contentCount : '–'}</strong><span>Neue Inhalte</span></div>
        </div>
      </div>

      <div className="notification-layout">
        <section className="notification-inbox" aria-label="Mitteilungseingang">
          <div className="notification-inbox-heading">
            <div><h2>{archived ? 'Dein Archiv' : 'Dein Eingang'}</h2><span>{loading ? 'Wird aktualisiert …' : `${feed?.total ?? 0} ${feed?.total === 1 ? 'Mitteilung' : 'Mitteilungen'}`}</span></div>
            <div className="notification-heading-actions">
              {isAdmin && <button type="button" className="notification-button notification-compose-button" onClick={() => setComposerOpen(true)}><Plus size={16} /><span>Neuigkeit</span></button>}
              <button type="button" className="notification-button notification-mobile-settings" onClick={() => setPreferencesOpen(true)}><SlidersHorizontal size={16} /><span>Themen</span></button>
              <button type="button" className="notification-tool notification-icon-button" aria-label="Mitteilungen aktualisieren" title="Aktualisieren" disabled={loading || busy} onClick={() => void load()}><RefreshCw size={17} /></button>
            </div>
          </div>

          <div className="notification-search"><Search size={18} aria-hidden="true" /><input type="search" aria-label="Mitteilungen durchsuchen" placeholder="Mitteilungen durchsuchen …" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button type="button" aria-label="Suche leeren" onClick={() => setSearch('')}><X size={16} /></button>}</div>

          <div className="notification-filters" role="group" aria-label="Nach Thema filtern">
            <button type="button" aria-pressed={!kind} className={!kind ? 'is-selected' : ''} onClick={() => setKind(undefined)}>Alle</button>
            {NOTIFICATION_TOPICS.map(({ kind: topicKind, label, icon: Icon }) => <button key={topicKind} type="button" aria-pressed={kind === topicKind} className={kind === topicKind ? 'is-selected' : ''} onClick={() => setKind(topicKind)}><Icon size={14} />{label}</button>)}
          </div>

          <div className="notification-view-controls">
            <div className="notification-view-tabs" role="group" aria-label="Eingang oder Archiv">
              <button type="button" aria-pressed={!archived} className={!archived ? 'is-selected' : ''} onClick={() => setArchived(false)}><Inbox size={14} />Eingang</button>
              <button type="button" aria-pressed={archived} className={archived ? 'is-selected' : ''} onClick={() => { setArchived(true); setUnreadOnly(false); }}><Archive size={14} />Archiv</button>
            </div>
            <label className="notification-unread-control"><input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} /> Nur ungelesen</label>
            {!archived && <button type="button" className="notification-mark-all" disabled={busy || loading || !summary?.unreadCount || !feed} onClick={() => feed && void mutate(() => backend.user.markNotificationsRead({ asOf: feed.asOf }), 'Alle Mitteilungen wurden als gelesen markiert.')}><CheckCheck size={15} /><span>Alle gelesen</span></button>}
          </div>

          <div className="notification-results" aria-busy={loading || busy}>
            {!loading && feed && summary && summary.unreadCount > feed.unreadCount && (
              <div className="notification-new-arrivals" role="status"><Bell size={16} /><span>Es gibt neue Mitteilungen.</span><button type="button" disabled={busy} onClick={() => void load()}>Jetzt anzeigen <RefreshCw size={13} /></button></div>
            )}
            {loading ? (
              <div role="status" aria-label="Mitteilungen werden geladen" className="notification-skeletons">{[0, 1, 2].map((value) => <div key={value} className="notification-skeleton"><div /><section><span /><span /><span /></section></div>)}</div>
            ) : error ? (
              <div className="notification-empty" role="alert"><span className="notification-empty-icon"><BellOff size={28} /></span><h3>Kurz keine Verbindung</h3><p>{error}</p><button type="button" className="notification-button notification-button-primary" onClick={() => void load()}><RefreshCw size={16} />Erneut versuchen</button></div>
            ) : !feed?.items.length ? (
              <div className="notification-empty"><span className="notification-empty-icon">{archived ? <Archive size={29} /> : <MailCheck size={29} />}</span>
                <h3>{allDisabled ? 'Dein Eingang macht eine Pause' : query || kind ? 'Hier ist es noch ruhig' : archived ? 'Platz für später' : unreadOnly ? 'Alles auf dem neuesten Stand' : 'Bald gibt es wieder Neues'}</h3>
                <p>{allDisabled ? 'Aktiviere deine Lieblingsthemen, um neue Mitteilungen zu erhalten.' : query || kind ? 'Für diese Auswahl gibt es keine Mitteilungen. Probiere ein anderes Thema oder einen anderen Suchbegriff.' : archived ? 'Archivierte Mitteilungen findest du hier. Du kannst sie jederzeit zurück in deinen Eingang holen.' : unreadOnly ? 'Du hast alle Mitteilungen gelesen. Neue Abenteuer melden sich hier, sobald es etwas zu entdecken gibt.' : 'Neue Funktionen, Inhalte und geteilte Avatare erscheinen hier, sobald sie verfügbar sind.'}</p>
                {(query || kind || unreadOnly) && <button type="button" className="notification-button" onClick={clearFilters}>Alle Mitteilungen anzeigen</button>}
                {allDisabled && <button type="button" className="notification-button" onClick={() => setPreferencesOpen(true)}><SlidersHorizontal size={16} />Themen auswählen</button>}
              </div>
            ) : (
              <div className="notification-feed">
                {feed.items.map((item, index) => {
                  const group = notificationGroup(item.createdAt, item.pinned);
                  const previous = index ? notificationGroup(feed.items[index - 1].createdAt, feed.items[index - 1].pinned) : null;
                  return <React.Fragment key={item.id}>
                    {group !== previous && <div className="notification-date-heading"><span>{group}</span><span /></div>}
                    <NotificationCard item={item} busy={busy} isAdmin={isAdmin}
                      onRead={() => void mutate(() => backend.user.setNotificationState({ id: item.id, read: true }))}
                      onArchive={() => void mutate(() => backend.user.setNotificationState({ id: item.id, archived: !item.archived }), item.archived ? 'Zurück in deinem Eingang.' : 'Mitteilung archiviert.')}
                      onOpen={() => void openItem(item)} onDelete={() => setDeleteTarget(item)} />
                  </React.Fragment>;
                })}
                {feed.hasMore && <button type="button" className="notification-load-more notification-button" disabled={loadingMore || busy} onClick={() => void loadMore()}>{loadingMore ? <LoaderCircle size={17} className="notification-spin" /> : <ChevronDown size={17} />}Weitere Mitteilungen</button>}
                <p className="notification-feed-end">Neue Kataloginhalte der letzten 90 Tage · Persönliche Freigaben und Neuigkeiten bleiben erhalten.</p>
              </div>
            )}
          </div>
        </section>

        <aside className="notification-sidebar">
          <PreferencesPanel preferences={preferences} busy={busy} onChange={changePreferences} />
          <div className="notification-quiet-card"><span className="notification-quiet-icon"><CheckCheck size={20} /></span><h3>In deinem Tempo.</h3><p>Neuigkeiten warten hier auf dich. Lies sie, wenn es passt, und archiviere, was du erledigt hast.</p><span>Dein Lesestatus reist mit – auf jedem Gerät.</span></div>
        </aside>
      </div>

      <Dialog open={preferencesOpen} onOpenChange={setPreferencesOpen}>
        <DialogContent className="notifications-dialog notification-preferences-dialog">
          <DialogTitle className="sr-only">Mitteilungsthemen anpassen</DialogTitle>
          <DialogDescription className="sr-only">Wähle, welche Mitteilungen in deinem Eingang angezeigt werden.</DialogDescription>
          <PreferencesPanel preferences={preferences} busy={busy} onChange={changePreferences} />
        </DialogContent>
      </Dialog>
      {isAdmin && <AnnouncementComposer open={composerOpen} onOpenChange={setComposerOpen} onPublished={() => void load()} />}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !busy) setDeleteTarget(null); }}>
        <DialogContent className="notifications-dialog">
          <DialogTitle>Neuigkeit für alle entfernen?</DialogTitle>
          <DialogDescription>„{deleteTarget?.title}“ wird aus den Mitteilungen aller Mitglieder entfernt. Persönliches Archivieren betrifft nur deinen eigenen Eingang.</DialogDescription>
          <div className="notification-delete-actions"><button type="button" className="notification-button" disabled={busy} onClick={() => setDeleteTarget(null)}>Abbrechen</button><button type="button" className="notification-button notification-button-danger" disabled={busy} onClick={async () => { if (deleteTarget && await mutate(() => backend.user.deleteAnnouncement({ id: deleteTarget.id.slice(5) }), 'Die Neuigkeit wurde entfernt.')) setDeleteTarget(null); }}>{busy ? <LoaderCircle size={16} className="notification-spin" /> : <Trash2 size={16} />}Für alle entfernen</button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
