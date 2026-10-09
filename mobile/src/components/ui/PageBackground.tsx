import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

/**
 * The page: the plain system grouped background. Content and imagery carry
 * the colour; the canvas stays quiet.
 */
export const PageBackground = memo(function PageBackground() {
  const { colors } = useTheme();
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.pageSolid }]} pointerEvents="none" />;
});
