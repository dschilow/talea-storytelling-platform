import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';

import { useBackend } from '../../hooks/useBackend';
import { useGrowthCelebration } from '../../hooks/useGrowthCelebration';
import { useOptionalUserAccess } from '../../contexts/UserAccessContext';
import { useOptionalChildProfiles } from '../../contexts/ChildProfilesContext';
import LevelUpModal from '../../components/gamification/LevelUpModal';
import ArtifactRewardToast from '../../components/gamification/ArtifactRewardToast';
import ArtifactCelebrationModal, { UnlockedArtifact } from '../../components/gamification/ArtifactCelebrationModal';
import { GrowthCelebrationModal } from '../../components/avatar/GrowthCelebrationModal';
import type { Story, Chapter } from '../../types/story';
import type { Avatar, InventoryItem, Skill } from '../../types/avatar';
import { exportStoryAsPDF, isPDFExportSupported } from '../../utils/pdfExport';
import { AudioPlayer } from '../../components/story/AudioPlayer';
import { extractStoryParticipantIds } from '../../utils/storyParticipants';
import { getOfflineStory } from '../../utils/offlineDb';
import { buildChapterTextSegments, resolveChapterImageInsertPoints } from '../../utils/chapterImagePlacement';
import { emitMapProgress } from '../Journey/TaleaLearningPathProgressStore';
import { useTheme } from '../../contexts/ThemeContext';
import {
  TaleaActionButton,
  TaleaPageBackground,
  TaleaSurface,
  taleaChipClass,
  taleaDisplayFont,
  taleaPageShellClass,
} from '@/components/talea/TaleaPastelPrimitives';
import { usePostStoryFlow, AgentResultFeed } from '../../agents';

