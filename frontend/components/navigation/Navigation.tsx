import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, User, Sparkles, BookOpen, Globe } from 'lucide-react';
import { colors } from '../../utils/constants/colors';
import { typography } from '../../utils/constants/typography';
import { spacing, radii } from '../../utils/constants/spacing';

const Navigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const tabs = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/avatar', label: 'Avatare', icon: User },
    { path: '/story', label: 'Generieren', icon: Sparkles },
    { path: '/stories', label: 'Stories', icon: BookOpen },
    { path: '/community', label: 'Community', icon: Globe },
  ];

  const navStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.elevatedSurface,
    borderTop: `1px solid ${colors.border}`,
    padding: `${spacing.sm}px ${spacing.lg}px`,
    paddingBottom: `${spacing.lg}px`,
    zIndex: 1000,
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    maxWidth: '500px',
    margin: '0 auto',
  };

  const indicatorStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    height: '3px',
    backgroundColor: colors.primary,
    borderRadius: `${radii.sm}px`,
    width: `${100 / tabs.length}%`,
    left: `${(tabs.findIndex(tab => tab.path === location.pathname) * 100) / tabs.length}%`,
    transition: 'left 0.3s cubic-bezier(0.2, 0.0, 0.0, 1.0)',
  };

  return (
    <nav style={navStyle}>
      <div style={{ position: 'relative' }}>
        <div style={indicatorStyle} />
        <div style={containerStyle}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.pathname === tab.path;
            
            const buttonStyle: React.CSSProperties = {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: `${spacing.sm}px ${spacing.md}px`,
              borderRadius: `${radii.md}px`,
              backgroundColor: isActive ? colors.surface : 'transparent',
              color: isActive ? colors.primary : colors.textSecondary,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.2, 0.0, 0.0, 1.0)',
              minWidth: '60px',
            };

            const labelStyle: React.CSSProperties = {
              fontSize: typography.textStyles.caption.fontSize,
              fontWeight: typography.textStyles.caption.fontWeight,
              marginTop: `${spacing.xs}px`,
              fontFamily: typography.fonts.primary,
            };

            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                style={buttonStyle}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = colors.primary;
                    e.currentTarget.style.backgroundColor = colors.surface;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = colors.textSecondary;
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <Icon size={24} />
                <span style={labelStyle}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
