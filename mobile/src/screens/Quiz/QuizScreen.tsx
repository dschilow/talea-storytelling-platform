import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Brain, CheckCircle2, ChevronRight, RotateCcw, XCircle } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useBackend } from '@/api/backend';
import { useDokus, usePublicDokus } from '@/hooks/queries';
import { haptic } from '@/lib/haptics';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import type { RootStackParamList } from '@/navigation/types';
import type { Doku } from '@/types/doku';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface QuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
  sourceDokuId: string;
  sourceDokuTitle: string;
}

/**
 * Quiz.
 *
 * Questions are drawn from the interactive blocks the doku generator produces,
 * pooled across the child's own dokus and the public catalogue. Answering
 * submits the result so the avatar's knowledge traits can advance — that write
 * is what makes the quiz part of the progression loop rather than a toy.
 */
export function QuizScreen() {
  const { colors, spacing, radius } = useTheme();
  const navigation = useNavigation<Nav>();
  const backend = useBackend();

  const myDokus = useDokus();
  const publicDokus = usePublicDokus();

  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);

  const questions = useMemo(() => collectQuestions([...(myDokus.data ?? []), ...(publicDokus.data ?? [])]), [
    myDokus.data,
    publicDokus.data,
  ]);

  const isLoading = myDokus.isLoading || publicDokus.isLoading;
  const current = questions[index];
  const selectedAnswer = answers[index];
  const hasAnswered = selectedAnswer !== undefined;

  const correctCount = useMemo(
    () => Object.entries(answers).filter(([key, value]) => questions[Number(key)]?.answerIndex === value).length,
    [answers, questions]
  );

  const submitAnswer = useCallback(
    async (optionIndex: number) => {
      if (hasAnswered || !current) return;

      const isCorrect = optionIndex === current.answerIndex;
      setAnswers((prev) => ({ ...prev, [index]: optionIndex }));
      haptic(isCorrect ? 'success' : 'error');

      // Report to the backend so knowledge traits and competency state update.
      try {
        await (backend.doku as any).submitDokuQuizResult({
          dokuId: current.sourceDokuId,
          questionIndex: index,
          selectedIndex: optionIndex,
          correct: isCorrect,
        });
      } catch {
        // A failed submit must not interrupt the quiz; progress is re-derivable.
      }
    },
    [backend.doku, current, hasAnswered, index]
  );

  const next = useCallback(() => {
    if (index + 1 >= questions.length) {
      setFinished(true);
      haptic('celebrate');
      return;
    }
    setIndex((value) => value + 1);
  }, [index, questions.length]);

  const restart = useCallback(() => {
    setAnswers({});
    setIndex(0);
    setFinished(false);
  }, []);

  if (isLoading) {
    return (
      <Screen tabBarClearance playerClearance>
        <ScreenHeader title="Quiz" showBack={false} large />
        <View style={{ gap: spacing.lg }}>
          <SkeletonCard height={200} />
        </View>
      </Screen>
    );
  }

  if (questions.length === 0) {
    return (
      <Screen tabBarClearance playerClearance>
        <ScreenHeader title="Quiz" showBack={false} large />
        <EmptyState
          icon={<Brain size={24} color={colors.accent.lavender} />}
          title="Noch keine Quizfragen"
          description="Quizfragen entstehen aus Dokus. Erstelle ein Doku mit aktivierten Mitmach-Elementen, um hier zu starten."
          actionLabel="Doku erstellen"
          onAction={() => navigation.navigate('DokuWizard')}
        />
      </Screen>
    );
  }

  if (finished) {
    const percentage = Math.round((correctCount / questions.length) * 100);
    return (
      <Screen tabBarClearance playerClearance>
        <ScreenHeader title="Quiz" showBack={false} large />
        <Card variant="elevated" style={{ alignItems: 'center', gap: spacing.base, paddingVertical: spacing.xxl }}>
          <Text variant="displayLg" tone="accent">
            {percentage}%
          </Text>
          <Text variant="headingSm" center>
            {correctCount} von {questions.length} richtig
          </Text>
          <Text variant="bodySm" tone="secondary" center>
            {percentage >= 80
              ? 'Stark! Dein Wissen wächst sichtbar.'
              : percentage >= 50
                ? 'Gut gemacht — ein paar Themen lohnen noch eine Runde.'
                : 'Kein Problem: lies das Doku nochmal und probiere es erneut.'}
          </Text>
          <ProgressBar progress={correctCount / questions.length} style={{ alignSelf: 'stretch', marginTop: spacing.sm }} />
          <Button label="Nochmal" onPress={restart} icon={<RotateCcw size={16} color={colors.primaryForeground} />} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen tabBarClearance playerClearance>
      <ScreenHeader title="Quiz" subtitle={`Frage ${index + 1} von ${questions.length}`} showBack={false} large />

      <ProgressBar progress={(index + (hasAnswered ? 1 : 0)) / questions.length} style={{ marginBottom: spacing.lg }} />

      <Animated.View key={index} entering={FadeIn.duration(260)} exiting={FadeOut.duration(140)}>
        <Card variant="elevated" style={{ gap: spacing.base }}>
          <Chip label={current.sourceDokuTitle} size="sm" />
          <Text variant="headingSm">{current.question}</Text>

          <View style={{ gap: spacing.sm }}>
            {current.options.map((option, optionIndex) => {
              const isSelected = selectedAnswer === optionIndex;
              const isCorrect = optionIndex === current.answerIndex;
              const reveal = hasAnswered && (isSelected || isCorrect);

              return (
                <Touchable
                  key={optionIndex}
                  onPress={() => void submitAnswer(optionIndex)}
                  disabled={hasAnswered}
                  hapticIntent={null}
                  style={[
                    styles.option,
                    {
                      borderRadius: radius.md,
                      padding: spacing.md,
                      gap: spacing.md,
                      backgroundColor: reveal
                        ? isCorrect
                          ? colors.successSoft
                          : colors.dangerSoft
                        : colors.surface.inset,
                      borderColor: reveal ? (isCorrect ? colors.success : colors.danger) : colors.border.light,
                      borderWidth: reveal ? 1.4 : StyleSheet.hairlineWidth,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected, disabled: hasAnswered }}
                >
                  <Text variant="body" style={{ flex: 1 }}>
                    {option}
                  </Text>
                  {reveal ? (
                    isCorrect ? (
                      <CheckCircle2 size={18} color={colors.success} />
                    ) : (
                      <XCircle size={18} color={colors.danger} />
                    )
                  ) : null}
                </Touchable>
              );
            })}
          </View>

          {hasAnswered && current.explanation ? (
            <Animated.View entering={FadeIn.duration(240)}>
              <View style={{ backgroundColor: colors.surface.inset, borderRadius: radius.md, padding: spacing.md, gap: 4 }}>
                <Text variant="overline" tone="tertiary">
                  Erklärung
                </Text>
                <Text variant="bodySm" tone="secondary">
                  {current.explanation}
                </Text>
              </View>
            </Animated.View>
          ) : null}

          {hasAnswered ? (
            <Button
              label={index + 1 >= questions.length ? 'Ergebnis ansehen' : 'Weiter'}
              onPress={next}
              trailingIcon={<ChevronRight size={16} color={colors.primaryForeground} />}
              fullWidth
            />
          ) : null}
        </Card>
      </Animated.View>
    </Screen>
  );
}

/** Pulls every quiz question out of a doku list, capped so a session stays short. */
function collectQuestions(dokus: Doku[], limit = 12): QuizQuestion[] {
  const pool: QuizQuestion[] = [];

  for (const doku of dokus) {
    for (const section of doku.content?.sections ?? []) {
      const quiz = section.interactive?.quiz;
      if (!quiz?.enabled) continue;

      for (const question of quiz.questions ?? []) {
        if (!question.question || !Array.isArray(question.options) || question.options.length < 2) continue;
        pool.push({
          question: question.question,
          options: question.options,
          answerIndex: question.answerIndex,
          explanation: question.explanation,
          sourceDokuId: doku.id,
          sourceDokuTitle: doku.title,
        });
      }
    }
  }

  // Shuffle so repeat sessions are not identical, then cap.
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, limit);
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center' },
});
