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
      <nav className="pointer-events-auto bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-xl shadow-black/5 rounded-2xl mx-auto max-w-full flex items-center justify-between px-1.5 py-1.5 overflow-x-auto gap-0.5">
        {navItems.map((item) => {
          const active = isActive(item.path);

          return (
            <motion.button
              key={item.path}
              whileTap={{ scale: 0.88 }}
              onClick={() => navigate(item.path)}
              className="relative flex flex-col items-center justify-center min-w-[3.2rem] py-1.5 px-1 rounded-xl transition-colors duration-200"
            >
              {/* Active background pill */}
              {active && (
                <motion.div
                  layoutId="bottomNavActive"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: `${item.color}15` }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}

              <div className="relative z-10">
                {/* Active dot above icon */}
                {active && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ background: item.color }}
                  />
                )}

                <item.icon
                  size={20}
                  className="mb-0.5 transition-all duration-200"
                  style={active ? { color: item.color } : undefined}
                  strokeWidth={active ? 2.5 : 1.8}
                />
              </div>

              <span
                className={`relative z-10 text-[9px] font-medium truncate w-full text-center transition-colors duration-200 ${
                  active ? 'font-semibold' : 'text-slate-400 dark:text-slate-500'
                }`}
                style={active ? { color: item.color } : undefined}
              >
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </nav>
    </div>
  );
};

export default BottomNav;
