import * as React from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { colors } from '../../utils/constants/colors';

type ButtonVariant = 'default' | 'sage' | 'blush' | 'honey' | 'lilac' | 'ocean' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ModernButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const ModernButton = React.forwardRef<HTMLButtonElement, ModernButtonProps>(
  ({ variant = 'default', size = 'md', icon, children, className = '', style, type = 'button', ...props }, ref) => {
    const reduceMotion = useReducedMotion();
    const getVariantStyles = (): React.CSSProperties => {
      const base: React.CSSProperties = {
        border: 'none',
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.5 : 1,
      };

      switch (variant) {
        case 'sage':
          return {
            ...base,
            background: colors.sage[400],
            color: 'var(--talea-brand-brown)',
            boxShadow: colors.effects.shadow.md,
          };
        case 'blush':
          return {
            ...base,
            background: colors.blush[400],
            color: 'var(--talea-brand-brown)',
            boxShadow: colors.effects.shadow.md,
          };
        case 'honey':
          return {
            ...base,
            background: colors.honey[400],
            color: 'var(--talea-brand-brown)',
            boxShadow: colors.effects.shadow.md,
          };
        case 'lilac':
          return {
            ...base,
            background: colors.lilac[400],
            color: 'var(--talea-brand-brown)',
            boxShadow: colors.effects.shadow.md,
          };
        case 'ocean':
          return {
            ...base,
            background: colors.ocean[400],
            color: 'var(--talea-brand-brown)',
            boxShadow: colors.effects.shadow.md,
          };
        case 'outline':
          return {
            ...base,
            background: 'transparent',
            color: colors.text.primary,
            border: `2px solid ${colors.border.accent}`,
          };
        case 'ghost':
          return {
            ...base,
            background: 'transparent',
            color: colors.text.secondary,
          };
        default:
          return {
            ...base,
            background: 'var(--talea-gradient-brand)',
            color: 'var(--primary-foreground)',
            boxShadow: colors.effects.shadow.md,
          };
      }
    };

    const getSizeStyles = (): React.CSSProperties => {
      switch (size) {
        case 'sm':
          return {
            padding: '8px 16px',
            fontSize: '14px',
            borderRadius: '16px',
            minHeight: '44px',
          };
        case 'lg':
          return {
            padding: '16px 32px',
            fontSize: '18px',
            borderRadius: '24px',
            minHeight: '56px',
          };
        default:
          return {
            padding: '12px 24px',
            fontSize: '16px',
            borderRadius: '20px',
            minHeight: '48px',
          };
      }
    };

    const buttonStyle: React.CSSProperties = {
      ...getVariantStyles(),
      ...getSizeStyles(),
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      fontWeight: '600',
      fontFamily: 'var(--talea-font-ui)',
      position: 'relative',
      overflow: 'hidden',
    };

    return (
      <motion.button
        {...props}
        ref={ref}
        type={type}
        style={{ ...buttonStyle, ...style }}
        className={`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${className}`}
        whileHover={!props.disabled && !reduceMotion ? { y: -2 } : undefined}
        whileTap={!props.disabled && !reduceMotion ? { scale: 0.98 } : undefined}
        transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      >
        {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
        <span>{children}</span>
      </motion.button>
    );
  }
);

ModernButton.displayName = 'ModernButton';

