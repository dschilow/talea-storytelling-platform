import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '@/theme/ThemeProvider';

interface GlassProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
  /**
   * Real backdrop blur. Costly on Android, so it is reserved for large chrome
   * that floats over scrolling content (tab bar, reader bars, banners); small
   * controls use the tinted fill alone.
   */
  blur?: boolean;
  /** `dark` forces the dark material, e.g. for controls on top of imagery. */
  tone?: 'auto' | 'dark';
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
}

/**
 * The glass material for floating chrome, after iOS 26's Liquid Glass: a
 * translucent tinted fill (over a real blur where it matters), a bright rim
 * that catches light along the top edge, and a soft drop shadow.
 */
export function Glass({ children, style, borderRadius = 999, blur = false, tone = 'auto', pointerEvents }: GlassProps) {
  const { colors, isDark, shadows } = useTheme();
  const dark = tone === 'dark' || isDark;
  const fill = tone === 'dark' ? 'rgba(28, 28, 30, 0.55)' : colors.surface.panel;

  return (
    <View pointerEvents={pointerEvents} style={[{ borderRadius }, shadows.float, style]}>
      <View style={[StyleSheet.absoluteFill, styles.clip, { borderRadius }]} pointerEvents="none">
        {blur ? (
          <BlurView
            experimentalBlurMethod="dimezisBlurView"
            blurReductionFactor={3}
            intensity={dark ? 60 : 70}
            tint={dark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
        <LinearGradient
          colors={dark ? ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)'] : ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
          locations={[0, 0.6]}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius,
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.7)',
              borderTopColor: dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.95)',
            },
          ]}
        />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
