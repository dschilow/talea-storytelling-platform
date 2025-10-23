import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, User, BookOpen, FlaskConical, Code } from 'lucide-react';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows, animations } from '../../utils/constants/spacing';

const Navigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const tabs = [
    { path: '/', label: 'Home', icon: Home, color: colors.primary[500] },
    { path: '/avatar', label: 'Avatare', icon: User, color: colors.lavender[500] },
    { path: '/stories', label: 'Stories', icon: BookOpen, color: colors.rose[500] },
    { path: '/doku', label: 'Doku', icon: FlaskConical, color: colors.mint[500] },
    { path: '/logs', label: 'Logs', icon: Code, color: colors.sky[500] },
  ];

  const activeIdx = Math.max(0, tabs.findIndex(tab => tab.path === location.pathname));

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-end',
    padding: `${spacing.sm}px`,
    paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
    zIndex: 1000,
    pointerEvents: 'none',
  };

  const navStyle: React.CSSProperties = {
    pointerEvents: 'auto',
    display: 'flex',
    gap: spacing.xs,
    background: colors.glass.background,
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: `2px solid ${colors.border.light}`,
    borderRadius: `${radii.pill}px`,
    padding: `${spacing.sm}px`,
    boxShadow: shadows.lg,
    position: 'relative',
  };

  const indicatorStyle: React.CSSProperties = {
    position: 'absolute',
    top: spacing.sm,
    bottom: spacing.sm,
    left: spacing.sm + activeIdx * (70 + spacing.xs),
    width: 70,
    borderRadius: `${radii.pill}px`,
    background: tabs[activeIdx]?.color || colors.primary[500],
    opacity: 0.15,
    transition: `all ${animations.duration.normal} ${animations.easing.spring}`,
    zIndex: 0,
  };

  const buttonBase: React.CSSProperties = {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: spacing.xxs,
    width: 70,
    padding: `${spacing.sm}px ${spacing.xs}px`,
    borderRadius: `${radii.pill}px`,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: `all ${animations.duration.normal} ${animations.easing.smooth}`,
  };

  const labelStyle: React.CSSProperties = {
    ...typography.textStyles.tiny,
    fontWeight: '600',
  };

  return (
    <div style={containerStyle}>
      <div style={navStyle}>
        <div style={indicatorStyle} />
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              style={{
                ...buttonBase,
                color: isActive ? tab.color : colors.text.secondary,
                transform: isActive ? 'translateY(-4px)' : 'translateY(0px)',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.transform = 'translateY(-4px) scale(1.05)';
                  e.currentTarget.style.color = tab.color;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.transform = 'translateY(0px) scale(1)';
                  e.currentTarget.style.color = colors.text.secondary;
                }
              }}
            >
              <Icon 
                size={24} 
                strokeWidth={isActive ? 2.5 : 2}
                style={{ 
                  filter: isActive ? `drop-shadow(0 2px 4px ${tab.color}40)` : 'none',
                }} 
              />
              <span style={labelStyle}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Navigation;
