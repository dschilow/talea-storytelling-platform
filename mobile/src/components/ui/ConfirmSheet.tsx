import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';


import { useTheme } from '@/theme/ThemeProvider';
import { Button } from './Button';
import { Sheet, type SheetRef } from './Sheet';
import { Text } from './Text';

interface ConfirmSheetProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Destructive-action confirmation.
 *
 * Deliberately a sheet rather than `Alert.alert`: it keeps the app's typography
 * and theming (including dark mode), and puts the buttons within thumb reach
 * instead of centred on the screen.
 */
export function ConfirmSheet({
  open,
  title,
  message,
  confirmLabel = 'Bestätigen',
  cancelLabel = 'Abbrechen',
  destructive,
  loading,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const { spacing } = useTheme();
  const sheetRef = useRef<SheetRef>(null);

  useEffect(() => {
    if (open) {
      sheetRef.current?.expand();
    } else {
      sheetRef.current?.close();
    }
  }, [open]);

  return (
    <Sheet ref={sheetRef} snapPoints={['34%']} scrollable={false} onClose={onCancel} enablePanDownToClose>
      <View style={{ gap: spacing.md, paddingTop: spacing.xs }}>
        <Text variant="headingSm">{title}</Text>
        {message ? (
          <Text variant="bodySm" tone="secondary">
            {message}
          </Text>
        ) : null}

        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <Button
            label={confirmLabel}
            onPress={onConfirm}
            variant={destructive ? 'danger' : 'primary'}
            loading={loading}
            fullWidth
            hapticIntent={destructive ? 'warning' : 'medium'}
          />
          <Button label={cancelLabel} onPress={onCancel} variant="ghost" fullWidth />
        </View>
      </View>
    </Sheet>
  );
}
