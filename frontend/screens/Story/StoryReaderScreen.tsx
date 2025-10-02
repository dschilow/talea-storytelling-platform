import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';

import { useBackend } from '../../hooks/useBackend';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import type { Story, Chapter } from '../../types/story';
import type { Avatar } from '../../types/avatar';


const StoryReaderScreen: React.FC = () => {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backend = useBackend();
  const { getToken } = useAuth();

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isReading, setIsReading] = useState(false);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [showNav, setShowNav] = useState(false);
  const [animationDirection, setAnimationDirection] = useState(1);
  
  // Lese-Status
  const [storyCompleted, setStoryCompleted] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (storyId) {
      loadStory();
    }
    
    // Keine Avatar-Auswahl mehr nötig – Updates erfolgen serverseitig bei Generierung
    
    // Test toast to verify system works
    console.log('About to show test toast for Story Reader');
    import('../../utils/toastUtils').then(({ showSuccessToast }) => {
      showSuccessToast('Story Reader geladen! 📖');
      console.log('Test toast should be shown now');
    });
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

  const loadStory = async () => {
    if (!storyId) return;
    try {
      setLoading(true);
      setError(null);
      const storyData = await backend.story.get(storyId);
      setStory(storyData as unknown as Story);
    } catch (err) {
      console.error('Error loading story:', err);
      setError('Geschichte konnte nicht geladen werden.');
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
    if (!story || index < 0 || index >= story.chapters!.length) return;
    
    setAnimationDirection(index > currentChapterIndex ? 1 : -1);
    setCurrentChapterIndex(index);
    setShowNav(false);
    
    // Check if story is completed (reached last chapter)
    if (index === story.chapters!.length - 1 && !storyCompleted) {
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
      const target = import.meta.env.VITE_CLIENT_TARGET || 'http://localhost:4000';
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
          genre: story.genre,
          // No avatarId = update all eligible avatars
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Personality updates applied:', result);

        // Show success notification
        import('../../utils/toastUtils').then(({ showSuccessToast }) => {
          showSuccessToast(`📖 Geschichte abgeschlossen! ${result.updatedAvatars} Avatare entwickelt.`);
        });
      } else {
        const errorText = await response.text();
        console.warn('⚠️ Failed to apply personality updates:', response.statusText, errorText);

        // Show error notification but still show completion
        import('../../utils/toastUtils').then(({ showErrorToast, showStoryCompletionToast }) => {
          showErrorToast('❌ Fehler bei der Persönlichkeitsentwicklung');
          showStoryCompletionToast(story.title);
        });
      }

    } catch (error) {
      console.error('❌ Error during story completion processing:', error);

      // Show error notification but still show completion
      import('../../utils/toastUtils').then(({ showErrorToast, showStoryCompletionToast }) => {
        showErrorToast('❌ Netzwerkfehler bei der Persönlichkeitsentwicklung');
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
          <p className="text-lg text-gray-600 dark:text-gray-300">Lade Geschichte...</p>
        </div>
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Fehler</h2>
          <p className="text-gray-700 dark:text-gray-200 mb-6">{error || 'Die Geschichte konnte nicht gefunden werden.'}</p>
          <button onClick={() => navigate('/stories')} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center mx-auto">
            <ArrowLeft size={18} className="mr-2" /> Zurück
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
            <button onClick={startReading} className="px-8 py-3 bg-blue-600 text-white font-bold rounded-full shadow-lg hover:bg-blue-700 transition-transform hover:scale-105">
              Lesen
            </button>
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
                  <div className="max-w-3xl mx-auto text-lg md:text-xl text-gray-700 dark:text-gray-300 leading-relaxed space-y-6">
                    {currentChapter?.content.split('\n').map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation & Progress */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700">
              <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
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
                  <span className="text-xs mt-1.5">Kapitel {currentChapterIndex + 1} / {story.chapters?.length || 1}</span>
                </div>

{/* Next Chapter / Complete Story Button */}
                {story.chapters && currentChapterIndex === story.chapters.length - 1 ? (
                  // Last chapter - show "Complete Story" button
                  <motion.button 
                    onClick={() => {
                      if (!storyCompleted) {
                        handleStoryCompletion();
                      }
                    }}
                    disabled={storyCompleted}
                    className={`px-6 py-3 rounded-full font-bold text-white transition-all ${
                      storyCompleted 
                        ? 'bg-green-600 cursor-default' 
                        : 'bg-purple-600 hover:bg-purple-700 hover:scale-105'
                    }`}
                    whileHover={!storyCompleted ? { scale: 1.05 } : {}} 
                    whileTap={!storyCompleted ? { scale: 0.95 } : {}}
                    animate={{ opacity: showNav ? 1 : 0.7 }}
                  >
                    {storyCompleted ? '🎉 Abgeschlossen!' : '🏁 Geschichte abschließen'}
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
      
      {/* Keine Avatar-Auswahl mehr notwendig */}

    </div>
  );
};

export default StoryReaderScreen;
