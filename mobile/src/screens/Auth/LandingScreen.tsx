import React from 'react';
import { Dimensions, Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { BookOpen, Brain, Sparkles, Volume2 } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { PageBackground } from '@/components/ui/PageBackground';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import type { RootStackParamList } from '@/navigation/types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Signed-out entry point.
 *
 * The web landing page is a long marketing scroll; on mobile the job is
 * different — get an already-convinced user into the app in one tap, and give a
 * new user just enough to understand what Talea is. So this is a single screen
 * with the value proposition and two clear actions.
 */
export function LandingScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();

  const highlights = [
    {
      icon: <Sparkles size={18} color={colors.accent.mint} />,
      title: 'Avatare, die mitwachsen',
      body: 'Jede Geschichte verändert Wissen, Mut und Neugier deines Avatars.',
    },
    {
      icon: <BookOpen size={18} color={colors.accent.sky} />,
      title: 'Geschichten in Minuten',
      body: 'Genre, Alter und Stimmung wählen — Talea schreibt und illustriert.',
    },
    {
      icon: <Volume2 size={18} color={colors.accent.peach} />,
      title: 'Zum Vorlesen',
      body: 'Jede Geschichte wird zur Hörfassung — auch offline.',
    },
    {
      icon: <Brain size={18} color={colors.accent.lavender} />,
      title: 'Spielerisch lernen',
      body: 'Quizze, Dokus und eine Lernkarte, die den Fortschritt zeigt.',
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.pageSolid }]}>
      <PageBackground />

      <View style={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}>
        <Animated.View entering={FadeInDown.duration(520)} style={[styles.hero, { gap: spacing.md }]}>
          <Image source={require('../../../assets/talea-logo.png')} style={styles.logo} resizeMode="contain" />
          {/* Hero copy is German-only, matching the web landing page — the
              marketing copy has never been in the shared locale bundles. Using
              t() here would imply a translation that does not exist. */}
          <Text variant="displayMd" center>
            Geschichten, die mit deinem Kind wachsen
          </Text>
          <Text variant="bodyLg" tone="secondary" center style={{ maxWidth: 330 }}>
            Erschafft gemeinsam Avatare, erlebt personalisierte Abenteuer und seht zu, wie Persönlichkeit entsteht.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(180).duration(520)} style={{ gap: spacing.sm }}>
          {highlights.map((highlight, index) => (
            <Card key={highlight.title} variant="surface" padded={false} style={{ padding: spacing.md }}>
              <View style={[styles.highlightRow, { gap: spacing.md }]}>
                <View
                  style={[
                    styles.highlightIcon,
                    { borderRadius: radius.sm, backgroundColor: colors.surface.inset, borderColor: colors.border.light },
                  ]}
                >
                  {highlight.icon}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label">{highlight.title}</Text>
                  <Text variant="caption" tone="secondary">
                    {highlight.body}
                  </Text>
                </View>
              </View>
            </Card>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(320).duration(520)} style={{ gap: spacing.sm }}>
          <Button
            label={t('auth.signUp', 'Kostenlos starten')}
            onPress={() => navigation.navigate('Auth', { mode: 'sign-up' })}
            size="lg"
            fullWidth
          />
          <Button
            label={t('auth.signIn', 'Ich habe schon ein Konto')}
            onPress={() => navigation.navigate('Auth', { mode: 'sign-in' })}
            variant="ghost"
            fullWidth
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20, justifyContent: 'space-between' },
  hero: { alignItems: 'center', marginTop: SCREEN_HEIGHT > 780 ? 16 : 0 },
  logo: { width: 96, height: 96 },
  highlightRow: { flexDirection: 'row', alignItems: 'center' },
  highlightIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
