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
  const { colors, spacing, radius } = useTheme();
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
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.55} pressBehavior="close" />
    ),
    []
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
          scrollable ? { paddingHorizontal: spacing.base, paddingBottom: insets.bottom + spacing.xl } : undefined
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
    </BottomSheetModal>
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
