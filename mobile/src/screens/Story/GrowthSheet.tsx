import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import Animated, { FadeInDown } from 'react-native-reanimated';
import { PartyPopper, TrendingUp } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Button } from '@/components/ui/Button';
import { Sheet, type SheetRef } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
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
 * This is the payoff of the whole loop, so it shows each changed trait with its
 * delta AND the reason the AI gave for the change — a change without an
 * explanation is meaningless to a child, and the trait contract requires the
 * description to be carried through to the UI.
 *
 * A story that produced no changes still gets an honest, non-disappointing
 * message rather than an empty sheet.
 */
export function GrowthSheet({ open, storyTitle, developments, isRepeat = false, onClose }: GrowthSheetProps) {
  const { colors, spacing, radius } = useTheme();
  const sheetRef = useRef<SheetRef>(null);

  useEffect(() => {
    if (open) sheetRef.current?.expand();
    else sheetRef.current?.close();
  }, [open]);

  const hasChanges = !isRepeat && developments.length > 0;

  return (
    <Sheet
      ref={sheetRef}
      snapPoints={hasChanges ? ['62%', '88%'] : ['44%']}
      title="Geschichte beendet"
      subtitle={storyTitle}
      onClose={onClose}
    >
      <View style={{ gap: spacing.base }}>
        <View style={[styles.hero, { gap: spacing.sm }]}>
          <View style={[styles.heroIcon, { borderRadius: radius.xxl, backgroundColor: colors.successSoft }]}>
            <PartyPopper size={26} color={colors.success} />
          </View>
          <Text variant="headingSm" center>
            {isRepeat ? 'Schön, nochmal!' : hasChanges ? 'Deine Avatare haben dazugelernt!' : 'Gut gelesen!'}
          </Text>
          <Text variant="bodySm" tone="secondary" center>
            {isRepeat
              ? 'Diese Geschichte kennst du schon — deine Punkte und Schätze hast du beim ersten Mal bekommen.'
              : hasChanges
                ? 'Diese Erlebnisse haben ihre Eigenschaften verändert.'
                : 'Diesmal gab es keine neuen Eigenschaften — die nächste Geschichte bringt bestimmt welche.'}
          </Text>
        </View>

        {hasChanges ? (
          <View style={{ gap: spacing.sm }}>
            {developments.map((change, index) => (
              <Animated.View key={`${change.trait}-${change.subcategory ?? ''}-${index}`} entering={FadeInDown.delay(index * 70)}>
                <View
                  style={[
                    styles.changeRow,
                    {
                      borderRadius: radius.md,
                      padding: spacing.md,
                      gap: spacing.md,
                      backgroundColor: colors.surface.inset,
                      borderColor: colors.border.light,
                    },
                  ]}
                >
                  <View style={[styles.emojiShell, { borderRadius: radius.sm, backgroundColor: colors.surface.primary }]}>
                    <Text variant="headingSm">{change.emoji}</Text>
                  </View>

                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={styles.changeHeader}>
                      <Text variant="label" style={{ flex: 1 }} numberOfLines={2}>
                        {change.label}
                      </Text>
                      <View style={[styles.delta, { backgroundColor: colors.successSoft, borderRadius: radius.pill }]}>
                        <TrendingUp size={11} color={colors.success} />
                        <Text variant="caption" style={{ color: colors.success }}>
                          {change.change > 0 ? `+${change.change}` : change.change}
                        </Text>
                      </View>
                    </View>

                    {change.description ? (
                      <Text variant="caption" tone="secondary">
                        {change.description}
                      </Text>
                    ) : (
                      <Text variant="caption" tone="muted">
                        Ohne Begründung erhalten
                      </Text>
                    )}
                  </View>
                </View>
              </Animated.View>
            ))}
          </View>
        ) : null}

        <Button label="Weiter" onPress={onClose} fullWidth size="lg" style={{ marginTop: spacing.sm }} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: 8 },
  heroIcon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  changeRow: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: StyleSheet.hairlineWidth },
  emojiShell: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  changeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2 },
});
