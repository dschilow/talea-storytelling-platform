import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, FileText, Headphones, Play, Search, WifiOff } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Story } from '../../types/story';
import type { Doku } from '../../types/doku';
import type { AudioDoku } from '../../types/audio-doku';
import type { GeneratedAudioLibraryEntry } from '../../types/generated-audio';
import type { PlaylistItem } from '../../types/playlist';
import {
  getAllOfflineStories,
  getAllOfflineDokus,
  getAllOfflineAudioDokus,
  getAllOfflineGeneratedAudios,
  getBlobUrl,
} from '../../utils/offlineDb';
import { useOfflineScope } from '../../contexts/OfflineScopeContext';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  TaleaLoadingState,
  TaleaPageBackground,
  taleaChipClass,
  taleaDisplayFont,
  taleaGlassPanelClass,
  taleaInputClass,
  taleaInsetSurfaceClass,
  taleaPageShellClass,
  taleaSurfaceClass,
} from '../../components/talea/TaleaPastelPrimitives';
import { cn } from '@/lib/utils';

type OfflineTab = 'stories' | 'dokus' | 'audio';

const OfflineContentScreen: React.FC = () => {
  const navigate = useNavigate();
  const scope = useOfflineScope();
  const { addAndPlay } = useAudioPlayer();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const [stories, setStories] = useState<Story[]>([]);
  const [dokus, setDokus] = useState<Doku[]>([]);
  const [audioDokus, setAudioDokus] = useState<AudioDoku[]>([]);
  const [generatedAudios, setGeneratedAudios] = useState<GeneratedAudioLibraryEntry[]>([]);
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<OfflineTab>('stories');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadContent = async () => {
      if (!scope) {
        setStories([]);
        setDokus([]);
        setAudioDokus([]);
        setGeneratedAudios([]);
        setCoverUrls({});
        setLoading(false);
        return;
      }

      try {
        const [s, d, a, g] = await Promise.all([
          getAllOfflineStories(scope),
          getAllOfflineDokus(scope),
          getAllOfflineAudioDokus(scope),
          getAllOfflineGeneratedAudios(scope),
        ]);
        if (cancelled) return;

        setStories(s);
        setDokus(d);

        // Audio-Dokus keep their remote audioUrl in the saved record; playback
        // offline has to come from the stored blob.
        const resolvedAudioDokus: AudioDoku[] = [];
        for (const entry of a) {
          const next: AudioDoku = { ...entry };
          if (next.audioUrl) {
            const blob = await getBlobUrl(scope, next.audioUrl);
            if (blob) next.audioUrl = blob;
          }
          resolvedAudioDokus.push(next);
        }

        const resolvedGenerated: GeneratedAudioLibraryEntry[] = [];
        for (const entry of g) {
          const next: GeneratedAudioLibraryEntry = { ...entry };
          if (next.audioUrl) {
            const blob = await getBlobUrl(scope, next.audioUrl);
            if (blob) next.audioUrl = blob;
          }
          resolvedGenerated.push(next);
        }

        const urls: Record<string, string> = {};
        const resolveCover = async (id: string, coverImageUrl?: string) => {
          if (!coverImageUrl) return;
          const blob = await getBlobUrl(scope, coverImageUrl);
          if (blob) urls[id] = blob;
        };
        for (const story of s) await resolveCover(story.id, story.coverImageUrl);
        for (const doku of d) await resolveCover(doku.id, doku.coverImageUrl);
        for (const ad of a) await resolveCover(ad.id, ad.coverImageUrl);
        for (const ga of g) await resolveCover(ga.id, ga.coverImageUrl);

        if (cancelled) return;
        setAudioDokus(resolvedAudioDokus);
        setGeneratedAudios(resolvedGenerated);
        setCoverUrls(urls);
      } catch (err) {
        console.error('[OfflineContentScreen] Error loading content:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setLoading(true);
    void loadContent();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const needle = query.trim().toLowerCase();
  const matches = (...values: Array<string | undefined>) =>
    !needle || values.some((value) => (value || '').toLowerCase().includes(needle));

  const visibleStories = useMemo(
    () => stories.filter((story) => matches(story.title, story.config?.genre)),
    [stories, needle],
  );
  const visibleDokus = useMemo(
    () => dokus.filter((doku) => matches(doku.title, doku.topic)),
    [dokus, needle],
  );
  const visibleAudioDokus = useMemo(
    () => audioDokus.filter((ad) => matches(ad.title, ad.category)),
    [audioDokus, needle],
  );

  // One card per story/doku rather than one per chapter — a 12-part audiobook
  // is one thing the child picks, not twelve.
  const audioGroups = useMemo(() => {
    const grouped = new Map<
      string,
      { key: string; sourceId: string; title: string; subtitle: string; coverId: string; items: GeneratedAudioLibraryEntry[] }
    >();
    for (const entry of generatedAudios) {
      const key = `${entry.sourceType}:${entry.sourceId}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.items.push(entry);
        continue;
      }
      grouped.set(key, {
        key,
        sourceId: entry.sourceId,
        title: entry.sourceTitle,
        subtitle: entry.sourceType === 'story' ? 'Geschichte' : 'Doku',
        coverId: entry.id,
        items: [entry],
      });
    }
    return Array.from(grouped.values()).filter((group) => matches(group.title));
  }, [generatedAudios, needle]);

  const totalItems = stories.length + dokus.length + audioDokus.length + audioGroups.length;

  const playAudioDoku = (audioDoku: AudioDoku) => {
    if (!audioDoku.audioUrl) return;
    addAndPlay([
      {
        id: `offline-audio-doku-${audioDoku.id}`,
        trackId: audioDoku.id,
        title: audioDoku.title,
        description: audioDoku.category || 'Audio-Doku',
        coverImageUrl: coverUrls[audioDoku.id] || audioDoku.coverImageUrl,
        type: 'audio-doku',
        audioUrl: audioDoku.audioUrl,
        conversionStatus: 'ready',
        parentDokuId: audioDoku.id,
        parentDokuTitle: audioDoku.title,
      },
    ]);
  };

  const playAudioGroup = (group: { items: GeneratedAudioLibraryEntry[] }) => {
    const sorted = [...group.items].sort((a, b) => {
      const orderA = Number.isFinite(a.itemOrder as number) ? (a.itemOrder as number) : Number.MAX_SAFE_INTEGER;
      const orderB = Number.isFinite(b.itemOrder as number) ? (b.itemOrder as number) : Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const items: PlaylistItem[] = sorted
      .filter((entry) => Boolean(entry.audioUrl))
      .map((entry, index) => ({
        id: entry.itemId || `offline-generated-audio-${entry.id}`,
        trackId: entry.sourceId,
        title: entry.itemTitle || `Teil ${index + 1}`,
        description: entry.sourceTitle,
        coverImageUrl: coverUrls[entry.id] || entry.coverImageUrl,
        type: entry.sourceType === 'story' ? 'story-chapter' : 'doku',
        audioUrl: entry.audioUrl,
        conversionStatus: 'ready',
        ...(entry.sourceType === 'story'
          ? { parentStoryId: entry.sourceId, parentStoryTitle: entry.sourceTitle }
          : { parentDokuId: entry.sourceId, parentDokuTitle: entry.sourceTitle }),
        chapterOrder: Number.isFinite(entry.itemOrder as number) ? (entry.itemOrder as number) : index + 1,
      }));

    if (items.length > 0) addAndPlay(items);
  };

  const tabs: Array<{ id: OfflineTab; label: string; count: number }> = [
    { id: 'stories', label: 'Geschichten', count: visibleStories.length },
    { id: 'dokus', label: 'Dokus', count: visibleDokus.length },
    { id: 'audio', label: 'Audio', count: visibleAudioDokus.length + audioGroups.length },
  ];

  return (
    <div className="relative min-h-screen">
      <TaleaPageBackground isDark={isDark} />

      <div className={cn(taleaPageShellClass, 'relative z-10 flex flex-col gap-5 py-4 sm:py-6')}>
        <div className={cn(taleaSurfaceClass, 'p-5 sm:p-6')}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <span className={cn(taleaChipClass, 'gap-2')}>
                <WifiOff className="mr-1.5 h-3.5 w-3.5" />
                Offline-Modus
              </span>
              <h1
                className="mt-3 text-[2rem] font-semibold leading-none text-[var(--talea-text-primary)] sm:text-[2.4rem]"
                style={{ fontFamily: taleaDisplayFont }}
              >
                Bibliothek
              </h1>
              <p className="mt-2 text-sm text-[var(--talea-text-secondary)]">
                {totalItems === 0
                  ? 'Noch keine Inhalte für offline gespeichert.'
                  : 'Deine gespeicherten Inhalte — lesen und hören funktioniert ohne Internet.'}
              </p>
            </div>

            <div className={cn(taleaInsetSurfaceClass, 'flex items-center gap-2 px-4 py-3')}>
              <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
              <span className="text-sm font-bold tabular-nums text-[var(--talea-text-primary)]">
                {totalItems}
              </span>
              <span className="text-xs font-medium text-[var(--talea-text-secondary)]">
                gespeichert
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-3 border-t border-[var(--talea-border-light)] pt-4 dark:border-white/10 lg:grid-cols-[auto_1fr] lg:items-center">
            <div className="grid grid-flow-col auto-cols-fr rounded-[1.25rem] border border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)] p-1 dark:border-white/10">
              {tabs.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setTab(entry.id)}
                  className={cn(
                    'rounded-[0.95rem] px-3 py-2 text-sm font-semibold transition sm:px-5',
                    tab === entry.id
                      ? 'bg-white text-[var(--primary)] shadow-sm dark:bg-white/10 dark:text-white'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
                  )}
                >
                  {entry.label}
                  <span className="ml-2 text-xs tabular-nums opacity-70">{entry.count}</span>
                </button>
              ))}
            </div>

            <div className={cn(taleaGlassPanelClass, 'flex items-center gap-3 p-2')}>
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Suchen"
                  className={cn(taleaInputClass, 'pl-11 pr-4')}
                />
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <TaleaLoadingState
            title="Offline-Bibliothek wird geladen"
            subtitle="Gespeicherte Inhalte werden vorbereitet"
            icon={<BookOpen className="h-9 w-9" />}
          />
        ) : totalItems === 0 ? (
          <EmptyState
            title="Noch nichts gespeichert"
            text="Tippe online bei einer Geschichte oder Doku auf das Lesezeichen. Danach sind Text, Bilder und Audio auch ohne Internet da."
          />
        ) : (
          <>
            {tab === 'stories' &&
              (visibleStories.length === 0 ? (
                <EmptyState title="Keine Geschichte gefunden" text="Passe deine Suche an." />
              ) : (
                <CardGrid>
                  {visibleStories.map((story) => (
                    <OfflineCard
                      key={story.id}
                      title={story.title}
                      subtitle={story.config?.genre || 'Geschichte'}
                      badge="Lesen"
                      icon={<BookOpen className="h-5 w-5" />}
                      coverUrl={coverUrls[story.id]}
                      onClick={() => navigate(`/story-reader/${story.id}`)}
                    />
                  ))}
                </CardGrid>
              ))}

            {tab === 'dokus' &&
              (visibleDokus.length === 0 ? (
                <EmptyState title="Keine Doku gefunden" text="Passe deine Suche an." />
              ) : (
                <CardGrid>
                  {visibleDokus.map((doku) => (
                    <OfflineCard
                      key={doku.id}
                      title={doku.title}
                      subtitle={doku.topic || 'Doku'}
                      badge="Lesen"
                      icon={<FileText className="h-5 w-5" />}
                      coverUrl={coverUrls[doku.id]}
                      onClick={() => navigate(`/doku-reader/${doku.id}`)}
                    />
                  ))}
                </CardGrid>
              ))}

            {tab === 'audio' &&
              (visibleAudioDokus.length + audioGroups.length === 0 ? (
                <EmptyState title="Kein Audio gefunden" text="Passe deine Suche an." />
              ) : (
                <CardGrid>
                  {audioGroups.map((group) => (
                    <OfflineCard
                      key={group.key}
                      title={group.title}
                      subtitle={`${group.subtitle} • ${group.items.length} Teil(e)`}
                      badge="Abspielen"
                      icon={<Headphones className="h-5 w-5" />}
                      coverUrl={coverUrls[group.coverId]}
                      action={<Play className="h-4 w-4" />}
                      onClick={() => playAudioGroup(group)}
                    />
                  ))}
                  {visibleAudioDokus.map((ad) => (
                    <OfflineCard
                      key={ad.id}
                      title={ad.title}
                      subtitle={ad.category || 'Audio-Doku'}
                      badge="Abspielen"
                      icon={<Headphones className="h-5 w-5" />}
                      coverUrl={coverUrls[ad.id]}
                      action={<Play className="h-4 w-4" />}
                      disabled={!ad.audioUrl}
                      onClick={() => playAudioDoku(ad)}
                    />
                  ))}
                </CardGrid>
              ))}
          </>
        )}
      </div>
    </div>
  );
};

const CardGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
);

const EmptyState: React.FC<{ title: string; text: string }> = ({ title, text }) => (
  <div className={cn(taleaInsetSurfaceClass, 'p-8 text-center sm:p-10')}>
    <h3
      className="text-[1.6rem] font-semibold text-[var(--talea-text-primary)]"
      style={{ fontFamily: taleaDisplayFont }}
    >
      {title}
    </h3>
    <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--talea-text-secondary)]">
      {text}
    </p>
  </div>
);

const OfflineCard: React.FC<{
  title: string;
  subtitle: string;
  badge: string;
  icon: React.ReactNode;
  coverUrl?: string;
  action?: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}> = ({ title, subtitle, badge, icon, coverUrl, action, disabled = false, onClick }) => (
  <motion.button
    type="button"
    onClick={onClick}
    disabled={disabled}
    whileHover={disabled ? undefined : { y: -3 }}
    whileTap={disabled ? undefined : { scale: 0.985 }}
    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    className={cn(
      taleaGlassPanelClass,
      'group flex w-full items-center gap-4 p-3 text-left transition-shadow',
      disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:shadow-lg',
    )}
  >
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[1.1rem] border border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)]">
      {coverUrl ? (
        <>
          <img
            src={coverUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-lg"
          />
          <img
            src={coverUrl}
            alt=""
            className="relative h-full w-full object-contain"
          />
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[var(--talea-text-tertiary)]">
          {icon}
        </div>
      )}
    </div>

    <div className="min-w-0 flex-1">
      <h3
        className="line-clamp-2 text-lg font-semibold leading-tight text-[var(--talea-text-primary)]"
        style={{ fontFamily: taleaDisplayFont }}
      >
        {title}
      </h3>
      <p className="mt-1 truncate text-sm text-[var(--talea-text-secondary)]">{subtitle}</p>
      <span className={cn(taleaChipClass, 'mt-2 !px-2.5 !py-1 !text-[10px]')}>{badge}</span>
    </div>

    <span className="shrink-0 rounded-full border border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)] p-2.5 text-[var(--talea-text-secondary)] transition-colors group-hover:text-[var(--primary)]">
      {action ?? <BookOpen className="h-4 w-4" />}
    </span>
  </motion.button>
);

export default OfflineContentScreen;
