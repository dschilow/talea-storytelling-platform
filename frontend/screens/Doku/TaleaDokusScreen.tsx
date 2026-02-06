// Talea Dokus Screen - Knowledge hub with sections
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FlaskConical, Headphones, Play, Plus, X, Search, GraduationCap, Globe, Mic, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';
import { DokuCard } from '../../components/cards/DokuCard';
import { useBackend } from '../../hooks/useBackend';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { AudioPlaybackControls } from '../../components/audio/AudioPlaybackControls';
import type { Doku } from '../../types/doku';
import type { AudioDoku } from '../../types/audio-doku';

// =====================================================
// BACKGROUND
// =====================================================
const DokuBackground: React.FC = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
    <motion.div
      className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-20"
      style={{ background: 'radial-gradient(circle, rgba(255,155,92,0.4) 0%, rgba(255,107,157,0.2) 50%, transparent 70%)' }}
      animate={{ scale: [1, 1.15, 1] }}
      transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full opacity-20"
      style={{ background: 'radial-gradient(circle, rgba(169,137,242,0.3) 0%, transparent 70%)' }}
      animate={{ scale: [1, 1.2, 1] }}
      transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
    />
  </div>
);

// =====================================================
// SECTION HEADER
// =====================================================
const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  count: number;
  gradient: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ icon, title, subtitle, count, gradient, actionLabel, onAction }) => (
  <div className="flex items-center justify-between mb-5">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md text-white" style={{ background: gradient }}>
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-bold text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
          {title}
        </h2>
        <p className="text-xs text-muted-foreground">{subtitle} ({count})</p>
      </div>
    </div>
    {onAction && actionLabel && (
      <motion.button
        whileHover={{ scale: 1.05, y: -1 }}
        whileTap={{ scale: 0.95 }}
        onClick={onAction}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-sm shadow-md hover:shadow-lg transition-shadow"
        style={{ background: gradient }}
      >
        <Plus className="w-4 h-4" />
        {actionLabel}
      </motion.button>
    )}
  </div>
);

