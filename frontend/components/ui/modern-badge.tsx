import * as React from 'react';
import { colors } from '../../utils/constants/colors';

type BadgeVariant = 'sage' | 'blush' | 'honey' | 'lilac' | 'ocean' | 'peach' | 'outline';

interface ModernBadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export const ModernBadge: React.FC<ModernBadgeProps> = ({
  children,
  variant = 'sage',
  className = '',
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'sage':
        return {
          background: colors.sage[100],
          color: colors.sage[700],
          border: `1px solid ${colors.sage[200]}`,
        };
      case 'blush':
        return {
          background: colors.blush[100],
          color: colors.blush[700],
          border: `1px solid ${colors.blush[200]}`,
        };
      case 'honey':
        return {
          background: colors.honey[100],
          color: colors.honey[700],
          border: `1px solid ${colors.honey[200]}`,
        };
      case 'lilac':
        return {
          background: colors.lilac[100],
          color: colors.lilac[700],
          border: `1px solid ${colors.lilac[200]}`,
        };
      case 'ocean':
        return {
          background: colors.ocean[100],
          color: colors.ocean[700],
          border: `1px solid ${colors.ocean[200]}`,
        };
      case 'peach':
        return {
          background: colors.peach[100],
          color: colors.peach[700],
          border: `1px solid ${colors.peach[200]}`,
        };
      case 'outline':
        return {
          background: 'transparent',
          color: colors.text.secondary,
          border: `1px solid ${colors.border.normal}`,
        };
      default:
        return {
          background: colors.sage[100],
          color: colors.sage[700],
          border: `1px solid ${colors.sage[200]}`,
        };
    }
  };

  const badgeStyle: React.CSSProperties = {
    ...getVariantStyles(),
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600',
    fontFamily: '"Nunito", sans-serif',
  };

  return (
    <span style={badgeStyle} className={className}>
      {children}
    </span>
  );
};

