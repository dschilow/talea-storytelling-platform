import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';

import { useBackend } from '../../hooks/useBackend';
import { TracingBeam } from '../../components/ui/tracing-beam';
import { TextGradientScroll } from '../../components/ui/text-gradient-scroll';
import type { Story, Chapter } from '../../types/story';

const StoryScrollReaderScreen: React.FC = () => {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const backend = useBackend();
  const { getToken } = useAuth();

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isReading, setIsReading] = useState(false);
  const [storyCompleted, setStoryCompleted] = useState(false);

  useEffect(() => {
    if (storyId) {
      loadStory();
    }
  }, [storyId]);

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

  const startReading = () => {
    setIsReading(true);
  };

  const handleStoryCompletion = async () => {
    console.log('📖 Story completed - triggering personality updates for all eligible avatars');
    if (!story || !storyId || storyCompleted) {
      console.log('Story completion aborted - missing requirements or already completed');
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
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({
          storyId: storyId,
          storyTitle: story.title,
          genre: story.config.genre,
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Personality updates applied:', result);

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
        const errorText = await response.text();
        console.warn('⚠️ Failed to apply personality updates:', response.statusText, errorText);

        import('../../utils/toastUtils').then(({ showErrorToast, showStoryCompletionToast }) => {
          showErrorToast('❌ Fehler bei der Persönlichkeitsentwicklung');
          showStoryCompletionToast(story.title);
        });
      }

    } catch (error) {
      console.error('❌ Error during story completion processing:', error);

      import('../../utils/toastUtils').then(({ showErrorToast, showStoryCompletionToast }) => {
        showErrorToast('❌ Netzwerkfehler bei der Persönlichkeitsentwicklung');
        showStoryCompletionToast(story.title);
      });
    }
  };

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
              className="px-10 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-lg rounded-full shadow-xl hover:shadow-2xl transition-all"
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
                      {/* Chapter Badge */}
                      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full text-sm w-fit px-6 py-2 mb-6 font-semibold shadow-lg">
                        Kapitel {index + 1}
                      </div>

                      {/* Chapter Title */}
                      <h2 className="text-3xl md:text-4xl mb-6 font-bold text-gray-800 dark:text-white">
                        {chapter.title}
                      </h2>

                      {/* Chapter Image */}
                      {chapter.imageUrl && (
                        <img
                          src={chapter.imageUrl}
                          alt={chapter.title}
                          className="rounded-2xl mb-8 w-full object-cover shadow-2xl"
                          style={{ maxHeight: '500px' }}
                        />
                      )}

                      {/* Chapter Content with Gradient Scroll Effect */}
                      <div className="text-lg md:text-xl prose prose-lg dark:prose-invert max-w-none leading-relaxed">
                        {chapter.content.split('\n').map((paragraph, pIndex) => (
                          paragraph.trim() && (
                            <div key={`p-${index}-${pIndex}`} className="mb-6">
                              <TextGradientScroll 
                                text={paragraph}
                                type="word"
                                textOpacity="soft"
                                className="text-gray-700 dark:text-gray-300"
                              />
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Completion Button */}
                  <div className="flex flex-col items-center justify-center py-16 border-t-2 border-dashed border-gray-300 dark:border-gray-600">
                    <motion.button 
                      onClick={handleStoryCompletion}
                      disabled={storyCompleted}
                      className={`px-12 py-5 rounded-full font-bold text-xl text-white transition-all shadow-2xl ${
                        storyCompleted 
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 cursor-default' 
                          : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-purple-500/50 hover:scale-105'
                      }`}
                      whileHover={!storyCompleted ? { scale: 1.05 } : {}} 
                      whileTap={!storyCompleted ? { scale: 0.95 } : {}}
                    >
                      {storyCompleted ? '🎉 Geschichte abgeschlossen!' : '🏁 Geschichte abschließen'}
                    </motion.button>
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
    </div>
  );
};

export default StoryScrollReaderScreen;

