import React from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute, type CompositeNavigationProp, type RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Gamepad2 } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Touchable } from '@/components/ui/Pressable';
import { Text } from '@/components/ui/Text';
import { CoverImage } from '@/components/ui/CoverImage';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { QuizScreen } from '@/screens/Quiz/QuizScreen';
import type { RootStackParamList, TabParamList } from '@/navigation/types';

type HubNav = CompositeNavigationProp<BottomTabNavigationProp<TabParamList, 'Spiel'>, NativeStackNavigationProp<RootStackParamList>>;
const GAMES = [
  { id: 'alibi', title: 'Mitternachts-Alibi', sub: 'Krimi-Partyspiel · 4–8 Spieler', art: 'alibi' },
  { id: 'quiz', title: 'Wissens-Quiz', sub: 'Fragen aus den Dokus · allein', art: 'quiz' },
] as const;

/** The web's Spielezimmer: one navigation entry, with Alibi and Quiz tabs. */
export function GameHubScreen() {
  const { colors, spacing, radius } = useTheme();
  const navigation = useNavigation<HubNav>();
  const route = useRoute<RouteProp<TabParamList, 'Spiel'>>();
  const selected = route.params?.tab === 'quiz' ? 'quiz' : 'alibi';
  return (
    <Screen scroll={false} padded={false} header={<ScreenHeader title="Spiel" subtitle="Rätseln, raten, lachen: zusammen am Tisch oder allein mit dem Quiz." large showBack={false} />}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.base, paddingBottom: spacing.base }}>
        {GAMES.map(game => (
          <Touchable key={game.id} accessibilityRole="tab" accessibilityState={{ selected: selected === game.id }}
            accessibilityLabel={`${game.title}, ${game.sub}`} onPress={() => navigation.setParams({ tab: game.id })}
            style={{ flex: 1, minHeight: 48, padding: spacing.sm, gap: spacing.sm, borderRadius: radius.lg,
              borderWidth: 2, borderColor: selected === game.id ? colors.primary : colors.border.light,
              backgroundColor: selected === game.id ? colors.surface.item : colors.surface.primary }}>
            <CoverImage uri={`file:///android_asset/alibi/game/keyart/${game.art}.webp`} style={{ height: 76 }} radius={radius.md} />
            <Text variant="label" weight="bold">{game.title}</Text>
            <Text variant="caption" tone="secondary">{game.sub}</Text>
          </Touchable>
        ))}
      </View>
      {selected === 'quiz' ? <QuizScreen embedded /> : (
        <Screen topInset={false} tabBarClearance playerClearance>
          <Card padded={false}>
            <CoverImage uri="file:///android_asset/alibi/game/keyart/alibi.webp" style={{ height: 190 }} radius={0} />
            <View style={{ padding: spacing.base, gap: spacing.md }}>
              <Text variant="headingSm">Mitternachts-Alibi</Text>
              <Text tone="secondary">Findet den Dieb in Kicherwald. Spielt zusammen an einem Handy, hört geheime Aussagen und entlarvt das falsche Alibi.</Text>
              <Text variant="labelSm" tone="secondary">4–8 Spieler · ab 5 Jahren · ein Handy</Text>
              <Button label="Mitternachts-Alibi spielen" onPress={() => navigation.navigate('Alibi')}
                icon={<Gamepad2 size={20} color={colors.primaryForeground} />} fullWidth />
            </View>
          </Card>
        </Screen>
      )}
    </Screen>
  );
}
