import React from 'react';
import { Dimensions, Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { PageBackground } from '@/components/ui/PageBackground';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { Touchable } from '@/components/ui/Pressable';
import { TaleaArt } from '@/components/ui/TaleaArt';
import { Floating } from '@/components/fx/Motion';
import { SparkleField } from '@/components/fx/Sparkles';
import { Glow } from '@/components/fx/Glow';
import { useAmbientMotion } from '@/components/fx/useAmbientMotion';
import type { WizardAssetGroup } from '@/hooks/useWizardAssets';
import type { RootStackParamList } from '@/navigation/types';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

type Nav = NativeStackNavigationProp<RootStackParamList>;

const HIGHLIGHTS: { art: [WizardAssetGroup, string]; title: string; body: string }[] = [
  {
    art: ['character', 'fairy'],
    title: 'Avatare, die mitwachsen',
    body: 'Jede Geschichte verändert Wissen, Mut und Neugier deines Avatars.',
  },
  {
    art: ['storyCategory', 'fairy-tales'],
    title: 'Geschichten in Minuten',
    body: 'Genre, Alter und Stimmung wählen — Talea schreibt und illustriert.',
  },
  {
    art: ['navTab', 'stories'],
    title: 'Zum Vorlesen',
    body: 'Jede Geschichte wird zur Hörfassung — auch offline.',
  },
  {
    art: ['dokuDomain', 'space'],
    title: 'Spielerisch lernen',
    body: 'Quizze, Dokus und eine Lernkarte, die den Fortschritt zeigt.',
  },
];

/**
 * Signed-out entry point.
 *
 * The web landing page is a long marketing scroll; on mobile the job is
 * different — get an already-convinced user into the app in one tap, and give a
 * new user just enough to understand what Talea is. It is staged on the night
 * sky so the brand's gradient and the watercolour art glow.
 */
export function LandingScreen() {
  const { colors, spacing, radius, brand } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const ambient = useAmbientMotion();

  return (
    <View style={[styles.container, { backgroundColor: colors.pageSolid }]}>
      <PageBackground variant="night" animated />

      <View style={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}>
        <Animated.View entering={FadeInDown.duration(560)} style={[styles.hero, { gap: spacing.md, marginTop: SCREEN_HEIGHT > 780 ? 12 : 0 }]}>
          <View style={styles.logoStage}>
            <Glow color="rgba(122, 82, 255, 0.55)" size={220} />
            <SparkleField width={200} height={170} count={9} color="#FFE6A6" seed={31} minSize={5} maxSize={11} active={ambient} />
            <Floating active={ambient} amplitude={5} period={4200}>
              <Image source={require('../../../assets/talea-logo.png')} style={styles.logo} resizeMode="contain" />
            </Floating>
          </View>

          <Text variant="overline" style={{ color: brand.goldLight }}>
            Geschichten · Avatare · Wissen
          </Text>
          {/* Hero copy is German-only, matching the web landing page — the
              marketing copy has never been in the shared locale bundles. Using
              t() here would imply a translation that does not exist. */}
          <Text variant="hero" tone="media" center style={{ maxWidth: SCREEN_WIDTH - 56 }}>
            Geschichten, die mit deinem Kind wachsen
          </Text>
          <Text variant="bodyLg" center style={{ color: 'rgba(255,255,255,0.8)', maxWidth: 330 }}>
            Erschafft gemeinsam Avatare, erlebt personalisierte Abenteuer und seht zu, wie Persönlichkeit entsteht.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(180).duration(520)} style={{ gap: spacing.sm }}>
          {HIGHLIGHTS.map((highlight) => (
            <View
              key={highlight.title}
              style={[
                styles.highlight,
                {
                  borderRadius: radius.lg,
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderColor: 'rgba(255, 255, 255, 0.14)',
                  padding: spacing.sm + 2,
                  gap: spacing.md,
                },
              ]}
            >
              <View style={[styles.highlightArt, { borderRadius: radius.md, backgroundColor: 'rgba(255, 255, 255, 0.9)' }]}>
                <TaleaArt group={highlight.art[0]} id={highlight.art[1]} size={50} fallback={null} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="label" tone="media">
                  {highlight.title}
                </Text>
                <Text variant="caption" style={{ color: 'rgba(255,255,255,0.74)' }}>
                  {highlight.body}
                </Text>
              </View>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(320).duration(520)} style={{ gap: spacing.sm }}>
          <Button
            label={t('auth.signUp', 'Kostenlos starten')}
            onPress={() => navigation.navigate('Auth', { mode: 'sign-up' })}
            size="lg"
            fullWidth
          />
          <Touchable
            onPress={() => navigation.navigate('Auth', { mode: 'sign-in' })}
            style={[styles.signIn, { borderRadius: radius.pill }]}
            accessibilityRole="button"
            accessibilityLabel={t('auth.signIn', 'Ich habe schon ein Konto')}
          >
            <Text variant="label" tone="media" style={{ opacity: 0.9 }}>
              {t('auth.signIn', 'Ich habe schon ein Konto')}
            </Text>
          </Touchable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20, justifyContent: 'space-between' },
  hero: { alignItems: 'center' },
  logoStage: { width: 200, height: 150, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 112, height: 112 },
  highlight: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  highlightArt: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  signIn: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 20 },
});
