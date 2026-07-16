import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, LoaderCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';

import { useBackend } from '../../hooks/useBackend';
import { useOptionalChildProfiles } from '../../contexts/ChildProfilesContext';
import { TracingBeam } from '../../components/ui/tracing-beam';
import { TextGradientScroll } from '../../components/ui/text-gradient-scroll';
import type { Doku, DokuSection } from '../../types/doku';
import { QuizComponent } from '../../components/reader/QuizComponent';
import { FactsComponent } from '../../components/reader/FactsComponent';
import { ActivityComponent } from '../../components/reader/ActivityComponent';
import { getOfflineDoku } from '../../utils/offlineDb';
import { emitMapProgress } from '../Journey/TaleaLearningPathProgressStore';

const DokuScrollReaderScreen: React.FC = () => {
  const { t } = useTranslation();
  const { dokuId } = useParams<{ dokuId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backend = useBackend();
  const { getToken } = useAuth();
  const childProfileContext = useOptionalChildProfiles();
  const activeProfileId = childProfileContext?.activeProfileId;
  const mapAvatarId = new URLSearchParams(location.search).get('mapAvatarId');
  const targetAvatarId =
    mapAvatarId ??
    childProfileContext?.activeProfile?.childAvatarId ??
    childProfileContext?.activeProfile?.preferredAvatarIds?.[0] ?? null;
  const queryDomainHint = new URLSearchParams(location.search).get('domain');

  const [doku, setDoku] = useState<Doku | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isReading, setIsReading] = useState(false);
  const [dokuCompleted, setDokuCompleted] = useState(false);
  const [completionPending, setCompletionPending] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const loadRequestRef = useRef(0);
  const completionAttemptRef = useRef(0);
  const completionInFlightRef = useRef(false);

  useEffect(() => {
    const requestId = ++loadRequestRef.current;
    completionAttemptRef.current += 1;
    completionInFlightRef.current = false;
    setDoku(null);
    setDokuCompleted(false);
    setCompletionPending(false);
    setCompletionError(null);
    if (dokuId) void loadDoku(requestId);

    return () => {
      if (loadRequestRef.current === requestId) loadRequestRef.current += 1;
      completionAttemptRef.current += 1;
      completionInFlightRef.current = false;
    };
  }, [dokuId, activeProfileId]);

  const loadDoku = async (requestId: number) => {
    if (!dokuId) return;
    try {
      setLoading(true);
      setError(null);

      // Try to load from offline storage first
      let dokuData: any = await getOfflineDoku(dokuId);

      // If not found offline, fetch from backend
      if (!dokuData) {
        dokuData = await backend.doku.getDoku({
          id: dokuId,
          profileId: activeProfileId || undefined,
        });
      } else {
        console.log('[DokuScrollReaderScreen] Loaded doku from offline storage');
      }

      if (loadRequestRef.current !== requestId) return;
      setDoku(dokuData as unknown as Doku);
    } catch (err) {
      if (loadRequestRef.current !== requestId) return;
      console.error('Error loading doku:', err);
      setError((err as Error).message || t('errors.generic'));
    } finally {
      if (loadRequestRef.current === requestId) setLoading(false);
    }
  };

  const startReading = () => {
    setIsReading(true);
  };

  const handleDokuCompletion = async () => {
    console.log('📚 Doku completed - updating its selected avatar');
    if (!doku || !dokuId || dokuCompleted || completionInFlightRef.current) {
      console.log('Doku completion aborted - missing requirements or already completed');
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
          avatarId: targetAvatarId ?? undefined,
          domainId:
            (queryDomainHint ? queryDomainHint : undefined) ||
            doku.metadata?.configSnapshot?.domainId,
        })
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(`Doku completion failed with status ${response.status}`);
      }
      if (result?.success !== true) {
        throw new Error('Doku completion was not confirmed by the server.');
      }
      if (completionAttemptRef.current !== attemptId) return;

      setDokuCompleted(true);
        console.log('✅ Personality updates applied:', result);
        window.dispatchEvent(
          new CustomEvent('personalityUpdated', {
            detail: {
              avatarId: targetAvatarId ?? undefined,
              refreshProgression: true,
              source: 'doku',
              updatedAt: new Date().toISOString(),
            },
          }),
        );
        emitMapProgress({ avatarId: mapAvatarId, source: 'doku' });

        import('../../utils/toastUtils').then(({ showSuccessToast }) => {
          let message = `📚 ${t('doku.readDoku')} ${t('common.finish')}! ${result.updatedAvatars} ${t('avatar.title')}.\n\n`;

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
      if (!response.ok) {
        const errorText = await response.text();
        console.warn('⚠️ Failed to apply personality updates:', response.statusText, errorText);

        import('../../utils/toastUtils').then(({ showErrorToast }) => {
          showErrorToast(t('errors.generic'));
        });
      }

    } catch (error) {
      console.error('❌ Error during doku completion processing:', error);
      if (completionAttemptRef.current !== attemptId) return;
      const message = 'Dein Lernfortschritt konnte noch nicht gespeichert werden. Bitte versuche es erneut.';
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

  function getTraitDisplayName(trait: string): string {
    const parts = trait.split('.');
    const subcategory = parts.length > 1 ? parts[1] : null;
    const mainTrait = parts[0];

    const names: Record<string, string> = {
      'knowledge': t('avatar.personalityTraits.knowledge'),
      'creativity': t('avatar.personalityTraits.creativity'),
      'vocabulary': t('avatar.personalityTraits.vocabulary'),
      'courage': t('avatar.personalityTraits.courage'),
      'curiosity': t('avatar.personalityTraits.curiosity'),
      'teamwork': t('avatar.personalityTraits.teamwork'),
      'empathy': t('avatar.personalityTraits.empathy'),
      'persistence': t('avatar.personalityTraits.persistence'),
      'logic': t('avatar.personalityTraits.logic'),
      'history': t('doku.perspectives.history'),
      'science': t('doku.perspectives.science'),
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
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-600 dark:text-gray-300">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !doku) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <div className="text-center p-8 bg-[#13102B]/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl">
          <h2 className="text-2xl font-bold text-red-500 mb-4">{t('common.error')}</h2>
          <p className="text-gray-700 dark:text-gray-200 mb-6">{error || t('errors.notFound')}</p>
          <button onClick={() => navigate('/doku')} className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600 transition-colors flex items-center mx-auto">
            <ArrowLeft size={18} className="mr-2" /> {t('common.back')}
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
            onClick={() => isReading ? setIsReading(false) : navigate('/doku')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">{t('common.back')}</span>
          </button>

          {isReading && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <BookOpen className="w-5 h-5" />
              <span className="text-sm font-medium">{doku.content?.sections?.length || 0} {t('doku.sections')}</span>
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
              src={doku.coverImageUrl || '/placeholder-doku.jpg'}
              alt={doku.title}
              className="w-64 h-64 md:w-80 md:h-80 rounded-2xl shadow-2xl mb-8 object-cover"
              layoutId={`doku-cover-${doku.id}`}
            />
            <h1 className="text-4xl md:text-6xl font-bold text-gray-800 dark:text-white mb-6 max-w-4xl">
              {doku.title}
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mb-10 leading-relaxed">
              {doku.summary}
            </p>
            <motion.button
              onClick={startReading}
              className="px-10 py-4 bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-bold text-lg rounded-full shadow-xl hover:shadow-2xl transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              📚 {t('doku.readDoku')}
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
                  {doku.content?.sections?.map((section: DokuSection, index: number) => (
                    <div key={`section-${index}`}>
                      {/* Main Content Section */}
                      {section.content && (
                        <div className="mb-16">
                          {/* Section Badge */}
                          <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-full text-sm w-fit px-6 py-2 mb-6 font-semibold shadow-lg">
                            {t('doku.sections')} {index + 1}
                          </div>

                          {/* Section Title */}
                          <h2 className="text-3xl md:text-4xl mb-6 font-bold text-gray-800 dark:text-white">
                            {section.title}
                          </h2>

                          {/* Section Image */}
                          {(section.imageUrl || doku.coverImageUrl) && (
                            <img
                              src={section.imageUrl || doku.coverImageUrl}
                              alt={section.title}
                              className="rounded-2xl mb-8 w-full object-cover shadow-2xl"
                              style={{ maxHeight: '500px' }}
                            />
                          )}

                          {/* Section Content with Gradient Scroll Effect */}
                          <div className="text-lg md:text-xl prose prose-lg dark:prose-invert max-w-none leading-relaxed">
                            {section.content.split('\n').map((paragraph, pIndex) => (
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
                      )}

                      {/* Key Facts Section */}
                      {section.keyFacts && section.keyFacts.length > 0 && (
                        <div className="mb-16">
                          <FactsComponent section={section} />
                        </div>
                      )}

                      {/* Activities Section */}
                      {section.interactive?.activities?.enabled && section.interactive.activities.items?.length > 0 && (
                        <div className="mb-16">
                          <ActivityComponent section={section} />
                        </div>
                      )}

                      {/* Quiz Section */}
                      {section.interactive?.quiz?.enabled && section.interactive.quiz.questions?.length > 0 && (
                        <div className="mb-16">
                          <QuizComponent
                            section={section}
                            dokuTitle={doku.title}
                            avatarId={targetAvatarId ?? undefined}
                            dokuId={dokuId}
                            dokuTopic={doku.topic}
                            dokuMetadata={doku.metadata}
                            onPersonalityChange={(changes) => {
                              import('../../utils/toastUtils').then(({ showPersonalityUpdateToast }) => {
                                showPersonalityUpdateToast(changes);
                              });
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Completion Button */}
                  <div className="flex flex-col items-center justify-center py-16 border-t-2 border-dashed border-gray-300 dark:border-gray-600">
                    <motion.button
                      onClick={handleDokuCompletion}
                      disabled={dokuCompleted || completionPending}
                      aria-busy={completionPending}
                      className={`px-12 py-5 rounded-full font-bold text-xl text-white transition-all shadow-2xl ${dokuCompleted
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 cursor-default'
                          : 'bg-gradient-to-r from-teal-600 to-cyan-600 hover:shadow-teal-500/50 hover:scale-105'
                        }`}
                      whileHover={!dokuCompleted && !completionPending ? { scale: 1.05 } : {}}
                      whileTap={!dokuCompleted && !completionPending ? { scale: 0.95 } : {}}
                    >
                      {completionPending && (
                        <LoaderCircle className="mr-2 inline h-5 w-5 animate-spin" aria-hidden="true" />
                      )}
                      {dokuCompleted ? `🎉 ${t('doku.readDoku')} ${t('common.finish')}!` : `🏁 ${t('doku.readDoku')} ${t('common.finish')}`}
                    </motion.button>
                    {completionError && !dokuCompleted && (
                      <p role="alert" className="mt-4 max-w-xl text-center text-sm font-medium text-red-600 dark:text-red-300">
                        {completionError}
                      </p>
                    )}
                    {dokuCompleted && (
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 text-gray-600 dark:text-gray-300 text-center"
                      >
                        Deine Avatare haben neues Wissen erlangt! ✨
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

export default DokuScrollReaderScreen;

