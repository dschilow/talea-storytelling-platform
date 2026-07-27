import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Gradient } from './Gradient';

/**
 * The Talea page wash: a vertical gradient with three soft radial "blooms"
 * layered on top, matching `--talea-page` from the web.
 *
 * React Native has no radial gradients, so each bloom is a heavily-rounded,
 * low-opacity circle. At the blur radii involved the difference is not
 * perceptible, and it costs one view instead of a shader.
 */
export const PageBackground = memo(function PageBackground() {
  const { colors } = useTheme();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Gradient token={colors.pageGradient} style={StyleSheet.absoluteFill} />
      {colors.pageBlooms.map((bloom, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            top: bloom.top,
            left: bloom.left,
            width: bloom.size,
            height: bloom.size,
            borderRadius: bloom.size / 2,
            backgroundColor: bloom.color,
            opacity: 0.85,
          }}
        />
      ))}
    </View>
  );
});
