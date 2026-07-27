import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { Gradient as GradientToken, GradientStops } from '@/theme/tokens';

interface GradientProps {
  /** A gradient token from the theme (`colors.gradient.*`, `surface.elevated`, …). */
  token: GradientToken;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
}

/**
 * Renders a theme gradient token.
 *
 * expo-linear-gradient types `colors`/`locations` as non-empty tuples, which the
 * token objects satisfy — this wrapper is where that is asserted once, so screen
 * code never repeats a cast.
 */
export function Gradient({ token, style, children, pointerEvents }: GradientProps) {
  return (
    <LinearGradient
      colors={token.colors}
      locations={token.locations as GradientLocations}
      start={token.start}
      end={token.end}
      style={style}
      pointerEvents={pointerEvents}
    >
      {children}
    </LinearGradient>
  );
}

type GradientLocations = readonly [number, number, ...number[]] | null | undefined;

/** For the raw colour-stop arrays in `colors.media.*`. */
export function OverlayGradient({
  colors,
  style,
  pointerEvents = 'none',
}: {
  colors: GradientStops;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
}) {
  return <LinearGradient colors={colors} style={style} pointerEvents={pointerEvents} />;
}
