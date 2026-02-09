import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  FlaskConical,
  Globe,
  GraduationCap,
  Headphones,
  Mic,
  Play,
  Plus,
  Search,
  Wand2,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';

import { DokuCard } from '../../components/cards/DokuCard';
import { useBackend } from '../../hooks/useBackend';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { AudioPlaybackControls } from '../../components/audio/AudioPlaybackControls';
import type { Doku } from '../../types/doku';
import type { AudioDoku } from '../../types/audio-doku';
import { useTheme } from '../../contexts/ThemeContext';
import taleaLogo from '@/img/talea_logo.png';

type Palette = {
  pageGradient: string;
  haloA: string;
  haloB: string;
  panel: string;
  border: string;
  text: string;
  muted: string;
  soft: string;
  primary: string;
  primaryText: string;
};

const headingFont = '"Cormorant Garamond", serif';

function getPalette(isDark: boolean): Palette {
  if (isDark) {
    return {
      pageGradient:
        'radial-gradient(980px 540px at 100% 0%, rgba(117,96,142,0.25) 0%, transparent 57%), radial-gradient(940px 520px at 0% 18%, rgba(94,131,126,0.24) 0%, transparent 62%), linear-gradient(180deg,#121a26 0%, #0f1722 100%)',
      haloA: 'radial-gradient(circle, rgba(139,116,172,0.36) 0%, transparent 70%)',
      haloB: 'radial-gradient(circle, rgba(101,148,140,0.32) 0%, transparent 70%)',
      panel: 'rgba(23,33,47,0.92)',
      border: '#314258',
      text: '#e6eef9',
      muted: '#9db0c8',
      soft: 'rgba(145,166,194,0.16)',
      primary: 'linear-gradient(135deg,#95accf 0%,#b491ca 42%,#77a89b 100%)',
      primaryText: '#121b2a',
    };
  }

  return {
    pageGradient:
      'radial-gradient(980px 560px at 100% 0%, #f2dfdc 0%, transparent 57%), radial-gradient(980px 520px at 0% 18%, #dae8de 0%, transparent 62%), linear-gradient(180deg,#f8f1e8 0%, #f6efe4 100%)',
    haloA: 'radial-gradient(circle, rgba(147,126,186,0.32) 0%, transparent 70%)',
    haloB: 'radial-gradient(circle, rgba(110,156,148,0.3) 0%, transparent 70%)',
    panel: 'rgba(255,250,243,0.92)',
    border: '#dfcfbb',
    text: '#1b2838',
    muted: '#607388',
    soft: 'rgba(232,220,205,0.72)',
    primary: 'linear-gradient(135deg,#f2d9d6 0%,#e8d8e9 42%,#d5e3cf 100%)',
    primaryText: '#2c394a',
  };
}

const DokuBackground: React.FC<{ palette: Palette }> = ({ palette }) => (
  <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
    <div className="absolute inset-0" style={{ background: palette.pageGradient }} />
    <div className="absolute -left-24 top-10 h-72 w-72 rounded-full" style={{ background: palette.haloA, filter: 'blur(36px)' }} />
    <div className="absolute -right-20 bottom-14 h-80 w-80 rounded-full" style={{ background: palette.haloB, filter: 'blur(42px)' }} />
  </div>
);

const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  count: number;
  palette: Palette;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ icon, title, subtitle, count, palette, actionLabel, onAction }) => (
  <div className="mb-4 flex items-center justify-between gap-3">
    <div className="flex items-center gap-2.5">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: palette.soft, color: palette.text }}>
        {icon}
      </div>
      <div>
        <h3 className="text-xl leading-none" style={{ fontFamily: headingFont, color: palette.text }}>
          {title}
        </h3>
        <p className="text-xs mt-1" style={{ color: palette.muted }}>
          {subtitle} ({count})
        </p>
      </div>
    </div>

    {onAction && actionLabel && (
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold"
        style={{ borderColor: palette.border, background: palette.primary, color: palette.primaryText }}
      >
        <Plus className="h-3.5 w-3.5" />
        {actionLabel}
      </button>
    )}
  </div>
);

