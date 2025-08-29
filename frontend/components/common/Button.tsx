import React from 'react';
import { Loader2 } from 'lucide-react';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows } from '../../utils/constants/spacing';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  icon,
  fullWidth = false
}) => {
  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: typography.fonts.primary,
    fontSize: typography.textStyles.label.fontSize,
    fontWeight: typography.textStyles.label.fontWeight,
    lineHeight: typography.textStyles.label.lineHeight,
    borderRadius: `${radii.lg}px`,
    border: 'none',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s cubic-bezier(0.2, 0.0, 0.0, 1.0)',
    outline: 'none',
    textDecoration: 'none',
    userSelect: 'none' as const,
    width: fullWidth ? '100%' : 'auto',
  };

  const sizeStyles = {
    sm: {
      height: '36px',
      paddingLeft: `${spacing.md}px`,
      paddingRight: `${spacing.md}px`,
    },
    md: {
      height: '48px',
      paddingLeft: `${spacing.lg}px`,
      paddingRight: `${spacing.lg}px`,
    },
    lg: {
      height: '56px',
      paddingLeft: `${spacing.xl}px`,
      paddingRight: `${spacing.xl}px`,
    },
  };

  const variantStyles = {
    primary: {
      backgroundColor: colors.primary,
      color: colors.textInverse,
      boxShadow: shadows.md,
    },
    secondary: {
      backgroundColor: colors.secondary,
      color: colors.textInverse,
      boxShadow: shadows.md,
    },
    outline: {
      backgroundColor: 'transparent',
      color: colors.primary,
      border: `2px solid ${colors.primary}`,
      boxShadow: 'none',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: colors.primary,
      boxShadow: 'none',
    },
  };

  const hoverStyles = {
    primary: {
      backgroundColor: colors.primaryVariant,
      boxShadow: shadows.sm,
      transform: 'translateY(-1px)',
    },
    secondary: {
      backgroundColor: '#FF4A6B',
      boxShadow: shadows.sm,
      transform: 'translateY(-1px)',
    },
    outline: {
      backgroundColor: colors.surface,
      transform: 'translateY(-1px)',
    },
    ghost: {
      backgroundColor: colors.surface,
      transform: 'translateY(-1px)',
    },
  };

  const disabledStyles = {
    opacity: 0.5,
    transform: 'none',
    boxShadow: 'none',
  };

  const activeStyles = {
    transform: 'translateY(0px) scale(0.98)',
  };

  const buttonStyle = {
    ...baseStyles,
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...(disabled || loading ? disabledStyles : {}),
  };

  return (
    <button
      style={buttonStyle}
      onClick={onPress}
      disabled={disabled || loading}
      className={`button-${variant} ${className}`}
      onMouseEnter={(e) => {
        if (!disabled && !loading) {
          Object.assign(e.currentTarget.style, hoverStyles[variant]);
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !loading) {
          Object.assign(e.currentTarget.style, variantStyles[variant]);
        }
      }}
      onMouseDown={(e) => {
        if (!disabled && !loading) {
          Object.assign(e.currentTarget.style, { ...variantStyles[variant], ...activeStyles });
        }
      }}
      onMouseUp={(e) => {
        if (!disabled && !loading) {
          Object.assign(e.currentTarget.style, hoverStyles[variant]);
        }
      }}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin mr-2" />
      ) : (
        icon && <span style={{ marginRight: `${spacing.sm}px` }}>{icon}</span>
      )}
      {title}
    </button>
  );
};

export default Button;
