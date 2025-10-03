import React, { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import TaviChat from './TaviChat';
import { colors } from '../../utils/constants/colors';
import { spacing, radii, shadows, animations } from '../../utils/constants/spacing';
import FloatAnimation from '../animated/FloatAnimation';

const TaviButton: React.FC = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);

  const buttonStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: `${spacing.xxxl + 80}px`,
    right: `${spacing.xl}px`,
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: colors.gradients.bloom,
    border: `3px solid ${colors.lilac[200]}`,
    boxShadow: colors.effects.glow.lilac,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    transition: `all ${animations.duration.normal} ${animations.easing.bounce}`,
    backgroundImage: 'url(/tavi.png)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  const pulseRingStyle: React.CSSProperties = {
    position: 'absolute',
    top: '-4px',
    left: '-4px',
    right: '-4px',
    bottom: '-4px',
    borderRadius: '50%',
    border: `3px solid ${colors.lilac[400]}`,
    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    opacity: 0.6,
  };

  return (
    <>
      <FloatAnimation duration={3} distance={12}>
        <div style={{ position: 'relative' }}>
          <div style={pulseRingStyle} />
          <button
            onClick={() => setIsChatOpen(true)}
            style={buttonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.15)';
              e.currentTarget.style.boxShadow = colors.effects.glow.lilac;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = colors.effects.glow.lilac;
            }}
          />
        </div>
      </FloatAnimation>

      <TaviChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 0.3;
            transform: scale(1.1);
          }
        }
      `}</style>
    </>
  );
};

export default TaviButton;
