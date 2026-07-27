import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { CheckCircle2, FileText, Image as ImageIcon, RefreshCw, Sparkles, Users } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { PageBackground } from '@/components/ui/PageBackground';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';

export type GenerationPhase = 'profiles' | 'memories' | 'text' | 'validation' | 'images' | 'complete' | 'recovering';

const PHASES: { key: Exclude<GenerationPhase, 'recovering'>; Icon: typeof Users; label: string; description: string }[] = [
  { key: 'profiles', Icon: Users, label: 'Avatare vorbereiten', description: 'Ich schaue mir deine Avatare genau an' },
  { key: 'memories', Icon: Sparkles, label: 'Erinnerungen sammeln', description: 'Was haben deine Avatare schon erlebt?' },
  { key: 'text', Icon: FileText, label: 'Geschichte schreiben', description: 'Deine Geschichte entsteht gerade' },
  { key: 'validation', Icon: CheckCircle2, label: 'Alles prüfen', description: 'Passt die Geschichte zusammen?' },
  { key: 'images', Icon: ImageIcon, label: 'Bilder malen', description: 'Die Bilder für deine Geschichte entstehen' },
  { key: 'complete', Icon: CheckCircle2, label: 'Fertig!', description: 'Deine Geschichte ist bereit' },
];

interface GenerationOverlayProps {
  phase: GenerationPhase;
  /** Set while polling for a story whose request died mid-flight. */
  recoveryAttempt: number | null;
}

/**
 * Full-screen generation state.
 *
 * Generation legitimately takes minutes, so this keeps the screen awake and
 * narrates what the pipeline is doing. The recovery phase is deliberately
 * reassuring rather than an error: the story is almost always still being
 * written server-side, and the user has already been charged for it.
 */
export function GenerationOverlay({ phase, recoveryAttempt }: GenerationOverlayProps) {
  const { colors, spacing, radius } = useTheme();
  useKeepAwake('talea-generation');

  const isRecovering = phase === 'recovering';
  const currentIndex = isRecovering ? 2 : PHASES.findIndex((entry) => entry.key === phase);
  const progress = isRecovering ? 0.55 : (currentIndex + 1) / PHASES.length;

  return (
    <View style={[styles.container, { backgroundColor: colors.pageSolid }]}>
      <PageBackground />

      <View style={[styles.content, { padding: spacing.xl, gap: spacing.xl }]}>
        <Animated.View entering={FadeIn.duration(400)} style={{ alignItems: 'center', gap: spacing.md }}>
          <PulsingOrb />
          <Text variant="displaySm" center>
            {isRecovering ? 'Fast geschafft' : 'Deine Geschichte entsteht'}
          </Text>
          <Text variant="bodySm" tone="secondary" center style={{ maxWidth: 300 }}>
            {isRecovering
              ? 'Die Verbindung war kurz weg — deine Geschichte wird aber weiter geschrieben. Ich hole sie gleich.'
              : 'Das dauert ein paar Minuten. Du kannst das Handy liegen lassen.'}
          </Text>
        </Animated.View>

        <View style={{ alignSelf: 'stretch', gap: spacing.md }}>
          <ProgressBar progress={progress} height={7} />

          <View style={{ gap: spacing.sm }}>
            {PHASES.map((entry, index) => {
              const isActive = !isRecovering && index === currentIndex;
              const isDone = !isRecovering && index < currentIndex;
              const { Icon } = entry;

              return (
                <View
                  key={entry.key}
                  style={[
                    styles.phaseRow,
                    {
                      borderRadius: radius.md,
                      padding: spacing.md,
                      gap: spacing.md,
                      backgroundColor: isActive ? colors.surface.item : 'transparent',
                      borderColor: isActive ? colors.border.accent : 'transparent',
                      borderWidth: isActive ? 1.4 : StyleSheet.hairlineWidth,
                      opacity: isDone ? 0.55 : isActive ? 1 : 0.4,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.phaseIcon,
                      {
                        borderRadius: radius.sm,
                        backgroundColor: isDone || isActive ? colors.successSoft : colors.surface.inset,
                      },
                    ]}
                  >
                    {isDone ? (
                      <CheckCircle2 size={16} color={colors.success} />
                    ) : (
                      <Icon size={16} color={isActive ? colors.primary : colors.text.tertiary} />
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text variant="label" tone={isActive ? 'accent' : 'primary'}>
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
          </View>

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
    </View>
  );
}

/** Breathing orb; a calmer signal of "working" than a spinner for a minutes-long wait. */
function PulsingOrb() {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const glow = useSharedValue(0.4);

  useEffect(() => {
    scale.value = withRepeat(withTiming(1.12, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true);
    glow.value = withRepeat(withTiming(0.85, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [glow, scale]);

  const orbStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: scale.value * 1.35 }] }));

  return (
    <View style={styles.orbContainer}>
      <Animated.View style={[styles.orbGlow, glowStyle, { backgroundColor: colors.successSoft }]} />
      <Animated.View style={[styles.orb, orbStyle, { backgroundColor: colors.primary }]}>
        <Sparkles size={26} color={colors.primaryForeground} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  orbContainer: { width: 110, height: 110, alignItems: 'center', justifyContent: 'center' },
  orb: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  orbGlow: { position: 'absolute', width: 100, height: 100, borderRadius: 50 },
  phaseRow: { flexDirection: 'row', alignItems: 'center' },
  phaseIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  recoveryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
