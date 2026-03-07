import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';

import { useBackend } from '../../hooks/useBackend';
import { useGrowthCelebration } from '../../hooks/useGrowthCelebration';
import { useOptionalUserAccess } from '../../contexts/UserAccessContext';
import { useOptionalChildProfiles } from '../../contexts/ChildProfilesContext';
import Button from '../../components/common/Button';
import type { Doku, DokuSection } from '../../types/doku';
import type { Avatar } from '../../types/avatar';
import { QuizComponent } from '../../components/reader/QuizComponent';
import { FactsComponent } from '../../components/reader/FactsComponent';
import { ActivityComponent } from '../../components/reader/ActivityComponent';
import { PersonalityChangeNotification } from '../../components/common/PersonalityDevelopment';
import { GrowthCelebrationModal } from '../../components/avatar/GrowthCelebrationModal';
import { exportDokuAsPDF, isPDFExportSupported } from '../../utils/pdfExport';
import { getOfflineDoku } from '../../utils/offlineDb';
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
  const { isAdmin } = useOptionalUserAccess();
  const activeProfileId = useOptionalChildProfiles()?.activeProfileId;
  const mapAvatarId = new URLSearchParams(location.search).get('mapAvatarId');
  const queryDomainHint = new URLSearchParams(location.search).get('domain');
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

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

  // Growth celebration modal
  const { isOpen: showGrowthCelebration, data: growthData, triggerCelebration, closeCelebration } = useGrowthCelebration();

  const contentRef = useRef<HTMLDivElement>(null);

  // PDF Export state
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

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

      // Try to load from offline storage first
      let dokuData: any = await getOfflineDoku(dokuId);

      // If not found offline, fetch from backend
      if (!dokuData) {
        dokuData = await backend.doku.getDoku({ id: dokuId });
      } else {
        console.log('[DokuReaderScreen] Loaded doku from offline storage');
      }

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

  const handleExportPDF = async () => {
    if (!isAdmin) {
      return;
    }

    if (!doku || !isPDFExportSupported()) {
      const { showErrorToast } = await import('../../utils/toastUtils');
      showErrorToast('PDF-Export wird in diesem Browser nicht unterstützt');
      return;
    }

    try {
      setIsExportingPDF(true);
      setExportProgress(0);

      const { showSuccessToast } = await import('../../utils/toastUtils');

      await exportDokuAsPDF(doku, (progress) => {
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
          perspective: doku.metadata?.configSnapshot?.perspective,
          profileId: activeProfileId || undefined,
          domainId:
            (queryDomainHint ? queryDomainHint : undefined) ||
            doku.metadata?.configSnapshot?.domainId,
          // No avatarId = update all eligible avatars
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Personality updates applied:', result);

        window.dispatchEvent(
          new CustomEvent('personalityUpdated', {
            detail: {
              avatarId: mapAvatarId ?? undefined,
              refreshProgression: true,
              source: 'doku',
              updatedAt: new Date().toISOString(),
            },
          })
        );
        emitMapProgress({ avatarId: mapAvatarId, source: 'doku' });

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

        // 🎉 Trigger growth celebration modal (especially for mastery tier-ups)
        if (result.personalityChanges && result.personalityChanges.length > 0) {
          triggerCelebration(result.personalityChanges, 'doku', doku?.title);
        }

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
        emitMapProgress({ avatarId: mapAvatarId, source: 'doku' });

        // Show error notification
        import('../../utils/toastUtils').then(({ showErrorToast }) => {
          showErrorToast(t('errors.generic'));
        });
      }
    } catch (error) {
      console.error('❌ Error applying personality updates:', error);
      emitMapProgress({ avatarId: mapAvatarId, source: 'doku' });

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
                src={section.originalSection.imageUrl || doku?.coverImageUrl || '/placeholder-doku.jpg'}
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
            dokuTopic={doku?.topic}
            dokuMetadata={doku?.metadata}
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

  if (loading) {
    return (
      <div className="relative min-h-screen">
        <TaleaPageBackground isDark={isDark} />
        <div className={`${taleaPageShellClass} flex min-h-screen items-center justify-center py-12`}>
          <TaleaSurface className="w-full max-w-lg p-8 text-center sm:p-10">
            <div className="mx-auto mb-5 h-14 w-14 rounded-full border-[3px] border-[#8dbcae] border-t-transparent animate-spin dark:border-[#9dc6e4]" />
            <h2
              className="text-[2rem] font-semibold text-slate-900 dark:text-white"
              style={{ fontFamily: taleaDisplayFont }}
            >
              {t('doku.loading')}
            </h2>
          </TaleaSurface>
        </div>
      </div>
    );
  }

  if (error || !doku) {
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
              {error || t('doku.notFound')}
            </p>
            <div className="mt-6 flex justify-center">
              <TaleaActionButton variant="secondary" onClick={() => navigate('/doku')} icon={<ArrowLeft className="h-4 w-4" />}>
                {t('common.back')}
              </TaleaActionButton>
            </div>
          </TaleaSurface>
        </div>
      </div>
    );
  }

  const currentDisplayableSection = displayableSections[currentIndex];

  return (
    <div className="relative h-screen overflow-hidden">
      <TaleaPageBackground isDark={isDark} />
      <button
        onClick={() => isReading ? setIsReading(false) : navigate('/doku')}
        className="absolute left-3 top-3 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/75 bg-white/72 text-slate-700 shadow-[0_14px_32px_-24px_rgba(150,122,99,0.46)] backdrop-blur-xl transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f2e7fb] dark:border-white/10 dark:bg-white/8 dark:text-slate-100 dark:shadow-[0_18px_40px_-26px_rgba(2,8,23,0.9)] dark:focus-visible:ring-[#243753]"
        aria-label={t('common.back')}
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <AnimatePresence initial={false}>
        {!isReading ? (
          <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-full items-center justify-center px-3 py-24">
            <div className={`${taleaPageShellClass}`}>
              <TaleaSurface className="mx-auto max-w-5xl p-5 md:p-7">
                <div className="grid gap-6 lg:grid-cols-[minmax(16rem,24rem)_minmax(0,1fr)] lg:items-center">
                  <div className="overflow-hidden rounded-[28px] border border-white/70 bg-white/70 shadow-[0_24px_56px_-32px_rgba(150,122,99,0.54)] dark:border-white/10 dark:bg-white/5">
                    <img src={doku?.coverImageUrl || '/placeholder-doku.jpg'} alt={doku?.title} className="aspect-[4/5] w-full object-cover" />
                  </div>

                  <div className="text-left">
                    <span className={`${taleaChipClass} border-white/75 bg-white/75 text-[#7da697] dark:border-white/10 dark:bg-white/5 dark:text-[#a9d6c6]`}>
                      Doku Reader
                    </span>
                    <h1
                      className="mt-4 text-4xl font-semibold leading-tight text-slate-900 dark:text-white md:text-[3.4rem]"
                      style={{ fontFamily: taleaDisplayFont }}
                    >
                      {doku?.title}
                    </h1>
                    <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-slate-600 dark:text-slate-300">
                      {doku?.summary}
                    </p>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[22px] border border-white/70 bg-white/66 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Abschnitte</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{displayableSections.length || 0}</p>
                      </div>
                      <div className="rounded-[22px] border border-white/70 bg-white/66 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Thema</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{doku?.topic || 'Doku'}</p>
                      </div>
                      <div className="rounded-[22px] border border-white/70 bg-white/66 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Bereit</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">Mit Quiz, Fakten und Aktivitaeten</p>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <TaleaActionButton onClick={startReading} icon={<FlaskConical className="h-4 w-4" />}>
                        {t('doku.readDoku')}
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
                key={currentIndex}
                custom={animationDirection}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                className="absolute inset-x-0 bottom-24 top-16"
              >
                {currentDisplayableSection && renderSection(currentDisplayableSection)}
              </motion.div>
            </AnimatePresence>

            <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-3">
              <div className="mx-auto max-w-4xl">
                <TaleaSurface className="p-3 md:p-4">
                  <div className="flex items-center justify-between gap-4">
                <motion.button onClick={() => goToIndex(currentIndex - 1)} disabled={currentIndex === 0} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/75 bg-white/72 text-slate-700 transition disabled:opacity-35 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} animate={{ opacity: showNav || currentIndex > 0 ? 1 : 0 }}>
                    <ChevronLeft className="h-6 w-6" />
                </motion.button>
                    <div className="flex-1">
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-300/45 dark:bg-white/10">
                        <motion.div className="h-full rounded-full bg-[linear-gradient(90deg,#b8d9cd_0%,#d9e8f7_100%)]" initial={{ width: '0%' }} animate={{ width: `${((currentIndex + 1) / (displayableSections.length || 1)) * 100}%` }} transition={{ ease: "easeInOut" }} />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        <span>{t('doku.sections')} {currentIndex + 1}</span>
                        <span>{displayableSections.length || 1}</span>
                      </div>
                    </div>
                <motion.button onClick={() => goToIndex(currentIndex + 1)} disabled={currentIndex === displayableSections.length - 1} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/75 bg-white/72 text-slate-700 transition disabled:opacity-35 dark:border-white/10 dark:bg-white/5 dark:text-slate-100" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} animate={{ opacity: showNav || currentIndex < displayableSections.length - 1 ? 1 : 0 }}>
                    <ChevronRight className="h-6 w-6" />
                </motion.button>
                  </div>
                </TaleaSurface>
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
              className="bg-[#13102B]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"
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

      {/* Growth Celebration Modal */}
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

export default DokuReaderScreen;
