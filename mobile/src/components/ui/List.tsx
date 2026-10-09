import React, { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Touchable } from './Pressable';
import { Text } from './Text';

/** Rounded-square icon tile, as in iOS Settings rows. */
export function IconSquircle({ color, children, size = 30 }: { color: string; children: ReactNode; size?: number }) {
  return (
    <View style={[styles.squircle, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: color }]}>{children}</View>
  );
}

interface ListSectionProps {
  header?: string;
  footer?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Left inset of the separators — aligns them with the row text, past the icon. */
  separatorInset?: number;
}

/**
 * Inset grouped list section: rows on one rounded surface, separated by
 * hairlines that start at the text column.
 */
export function ListSection({ header, footer, children, style, separatorInset = 16 }: ListSectionProps) {
  const { colors, radius, spacing } = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);

  return (
    <View style={[{ gap: 6 }, style]}>
      {header ? (
        <Text variant="labelSm" tone="secondary" style={{ paddingHorizontal: spacing.base, textTransform: 'uppercase' }}>
          {header}
        </Text>
      ) : null}
      <View style={{ borderRadius: radius.lg, backgroundColor: colors.surface.primary, overflow: 'hidden' }}>
        {rows.map((row, index) => (
          <Fragment key={row.key ?? index}>
            {index > 0 ? <View style={[styles.separator, { marginLeft: separatorInset, backgroundColor: colors.border.light }]} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? (
        <Text variant="caption" tone="secondary" style={{ paddingHorizontal: spacing.base }}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Leading element, usually an <IconSquircle>. */
  leading?: ReactNode;
  /** Secondary value shown before the chevron. */
  value?: string;
  /** Replaces the chevron. Pass null for none. */
  trailing?: ReactNode | null;
  onPress?: () => void;
  destructive?: boolean;
  children?: ReactNode;
}

/** One row of an inset grouped list. */
export function ListRow({ title, subtitle, leading, value, trailing, onPress, destructive, children }: ListRowProps) {
  const { colors, spacing } = useTheme();
  const chevron = onPress && trailing === undefined ? <ChevronRight size={18} color={colors.text.muted} strokeWidth={2.4} /> : trailing;

  const body = (
    <View style={[styles.row, { paddingHorizontal: spacing.base, gap: spacing.md }]}>
      {leading}
      <View style={styles.text}>
        <Text variant="bodyLg" style={destructive ? { color: colors.danger } : undefined} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="secondary" numberOfLines={3}>
            {subtitle}
          </Text>
        ) : null}
        {children}
      </View>
      {value ? (
        <Text variant="bodyLg" tone="secondary" numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {chevron ?? null}
    </View>
  );

  if (!onPress) return body;

  return (
    <Touchable onPress={onPress} pressScale={1} pressOpacity={0.6} accessibilityRole="button" accessibilityLabel={title}>
      {body}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  squircle: { alignItems: 'center', justifyContent: 'center' },
  separator: { height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: 10 },
  text: { flex: 1, gap: 2 },
});
