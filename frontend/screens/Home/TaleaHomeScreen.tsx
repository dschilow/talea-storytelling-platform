import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  Library,
  LogIn,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UserPlus,
} from 'lucide-react';

import { useBackend } from '../../hooks/useBackend';
import type { Story } from '../../types/story';

interface Avatar {
  id: string;
  name: string;
  imageUrl?: string;
  creationType: 'ai-generated' | 'photo-upload';
}

interface Doku {
  id: string;
  title: string;
  topic: string;
  coverImageUrl?: string;
  status: 'generating' | 'complete' | 'error';
  createdAt: string;
}

const palette = {
  page: '#f5f2ec',
  text: '#17212d',
  muted: '#5d6772',
  border: '#ddd5c8',
  surface: '#ffffff',
  accent: '#0f766e',
  accentSoft: '#d7ece8',
  warning: '#8a5a24',
  danger: '#9d3f3f',
};

const headingFont = '"Fraunces", "Times New Roman", serif';
const bodyFont = '"Manrope", "Segoe UI", sans-serif';

const Atmosphere: React.FC = () => (
  <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
    <div
      className="absolute inset-0"
      style={{
        background: `radial-gradient(1200px 520px at 0% 0%, #d9e9e6 0%, transparent 58%),
                     radial-gradient(900px 420px at 100% 20%, #efe6d6 0%, transparent 60%),
                     ${palette.page}`,
      }}
    />
  </div>
);

const EmptyBlock: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div
    className="rounded-2xl border px-6 py-8 text-center"
    style={{ borderColor: palette.border, background: palette.surface }}
  >
    <h3 className="text-lg font-semibold" style={{ color: palette.text, fontFamily: headingFont }}>
      {title}
    </h3>
    <p className="mt-2 text-sm" style={{ color: palette.muted }}>
      {description}
    </p>
  </div>
);

const SectionHeader: React.FC<{
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, subtitle, actionLabel, onAction }) => (
  <div className="mb-4 flex items-end justify-between gap-3">
    <div>
      <h2 className="text-2xl font-semibold tracking-tight" style={{ color: palette.text, fontFamily: headingFont }}>
        {title}
      </h2>
      <p className="text-sm" style={{ color: palette.muted }}>
        {subtitle}
      </p>
    </div>
    {actionLabel && onAction && (
      <button
        onClick={onAction}
        className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors hover:bg-black/5"
        style={{ borderColor: palette.border, color: palette.text }}
      >
        {actionLabel}
        <ArrowRight className="h-4 w-4" />
      </button>
    )}
  </div>
);

const ActionTile: React.FC<{
  icon: React.ReactNode;
  title: string;
  text: string;
  onClick: () => void;
  cta: string;
}> = ({ icon, title, text, onClick, cta }) => (
  <button
    onClick={onClick}
    className="group rounded-2xl border p-5 text-left transition-all duration-300 hover:-translate-y-0.5"
    style={{ borderColor: palette.border, background: palette.surface }}
  >
    <div
      className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl"
      style={{ background: palette.accentSoft, color: palette.accent }}
    >
      {icon}
    </div>
    <h3 className="text-lg font-semibold" style={{ color: palette.text, fontFamily: headingFont }}>
      {title}
    </h3>
    <p className="mt-1 text-sm leading-relaxed" style={{ color: palette.muted }}>
      {text}
    </p>
    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: palette.accent }}>
      {cta}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </span>
  </button>
);

const StoryParticipants: React.FC<{ story: Story }> = ({ story }) => {
  const participants = [
    ...((story.config?.avatars || []).map((p) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.name)}`,
    })) || []),
    ...((story.config?.characters || []).map((p) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.imageUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(p.name)}`,
    })) || []),
  ];

  if (participants.length === 0) return null;

  const visible = participants.slice(0, 4);
  const hiddenCount = participants.length - visible.length;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {visible.map((p) => (
        <div
          key={`${story.id}-${p.id}`}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs"
          style={{ borderColor: palette.border, color: palette.text, background: '#faf8f4' }}
        >
          <img src={p.imageUrl} alt={p.name} className="h-5 w-5 rounded-full object-cover" />
          <span className="max-w-[96px] truncate">{p.name}</span>
        </div>
      ))}
      {hiddenCount > 0 && (
        <span
          className="inline-flex h-7 items-center rounded-full border px-2 text-xs font-semibold"
          style={{ borderColor: palette.border, color: palette.muted, background: '#faf8f4' }}
        >
          +{hiddenCount}
        </span>
      )}
    </div>
  );
};

