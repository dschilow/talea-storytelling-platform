import * as React from 'react';
import { motion } from 'framer-motion';
import { colors } from '../../utils/constants/colors';

type ButtonVariant = 'default' | 'sage' | 'blush' | 'honey' | 'lilac' | 'ocean' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ModernButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const ModernButton = React.forwardRef<HTMLButtonElement, ModernButtonProps>(
  ({ variant = 'default', size = 'md', icon, children, className = '', ...props }, ref) => {
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
            background: colors.gradients.primary,
            color: colors.text.inverse,
            boxShadow: colors.effects.shadow.md,
          };
        case 'blush':
          return {
            ...base,
            background: colors.blush[400],
            color: colors.text.inverse,
            boxShadow: colors.effects.shadow.md,
          };
        case 'honey':
          return {
            ...base,
            background: colors.honey[400],
            color: colors.text.primary,
            boxShadow: colors.effects.shadow.md,
          };
        case 'lilac':
          return {
            ...base,
            background: colors.lilac[400],
            color: colors.text.inverse,
            boxShadow: colors.effects.shadow.md,
          };
        case 'ocean':
          return {
            ...base,
            background: colors.ocean[400],
            color: colors.text.inverse,
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
            background: colors.gradients.primary,
            color: colors.text.inverse,
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
            height: '36px',
          };
        case 'lg':
          return {
            padding: '16px 32px',
            fontSize: '18px',
            borderRadius: '24px',
            height: '56px',
          };
        default:
          return {
            padding: '12px 24px',
            fontSize: '16px',
            borderRadius: '20px',
            height: '44px',
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
      fontFamily: '"Nunito", sans-serif',
      position: 'relative',
      overflow: 'hidden',
    };

    return (
      <motion.button
        ref={ref}
        style={buttonStyle}
        className={`focus-ring ${className}`}
        whileHover={!props.disabled ? { scale: 1.05, y: -2 } : {}}
        whileTap={!props.disabled ? { scale: 0.95 } : {}}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        {...props}
      >
        {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
        <span>{children}</span>
      </motion.button>
    );
  }
);

ModernButton.displayName = 'ModernButton';