// =====================================================
// AUDIO DOKU CARD
// =====================================================
const AudioDokuCard: React.FC<{
  doku: AudioDoku;
  index: number;
  onPlay: () => void;
}> = ({ doku, index, onPlay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.08, duration: 0.4 }}
    whileHover={{ y: -4 }}
    whileTap={{ scale: 0.98 }}
    onClick={onPlay}
    className="cursor-pointer group overflow-hidden rounded-2xl bg-white/[0.06] backdrop-blur-lg border border-white/[0.08] shadow-md hover:shadow-xl transition-all"
  >
    <div className="relative h-40 overflow-hidden">
      {doku.coverImageUrl ? (
        <img src={doku.coverImageUrl} alt={doku.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#A989F2]/15 to-[#8B6FDB]/15">
          <Headphones className="w-12 h-12 text-[#A989F2]/40" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

      {/* Play button */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          whileHover={{ scale: 1.15 }}
          className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-xl flex items-center justify-center shadow-xl border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Play className="w-5 h-5 text-white ml-0.5" />
        </motion.div>
      </div>

      {/* Audio badge */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#A989F2]/90 backdrop-blur-sm text-[10px] font-bold text-white">
        <Mic className="w-3 h-3" />
        Audio
      </div>
    </div>
    <div className="p-3.5">
      <h4 className="text-sm font-bold text-foreground line-clamp-1" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
        {doku.title}
      </h4>
      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{doku.description}</p>
    </div>
  </motion.div>
);

// =====================================================
// AUDIO MODAL
// =====================================================
const AudioModal: React.FC<{
  doku: AudioDoku;
  onClose: () => void;
  onPlay: () => void;
  isPlaying: boolean;
  audioError: string | null;
}> = ({ doku, onClose, onPlay, isPlaying, audioError }) => {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-[1200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#13102B]/95 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
      >
        {/* Cover */}
        <div className="relative h-48 overflow-hidden">
          {doku.coverImageUrl ? (
            <img src={doku.coverImageUrl} alt={doku.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#A989F2]/20 to-[#FF6B9D]/20">
              <Headphones className="w-16 h-16 text-[#A989F2]/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <h3 className="text-xl font-bold text-white" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
              {doku.title}
            </h3>
          </div>
          <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{doku.description}</p>

          {audioError && (
            <div className="text-sm text-red-400 mb-3 p-3 rounded-xl bg-red-500/10">{audioError}</div>
          )}

          <div className="rounded-2xl bg-muted/30 p-4">
            {isPlaying ? (
              <AudioPlaybackControls variant="full" showClose />
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onPlay}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold shadow-lg"
                style={{ background: 'linear-gradient(135deg, #A989F2 0%, #FF6B9D 100%)' }}
              >
                <Play className="w-5 h-5" />
                {t('doku.audioPlay', 'Abspielen')}
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// =====================================================
// LOADING
// =====================================================
const SectionLoading: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
    {[1, 2, 3].map((i) => (
      <div key={i} className="rounded-2xl overflow-hidden bg-white/[0.05] border border-white/[0.06]">
        <div className="h-40 bg-muted animate-pulse" />
        <div className="p-4 space-y-2">
          <div className="w-3/4 h-4 rounded bg-muted animate-pulse" />
          <div className="w-1/2 h-3 rounded bg-muted animate-pulse" />
        </div>
      </div>
    ))}
  </div>
);

// =====================================================
// MAIN SCREEN
// =====================================================
const TaleaDokusScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const backend = useBackend();
  const audioPlayer = useAudioPlayer();
  const { isSignedIn, isLoaded } = useUser();

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

  const myObserverRef = useRef<HTMLDivElement>(null);
  const publicObserverRef = useRef<HTMLDivElement>(null);

  const loadMyDokus = async () => {
    try {
      setLoadingMy(true);
      const res = await backend.doku.listDokus({ limit: 10, offset: 0 });
      setMyDokus(res.dokus as any[]);
      setTotalMy(res.total);
      setHasMoreMy(res.hasMore);
    } catch (e) { console.error(e); } finally { setLoadingMy(false); }
  };

  const loadPublicDokus = async () => {
    try {
      setLoadingPublic(true);
      const res = await backend.doku.listPublicDokus({ limit: 12, offset: 0 });
      setPublicDokus(res.dokus as any[]);
      setTotalPublic(res.total);
      setHasMorePublic(res.hasMore);
    } catch (e) { console.error(e); } finally { setLoadingPublic(false); }
  };

  const loadAudioDokus = async () => {
    try {
      setLoadingAudio(true);
      const res = await backend.doku.listAudioDokus({ limit: 12, offset: 0 });
      setAudioDokus(res.audioDokus as any[]);
      setTotalAudio(res.total);
    } catch (e) { console.error(e); } finally { setLoadingAudio(false); }
  };

  const loadMoreMy = useCallback(async () => {
    if (loadingMoreMy || !hasMoreMy) return;
    try {
      setLoadingMoreMy(true);
      const res = await backend.doku.listDokus({ limit: 10, offset: myDokus.length });
      setMyDokus(prev => [...prev, ...res.dokus as any[]]);
      setHasMoreMy(res.hasMore);
    } catch (e) { console.error(e); } finally { setLoadingMoreMy(false); }
  }, [backend, myDokus.length, hasMoreMy, loadingMoreMy]);

  const loadMorePublic = useCallback(async () => {
    if (loadingMorePublic || !hasMorePublic) return;
    try {
      setLoadingMorePublic(true);
      const res = await backend.doku.listPublicDokus({ limit: 12, offset: publicDokus.length });
      setPublicDokus(prev => [...prev, ...res.dokus as any[]]);
      setHasMorePublic(res.hasMore);
    } catch (e) { console.error(e); } finally { setLoadingMorePublic(false); }
  }, [backend, publicDokus.length, hasMorePublic, loadingMorePublic]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    loadMyDokus();
    loadPublicDokus();
    loadAudioDokus();
  }, [isLoaded, isSignedIn]);

  // Infinite scroll observers
  useEffect(() => {
    if (!isSignedIn) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasMoreMy && !loadingMoreMy && !loadingMy) loadMoreMy(); },
      { threshold: 0.1 }
    );
    const target = myObserverRef.current;
    if (target) observer.observe(target);
    return () => { if (target) observer.unobserve(target); };
  }, [hasMoreMy, loadingMoreMy, loadingMy, loadMoreMy, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasMorePublic && !loadingMorePublic && !loadingPublic) loadMorePublic(); },
      { threshold: 0.1 }
    );
    const target = publicObserverRef.current;
    if (target) observer.observe(target);
    return () => { if (target) observer.unobserve(target); };
  }, [hasMorePublic, loadingMorePublic, loadingPublic, loadMorePublic, isSignedIn]);

  const handleDeleteDoku = async (dokuId: string, dokuTitle: string) => {
    if (window.confirm(`${t('common.delete', 'Löschen')} "${dokuTitle}"?`)) {
      try {
        await backend.doku.deleteDoku({ id: dokuId });
        setMyDokus(myDokus.filter(d => d.id !== dokuId));
      } catch (e) { console.error(e); }
    }
  };

  const handleTogglePublic = async (dokuId: string, currentIsPublic: boolean) => {
    try {
      await backend.doku.updateDoku({ id: dokuId, isPublic: !currentIsPublic });
      setMyDokus(myDokus.map(d => d.id === dokuId ? { ...d, isPublic: !currentIsPublic } : d));
      if (currentIsPublic) setPublicDokus(publicDokus.filter(d => d.id !== dokuId));
    } catch (e) { console.error(e); }
  };

  const handlePlayAudio = (doku: AudioDoku) => {
    setAudioError(null);
    if (!doku.audioUrl) { setAudioError('Keine Audio-Datei verfügbar'); return; }
    audioPlayer.playTrack({ id: doku.id, title: doku.title, description: doku.description, coverImageUrl: doku.coverImageUrl, audioUrl: doku.audioUrl });
  };

  const isInitialLoading = isSignedIn && loadingMy && loadingPublic;

  // Loading dots component
  const LoadingDots = () => (
    <div className="flex items-center justify-center gap-2 py-4">
      {[0, 1, 2].map(i => (
        <motion.div key={i} className="w-2 h-2 rounded-full bg-[#FF9B5C]"
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen relative pb-28">
      <DokuBackground />

      <SignedOut>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[60vh] flex items-center justify-center text-center px-6">
          <div>
            <div className="text-6xl mb-6">🔒</div>
            <h2 className="text-2xl font-bold text-foreground mb-4" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
              {t('errors.unauthorized')}
            </h2>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => navigate('/auth')}
              className="px-6 py-3 rounded-2xl text-white font-bold shadow-lg"
              style={{ background: 'linear-gradient(135deg, #FF9B5C 0%, #FF6B9D 100%)' }}
            >
              {t('auth.signIn')}
            </motion.button>
          </div>
        </motion.div>
      </SignedOut>

      <SignedIn>
        <div className="relative z-10 pt-6 space-y-8">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="flex items-center gap-4 mb-2">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF9B5C] to-[#FF6B9D] flex items-center justify-center shadow-xl shadow-[#FF9B5C]/25"
              >
                <GraduationCap className="w-7 h-7 text-white" />
              </motion.div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
                  {t('doku.title', 'Wissensartikel')}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {totalMy + totalPublic} Artikel, {totalAudio} Audio
                </p>
              </div>
            </div>
          </motion.div>

          {isInitialLoading ? (
            <SectionLoading />
          ) : (
            <>
              {/* My Dokus */}
              <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <SectionHeader
                  icon={<FlaskConical className="w-5 h-5" />}
                  title={t('doku.myDokus', 'Meine Artikel')}
                  subtitle={t('doku.myDokusSubtitle', 'Deine persönlichen Wissensartikel')}
                  count={totalMy}
                  gradient="linear-gradient(135deg, #FF9B5C 0%, #FF6B9D 100%)"
                  actionLabel={t('doku.createNew', 'Neuer Artikel')}
                  onAction={() => navigate('/doku/create')}
                />

                {loadingMy ? <SectionLoading /> : myDokus.length === 0 ? (
                  <div className="text-center py-12 rounded-2xl bg-white/[0.04] backdrop-blur-lg border border-white/[0.08]">
                    <div className="text-4xl mb-3">🔬</div>
                    <p className="text-sm text-muted-foreground">{t('doku.noDokus', 'Noch keine Artikel')}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {myDokus.map((doku) => (
                      <DokuCard key={doku.id} doku={doku} onRead={(d) => navigate(`/doku-reader/${d.id}`)} onDelete={handleDeleteDoku} onTogglePublic={handleTogglePublic} />
                    ))}
                  </div>
                )}
                {hasMoreMy && <div ref={myObserverRef} className="h-4 mt-4">{loadingMoreMy && <LoadingDots />}</div>}
              </motion.section>

              {/* Public Dokus */}
              <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <SectionHeader
                  icon={<Globe className="w-5 h-5" />}
                  title={t('doku.publicDokus', 'Öffentliche Artikel')}
                  subtitle={t('doku.publicDokusSubtitle', 'Von der Community geteilt')}
                  count={totalPublic}
                  gradient="linear-gradient(135deg, #2DD4BF 0%, #0EA5E9 100%)"
                />

                {loadingPublic ? <SectionLoading /> : publicDokus.length === 0 ? (
                  <div className="text-center py-12 rounded-2xl bg-white/[0.04] backdrop-blur-lg border border-white/[0.08]">
                    <div className="text-4xl mb-3">🌍</div>
                    <p className="text-sm text-muted-foreground">{t('doku.noPublicDokus', 'Keine öffentlichen Artikel')}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {publicDokus.map((doku) => (
                      <DokuCard key={doku.id} doku={doku} onRead={(d) => navigate(`/doku-reader/${d.id}`)} />
                    ))}
                  </div>
                )}
                {hasMorePublic && <div ref={publicObserverRef} className="h-4 mt-4">{loadingMorePublic && <LoadingDots />}</div>}
              </motion.section>

              {/* Audio Dokus */}
              <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <SectionHeader
                  icon={<Headphones className="w-5 h-5" />}
                  title={t('doku.audioDokus', 'Audio-Artikel')}
                  subtitle={t('doku.audioDokusSubtitle', 'Zum Anhören')}
                  count={totalAudio}
                  gradient="linear-gradient(135deg, #A989F2 0%, #8B6FDB 100%)"
                  actionLabel={t('doku.audioCreateButton', 'Audio erstellen')}
                  onAction={() => navigate('/createaudiodoku')}
                />

                {loadingAudio ? <SectionLoading /> : audioDokus.length === 0 ? (
                  <div className="text-center py-12 rounded-2xl bg-white/[0.04] backdrop-blur-lg border border-white/[0.08]">
                    <div className="text-4xl mb-3">🎧</div>
                    <p className="text-sm text-muted-foreground">{t('doku.noAudioDokus', 'Noch keine Audio-Artikel')}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {audioDokus.map((doku, i) => (
                      <AudioDokuCard key={doku.id} doku={doku} index={i} onPlay={() => setAudioModal(doku)} />
                    ))}
                  </div>
                )}
              </motion.section>
            </>
          )}
        </div>

        {/* Audio Modal */}
        <AnimatePresence>
          {audioModal && (
            <AudioModal
              doku={audioModal}
              onClose={() => setAudioModal(null)}
              onPlay={() => handlePlayAudio(audioModal)}
              isPlaying={audioPlayer.track?.id === audioModal.id}
              audioError={audioError}
            />
          )}
        </AnimatePresence>
      </SignedIn>
    </div>
  );
};

export default TaleaDokusScreen;
