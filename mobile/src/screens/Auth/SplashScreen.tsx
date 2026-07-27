import React from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { PageBackground } from '@/components/ui/PageBackground';
import { Text } from '@/components/ui/Text';

/** Shown while Clerk resolves the stored session on cold start. */
export function SplashScreen({ message }: { message?: string }) {
  const { colors, spacing } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.pageSolid }]}>
      <PageBackground />
      <View style={[styles.content, { gap: spacing.lg }]}>
        <Image source={require('../../../assets/talea-logo.png')} style={styles.logo} resizeMode="contain" />
        <ActivityIndicator color={colors.primary} />
        {message ? (
          <Text variant="bodySm" tone="secondary" center>
            {message}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 148, height: 148 },
});
