import React from 'react';
import { Loader2 } from 'lucide-react';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows } from '../../utils/constants/spacing';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'fun';
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
    transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
    outline: 'none',
    textDecoration: 'none',
    userSelect: 'none' as const,
    width: fullWidth ? '100%' : 'auto',
    position: 'relative' as const,
    overflow: 'hidden' as const,
  };

  const sizeStyles = {
    sm: {
      height: '40px',
      paddingLeft: `${spacing.lg}px`,
      paddingRight: `${spacing.lg}px`,
      fontSize: '13px',
    },
    md: {
      height: '48px',
      paddingLeft: `${spacing.xl}px`,
      paddingRight: `${spacing.xl}px`,
      fontSize: '15px',
    },
    lg: {
      height: '56px',
      paddingLeft: `${spacing.xxl}px`,
      paddingRight: `${spacing.xxl}px`,
      fontSize: '16px',
    },
  };

  const variantStyles = {
    primary: {
      background: 'linear-gradient(135deg, #FF6B9D 0%, #4ECDC4 100%)',
      color: colors.textInverse,
      boxShadow: shadows.colorful,
    },
    secondary: {
      background: 'linear-gradient(135deg, #4299E1 0%, #9F7AEA 100%)',
      color: colors.textInverse,
      boxShadow: shadows.soft,
    },
    fun: {
      background: 'linear-gradient(135deg, #FFD93D 0%, #ED8936 100%)',
      color: colors.textPrimary,
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
      transform: 'translateY(-2px) scale(1.02)',
      boxShadow: '0 12px 28px 0 rgba(255, 107, 157, 0.4)',
    },
    secondary: {
      transform: 'translateY(-2px) scale(1.02)',
      boxShadow: '0 8px 24px 0 rgba(78, 205, 196, 0.3)',
    },
    fun: {
      transform: 'translateY(-2px) scale(1.02)',
      boxShadow: '0 12px 28px 0 rgba(255, 217, 61, 0.4)',
    },
    outline: {
      backgroundColor: colors.softPink,
      transform: 'translateY(-1px)',
    },
    ghost: {
      backgroundColor: colors.softPink,
      transform: 'translateY(-1px)',
    },
  };

  const disabledStyles = {
    opacity: 0.6,
    transform: 'none',
    boxShadow: 'none',
    cursor: 'not-allowed',
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
