import * as React from 'react';
import { motion } from 'framer-motion';
import { colors } from '../../utils/constants/colors';

interface ModernCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  gradient?: keyof typeof colors.gradients;
  onClick?: () => void;
}

export const ModernCard = React.forwardRef<HTMLDivElement, ModernCardProps>(
  ({ children, className = '', hover = true, gradient, onClick }, ref) => {
    const cardStyle: React.CSSProperties = {
      background: gradient ? colors.gradients[gradient] : colors.background.card,
      border: `2px solid ${colors.border.light}`,
      borderRadius: '24px',
      overflow: 'hidden',
      position: 'relative',
      cursor: onClick ? 'pointer' : 'default',
    };

    if (hover) {
      return (
        <motion.div
          ref={ref}
          style={cardStyle}
          className={className}
          onClick={onClick}
          whileHover={{
            y: -8,
            boxShadow: colors.effects.shadow.xl,
            borderColor: colors.border.accent,
          }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <div ref={ref} style={cardStyle} className={className} onClick={onClick}>
        {children}
      </div>
    );
  }
);

ModernCard.displayName = 'ModernCard';

export const ModernCardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div style={{ padding: '24px 24px 16px' }} className={className}>
    {children}
  </div>
);

export const ModernCardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <h3
    style={{
      fontSize: '20px',
      fontWeight: '700',
      color: colors.text.primary,
      fontFamily: '"Fredoka", "Nunito", sans-serif',
      marginBottom: '8px',
    }}
    className={className}
  >
    {children}
  </h3>
);

export const ModernCardDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <p
    style={{
      fontSize: '14px',
      color: colors.text.secondary,
      lineHeight: '1.6',
    }}
    className={className}
  >
    {children}
  </p>
);

export const ModernCardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div style={{ padding: '0 24px 24px' }} className={className}>
    {children}
  </div>
);

export const ModernCardFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div
    style={{
      padding: '16px 24px',
      borderTop: `1px solid ${colors.border.light}`,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    }}
    className={className}
  >
    {children}
  </div>
);

