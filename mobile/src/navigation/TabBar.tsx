import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import Animated, {
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { BookOpen, Gamepad2, FlaskConical, Home, Smile } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { Gradient } from '@/components/ui/Gradient';
import { useAudioPlayer } from '@/providers/AudioPlayerProvider';
import { MiniPlayer } from '@/components/audio/MiniPlayer';
import { PlaylistSheet } from '@/components/audio/PlaylistSheet';
import type { TabParamList } from './types';
import type { SheetRef } from '@/components/ui/Sheet';

const ICONS: Record<keyof TabParamList, typeof Home> = {
  Home: Home,
  Stories: BookOpen,
  Avatars: Smile,
  Dokus: FlaskConical,
  Spiel: Gamepad2,
};

/** Used only if a screen was registered without a translated `tabBarLabel`. */
const FALLBACK_LABELS: Record<keyof TabParamList, string> = {
  Home: 'Start',
  Stories: 'Geschichten',
  Avatars: 'Avatare',
  Dokus: 'Dokus',
  Spiel: 'Spiel',
};

const ROW_PADDING = 6;
const PILL_WIDTH = 52;
const PILL_HEIGHT = 32;

/**
 * Floating tab bar with the mini player docked above it.
 *
 * Built by hand rather than styling the default bar because the player has to
 * live inside the same floating capsule and expand without the tab bar jumping.
 * The active tab is marked by a gradient pill that springs between tabs.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, spacing, shadows, isDark, motion } = useTheme();
  const insets = useSafeAreaInsets();
  const playlistSheetRef = useRef<SheetRef>(null);
  const { playlist } = useAudioPlayer();
  const [rowWidth, setRowWidth] = useState(0);

  const openQueue = useCallback(() => playlistSheetRef.current?.expand(), []);

  const tabCount = state.routes.length;
  const tabWidth = rowWidth > 0 ? (rowWidth - ROW_PADDING * 2) / tabCount : 0;
  const pillX = useSharedValue(0);
  const pillReady = tabWidth > 0;

  useEffect(() => {
    if (!pillReady) return;
    const target = ROW_PADDING + state.index * tabWidth + (tabWidth - PILL_WIDTH) / 2;
    pillX.value = withSpring(target, motion.springSoft);
  }, [motion.springSoft, pillReady, pillX, state.index, tabWidth]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pillX.value }] }));

  return (
    <>
      <View
        style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.sm), paddingHorizontal: spacing.md }]}
        pointerEvents="box-none"
      >
        <Animated.View
          layout={LinearTransition.springify().damping(26)}
          style={[styles.capsule, shadows.float, { borderColor: colors.border.light }]}
        >
          <View style={[StyleSheet.absoluteFill, styles.clip]}>
            <BlurView intensity={isDark ? 50 : 40} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface.panel }]} />
          </View>

          <MiniPlayer onOpenQueue={openQueue} />

          <View
            style={[styles.tabs, { paddingHorizontal: ROW_PADDING }]}
            onLayout={(event: LayoutChangeEvent) => setRowWidth(event.nativeEvent.layout.width)}
          >
            {pillReady ? (
              <Animated.View style={[styles.pill, shadows.glow, pillStyle]}>
                <Gradient token={colors.gradient.action} style={[StyleSheet.absoluteFill, { borderRadius: PILL_HEIGHT / 2 }]} />
              </Animated.View>
            ) : null}

            {state.routes.map((route, index) => {
              const routeName = route.name as keyof TabParamList;
              const { options } = descriptors[route.key];
              const focused = state.index === index;
              const Icon = ICONS[routeName] ?? Home;

              const onPress = () => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name as never);
                }
              };

              const onLongPress = () => {
                navigation.emit({ type: 'tabLongPress', target: route.key });
              };

              const label = (options.tabBarLabel as string) ?? FALLBACK_LABELS[routeName] ?? route.name;

              return (
                <TabItem
                  key={route.key}
                  label={label}
                  focused={focused}
                  Icon={Icon}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  activeColor={colors.primaryForeground}
                  idleColor={colors.text.tertiary}
                  labelColor={focused ? colors.text.primary : colors.text.tertiary}
                />
              );
            })}
          </View>
        </Animated.View>
      </View>

      {/* Mounted only when there is a queue to show. A bottom sheet left
          mounted at index -1 still renders its container and backdrop, which
          can intercept touches for the whole screen — and this one lives in the
          tab bar, so it would take the entire app down with it. */}
      {playlist.length > 0 ? <PlaylistSheet ref={playlistSheetRef} /> : null}
    </>
  );
}

function TabItem({
  label,
  focused,
  Icon,
  onPress,
  onLongPress,
  activeColor,
  idleColor,
  labelColor,
}: {
  label: string;
  focused: boolean;
  Icon: typeof Home;
  onPress: () => void;
  onLongPress: () => void;
  activeColor: string;
  idleColor: string;
  labelColor: string;
}) {
  const bounce = useSharedValue(1);

  useEffect(() => {
    if (focused) {
      bounce.value = withSequence(withTiming(0.82, { duration: 90 }), withSpring(1, { damping: 9, stiffness: 260 }));
    }
  }, [bounce, focused]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: bounce.value }] }));

  return (
    <Touchable
      onPress={onPress}
      onLongPress={onLongPress}
      hapticIntent="selection"
      pressScale={0.9}
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.iconShell, iconStyle]}>
        <Icon size={20} color={focused ? activeColor : idleColor} strokeWidth={focused ? 2.4 : 2} />
      </Animated.View>
      <Text variant="caption" weight={focused ? 'bold' : 'semibold'} numberOfLines={1} style={[styles.label, { color: labelColor }]}>
        {label}
      </Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  capsule: { borderWidth: 1, borderRadius: 30 },
  clip: { overflow: 'hidden', borderRadius: 30 },
  tabs: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingBottom: 6 },
  pill: {
    position: 'absolute',
    top: 8,
    left: 0,
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  iconShell: { width: PILL_WIDTH, height: PILL_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10.5, lineHeight: 13 },
});
