import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, useScroll, useSpring } from 'framer-motion';
import { ArrowLeft, ChevronDown, Sparkles, Volume2 } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';

import { useBackend } from '../../hooks/useBackend';
import { CinematicText } from '../../components/ui/cinematic-text';
import { Typewriter } from '../../components/ui/typewriter-text';
import ArtifactRewardToast from '../../components/gamification/ArtifactRewardToast';
import ArtifactCelebrationModal, { UnlockedArtifact } from '../../components/gamification/ArtifactCelebrationModal';
import type { Story, Chapter } from '../../types/story';
import type { InventoryItem } from '../../types/avatar';
import { cn } from '../../lib/utils';
import { AudioPlayer } from '../../components/story/AudioPlayer';
import { useTheme } from '../../contexts/ThemeContext';
import { extractStoryParticipantIds } from '../../utils/storyParticipants';

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

const headingFont = '"Cormorant Garamond", "Merriweather", serif';

const getStoryPalette = (isDark: boolean): StoryPalette => {
  if (isDark) {
    return {
      page:
        'radial-gradient(980px 520px at 100% 0%, rgba(122,92,144,0.28) 0%, transparent 56%), radial-gradient(980px 620px at 0% 12%, rgba(88,114,154,0.24) 0%, transparent 62%), #121b2a',
      topBar: 'rgba(20,29,43,0.78)',
      topBarBorder: '#354960',
      heroOverlay: 'linear-gradient(180deg, rgba(10,16,24,0.16) 0%, rgba(10,16,24,0.78) 100%)',
      card: 'rgba(24,35,51,0.9)',
      cardBorder: '#3a5069',
      title: '#e9f0fc',
      body: '#c4d2e5',
      sub: '#9aacbf',
      accent: '#8ba3ce',
      accentSoft: 'rgba(139,163,206,0.2)',
    };
  }

  return {
    page:
      'radial-gradient(980px 520px at 100% 0%, #efdfe7 0%, transparent 56%), radial-gradient(980px 620px at 0% 12%, #dbe7ef 0%, transparent 62%), #f8f1e8',
    topBar: 'rgba(255,250,243,0.82)',
    topBarBorder: '#dfd2c2',
    heroOverlay: 'linear-gradient(180deg, rgba(32,41,58,0.08) 0%, rgba(32,41,58,0.56) 100%)',
    card: 'rgba(255,250,243,0.92)',
    cardBorder: '#dccdbb',
    title: '#253448',
    body: '#51657f',
    sub: '#6d7f95',
    accent: '#8e7bb7',
    accentSoft: 'rgba(142,123,183,0.2)',
  };
};

const collectArtifactsFromChanges = (personalityChanges: any[]): Array<{ item: InventoryItem; isUpgrade: boolean }> => {
  if (!Array.isArray(personalityChanges)) {
    return [];
  }

  const collected: Array<{ item: InventoryItem; isUpgrade: boolean }> = [];

  personalityChanges.forEach((avatarChange) => {
    const rewards = avatarChange?.rewards;
    if (!rewards) {
      return;
    }

    if (Array.isArray(rewards.newItems)) {
      rewards.newItems.forEach((item: InventoryItem) => {
        collected.push({ item, isUpgrade: false });
      });
    }

    if (Array.isArray(rewards.upgradedItems)) {
      rewards.upgradedItems.forEach((item: InventoryItem) => {
        collected.push({ item, isUpgrade: true });
      });
    }
  });

  return collected;
};

