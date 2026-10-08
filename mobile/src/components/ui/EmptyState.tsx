import React, { type ReactNode } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { Glow } from '@/components/fx/Glow';
import { Floating } from '@/components/fx/Motion';
import { SparkleField } from '@/components/fx/Sparkles';
import { useAmbientMotion } from '@/components/fx/useAmbientMotion';
import { Button } from './Button';
import { Text } from './Text';
import { Gradient } from './Gradient';

const TAVI = require('../../../assets/tavi.png');

interface EmptyStateProps {
  icon?: ReactNode;
  /** An illustration instead of the icon orb. `'tavi'` shows the mascot. */
  illustration?: 'tavi' | ImageSourcePropType | string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  compact?: boolean;
}

/**
 * Empty and zero-data states.
 *
 * Always offers the next action rather than just reporting absence — an empty
 * story list is an invitation to create one, not an error. Tavi or a glowing
 * icon orb gives the moment some warmth.
 */
export function EmptyState({
  icon,
  illustration,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  compact,
}: EmptyStateProps) {
  const { colors, spacing, isDark } = useTheme();
  const ambient = useAmbientMotion();
  const art = illustration === 'tavi' ? TAVI : typeof illustration === 'string' ? { uri: illustration } : illustration;
  const artSize = compact ? 104 : 140;

  return (
    <Animated.View
      entering={FadeInDown.duration(420)}
      style={[styles.container, { paddingVertical: compact ? spacing.xl : spacing.huge, gap: spacing.md }]}
    >
      {art ? (
        <View style={[styles.artStage, { width: artSize * 1.6, height: artSize * 1.15 }]}>
          <Glow color={isDark ? 'rgba(140, 108, 255, 0.36)' : 'rgba(140, 108, 255, 0.24)'} size={artSize * 1.6} style={{ top: -artSize * 0.25 }} />
          <SparkleField width={artSize * 1.6} height={artSize * 1.15} count={6} color={colors.gold} seed={3} active={ambient} />
          <Floating active={ambient} amplitude={5}>
            <Image source={art} style={{ width: artSize, height: artSize }} contentFit="contain" />
          </Floating>
        </View>
      ) : icon ? (
        <View style={styles.orbStage}>
          <Glow color="rgba(140, 108, 255, 0.30)" size={150} style={{ top: -30, left: -30 }} />
          <View style={[styles.orb, { borderColor: colors.border.light }]}>
            <Gradient token={colors.gradient.primary} style={[StyleSheet.absoluteFill, { borderRadius: 30 }]} />
            {icon}
          </View>
        </View>
      ) : null}

      <Text variant="displaySm" center>
        {title}
      </Text>

      {description ? (
        <Text variant="bodySm" tone="secondary" center style={{ maxWidth: 310 }}>
          {description}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.sm, gap: spacing.xs, alignItems: 'center' }}>
          <Button label={actionLabel} onPress={onAction} size="md" />
          {secondaryActionLabel && onSecondaryAction ? (
            <Button label={secondaryActionLabel} onPress={onSecondaryAction} variant="ghost" size="sm" />
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  artStage: { alignItems: 'center', justifyContent: 'center' },
  orbStage: { width: 90, height: 90, alignItems: 'center', justifyContent: 'center' },
  orb: {
    width: 84,
    height: 84,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
});
