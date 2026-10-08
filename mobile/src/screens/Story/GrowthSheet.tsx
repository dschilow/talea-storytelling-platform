import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { PartyPopper, TrendingUp } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { traitHue, withAlpha } from '@/theme/tokens';
import { Button } from '@/components/ui/Button';
import { Gradient } from '@/components/ui/Gradient';
import { Sheet, type SheetRef } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { Glow } from '@/components/fx/Glow';
import { SparkleField } from '@/components/fx/Sparkles';
import type { TraitChange } from '@/lib/personality';

interface GrowthSheetProps {
  open: boolean;
  storyTitle: string;
  developments: TraitChange[];
  /**
   * The story had already been finished before. Every reward was granted on
   * that first completion, so the sheet must not show trait points again.
   */
  isRepeat?: boolean;
  onClose: () => void;
}

/**
 * Post-story growth summary.
 *
 * This is the payoff of the whole loop, so it shows each changed trait in its
 * own colour with the delta AND the reason the AI gave for the change — a change
 * without an explanation is meaningless to a child, and the trait contract
 * requires the description to be carried through to the UI.
 *
 * A story that produced no changes still gets an honest, non-disappointing
 * message rather than an empty sheet.
 */
export function GrowthSheet({ open, storyTitle, developments, isRepeat = false, onClose }: GrowthSheetProps) {
  const { colors, spacing, radius, shadows } = useTheme();
  const sheetRef = useRef<SheetRef>(null);

  useEffect(() => {
    if (open) sheetRef.current?.expand();
    else sheetRef.current?.close();
  }, [open]);

  const hasChanges = !isRepeat && developments.length > 0;
  const total = hasChanges ? developments.reduce((sum, change) => sum + change.change, 0) : 0;

  return (
    <Sheet
      ref={sheetRef}
      snapPoints={hasChanges ? ['64%', '90%'] : ['46%']}
      title="Geschichte beendet"
      subtitle={storyTitle}
      onClose={onClose}
    >
      <View style={{ gap: spacing.lg }}>
        <View style={[styles.hero, { gap: spacing.sm }]}>
          <View style={styles.orbStage}>
            <Glow color="rgba(244, 172, 50, 0.42)" size={190} />
            <SparkleField width={150} height={130} count={8} color={colors.gold} seed={41} minSize={6} maxSize={12} />
            <Animated.View entering={ZoomIn.springify().damping(11)} style={[styles.orb, shadows.glow]}>
              <Gradient token={colors.gradient.gold} style={[StyleSheet.absoluteFill, { borderRadius: 40 }]} />
              <PartyPopper size={34} color="#4A2F00" strokeWidth={2.2} />
            </Animated.View>
          </View>
          <Text variant="displaySm" center>
            {isRepeat ? 'Schön, nochmal!' : hasChanges ? 'Deine Helden sind gewachsen!' : 'Gut gelesen!'}
          </Text>
          <Text variant="bodySm" tone="secondary" center style={{ maxWidth: 320 }}>
            {isRepeat
              ? 'Diese Geschichte kennst du schon — deine Punkte und Schätze hast du beim ersten Mal bekommen.'
              : hasChanges
                ? `+${total} Punkte verteilt auf ${developments.length} ${developments.length === 1 ? 'Eigenschaft' : 'Eigenschaften'}. Hier ist, warum.`
                : 'Diesmal gab es keine neuen Eigenschaften — die nächste Geschichte bringt bestimmt welche.'}
          </Text>
        </View>

        {hasChanges ? (
          <View style={{ gap: spacing.sm }}>
            {developments.map((change, index) => {
              const hue = traitHue(change.trait);
              return (
                <Animated.View key={`${change.trait}-${change.subcategory ?? ''}-${index}`} entering={FadeInDown.delay(index * 70)}>
                  <View
                    style={[
                      styles.changeRow,
                      shadows.soft,
                      {
                        borderRadius: radius.lg,
                        padding: spacing.md,
                        gap: spacing.md,
                        backgroundColor: colors.surface.primary,
                        borderColor: withAlpha(hue, 0.28),
                      },
                    ]}
                  >
                    <View style={[styles.emojiShell, { borderRadius: radius.md, backgroundColor: withAlpha(hue, 0.14) }]}>
                      <Text style={{ fontSize: 21, lineHeight: 26 }}>{change.emoji}</Text>
                    </View>

                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={styles.changeHeader}>
                        <Text variant="title" style={{ flex: 1 }} numberOfLines={2}>
                          {change.label}
                        </Text>
                        <View style={[styles.delta, { backgroundColor: withAlpha(hue, 0.14), borderRadius: radius.pill }]}>
                          <TrendingUp size={12} color={hue} strokeWidth={2.6} />
                          <Text variant="labelSm" weight="extrabold" style={{ color: hue }}>
                            {change.change > 0 ? `+${change.change}` : change.change}
                          </Text>
                        </View>
                      </View>

                      {change.description ? (
                        <Text variant="bodySm" tone="secondary" style={{ fontStyle: 'italic' }}>
                          „{change.description}“
                        </Text>
                      ) : (
                        <Text variant="caption" tone="muted">
                          Ohne Begründung erhalten
                        </Text>
                      )}
                    </View>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        ) : null}

        <Button label="Weiter" onPress={onClose} fullWidth size="lg" />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: 4 },
  orbStage: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  orb: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  changeRow: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1 },
  emojiShell: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  changeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4 },
});