const CinematicStoryViewer: React.FC = () => {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
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

  const [artifactQueue, setArtifactQueue] = useState<Array<{ item: InventoryItem; isUpgrade: boolean }>>([]);
  const [currentArtifact, setCurrentArtifact] = useState<{ item: InventoryItem; isUpgrade: boolean } | null>(null);
  const [poolArtifact, setPoolArtifact] = useState<UnlockedArtifact | null>(null);
  const [showPoolArtifactModal, setShowPoolArtifactModal] = useState(false);

  const isDark = resolvedTheme === 'dark';
  const palette = useMemo(() => getStoryPalette(isDark), [isDark]);

  const { scrollYProgress } = useScroll({ container: containerRef });
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 34,
    restDelta: 0.001,
  });

  useEffect(() => {
    if (storyId) {
      void loadStory();
    }
  }, [storyId]);

  useEffect(() => {
    if (!currentArtifact && artifactQueue.length > 0) {
      const [next, ...rest] = artifactQueue;
      setCurrentArtifact(next);
      setArtifactQueue(rest);
    }
  }, [currentArtifact, artifactQueue]);

  const loadStory = async () => {
    if (!storyId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const storyData = await backend.story.get({ id: storyId });
      const rawStory = storyData as any;
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
        } catch (participantError) {
          console.error('Error loading participants:', participantError);
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
      const firstChapter = document.getElementById('chapter-0');
      firstChapter?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleStoryCompletion = async () => {
    if (!story || !storyId || storyCompleted) {
      return;
    }

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
        return;
      }

      const result = await response.json();

      if (result?.unlockedArtifact) {
        setPoolArtifact(result.unlockedArtifact as UnlockedArtifact);
        setTimeout(() => {
          setShowPoolArtifactModal(true);
        }, 260);
      }

      const collectedArtifacts = collectArtifactsFromChanges(result?.personalityChanges ?? []);
      if (collectedArtifacts.length > 0) {
        setArtifactQueue(collectedArtifacts);
      }

      if (Array.isArray(result?.personalityChanges) && result.personalityChanges.length > 0) {
        showSuccessToast(
          `Geschichte abgeschlossen. ${result.updatedAvatars ?? result.personalityChanges.length} Avatar(e) aktualisiert.`
        );

        const mergedByTrait = new Map<string, number>();
        result.personalityChanges.forEach((avatarChange: any) => {
          if (!Array.isArray(avatarChange?.changes)) {
            return;
          }
          avatarChange.changes.forEach((change: any) => {
            if (!change?.trait || typeof change.change !== 'number') {
              return;
            }
            mergedByTrait.set(change.trait, (mergedByTrait.get(change.trait) || 0) + change.change);
          });
        });

        const mergedChanges = Array.from(mergedByTrait.entries()).map(([trait, change]) => ({
          trait,
          change,
        }));

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
    } catch (error) {
      console.error('Error completing story:', error);
      const { showSuccessToast } = await import('../../utils/toastUtils');
      showSuccessToast('Geschichte abgeschlossen.');
    }
  };

  const handleCloseArtifact = () => {
    setCurrentArtifact(null);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: palette.page }}>
        <div className="rounded-3xl border px-8 py-7 text-center" style={{ borderColor: palette.cardBorder, background: palette.card }}>
          <div className="mx-auto mb-3 h-12 w-12 animate-spin rounded-full border-4 border-transparent" style={{ borderTopColor: palette.accent, borderRightColor: palette.accent }} />
          <p className="text-sm tracking-[0.18em] uppercase" style={{ color: palette.sub }}>
            Geschichte wird geladen
          </p>
        </div>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: palette.page }}>
        <div className="rounded-3xl border px-8 py-7 text-center" style={{ borderColor: palette.cardBorder, background: palette.card }}>
          <p className="text-lg font-semibold" style={{ color: palette.title }}>
            {error || 'Geschichte wurde nicht gefunden.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/stories')}
            className="mt-4 rounded-full border px-4 py-2 text-sm"
            style={{ borderColor: palette.cardBorder, color: palette.sub }}
          >
            Zurueck zu Geschichten
          </button>
        </div>
      </div>
    );
  }

  const chapters = story.chapters?.length ? story.chapters : story.pages || [];
  const castMembers = participants.length > 0 ? participants : story.avatarParticipants || story.config.avatars || [];

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: palette.page }}>
      {started && (
        <motion.div
          className="fixed left-0 right-0 top-0 z-[80] h-1 origin-left"
          style={{
            scaleX,
            background: `linear-gradient(90deg, ${palette.accent} 0%, #b087c8 100%)`,
          }}
        />
      )}

      <header
        className="fixed left-1/2 top-3 z-[70] flex w-[min(980px,calc(100vw-1.2rem))] -translate-x-1/2 items-center justify-between rounded-2xl border px-3 py-2 backdrop-blur-xl"
        style={{ borderColor: palette.topBarBorder, background: palette.topBar }}
      >
        <button
          type="button"
          onClick={() => navigate('/stories')}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border"
          style={{ borderColor: palette.topBarBorder, color: palette.title, background: palette.card }}
          aria-label="Zurueck zu Geschichten"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>

        <div className="min-w-0 px-3 text-center">
          <p className="truncate text-xs uppercase tracking-[0.18em]" style={{ color: palette.sub }}>
            {story.config.genre || 'Story'}
          </p>
          <p className="truncate text-sm font-semibold" style={{ color: palette.title }}>
            {story.title}
          </p>
        </div>

        <span className="inline-flex h-10 items-center rounded-full border px-3 text-xs" style={{ borderColor: palette.topBarBorder, color: palette.sub }}>
          {chapters.length} Kapitel
        </span>
      </header>

      <div ref={containerRef} className="h-full overflow-y-auto scroll-smooth pt-0">
        <section className="relative flex min-h-[100svh] items-center justify-center px-4 pb-16 pt-24">
          <div className="absolute inset-0 z-0">
            <img
              src={story.coverImageUrl || '/placeholder-story.jpg'}
              alt={story.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0" style={{ background: palette.heroOverlay }} />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative z-10 mx-auto w-full max-w-4xl rounded-[30px] border p-6 text-center shadow-[0_24px_52px_rgba(16,22,34,0.28)] backdrop-blur"
            style={{ borderColor: palette.cardBorder, background: palette.card }}
          >
            <span className="inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em]" style={{ borderColor: palette.cardBorder, color: palette.sub, background: palette.accentSoft }}>
              Vorlese-Modus
            </span>
            <h1 className="mt-4 text-4xl leading-tight md:text-6xl" style={{ fontFamily: headingFont, color: palette.title }}>
              {story.title}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed md:text-lg" style={{ color: palette.body }}>
              {story.summary}
            </p>

            <motion.button
              type="button"
              onClick={handleStart}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_22px_rgba(69,102,128,0.34)]"
              style={{ background: `linear-gradient(135deg, ${palette.accent} 0%, #b087c8 100%)` }}
            >
              Geschichte starten
              <ChevronDown className="h-4 w-4" />
            </motion.button>
          </motion.div>
        </section>

        {chapters.map((chapter, index) => (
          <ChapterSection
            key={chapter.id || `${chapter.title}-${index}`}
            chapter={chapter}
            index={index}
            total={chapters.length}
            palette={palette}
            onComplete={index === chapters.length - 1 ? handleStoryCompletion : undefined}
            isCompleted={storyCompleted}
          />
        ))}

        {castMembers.length > 0 && (
          <section className="px-4 pb-8 pt-3 md:px-6">
            <div className="mx-auto w-full max-w-6xl rounded-[28px] border p-6 md:p-8" style={{ borderColor: palette.cardBorder, background: palette.card }}>
              <div className="mb-6 text-center">
                <h2 className="text-3xl md:text-4xl" style={{ fontFamily: headingFont, color: palette.title }}>
                  Teilnehmende Charaktere
                </h2>
                <p className="mt-1 text-sm" style={{ color: palette.body }}>
                  Wer in dieser Geschichte eine Rolle spielt.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {castMembers.map((avatar: any, index: number) => (
                  <motion.div
                    key={`${avatar.id || avatar.name}-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.28, delay: index * 0.04 }}
                    className="rounded-2xl border p-3 text-center"
                    style={{ borderColor: palette.cardBorder, background: palette.accentSoft }}
                  >
                    <div className="mx-auto h-16 w-16 overflow-hidden rounded-full border" style={{ borderColor: palette.cardBorder, background: palette.card }}>
                      {avatar.imageUrl ? (
                        <img src={avatar.imageUrl} alt={avatar.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center" style={{ color: palette.sub }}>
                          <Volume2 className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-semibold" style={{ color: palette.title }}>
                      {avatar.name || 'Unbekannt'}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="relative flex min-h-[40svh] items-center justify-center px-4 pb-24 pt-12">
          <div className="w-full max-w-3xl rounded-[26px] border p-6 text-center" style={{ borderColor: palette.cardBorder, background: palette.card }}>
            <h2 className="text-3xl" style={{ fontFamily: headingFont, color: palette.title }}>
              Ende der Geschichte
            </h2>
            <p className="mt-2 text-sm" style={{ color: palette.body }}>
              Du kannst zur Uebersicht zurueckkehren oder direkt die naechste Geschichte lesen.
            </p>
            <button
              type="button"
              onClick={() => navigate('/stories')}
              className="mt-5 rounded-full border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: palette.cardBorder, color: palette.sub }}
            >
              Zurueck zur Uebersicht
            </button>
          </div>
        </section>
      </div>

      <ArtifactRewardToast
        item={currentArtifact?.item || null}
        isVisible={!!currentArtifact}
        onClose={handleCloseArtifact}
        isUpgrade={currentArtifact?.isUpgrade}
      />

      <ArtifactCelebrationModal
        artifact={poolArtifact}
        isVisible={showPoolArtifactModal}
        onClose={() => {
          setShowPoolArtifactModal(false);
          setPoolArtifact(null);
        }}
        onViewTreasureRoom={() => {
          setShowPoolArtifactModal(false);
          setPoolArtifact(null);
          navigate('/treasure-room');
        }}
      />
    </div>
  );
};

const ChapterSection: React.FC<{
  chapter: Chapter;
  index: number;
  total: number;
  palette: StoryPalette;
  onComplete?: () => void;
  isCompleted?: boolean;
}> = ({ chapter, index, total, palette, onComplete, isCompleted }) => {
  const [headerInView, setHeaderInView] = useState(false);

  return (
    <section id={`chapter-${index}`} className="relative px-4 py-10 md:px-6 md:py-14">
      <motion.article
        initial={{ opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.46 }}
        className="mx-auto w-full max-w-6xl overflow-hidden rounded-[30px] border shadow-[0_18px_44px_rgba(21,30,44,0.2)]"
        style={{ borderColor: palette.cardBorder, background: palette.card }}
      >
        <div className="relative h-56 overflow-hidden md:h-[320px]">
          <img
            src={chapter.imageUrl || `https://picsum.photos/seed/chapter-${index}/1920/1080`}
            alt={chapter.title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0" style={{ background: palette.heroOverlay }} />
          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
            <span className="inline-flex rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.14em]" style={{ borderColor: 'rgba(255,255,255,0.28)', color: '#f2f6fb', background: 'rgba(10,14,22,0.34)' }}>
              Kapitel {index + 1} / {total}
            </span>
            <h2 className="mt-3 text-3xl leading-tight text-white md:text-5xl" style={{ fontFamily: headingFont }}>
              {headerInView ? (
                <Typewriter text={chapter.title} speed={48} delay={300} cursor="" />
              ) : (
                chapter.title
              )}
            </h2>
          </div>
          <div className="absolute inset-0" onMouseEnter={() => setHeaderInView(true)} onFocus={() => setHeaderInView(true)} />
        </div>

        <div className="space-y-7 p-5 md:p-8">
          <div className="flex justify-end">
            <AudioPlayer text={chapter.content} className="bg-transparent" />
          </div>

          <CinematicText
            text={chapter.content}
            paragraphClassName="!text-base md:!text-lg lg:!text-xl !leading-relaxed !tracking-normal !drop-shadow-none"
            paragraphStyle={{ color: palette.title }}
            className="space-y-5"
          />

          {onComplete && (
            <div className="pt-2">
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                onClick={onComplete}
                disabled={isCompleted}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-transform',
                  isCompleted ? 'cursor-default' : 'hover:-translate-y-[1px]'
                )}
                style={{
                  borderColor: palette.cardBorder,
                  color: isCompleted ? '#7fb591' : palette.title,
                  background: isCompleted ? 'rgba(119,172,141,0.16)' : palette.accentSoft,
                }}
              >
                <Sparkles className="h-4 w-4" />
                {isCompleted ? 'Abgeschlossen' : 'Geschichte abschliessen'}
              </motion.button>
            </div>
          )}
        </div>
      </motion.article>
    </section>
  );
};

export default CinematicStoryViewer;
