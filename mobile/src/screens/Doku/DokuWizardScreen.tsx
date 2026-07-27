import React, { useCallback, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { FlaskConical, Sparkles } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { useBackend } from '@/api/backend';
import { useInvalidateContent } from '@/hooks/queries';
import { useOptionalChildProfiles } from '@/providers/ChildProfilesProvider';
import { useToast } from '@/providers/ToastProvider';
import { haptic } from '@/lib/haptics';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OptionRow } from '@/screens/Story/wizard/StepScope';
import { Stepper } from '@/components/form/Stepper';
import { OptionGrid } from '@/components/form/OptionGrid';
import { AvatarGenerationOverlay } from '@/screens/Avatar/wizard/AvatarGenerationOverlay';
import type { DokuConfig } from '@/types/doku';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const AGE_GROUPS = [
  { id: '3-5', label: '3–5 Jahre' },
  { id: '6-8', label: '6–8 Jahre' },
  { id: '9-12', label: '9–12 Jahre' },
  { id: '13+', label: '13+ Jahre' },
] as const;

const DEPTHS = [
  { id: 'basic', label: 'Einfach', description: 'Die wichtigsten Grundlagen' },
  { id: 'standard', label: 'Standard', description: 'Solider Überblick mit Details' },
  { id: 'deep', label: 'Tief', description: 'Ausführlich und differenziert' },
] as const;

const PERSPECTIVES = [
  { id: 'science', label: 'Wissenschaft', icon: '🔬' },
  { id: 'nature', label: 'Natur', icon: '🌿' },
  { id: 'history', label: 'Geschichte', icon: '🏛️' },
  { id: 'technology', label: 'Technik', icon: '⚙️' },
  { id: 'culture', label: 'Kultur', icon: '🎭' },
] as const;

const TONES = [
  { id: 'fun', label: 'Verspielt', icon: '🎈' },
  { id: 'curious', label: 'Neugierig', icon: '🔍' },
  { id: 'neutral', label: 'Sachlich', icon: '📘' },
] as const;

const LENGTHS = [
  { id: 'short', label: 'Kurz' },
  { id: 'medium', label: 'Mittel' },
  { id: 'long', label: 'Lang' },
] as const;

/**
 * Doku creation.
 *
 * A single scrolling form rather than a step wizard: unlike a story, every
 * choice here has a sensible default, so the user only needs to supply a topic.
 * The interactive block (quiz + hands-on activities) is what later feeds the
 * Quiz tab, so it is on by default.
 */
