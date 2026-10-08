import { useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';

import { useBackend } from '../../hooks/useBackend';
import { useOptionalChildProfiles } from '../../contexts/ChildProfilesContext';
import { emitMapProgress } from '../../screens/Journey/TaleaLearningPathProgressStore';
import {
  buildTopicId,
  inferDifficultyFromQuestion,
  inferDomainFromDokuTopic,
  inferSkillTypeFromQuestion,
  submitCosmosQuiz,
  type CosmosSkillType,
} from '../../screens/Cosmos/apiTrackingClient';

/*
 * Quiz data and result tracking shared by the doku readers (the classic
 * QuizComponent and the "Zwischen-Check" of the reportage reader).
 */

export type NormalizedQuestion = {
  id: string;
  question: string;
  options: string[];
  answerIndex: number;
  skillType: CosmosSkillType;
  difficulty: number;
  explanation?: string;
};

export type QuizDokuMetadata = {
  configSnapshot?: {
    perspective?: string;
    domainId?: string | null;
    depth?: 'basic' | 'standard' | 'deep';
  };
};

const normalizeText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.replace(/\s+/g, ' ').replace(/^[-*•·]\s*/, '').trim();
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

export const normalizeQuestions = (rawQuestions: unknown[]): NormalizedQuestion[] => {
  const normalized: NormalizedQuestion[] = [];

  rawQuestions.forEach((entry, entryIndex) => {
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
    const skillTypeRaw = normalizeText(source.skillType ?? source.skill_type).toUpperCase();
    const skillType: CosmosSkillType =
      skillTypeRaw === 'REMEMBER' ||
      skillTypeRaw === 'UNDERSTAND' ||
      skillTypeRaw === 'COMPARE' ||
      skillTypeRaw === 'TRANSFER' ||
      skillTypeRaw === 'EXPLAIN'
        ? (skillTypeRaw as CosmosSkillType)
        : inferSkillTypeFromQuestion(question);
    const parsedDifficulty = Number(source.difficulty);
    const difficulty = Number.isFinite(parsedDifficulty)
      ? Math.max(1, Math.min(5, parsedDifficulty))
      : inferDifficultyFromQuestion(question, options.length);

    normalized.push({
      id: normalizeText(source.id) || `q_${entryIndex}`,
      question,
      options,
      answerIndex,
      skillType,
      difficulty,
      explanation: explanation || undefined,
    });
  });

  return normalized;
};

export const calculateScore = (questions: NormalizedQuestion[], selectedAnswers: Array<number | null>) => {
  const correctAnswers = questions.reduce((count, question, index) => {
    return selectedAnswers[index] === question.answerIndex ? count + 1 : count;
  }, 0);

  const percentage = questions.length > 0 ? Math.round((correctAnswers / questions.length) * 100) : 0;

  return { correctAnswers, percentage };
};

export const normalizeDomainHint = (value?: string | null): string | null => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'art') return 'arts';
  return normalized;
};

/**
 * Reports a finished quiz to the learning map and the Cosmos competency
 * tracking. Avatar growth is NOT awarded here: the trusted doku completion
 * endpoint does that once, so the browser cannot write personality points.
 */
export function useQuizResultSubmit(params: {
  sectionTitle: string;
  questions: NormalizedQuestion[];
  avatarId?: string;
  dokuTitle?: string;
  dokuId?: string;
  dokuTopic?: string;
  dokuMetadata?: QuizDokuMetadata;
}) {
  const { sectionTitle, questions, avatarId, dokuTitle, dokuId, dokuTopic, dokuMetadata } = params;
  const location = useLocation();
  const backend = useBackend();
  const { getToken } = useAuth();
  const childProfiles = useOptionalChildProfiles();
  const activeChildId = childProfiles?.activeProfileId;
  const mapAvatarId = useMemo(() => new URLSearchParams(location.search).get('mapAvatarId'), [location.search]);
  const effectiveAvatarId = avatarId ?? mapAvatarId ?? undefined;

  return useCallback(
    async (selectedAnswers: Array<number | null>, options: { showToast?: boolean } = {}) => {
      const { correctAnswers, percentage } = calculateScore(questions, selectedAnswers);
      const perspective = dokuMetadata?.configSnapshot?.perspective;
      const queryDomain = normalizeDomainHint(new URLSearchParams(location.search).get('domain'));
      const metadataDomain = normalizeDomainHint(dokuMetadata?.configSnapshot?.domainId);
      const inferredDomainId =
        queryDomain ||
        metadataDomain ||
        inferDomainFromDokuTopic({ topic: dokuTopic, perspective, title: dokuTitle, sectionTitle });

      emitMapProgress({
        avatarId: effectiveAvatarId,
        domainId: inferredDomainId,
        source: 'quiz',
        quizId: dokuId ? `${dokuId}-quiz-${sectionTitle}` : undefined,
        correctCount: correctAnswers,
        totalCount: questions.length,
      });

      if (options.showToast !== false) {
        try {
          const { showQuizCompletionToast } = await import('../../utils/toastUtils');
          showQuizCompletionToast(percentage);
        } catch {
          // Optional UI toast only
        }
      }

      // Cosmos competency tracking (independent from personality updates).
      let trackingAvatarId = effectiveAvatarId;
      if (!trackingAvatarId && dokuId) {
        try {
          const avatarResult = await backend.avatar.list({ profileId: activeChildId || undefined });
          trackingAvatarId = avatarResult.avatars?.[0]?.id;
        } catch (avatarLookupError) {
          console.warn('[quiz] could not resolve avatar for cosmos quiz tracking', avatarLookupError);
        }
      }

      if (!trackingAvatarId || !dokuId) return;
      try {
        const token = await getToken();
        const depth = dokuMetadata?.configSnapshot?.depth || 'standard';
        const depthDifficultyBonus = depth === 'deep' ? 1 : 0;
        const stableTopicLabel = dokuTopic || dokuTitle || sectionTitle;
        const topicId = buildTopicId({
          sourceContentType: 'doku',
          sourceContentId: dokuId,
          domainId: inferredDomainId,
          label: stableTopicLabel,
        });
        await submitCosmosQuiz(
          {
            childId: activeChildId || undefined,
            profileId: activeChildId || undefined,
            avatarId: trackingAvatarId,
            domainId: inferredDomainId,
            topicId,
            topicTitle: stableTopicLabel,
            contentId: dokuId,
            sourceContentId: dokuId,
            sourceContentType: 'doku',
            answers: questions.map((question, index) => ({
              questionId: question.id || `q_${index}`,
              skillType: question.skillType,
              correct: selectedAnswers[index] === question.answerIndex,
              difficulty: Math.max(1, Math.min(5, question.difficulty + depthDifficultyBonus)),
            })),
          },
          { token },
        );
      } catch (cosmosError) {
        console.warn('[quiz] cosmos quiz submit failed', cosmosError);
      }
    },
    [
      activeChildId,
      backend,
      dokuId,
      dokuMetadata,
      dokuTitle,
      dokuTopic,
      effectiveAvatarId,
      getToken,
      location.search,
      questions,
      sectionTitle,
    ],
  );
}
