import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, CheckCircle2, HelpCircle, RotateCcw, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import type { DokuSection } from '../../types/doku';
import { useAvatarMemory } from '../../hooks/useAvatarMemory';
import { usePersonalityAI } from '../../hooks/usePersonalityAI';
import { useBackend } from '../../hooks/useBackend';
import { useTheme } from '../../contexts/ThemeContext';
import { emitMapProgress } from '../../screens/Journey/TaleaLearningPathProgressStore';

interface QuizComponentProps {
  section: DokuSection;
  avatarId?: string;
  dokuTitle?: string;
  dokuId?: string;
  onPersonalityChange?: (changes: Array<{ trait: string; change: number }>) => void;
  variant?: 'page' | 'inline';
}

type NormalizedQuestion = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
};

const normalizeText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.replace(/\s+/g, ' ').replace(/^[-*\u2022\u00b7]\s*/, '').trim();
  }

  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean).join(', ');
  }

  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const candidate =
      source.text ??
      source.label ??
      source.title ??
      source.value ??
      source.answer ??
      source.option ??
      source.description;

    if (candidate != null) {
      return normalizeText(candidate);
    }
  }

  if (value == null) {
    return '';
  }

  return String(value).trim();
};

const normalizeQuestions = (rawQuestions: unknown[]): NormalizedQuestion[] => {
  const normalized: NormalizedQuestion[] = [];

  rawQuestions.forEach((entry) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }

    const source = entry as Record<string, unknown>;
    const question = normalizeText(source.question ?? source.prompt ?? source.title);
    const rawOptions = Array.isArray(source.options)
      ? source.options
      : Array.isArray(source.answers)
        ? source.answers
        : [];

    const options = rawOptions.map(normalizeText).filter((option) => option.length > 0);
    if (!question || options.length < 2) {
      return;
    }

    const rawIndex = Number(
      source.answerIndex ?? source.correctIndex ?? source.correctOption ?? source.correctAnswerIndex,
    );
    let answerIndex = Number.isFinite(rawIndex) ? rawIndex : -1;

    if (answerIndex < 0 || answerIndex >= options.length) {
      const answerText = normalizeText(source.correctAnswer ?? source.answer ?? source.correct);
      if (answerText) {
        answerIndex = options.findIndex(
          (option) => option.toLowerCase().trim() === answerText.toLowerCase().trim(),
        );
      }
    }

    if (answerIndex < 0 || answerIndex >= options.length) {
      answerIndex = 0;
    }

    const explanation = normalizeText(source.explanation ?? source.reason ?? source.hint);
    normalized.push({
      question,
      options,
      answerIndex,
      explanation: explanation || undefined,
    });
  });

  return normalized;
};

const calculateScore = (questions: NormalizedQuestion[], selectedAnswers: Array<number | null>) => {
  const correctAnswers = questions.reduce((count, question, index) => {
    return selectedAnswers[index] === question.answerIndex ? count + 1 : count;
  }, 0);

  const percentage = questions.length > 0 ? Math.round((correctAnswers / questions.length) * 100) : 0;

  return { correctAnswers, percentage };
};