export function DokuWizardScreen() {
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<Nav>();
  const backend = useBackend();
  const toast = useToast();
  const { i18n } = useTranslation();
  const invalidateContent = useInvalidateContent();
  const profileId = useOptionalChildProfiles()?.activeProfileId ?? null;

  const [topic, setTopic] = useState('');
  const [ageGroup, setAgeGroup] = useState<DokuConfig['ageGroup']>('6-8');
  const [depth, setDepth] = useState<DokuConfig['depth']>('standard');
  const [perspective, setPerspective] = useState<DokuConfig['perspective']>('science');
  const [tone, setTone] = useState<DokuConfig['tone']>('curious');
  const [length, setLength] = useState<DokuConfig['length']>('medium');
  const [includeInteractive, setIncludeInteractive] = useState(true);
  const [quizQuestions, setQuizQuestions] = useState(4);
  const [activities, setActivities] = useState(2);
  const [generating, setGenerating] = useState(false);

  const canSubmit = topic.trim().length >= 3;

  const handleGenerate = useCallback(async () => {
    if (!canSubmit) return;

    setGenerating(true);
    try {
      const doku = (await (backend.doku as any).generateDoku({
        config: {
          topic: topic.trim(),
          depth,
          ageGroup,
          perspective,
          tone,
          length,
          includeInteractive,
          quizQuestions: includeInteractive ? quizQuestions : 0,
          handsOnActivities: includeInteractive ? activities : 0,
          language: i18n.language,
        },
        profileId: profileId ?? undefined,
      })) as { id: string };

      invalidateContent();
      haptic('celebrate');
      navigation.replace('DokuReader', { dokuId: doku.id });
    } catch (error) {
      console.error('[DokuWizard] Generation failed', error);
      toast.error('Doku konnte nicht erstellt werden', error instanceof Error ? error.message : undefined);
      setGenerating(false);
    }
  }, [
    activities,
    ageGroup,
    backend.doku,
    canSubmit,
    depth,
    i18n.language,
    includeInteractive,
    invalidateContent,
    length,
    navigation,
    perspective,
    profileId,
    quizQuestions,
    toast,
    tone,
    topic,
  ]);

  if (generating) {
    return <AvatarGenerationOverlay name={topic.trim() || 'Dein Doku'} />;
  }

  return (
    <Screen>
      <ScreenHeader title="Neues Doku" subtitle="Wissen zum Entdecken" />

      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.md }}>
          <View style={{ gap: 4 }}>
            <Text variant="headingSm">Worüber soll es gehen?</Text>
            <Text variant="bodySm" tone="secondary">
              Ein Thema, eine Frage oder etwas, das dein Kind gerade beschäftigt.
            </Text>
          </View>
          <Input
            value={topic}
            onChangeText={setTopic}
            placeholder="z. B. Warum ist der Himmel blau?"
            multilineRows={2}
            maxLength={160}
            autoFocus
            icon={<FlaskConical size={17} color={colors.text.tertiary} />}
          />
        </View>

        <View style={{ gap: spacing.md }}>
          <Text variant="headingSm">Für welches Alter?</Text>
          <OptionGrid
            options={AGE_GROUPS.map((entry) => ({ id: entry.id, label: entry.label }))}
            value={ageGroup ?? '6-8'}
            onSelect={(value) => setAgeGroup(value as DokuConfig['ageGroup'])}
            columns={4}
          />
        </View>

        <View style={{ gap: spacing.md }}>
          <Text variant="headingSm">Wie tief?</Text>
          <View style={{ gap: spacing.sm }}>
            {DEPTHS.map((entry) => (
              <OptionRow
                key={entry.id}
                label={entry.label}
                description={entry.description}
                selected={depth === entry.id}
                onPress={() => setDepth(entry.id)}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: spacing.md }}>
          <Text variant="headingSm">Blickwinkel</Text>
          <OptionGrid
            options={PERSPECTIVES.map((entry) => ({ id: entry.id, label: entry.label, icon: entry.icon }))}
            value={perspective ?? 'science'}
            onSelect={(value) => setPerspective(value as DokuConfig['perspective'])}
            columns={3}
          />
        </View>

        <View style={{ gap: spacing.md }}>
          <Text variant="headingSm">Tonfall</Text>
          <OptionGrid
            options={TONES.map((entry) => ({ id: entry.id, label: entry.label, icon: entry.icon }))}
            value={tone ?? 'curious'}
            onSelect={(value) => setTone(value as DokuConfig['tone'])}
            columns={3}
          />
        </View>

        <View style={{ gap: spacing.md }}>
          <Text variant="headingSm">Länge</Text>
          <OptionGrid
            options={LENGTHS.map((entry) => ({ id: entry.id, label: entry.label }))}
            value={length ?? 'medium'}
            onSelect={(value) => setLength(value as DokuConfig['length'])}
            columns={3}
          />
        </View>

        <Card padded={false}>
          <View style={[styles.toggleRow, { padding: spacing.md, gap: spacing.md }]}>
            <View style={{ flex: 1 }}>
              <Text variant="label">Mitmach-Elemente</Text>
              <Text variant="caption" tone="tertiary">
                Quizfragen und Ideen zum Ausprobieren — sie erscheinen später im Quiz-Tab.
              </Text>
            </View>
            <Switch
              value={includeInteractive}
              onValueChange={setIncludeInteractive}
              trackColor={{ false: colors.progressTrack, true: colors.primary }}
              thumbColor={colors.media.foreground}
              accessibilityLabel="Mitmach-Elemente"
            />
          </View>

          {includeInteractive ? (
            <View
              style={{
                padding: spacing.md,
                gap: spacing.base,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border.light,
              }}
            >
              <Stepper label="Quizfragen" value={quizQuestions} min={0} max={10} onChange={setQuizQuestions} />
              <Stepper label="Mitmach-Ideen" value={activities} min={0} max={5} onChange={setActivities} />
            </View>
          ) : null}
        </Card>

        <Button
          label="Doku erstellen"
          onPress={handleGenerate}
          disabled={!canSubmit}
          icon={<Sparkles size={17} color={colors.primaryForeground} />}
          size="lg"
          fullWidth
          hapticIntent="celebrate"
        />

        {!canSubmit ? (
          <Text variant="caption" tone="tertiary" center>
            Gib ein Thema ein
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', alignItems: 'center' },
});
