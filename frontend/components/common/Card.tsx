import React from 'react';
import { colors } from '../../utils/constants/colors';
import { spacing, radii, shadows } from '../../utils/constants/spacing';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'outlined';
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
    borderRadius: `${radii.lg}px`,
    transition: 'all 0.2s cubic-bezier(0.2, 0.0, 0.0, 1.0)',
    padding: `${spacing[padding]}px`,
    cursor: onPress ? 'pointer' : 'default',
    userSelect: 'none',
    ...style,
  };

  const variantStyles = {
    default: {
      backgroundColor: colors.surface,
    },
    elevated: {
      backgroundColor: colors.elevatedSurface,
      boxShadow: shadows.md,
    },
    outlined: {
      backgroundColor: colors.elevatedSurface,
      border: `1px solid ${colors.border}`,
    },
  };

  const hoverStyles = onPress ? {
    transform: 'translateY(-2px) scale(1.02)',
    boxShadow: variant === 'elevated' ? shadows.lg : shadows.md,
  } : {};

  const activeStyles = onPress ? {
    transform: 'translateY(0px) scale(0.98)',
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
