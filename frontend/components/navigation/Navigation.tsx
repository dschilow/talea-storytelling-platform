import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, User, BookOpen, FlaskConical, Code, Sparkles } from 'lucide-react';
import { colors } from '../../utils/constants/colors';

const Navigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // 🎨 Navigation Tabs mit neuen Farben
  const tabs = [
    { 
      path: '/', 
      label: 'Home', 
      icon: Home, 
      color: colors.sage[500],
      gradient: colors.gradients.primary,
    },
    { 
      path: '/avatar', 
      label: 'Avatare', 
      icon: User, 
      color: colors.lilac[500],
      gradient: colors.gradients.bloom,
    },
    { 
      path: '/stories', 
      label: 'Stories', 
      icon: BookOpen, 
      color: colors.blush[500],
      gradient: colors.gradients.sunset,
    },
    { 
      path: '/doku', 
      label: 'Dokus', 
      icon: FlaskConical, 
      color: colors.ocean[500],
      gradient: colors.gradients.fresh,
    },
    { 
      path: '/logs', 
      label: 'Logs', 
      icon: Code, 
      color: colors.honey[500],
      gradient: colors.gradients.warm,
    },
  ];

  const activeIdx = Math.max(0, tabs.findIndex(tab => tab.path === location.pathname));

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        pointerEvents: 'none',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '28px',
      }}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ 
          type: "spring", 
          stiffness: 260, 
          damping: 20,
          delay: 0.2,
        }}
        style={{
          pointerEvents: 'auto',
          display: 'inline-flex',
          gap: '4px',
          background: colors.glass.background,
          backdropFilter: 'blur(30px) saturate(180%)',
          WebkitBackdropFilter: 'blur(30px) saturate(180%)',
          border: `2px solid ${colors.border.light}`,
          borderRadius: '32px',
          padding: '8px',
          boxShadow: colors.effects.shadow['2xl'],
          position: 'relative',
        }}
      >
        {/* 🌟 Animierter Indikator */}
        <motion.div
          layoutId="nav-indicator"
          style={{
            position: 'absolute',
            top: '8px',
            bottom: '8px',
            left: `${8 + activeIdx * (74)}px`,
            width: '70px',
            borderRadius: '24px',
            background: tabs[activeIdx]?.gradient || colors.gradients.primary,
            opacity: 0.2,
            zIndex: 0,
            boxShadow: `0 4px 12px ${tabs[activeIdx]?.color}30`,
          }}
          transition={{ 
            type: "spring", 
            stiffness: 380, 
            damping: 30,
          }}
        />

        {/* 🎯 Navigation Buttons */}
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path;
          
          return (
            <motion.button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                width: '70px',
                padding: '12px 8px',
                borderRadius: '24px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: isActive ? tab.color : colors.text.secondary,
              }}
              whileHover={{ 
                scale: 1.1,
                y: -4,
              }}
              whileTap={{ 
                scale: 0.95,
                y: 0,
              }}
              animate={{
                y: isActive ? -4 : 0,
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 17,
              }}
            >
              {/* ✨ Icon mit Animation */}
              <motion.div
                animate={{
                  scale: isActive ? [1, 1.2, 1] : 1,
                  rotate: isActive ? [0, 5, -5, 0] : 0,
                }}
                transition={{
                  duration: 0.5,
                  repeat: isActive ? Infinity : 0,
                  repeatDelay: 3,
                }}
              >
                <Icon 
                  size={24} 
                  strokeWidth={isActive ? 2.5 : 2}
                  style={{ 
                    filter: isActive ? `drop-shadow(0 2px 8px ${tab.color}60)` : 'none',
                  }} 
                />
              </motion.div>

              {/* 📝 Label */}
              <motion.span
                style={{
                  fontSize: '11px',
                  fontWeight: isActive ? '700' : '600',
                  fontFamily: '"Fredoka", "Nunito", sans-serif',
                  letterSpacing: '0.3px',
                }}
                animate={{
                  scale: isActive ? 1.05 : 1,
                }}
              >
                {tab.label}
              </motion.span>

              {/* ✨ Aktiver Sparkle-Effekt */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ 
                      scale: [0, 1.2, 0],
                      opacity: [0, 1, 0],
                    }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      repeatDelay: 2,
                    }}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                    }}
                  >
                    <Sparkles size={12} style={{ color: tab.color }} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}

        {/* 🌈 Dekorative Glow-Effekte */}
        <motion.div
          style={{
            position: 'absolute',
            inset: '-20px',
            background: tabs[activeIdx]?.gradient || colors.gradients.primary,
            opacity: 0.1,
            filter: 'blur(40px)',
            borderRadius: '60px',
            zIndex: -1,
            pointerEvents: 'none',
          }}
          animate={{
            opacity: [0.1, 0.15, 0.1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </motion.div>
    </div>
  );
};

export default Navigation;
