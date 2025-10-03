import React from 'react';
import { motion } from 'framer-motion';
import { colors } from '../../utils/constants/colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'fun' | 'magic' | 'sage' | 'blush' | 'honey' | 'lilac' | 'ocean';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  icon?: React.ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'sage',
  size = 'md',
  icon,
  disabled = false,
  fullWidth = false,
  className = '',
}) => {
  // 🎨 Variant-Styles mit den neuen Farben
  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: colors.gradients.primary,
      color: colors.text.inverse,
      boxShadow: colors.effects.shadow.md,
      border: 'none',
    },
    sage: {
      background: colors.gradients.primary,
      color: colors.text.inverse,
      boxShadow: colors.effects.shadow.md,
      border: 'none',
    },
    blush: {
      background: colors.blush[400],
      color: colors.text.inverse,
      boxShadow: colors.effects.shadow.md,
      border: 'none',
    },
    honey: {
      background: colors.honey[400],
      color: colors.text.primary,
      boxShadow: colors.effects.shadow.md,
      border: 'none',
    },
    lilac: {
      background: colors.lilac[400],
      color: colors.text.inverse,
      boxShadow: colors.effects.shadow.md,
      border: 'none',
    },
    ocean: {
      background: colors.ocean[400],
      color: colors.text.inverse,
      boxShadow: colors.effects.shadow.md,
      border: 'none',
    },
    secondary: {
      background: colors.gradients.nature,
      color: colors.text.inverse,
      boxShadow: colors.effects.shadow.md,
      border: 'none',
    },
    magic: {
      background: colors.gradients.bloom,
      color: colors.text.inverse,
      boxShadow: colors.effects.shadow.lg,
      border: 'none',
    },
    outline: {
      background: 'transparent',
      color: colors.text.primary,
      border: `2px solid ${colors.border.accent}`,
      boxShadow: 'none',
    },
    ghost: {
      background: 'transparent',
      color: colors.text.secondary,
      border: 'none',
      boxShadow: 'none',
    },
    fun: {
      background: colors.gradients.sunset,
      color: colors.text.inverse,
      boxShadow: colors.effects.shadow.md,
      border: 'none',
    },
  };

  // 📏 Size-Styles
  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: {
      padding: '8px 16px',
      fontSize: '14px',
      borderRadius: '16px',
    },
    md: {
      padding: '12px 24px',
      fontSize: '16px',
      borderRadius: '20px',
    },
    lg: {
      padding: '16px 32px',
      fontSize: '18px',
      borderRadius: '24px',
    },
    xl: {
      padding: '20px 40px',
      fontSize: '20px',
      borderRadius: '28px',
    },
  };

  const buttonStyle: React.CSSProperties = {
    ...variantStyles[variant],
    ...sizeStyles[size],
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontWeight: '700',
    fontFamily: '"Fredoka", "Nunito", sans-serif',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    width: fullWidth ? '100%' : 'auto',
    position: 'relative',
    overflow: 'hidden',
  };

  // ✨ Framer Motion Animationen
  const buttonVariants = {
    rest: {
      scale: 1,
      y: 0,
    },
    hover: {
      scale: 1.05,
      y: -2,
      transition: {
        duration: 0.2,
        ease: "easeOut",
      },
    },
    tap: {
      scale: 0.95,
      y: 0,
      transition: {
        duration: 0.1,
        ease: "easeIn",
      },
    },
  };

  // 🌟 Icon Animation
  const iconVariants = {
    rest: {
      rotate: 0,
      scale: 1,
    },
    hover: {
      rotate: [0, -10, 10, -5, 5, 0],
      scale: 1.1,
      transition: {
        duration: 0.5,
        ease: "easeInOut",
      },
    },
  };

  return (
    <motion.button
      onClick={disabled ? undefined : onPress}
      disabled={disabled}
      style={buttonStyle}
      className={`focus-ring ${className}`}
      variants={buttonVariants}
      initial="rest"
      whileHover={!disabled ? "hover" : "rest"}
      whileTap={!disabled ? "tap" : "rest"}
    >
      {/* ✨ Schimmer-Effekt bei Hover */}
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: '-100%',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
        }}
        initial={{ left: '-100%' }}
        whileHover={{
          left: '100%',
          transition: {
            duration: 0.6,
            ease: "easeInOut",
          },
        }}
      />

      {icon && (
        <motion.span
          variants={iconVariants}
          style={{ display: 'flex', alignItems: 'center', zIndex: 1 }}
        >
          {icon}
        </motion.span>
      )}
      
      <span style={{ zIndex: 1 }}>{title}</span>
    </motion.button>
  );
};

export default Button;
