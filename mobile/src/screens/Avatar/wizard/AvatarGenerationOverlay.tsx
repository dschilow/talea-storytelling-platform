import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Paintbrush } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { PageBackground } from '@/components/ui/PageBackground';
import { Text } from '@/components/ui/Text';

const MESSAGES = [
  'Ich mische die Farben …',
  'Ich zeichne die Umrisse …',
  'Ich male die Augen …',
  'Ich setze die letzten Details …',
];

/** Shown while the avatar image is generated (typically 20–60 seconds). */
export function AvatarGenerationOverlay({ name }: { name: string }) {
  const { colors, spacing } = useTheme();
  const [messageIndex, setMessageIndex] = useState(0);
  useKeepAwake('talea-avatar-generation');

  useEffect(() => {
    const interval = setInterval(() => setMessageIndex((index) => (index + 1) % MESSAGES.length), 3200);
    return () => clearInterval(interval);
  }, []);

  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear }), -1, false);
  }, [rotation]);

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value * 360}deg` }] }));

  return (
    <View style={[styles.container, { backgroundColor: colors.pageSolid }]}>
      <PageBackground />
      <View style={[styles.content, { gap: spacing.lg, padding: spacing.xl }]}>
        <View style={styles.orbContainer}>
          <Animated.View style={[styles.ring, ringStyle, { borderTopColor: colors.primary, borderColor: colors.border.light }]} />
          <View style={[styles.orb, { backgroundColor: colors.primary }]}>
            <Paintbrush size={26} color={colors.primaryForeground} />
          </View>
        </View>

        <Text variant="displaySm" center>
          {name || 'Dein Avatar'} entsteht
        </Text>

        <Animated.View key={messageIndex} entering={FadeIn.duration(400)}>
          <Text variant="bodySm" tone="secondary" center>
            {MESSAGES[messageIndex]}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  orbContainer: { width: 110, height: 110, alignItems: 'center', justifyContent: 'center' },
  orb: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 104, height: 104, borderRadius: 52, borderWidth: 3 },
});
