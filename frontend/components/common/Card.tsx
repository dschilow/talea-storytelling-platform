import React from 'react';
import { colors } from '../../utils/constants/colors';
import { spacing, radii, shadows } from '../../utils/constants/spacing';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'outlined' | 'playful' | 'glass';
  padding?: keyof typeof spacing;
  onPress?: () => void;
  style?: React.CSSProperties;
}

const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default',
  padding = 'lg',
  onPress,
  style = {}
}) => {
  const baseStyles: React.CSSProperties = {
    borderRadius: `${radii.xl}px`,
    transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
    padding: `${spacing[padding]}px`,
    cursor: onPress ? 'pointer' : 'default',
    userSelect: 'none',
    position: 'relative',
    overflow: 'hidden',
    ...style,
  };

  const glassStyles: React.CSSProperties = {
    background: colors.glass.background,
    border: `1px solid ${colors.glass.border}`,
    boxShadow: colors.glass.shadow,
    backdropFilter: 'blur(18px) saturate(160%)',
    WebkitBackdropFilter: 'blur(18px) saturate(160%)',
  };

  const variantStyles = {
    default: {
      backgroundColor: colors.surface,
      border: `1px solid ${colors.border}`,
    },
    elevated: {
      // Adopt subtle glass effect for elevated cards
      ...glassStyles,
    },
    outlined: {
      backgroundColor: colors.elevatedSurface,
      border: `2px solid ${colors.border}`,
    },
    playful: {
      // Playful with glass warmth
      ...glassStyles,
      background: colors.glass.warmBackground,
      border: `1px solid ${colors.glass.border}`,
      boxShadow: shadows.soft,
    },
    glass: {
      ...glassStyles,
    },
  };

  const hoverStyles = onPress ? {
    transform: 'translateY(-4px) scale(1.02)',
    boxShadow: shadows.lg,
  } : {};

  const activeStyles = onPress ? {
    transform: 'translateY(-1px) scale(0.98)',
  } : {};

  const cardStyle = {
    ...baseStyles,
    ...variantStyles[variant],
  };

  const Component = onPress ? 'button' : 'div';

  return (
    <Component
      style={cardStyle}
      onClick={onPress}
      className={className}
      onMouseEnter={(e) => {
        if (onPress) {
          Object.assign(e.currentTarget.style, { ...cardStyle, ...hoverStyles });
        }
      }}
      onMouseLeave={(e) => {
        if (onPress) {
          Object.assign(e.currentTarget.style, cardStyle);
        }
      }}
      onMouseDown={(e) => {
        if (onPress) {
          Object.assign(e.currentTarget.style, { ...cardStyle, ...activeStyles });
        }
      }}
      onMouseUp={(e) => {
        if (onPress) {
          Object.assign(e.currentTarget.style, { ...cardStyle, ...hoverStyles });
        }
      }}
    >
      {/* Glossy highlight */}
      {(variant === 'glass' || variant === 'elevated' || variant === 'playful') && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '-20%',
            right: '-20%',
            height: '80px',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.0) 100%)',
            filter: 'blur(8px)',
            pointerEvents: 'none',
          }}
        />
      )}
      {children}
    </Component>
  );
};

export default Card;
