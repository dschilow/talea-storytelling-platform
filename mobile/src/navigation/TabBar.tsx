import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, { LinearTransition, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { BookOpen, Gamepad2, FlaskConical, House, Smile } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { Glass } from '@/components/ui/Glass';
import { useAudioPlayer } from '@/providers/AudioPlayerProvider';
import { MiniPlayer } from '@/components/audio/MiniPlayer';
import { PlaylistSheet } from '@/components/audio/PlaylistSheet';
import type { TabParamList } from './types';
import type { SheetRef } from '@/components/ui/Sheet';

const ICONS: Record<keyof TabParamList, typeof House> = {
  Home: House,
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

const ROW_PADDING = 4;
const BAR_HEIGHT = 62;

/**
 * Floating glass tab bar, after iOS 26: a capsule of blurred material over the
 * content, the active tab marked by a lighter glass lozenge that slides
 * between tabs, the active icon and label in the accent colour. The mini player
 * floats above it as its own glass capsule.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, spacing, isDark, motion } = useTheme();
  const insets = useSafeAreaInsets();
  const playlistSheetRef = useRef<SheetRef>(null);
  const { playlist, track, waitingForConversion } = useAudioPlayer();
  const [rowWidth, setRowWidth] = useState(0);

  const openQueue = useCallback(() => playlistSheetRef.current?.expand(), []);
  const playerVisible = Boolean(track || waitingForConversion);

  const tabWidth = rowWidth > 0 ? (rowWidth - ROW_PADDING * 2) / state.routes.length : 0;
  const pillX = useSharedValue(0);

  useEffect(() => {
    if (tabWidth <= 0) return;
    pillX.value = withSpring(ROW_PADDING + state.index * tabWidth, motion.springSoft);
  }, [motion.springSoft, pillX, state.index, tabWidth]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pillX.value }] }));

  return (
    <>
      <View
        style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.sm), paddingHorizontal: spacing.lg, gap: spacing.sm }]}
        pointerEvents="box-none"
      >
        {playerVisible ? (
          <Animated.View layout={LinearTransition.springify().damping(26)}>
            <Glass blur borderRadius={26}>
              <MiniPlayer onOpenQueue={openQueue} />
            </Glass>
          </Animated.View>
        ) : null}

        <Glass blur borderRadius={BAR_HEIGHT / 2}>
          <View style={[styles.tabs, { height: BAR_HEIGHT, paddingHorizontal: ROW_PADDING }]} onLayout={(event: LayoutChangeEvent) => setRowWidth(event.nativeEvent.layout.width)}>
            {tabWidth > 0 ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.pill,
                  { width: tabWidth, backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(120,120,128,0.14)' },
                  pillStyle,
                ]}
              />
            ) : null}

            {state.routes.map((route, index) => {
              const routeName = route.name as keyof TabParamList;
              const { options } = descriptors[route.key];
              const focused = state.index === index;
              const Icon = ICONS[routeName] ?? House;
              const tint = focused ? colors.primary : colors.text.primary;

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
                <Touchable
                  key={route.key}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  hapticIntent="selection"
                  pressScale={0.92}
                  style={styles.tab}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={label}
                >
                  <Icon size={23} color={tint} strokeWidth={focused ? 2.2 : 1.8} />
                  <Text variant="caption" weight={focused ? 'semibold' : 'medium'} numberOfLines={1} style={[styles.label, { color: tint }]}>
                    {label}
                  </Text>
                </Touchable>
              );
            })}
          </View>
        </Glass>
      </View>

      {/* Mounted only when there is a queue to show. A bottom sheet left
          mounted at index -1 still renders its container and backdrop, which
          can intercept touches for the whole screen — and this one lives in the
          tab bar, so it would take the entire app down with it. */}
      {playlist.length > 0 ? <PlaylistSheet ref={playlistSheetRef} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  tabs: { flexDirection: 'row', alignItems: 'center' },
  pill: { position: 'absolute', top: 4, bottom: 4, left: 0, borderRadius: (BAR_HEIGHT - 8) / 2 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, height: BAR_HEIGHT },
  label: { fontSize: 10.5, lineHeight: 13 },
});
