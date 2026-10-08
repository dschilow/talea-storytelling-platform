import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
  type BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

/**
 * The subset of the BottomSheet imperative API the app uses. Kept as its own
 * type so callers keep working after the switch from BottomSheet to
 * BottomSheetModal, whose methods are `present`/`dismiss` rather than
 * `expand`/`close`.
 */
export interface SheetRef {
  expand: () => void;
  close: () => void;
}

interface SheetProps extends Partial<Omit<BottomSheetModalProps, 'children' | 'snapPoints'>> {
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
 *
 * Built on `BottomSheetModal`, not `BottomSheet`, and this matters: a plain
 * `BottomSheet` renders inline wherever it sits in the tree. Placed inside a
 * screen's ScrollView it becomes ordinary page content — the sheet's list shows
 * up in the middle of the article instead of overlaying it. The modal variant
 * renders through a portal at the root, so a sheet can be declared next to the
 * content it belongs to without leaking into the layout.
 */
export const Sheet = forwardRef<SheetRef, SheetProps>(function Sheet(
  { children, snapPoints, title, subtitle, scrollable = true, onClose, ...rest },
  ref
) {
  const { colors, spacing, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const modalRef = useRef<BottomSheetModal>(null);

  // Callers say `expand()`/`close()`; the modal speaks `present()`/`dismiss()`.
  useImperativeHandle(
    ref,
    () => ({
      expand: () => modalRef.current?.present(),
      close: () => modalRef.current?.dismiss(),
    }),
    []
  );

  const resolvedSnapPoints = useMemo(() => snapPoints ?? ['62%'], [snapPoints]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={isDark ? 0.7 : 0.42} pressBehavior="close" />
    ),
    [isDark]
  );

  const Container = scrollable ? BottomSheetScrollView : BottomSheetView;

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={resolvedSnapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      onDismiss={onClose}
      backgroundStyle={{
        backgroundColor: isDark ? colors.surface.primary : colors.pageSolid,
        borderTopLeftRadius: SHEET_RADIUS,
        borderTopRightRadius: SHEET_RADIUS,
      }}
      handleStyle={{ paddingTop: 12, paddingBottom: 6 }}
      handleIndicatorStyle={{ backgroundColor: colors.border.strong, width: 44, height: 5, borderRadius: 3 }}
      style={[styles.sheet, { borderTopLeftRadius: SHEET_RADIUS, borderTopRightRadius: SHEET_RADIUS }]}
      {...rest}
    >
      <Container
        style={styles.flex}
        contentContainerStyle={
          scrollable ? { paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl } : undefined
        }
      >
        {!scrollable ? (
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl, flex: 1 }}>
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
    </BottomSheetModal>
  );
});

export function SheetHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ paddingTop: spacing.xs, paddingBottom: spacing.lg, gap: 4 }}>
      <Text variant="displaySm">{title}</Text>
      {subtitle ? (
        <Text variant="bodySm" tone="secondary" numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const SHEET_RADIUS = 32;

const styles = StyleSheet.create({
  sheet: {
    // Lifts the sheet off the page it covers.
    boxShadow: '0px -8px 32px rgba(20, 12, 48, 0.18)',
  },
  flex: { flex: 1 },
});
