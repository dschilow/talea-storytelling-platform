import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, LoaderCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';

import { useBackend } from '../../hooks/useBackend';
import { useOptionalChildProfiles } from '../../contexts/ChildProfilesContext';
import { TracingBeam } from '../../components/ui/tracing-beam';
import { TextGradientScroll } from '../../components/ui/text-gradient-scroll';
import type { Story, Chapter } from '../../types/story';
import { AudioPlayer } from '../../components/story/AudioPlayer';
import { extractStoryParticipantIds } from '../../utils/storyParticipants';
import { getOfflineStory } from '../../utils/offlineDb';
import { useOfflineScope } from '../../contexts/OfflineScopeContext';
import { buildChapterTextSegments, resolveChapterImageInsertPoints } from '../../utils/chapterImagePlacement';
import { emitMapProgress } from '../Journey/TaleaLearningPathProgressStore';
import ArtifactCelebrationModal, { type UnlockedArtifact } from '../../components/gamification/ArtifactCelebrationModal';
import TreasureRewardsOverlay, { type TreasureRewardsPayload } from '../../components/gamification/TreasureRewardsOverlay';

const StoryScrollReaderScreen: React.FC = () => {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backend = useBackend();
  const { getToken } = useAuth();
  const childProfileContext = useOptionalChildProfiles();
  const activeProfileId = childProfileContext?.activeProfileId;
  const offlineScope = useOfflineScope();
  const mapAvatarId = new URLSearchParams(location.search).get('mapAvatarId');
  const progressAvatarId =
    mapAvatarId ??
    childProfileContext?.activeProfile?.childAvatarId ??
    childProfileContext?.activeProfile?.preferredAvatarIds?.[0] ??
    null;

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isReading, setIsReading] = useState(false);
  const [storyCompleted, setStoryCompleted] = useState(false);
  const [completionPending, setCompletionPending] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [poolArtifact, setPoolArtifact] = useState<UnlockedArtifact | null>(null);
  const [showPoolArtifactModal, setShowPoolArtifactModal] = useState(false);
  const [treasureRewards, setTreasureRewards] = useState<TreasureRewardsPayload | null>(null);
  const loadRequestRef = useRef(0);
  const completionAttemptRef = useRef(0);
  const completionInFlightRef = useRef(false);
  const completionZoneRef = useRef<HTMLDivElement>(null);
  const autoCompleteFiredRef = useRef(false);

  useEffect(() => {
    const requestId = ++loadRequestRef.current;
    completionAttemptRef.current += 1;
    completionInFlightRef.current = false;
    autoCompleteFiredRef.current = false;
    setStory(null);
    setStoryCompleted(false);
    setCompletionPending(false);
    setCompletionError(null);
    setIsReading(false);
    if (storyId) void loadStory(requestId);

    return () => {
      if (loadRequestRef.current === requestId) loadRequestRef.current += 1;
      completionAttemptRef.current += 1;
      completionInFlightRef.current = false;
    };
  }, [storyId, activeProfileId, offlineScope]);

  const loadStory = async (requestId: number) => {
    if (!storyId) return;
    try {
      setLoading(true);
      setError(null);

      // Try to load from offline storage first
      let storyData: any = offlineScope ? await getOfflineStory(offlineScope, storyId) : null;

      // If not found offline, fetch from backend
      if (!storyData) {
        storyData = await backend.story.get({ id: storyId, profileId: activeProfileId || undefined });
      } else {
        console.log('[StoryScrollReaderScreen] Loaded story from offline storage');
      }

      if (loadRequestRef.current !== requestId) return;
      setStory(storyData as unknown as Story);
    } catch (err) {
      if (loadRequestRef.current !== requestId) return;
      console.error('Error loading story:', err);
      setError('Geschichte konnte nicht geladen werden.');
    } finally {
      if (loadRequestRef.current === requestId) setLoading(false);
    }
  };

  const startReading = () => {
    setIsReading(true);
  };

  const handleStoryCompletion = async () => {
    console.log('📖 Story completed - triggering personality updates for all eligible avatars');
    if (!story || !storyId || storyCompleted || completionInFlightRef.current) {
      console.log('Story completion aborted - missing requirements or already completed');
      return;
    }

    const attemptId = ++completionAttemptRef.current;
    completionInFlightRef.current = true;
    setCompletionPending(true);
    setCompletionError(null);

    try {
      const token = await getToken();
      const { getBackendUrl } = await import('../../config');
      const target = getBackendUrl();
      const response = await fetch(`${target}/story/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify((() => {
          const participantAvatarIds = extractStoryParticipantIds(story);
          return {
            storyId: storyId,
            storyTitle: story.title,
            genre: story.config.genre,
            profileId: activeProfileId || undefined,
            ...(participantAvatarIds.length > 0 ? { avatarIds: participantAvatarIds } : {}),
          };
        })())
      });

      if (response.ok) {
        const result = await response.json();
        if (result?.success !== true) {
          throw new Error('Story completion was not confirmed by the server.');
        }
        if (completionAttemptRef.current !== attemptId) return;
        setStoryCompleted(true);

        // Schatzkammer: freshly found pool artifact + Fundstück/journey rewards.
        if (result?.unlockedArtifact) {
          setPoolArtifact(result.unlockedArtifact as UnlockedArtifact);
          setTimeout(() => setShowPoolArtifactModal(true), 260);
        }
        if (result?.treasureRewards) {
          setTreasureRewards(result.treasureRewards as TreasureRewardsPayload);
        }

        console.log('✅ Personality updates applied:', result);
        window.dispatchEvent(
          new CustomEvent('personalityUpdated', {
            detail: {
              avatarId: progressAvatarId ?? undefined,
              refreshProgression: true,
              source: 'story',
              updatedAt: new Date().toISOString(),
            },
          }),
        );
        emitMapProgress({ avatarId: progressAvatarId, source: 'story' });

        import('../../utils/toastUtils').then(({ showSuccessToast }) => {
          let message = `📖 Geschichte abgeschlossen! ${result.updatedAvatars} Avatare entwickelt.\n\n`;

          if (result.personalityChanges && result.personalityChanges.length > 0) {
            result.personalityChanges.forEach((avatarChange: any) => {
              const changes = avatarChange.changes.map((change: any) => {
                const points = change.change > 0 ? `+${change.change}` : `${change.change}`;
                return `${points} ${getTraitDisplayName(change.trait)}`;
              }).join(', ');
              message += `${avatarChange.avatarName}: ${changes}\n`;
            });
          }

          showSuccessToast(message.trim());
        });
      } else {
        throw new Error(`Story completion failed with status ${response.status}`);
      }

    } catch (error) {
      console.error('❌ Error during story completion processing:', error);
      if (completionAttemptRef.current !== attemptId) return;
      const message = 'Dein Fortschritt konnte noch nicht gespeichert werden. Bitte versuche es erneut.';
      setCompletionError(message);
      const { showErrorToast } = await import('../../utils/toastUtils');
      showErrorToast(message);
    } finally {
      if (completionAttemptRef.current === attemptId) {
        completionInFlightRef.current = false;
        setCompletionPending(false);
      }
    }
  };

  // Auto-completion: when the child scrolls to the end of the story, save the
  // progress and show the rewards automatically — kids do not press the
  // "Geschichte abschließen" button. It stays as a status/manual-retry fallback.
  useEffect(() => {
    if (!isReading || !story || storyCompleted) return;
    const node = completionZoneRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !autoCompleteFiredRef.current) {
            autoCompleteFiredRef.current = true;
            window.setTimeout(() => { void handleStoryCompletion(); }, 700);
          }
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isReading, story, storyCompleted]);

  function getTraitDisplayName(trait: string): string {
    const parts = trait.split('.');
    const subcategory = parts.length > 1 ? parts[1] : null;
    const mainTrait = parts[0];

    const names: Record<string, string> = {
      'knowledge': 'Wissen',
      'creativity': 'Kreativität',
      'vocabulary': 'Wortschatz',
      'courage': 'Mut',
      'curiosity': 'Neugier',
      'teamwork': 'Teamgeist',
      'empathy': 'Empathie',
      'persistence': 'Ausdauer',
      'logic': 'Logik',
      'history': 'Geschichte',
      'science': 'Wissenschaft',
      'geography': 'Geografie',
      'physics': 'Physik',
      'biology': 'Biologie',
      'chemistry': 'Chemie',
      'mathematics': 'Mathematik',
      'kindness': 'Freundlichkeit',
      'humor': 'Humor',
      'determination': 'Entschlossenheit',
      'wisdom': 'Weisheit'
    };

    if (subcategory) {
      return names[subcategory.toLowerCase()] || subcategory;
    }

    return names[mainTrait.toLowerCase()] || trait;
  }

  // --- Render Functions ---

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-stone-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-600 dark:text-gray-300">Lade Geschichte...</p>
        </div>
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-center p-8 bg-[#13102B]/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Fehler</h2>
          <p className="text-gray-700 dark:text-gray-200 mb-6">{error || 'Die Geschichte konnte nicht gefunden werden.'}</p>
          <button onClick={() => navigate('/stories')} className="px-4 py-2 bg-stone-500 text-white rounded hover:bg-stone-600 transition-colors flex items-center mx-auto">
            <ArrowLeft size={18} className="mr-2" /> Zurück
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gray-100 dark:bg-gray-900">
      {/* Header with back button */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => isReading ? setIsReading(false) : navigate('/stories')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Zurück</span>
          </button>

          {isReading && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <BookOpen className="w-5 h-5" />
              <span className="text-sm font-medium">{story.chapters?.length || 0} Kapitel</span>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!isReading ? (
          /* Cover Page */
          <motion.div
            key="cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col items-center justify-center p-8 pt-24 text-center"
          >
            <motion.img
              src={story.coverImageUrl || '/placeholder-story.jpg'}
              alt={story.title}
              className="w-64 h-64 md:w-80 md:h-80 rounded-2xl shadow-2xl mb-8 object-cover"
              layoutId={`story-cover-${story.id}`}
            />
            <h1 className="text-4xl md:text-6xl font-bold text-gray-800 dark:text-white mb-6 max-w-4xl">
              {story.title}
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mb-10 leading-relaxed">
              {story.summary}
            </p>
            <motion.button
              onClick={startReading}
              className="px-10 py-4 bg-gradient-to-r from-stone-600 to-amber-600 text-white font-bold text-lg rounded-full shadow-xl hover:shadow-2xl transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              📖 Lesen
            </motion.button>
          </motion.div>
        ) : (
          /* Scrollable Reading View with TracingBeam */
          <motion.div
            key="reader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full"
          >
            <div className="pt-24 pb-32">
              <TracingBeam className="px-6">
                <div className="max-w-3xl mx-auto antialiased">
                  {story.chapters?.map((chapter: Chapter, index: number) => (
                    <div key={`chapter-${index}`} className="mb-16">
                      {(() => {
                        const normalizedParagraphs = buildChapterTextSegments(
                          chapter.content,
                          Boolean(chapter.imageUrl),
                          Boolean(chapter.scenicImageUrl)
                        );
                        const insertPoints = resolveChapterImageInsertPoints(
                          normalizedParagraphs.length,
                          Boolean(chapter.imageUrl),
                          Boolean(chapter.scenicImageUrl)
                        );
                        const primaryImage = chapter.imageUrl || `https://picsum.photos/seed/${story.id}-${index}/900/520`;
                        const scenicImage = chapter.scenicImageUrl;
                        return (
                          <>
                      {/* Chapter Badge */}
                      <div className="bg-gradient-to-r from-stone-600 to-amber-600 text-white rounded-full text-sm w-fit px-6 py-2 mb-6 font-semibold shadow-lg">
                        Kapitel {index + 1}
                      </div>

                      <div className="flex justify-between items-center mb-6">
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-white">
                          {chapter.title}
                        </h2>
                        <AudioPlayer text={chapter.content} className="ml-4" />
                      </div>

                      {/* Chapter Content with Gradient Scroll Effect */}
                      <div className="text-lg md:text-xl prose prose-lg dark:prose-invert max-w-none leading-relaxed">
                        {normalizedParagraphs.map((paragraph, pIndex) => (
                          <div key={`p-${index}-${pIndex}`} className="mb-6">
                            <TextGradientScroll
                              text={paragraph}
                              type="word"
                              textOpacity="soft"
                              className="text-gray-700 dark:text-gray-300"
                            />

                            {insertPoints.primaryAfterSegment === pIndex && (
                              <div className="rounded-2xl mt-8 w-full shadow-2xl bg-gray-200 dark:bg-gray-800 overflow-hidden">
                                <img
                                  src={primaryImage}
                                  alt={`${chapter.title} - Szene`}
                                  className="w-full h-auto max-h-[60vh] object-contain"
                                  loading={index === 0 ? 'eager' : 'lazy'}
                                  decoding="async"
                                />
                              </div>
                            )}

                            {insertPoints.scenicAfterSegment === pIndex && scenicImage && (
                              <div className="rounded-2xl mt-8 w-full shadow-2xl bg-gray-200 dark:bg-gray-800 overflow-hidden">
                                <img
                                  src={scenicImage}
                                  alt={`${chapter.title} - Umgebung`}
                                  className="w-full h-auto max-h-[60vh] object-contain"
                                  loading={index === 0 ? 'eager' : 'lazy'}
                                  decoding="async"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                          </>
                        );
                      })()}
                    </div>
                  ))}

                  {/* Completion Button */}
                  <div ref={completionZoneRef} className="flex flex-col items-center justify-center py-16 border-t-2 border-dashed border-gray-300 dark:border-gray-600">
                    <motion.button
                      onClick={handleStoryCompletion}
                      disabled={storyCompleted || completionPending}
                      aria-busy={completionPending}
                      className={`px-12 py-5 rounded-full font-bold text-xl text-white transition-all shadow-2xl ${storyCompleted
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 cursor-default'
                        : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:shadow-amber-500/50 hover:scale-105'
                        }`}
                      whileHover={!storyCompleted && !completionPending ? { scale: 1.05 } : {}}
                      whileTap={!storyCompleted && !completionPending ? { scale: 0.95 } : {}}
                    >
                      {completionPending && <LoaderCircle className="mr-2 inline h-5 w-5 animate-spin" aria-hidden="true" />}
                      {storyCompleted
                        ? 'Geschichte abgeschlossen'
                        : completionPending
                          ? 'Fortschritt wird gespeichert ...'
                          : completionError
                            ? 'Speichern erneut versuchen'
                            : 'Geschichte abschliessen'}
                    </motion.button>
                    {completionError && !storyCompleted && (
                      <p role="alert" className="mt-4 max-w-xl text-center text-sm font-medium text-red-600 dark:text-red-300">
                        {completionError}
                      </p>
                    )}
                    {storyCompleted && (
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 text-gray-600 dark:text-gray-300 text-center"
                      >
                        Deine Avatare haben sich weiterentwickelt! ✨
                      </motion.p>
                    )}
                  </div>
                </div>
              </TracingBeam>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Schatzkammer: neues Artefakt (Bild + Beschreibung) */}
      <ArtifactCelebrationModal
        artifact={poolArtifact}
        isVisible={showPoolArtifactModal}
        onClose={() => { setShowPoolArtifactModal(false); setPoolArtifact(null); }}
      />

      {/* Schatzkammer 2.0: Reise-/Level-Karten, Set-Krönungen, Fundstück-Toast */}
      <TreasureRewardsOverlay
        rewards={treasureRewards}
        active={!showPoolArtifactModal}
      />
    </div>
  );
};

export default StoryScrollReaderScreen;


