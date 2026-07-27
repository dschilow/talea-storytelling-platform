import React, { forwardRef, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: TextInputProps['style'];
  /** Renders a taller multi-line field. */
  multilineRows?: number;
  /** Shows a live `used/max` counter. Requires maxLength. */
  showCounter?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    hint,
    error,
    icon,
    trailing,
    containerStyle,
    inputStyle,
    multilineRows,
    showCounter,
    value,
    maxLength,
    onFocus,
    onBlur,
    ...rest
  },
  ref
) {
  const { colors, spacing, radius, type } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? colors.dangerBorder : focused ? colors.border.accent : colors.border.soft;

  return (
    <View style={[{ gap: spacing.xs }, containerStyle]}>
      {label ? (
        <Text variant="labelSm" tone="secondary">
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.field,
          {
            borderRadius: radius.md,
            borderColor,
            borderWidth: focused || error ? 1.4 : StyleSheet.hairlineWidth,
            backgroundColor: colors.surface.inset,
            paddingHorizontal: spacing.md,
            minHeight: multilineRows ? 22 * multilineRows + 24 : 50,
            alignItems: multilineRows ? 'flex-start' : 'center',
            paddingVertical: multilineRows ? spacing.md : 0,
          },
        ]}
      >
        {icon ? <View style={{ marginRight: spacing.sm }}>{icon}</View> : null}

        <TextInput
          ref={ref}
          value={value}
          maxLength={maxLength}
          multiline={Boolean(multilineRows)}
          numberOfLines={multilineRows}
          textAlignVertical={multilineRows ? 'top' : 'center'}
          placeholderTextColor={colors.text.muted}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            styles.input,
            type.body,
            { color: colors.text.primary },
            multilineRows ? { height: 22 * multilineRows } : null,
            inputStyle,
          ]}
          {...rest}
        />

        {trailing ? <View style={{ marginLeft: spacing.sm }}>{trailing}</View> : null}
      </View>

      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="tertiary">
          {hint}
        </Text>
      ) : null}

      {showCounter && maxLength ? (
        <Text variant="caption" tone="muted" style={{ alignSelf: 'flex-end' }}>
          {(value?.length ?? 0).toString()}/{maxLength}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { flexDirection: 'row' },
  input: { flex: 1, padding: 0, margin: 0 },
});
