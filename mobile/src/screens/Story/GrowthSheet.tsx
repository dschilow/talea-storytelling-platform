import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { PartyPopper } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { traitHue, withAlpha } from '@/theme/tokens';
import { Button } from '@/components/ui/Button';
import { Sheet, type SheetRef } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { ListSection } from '@/components/ui/List';
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
 * This is the payoff of the whole loop, so it lists each changed trait with its
 * delta AND the reason the AI gave for the change — a change without an
 * explanation is meaningless to a child, and the trait contract requires the
 * description to be carried through to the UI.
 *
 * A story that produced no changes still gets an honest, non-disappointing
 * message rather than an empty sheet.
 */
export function GrowthSheet({ open, storyTitle, developments, isRepeat = false, onClose }: GrowthSheetProps) {
  const { colors, spacing } = useTheme();
  const sheetRef = useRef<SheetRef>(null);

  useEffect(() => {
    if (open) sheetRef.current?.expand();
    else sheetRef.current?.close();
  }, [open]);

  const hasChanges = !isRepeat && developments.length > 0;
  const total = hasChanges ? developments.reduce((sum, change) => sum + change.change, 0) : 0;

  return (
    <Sheet ref={sheetRef} snapPoints={hasChanges ? ['64%', '90%'] : ['44%']} onClose={onClose}>
      <View style={{ gap: spacing.lg }}>
        <View style={[styles.hero, { gap: spacing.sm }]}>
          <Animated.View entering={ZoomIn.springify().damping(13)} style={[styles.badge, { backgroundColor: colors.system.orange }]}>
            <PartyPopper size={32} color="#FFFFFF" strokeWidth={2} />
          </Animated.View>
          <Text variant="displayLg" center>
            {isRepeat ? 'Schön, nochmal!' : hasChanges ? 'Deine Helden sind gewachsen' : 'Gut gelesen!'}
          </Text>
          <Text variant="bodySm" tone="secondary" center style={{ maxWidth: 320 }}>
            {isRepeat
              ? 'Diese Geschichte kennst du schon — deine Punkte und Schätze hast du beim ersten Mal bekommen.'
              : hasChanges
                ? `„${storyTitle}“ brachte +${total} Punkte.`
                : 'Diesmal gab es keine neuen Eigenschaften — die nächste Geschichte bringt bestimmt welche.'}
          </Text>
        </View>

        {hasChanges ? (
          <ListSection separatorInset={66}>
            {developments.map((change, index) => {
              const hue = traitHue(change.trait);
              return (
                <View key={`${change.trait}-${change.subcategory ?? ''}-${index}`} style={[styles.row, { padding: spacing.base, gap: spacing.md }]}>
                  <View style={[styles.icon, { backgroundColor: withAlpha(hue, 0.14) }]}>
                    <Text style={{ fontSize: 19, lineHeight: 24 }}>{change.emoji}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.header}>
                      <Text variant="title" style={{ flex: 1 }} numberOfLines={2}>
                        {change.label}
                      </Text>
                      <Text variant="title" style={{ color: change.change > 0 ? colors.success : colors.danger }}>
                        {change.change > 0 ? `+${change.change}` : change.change}
                      </Text>
                    </View>
                    {change.description ? (
                      <Text variant="bodySm" tone="secondary">
                        {change.description}
                      </Text>
                    ) : (
                      <Text variant="caption" tone="tertiary">
                        Ohne Begründung erhalten
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </ListSection>
        ) : null}

        <Button label="Fertig" onPress={onClose} fullWidth size="lg" />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: 4 },
  badge: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  icon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
