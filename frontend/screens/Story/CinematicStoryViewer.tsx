import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion, useScroll, useSpring, useInView } from 'framer-motion';
import { ArrowLeft, ChevronDown, Sparkles, Volume2, BookOpen } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';

import { useBackend } from '../../hooks/useBackend';
import { CinematicText } from '../../components/ui/cinematic-text';
import ArtifactRewardToast from '../../components/gamification/ArtifactRewardToast';
import ArtifactCelebrationModal, { UnlockedArtifact } from '../../components/gamification/ArtifactCelebrationModal';
import type { Story, Chapter } from '../../types/story';
import type { InventoryItem } from '../../types/avatar';
import { cn } from '../../lib/utils';
import { StoryAudioActions } from '../../components/story/StoryAudioActions';
import { useTheme } from '../../contexts/ThemeContext';
import { extractStoryParticipantIds } from '../../utils/storyParticipants';
import { getOfflineStory } from '../../utils/offlineDb';
import { buildChapterTextSegments, resolveChapterImageInsertPoints } from '../../utils/chapterImagePlacement';
import { emitMapProgress } from '../Journey/TaleaLearningPathProgressStore';
import './CinematicStoryViewer.css';

/* ── Palette ── */
type StoryPalette = {
  page: string;
  topBar: string;
  topBarBorder: string;
  heroOverlay: string;
  card: string;
  cardBorder: string;
  title: string;
  body: string;
  sub: string;
  accent: string;
  accentSoft: string;
};

const getStoryPalette = (isDark: boolean): StoryPalette => {
  if (isDark) {
    return {
      page: '#0a0908',
      topBar: 'rgba(10,9,8,0.82)',
      topBarBorder: 'rgba(232,168,56,0.1)',
      heroOverlay: 'linear-gradient(180deg, rgba(10,9,8,0.1) 0%, rgba(10,9,8,0.85) 100%)',
      card: 'rgba(18,16,12,0.9)',
      cardBorder: 'rgba(232,168,56,0.08)',
      title: '#e8ddd0',
      body: '#b8a898',
      sub: '#786858',
      accent: '#e8a838',
      accentSoft: 'rgba(232,168,56,0.08)',
    };
  }
  return {
    page: '#faf6f0',
    topBar: 'rgba(250,246,240,0.85)',
    topBarBorder: 'rgba(196,120,50,0.12)',
    heroOverlay: 'linear-gradient(180deg, rgba(32,28,20,0.08) 0%, rgba(32,28,20,0.6) 100%)',
    card: 'rgba(255,252,248,0.92)',
    cardBorder: 'rgba(196,120,50,0.1)',
    title: '#2c2418',
    body: '#5c4e3e',
    sub: '#8c7e6e',
    accent: '#c47832',
    accentSoft: 'rgba(196,120,50,0.08)',
  };
};

/* ── Helpers ── */
const collectArtifactsFromChanges = (personalityChanges: any[]): Array<{ item: InventoryItem; isUpgrade: boolean }> => {
  if (!Array.isArray(personalityChanges)) return [];
  const collected: Array<{ item: InventoryItem; isUpgrade: boolean }> = [];
  personalityChanges.forEach((avatarChange) => {
    const rewards = avatarChange?.rewards;
    if (!rewards) return;
    if (Array.isArray(rewards.newItems)) {
      rewards.newItems.forEach((item: InventoryItem) => collected.push({ item, isUpgrade: false }));
    }
    if (Array.isArray(rewards.upgradedItems)) {
      rewards.upgradedItems.forEach((item: InventoryItem) => collected.push({ item, isUpgrade: true }));
    }
  });
  return collected;
};

/* ── Ambient Particles ── */
const PARTICLES = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  x: `${12 + Math.random() * 76}%`,
  dur: `${10 + Math.random() * 8}s`,
  delay: `${Math.random() * 10}s`,
}));

