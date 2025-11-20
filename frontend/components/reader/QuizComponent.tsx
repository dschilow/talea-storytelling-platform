import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, HelpCircle } from 'lucide-react';
import type { DokuSection } from '../../types/doku';
import type { Avatar } from '../../types/avatar';
import { useAvatarMemory } from '../../hooks/useAvatarMemory';
import { usePersonalityAI } from '../../hooks/usePersonalityAI';
import { useBackend } from '../../hooks/useBackend';

interface QuizComponentProps {
  section: DokuSection;
  avatarId?: string;
  dokuTitle?: string;
  dokuId?: string;
  onPersonalityChange?: (changes: Array<{ trait: string; change: number }>) => void;
}

export const QuizComponent: React.FC<QuizComponentProps> = ({
  section,
  avatarId,
  dokuTitle,
  dokuId,
  onPersonalityChange
}) => {
  const quiz = section.interactive?.quiz;
  const backend = useBackend();
  const { addMemory, updatePersonality } = useAvatarMemory();
  const { analyzeQuizCompletion } = usePersonalityAI();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<(number | null)[]>(() => quiz ? Array(quiz.questions.length).fill(null) : []);
  const [submitted, setSubmitted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);

  if (!quiz || !quiz.enabled || quiz.questions.length === 0) {
    return null;
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];

  const handleAnswerSelect = (optionIndex: number) => {
    if (submitted) return;
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQuestionIndex] = optionIndex;
    setSelectedAnswers(newAnswers);
  };

  const handleSubmit = () => {
    setSubmitted(true);
  };

  const handleNext = async () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSubmitted(false);
    } else if (!quizCompleted) {
      // Quiz completed - process results for avatar development
      await handleQuizCompletion();
    }
  };

  const handleQuizCompletion = async () => {
    if (!avatarId || !dokuTitle || !dokuId || quizCompleted) return;

    try {
      setQuizCompleted(true);

      console.log('🧠 Starting KI quiz analysis...');

      // Load avatar data
      const avatar = await backend.avatar.get({ id: avatarId });
      if (!avatar) {
        console.error('❌ Avatar not found for quiz analysis');
        return;
      }

      // Calculate quiz performance
      const correctAnswers = quiz.questions.reduce((count, question, index) => {
        return selectedAnswers[index] === question.answerIndex ? count + 1 : count;
      }, 0);

      const percentage = Math.round((correctAnswers / quiz.questions.length) * 100);

      // Prepare quiz data for KI analysis
      const questions = quiz.questions.map((question, index) => ({
        question: question.question,
        correctAnswer: question.options[question.answerIndex],
        userAnswer: question.options[selectedAnswers[index] || 0],
        isCorrect: selectedAnswers[index] === question.answerIndex
      }));

      // Use KI to analyze personality development
      const aiResult = await analyzeQuizCompletion(
        avatar,
        dokuId,
        section.title,
        questions,
        percentage
      );

      if (aiResult.alreadyProcessed) {
        console.log('⚠️ Avatar already received updates from this quiz');
        import('../../utils/toastUtils').then(({ showWarningToast }) => {
          showWarningToast('Du hast bereits Persönlichkeitsupdates von diesem Quiz erhalten!');
        });
        return;
      }

      if (aiResult.success && aiResult.changes.length > 0) {
        console.log('✅ KI quiz analysis successful, applying', aiResult.changes.length, 'personality changes');

        // Convert KI changes to our format
        const personalityChanges = aiResult.changes.map(change => ({
          trait: change.trait,
          change: change.change
        }));

        // Create memory entry
        const experience = `Ich habe ein Quiz zu "${section.title}" in "${dokuTitle}" absolviert und ${percentage}% der Fragen richtig beantwortet. ${aiResult.summary}`;

        await addMemory(avatarId, {
          storyId: dokuId,
          storyTitle: `Quiz: ${dokuTitle}`,
          experience,
          emotionalImpact: percentage >= 70 ? 'positive' : percentage >= 40 ? 'neutral' : 'negative',
          personalityChanges
        });

        // Apply personality updates
        await updatePersonality(
          avatarId,
          personalityChanges,
          `KI-Analyse: Quiz "${section.title}" (${percentage}% korrekt)`,
          dokuId
        );

        // Notify parent component
        if (onPersonalityChange) {
          onPersonalityChange(personalityChanges);
        }

        console.log(`🎉 KI quiz completed: ${percentage}% correct, personality changes:`, personalityChanges);

        // Show toast notifications
        import('../../utils/toastUtils').then(({ showQuizCompletionToast, showPersonalityUpdateToast }) => {
          showQuizCompletionToast(percentage);
          showPersonalityUpdateToast(personalityChanges);
        });
      } else {
        console.log('🤔 KI quiz analysis completed but no personality changes suggested');
        import('../../utils/toastUtils').then(({ showQuizCompletionToast }) => {
          showQuizCompletionToast(percentage);
        });
      }
    } catch (error) {
      console.error('❌ Error processing quiz completion with KI:', error);
      import('../../utils/toastUtils').then(({ showErrorToast }) => {
        showErrorToast('Fehler beim Verarbeiten der Persönlichkeitsentwicklung');
      });
    }
  };

  const analyzeQuizForPersonality = (topic: string, percentage: number): Array<{ trait: string; change: number }> => {
    const changes: Array<{ trait: string; change: number }> = [];

    // Base intelligence boost for learning
    if (percentage >= 50) {
      changes.push({ trait: 'Intelligenz', change: Math.min(5, Math.floor(percentage / 20)) });
    }

    // Topic-specific personality development
    const topicLower = topic.toLowerCase();

    if (topicLower.includes('wissenschaft') || topicLower.includes('technik') || topicLower.includes('mathematik')) {
      if (percentage >= 60) changes.push({ trait: 'Intelligenz', change: 3 });
    }

    if (topicLower.includes('kunst') || topicLower.includes('kreativ') || topicLower.includes('musik')) {
      if (percentage >= 60) changes.push({ trait: 'Kreativität', change: 4 });
    }

    if (topicLower.includes('sozial') || topicLower.includes('gesellschaft') || topicLower.includes('gemeinschaft')) {
      if (percentage >= 60) changes.push({ trait: 'Sozialität', change: 3 });
      if (percentage >= 70) changes.push({ trait: 'Empathie', change: 2 });
    }

    if (topicLower.includes('abenteuer') || topicLower.includes('sport') || topicLower.includes('reisen')) {
      if (percentage >= 60) changes.push({ trait: 'Mut', change: 3 });
      if (percentage >= 70) changes.push({ trait: 'Energie', change: 2 });
    }

    // Performance-based confidence boost
    if (percentage >= 80) {
      changes.push({ trait: 'Mut', change: 1 });
    }

    return changes;
  };

  const getOptionStyling = (optionIndex: number) => {
    if (!submitted) {
      return selectedAnswers[currentQuestionIndex] === optionIndex
        ? 'bg-blue-200 dark:bg-blue-800 border-blue-500'
        : 'bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600';
    }

    const isCorrect = optionIndex === currentQuestion.answerIndex;
    const isSelected = optionIndex === selectedAnswers[currentQuestionIndex];

    if (isCorrect) {
      return 'bg-green-200 dark:bg-green-800 border-green-500';
    }
    if (isSelected && !isCorrect) {
      return 'bg-red-200 dark:bg-red-800 border-red-500';
    }
    return 'bg-white dark:bg-gray-700 opacity-60';
  };

  const isLastQuestion = currentQuestionIndex === quiz.questions.length - 1;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-6">
          <div className="inline-block p-3 bg-white/10 backdrop-blur-md rounded-full shadow-md mb-4 border border-white/20">
            <HelpCircle className="w-10 h-10 text-blue-500" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white">Quiz Time!</h2>
          <p className="text-gray-600 dark:text-gray-300">Teste dein Wissen</p>
        </div>

        <div className="bg-white/90 dark:bg-gray-800/80 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-white/20">
          <p className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
            Frage {currentQuestionIndex + 1} von {quiz.questions.length}: {currentQuestion.question}
          </p>

          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => (
              <motion.div
                key={index}
                onClick={() => handleAnswerSelect(index)}
                className={`flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all duration-300 ${getOptionStyling(index)}`}
                whileTap={{ scale: submitted ? 1 : 0.98 }}
              >
                <div className="w-6 h-6 rounded-full border-2 border-gray-400 flex items-center justify-center mr-4 flex-shrink-0">
                  {submitted && (selectedAnswers[currentQuestionIndex] === index || index === currentQuestion.answerIndex) && (
                    index === currentQuestion.answerIndex
                      ? <Check className="w-5 h-5 text-green-600" />
                      : <X className="w-5 h-5 text-red-600" />
                  )}
                  {!submitted && selectedAnswers[currentQuestionIndex] === index && <div className="w-3 h-3 bg-blue-500 rounded-full" />}
                </div>
                <span className="flex-1">{option}</span>
              </motion.div>
            ))}
          </div>

          {submitted && currentQuestion.explanation && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg text-sm text-gray-600 dark:text-gray-300"
            >
              <strong>Erklärung:</strong> {currentQuestion.explanation}
            </motion.div>
          )}

          <div className="mt-6 text-right">
            {!submitted ? (
              <button
                onClick={handleSubmit}
                disabled={selectedAnswers[currentQuestionIndex] === null}
                className="px-6 py-2 bg-blue-600 text-white font-bold rounded-full shadow-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
              >
                Antworten
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={quizCompleted}
                className={`px-6 py-2 text-white font-bold rounded-full shadow-lg transition-all ${currentQuestionIndex === quiz.questions.length - 1
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-green-600 hover:bg-green-700'
                  } disabled:bg-gray-400 disabled:cursor-not-allowed`}
              >
                {currentQuestionIndex === quiz.questions.length - 1
                  ? (quizCompleted ? 'Quiz abgeschlossen!' : 'Quiz abschließen')
                  : 'Nächste Frage'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
