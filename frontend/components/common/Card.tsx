import React from 'react';
import { colors } from '../../utils/constants/colors';
import { spacing, radii, shadows } from '../../utils/constants/spacing';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'outlined' | 'playful';
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

  const variantStyles = {
    default: {
      backgroundColor: colors.surface,
      border: `1px solid ${colors.border}`,
    },
    elevated: {
      backgroundColor: colors.elevatedSurface,
      boxShadow: shadows.md,
    },
    outlined: {
      backgroundColor: colors.elevatedSurface,
      border: `2px solid ${colors.border}`,
    },
    playful: {
      background: 'linear-gradient(135deg, #FFF8F3 0%, #FFFFFF 100%)',
      border: `2px solid ${colors.softPink}`,
      boxShadow: shadows.soft,
    },
  };

  const hoverStyles = onPress ? {
    transform: 'translateY(-4px) scale(1.02)',
    boxShadow: variant === 'elevated' ? shadows.lg : 
               variant === 'playful' ? shadows.colorful : shadows.md,
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
      {children}
    </Component>
  );
};

export default Card;
