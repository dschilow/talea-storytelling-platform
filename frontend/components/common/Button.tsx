import React, { CSSProperties } from 'react';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows, animations } from '../../utils/constants/spacing';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'fun';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  fullWidth = false,
}) => {
  const getVariantStyles = (): CSSProperties => {
    const baseStyles: CSSProperties = {
      border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: `all ${animations.duration.normal} ${animations.easing.smooth}`,
      opacity: disabled ? 0.5 : 1,
    };

    switch (variant) {
      case 'primary':
        return {
          ...baseStyles,
          background: colors.gradients.primary,
          color: colors.text.inverse,
          boxShadow: shadows.colored.pink,
        };
      case 'secondary':
        return {
          ...baseStyles,
          background: colors.gradients.secondary,
          color: colors.text.inverse,
          boxShadow: shadows.colored.mint,
        };
      case 'outline':
        return {
          ...baseStyles,
          background: 'transparent',
          color: colors.text.primary,
          border: `2px solid ${colors.border.normal}`,
        };
      case 'ghost':
        return {
          ...baseStyles,
          background: 'transparent',
          color: colors.text.primary,
        };
      case 'fun':
        return {
          ...baseStyles,
          background: colors.gradients.sunset,
          color: colors.text.inverse,
          boxShadow: shadows.colored.peach,
        };
      default:
        return baseStyles;
    }
  };

  const getSizeStyles = (): CSSProperties => {
    switch (size) {
      case 'sm':
        return {
          padding: `${spacing.xs}px ${spacing.md}px`,
          ...typography.textStyles.bodySm,
          borderRadius: `${radii.md}px`,
        };
      case 'md':
        return {
          padding: `${spacing.sm}px ${spacing.lg}px`,
          ...typography.textStyles.body,
          borderRadius: `${radii.md}px`,
        };
      case 'lg':
        return {
          padding: `${spacing.md}px ${spacing.xl}px`,
          ...typography.textStyles.bodyLg,
          borderRadius: `${radii.lg}px`,
        };
      default:
        return {};
    }
  };

  const buttonStyle: CSSProperties = {
    ...getVariantStyles(),
    ...getSizeStyles(),
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    fontWeight: '600',
    width: fullWidth ? '100%' : 'auto',
  };

  return (
    <button
      onClick={onPress}
      disabled={disabled}
      style={buttonStyle}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
          if (variant === 'primary') {
            e.currentTarget.style.boxShadow = shadows.glow.pink;
          } else if (variant === 'secondary') {
            e.currentTarget.style.boxShadow = shadows.glow.mint;
          } else if (variant === 'fun') {
            e.currentTarget.style.boxShadow = '0 0 32px rgba(255, 155, 92, 0.5)';
          }
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          if (variant === 'primary') {
            e.currentTarget.style.boxShadow = shadows.colored.pink;
          } else if (variant === 'secondary') {
            e.currentTarget.style.boxShadow = shadows.colored.mint;
          } else if (variant === 'fun') {
            e.currentTarget.style.boxShadow = shadows.colored.peach;
          } else {
            e.currentTarget.style.boxShadow = 'none';
          }
        }
      }}
    >
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      <span>{title}</span>
    </button>
  );
};

export default Button;