/* ── Main Component ── */
const CinematicStoryViewer: React.FC = () => {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backend = useBackend();
  const { getToken } = useAuth();
  const { resolvedTheme } = useTheme();

  const containerRef = useRef<HTMLDivElement>(null);

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [storyCompleted, setStoryCompleted] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [activeChapter, setActiveChapter] = useState(0);

  const [artifactQueue, setArtifactQueue] = useState<Array<{ item: InventoryItem; isUpgrade: boolean }>>([]);
  const [currentArtifact, setCurrentArtifact] = useState<{ item: InventoryItem; isUpgrade: boolean } | null>(null);
  const [poolArtifact, setPoolArtifact] = useState<UnlockedArtifact | null>(null);
  const [showPoolArtifactModal, setShowPoolArtifactModal] = useState(false);

  const isDark = resolvedTheme === 'dark';
  const palette = useMemo(() => getStoryPalette(isDark), [isDark]);
  const mapAvatarId = useMemo(
    () => new URLSearchParams(location.search).get('mapAvatarId'),
    [location.search],
  );

  const { scrollYProgress } = useScroll({ container: containerRef });
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 34, restDelta: 0.001 });

  useEffect(() => {
    if (storyId) void loadStory();
  }, [storyId]);

  useEffect(() => {
    if (!currentArtifact && artifactQueue.length > 0) {
      const [next, ...rest] = artifactQueue;
      setCurrentArtifact(next);
      setArtifactQueue(rest);
    }
  }, [currentArtifact, artifactQueue]);

  const loadStory = async () => {
    if (!storyId) return;
    try {
      setLoading(true);
      setError(null);
      let rawStory: any = await getOfflineStory(storyId);
      if (!rawStory) {
        const storyData = await backend.story.get({ id: storyId });
        rawStory = storyData as any;
      }
      setStory(rawStory as Story);
      if (rawStory?.avatarParticipants?.length) {
        setParticipants(rawStory.avatarParticipants);
      } else if (Array.isArray(rawStory?.config?.avatars) && rawStory.config.avatars.length > 0) {
        setParticipants(rawStory.config.avatars);
      } else if (Array.isArray(rawStory?.config?.avatarIds) && rawStory.config.avatarIds.length > 0) {
        try {
          const avatars = await Promise.all(
            rawStory.config.avatarIds.map((id: string) => backend.avatar.get({ id }))
          );
          setParticipants(avatars.filter(Boolean));
        } catch (e) {
          console.error('Error loading participants:', e);
        }
      } else {
        setParticipants([]);
      }
    } catch (err) {
      console.error('Error loading story:', err);
      setError('Geschichte konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = () => {
    setStarted(true);
    setTimeout(() => {
      const el = document.getElementById('chapter-0');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleStoryCompletion = async () => {
    if (!story || !storyId || storyCompleted) return;
    try {
      setStoryCompleted(true);
      const token = await getToken();
      const { getBackendUrl } = await import('../../config');
      const target = getBackendUrl();
      const response = await fetch(`${target}/story/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify((() => {
          const participantAvatarIds = extractStoryParticipantIds(story);
          return {
            storyId,
            storyTitle: story.title,
            genre: story.config.genre,
            ...(participantAvatarIds.length > 0 ? { avatarIds: participantAvatarIds } : {}),
          };
        })()),
      });

      const { showSuccessToast, showPersonalityUpdateToast } = await import('../../utils/toastUtils');

      if (!response.ok) {
        showSuccessToast('Geschichte abgeschlossen.');
        emitMapProgress({ avatarId: mapAvatarId, source: 'story' });
        return;
      }

      const result = await response.json();
      window.dispatchEvent(
        new CustomEvent('personalityUpdated', {
          detail: {
            avatarId: mapAvatarId ?? undefined,
            refreshProgression: true,
            source: 'story',
            updatedAt: new Date().toISOString(),
          },
        }),
      );

      if (result?.unlockedArtifact) {
        setPoolArtifact(result.unlockedArtifact as UnlockedArtifact);
        setTimeout(() => setShowPoolArtifactModal(true), 260);
      }

      const collectedArtifacts = collectArtifactsFromChanges(result?.personalityChanges ?? []);
      if (collectedArtifacts.length > 0) setArtifactQueue(collectedArtifacts);

      if (Array.isArray(result?.personalityChanges) && result.personalityChanges.length > 0) {
        showSuccessToast(
          `Geschichte abgeschlossen. ${result.updatedAvatars ?? result.personalityChanges.length} Avatar(e) aktualisiert.`
        );
        const mergedByTrait = new Map<string, number>();
        result.personalityChanges.forEach((avatarChange: any) => {
          if (!Array.isArray(avatarChange?.changes)) return;
          avatarChange.changes.forEach((change: any) => {
            if (!change?.trait || typeof change.change !== 'number') return;
            mergedByTrait.set(change.trait, (mergedByTrait.get(change.trait) || 0) + change.change);
          });
        });
        const mergedChanges = Array.from(mergedByTrait.entries()).map(([trait, change]) => ({ trait, change }));
        if (mergedChanges.length > 0) {
          setTimeout(() => {
            showPersonalityUpdateToast(mergedChanges, {
              title: 'Persoenlichkeit entwickelt sich',
              subtitle: `${result.updatedAvatars ?? result.personalityChanges.length} Avatar(e) aktualisiert`,
            });
          }, 700);
        }
      } else {
        showSuccessToast('Geschichte abgeschlossen.');
      }
      emitMapProgress({ avatarId: mapAvatarId, source: 'story' });
    } catch (error) {
      console.error('Error completing story:', error);
      const { showSuccessToast } = await import('../../utils/toastUtils');
      showSuccessToast('Geschichte abgeschlossen.');
      emitMapProgress({ avatarId: mapAvatarId, source: 'story' });
    }
  };

  const scrollToChapter = useCallback((idx: number) => {
    const el = document.getElementById(`chapter-${idx}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className={cn('sr-loading', isDark ? 'sr-page--dark' : 'sr-page--light')}>
        <div className="sr-loading-spinner" />
        <p className="sr-loading-text">Geschichte wird geladen</p>
      </div>
    );
  }

  /* ── Error / Not Found ── */
  if (!story) {
    return (
      <div className={cn('sr-loading', isDark ? 'sr-page--dark' : 'sr-page--light')}>
        <p style={{ fontFamily: 'var(--sr-font-heading)', fontSize: '1.4rem', color: palette.title }}>
          {error || 'Geschichte wurde nicht gefunden.'}
        </p>
        <button type="button" onClick={() => navigate('/stories')} className="sr-finale-btn" style={{ marginTop: '1rem' }}>
          Zurueck zu Geschichten
        </button>
      </div>
    );
  }

  const chapters = story.chapters?.length ? story.chapters : story.pages || [];
  const castMembers = participants.length > 0 ? participants : story.avatarParticipants || story.config.avatars || [];

  return (
    <div className={cn('fixed inset-0 overflow-hidden', isDark ? 'sr-page--dark' : 'sr-page--light')}>
      {/* Film grain texture */}
      <div className="sr-film-grain" />

      {/* Ambient floating particles */}
      {isDark && PARTICLES.map((p) => (
        <div
          key={p.id}
          className="sr-ambient-particle"
          style={{ '--x': p.x, '--dur': p.dur, '--delay': p.delay } as React.CSSProperties}
        />
      ))}

      {/* Progress bar */}
      {started && (
        <motion.div
          className="fixed left-0 right-0 top-0 z-[80] origin-left sr-progress-bar"
          style={{ scaleX }}
        />
      )}

      {/* Floating header */}
      <header
        className="sr-header fixed left-1/2 top-3 z-[70] flex w-[min(720px,calc(100vw-1.2rem))] -translate-x-1/2 items-center justify-between rounded-2xl border px-3 py-2"
        style={{ borderColor: palette.topBarBorder, background: palette.topBar }}
      >
        <button
          type="button"
          onClick={() => navigate('/stories')}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors"
          style={{ color: palette.sub }}
          aria-label="Zurueck zu Geschichten"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="min-w-0 px-3 text-center">
          <p className="truncate text-[0.65rem] uppercase tracking-[0.2em]" style={{ color: palette.sub, fontFamily: 'var(--sr-font-ui)' }}>
            {story.config.genre || 'Story'}
          </p>
          <p className="truncate text-sm font-semibold" style={{ color: palette.title, fontFamily: 'var(--sr-font-heading)' }}>
            {story.title}
          </p>
        </div>

        <span
          className="inline-flex h-9 items-center rounded-full px-2.5 text-[0.65rem] uppercase tracking-[0.15em]"
          style={{ color: palette.sub, fontFamily: 'var(--sr-font-ui)' }}
        >
          {chapters.length} Kap.
        </span>
      </header>

      {/* Chapter navigation dots */}
      {started && chapters.length > 1 && (
        <nav className="sr-chapter-nav" aria-label="Kapitel Navigation">
          {chapters.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => scrollToChapter(idx)}
              className={cn('sr-chapter-nav-dot', activeChapter === idx && 'sr-chapter-nav-dot--active')}
              aria-label={`Kapitel ${idx + 1}`}
            />
          ))}
        </nav>
      )}

      {/* Scrollable content */}
      <div ref={containerRef} className="h-full overflow-y-auto scroll-smooth">
        {/* ── Hero Section ── */}
        <section className="sr-hero-cover">
          <img
            src={story.coverImageUrl || '/placeholder-story.jpg'}
            alt={story.title}
            className="sr-hero-img"
          />
          <div className="sr-hero-overlay" />
          <div className="sr-hero-vignette" />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.2, 0.65, 0.3, 0.9] }}
            className="sr-hero-card"
          >
            <span className="sr-hero-badge">
              <BookOpen className="h-3 w-3" />
              Vorlese-Modus
            </span>

            <h1 className="sr-hero-title">{story.title}</h1>
            <p className="sr-hero-summary">{story.summary}</p>

            <motion.button
              type="button"
              onClick={handleStart}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="sr-hero-start-btn"
            >
              Geschichte starten
              <ChevronDown className="h-4 w-4" />
            </motion.button>

            {chapters.length > 0 && (
              <div className="mt-4">
                <StoryAudioActions
                  storyId={story.id}
                  storyTitle={story.title}
                  chapters={chapters}
                  coverImageUrl={story.coverImageUrl}
                />
              </div>
            )}
          </motion.div>
        </section>

        {/* ── Chapters ── */}
        {chapters.map((chapter, index) => (
          <React.Fragment key={chapter.id || `${chapter.title}-${index}`}>
            {/* Divider between chapters */}
            <ChapterDivider />

            <ChapterSection
              chapter={chapter}
              index={index}
              total={chapters.length}
              palette={palette}
              isDark={isDark}
              onComplete={index === chapters.length - 1 ? handleStoryCompletion : undefined}
              isCompleted={storyCompleted}
              onBecomeActive={() => setActiveChapter(index)}
            />
          </React.Fragment>
        ))}

        {/* ── Cast Members ── */}
        {castMembers.length > 0 && (
          <section className="sr-cast-section">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="sr-cast-header" style={{ color: palette.title }}>
                Teilnehmende Charaktere
              </h2>
              <p style={{ textAlign: 'center', fontSize: '0.85rem', color: palette.sub, fontFamily: 'var(--sr-font-story)' }}>
                Die Helden dieser Geschichte
              </p>

              <div className="sr-cast-grid">
                {castMembers.map((avatar: any, index: number) => (
                  <motion.div
                    key={`${avatar.id || avatar.name}-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.3, delay: index * 0.06 }}
                    className="sr-cast-card"
                    style={{ background: palette.accentSoft, borderColor: palette.cardBorder }}
                  >
                    <div className="sr-cast-avatar">
                      {avatar.imageUrl ? (
                        <img src={avatar.imageUrl} alt={avatar.name} />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center" style={{ background: palette.card, color: palette.sub }}>
                          <Volume2 className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <p className="sr-cast-name" style={{ color: palette.title }}>{avatar.name || 'Unbekannt'}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </section>
        )}

        {/* ── Finale ── */}
        <section className="sr-finale">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            <div className="sr-finale-ornament">
              <div className="sr-finale-ornament-line" />
              <div className="sr-finale-ornament-diamond" />
              <div className="sr-finale-ornament-line" />
            </div>

            <h2 className="sr-finale-title" style={{ color: palette.title }}>
              Ende der Geschichte
            </h2>
            <p className="sr-finale-text" style={{ color: palette.body }}>
              Du kannst zur Uebersicht zurueckkehren oder direkt die naechste Geschichte lesen.
            </p>
            <button
              type="button"
              onClick={() => navigate('/stories')}
              className="sr-finale-btn"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Zurueck zur Uebersicht
            </button>
          </motion.div>
        </section>
      </div>

      {/* ── Modals ── */}
      <ArtifactRewardToast
        item={currentArtifact?.item || null}
        isVisible={!!currentArtifact}
        onClose={() => setCurrentArtifact(null)}
        isUpgrade={currentArtifact?.isUpgrade}
      />

      <ArtifactCelebrationModal
        artifact={poolArtifact}
        isVisible={showPoolArtifactModal}
        onClose={() => { setShowPoolArtifactModal(false); setPoolArtifact(null); }}
        onViewTreasureRoom={() => { setShowPoolArtifactModal(false); setPoolArtifact(null); navigate('/treasure-room'); }}
      />
    </div>
  );
};

/* ── Chapter Divider ── */
const ChapterDivider: React.FC = () => (
  <motion.div
    className="sr-chapter-divider"
    initial={{ opacity: 0 }}
    whileInView={{ opacity: 1 }}
    viewport={{ once: true, amount: 0.5 }}
    transition={{ duration: 0.6 }}
  >
    <div className="sr-chapter-divider-line" />
    <div className="sr-chapter-divider-ornament" />
    <div className="sr-chapter-divider-line" />
  </motion.div>
);

/* ── Chapter Section ── */
const ChapterSection: React.FC<{
  chapter: Chapter;
  index: number;
  total: number;
  palette: StoryPalette;
  isDark: boolean;
  onComplete?: () => void;
  isCompleted?: boolean;
  onBecomeActive: () => void;
}> = ({ chapter, index, total, palette, isDark, onComplete, isCompleted, onBecomeActive }) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { amount: 0.3 });
  const paragraphs = useMemo(() => buildChapterTextSegments(
    String(chapter.content || ""),
    Boolean(chapter.imageUrl),
    Boolean(chapter.scenicImageUrl)
  ), [chapter.content, chapter.imageUrl, chapter.scenicImageUrl]);
  const insertPoints = resolveChapterImageInsertPoints(
    paragraphs.length,
    Boolean(chapter.imageUrl),
    Boolean(chapter.scenicImageUrl)
  );
  const primaryImage = chapter.imageUrl || `https://picsum.photos/seed/chapter-${index}/1920/1080`;
  const scenicImage = chapter.scenicImageUrl;

  useEffect(() => {
    if (isInView) onBecomeActive();
  }, [isInView]);

  return (
    <section
      id={`chapter-${index}`}
      ref={sectionRef}
      className="sr-chapter"
      style={{ paddingTop: '1rem', paddingBottom: '2rem' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.7, ease: [0.2, 0.65, 0.3, 0.9] }}
        className="mb-8 text-center"
      >
        <div className="flex flex-col items-center gap-2">
          <span className="sr-chapter-number" style={{ color: palette.sub }}>
            Kapitel {index + 1} von {total}
          </span>
          <h2 className="sr-chapter-title" style={{ color: palette.title, marginTop: 0 }}>{chapter.title}</h2>
        </div>
      </motion.div>

      {/* Chapter Content */}
      <div className="sr-chapter-content">
        {paragraphs.map((paragraph, paragraphIndex) => (
          <React.Fragment key={`${chapter.id || index}-paragraph-${paragraphIndex}`}>
            <CinematicText
              text={paragraph}
              paragraphClassName="sr-paragraph"
              paragraphStyle={{ color: palette.title }}
              className="space-y-0"
              enableDropCap={paragraphIndex === 0}
            />

            {insertPoints.primaryAfterSegment === paragraphIndex && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.6 }}
                className="sr-chapter-image-wrap"
                style={{ marginTop: "1.3rem", marginBottom: "1.3rem" }}
              >
                <img src={primaryImage} alt={`${chapter.title} - Szene`} className="sr-chapter-image" />
                <div className="sr-chapter-image-overlay" />
              </motion.div>
            )}

            {insertPoints.scenicAfterSegment === paragraphIndex && scenicImage && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.6 }}
                className="sr-chapter-image-wrap"
                style={{ marginTop: "1.3rem", marginBottom: "1.3rem" }}
              >
                <img src={scenicImage} alt={`${chapter.title} - Umgebung`} className="sr-chapter-image" />
                <div className="sr-chapter-image-overlay" />
              </motion.div>
            )}
          </React.Fragment>
        ))}

        {onComplete && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 }}
            style={{ marginTop: '2rem' }}
          >
            <button
              type="button"
              onClick={onComplete}
              disabled={isCompleted}
              className={cn('sr-complete-btn', isCompleted ? 'sr-complete-btn--done' : 'sr-complete-btn--default')}
            >
              <Sparkles className="h-4 w-4" />
              {isCompleted ? 'Abgeschlossen' : 'Geschichte abschliessen'}
            </button>
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default CinematicStoryViewer;

