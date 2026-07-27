import React, { type ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { PageBackground } from './PageBackground';

/** Extra bottom padding so content clears the tab bar + mini player. */
export const TAB_BAR_CLEARANCE = 96;
export const MINI_PLAYER_CLEARANCE = 72;

interface ScreenProps {
  children: ReactNode;
  /** Renders content inside a ScrollView. Set false for FlatList-based screens. */
  scroll?: boolean;
  /** Adds the standard horizontal gutter. */
  padded?: boolean;
  /** Reserve space for the bottom tab bar (screens inside the tab navigator). */
  tabBarClearance?: boolean;
  /** Reserve space for the mini player when it is visible. */
  playerClearance?: boolean;
  /** Respect the top safe-area inset. Off for screens with their own header art. */
  topInset?: boolean;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollViewProps?: Partial<ScrollViewProps>;
  /** Rendered above the scroll content, outside the scroll container. */
  header?: ReactNode;
  /** Pinned to the bottom, above the tab bar. */
  footer?: ReactNode;
}

/**
 * The standard screen shell: themed page background, safe-area handling and the
 * pull-to-refresh wiring every list screen needs.
 */
export function Screen({
  children,
  scroll = true,
  padded = true,
  tabBarClearance = false,
  playerClearance = false,
  topInset = true,
  onRefresh,
  refreshing = false,
  style,
  contentContainerStyle,
  scrollViewProps,
  header,
  footer,
}: ScreenProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const bottomPadding =
    insets.bottom +
    spacing.lg +
    (tabBarClearance ? TAB_BAR_CLEARANCE : 0) +
    (playerClearance ? MINI_PLAYER_CLEARANCE : 0);

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        padded && { paddingHorizontal: spacing.base },
        { paddingBottom: bottomPadding },
        contentContainerStyle,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.pageSolid}
          />
        ) : undefined
      }
      {...scrollViewProps}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padded && { paddingHorizontal: spacing.base }, contentContainerStyle]}>{children}</View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.pageSolid }, style]}>
      <PageBackground />
      <View style={[styles.flex, topInset && { paddingTop: insets.top }]}>
        {header}
        {body}
        {footer ? <View style={{ paddingBottom: insets.bottom }}>{footer}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
