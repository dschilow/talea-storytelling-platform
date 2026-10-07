import React, { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { useBackend } from '@/api/backend';
import { useAvatars, useDokus, usePublicDokus, useDoku } from '@/hooks/queries';
import { useOptionalChildProfiles } from '@/providers/ChildProfilesProvider';
import { useJourneyProgress } from '@/hooks/useJourneyProgress';
import { useTheme } from '@/theme/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { extractCardsFromSections, matchesFilter, shuffle, type DeckFilter, type QuizCard } from '@/lib/quizDeck';
import { buildTopicId, inferDomainFromDokuTopic, inferSkillTypeFromQuestion, inferDifficultyFromQuestion } from '@/lib/cosmosTracking';
import { haptic } from '@/lib/haptics';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Touchable } from '@/components/ui/Pressable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { Doku } from '@/types/doku';
import type { RootStackParamList } from '@/navigation/types';

const DEFAULT_FILTERS: DeckFilter = { query: '', ageGroup: 'all', depth: 'all', perspective: 'all' };
/** Full source documents are fetched before extracting a stable, deduplicated deck. */
export function QuizScreen({ embedded = false }: { embedded?: boolean }) {
  const { spacing, colors, radius } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const dokuId = (route.params as { dokuId?: string } | undefined)?.dokuId;
  const backend = useBackend();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const journey = useJourneyProgress();
  const toast = useToast();
  const profileId = useOptionalChildProfiles()?.activeProfileId ?? undefined;
  const mine = useDokus();
  const publicDokus = usePublicDokus();
  const single = useDoku(dokuId);
  const avatars = useAvatars();
  const [filters, setFilters] = useState<DeckFilter>(DEFAULT_FILTERS);
  const [deck, setDeck] = useState<QuizCard[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  // Retry only unfinished writes. A saved source must not earn another attempt.
  const savedSources = useRef(new Set<string>());
  const activeSources = useRef<Doku[]>([]);
  const candidates = useMemo(() => [...new Map([...(mine.data ?? []), ...(publicDokus.data ?? [])].map((d) => [d.id, d])).values()]
    .filter((d) => d.status === 'complete' && matchesFilter(d, filters)), [mine.data, publicDokus.data, filters]);
  const documents = useQuery<Doku[]>({
    queryKey: ['quiz-documents', profileId, candidates.map((d) => d.id)],
    queryFn: async () => {
      const loaded: Doku[] = [];
      // Bound concurrency; one unavailable public document must not hide the whole deck.
      for (let offset = 0; offset < candidates.length; offset += 4) {
        const results = await Promise.allSettled(candidates.slice(offset, offset + 4).map((d) => backend.doku.getDoku({ id: d.id })));
        for (const result of results) if (result.status === 'fulfilled') loaded.push(result.value);
      }
      if (candidates.length && !loaded.length) throw new Error('Quiz-Inhalte konnten nicht geladen werden');
      return loaded;
    }, enabled: !dokuId && candidates.length > 0,
  });
  const sources = dokuId ? single.data ? [single.data] : [] : documents.data ?? [];
  const available = sources.flatMap(extractCardsFromSections);
  const current = deck?.[index];
  const answered = answers[index] !== undefined;
  const correctCount = Object.entries(answers).filter(([key, answer]) => deck?.[Number(key)]?.answerIndex === answer).length;

  async function finish() {
    if (!deck || saving) return;
    setFinished(true); setSaving(true); setSaveFailed(false);
    try {
      for (const id of new Set(deck.map((card) => card.dokuId))) {
        const source = activeSources.current.find((d) => d.id === id);
        if (!source) throw new Error('Quiz-Quelle fehlt');
        const cards = deck.map((card, i) => ({ card, selectedIndex: answers[i] })).filter(({ card }) => card.dokuId === id);
        const score = cards.filter(({ card, selectedIndex }) => card.answerIndex === selectedIndex).length;
        const snapshot = source.metadata?.configSnapshot;
        const domainId = snapshot?.domainId || inferDomainFromDokuTopic({ topic: source.topic, title: source.title, perspective: snapshot?.perspective });
        if (source.userId === userId && !savedSources.current.has(`profile:${id}`)) {
          await backend.doku.submitDokuQuizResult({ id, profileId, score, totalQuestions: cards.length,
            answers: cards.map(({ card, selectedIndex }) => ({ questionId: card.id, selectedIndex, correct: selectedIndex === card.answerIndex })), nextRepeatHours: 72 });
          savedSources.current.add(`profile:${id}`);
        }
        if ((profileId || avatars.data?.[0]) && !savedSources.current.has(`cosmos:${id}`)) {
          await backend.avatar.submitQuizV2({ profileId, childId: profileId, avatarId: avatars.data?.[0]?.id,
            domainId, topicId: buildTopicId({ sourceContentType: 'doku', sourceContentId: id, domainId, label: source.topic || source.title }),
            topicTitle: source.topic || source.title, contentId: id, sourceContentId: id, sourceContentType: 'doku',
            answers: cards.map(({ card, selectedIndex }) => ({ questionId: card.id, correct: selectedIndex === card.answerIndex,
              skillType: inferSkillTypeFromQuestion(card.question), difficulty: inferDifficultyFromQuestion(card.question, card.options.length) })),
          });
          savedSources.current.add(`cosmos:${id}`);
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['cosmos'] });
      await queryClient.invalidateQueries({ queryKey: ['cosmos-parent'] });
      await queryClient.invalidateQueries({ queryKey: ['dokus'] });
      await queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith('cosmos') });
      await journey.complete('quiz').catch(() => {});
      haptic('celebrate');
    } catch (error) { setSaveFailed(true); toast.error('Ergebnis noch nicht gespeichert', error instanceof Error ? error.message : undefined); }
    finally { setSaving(false); }
  }
  function restart() { setDeck(null); setAnswers({}); setIndex(0); setFinished(false); savedSources.current.clear(); }
  return <Screen topInset={!embedded} tabBarClearance={!dokuId} playerClearance>
    {embedded ? <Text variant="headingSm" style={{ marginBottom: spacing.base }}>Wissens-Quiz{deck && !finished ? ` · Frage ${index + 1} von ${deck.length}` : ''}</Text> :
    <ScreenHeader title="Quiz" showBack={Boolean(dokuId)} large={!dokuId} subtitle={deck && !finished ? `Frage ${index + 1} von ${deck.length}` : undefined} />
    }
    {!deck ? <View style={{ gap: spacing.base }}>
      {!dokuId ? <>
        <Input placeholder="Quiz-Thema suchen" value={filters.query} onChangeText={(query) => setFilters({ ...filters, query })} />
        {([
          ['ageGroup', ['all', '3-5', '6-8', '9-12', '13+']],
          ['depth', ['all', 'basic', 'standard', 'deep']],
          ['perspective', ['all', 'science', 'history', 'technology', 'nature', 'culture']],
        ] as const).map(([field, values]) => <View key={field} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {values.map((value) => <Chip key={value} label={value === 'all' ? 'Alle' : ({ basic: 'Einfach', standard: 'Standard', deep: 'Tief', science: 'Wissenschaft', history: 'Geschichte', technology: 'Technik', nature: 'Natur', culture: 'Kultur' } as Record<string, string>)[value] ?? value} selected={filters[field] === value} onPress={() => setFilters({ ...filters, [field]: value })} />)}
        </View>)}
      </> : null}
      {(dokuId ? single.isLoading : mine.isLoading || documents.isFetching || publicDokus.isLoading) ? <Text>Quizfragen werden geladen …</Text> : available.length ?
        <Button label={`Quiz starten (${Math.min(12, available.length)} Fragen)`} onPress={() => { activeSources.current = sources; setDeck(shuffle(available).slice(0, 12)); }} /> :
        <EmptyState title="Keine Quizfragen verfügbar" description="Wähle andere Filter oder erstelle ein Doku mit Mitmach-Elementen." actionLabel="Doku erstellen" onAction={() => navigation.navigate('DokuWizard')} />}
      {(documents.isError || single.isError || mine.isError) ? <Button label="Erneut laden" variant="secondary" onPress={() => { void mine.refetch(); void documents.refetch(); if (dokuId) void single.refetch(); }} /> : null}
    </View> : finished ? <Card><View style={{ gap: spacing.base }}>
      <Text variant="displayLg" center>{correctCount}/{deck.length}</Text><Text center>Fragen richtig beantwortet</Text>
      <ProgressBar progress={correctCount / deck.length} />
      <Text center>{saving ? 'Ergebnis wird gespeichert …' : saveFailed ? 'Dein Ergebnis ist noch nicht gespeichert.' : 'Ergebnis gespeichert.'}</Text>
      {saveFailed ? <Button label="Speichern erneut versuchen" onPress={() => void finish()} /> : null}
      <Button label="Nochmal spielen" onPress={restart} disabled={saving} />
    </View></Card> : current ? <View style={{ gap: spacing.base }}>
      <ProgressBar progress={(index + (answered ? 1 : 0)) / deck.length} />
      <Card><View style={{ gap: spacing.base }}>
        <Chip label={current.dokuTitle} size="sm" /><Text variant="headingSm">{current.question}</Text>
        {current.options.map((option, optionIndex) => <Touchable key={optionIndex} disabled={answered} accessibilityRole="radio" accessibilityLabel={option}
          accessibilityState={{ checked: answers[index] === optionIndex }} onPress={() => { setAnswers({ ...answers, [index]: optionIndex }); haptic(optionIndex === current.answerIndex ? 'success' : 'error'); }}
          style={{ minHeight: 48, padding: spacing.md, borderRadius: radius.md, backgroundColor: answered && optionIndex === current.answerIndex ? colors.successSoft : answered && answers[index] === optionIndex ? colors.dangerSoft : colors.surface.inset }}>
          <Text>{option}{answered && optionIndex === current.answerIndex ? ' ✓' : answered && answers[index] === optionIndex ? ' ✗' : ''}</Text>
        </Touchable>)}
        {answered ? <><Text>{current.explanation}</Text><Button label={index === deck.length - 1 ? 'Ergebnis ansehen' : 'Weiter'} onPress={() => index === deck.length - 1 ? void finish() : setIndex(index + 1)} /></> : null}
      </View></Card>
    </View> : null}
  </Screen>;
}
