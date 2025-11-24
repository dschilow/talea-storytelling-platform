import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';

import { useBackend } from '../../hooks/useBackend';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import type { Doku, DokuSection } from '../../types/doku';
import type { Avatar } from '../../types/avatar';
import { QuizComponent } from '../../components/reader/QuizComponent';
import { FactsComponent } from '../../components/reader/FactsComponent';
import { ActivityComponent } from '../../components/reader/ActivityComponent';
import { PersonalityChangeNotification } from '../../components/common/PersonalityDevelopment';

// Define a new type for our flattened, displayable sections
interface DisplayableSection {
  type: 'content' | 'facts' | 'quiz' | 'activity';
  originalSection: DokuSection;
  id: string;
}

const DokuReaderScreen: React.FC = () => {
  const { t } = useTranslation();
  const { dokuId } = useParams<{ dokuId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backend = useBackend();
  const { getToken } = useAuth();

  const [doku, setDoku] = useState<Doku | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isReading, setIsReading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNav, setShowNav] = useState(false);
  const [animationDirection, setAnimationDirection] = useState(1);

  // Avatar-Integration (nur für UI-Notifications, keine Auswahl mehr nötig)
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);
  const [personalityChanges, setPersonalityChanges] = useState<Array<{ trait: string; change: number }>>([]);
  const [showPersonalityNotification, setShowPersonalityNotification] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);

  // Memoize the transformation of doku sections into a flat, displayable array
  const displayableSections: DisplayableSection[] = useMemo(() => {
    if (!doku?.content?.sections) return [];

    const flatSections: DisplayableSection[] = [];
    doku.content.sections.forEach((section, index) => {
      // 1. Add the main content
      if (section.content) {
        flatSections.push({ type: 'content', originalSection: section, id: `content-${index}` });
      }
      // 2. Add key facts, if they exist
      if (section.keyFacts && section.keyFacts.length > 0) {
        flatSections.push({ type: 'facts', originalSection: section, id: `facts-${index}` });
      }
      // 3. Add activities, if they exist
      if (section.interactive?.activities?.enabled && section.interactive.activities.items?.length > 0) {
        flatSections.push({ type: 'activity', originalSection: section, id: `activity-${index}` });
      }
      // 4. Add quiz, if it exists
      if (section.interactive?.quiz?.enabled && section.interactive.quiz.questions?.length > 0) {
        flatSections.push({ type: 'quiz', originalSection: section, id: `quiz-${index}` });
      }
    });
    return flatSections;
  }, [doku]);

  useEffect(() => {
    if (dokuId) {
      loadDoku();
    }

    // Removed test toast - was showing duplicate notifications
  }, [dokuId]);

  // Keine Avatar-Auswahl mehr erforderlich – Updates erfolgen serverseitig

  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) {
      // For non-scrollable components, just show nav
      setShowNav(true);
      return;
    }

    const handleScroll = () => {
      const isAtBottom = contentEl.scrollHeight - contentEl.scrollTop <= contentEl.clientHeight + 5;
      setShowNav(isAtBottom);
    };

    contentEl.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => contentEl.removeEventListener('scroll', handleScroll);
  }, [currentIndex, isReading]);

  const loadDoku = async () => {
    if (!dokuId) return;
    try {
      setLoading(true);
      setError(null);
      const dokuData = await backend.doku.getDoku({ id: dokuId });
      setDoku(dokuData as unknown as Doku);
    } catch (err) {
      console.error('Error loading doku:', err);
      setError((err as Error).message || t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  // Keine Avatar-Auswahl-Funktionen mehr nötig

  const startReading = () => {
    setIsReading(true);
    setShowNav(false);
  };

  const goToIndex = (index: number) => {
    if (index >= 0 && index < displayableSections.length) {
      setAnimationDirection(index > currentIndex ? 1 : -1);
      setCurrentIndex(index);
      setShowNav(false);

      // Check if user finished reading the doku
      if (index === displayableSections.length - 1) {
        handleDokuCompletion();
      }
    }
  };

  const handlePersonalityChange = (changes: Array<{ trait: string; change: number }>) => {
    setPersonalityChanges(changes);
    setShowPersonalityNotification(true);

    // Import and show toast notification
    import('../../utils/toastUtils').then(({ showPersonalityUpdateToast }) => {
      showPersonalityUpdateToast(changes);
    });

    setTimeout(() => {
      setShowPersonalityNotification(false);
    }, 4000);
  };

  // WICHTIG: Backend-Call für Persönlichkeitsentwicklung beim Doku-Lesen
  const handleDokuCompletion = async () => {
    if (!doku || !dokuId) return;

    console.log('📖 Doku completed - triggering personality updates for all eligible avatars');

    try {
      // Get auth token and make direct API call
      const token = await getToken();

      const { getBackendUrl } = await import('../../config');
      const target = getBackendUrl();
      const response = await fetch(`${target}/doku/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({
          dokuId: dokuId,
          dokuTitle: doku.title,
          topic: doku.topic,
          // No avatarId = update all eligible avatars
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Personality updates applied:', result);

        // Show success notification with compact personality changes
        import('../../utils/toastUtils').then(({ showSuccessToast }) => {
          // Build compact message with trait changes
          let message = `📚 ${t('doku.readDoku')} ${t('common.finish')}! ${result.updatedAvatars} ${t('avatar.title')}.\n\n`;

          if (result.personalityChanges && result.personalityChanges.length > 0) {
            result.personalityChanges.forEach((avatarChange: any) => {
              const changes = avatarChange.changes.map((change: any) => {
                // Extract trait name and points from description
                const points = change.change > 0 ? `+${change.change}` : `${change.change}`;
                return `${points} ${getTraitDisplayName(change.trait)}`;
              }).join(', ');
              message += `${avatarChange.avatarName}: ${changes}\n`;
            });
          }

          showSuccessToast(message.trim());
        });

        // Helper function to get German trait names
        function getTraitDisplayName(trait: string): string {
          // Handle subcategories like "knowledge.history"
          const parts = trait.split('.');
          const subcategory = parts.length > 1 ? parts[1] : null;
          const mainTrait = parts[0];

          const names: Record<string, string> = {
            // Main traits
            'knowledge': t('avatar.personalityTraits.knowledge'),
            'creativity': t('avatar.personalityTraits.creativity'),
            'vocabulary': t('avatar.personalityTraits.vocabulary'),
            'courage': t('avatar.personalityTraits.courage'),
            'curiosity': t('avatar.personalityTraits.curiosity'),
            'teamwork': t('avatar.personalityTraits.teamwork'),
            'empathy': t('avatar.personalityTraits.empathy'),
            'persistence': t('avatar.personalityTraits.persistence'),
            'logic': t('avatar.personalityTraits.logic'),
            // Subcategories
            'history': t('doku.perspectives.history'),
            'science': t('doku.perspectives.science'),
            'geography': 'Geografie', // Add to translations if missing
            'physics': 'Physik', // Add to translations if missing
            'biology': 'Biologie', // Add to translations if missing
            'chemistry': 'Chemie', // Add to translations if missing
            'mathematics': 'Mathematik', // Add to translations if missing
            'kindness': 'Freundlichkeit', // Add to translations if missing
            'humor': 'Humor', // Add to translations if missing
            'determination': 'Entschlossenheit', // Add to translations if missing
            'wisdom': 'Weisheit' // Add to translations if missing
          };

          // If it's a subcategory, return only the subcategory name
          if (subcategory) {
            return names[subcategory.toLowerCase()] || subcategory;
          }

          return names[mainTrait.toLowerCase()] || trait;
        }
      } else {
        const errorText = await response.text();
        console.warn('⚠️ Failed to apply personality updates:', response.statusText, errorText);

        // Show error notification
        import('../../utils/toastUtils').then(({ showErrorToast }) => {
          showErrorToast(t('errors.generic'));
        });
      }
    } catch (error) {
      console.error('❌ Error applying personality updates:', error);

      // Show error notification
      import('../../utils/toastUtils').then(({ showErrorToast }) => {
        showErrorToast(t('errors.networkError'));
      });
    }
  };

  const variants = {
    enter: (direction: number) => ({ opacity: 0, filter: 'blur(10px)', x: direction * 50 }),
    center: { opacity: 1, filter: 'blur(0px)', x: 0, transition: { duration: 0.4 } },
    exit: (direction: number) => ({ opacity: 0, filter: 'blur(10px)', x: direction * -50, transition: { duration: 0.2 } }),
  };

  const renderSection = (section: DisplayableSection) => {
    switch (section.type) {
      case 'content':
        return (
          <div className="w-full h-full flex flex-col pt-20 pb-32">
            <div className="text-center px-4">
              <img
                src={doku?.coverImageUrl || '/placeholder-doku.jpg'}
                alt={section.originalSection.title || ''}
                className="w-full max-w-4xl max-h-[40vh] object-cover rounded-lg shadow-lg mx-auto mb-4"
              />
              <h2 className="text-2xl md:text-4xl font-bold text-gray-800 dark:text-white mb-6">{section.originalSection.title}</h2>
            </div>
            <div ref={contentRef} className="flex-1 overflow-y-auto px-4 md:px-12">
              <div className="max-w-3xl mx-auto text-lg md:text-xl text-gray-700 dark:text-gray-300 leading-relaxed space-y-6">
                {section.originalSection.content.split('\n').map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </div>
          </div>
        );
      case 'quiz':
        return (
          <QuizComponent
            section={section.originalSection}
            avatarId={selectedAvatar?.id}
            dokuTitle={doku?.title}
            dokuId={dokuId}
            onPersonalityChange={handlePersonalityChange}
          />
        );
      case 'facts':
        return <FactsComponent section={section.originalSection} />;
      case 'activity':
        return <ActivityComponent section={section.originalSection} />;
      default:
        return <div>Unknown section type</div>;
    }
  };

  if (loading) { /* ... loading spinner ... */ }
  if (error || !doku) { /* ... error message ... */ }

  const currentDisplayableSection = displayableSections[currentIndex];

  return (
    <div className="w-screen h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
      <button onClick={() => isReading ? setIsReading(false) : navigate('/doku')} className="absolute top-4 left-4 z-20 p-2 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-full shadow-md hover:scale-105 transition-transform">
        <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-gray-200" />
      </button>

      <AnimatePresence initial={false}>
        {!isReading ? (
          <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
            <img src={doku?.coverImageUrl || '/placeholder-doku.jpg'} alt={doku?.title} className="w-48 h-48 md:w-64 md:h-64 rounded-lg shadow-2xl mb-6 object-cover" />
            <h1 className="text-3xl md:text-5xl font-bold text-gray-800 dark:text-white mb-4">{doku?.title}</h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mb-8">{doku?.summary}</p>
            <button onClick={startReading} className="px-8 py-3 bg-teal-600 text-white font-bold rounded-full shadow-lg hover:bg-teal-700 transition-transform hover:scale-105">
              {t('doku.readDoku')}
            </button>
          </motion.div>
        ) : (
          <div key="reader" className="w-full h-full flex flex-col">
            <AnimatePresence initial={false} custom={animationDirection}>
              <motion.div
                key={currentIndex}
                custom={animationDirection}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                className="w-full h-full absolute inset-0"
              >
                {currentDisplayableSection && renderSection(currentDisplayableSection)}
              </motion.div>
            </AnimatePresence>

            <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700">
              <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                <motion.button onClick={() => goToIndex(currentIndex - 1)} disabled={currentIndex === 0} className="p-3 rounded-full disabled:opacity-30" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} animate={{ opacity: showNav || currentIndex > 0 ? 1 : 0 }}>
                  <ChevronLeft className="w-8 h-8" />
                </motion.button>
                <div className="flex-1 flex flex-col items-center">
                  <div className="w-full bg-gray-300/50 dark:bg-gray-600/50 rounded-full h-2.5">
                    <motion.div className="bg-teal-600 h-2.5 rounded-full" initial={{ width: '0%' }} animate={{ width: `${((currentIndex + 1) / (displayableSections.length || 1)) * 100}%` }} transition={{ ease: "easeInOut" }} />
                  </div>
                  <span className="text-xs mt-1.5">{t('doku.sections')} {currentIndex + 1} / {displayableSections.length || 1}</span>
                </div>
                <motion.button onClick={() => goToIndex(currentIndex + 1)} disabled={currentIndex === displayableSections.length - 1} className="p-3 rounded-full disabled:opacity-30" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} animate={{ opacity: showNav || currentIndex < displayableSections.length - 1 ? 1 : 0 }}>
                  <ChevronRight className="w-8 h-8" />
                </motion.button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Avatar Selection Modal (deaktiviert) */}
      <AnimatePresence>
        {false && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Hinweis</h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Die Doku-Teilnahme erfasst Persönlichkeits- und Wissens-Entwicklungen automatisch. Eine manuelle Avatar-Auswahl ist nicht mehr nötig.
              </p>

              <div className="space-y-3" />

              <div className="mt-6 flex justify-between">
                <Button
                  title={t('common.next')}
                  onPress={() => { }}
                  variant="primary"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Personality Change Notification */}
      <AnimatePresence>
        {showPersonalityNotification && personalityChanges.length > 0 && (
          <PersonalityChangeNotification
            changes={personalityChanges}
            visible={showPersonalityNotification}
            onClose={() => setShowPersonalityNotification(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default DokuReaderScreen;