const StoryCard: React.FC<{
  story: Story;
  onRead: () => void;
  onDelete: () => void;
}> = ({ story, onRead, onDelete }) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      whileHover={reduceMotion ? undefined : { y: -4 }}
      whileTap={reduceMotion ? undefined : { scale: 0.99 }}
      className="group w-[320px] flex-shrink-0 cursor-pointer"
      onClick={onRead}
    >
    <div className="overflow-hidden rounded-2xl border shadow-sm" style={{ borderColor: palette.border, background: palette.surface }}>
      <div className="relative h-48 overflow-hidden">
        {story.coverImageUrl ? (
          <img src={story.coverImageUrl} alt={story.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{ background: '#ece6dc', color: '#7d7568' }}>
            <BookOpen className="h-10 w-10" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
        <button
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="absolute right-3 top-3 rounded-lg border p-1.5 text-white transition-colors hover:bg-red-700"
          style={{ borderColor: 'rgba(255,255,255,0.35)', background: 'rgba(23,33,45,0.45)' }}
          aria-label="Story loeschen"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        {story.status === 'generating' && (
          <span
            className="absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
            style={{ background: '#f5e8d7', color: palette.warning }}
          >
            In Arbeit
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="line-clamp-1 text-lg font-semibold" style={{ color: palette.text, fontFamily: headingFont }}>
          {story.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed" style={{ color: palette.muted }}>
          {story.summary || story.description || 'Noch keine Zusammenfassung verfuegbar.'}
        </p>
        <StoryParticipants story={story} />
        <div className="mt-3 flex items-center justify-between text-xs" style={{ color: palette.muted }}>
          <span>{new Date(story.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          <span className="font-semibold" style={{ color: palette.accent }}>
            Lesen
          </span>
        </div>
      </div>
    </div>
    </motion.article>
  );
};

const AvatarSection: React.FC<{
  avatars: Avatar[];
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}> = ({ avatars, onAdd, onEdit, onDelete }) => {
  if (avatars.length === 0) {
    return <EmptyBlock title="Noch keine Avatare" description="Lege deinen ersten Charakter an und starte danach eine Geschichte." />;
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {avatars.map((avatar) => (
        <div
          key={avatar.id}
          role="button"
          tabIndex={0}
          onClick={() => onEdit(avatar.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onEdit(avatar.id);
            }
          }}
          className="group rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5"
          style={{ borderColor: palette.border, background: palette.surface }}
        >
          <div className="relative">
            <img
              src={avatar.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(avatar.name)}`}
              alt={avatar.name}
              className="h-16 w-16 rounded-full object-cover"
            />
            <button
              onClick={(event) => {
                event.stopPropagation();
                onDelete(avatar.id, avatar.name);
              }}
              className="absolute -right-1 -top-1 rounded-full border p-1 text-[10px] text-red-700 opacity-0 transition-opacity group-hover:opacity-100"
              style={{ borderColor: '#efc4c4', background: '#fff2f2' }}
              aria-label={`${avatar.name} loeschen`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
          <p className="mt-3 truncate text-sm font-semibold" style={{ color: palette.text }}>
            {avatar.name}
          </p>
          <p className="text-xs" style={{ color: palette.muted }}>
            {avatar.creationType === 'ai-generated' ? 'KI-generiert' : 'Foto-basiert'}
          </p>
        </div>
      ))}

      <button
        onClick={onAdd}
        className="rounded-2xl border border-dashed p-3 text-left transition-colors hover:bg-black/5"
        style={{ borderColor: palette.border, background: palette.surface }}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: '#f3efe7', color: palette.accent }}>
          <Plus className="h-6 w-6" />
        </div>
        <p className="mt-3 text-sm font-semibold" style={{ color: palette.text }}>
          Neuer Avatar
        </p>
        <p className="text-xs" style={{ color: palette.muted }}>
          Charakter erstellen
        </p>
      </button>
    </div>
  );
};

const DokuSection: React.FC<{
  dokus: Doku[];
  onRead: (id: string) => void;
  onDelete: (id: string, title: string) => void;
}> = ({ dokus, onRead, onDelete }) => {
  if (dokus.length === 0) {
    return <EmptyBlock title="Noch keine Dokus" description="Lege deine erste Wissens-Doku an und erweitere deine Bibliothek." />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {dokus.slice(0, 4).map((doku) => (
        <div
          key={doku.id}
          role="button"
          tabIndex={0}
          onClick={() => onRead(doku.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onRead(doku.id);
            }
          }}
          className="group overflow-hidden rounded-2xl border text-left transition-all hover:-translate-y-0.5"
          style={{ borderColor: palette.border, background: palette.surface }}
        >
          <div className="relative h-32 overflow-hidden">
            {doku.coverImageUrl ? (
              <img src={doku.coverImageUrl} alt={doku.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            ) : (
              <div className="flex h-full w-full items-center justify-center" style={{ background: '#ece6dc', color: '#7d7568' }}>
                <Library className="h-8 w-8" />
              </div>
            )}
            <button
              onClick={(event) => {
                event.stopPropagation();
                onDelete(doku.id, doku.title);
              }}
              className="absolute right-2 top-2 rounded-lg border p-1.5 text-white transition-colors hover:bg-red-700"
              style={{ borderColor: 'rgba(255,255,255,0.35)', background: 'rgba(23,33,45,0.45)' }}
              aria-label="Doku loeschen"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4">
            <p className="line-clamp-1 text-sm font-semibold" style={{ color: palette.text }}>
              {doku.title}
            </p>
            <p className="mt-1 line-clamp-1 text-xs" style={{ color: palette.muted }}>
              {doku.topic}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

const SignedOutStart: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-6">
      <div className="max-w-2xl rounded-3xl border px-8 py-10 text-center shadow-sm" style={{ borderColor: palette.border, background: palette.surface }}>
        <div className="mx-auto mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: palette.accentSoft, color: palette.accent }}>
          <Sparkles className="h-7 w-7" />
        </div>
        <h1 className="text-4xl font-semibold tracking-tight" style={{ color: palette.text, fontFamily: headingFont }}>
          Talea Story Studio
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed" style={{ color: palette.muted, fontFamily: bodyFont }}>
          {t('home.subtitle', 'Erstelle hochwertige Geschichten mit deinen Avataren und halte Inhalte in einer klaren, professionellen Bibliothek organisiert.')}
        </p>
        <button
          onClick={() => navigate('/auth')}
          className="mt-8 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: palette.accent }}
        >
          <LogIn className="h-4 w-4" />
          Anmelden
        </button>
      </div>
    </div>
  );
};

const LoadingState: React.FC = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ borderColor: palette.border, background: palette.surface }}>
      <RefreshCw className="h-4 w-4 animate-spin" style={{ color: palette.accent }} />
      <span className="text-sm font-medium" style={{ color: palette.muted }}>
        Daten werden geladen...
      </span>
    </div>
  </div>
);

const TaleaHomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const backend = useBackend();
  const { user, isLoaded, isSignedIn } = useUser();
  const { t } = useTranslation();

  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [dokus, setDokus] = useState<Doku[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const reduceMotion = useReducedMotion();

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Guten Morgen';
    if (hour < 18) return 'Guten Tag';
    return 'Guten Abend';
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [avatarsResponse, storiesResponse, dokusResponse] = await Promise.all([
        backend.avatar.list(),
        backend.story.list({ limit: 10, offset: 0 }),
        backend.doku.listDokus({ limit: 8, offset: 0 }),
      ]);
      setAvatars((avatarsResponse.avatars as Avatar[]) || []);
      setStories((storiesResponse.stories as Story[]) || []);
      setDokus((dokusResponse.dokus as Doku[]) || []);
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      loadData();
    } else if (isLoaded && !isSignedIn) {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDeleteAvatar = async (avatarId: string, avatarName: string) => {
    if (!window.confirm(`"${avatarName}" wirklich loeschen?`)) return;
    try {
      await backend.avatar.deleteAvatar({ id: avatarId });
      setAvatars((prev) => prev.filter((avatar) => avatar.id !== avatarId));
    } catch (error) {
      console.error('Error deleting avatar:', error);
    }
  };

  const handleDeleteStory = async (storyId: string, storyTitle: string) => {
    if (!window.confirm(`${t('common.delete', 'Loeschen')} "${storyTitle}"?`)) return;
    try {
      await backend.story.deleteStory({ id: storyId });
      setStories((prev) => prev.filter((story) => story.id !== storyId));
    } catch (error) {
      console.error('Error deleting story:', error);
    }
  };

  const handleDeleteDoku = async (dokuId: string, dokuTitle: string) => {
    if (!window.confirm(`${t('common.delete', 'Loeschen')} "${dokuTitle}"?`)) return;
    try {
      await backend.doku.deleteDoku({ id: dokuId });
      setDokus((prev) => prev.filter((doku) => doku.id !== dokuId));
    } catch (error) {
      console.error('Error deleting doku:', error);
    }
  };

  if (loading || !isLoaded) {
    return <LoadingState />;
  }

  return (
    <div className="relative min-h-screen pb-28" style={{ fontFamily: bodyFont }}>
      <Atmosphere />

      <SignedOut>
        <SignedOutStart />
      </SignedOut>

      <SignedIn>
        <div className="space-y-8 pt-6">
          <motion.header
            initial={reduceMotion ? false : { opacity: 0, y: -14 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            className="rounded-3xl border px-5 py-5 shadow-sm md:px-6"
            style={{ borderColor: palette.border, background: palette.surface }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border p-1" style={{ borderColor: palette.border }}>
                  <UserButton
                    afterSignOutUrl="/"
                    userProfileMode="navigation"
                    userProfileUrl="/settings"
                    appearance={{ elements: { avatarBox: 'h-10 w-10' } }}
                  />
                </div>
                <div>
                  <p className="text-sm" style={{ color: palette.muted }}>
                    {greeting}
                  </p>
                  <h1 className="text-2xl font-semibold tracking-tight md:text-3xl" style={{ color: palette.text, fontFamily: headingFont }}>
                    {user?.firstName || 'Talea Nutzer'}
                  </h1>
                </div>
              </div>
              <button
                onClick={handleRefresh}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors hover:bg-black/5"
                style={{ borderColor: palette.border, color: palette.text }}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} style={{ color: palette.accent }} />
                Aktualisieren
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border p-3" style={{ borderColor: palette.border, background: '#faf8f4' }}>
                <p className="text-xs uppercase tracking-wide" style={{ color: palette.muted }}>
                  Geschichten
                </p>
                <p className="mt-1 text-2xl font-semibold" style={{ color: palette.text }}>
                  {stories.length}
                </p>
              </div>
              <div className="rounded-xl border p-3" style={{ borderColor: palette.border, background: '#faf8f4' }}>
                <p className="text-xs uppercase tracking-wide" style={{ color: palette.muted }}>
                  Avatare
                </p>
                <p className="mt-1 text-2xl font-semibold" style={{ color: palette.text }}>
                  {avatars.length}
                </p>
              </div>
              <div className="rounded-xl border p-3" style={{ borderColor: palette.border, background: '#faf8f4' }}>
                <p className="text-xs uppercase tracking-wide" style={{ color: palette.muted }}>
                  Dokus
                </p>
                <p className="mt-1 text-2xl font-semibold" style={{ color: palette.text }}>
                  {dokus.length}
                </p>
              </div>
              <button
                onClick={() => navigate('/story')}
                className="rounded-xl border p-3 text-left transition-colors hover:bg-black/5"
                style={{ borderColor: palette.border, background: '#faf8f4' }}
              >
                <p className="text-xs uppercase tracking-wide" style={{ color: palette.muted }}>
                  Schnellstart
                </p>
                <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: palette.accent }}>
                  Neue Story
                  <ArrowRight className="h-4 w-4" />
                </p>
              </button>
            </div>
          </motion.header>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <ActionTile
              icon={<BookOpen className="h-5 w-5" />}
              title="Neue Geschichte"
              text="Plane und generiere eine Story mit deinen vorhandenen Charakteren."
              cta="Story starten"
              onClick={() => navigate('/story')}
            />
            <ActionTile
              icon={<UserPlus className="h-5 w-5" />}
              title="Avatar erstellen"
              text="Lege neue Teilnehmer an und erweitere deine Story-Bibliothek."
              cta="Avatar anlegen"
              onClick={() => navigate('/avatar')}
            />
            <ActionTile
              icon={<Library className="h-5 w-5" />}
              title="Doku schreiben"
              text="Erstelle strukturierte Wissensinhalte im gleichen visuellen System."
              cta="Doku erstellen"
              onClick={() => navigate('/doku')}
            />
          </section>

          <section>
            <SectionHeader
              title="Aktuelle Geschichten"
              subtitle={`${stories.length} Eintraege in deiner Bibliothek`}
              actionLabel="Alle Geschichten"
              onAction={() => navigate('/stories')}
            />
            {stories.length === 0 ? (
              <EmptyBlock title="Noch keine Geschichten" description="Erstelle deine erste Geschichte und verknuepfe sie mit deinen Avataren." />
            ) : (
              <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2">
                {stories.map((story) => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    onRead={() => navigate(`/story-reader/${story.id}`)}
                    onDelete={() => handleDeleteStory(story.id, story.title)}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeader
              title="Avatare"
              subtitle={`${avatars.length} aktive Charaktere`}
              actionLabel="Avatar-Ansicht"
              onAction={() => navigate('/avatar')}
            />
            <AvatarSection
              avatars={avatars}
              onAdd={() => navigate('/avatar')}
              onEdit={(id) => navigate(`/avatar/edit/${id}`)}
              onDelete={handleDeleteAvatar}
            />
          </section>

          <section>
            <SectionHeader
              title="Wissens-Dokus"
              subtitle={`${dokus.length} veroeffentlichte oder laufende Inhalte`}
              actionLabel="Doku-Ansicht"
              onAction={() => navigate('/doku')}
            />
            <DokuSection
              dokus={dokus}
              onRead={(id) => navigate(`/doku-reader/${id}`)}
              onDelete={handleDeleteDoku}
            />
          </section>
        </div>
      </SignedIn>
    </div>
  );
};

export default TaleaHomeScreen;
