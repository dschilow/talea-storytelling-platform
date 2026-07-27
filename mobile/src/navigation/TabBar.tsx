import React, { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { BookOpen, Brain, FlaskConical, Home, User } from 'lucide-react-native';
import type BottomSheet from '@gorhom/bottom-sheet';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { MiniPlayer } from '@/components/audio/MiniPlayer';
import { PlaylistSheet } from '@/components/audio/PlaylistSheet';
import type { TabParamList } from './types';

const ICONS: Record<keyof TabParamList, typeof Home> = {
  Home: Home,
  Stories: BookOpen,
  Avatars: User,
  Dokus: FlaskConical,
  Quiz: Brain,
};

/** Used only if a screen was registered without a translated `tabBarLabel`. */
const FALLBACK_LABELS: Record<keyof TabParamList, string> = {
  Home: 'Start',
  Stories: 'Geschichten',
  Avatars: 'Avatare',
  Dokus: 'Dokus',
  Quiz: 'Quiz',
};

/**
 * Floating tab bar with the mini player docked above it.
 *
 * Built by hand rather than styling the default bar because the player has to
 * live inside the same floating capsule (as on the web) and expand without the
 * tab bar jumping — a layout the stock bar cannot express.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, spacing, radius, shadows, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const playlistSheetRef = useRef<BottomSheet>(null);

  const openQueue = useCallback(() => playlistSheetRef.current?.expand(), []);

  return (
    <>
      <View
        style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.sm), paddingHorizontal: spacing.sm }]}
        pointerEvents="box-none"
      >
        <Animated.View
          layout={LinearTransition.springify().damping(26)}
          style={[
            styles.capsule,
            shadows.strong,
            { borderRadius: radius.xxl, borderColor: colors.border.light, backgroundColor: colors.surface.panel },
          ]}
        >
          <BlurView intensity={isDark ? 40 : 28} tint={colors.blurTint} style={StyleSheet.absoluteFill} />

          <MiniPlayer onOpenQueue={openQueue} />

          <View style={[styles.tabs, { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs }]}>
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
                  <View
                    style={[
                      styles.iconShell,
                      {
                        borderRadius: radius.md,
                        backgroundColor: focused ? colors.surface.item : 'transparent',
                        borderColor: focused ? colors.border.accent : 'transparent',
                      },
                    ]}
                  >
                    <Icon
                      size={19}
                      color={focused ? colors.primary : colors.text.tertiary}
                      strokeWidth={focused ? 2.4 : 1.9}
                    />
                  </View>
                  <Text
                    variant="caption"
                    numberOfLines={1}
                    style={{
                      fontSize: 9.5,
                      lineHeight: 12,
                      color: focused ? colors.primary : colors.text.tertiary,
                    }}
                  >
                    {label}
                  </Text>
                </Touchable>
              );
            })}
          </View>
        </Animated.View>
      </View>

      <PlaylistSheet ref={playlistSheetRef} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  capsule: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  tabs: { flexDirection: 'row', alignItems: 'center' },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 },
  iconShell: {
    width: 38,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
