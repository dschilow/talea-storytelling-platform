import React, { memo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { darkPalette, type Gradient as GradientToken, type Glow as GlowToken } from '@/theme/tokens';
import { DriftingGlow, Glow } from '@/components/fx/Glow';
import { SparkleField } from '@/components/fx/Sparkles';
import { useAmbientMotion } from '@/components/fx/useAmbientMotion';
import { Gradient } from './Gradient';

/** The midnight stage used by landing, splash and the generation screen. */
const NIGHT_GRADIENT: GradientToken = {
  colors: ['#1E1546', '#130E2D', '#0A0718'],
  locations: [0, 0.55, 1],
  start: { x: 0.5, y: 0 },
  end: { x: 0.5, y: 1 },
};

const NIGHT_GLOWS: readonly GlowToken[] = [
  { color: 'rgba(122, 82, 255, 0.42)', size: 520, top: -220, left: -200 },
  { color: 'rgba(232, 74, 158, 0.26)', size: 440, top: -120, left: 160 },
  { color: 'rgba(25, 184, 242, 0.20)', size: 560, top: 420, left: -240 },
  { color: 'rgba(244, 172, 50, 0.12)', size: 420, top: 640, left: 180 },
];

interface PageBackgroundProps {
  /** Slow aurora drift + twinkling stars. Reserved for hero screens. */
  animated?: boolean;
  /** `night` forces the midnight stage regardless of the colour scheme. */
  variant?: 'page' | 'night';
  /** Defaults to on for dark mode and the night stage. */
  stars?: boolean;
}

/**
 * The Talea page: a soft vertical wash with feathered radial glows. In dark
 * mode (and on the night stage) a quiet star field sits on top.
 *
 * The glows are real radial gradients (`experimental_backgroundImage`), not
 * translucent circles — the old circles had hard edges that read as stickers.
 */
export const PageBackground = memo(function PageBackground({ animated = false, variant = 'page', stars }: PageBackgroundProps) {
  const { colors, isDark } = useTheme();
  const ambient = useAmbientMotion();
  const { width, height } = useWindowDimensions();

  const night = variant === 'night';
  const gradient = night ? NIGHT_GRADIENT : colors.pageGradient;
  const glows = night ? NIGHT_GLOWS : colors.glows;
  const showStars = stars ?? (night || isDark);
  const drifting = animated && ambient;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: night ? darkPalette.pageSolid : colors.pageSolid }]} pointerEvents="none">
      <Gradient token={gradient} style={StyleSheet.absoluteFill} />
      {glows.map((glow, index) =>
        animated ? (
          <DriftingGlow
            key={index}
            color={glow.color}
            size={glow.size}
            style={{ top: glow.top, left: glow.left }}
            period={15000 + index * 3700}
            delay={index * 600}
            amplitude={34 + index * 6}
            active={drifting}
          />
        ) : (
          <Glow key={index} color={glow.color} size={glow.size} style={{ top: glow.top, left: glow.left }} />
        )
      )}
      {showStars ? (
        <SparkleField
          width={width}
          height={height}
          shape="dot"
          count={night ? 48 : 24}
          color="rgba(255, 255, 255, 0.92)"
          minSize={1.2}
          maxSize={night ? 2.8 : 2.2}
          seed={night ? 11 : 5}
          active={drifting}
          style={{ opacity: night ? 1 : 0.55 }}
        />
      ) : null}
    </View>
  );
});
