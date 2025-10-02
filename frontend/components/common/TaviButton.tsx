import React, { useState } from 'react';
import { MessageCircle, Sparkles } from 'lucide-react';
import { colors } from '../../utils/constants/colors';
import { spacing, radii, shadows } from '../../utils/constants/spacing';
import TaviChat from './TaviChat';

const TaviButton: React.FC = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const buttonStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '140px', // Above the navigation
    right: `${spacing.lg}px`,
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    zIndex: 999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: isHovered 
      ? `0 12px 24px rgba(255, 107, 157, 0.4), 0 0 20px ${colors.primary}60`
      : `0 8px 16px rgba(255, 107, 157, 0.3), 0 0 12px ${colors.primary}40`,
    background: `linear-gradient(135deg, ${colors.primary} 0%, #4ECDC4 100%)`,
    transform: isHovered ? 'scale(1.1) translateY(-2px)' : 'scale(1)',
    overflow: 'hidden',
    position: 'relative' as const,
  };

  const taviIconStyle: React.CSSProperties = {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundImage: 'url(/tavi.png)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    border: `2px solid rgba(255, 255, 255, 0.8)`,
    transition: 'all 0.3s ease',
    transform: isHovered ? 'scale(1.1)' : 'scale(1)',
  };

  const sparkleStyle: React.CSSProperties = {
    position: 'absolute',
    top: '8px',
    right: '8px',
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: '12px',
    animation: 'sparkle 2s infinite ease-in-out',
  };

  const pulseRingStyle: React.CSSProperties = {
    position: 'absolute',
    top: '-4px',
    left: '-4px',
    right: '-4px',
    bottom: '-4px',
    borderRadius: '50%',
    border: `2px solid ${colors.primary}60`,
    animation: 'pulse 2s infinite',
    opacity: isHovered ? 1 : 0.7,
  };

  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    right: '72px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: colors.glass.heroBackground,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: `1px solid ${colors.glass.border}`,
    borderRadius: `${radii.lg}px`,
    padding: `${spacing.sm}px ${spacing.md}px`,
    color: colors.textPrimary,
    fontSize: '14px',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    boxShadow: shadows.sm,
    opacity: isHovered ? 1 : 0,
    transform: isHovered 
      ? 'translateY(-50%) translateX(0)' 
      : 'translateY(-50%) translateX(8px)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    pointerEvents: 'none',
    zIndex: 1001,
  };

  const tooltipArrowStyle: React.CSSProperties = {
    position: 'absolute',
    right: '-6px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 0,
    height: 0,
    borderTop: '6px solid transparent',
    borderBottom: '6px solid transparent',
    borderLeft: `6px solid ${colors.glass.border}`,
  };

  return (
    <>
      <div style={{ position: 'relative' }}>
        <button
          style={buttonStyle}
          onClick={() => setIsChatOpen(true)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          title="Mit Tavi chatten"
        >
          <div style={pulseRingStyle} />
          <div style={taviIconStyle} />
          <Sparkles size={12} style={sparkleStyle} />
        </button>

        {/* Tooltip */}
        <div style={tooltipStyle}>
          Frag mich etwas! ✨
          <div style={tooltipArrowStyle} />
        </div>
      </div>

      <TaviChat 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
      />

      <style>{`
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 0.7;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.9;
          }
          100% {
            transform: scale(1);
            opacity: 0.7;
          }
        }
        
        @keyframes sparkle {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(0.8);
          }
        }
      `}</style>
    </>
  );
};

export default TaviButton;