const StoryReaderScreen: React.FC = () => {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backend = useBackend();
  const { getToken } = useAuth();
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const { isAdmin } = useOptionalUserAccess();
  const activeProfileId = useOptionalChildProfiles()?.activeProfileId;
  const mapAvatarId = new URLSearchParams(location.search).get('mapAvatarId');
  const isDark = resolvedTheme === 'dark';

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isReading, setIsReading] = useState(false);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [showNav, setShowNav] = useState(false);
  const [animationDirection, setAnimationDirection] = useState(1);

  // Lese-Status
  const [storyCompleted, setStoryCompleted] = useState(false);

  // Gamification / Rewards
  const [rewardQueue, setRewardQueue] = useState<Array<{ item?: InventoryItem, skill?: Skill, type: 'new_item' | 'item_upgrade' | 'new_skill' | 'skill_upgrade' }>>([]);
  const [currentReward, setCurrentReward] = useState<{ item?: InventoryItem, skill?: Skill, type: 'new_item' | 'item_upgrade' | 'new_skill' | 'skill_upgrade' } | null>(null);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);

  // Fullscreen Artifact Display Queue (legacy inventory items)
  const [artifactQueue, setArtifactQueue] = useState<{ item: InventoryItem; isUpgrade: boolean }[]>([]);
  const [currentArtifact, setCurrentArtifact] = useState<{ item: InventoryItem; isUpgrade: boolean } | null>(null);

  // NEW: Pool artifact celebration (from artifact_pool system)
  const [poolArtifact, setPoolArtifact] = useState<UnlockedArtifact | null>(null);
  const [showPoolArtifactModal, setShowPoolArtifactModal] = useState(false);

  // Growth celebration modal
  const { isOpen: showGrowthCelebration, data: growthData, triggerCelebration, closeCelebration } = useGrowthCelebration();

  // Agent result feed after story completion
  const { showCompletionResults } = usePostStoryFlow();

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (storyId) {
      loadStory();
    }

    // Keine Avatar-Auswahl mehr nötig – Updates erfolgen serverseitig bei Generierung
  }, [storyId, activeProfileId, location.state]);

  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;

    const handleScroll = () => {
      const isAtBottom = contentEl.scrollHeight - contentEl.scrollTop <= contentEl.clientHeight + 5; // 5px tolerance
      setShowNav(isAtBottom);
    };

    contentEl.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => contentEl.removeEventListener('scroll', handleScroll);
  }, [currentChapterIndex, isReading]);

  // Reward Queue Processing
  useEffect(() => {
    if (!showLevelUpModal && rewardQueue.length > 0) {
      const nextReward = rewardQueue[0];
      setCurrentReward(nextReward);
      setShowLevelUpModal(true);
      setRewardQueue(prev => prev.slice(1));
    }
  }, [showLevelUpModal, rewardQueue]);

  // Artifact Queue Processing - show fullscreen artifact one by one
  useEffect(() => {
    console.log('🔄 Artifact queue effect triggered:', { currentArtifact, queueLength: artifactQueue.length });
    if (!currentArtifact && artifactQueue.length > 0) {
      const [next, ...rest] = artifactQueue;
      console.log('🔄 Setting currentArtifact:', next);
      setCurrentArtifact(next);
      setArtifactQueue(rest);
    }
  }, [currentArtifact, artifactQueue]);

  const handleCloseArtifact = () => {
    setCurrentArtifact(null);
  };

  // PDF Export state
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const handleExportPDF = async () => {
    if (!isAdmin) {
      return;
    }

    if (!story || !isPDFExportSupported()) {
      const { showErrorToast } = await import('../../utils/toastUtils');
      showErrorToast('PDF-Export wird in diesem Browser nicht unterstützt');
      return;
    }

    try {
      setIsExportingPDF(true);
      setExportProgress(0);

      const { showSuccessToast } = await import('../../utils/toastUtils');

      await exportStoryAsPDF(story, (progress) => {
        setExportProgress(progress);
      });

      showSuccessToast('📄 PDF erfolgreich heruntergeladen!');
    } catch (error) {
      console.error('PDF export error:', error);
      const { showErrorToast } = await import('../../utils/toastUtils');
      showErrorToast('Fehler beim PDF-Export: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'));
    } finally {
      setIsExportingPDF(false);
      setExportProgress(0);
    }
  };

  const loadStory = async () => {
    if (!storyId) return;
    try {
      setLoading(true);
      setError(null);

      // Try to load from offline storage first
      let storyData: any = await getOfflineStory(storyId);

      // If not found offline, fetch from backend
      if (!storyData) {
        storyData = await backend.story.get({ id: storyId, profileId: activeProfileId || undefined });
      } else {
        console.log('[StoryReaderScreen] Loaded story from offline storage');
      }

      setStory(storyData as unknown as Story);
    } catch (err) {
      console.error('Error loading story:', err);
      setError(t('story.reader.notFound'));
    } finally {
      setLoading(false);
    }
  };

  // Keine Avatar-Auswahl-Funktionalität mehr erforderlich

  const startReading = () => {
    setIsReading(true);
    setShowNav(false);
  };

  const goToChapter = async (index: number) => {
    console.log('🔄 goToChapter called:', {
      index,
      totalChapters: story?.chapters?.length,
      storyCompleted,
      isLastChapter: story?.chapters ? index === story.chapters.length - 1 : false
    });

    if (!story || index < 0 || index >= story.chapters!.length) return;

    setAnimationDirection(index > currentChapterIndex ? 1 : -1);
    setCurrentChapterIndex(index);
    setShowNav(false);

    // Check if story is completed (reached last chapter)
    if (index === story.chapters!.length - 1 && !storyCompleted) {
      console.log('🎯 Last chapter reached! Calling handleStoryCompletion...');
      await handleStoryCompletion();
    }
  };

  const handleStoryCompletion = async () => {
    console.log('📖 Story completed - triggering personality updates for all eligible avatars');
    if (!story || !storyId) {
      console.log('Story completion aborted - missing requirements');
      return;
    }

    try {
      setStoryCompleted(true);

      // Get auth token and call story markRead endpoint to apply personality updates
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
        window.dispatchEvent(
          new CustomEvent('personalityUpdated', {
            detail: {
              avatarId: mapAvatarId ?? undefined,
              refreshProgression: true,
              source: 'story',
              updatedAt: new Date().toISOString(),
            },
          })
        );
        emitMapProgress({ avatarId: mapAvatarId, source: 'story' });
        console.log('✅ Personality updates applied:', result);
        console.log('🔍 Full response structure:', JSON.stringify(result, null, 2));

        // 🎁 CRITICAL: Handle pool artifact IMMEDIATELY (before any other processing)
        console.log('🎁 [DEPLOY-CHECK] Artifact in response?', !!result.unlockedArtifact);
        if (result.unlockedArtifact) {
          console.log('🏆 [DEPLOY-CHECK] Setting pool artifact:', result.unlockedArtifact.name);
          setPoolArtifact(result.unlockedArtifact as UnlockedArtifact);
          // Show modal after state is set
          setTimeout(() => {
            console.log('🏆 [DEPLOY-CHECK] TRIGGERING MODAL NOW');
            setShowPoolArtifactModal(true);
          }, 250);
        } else {
          console.log('⚠️ [DEPLOY-CHECK] No unlockedArtifact in response!');
        }

        // Process Rewards
        const newRewards: typeof rewardQueue = [];
        const collectedArtifacts: { item: InventoryItem; isUpgrade: boolean }[] = [];

        if (result.personalityChanges) {
          console.log('📦 Processing personality changes:', result.personalityChanges.length);
          result.personalityChanges.forEach((pc: any, i: number) => {
            console.log(`📦 Avatar ${i + 1} rewards:`, pc.rewards);
            if (pc.rewards) {
              // New Items
              if (pc.rewards.newItems) {
                pc.rewards.newItems.forEach((item: InventoryItem) => {
                  newRewards.push({ item, type: 'new_item' });
                  collectedArtifacts.push({ item, isUpgrade: false });
                });
              }
              // Upgraded Items - also show as toast notification
              if (pc.rewards.upgradedItems) {
                pc.rewards.upgradedItems.forEach((item: InventoryItem) => {
                  newRewards.push({ item, type: 'item_upgrade' });
                  collectedArtifacts.push({ item, isUpgrade: true });
                });
              }
              // New Skills
              if (pc.rewards.newSkills) {
                pc.rewards.newSkills.forEach((skill: Skill) => {
                  newRewards.push({ skill, type: 'new_skill' });
                });
              }
            }
          });
        }

        if (newRewards.length > 0) {
          console.log('🎁 Queuing rewards:', newRewards);
          setRewardQueue(prev => [...prev, ...newRewards]);
        }

        // Show FULLSCREEN artifact display for each artifact earned or upgraded (legacy)
        if (collectedArtifacts.length > 0) {
          console.log('🏆 Artifacts earned/upgraded:', collectedArtifacts.map(a => `${a.item.name} (${a.isUpgrade ? 'upgrade' : 'new'})`));
          console.log('🏆 Setting artifactQueue with', collectedArtifacts.length, 'items');
          // Add all artifacts to the queue - they will be shown one by one as fullscreen modals
          setArtifactQueue(collectedArtifacts);
        } else {
          // 🎁 No artifacts from mark-read response - check if story has a newArtifact in metadata
          // This artifact was already added to inventory during story generation
          const storyArtifact = (story as any).metadata?.newArtifact;
          if (storyArtifact) {
            console.log('🏆 Found story artifact in metadata:', storyArtifact.name);
            const artifactItem: InventoryItem = {
              id: crypto.randomUUID(),
              name: storyArtifact.name,
              type: storyArtifact.type || 'TOOL',
              level: 1,
              sourceStoryId: storyId,
              description: storyArtifact.description,
              visualPrompt: storyArtifact.visualDescriptorKeywords?.join(', ') || '',
              tags: storyArtifact.visualDescriptorKeywords || [],
              acquiredAt: new Date().toISOString(),
              imageUrl: storyArtifact.imageUrl,
              storyEffect: storyArtifact.storyEffect,
            };
            setArtifactQueue([{ item: artifactItem, isUpgrade: false }]);
          } else {
            console.log('📦 No artifacts collected in this session');
          }
        }

        // Show personality update notifications for each avatar
        console.log('🔔 Checking for personality changes to show:', {
          hasPersonalityChanges: !!result.personalityChanges,
          length: result.personalityChanges?.length || 0,
          updatedAvatars: result.updatedAvatars
        });

        if (result.personalityChanges && result.personalityChanges.length > 0) {
          const { showPersonalityUpdateToast, showSuccessToast } = await import('../../utils/toastUtils');

          // First show the completion message immediately
          console.log('🎉 Showing completion toast for', result.updatedAvatars, 'avatars');
          showSuccessToast(`🎉 ${t('story.reader.toast.completed', { count: result.updatedAvatars })}`);

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
                subtitle: `${result.updatedAvatars} Avatar(e) aktualisiert`,
              });
            }, 800);
          }

          // 🎉 Trigger growth celebration modal (especially for mastery tier-ups)
          triggerCelebration(result.personalityChanges, 'story', story?.title);
        } else {
          // No personality changes, just show completion
          console.log('🔔 No personality changes found, showing only completion toast');
          const { showSuccessToast } = await import('../../utils/toastUtils');
          showSuccessToast(`🎉 ${t('story.reader.toast.completed', { count: result.updatedAvatars })}`);
        }

        // 🌟 Show agent result feed (contextual completion cards)
        showCompletionResults({
          hasMemory: true,
          artifactName: collectedArtifacts.length > 0 ? collectedArtifacts[0].item.name : undefined,
          storyId,
        });

      } else {
        const errorText = await response.text();
        console.warn('⚠️ Failed to apply personality updates:', response.statusText, errorText);
        emitMapProgress({ avatarId: mapAvatarId, source: 'story' });

        // Show error notification but still show completion
        import('../../utils/toastUtils').then(({ showErrorToast, showStoryCompletionToast }) => {
          showErrorToast(t('story.reader.toast.error'));
          showStoryCompletionToast(story.title);
        });
      }

    } catch (error) {
      console.error('❌ Error during story completion processing:', error);
      emitMapProgress({ avatarId: mapAvatarId, source: 'story' });

      // Show error notification but still show completion
      import('../../utils/toastUtils').then(({ showErrorToast, showStoryCompletionToast }) => {
        showErrorToast(t('story.reader.toast.networkError'));
        showStoryCompletionToast(story.title);
      });
    }
  };

  const variants = {
    enter: (direction: number) => ({
      opacity: 0,
      filter: 'blur(10px)',
      x: direction * 100,
    }),
    center: {
      opacity: 1,
      filter: 'blur(0px)',
      x: 0,
      transition: { duration: 0.5 },
    },
    exit: (direction: number) => ({
      opacity: 0,
      filter: 'blur(10px)',
      x: direction * -100,
      transition: { duration: 0.3 },
    }),
  };

  // --- Render Functions ---

  if (loading) {
    return (
      <div className="relative min-h-screen">
        <TaleaPageBackground isDark={isDark} />
        <div className={`${taleaPageShellClass} flex min-h-screen items-center justify-center py-12`}>
          <TaleaSurface className="w-full max-w-lg p-8 text-center sm:p-10">
            <div className="mx-auto mb-5 h-14 w-14 rounded-full border-[3px] border-[var(--primary)] border-t-transparent animate-spin dark:border-[#9dc6e4]" />
            <h2
              className="text-[2rem] font-semibold text-slate-900 dark:text-white"
              style={{ fontFamily: taleaDisplayFont }}
            >
              {t('story.reader.loading')}
            </h2>
          </TaleaSurface>
        </div>
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="relative min-h-screen">
        <TaleaPageBackground isDark={isDark} />
        <div className={`${taleaPageShellClass} flex min-h-screen items-center justify-center py-12`}>
          <TaleaSurface className="w-full max-w-lg p-8 text-center sm:p-10">
            <h2
              className="text-[2rem] font-semibold text-slate-900 dark:text-white"
              style={{ fontFamily: taleaDisplayFont }}
            >
              {t('common.error')}
            </h2>
            <p className="mt-3 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
              {error || t('story.reader.notFound')}
            </p>
            <div className="mt-6 flex justify-center">
              <TaleaActionButton variant="secondary" onClick={() => navigate('/stories')} icon={<ArrowLeft className="h-4 w-4" />}>
                {t('common.back')}
              </TaleaActionButton>
            </div>
          </TaleaSurface>
        </div>
      </div>
    );
  }

  const currentChapter = story.chapters?.[currentChapterIndex];
  const chapterParagraphs = buildChapterTextSegments(
    currentChapter?.content || "",
    Boolean(currentChapter?.imageUrl),
    Boolean(currentChapter?.scenicImageUrl)
  );
  const imageInsertPoints = resolveChapterImageInsertPoints(
    chapterParagraphs.length,
    Boolean(currentChapter?.imageUrl),
    Boolean(currentChapter?.scenicImageUrl)
  );
  const primaryChapterImage =
    currentChapter?.imageUrl || `https://picsum.photos/seed/${story.id}-${currentChapterIndex}/800/400`;
  const scenicChapterImage = currentChapter?.scenicImageUrl;
  const storyProgress = `${((currentChapterIndex + 1) / (story.chapters?.length || 1)) * 100}%`;

  return (
    <div className="relative h-screen overflow-hidden">
      <TaleaPageBackground isDark={isDark} />
      <button
        onClick={() => isReading ? setIsReading(false) : navigate('/stories')}
        className="absolute left-3 top-3 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/75 bg-white/72 text-slate-700 shadow-[0_14px_32px_-24px_rgba(150,122,99,0.46)] backdrop-blur-xl transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f2e7fb] dark:border-white/10 dark:bg-white/8 dark:text-slate-100 dark:shadow-[0_18px_40px_-26px_rgba(2,8,23,0.9)] dark:focus-visible:ring-[#243753]"
        aria-label={t('common.back')}
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <AnimatePresence initial={false}>
        {!isReading ? (
          <motion.div
            key="summary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-full items-center justify-center px-3 py-24"
          >
            <div className={`${taleaPageShellClass}`}>
              <TaleaSurface className="mx-auto max-w-5xl p-5 md:p-7">
                <div className="grid gap-6 lg:grid-cols-[minmax(16rem,24rem)_minmax(0,1fr)] lg:items-center">
                  <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/70 shadow-[0_24px_56px_-32px_rgba(150,122,99,0.54)] dark:border-white/10 dark:bg-white/5">
                    <motion.img
                      src={story.coverImageUrl || '/placeholder-story.jpg'}
                      alt={story.title}
                      className="aspect-[4/5] w-full object-cover"
                      layoutId={`story-cover-${story.id}`}
                      loading="eager"
                      decoding="async"
                    />
                  </div>

                  <div className="text-left">
                    <span className={`${taleaChipClass} border-white/75 bg-white/75 text-[var(--talea-text-secondary)] dark:border-white/10 dark:bg-white/5 dark:text-[var(--primary)]`}>
                      Story Reader
                    </span>
                    <h1
                      className="mt-4 text-4xl font-semibold leading-tight text-slate-900 dark:text-white md:text-[3.4rem]"
                      style={{ fontFamily: taleaDisplayFont }}
                    >
                      {story.title}
                    </h1>
                    <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-600 dark:text-slate-300">
                      {story.summary}
                    </p>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[22px] border border-white/70 bg-white/66 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Kapitel</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{story.chapters?.length || 0}</p>
                      </div>
                      <div className="rounded-[22px] border border-white/70 bg-white/66 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Format</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">Lesemodus</p>
                      </div>
                      <div className="rounded-[22px] border border-white/70 bg-white/66 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Bereit</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">Mit Audio und Belohnungen</p>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <TaleaActionButton onClick={startReading} icon={<Sparkles className="h-4 w-4" />}>
                        {t('story.reader.read')}
                      </TaleaActionButton>

                      {isAdmin && (
                        <TaleaActionButton
                          variant="secondary"
                          onClick={handleExportPDF}
                          disabled={isExportingPDF}
                          icon={
                            isExportingPDF
                              ? <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                              : <Download className="h-4 w-4" />
                          }
                        >
                          {isExportingPDF ? `${exportProgress}%` : 'PDF herunterladen'}
                        </TaleaActionButton>
                      )}
                    </div>
                  </div>
                </div>
              </TaleaSurface>
            </div>
          </motion.div>
        ) : (
          <div key="reader" className="w-full h-full flex flex-col px-3 pb-24 pt-16">
            <AnimatePresence initial={false} custom={animationDirection}>
              <motion.div
                key={currentChapterIndex}
                custom={animationDirection}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                className="absolute inset-x-0 bottom-24 top-16 flex justify-center px-3"
              >
                <TaleaSurface className="flex h-full w-full max-w-5xl flex-col p-0">
                  <div className="border-b border-white/70 px-5 pb-4 pt-5 dark:border-white/10 md:px-8">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <span className={`${taleaChipClass} border-white/70 bg-white/72 text-[var(--talea-text-secondary)] dark:border-white/10 dark:bg-white/5 dark:text-[var(--primary)]`}>
                          {t('story.reader.chapter')} {currentChapterIndex + 1}
                        </span>
                        <h2
                          className="mt-3 text-[2rem] font-semibold text-slate-900 dark:text-white md:text-[2.8rem]"
                          style={{ fontFamily: taleaDisplayFont }}
                        >
                          {currentChapter?.title}
                        </h2>
                      </div>

                      {currentChapter && (
                        <AudioPlayer text={currentChapter.content} className="md:mt-1" />
                      )}
                    </div>
                  </div>

                  <div ref={contentRef} className="talea-soft-scrollbar flex-1 overflow-y-auto px-5 pb-6 pt-5 md:px-8">
                    <div className="mx-auto max-w-4xl space-y-6 text-[1.02rem] leading-8 text-slate-700 dark:text-slate-300 md:text-[1.12rem] md:leading-9">
                    {chapterParagraphs.map((paragraph, i) => (
                      <React.Fragment key={i}>
                          <p className="talea-reading-prose">{paragraph}</p>
                        {imageInsertPoints.primaryAfterSegment === i && (
                            <div className="my-8 overflow-hidden rounded-[28px] border border-white/70 bg-white/70 shadow-[0_22px_48px_-30px_rgba(150,122,99,0.52)] dark:border-white/10 dark:bg-white/5">
                            <img
                              src={primaryChapterImage}
                              alt={`${currentChapter?.title || 'Kapitel'} - Szene`}
                              className="w-full h-auto max-h-[40vh] object-contain"
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                        )}
                        {imageInsertPoints.scenicAfterSegment === i && scenicChapterImage && (
                            <div className="my-8 overflow-hidden rounded-[28px] border border-white/70 bg-white/70 shadow-[0_22px_48px_-30px_rgba(150,122,99,0.52)] dark:border-white/10 dark:bg-white/5">
                            <img
                              src={scenicChapterImage}
                              alt={`${currentChapter?.title || 'Kapitel'} - Umgebung`}
                              className="w-full h-auto max-h-[40vh] object-contain"
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  </div>
                </TaleaSurface>
              </motion.div>
            </AnimatePresence>

            <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-3">
              <div className="mx-auto max-w-5xl">
                <TaleaSurface className="p-3 md:p-4">
                  <div className="flex items-center gap-3 md:gap-4">
                <motion.button
                  onClick={() => goToChapter(currentChapterIndex - 1)}
                  disabled={currentChapterIndex === 0}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/75 bg-white/72 text-slate-700 transition disabled:opacity-35 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  animate={{ opacity: showNav || currentChapterIndex > 0 ? 1 : 0 }}
                >
                  <ChevronLeft className="h-6 w-6" />
                </motion.button>

                <div className="flex-1">
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-300/45 dark:bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#d4b3c7_0%,#d9e8f7_100%)]"
                      initial={{ width: '0%' }}
                      animate={{ width: storyProgress }}
                      transition={{ ease: "easeInOut" }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    <span>{t('story.reader.chapter')} {currentChapterIndex + 1}</span>
                    <span>{story.chapters?.length || 1}</span>
                  </div>
                </div>

                {/* Next Chapter / Complete Story Button */}
                {story.chapters && currentChapterIndex === story.chapters.length - 1 ? (
                  // Last chapter - show "Complete Story" button
                  <motion.button
                    onClick={() => {
                      console.log('🔘 Complete Story button clicked!', { storyCompleted });
                      if (!storyCompleted) {
                        handleStoryCompletion();
                      }
                    }}
                    disabled={storyCompleted}
                    className={`rounded-full border px-5 py-3 text-sm font-bold transition ${
                      storyCompleted
                        ? 'border-transparent bg-[#7daf99] text-white dark:bg-[#7fa3c8]'
                        : 'border-white/75 bg-[linear-gradient(135deg,#f2d8e4_0%,#f9e9ca_46%,#dfeefc_100%)] text-[#334257] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(111,84,114,0.54)_0%,rgba(65,96,131,0.44)_100%)] dark:text-white'
                      }`}
                    whileHover={!storyCompleted ? { scale: 1.05 } : {}}
                    whileTap={!storyCompleted ? { scale: 0.95 } : {}}
                    animate={{ opacity: showNav ? 1 : 0.7 }}
                  >
                    {storyCompleted ? t('story.reader.completed') : t('story.reader.finish')}
                  </motion.button>
                ) : (
                  // Regular "Next Chapter" button
                  <motion.button
                    onClick={() => goToChapter(currentChapterIndex + 1)}
                    disabled={!story.chapters || currentChapterIndex === story.chapters.length - 1}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/75 bg-white/72 text-slate-700 transition disabled:opacity-35 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    animate={{ opacity: showNav || (story.chapters && currentChapterIndex < story.chapters.length - 1) ? 1 : 0 }}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </motion.button>
                )}
                  </div>
                </TaleaSurface>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Agent Result Feed — contextual completion cards (memories, quiz, artifacts, next adventure) */}
      {storyCompleted && (
        <div className="fixed bottom-28 right-4 z-30 w-80 max-h-[50vh] overflow-y-auto">
          <AgentResultFeed
            onAction={(action, payload) => {
              if (action === 'navigate' && payload?.to) {
                navigate(payload.to as string);
              }
              if (action === 'open-quiz') {
                // TODO: navigate to quiz when quiz feature is ready
                console.log('[AgentResultFeed] open-quiz action triggered');
              }
            }}
          />
        </div>
      )}

      {/* Level Up Modal */}
      {currentReward && (
        <LevelUpModal
          isOpen={showLevelUpModal}
          onClose={() => setShowLevelUpModal(false)}
          item={currentReward.item}
          skill={currentReward.skill}
          type={currentReward.type}
        />
      )}

      {/* Fullscreen Artifact Reward Display (legacy) */}
      <ArtifactRewardToast
        item={currentArtifact?.item || null}
        isVisible={!!currentArtifact}
        onClose={handleCloseArtifact}
        isUpgrade={currentArtifact?.isUpgrade}
      />

      {/* NEW: Pool Artifact Celebration Modal */}
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

      {/* Growth Celebration Modal (mastery tier-ups & trait changes) */}
      <GrowthCelebrationModal
        isOpen={showGrowthCelebration}
        onClose={closeCelebration}
        traitChanges={growthData.traitChanges}
        masteryEvents={growthData.masteryEvents}
        source={growthData.source}
        sourceTitle={growthData.sourceTitle}
      />

    </div>
  );
};

export default StoryReaderScreen;
