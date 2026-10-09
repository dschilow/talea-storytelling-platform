import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Check, RefreshCw } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { PageBackground } from '@/components/ui/PageBackground';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { ListSection } from '@/components/ui/List';
import { Text } from '@/components/ui/Text';

export type GenerationPhase = 'profiles' | 'memories' | 'text' | 'validation' | 'images' | 'complete' | 'recovering';

const PHASES: { key: Exclude<GenerationPhase, 'recovering'>; label: string; description: string }[] = [
  { key: 'profiles', label: 'Avatare vorbereiten', description: 'Ich schaue mir deine Avatare genau an' },
  { key: 'memories', label: 'Erinnerungen sammeln', description: 'Was haben deine Avatare schon erlebt?' },
  { key: 'text', label: 'Geschichte schreiben', description: 'Deine Geschichte entsteht gerade' },
  { key: 'validation', label: 'Alles prüfen', description: 'Passt die Geschichte zusammen?' },
  { key: 'images', label: 'Bilder malen', description: 'Die Bilder für deine Geschichte entstehen' },
  { key: 'complete', label: 'Fertig!', description: 'Deine Geschichte ist bereit' },
];

interface GenerationOverlayProps {
  phase: GenerationPhase;
  /** Set while polling for a story whose request died mid-flight. */
  recoveryAttempt: number | null;
}

/**
 * Full-screen generation state, calm like a system setup screen: one progress
 * ring, a title, and the steps ticking off.
 *
 * Generation legitimately takes minutes, so this keeps the screen awake. The
 * recovery phase is deliberately reassuring rather than an error: the story is
 * almost always still being written server-side, and the user has already been
 * charged for it.
 */
export function GenerationOverlay({ phase, recoveryAttempt }: GenerationOverlayProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  useKeepAwake('talea-generation');

  const isRecovering = phase === 'recovering';
  const currentIndex = isRecovering ? 2 : PHASES.findIndex((entry) => entry.key === phase);
  const progress = isRecovering ? 0.55 : (currentIndex + 1) / PHASES.length;

  return (
    <View style={styles.container}>
      <PageBackground />

      <View style={[styles.content, { paddingTop: insets.top + spacing.huge, paddingHorizontal: spacing.lg, gap: spacing.xl }]}>
        <Animated.View entering={FadeIn.duration(400)} style={{ alignItems: 'center', gap: spacing.md }}>
          <ProgressRing progress={progress} size={128} strokeWidth={8}>
            <Text variant="displayMd" style={{ fontVariant: ['tabular-nums'] }}>
              {Math.round(progress * 100)} %
            </Text>
          </ProgressRing>
          <Text variant="displayLg" center style={{ marginTop: spacing.sm }}>
            {isRecovering ? 'Fast geschafft' : 'Deine Geschichte entsteht'}
          </Text>
          <Text variant="bodySm" tone="secondary" center style={{ maxWidth: 300 }}>
            {isRecovering
              ? 'Die Verbindung war kurz weg — deine Geschichte wird aber weiter geschrieben. Ich hole sie gleich.'
              : 'Das dauert ein paar Minuten. Du kannst das Handy liegen lassen.'}
          </Text>
        </Animated.View>

        <ListSection separatorInset={56}>
          {PHASES.map((entry, index) => {
            const isActive = !isRecovering && index === currentIndex;
            const isDone = !isRecovering && index < currentIndex;

            return (
              <View key={entry.key} style={[styles.row, { paddingHorizontal: spacing.base, gap: spacing.md }]}>
                <View style={styles.status}>
                  {isDone ? (
                    <View style={[styles.done, { backgroundColor: colors.system.green }]}>
                      <Check size={14} color="#FFFFFF" strokeWidth={3} />
                    </View>
                  ) : isActive ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <View style={[styles.pending, { borderColor: colors.border.strong }]} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyLg" tone={isDone || isActive ? 'primary' : 'tertiary'}>
                    {entry.label}
                  </Text>
                  {isActive ? (
                    <Text variant="caption" tone="secondary">
                      {entry.description}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </ListSection>

        {isRecovering && recoveryAttempt ? (
          <View style={[styles.recoveryRow, { gap: spacing.sm }]}>
            <RefreshCw size={14} color={colors.text.tertiary} />
            <Text variant="caption" tone="tertiary">
              Versuch {recoveryAttempt} — ich warte weiter
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 50, paddingVertical: 8 },
  status: { width: 28, alignItems: 'center' },
  done: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  pending: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  recoveryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
