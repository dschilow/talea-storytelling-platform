import React from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BookOpen, Brain, Headphones, Sprout } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { PageBackground } from '@/components/ui/PageBackground';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Signed-out entry point, built like Apple's welcome screens: the app icon, a
 * large title, a short list of what the app does — each with a coloured
 * symbol — and one prominent button pinned to the bottom.
 */
export function LandingScreen() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const tints = colors.system;

  // Feature copy is German-only, matching the web landing page — the marketing
  // copy has never been in the shared locale bundles.
  const features = [
    { Icon: Sprout, color: tints.green, title: 'Avatare, die mitwachsen', body: 'Jede Geschichte verändert Wissen, Mut und Neugier deines Avatars.' },
    { Icon: BookOpen, color: tints.orange, title: 'Geschichten in Minuten', body: 'Genre, Alter und Stimmung wählen — Talea schreibt und illustriert.' },
    { Icon: Headphones, color: tints.pink, title: 'Zum Vorlesen', body: 'Jede Geschichte wird zur Hörfassung — auch offline.' },
    { Icon: Brain, color: tints.blue, title: 'Spielerisch lernen', body: 'Quizze, Dokus und eine Lernkarte, die den Fortschritt zeigt.' },
  ];

  return (
    <View style={styles.container}>
      <PageBackground />

      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.huge, paddingHorizontal: spacing.xxl, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(500)} style={[styles.hero, { gap: spacing.lg }]}>
          <View style={[styles.iconShell, { backgroundColor: colors.surface.primary }]}>
            <Image source={require('../../../assets/talea-logo.png')} style={styles.logo} resizeMode="contain" />
          </View>
          <Text variant="hero" center>
            Willkommen bei Talea
          </Text>
        </Animated.View>

        <View style={{ gap: spacing.xl, marginTop: spacing.xxl + spacing.sm }}>
          {features.map(({ Icon, color, title, body }, index) => (
            <Animated.View key={title} entering={FadeInDown.delay(120 + index * 70).duration(420)} style={[styles.feature, { gap: spacing.base }]}>
              <Icon size={30} color={color} strokeWidth={1.9} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="title">{title}</Text>
                <Text variant="bodySm" tone="secondary">
                  {body}
                </Text>
              </View>
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.base, gap: spacing.xs }}>
        <Button label={t('auth.signUp', 'Kostenlos starten')} onPress={() => navigation.navigate('Auth', { mode: 'sign-up' })} size="lg" fullWidth />
        <Button label={t('auth.signIn', 'Ich habe schon ein Konto')} onPress={() => navigation.navigate('Auth', { mode: 'sign-in' })} variant="ghost" size="md" fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { alignItems: 'center' },
  iconShell: {
    width: 104,
    height: 104,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 6px 20px rgba(0, 0, 0, 0.12)',
  },
  logo: { width: 76, height: 76 },
  feature: { flexDirection: 'row', alignItems: 'center' },
});
