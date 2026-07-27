import React, { forwardRef, useCallback, useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
  type BottomSheetProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

interface SheetProps extends Partial<Omit<BottomSheetProps, 'children' | 'snapPoints'>> {
  children: ReactNode;
  snapPoints?: (string | number)[];
  title?: string;
  subtitle?: string;
  /** Wraps content in a scrollable container. Off for fixed-height sheets. */
  scrollable?: boolean;
  onClose?: () => void;
}

/**
 * Bottom sheet shell.
 *
 * Sheets replace the web's centred dialogs everywhere on mobile: they are
 * reachable one-handed, dismissible by gesture, and keep the underlying context
 * visible — which matters when a sheet is filtering or selecting from the list
 * behind it.
 */
export const Sheet = forwardRef<BottomSheet, SheetProps>(function Sheet(
  { children, snapPoints, title, subtitle, scrollable = true, onClose, ...rest },
  ref
) {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();

  const resolvedSnapPoints = useMemo(() => snapPoints ?? ['62%'], [snapPoints]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.55} pressBehavior="close" />
    ),
    []
  );

  const Container = scrollable ? BottomSheetScrollView : BottomSheetView;

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={resolvedSnapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      onClose={onClose}
      backgroundStyle={{
        backgroundColor: colors.pageSolid,
        borderTopLeftRadius: radius.xxl,
        borderTopRightRadius: radius.xxl,
      }}
      handleIndicatorStyle={{ backgroundColor: colors.border.strong, width: 40 }}
      style={styles.sheet}
      {...rest}
    >
      <Container
        style={styles.flex}
        contentContainerStyle={
          scrollable
            ? { paddingHorizontal: spacing.base, paddingBottom: insets.bottom + spacing.xl }
            : undefined
        }
      >
        {!scrollable ? (
          <View style={{ paddingHorizontal: spacing.base, paddingBottom: insets.bottom + spacing.xl, flex: 1 }}>
            {title ? <SheetHeader title={title} subtitle={subtitle} /> : null}
            {children}
          </View>
        ) : (
          <>
            {title ? <SheetHeader title={title} subtitle={subtitle} /> : null}
            {children}
          </>
        )}
      </Container>
    </BottomSheet>
  );
});

export function SheetHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ paddingBottom: spacing.base, gap: 2 }}>
      <Text variant="headingSm">{title}</Text>
      {subtitle ? (
        <Text variant="bodySm" tone="secondary">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    // Matches the elevation of the tab bar so the sheet reads as being above it.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 24,
  },
  flex: { flex: 1 },
});
