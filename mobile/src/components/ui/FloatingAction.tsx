import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { useAudioPlayer } from '@/providers/AudioPlayerProvider';
import { Shine } from '@/components/fx/Motion';
import { useAmbientMotion } from '@/components/fx/useAmbientMotion';
import { Touchable } from './Pressable';
import { Text } from './Text';
import { Gradient } from './Gradient';

/** Height of the floating tab bar capsule above the safe area. */
const TAB_BAR_HEIGHT = 74;
/** Extra lift while the mini player is docked in the tab bar. */
const PLAYER_HEIGHT = 70;

interface FloatingActionProps {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  /** Sits above the floating tab bar (tab screens) or the bottom edge. */
  aboveTabBar?: boolean;
}

/**
 * Extended floating action button — the primary "create" action on library
 * screens. Gradient pill with a violet glow and an occasional glint.
 */
export function FloatingAction({ label, icon, onPress, aboveTabBar = true }: FloatingActionProps) {
  const { colors, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const ambient = useAmbientMotion();
  const { track, waitingForConversion } = useAudioPlayer();
  const playerVisible = Boolean(track || waitingForConversion);

  const bottom = insets.bottom + (aboveTabBar ? TAB_BAR_HEIGHT + 22 + (playerVisible ? PLAYER_HEIGHT : 0) : 24);

  return (
    <Animated.View entering={ZoomIn.springify().damping(14).delay(250)} style={[styles.anchor, { bottom }]} pointerEvents="box-none">
      <Touchable
        onPress={onPress}
        hapticIntent="medium"
        pressScale={0.94}
        style={[styles.fab, shadows.glow]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <View style={[StyleSheet.absoluteFill, styles.clip]}>
          <Gradient token={colors.gradient.action} style={StyleSheet.absoluteFill} />
          <Shine active={ambient} interval={6500} delay={2200} intensity={0.22} />
        </View>
        {icon}
        <Text variant="label" style={{ color: colors.primaryForeground }}>
          {label}
        </Text>
      </Touchable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', right: 20 },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 54,
    paddingLeft: 18,
    paddingRight: 22,
    borderRadius: 27,
  },
  clip: { borderRadius: 27, overflow: 'hidden' },
});
