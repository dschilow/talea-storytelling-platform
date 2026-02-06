import React from 'react';
import { Home, BookOpen, User, FlaskConical, Sparkles, Gem, BookMarked, Code, Settings } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { icon: Home, label: t('navigation.home'), path: '/', color: '#A989F2' },
    { icon: User, label: t('navigation.avatars'), path: '/avatar', color: '#2DD4BF' },
    { icon: BookOpen, label: t('navigation.stories'), path: '/stories', color: '#FF6B9D' },
    { icon: FlaskConical, label: t('navigation.doku'), path: '/doku', color: '#FF9B5C' },
    { icon: Sparkles, label: t('navigation.characters'), path: '/characters', color: '#A989F2' },
    { icon: Gem, label: t('navigation.artifacts'), path: '/artifacts', color: '#FF6B9D' },
    { icon: BookMarked, label: t('navigation.fairytales'), path: '/fairytales', color: '#2DD4BF' },
    { icon: Code, label: t('navigation.logs'), path: '/logs', color: '#64748B' },
    { icon: Settings, label: t('navigation.settings'), path: '/settings', color: '#A989F2' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pb-2 pt-1 pointer-events-none">
      {/* Gradient top-edge glow */}
      <div className="pointer-events-none absolute -top-4 left-0 right-0 h-8 bg-gradient-to-t from-[#0F0A1A]/80 to-transparent" />

      <nav className="pointer-events-auto rounded-2xl mx-auto max-w-full flex items-center justify-between px-1.5 py-1.5 overflow-x-auto gap-0.5 border border-white/[0.08]"
        style={{ background: 'rgba(15, 10, 30, 0.92)', backdropFilter: 'blur(24px) saturate(180%)', boxShadow: '0 -4px 30px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
        {navItems.map((item) => {
          const active = isActive(item.path);

          return (
            <motion.button
              key={item.path}
              whileTap={{ scale: 0.85 }}
              onClick={() => navigate(item.path)}
              className="relative flex flex-col items-center justify-center min-w-[3.2rem] py-1.5 px-1 rounded-xl"
            >
              {/* Active glow background */}
              {active && (
                <motion.div
                  layoutId="bottomNavActive"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: `${item.color}18`, boxShadow: `0 0 20px ${item.color}15` }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}

              <div className="relative z-10 flex flex-col items-center">
                {/* Active glow dot */}
                {active && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                    style={{ background: item.color, boxShadow: `0 0 8px ${item.color}` }}
                  />
                )}

                <item.icon
                  size={20}
                  className="mb-0.5 transition-all duration-300"
                  style={active ? { color: item.color, filter: `drop-shadow(0 0 4px ${item.color}60)` } : { color: 'rgba(255,255,255,0.3)' }}
                  strokeWidth={active ? 2.5 : 1.8}
                />

                <span
                  className="text-[9px] font-medium truncate w-full text-center transition-colors duration-200"
                  style={active ? { color: item.color } : { color: 'rgba(255,255,255,0.25)' }}
                >
                  {item.label}
                </span>
              </div>
            </motion.button>
          );
        })}
      </nav>
    </div>
  );
};

export default BottomNav;