export const QuizComponent: React.FC<QuizComponentProps> = ({
  section,
  avatarId,
  dokuTitle,
  dokuId,
  onPersonalityChange,
  variant = 'page',
}) => {
  const location = useLocation();
  const quiz = section.interactive?.quiz;
  const backend = useBackend();
  const { addMemory, updatePersonality } = useAvatarMemory();
  const { analyzeQuizCompletion } = usePersonalityAI();
  const { resolvedTheme } = useTheme();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Array<number | null>>([]);
  const [submitted, setSubmitted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const questions = useMemo(() => {
    if (!quiz?.enabled || !Array.isArray(quiz.questions)) {
      return [];
    }

    return normalizeQuestions(quiz.questions as unknown[]);
  }, [quiz]);

  const mapAvatarId = useMemo(() => new URLSearchParams(location.search).get('mapAvatarId'), [location.search]);
  const effectiveAvatarId = avatarId ?? mapAvatarId ?? undefined;

  useEffect(() => {
    setCurrentQuestionIndex(0);
    setSubmitted(false);
    setQuizCompleted(false);
    setIsSubmitting(false);
    setSelectedAnswers(Array(questions.length).fill(null));
  }, [questions.length, section.title]);

  if (!quiz?.enabled || questions.length === 0) {
    return null;
  }

  const isDark = resolvedTheme === 'dark';
  const colors = isDark
    ? {
        panel: 'rgba(24,34,48,0.88)',
        border: '#355072',
        title: '#e8f1fe',
        body: '#adbed4',
        option: 'rgba(34,47,66,0.68)',
        selected: 'rgba(74,104,151,0.3)',
        correct: 'rgba(56,132,102,0.32)',
        wrong: 'rgba(156,84,91,0.3)',
      }
    : {
        panel: 'rgba(255,250,242,0.9)',
        border: '#decfbf',
        title: '#24364b',
        body: '#63778f',
        option: 'rgba(255,255,255,0.72)',
        selected: 'rgba(108,137,183,0.2)',
        correct: 'rgba(108,175,146,0.24)',
        wrong: 'rgba(200,122,132,0.24)',
      };

  const currentQuestion = questions[currentQuestionIndex];
  const selectedAnswer = selectedAnswers[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  const { correctAnswers, percentage } = calculateScore(questions, selectedAnswers);

  const handleAnswerSelect = (optionIndex: number) => {
    if (submitted || quizCompleted || isSubmitting) {
      return;
    }

    setSelectedAnswers((prev) => {
      const next = [...prev];
      next[currentQuestionIndex] = optionIndex;
      return next;
    });
  };

  const handleSubmitCurrent = () => {
    if (selectedAnswer == null || quizCompleted || isSubmitting) {
      return;
    }
    setSubmitted(true);
  };

  const handleQuizCompletion = async () => {
    if (quizCompleted || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setQuizCompleted(true);
    emitMapProgress({
      avatarId: effectiveAvatarId,
      source: 'quiz',
      quizId: dokuId ? `${dokuId}-quiz-${section.title}` : undefined,
      correctCount: correctAnswers,
      totalCount: questions.length,
    });

    try {
      const { showQuizCompletionToast } = await import('../../utils/toastUtils');
      showQuizCompletionToast(percentage);
    } catch {
      // Optional UI toast only
    }

    if (!effectiveAvatarId || !dokuTitle || !dokuId) {
      setIsSubmitting(false);
      return;
    }

    try {
      const avatar = await backend.avatar.get({ id: effectiveAvatarId });
      if (!avatar) {
        setIsSubmitting(false);
        return;
      }

      const questionPayload = questions.map((question, index) => ({
        question: question.question,
        correctAnswer: question.options[question.answerIndex],
        userAnswer:
          selectedAnswers[index] != null
            ? question.options[selectedAnswers[index] as number]
            : 'Keine Antwort',
        isCorrect: selectedAnswers[index] === question.answerIndex,
      }));

      const aiResult = await analyzeQuizCompletion(
        avatar,
        dokuId,
        section.title,
        questionPayload,
        percentage
      );

      if (aiResult.alreadyProcessed) {
        const { showWarningToast } = await import('../../utils/toastUtils');
        showWarningToast('Dieses Quiz wurde fuer diesen Avatar bereits ausgewertet.');
        setIsSubmitting(false);
        return;
      }

      if (aiResult.success && aiResult.changes.length > 0) {
        const personalityChanges = aiResult.changes.map((change) => ({
          trait: change.trait,
          change: change.change,
        }));

        const experience = `Quiz zu "${section.title}" in "${dokuTitle}" mit ${percentage}% abgeschlossen.`;

        await addMemory(effectiveAvatarId, {
          storyId: dokuId,
          storyTitle: `Quiz: ${dokuTitle}`,
          experience,
          emotionalImpact: percentage >= 70 ? 'positive' : percentage >= 40 ? 'neutral' : 'negative',
          contentType: 'quiz',
          personalityChanges,
        });

        await updatePersonality(
          effectiveAvatarId,
          personalityChanges,
          `Quiz-Auswertung "${section.title}" (${percentage}% korrekt)`,
          dokuId
        );

        if (onPersonalityChange) {
          onPersonalityChange(personalityChanges);
        } else {
          const { showPersonalityUpdateToast } = await import('../../utils/toastUtils');
          showPersonalityUpdateToast(personalityChanges);
        }
      }
    } catch (error) {
      console.error('Quiz evaluation failed:', error);
      const { showErrorToast } = await import('../../utils/toastUtils');
      showErrorToast('Fehler bei der Quiz-Auswertung.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (!submitted || isSubmitting) {
      return;
    }

    if (isLastQuestion) {
      await handleQuizCompletion();
      return;
    }

    setCurrentQuestionIndex((prev) => prev + 1);
    setSubmitted(false);
  };

  const restartQuiz = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswers(Array(questions.length).fill(null));
    setSubmitted(false);
    setQuizCompleted(false);
    setIsSubmitting(false);
  };

  const getOptionStyle = (optionIndex: number): React.CSSProperties => {
    if (!submitted) {
      return {
        borderColor: colors.border,
        background: selectedAnswer === optionIndex ? colors.selected : colors.option,
      };
    }

    if (optionIndex === currentQuestion.answerIndex) {
      return { borderColor: '#4a9676', background: colors.correct };
    }

    if (selectedAnswer === optionIndex && optionIndex !== currentQuestion.answerIndex) {
      return { borderColor: '#b86b75', background: colors.wrong };
    }

    return { borderColor: colors.border, background: colors.option, opacity: 0.72 };
  };

  const wrapperClass =
    variant === 'page'
      ? 'w-full min-h-full flex flex-col items-center justify-center p-4 md:p-8'
      : 'w-full';

  return (
    <div className={wrapperClass}>
      <div className="w-full max-w-3xl rounded-3xl border p-5 md:p-6" style={{ borderColor: colors.border, background: colors.panel }}>
        <div className="mb-5 flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: colors.option }}>
            <HelpCircle className="h-5 w-5" style={{ color: colors.body }} />
          </div>
          <div>
            <h3 className="text-xl font-semibold" style={{ color: colors.title }}>
              Quiz
            </h3>
            <p className="text-sm" style={{ color: colors.body }}>
              Frage {currentQuestionIndex + 1} von {questions.length}
            </p>
          </div>
        </div>

        {!quizCompleted ? (
          <>
            <p className="mb-4 text-lg font-medium leading-relaxed" style={{ color: colors.title }}>
              {currentQuestion.question}
            </p>

            <div className="space-y-2.5">
              {currentQuestion.options.map((option, optionIndex) => {
                const isSelected = selectedAnswer === optionIndex;
                const isCorrect = submitted && optionIndex === currentQuestion.answerIndex;
                const isWrong = submitted && isSelected && !isCorrect;

                return (
                  <motion.button
                    key={`${option}-${optionIndex}`}
                    type="button"
                    onClick={() => handleAnswerSelect(optionIndex)}
                    whileTap={{ scale: submitted ? 1 : 0.992 }}
                    className="flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors"
                    style={getOptionStyle(optionIndex)}
                  >
                    <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border" style={{ borderColor: colors.border, color: colors.body }}>
                      {submitted ? (
                        isCorrect ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : isWrong ? (
                          <X className="h-4 w-4 text-rose-500" />
                        ) : null
                      ) : isSelected ? (
                        <span className="h-2.5 w-2.5 rounded-full bg-current" />
                      ) : null}
                    </span>
                    <span style={{ color: colors.title }}>{option}</span>
                  </motion.button>
                );
              })}
            </div>

            {submitted && currentQuestion.explanation && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 rounded-2xl border px-3.5 py-3 text-sm"
                style={{ borderColor: colors.border, background: colors.option, color: colors.body }}
              >
                <strong>Erklaerung:</strong> {currentQuestion.explanation}
              </motion.div>
            )}

            <div className="mt-5 flex justify-end gap-2.5">
              {!submitted ? (
                <button
                  type="button"
                  onClick={handleSubmitCurrent}
                  disabled={selectedAnswer == null || isSubmitting}
                  className="rounded-full border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ borderColor: colors.border, background: colors.option, color: colors.title }}
                >
                  Antwort pruefen
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={isSubmitting}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#6b8fc5 0%,#8f78b4 100%)' }}
                >
                  {isLastQuestion ? (isSubmitting ? 'Wird ausgewertet...' : 'Quiz abschliessen') : 'Naechste Frage'}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border p-4" style={{ borderColor: colors.border, background: colors.option }}>
            <div className="mb-3 flex items-center gap-2" style={{ color: colors.title }}>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <h4 className="text-lg font-semibold">Quiz abgeschlossen</h4>
            </div>

            <p style={{ color: colors.body }}>
              Ergebnis: <strong>{correctAnswers}</strong> von <strong>{questions.length}</strong> richtig ({percentage}%).
            </p>

            <button
              type="button"
              onClick={restartQuiz}
              className="mt-4 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold"
              style={{ borderColor: colors.border, color: colors.title }}
            >
              <RotateCcw className="h-4 w-4" />
              Quiz wiederholen
            </button>
          </div>
        )}
      </div>
    </div>
  );
};




