import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useThemedColors } from '@/utils/theme/useThemedColors';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'outlined';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = 'default',
}) => {
  const colors = useThemedColors();

  const variantStyles = {
    default: {
      backgroundColor: colors.background.primary,
    },
    elevated: {
      backgroundColor: colors.background.primary,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    outlined: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: colors.border.medium,
    },
  };

  return (
    <View style={[styles.card, variantStyles[variant], style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
  },
});
