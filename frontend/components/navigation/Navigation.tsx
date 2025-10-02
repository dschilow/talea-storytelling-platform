import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, User, Sparkles, BookOpen, Globe, Code, FlaskConical } from 'lucide-react';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii, shadows } from '../../utils/constants/spacing';

const Navigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const tabs = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/avatar', label: 'Avatare', icon: User },
    { path: '/stories', label: 'Stories', icon: BookOpen },
    { path: '/doku', label: 'Doku', icon: FlaskConical },
    { path: '/logs', label: 'Logs', icon: Code },
    { path: '/community', label: 'Community', icon: Globe },
  ];

  const activeIdx = Math.max(0, tabs.findIndex(tab => tab.path === location.pathname));

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: spacing.lg,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    zIndex: 1000,
    pointerEvents: 'none',
  };

  const navStyle: React.CSSProperties = {
    pointerEvents: 'auto',
    display: 'flex',
    gap: spacing.sm,
    background: colors.glass.navBackground,
    backdropFilter: 'blur(18px) saturate(180%)',
    WebkitBackdropFilter: 'blur(18px) saturate(180%)',
    border: `1px solid ${colors.glass.border}`,
    borderRadius: `${radii.pill}px`,
    padding: `${spacing.sm}px`,
    boxShadow: colors.glass.shadowStrong,
  };

  const indicatorStyle: React.CSSProperties = {
    position: 'absolute',
    top: spacing.sm,
    bottom: spacing.sm,
    left: spacing.sm + activeIdx * (62 + spacing.sm),
    width: 62,
    borderRadius: `${radii.pill}px`,
    background: colors.glass.indicator,
    transition: 'left 300ms cubic-bezier(0.2, 0, 0, 1)',
    zIndex: 0,
  };

  const buttonBase: React.CSSProperties = {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    width: 62,
    padding: `${spacing.sm}px ${spacing.md}px`,
    borderRadius: `${radii.pill}px`,
    background: 'transparent',
    border: 'none',
    color: colors.textPrimary,
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: typography.textStyles.caption.fontSize,
    fontWeight: typography.textStyles.caption.fontWeight,
    marginTop: `${spacing.xs}px`,
    fontFamily: typography.fonts.primary,
  };

  return (
    <div style={containerStyle}>
      <div style={{ position: 'relative' }}>
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
                  color: isActive ? colors.textPrimary : colors.textSecondary,
                  transform: isActive ? 'translateY(-2px)' : 'translateY(0px)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.color = colors.textPrimary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.transform = 'translateY(0px)';
                    e.currentTarget.style.color = colors.textSecondary;
                  }
                }}
              >
                <Icon size={22} style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.08))' }} />
                <span style={labelStyle}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Navigation;
