import * as React from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { colors } from '../../utils/constants/colors';

interface ModernCardProps extends Omit<HTMLMotionProps<'div'>, 'children' | 'onClick'> {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  gradient?: keyof typeof colors.gradients;
  onClick?: () => void;
}

export const ModernCard = React.forwardRef<HTMLDivElement, ModernCardProps>(
  ({ children, className = '', hover = true, gradient, onClick, onKeyDown, style, role, tabIndex, ...props }, ref) => {
    const reduceMotion = useReducedMotion();
    const actionable = Boolean(onClick);
    const cardStyle: React.CSSProperties = {
      background: gradient ? colors.gradients[gradient] : colors.background.card,
      border: `2px solid ${colors.border.light}`,
      borderRadius: '24px',
      overflow: 'hidden',
      position: 'relative',
      cursor: onClick ? 'pointer' : 'default',
      fontFamily: 'var(--talea-font-ui)',
    };

    return (
      <motion.div
        {...props}
        ref={ref}
        style={{ ...cardStyle, ...style }}
        className={`${actionable ? 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]' : ''} ${className}`}
        role={actionable ? 'button' : role}
        tabIndex={actionable ? (tabIndex ?? 0) : tabIndex}
        onClick={onClick}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || event.target !== event.currentTarget || !onClick) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
          }
        }}
        whileHover={actionable && hover && !reduceMotion ? { y: -3, borderColor: colors.border.accent } : undefined}
        whileTap={actionable && !reduceMotion ? { scale: 0.99 } : undefined}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        {children}
      </motion.div>
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
      fontFamily: 'var(--talea-font-display)',
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
      fontFamily: 'var(--talea-font-ui)',
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