const AudioDokuCard: React.FC<{
  doku: AudioDoku;
  index: number;
  onPlay: () => void;
  palette: Palette;
}> = ({ doku, index, onPlay, palette }) => (
  <motion.button
    type="button"
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.03, duration: 0.24 }}
    whileHover={{ y: -4 }}
    onClick={onPlay}
    className="group w-full overflow-hidden rounded-3xl border text-left shadow-[0_12px_28px_rgba(33,44,62,0.12)]"
    style={{ borderColor: palette.border, background: palette.panel }}
  >
    <div className="relative h-44 overflow-hidden" style={{ background: palette.soft }}>
      {doku.coverImageUrl ? (
        <img src={doku.coverImageUrl} alt={doku.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Headphones className="h-12 w-12" style={{ color: palette.muted }} />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/12 to-transparent" />

      <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white" style={{ borderColor: 'rgba(255,255,255,0.35)', background: 'rgba(10,16,24,0.35)' }}>
        <Mic className="h-3 w-3" />
        Audio
      </div>

      <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/35 bg-black/30 text-white">
          <Play className="h-5 w-5 ml-0.5" />
        </div>
      </div>

      <h4 className="absolute bottom-3 left-3 right-3 line-clamp-2 text-lg font-semibold text-white">
        {doku.title}
      </h4>
    </div>

    <div className="p-4">
      <p className="line-clamp-2 text-sm" style={{ color: palette.muted }}>
        {doku.description}
      </p>
    </div>
  </motion.button>
);

const AudioModal: React.FC<{
  doku: AudioDoku;
  onClose: () => void;
  onPlay: () => void;
  isPlaying: boolean;
  audioError: string | null;
  palette: Palette;
}> = ({ doku, onClose, onPlay, isPlaying, audioError, palette }) => {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/55 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 16 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-3xl border"
        style={{ borderColor: palette.border, background: palette.panel }}
      >
        <div className="relative h-48 overflow-hidden" style={{ background: palette.soft }}>
          {doku.coverImageUrl ? (
            <img src={doku.coverImageUrl} alt={doku.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Headphones className="h-14 w-14" style={{ color: palette.muted }} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

          <button
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full border p-2 text-white"
            style={{ borderColor: 'rgba(255,255,255,0.34)', background: 'rgba(10,16,24,0.35)' }}
            aria-label="Audio Modal schliessen"
          >
            <X className="h-4 w-4" />
          </button>

          <h3 className="absolute bottom-4 left-4 right-4 text-xl font-semibold text-white">{doku.title}</h3>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-sm" style={{ color: palette.muted }}>
            {doku.description}
          </p>

          {audioError && (
            <div className="rounded-xl border border-rose-400/35 bg-rose-500/10 p-3 text-sm text-rose-300">{audioError}</div>
          )}

          <div className="rounded-2xl border p-4" style={{ borderColor: palette.border, background: palette.soft }}>
            {isPlaying ? (
              <AudioPlaybackControls variant="full" showClose />
            ) : (
              <button
                type="button"
                onClick={onPlay}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold"
                style={{ borderColor: palette.border, background: palette.primary, color: palette.primaryText }}
              >
                <Play className="h-4 w-4" />
                {t('doku.audioPlay', 'Abspielen')}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const SectionLoading: React.FC<{ palette: Palette }> = ({ palette }) => (
  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="h-[300px] animate-pulse rounded-3xl border" style={{ borderColor: palette.border, background: palette.soft }} />
    ))}
  </div>
);

const TaleaDokusScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const backend = useBackend();
  const audioPlayer = useAudioPlayer();
  const { isSignedIn, isLoaded } = useUser();
  const { resolvedTheme } = useTheme();

  const palette = useMemo(() => getPalette(resolvedTheme === 'dark'), [resolvedTheme]);

  const [myDokus, setMyDokus] = useState<Doku[]>([]);
  const [publicDokus, setPublicDokus] = useState<Doku[]>([]);
  const [audioDokus, setAudioDokus] = useState<AudioDoku[]>([]);
  const [loadingMy, setLoadingMy] = useState(true);
  const [loadingPublic, setLoadingPublic] = useState(true);
  const [loadingAudio, setLoadingAudio] = useState(true);
  const [loadingMoreMy, setLoadingMoreMy] = useState(false);
  const [loadingMorePublic, setLoadingMorePublic] = useState(false);
  const [hasMoreMy, setHasMoreMy] = useState(true);
  const [hasMorePublic, setHasMorePublic] = useState(true);
  const [totalMy, setTotalMy] = useState(0);
  const [totalPublic, setTotalPublic] = useState(0);
  const [totalAudio, setTotalAudio] = useState(0);
  const [audioModal, setAudioModal] = useState<AudioDoku | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [publicAccessMessage, setPublicAccessMessage] = useState<string | null>(null);
  const [audioAccessMessage, setAudioAccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const myObserverRef = useRef<HTMLDivElement>(null);
  const publicObserverRef = useRef<HTMLDivElement>(null);

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  };

  const loadMyDokus = async () => {
    try {
      setLoadingMy(true);
      const res = await backend.doku.listDokus({ limit: 10, offset: 0 });
      setMyDokus(res.dokus as any[]);
      setTotalMy(res.total);
      setHasMoreMy(res.hasMore);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMy(false);
    }
  };

  const loadPublicDokus = async () => {
    try {
      setLoadingPublic(true);
      setPublicAccessMessage(null);
      const res = await backend.doku.listPublicDokus({ limit: 12, offset: 0 });
      setPublicDokus(res.dokus as any[]);
      setTotalPublic(res.total);
      setHasMorePublic(res.hasMore);
    } catch (error) {
      console.error(error);
      setPublicDokus([]);
      setTotalPublic(0);
      setHasMorePublic(false);
      setPublicAccessMessage(getErrorMessage(error, 'Community-Dokus sind in deinem aktuellen Plan nicht verfuegbar.'));
    } finally {
      setLoadingPublic(false);
    }
  };

  const loadAudioDokus = async () => {
    try {
      setLoadingAudio(true);
      setAudioAccessMessage(null);
      const res = await backend.doku.listAudioDokus({ limit: 12, offset: 0 });
      setAudioDokus(res.audioDokus as any[]);
      setTotalAudio(res.total);
    } catch (error) {
      console.error(error);
      setAudioDokus([]);
      setTotalAudio(0);
      setAudioAccessMessage(getErrorMessage(error, 'Audio-Dokus sind in deinem aktuellen Plan nicht verfuegbar.'));
    } finally {
      setLoadingAudio(false);
    }
  };

  const loadMoreMy = useCallback(async () => {
    if (loadingMoreMy || !hasMoreMy) return;
    try {
      setLoadingMoreMy(true);
      const res = await backend.doku.listDokus({ limit: 10, offset: myDokus.length });
      setMyDokus((prev) => [...prev, ...(res.dokus as any[])]);
      setHasMoreMy(res.hasMore);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMoreMy(false);
    }
  }, [backend, hasMoreMy, loadingMoreMy, myDokus.length]);

  const loadMorePublic = useCallback(async () => {
    if (loadingMorePublic || !hasMorePublic || publicAccessMessage) return;
    try {
      setLoadingMorePublic(true);
      const res = await backend.doku.listPublicDokus({ limit: 12, offset: publicDokus.length });
      setPublicDokus((prev) => [...prev, ...(res.dokus as any[])]);
      setHasMorePublic(res.hasMore);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMorePublic(false);
    }
  }, [backend, hasMorePublic, loadingMorePublic, publicAccessMessage, publicDokus.length]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void loadMyDokus();
    void loadPublicDokus();
    void loadAudioDokus();
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreMy && !loadingMoreMy && !loadingMy) {
          void loadMoreMy();
        }
      },
      { threshold: 0.1 }
    );

    const target = myObserverRef.current;
    if (target) observer.observe(target);
    return () => {
      if (target) observer.unobserve(target);
    };
  }, [hasMoreMy, loadingMoreMy, loadingMy, loadMoreMy, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn || publicAccessMessage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMorePublic && !loadingMorePublic && !loadingPublic) {
          void loadMorePublic();
        }
      },
      { threshold: 0.1 }
    );

    const target = publicObserverRef.current;
    if (target) observer.observe(target);
    return () => {
      if (target) observer.unobserve(target);
    };
  }, [hasMorePublic, loadingMorePublic, loadingPublic, loadMorePublic, isSignedIn, publicAccessMessage]);

  const handleDeleteDoku = async (dokuId: string, dokuTitle: string) => {
    if (!window.confirm(`${t('common.delete', 'Loeschen')} "${dokuTitle}"?`)) return;

    try {
      await backend.doku.deleteDoku({ id: dokuId });
      setMyDokus((prev) => prev.filter((d) => d.id !== dokuId));
    } catch (error) {
      console.error(error);
    }
  };

  const handleTogglePublic = async (dokuId: string, currentIsPublic: boolean) => {
    try {
      await backend.doku.updateDoku({ id: dokuId, isPublic: !currentIsPublic });
      setMyDokus((prev) => prev.map((d) => (d.id === dokuId ? { ...d, isPublic: !currentIsPublic } : d)));
      if (currentIsPublic) {
        setPublicDokus((prev) => prev.filter((d) => d.id !== dokuId));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handlePlayAudio = (doku: AudioDoku) => {
    setAudioError(null);
    if (!doku.audioUrl) {
      setAudioError('Keine Audio-Datei verfuegbar');
      return;
    }
    audioPlayer.playTrack({
      id: doku.id,
      title: doku.title,
      description: doku.description,
      coverImageUrl: doku.coverImageUrl,
      audioUrl: doku.audioUrl,
    });
  };

  const query = searchQuery.trim().toLowerCase();
  const filteredMyDokus = useMemo(
    () =>
      query
        ? myDokus.filter((d) => d.title.toLowerCase().includes(query) || (d.topic || '').toLowerCase().includes(query))
        : myDokus,
    [myDokus, query]
  );
  const filteredPublicDokus = useMemo(
    () =>
      query
        ? publicDokus.filter((d) => d.title.toLowerCase().includes(query) || (d.topic || '').toLowerCase().includes(query))
        : publicDokus,
    [publicDokus, query]
  );
  const filteredAudioDokus = useMemo(
    () =>
      query
        ? audioDokus.filter((d) => d.title.toLowerCase().includes(query) || (d.description || '').toLowerCase().includes(query))
        : audioDokus,
    [audioDokus, query]
  );

  const isInitialLoading = isSignedIn && loadingMy && loadingPublic;

  return (
    <div className="relative min-h-screen pb-28" style={{ color: palette.text }}>
      <DokuBackground palette={palette} />

      <SignedOut>
        <div className="flex min-h-[68vh] items-center justify-center px-5">
          <div className="w-full max-w-2xl rounded-3xl border p-8 text-center" style={{ borderColor: palette.border, background: palette.panel }}>
            <h2 className="text-3xl" style={{ fontFamily: headingFont, color: palette.text }}>
              {t('errors.unauthorized', 'Bitte melde dich an')}
            </h2>
            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="mt-5 rounded-2xl border px-5 py-3 text-sm font-semibold"
              style={{ borderColor: palette.border, background: palette.primary, color: palette.primaryText }}
            >
              {t('auth.signIn', 'Anmelden')}
            </button>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="relative z-10 space-y-8 pt-5">
          <header className="rounded-3xl border p-5 shadow-[0_18px_34px_rgba(33,44,62,0.12)] md:p-6" style={{ borderColor: palette.border, background: palette.panel }}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <img src={taleaLogo} alt="Talea" className="h-10 w-10 rounded-xl object-cover" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: palette.muted }}>
                    Knowledge Studio
                  </p>
                  <h1 className="text-4xl leading-none" style={{ fontFamily: headingFont, color: palette.text }}>
                    Dokus
                  </h1>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/doku/create')}
                className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold shadow-[0_10px_22px_rgba(51,62,79,0.16)]"
                style={{ borderColor: palette.border, background: palette.primary, color: palette.primaryText }}
              >
                <Wand2 className="h-4 w-4" />
                {t('doku.createNew', 'Neue Doku')}
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: palette.muted }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('doku.searchPlaceholder', 'Dokus durchsuchen...')}
                  className="h-11 w-full rounded-2xl border py-2 pl-10 pr-3 text-sm outline-none"
                  style={{ borderColor: palette.border, background: palette.panel, color: palette.text }}
                />
              </label>

              <button
                type="button"
                onClick={() => navigate('/createaudiodoku')}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold"
                style={{ borderColor: palette.border, background: palette.soft, color: palette.text }}
              >
                <Headphones className="h-3.5 w-3.5" />
                Audio erstellen
              </button>

              <div className="rounded-xl border px-3 py-2 text-xs" style={{ borderColor: palette.border, background: palette.soft, color: palette.muted }}>
                {totalMy + totalPublic} Artikel / {totalAudio} Audio
              </div>
            </div>
          </header>

          {isInitialLoading ? (
            <SectionLoading palette={palette} />
          ) : (
            <>
              <section>
                <SectionHeader
                  icon={<GraduationCap className="h-4 w-4" />}
                  title={t('doku.myDokus', 'Meine Dokus')}
                  subtitle={t('doku.myDokusSubtitle', 'Deine persoenlichen Wissensartikel')}
                  count={totalMy}
                  palette={palette}
                />

                {loadingMy ? (
                  <SectionLoading palette={palette} />
                ) : filteredMyDokus.length === 0 ? (
                  <div className="rounded-2xl border p-8 text-center" style={{ borderColor: palette.border, background: palette.panel }}>
                    <p className="text-sm" style={{ color: palette.muted }}>
                      {query ? 'Keine Doku passt zum Suchbegriff.' : t('doku.noDokus', 'Noch keine Dokus')}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredMyDokus.map((doku) => (
                      <DokuCard
                        key={doku.id}
                        doku={doku}
                        onRead={(item) => navigate(`/doku-reader/${item.id}`)}
                        onDelete={handleDeleteDoku}
                        onTogglePublic={handleTogglePublic}
                      />
                    ))}
                  </div>
                )}

                {hasMoreMy && !query && (
                  <div ref={myObserverRef} className="mt-4 h-4 text-center text-xs" style={{ color: palette.muted }}>
                    {loadingMoreMy ? 'Weitere Dokus werden geladen...' : null}
                  </div>
                )}
              </section>

              <section>
                <SectionHeader
                  icon={<Globe className="h-4 w-4" />}
                  title={t('doku.publicDokus', 'Community Dokus')}
                  subtitle={t('doku.publicDokusSubtitle', 'Von der Community geteilt')}
                  count={totalPublic}
                  palette={palette}
                />

                {loadingPublic ? (
                  <SectionLoading palette={palette} />
                ) : publicAccessMessage ? (
                  <div className="rounded-2xl border border-rose-400/35 bg-rose-500/10 p-6 text-center text-sm text-rose-300">
                    {publicAccessMessage}
                  </div>
                ) : filteredPublicDokus.length === 0 ? (
                  <div className="rounded-2xl border p-8 text-center" style={{ borderColor: palette.border, background: palette.panel }}>
                    <p className="text-sm" style={{ color: palette.muted }}>
                      {query ? 'Keine Community-Doku passt zum Suchbegriff.' : t('doku.noPublicDokus', 'Keine oeffentlichen Artikel')}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredPublicDokus.map((doku) => (
                      <DokuCard key={doku.id} doku={doku} onRead={(item) => navigate(`/doku-reader/${item.id}`)} />
                    ))}
                  </div>
                )}

                {hasMorePublic && !publicAccessMessage && !query && (
                  <div ref={publicObserverRef} className="mt-4 h-4 text-center text-xs" style={{ color: palette.muted }}>
                    {loadingMorePublic ? 'Weitere Community-Dokus werden geladen...' : null}
                  </div>
                )}
              </section>

              <section>
                <SectionHeader
                  icon={<Headphones className="h-4 w-4" />}
                  title={t('doku.audioDokus', 'Audio-Dokus')}
                  subtitle={t('doku.audioDokusSubtitle', 'Zum Anhoeren')}
                  count={totalAudio}
                  palette={palette}
                  actionLabel={t('doku.audioCreateButton', 'Audio erstellen')}
                  onAction={() => navigate('/createaudiodoku')}
                />

                {loadingAudio ? (
                  <SectionLoading palette={palette} />
                ) : audioAccessMessage ? (
                  <div className="rounded-2xl border border-rose-400/35 bg-rose-500/10 p-6 text-center text-sm text-rose-300">
                    {audioAccessMessage}
                  </div>
                ) : filteredAudioDokus.length === 0 ? (
                  <div className="rounded-2xl border p-8 text-center" style={{ borderColor: palette.border, background: palette.panel }}>
                    <p className="text-sm" style={{ color: palette.muted }}>
                      {query ? 'Keine Audio-Doku passt zum Suchbegriff.' : t('doku.noAudioDokus', 'Noch keine Audio-Dokus')}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filteredAudioDokus.map((doku, i) => (
                      <AudioDokuCard
                        key={doku.id}
                        doku={doku}
                        index={i}
                        onPlay={() => setAudioModal(doku)}
                        palette={palette}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        <AnimatePresence>
          {audioModal && (
            <AudioModal
              doku={audioModal}
              onClose={() => setAudioModal(null)}
              onPlay={() => handlePlayAudio(audioModal)}
              isPlaying={audioPlayer.track?.id === audioModal.id}
              audioError={audioError}
              palette={palette}
            />
          )}
        </AnimatePresence>
      </SignedIn>
    </div>
  );
};

export default TaleaDokusScreen;
