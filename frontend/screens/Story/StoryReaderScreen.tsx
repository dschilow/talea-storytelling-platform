import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';

import { useBackend } from '../../hooks/useBackend';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import LevelUpModal from '../../components/gamification/LevelUpModal';
import ArtifactRewardToast from '../../components/gamification/ArtifactRewardToast';
import type { Story, Chapter } from '../../types/story';
import type { Avatar, InventoryItem, Skill } from '../../types/avatar';
import { exportStoryAsPDF, isPDFExportSupported } from '../../utils/pdfExport';


const StoryReaderScreen: React.FC = () => {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backend = useBackend();
  const { getToken } = useAuth();
  const { t } = useTranslation();

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

  // Fullscreen Artifact Display Queue
  const [artifactQueue, setArtifactQueue] = useState<{ item: InventoryItem; isUpgrade: boolean }[]>([]);
  const [currentArtifact, setCurrentArtifact] = useState<{ item: InventoryItem; isUpgrade: boolean } | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (storyId) {
      loadStory();
    }

    // Keine Avatar-Auswahl mehr nötig – Updates erfolgen serverseitig bei Generierung
  }, [storyId, location.state]);

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
      const storyData = await backend.story.get({ id: storyId });
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
        body: JSON.stringify({
          storyId: storyId,
          storyTitle: story.title,
          genre: story.config.genre,
          // No avatarId = update all eligible avatars
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Personality updates applied:', result);
        console.log('🔍 Full response structure:', JSON.stringify(result, null, 2));

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

        // Show FULLSCREEN artifact display for each artifact earned or upgraded
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
          
          // Then show individual personality updates for each avatar with a delay
          result.personalityChanges.forEach((avatarChange: any, index: number) => {
            console.log(`🔔 Avatar ${index + 1} changes:`, {
              avatarName: avatarChange.avatarName,
              hasChanges: !!avatarChange.changes,
              changesLength: avatarChange.changes?.length || 0,
              changes: avatarChange.changes
            });
            
            if (avatarChange.changes && avatarChange.changes.length > 0) {
              setTimeout(() => {
                console.log(`🔔 Showing personality toast for ${avatarChange.avatarName}:`, avatarChange.changes);
                // Show personality update toast with trait changes
                showPersonalityUpdateToast(avatarChange.changes);
              }, 800 + (index * 600)); // Faster timing - 0.8s initial, 0.6s between each
            }
          });
        } else {
          // No personality changes, just show completion
          console.log('🔔 No personality changes found, showing only completion toast');
          const { showSuccessToast } = await import('../../utils/toastUtils');
          showSuccessToast(`🎉 ${t('story.reader.toast.completed', { count: result.updatedAvatars })}`);
        }

        // Helper function to get translated trait names
        function getTraitDisplayName(trait: string): string {
          // Handle subcategories like "knowledge.history"
          const parts = trait.split('.');
          const subcategory = parts.length > 1 ? parts[1] : null;
          const mainTrait = parts[0];

          // If it's a subcategory, try to translate it directly
          if (subcategory) {
            const key = `traits.${subcategory.toLowerCase()}`;
            const translation = t(key);
            // If translation exists and is different from key, return it. Otherwise fallback.
            return translation !== key ? translation : subcategory;
          }

          const key = `traits.${mainTrait.toLowerCase()}`;
          const translation = t(key);
          return translation !== key ? translation : trait;
        }
      } else {
        const errorText = await response.text();
        console.warn('⚠️ Failed to apply personality updates:', response.statusText, errorText);

        // Show error notification but still show completion
        import('../../utils/toastUtils').then(({ showErrorToast, showStoryCompletionToast }) => {
          showErrorToast(t('story.reader.toast.error'));
          showStoryCompletionToast(story.title);
        });
      }

    } catch (error) {
      console.error('❌ Error during story completion processing:', error);

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
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-600 dark:text-gray-300">{t('story.reader.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl">
          <h2 className="text-2xl font-bold text-red-500 mb-4">{t('common.error')}</h2>
          <p className="text-gray-700 dark:text-gray-200 mb-6">{error || t('story.reader.notFound')}</p>
          <button onClick={() => navigate('/stories')} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center mx-auto">
            <ArrowLeft size={18} className="mr-2" /> {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  const currentChapter = story.chapters?.[currentChapterIndex];

  return (
    <div className="w-screen h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
      <button onClick={() => isReading ? setIsReading(false) : navigate('/stories')} className="absolute top-4 left-4 z-20 p-2 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-full shadow-md hover:scale-105 transition-transform">
        <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-gray-200" />
      </button>

      <AnimatePresence initial={false}>
        {!isReading ? (
          <motion.div
            key="summary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.img
              src={story.coverImageUrl || '/placeholder-story.jpg'}
              alt={story.title}
              className="w-48 h-48 md:w-64 md:h-64 rounded-lg shadow-2xl mb-6 object-cover"
              layoutId={`story-cover-${story.id}`}
            />
            <h1 className="text-3xl md:text-5xl font-bold text-gray-800 dark:text-white mb-4">{story.title}</h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mb-8">{story.summary}</p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
              <button
                onClick={startReading}
                className="px-8 py-3 bg-blue-600 text-white font-bold rounded-full shadow-lg hover:bg-blue-700 transition-transform hover:scale-105"
              >
                {t('story.reader.read')}
              </button>

              <button
                onClick={handleExportPDF}
                disabled={isExportingPDF}
                className="px-8 py-3 bg-green-600 text-white font-bold rounded-full shadow-lg hover:bg-green-700 transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isExportingPDF ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{exportProgress}%</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>PDF herunterladen</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        ) : (
          <div key="reader" className="w-full h-full flex flex-col">
            <AnimatePresence initial={false} custom={animationDirection}>
              <motion.div
                key={currentChapterIndex}
                custom={animationDirection}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                className="w-full h-full flex flex-col pt-20 pb-32 absolute inset-0"
              >
                <div className="text-center px-4">
                  <img
                    src={currentChapter?.imageUrl || `https://picsum.photos/seed/${story.id}-${currentChapterIndex}/800/400`}
                    alt={currentChapter?.title || ''}
                    className="w-full max-w-4xl max-h-[40vh] object-cover rounded-lg shadow-lg mx-auto mb-4"
                  />
                  <h2 className="text-2xl md:text-4xl font-bold text-gray-800 dark:text-white mb-6">{currentChapter?.title}</h2>
                </div>
                <div ref={contentRef} className="flex-1 overflow-y-auto px-4 md:px-12">
                  <div className="max-w-4xl mx-auto text-lg md:text-xl text-gray-700 dark:text-gray-300 leading-loose tracking-wide space-y-6 text-justify hyphens-auto">
                    {currentChapter?.content.split('\n').map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation & Progress */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700">
              <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                <motion.button
                  onClick={() => goToChapter(currentChapterIndex - 1)}
                  disabled={currentChapterIndex === 0}
                  className="p-3 rounded-full disabled:opacity-30 transition-opacity"
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  animate={{ opacity: showNav || currentChapterIndex > 0 ? 1 : 0 }}
                >
                  <ChevronLeft className="w-8 h-8" />
                </motion.button>

                <div className="flex-1 flex flex-col items-center">
                  <div className="w-full bg-gray-300/50 dark:bg-gray-600/50 rounded-full h-2.5">
                    <motion.div
                      className="bg-blue-600 h-2.5 rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: `${((currentChapterIndex + 1) / (story.chapters?.length || 1)) * 100}%` }}
                      transition={{ ease: "easeInOut" }}
                    />
                  </div>
                  <span className="text-xs mt-1.5">{t('story.reader.chapter')} {currentChapterIndex + 1} / {story.chapters?.length || 1}</span>
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
                    className={`px-6 py-3 rounded-full font-bold text-white transition-all ${storyCompleted
                      ? 'bg-green-600 cursor-default'
                      : 'bg-purple-600 hover:bg-purple-700 hover:scale-105'
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
                    className="p-3 rounded-full disabled:opacity-30 transition-opacity"
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    animate={{ opacity: showNav || (story.chapters && currentChapterIndex < story.chapters.length - 1) ? 1 : 0 }}
                  >
                    <ChevronRight className="w-8 h-8" />
                  </motion.button>
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

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

      {/* Fullscreen Artifact Reward Display */}
      <ArtifactRewardToast
        item={currentArtifact?.item || null}
        isVisible={!!currentArtifact}
        onClose={handleCloseArtifact}
        isUpgrade={currentArtifact?.isUpgrade}
      />

    </div>
  );
};

export default StoryReaderScreen;
