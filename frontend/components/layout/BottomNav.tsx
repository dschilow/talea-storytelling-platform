import React, { useState } from 'react';
import {
  Home, BookOpen, User, FlaskConical, Sparkles, Gem, BookMarked,
  Code, Settings, X, ChevronUp, Wand2,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

// ─── "More" sheet items ───
const MORE_ITEMS = [
  { icon: User, labelKey: 'navigation.avatars', path: '/avatar', color: '#2DD4BF' },
  { icon: Sparkles, labelKey: 'navigation.characters', path: '/characters', color: '#A989F2' },
  { icon: Gem, labelKey: 'navigation.artifacts', path: '/artifacts', color: '#FF6B9D' },
  { icon: BookMarked, labelKey: 'navigation.fairytales', path: '/fairytales', color: '#2DD4BF' },
  { icon: Code, labelKey: 'navigation.logs', path: '/logs', color: '#64748B' },
  { icon: Settings, labelKey: 'navigation.settings', path: '/settings', color: '#A989F2' },
];

// ─── "More" Bottom Sheet ───
const MoreSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  currentPath: string;
  t: (key: string) => string;
}> = ({ isOpen, onClose, onNavigate, currentPath, t }) => (
  <AnimatePresence>
    {isOpen && (
      <>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Sheet */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          className="fixed bottom-0 left-0 right-0 z-[70] rounded-t-3xl overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(26,16,51,0.98), rgba(15,10,30,0.99))',
            borderTop: '1px solid rgba(169,137,242,0.15)',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
          }}
        >
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3">
            <h3
              className="text-lg font-bold text-white/90"
              style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}
            >
              Mehr entdecken
            </h3>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/50"
            >
              <X size={16} />
            </motion.button>
          </div>

          {/* Grid of items */}
          <div className="grid grid-cols-3 gap-3 px-5 pb-8 pt-2">
            {MORE_ITEMS.map((item, i) => {
              const active = currentPath === item.path;
              return (
                <motion.button
                  key={item.path}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => {
                    onNavigate(item.path);
                    onClose();
                  }}
                  className={`flex flex-col items-center gap-2 py-4 px-2 rounded-2xl transition-all ${
                    active
                      ? 'bg-white/[0.08] border border-white/[0.12]'
                      : 'bg-white/[0.03] border border-transparent hover:bg-white/[0.06]'
                  }`}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={
                      active
                        ? { background: `${item.color}20`, boxShadow: `0 0 16px ${item.color}25` }
                        : { background: 'rgba(255,255,255,0.04)' }
                    }
                  >
                    <item.icon
                      size={20}
                      style={{ color: active ? item.color : 'rgba(255,255,255,0.45)' }}
                    />
                  </div>
                  <span
                    className="text-[11px] font-semibold text-center leading-tight"
                    style={{ color: active ? item.color : 'rgba(255,255,255,0.55)' }}
                  >
                    {t(item.labelKey)}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// ─── Main Bottom Nav ───
const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  // Check if any "more" item is currently active
  const moreIsActive = MORE_ITEMS.some((item) => location.pathname === item.path);

  // Primary nav items (left side of center button)
  const leftItems = [
    { icon: Home, label: t('navigation.home'), path: '/', color: '#A989F2' },
    { icon: BookOpen, label: t('navigation.stories'), path: '/stories', color: '#FF6B9D' },
  ];

  // Primary nav items (right side of center button)
  const rightItems = [
    { icon: FlaskConical, label: t('navigation.doku'), path: '/doku', color: '#FF9B5C' },
  ];

  const renderNavItem = (item: (typeof leftItems)[0]) => {
    const active = isActive(item.path);
    return (
      <motion.button
        key={item.path}
        whileTap={{ scale: 0.85 }}
        onClick={() => navigate(item.path)}
        className="relative flex flex-col items-center justify-center flex-1 py-2 rounded-xl"
      >
        {/* Active indicator pill */}
        {active && (
          <motion.div
            layoutId="bottomNavPill"
            className="absolute -top-1 w-5 h-[3px] rounded-full"
            style={{ background: item.color, boxShadow: `0 0 12px ${item.color}80` }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        )}

        <item.icon
          size={22}
          className="transition-all duration-300"
          style={
            active
              ? { color: item.color, filter: `drop-shadow(0 0 6px ${item.color}60)` }
              : { color: 'rgba(255,255,255,0.3)' }
          }
          strokeWidth={active ? 2.5 : 1.8}
        />

        <span
          className="text-[10px] font-semibold mt-1 transition-colors duration-200"
          style={active ? { color: item.color } : { color: 'rgba(255,255,255,0.25)' }}
        >
          {item.label}
        </span>
      </motion.button>
    );
  };

  return (
    <>
      {/* More Sheet */}
      <MoreSheet
        isOpen={moreOpen}
        onClose={() => setMoreOpen(false)}
        onNavigate={navigate}
        currentPath={location.pathname}
        t={t}
      />

      {/* Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        {/* Gradient fade above nav */}
        <div className="pointer-events-none h-6 bg-gradient-to-t from-[#0F0A1A]/90 to-transparent" />

        <nav
          className="pointer-events-auto mx-3 mb-3 rounded-2xl flex items-end justify-around px-2 pt-2 pb-2 border border-white/[0.06]"
          style={{
            background: 'linear-gradient(180deg, rgba(26,16,51,0.95), rgba(15,10,30,0.98))',
            backdropFilter: 'blur(24px) saturate(180%)',
            boxShadow:
              '0 -2px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 0.5px rgba(169,137,242,0.08)',
          }}
        >
          {/* Left items */}
          {leftItems.map(renderNavItem)}

          {/* ── Center Create Button ── */}
          <div className="flex flex-col items-center justify-end flex-1 -mt-5">
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => navigate('/story')}
              className="relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, #A989F2 0%, #FF6B9D 50%, #FF9B5C 100%)',
                boxShadow:
                  '0 4px 24px rgba(169,137,242,0.4), 0 2px 8px rgba(255,107,157,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
              }}
            >
              {/* Animated glow ring */}
              <motion.div
                className="absolute inset-0 rounded-2xl"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  boxShadow: '0 0 20px rgba(169,137,242,0.5), 0 0 40px rgba(255,107,157,0.2)',
                }}
              />
              <Wand2 className="w-6 h-6 text-white relative z-10" strokeWidth={2.5} />
            </motion.button>
            <span className="text-[10px] font-bold mt-1.5 bg-gradient-to-r from-[#A989F2] to-[#FF6B9D] bg-clip-text text-transparent">
              Neu
            </span>
          </div>

          {/* Right items */}
          {rightItems.map(renderNavItem)}

          {/* ── More Button ── */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => setMoreOpen(true)}
            className="relative flex flex-col items-center justify-center flex-1 py-2 rounded-xl"
          >
            {/* Active indicator for "more" sub-pages */}
            {moreIsActive && (
              <motion.div
                className="absolute -top-1 w-5 h-[3px] rounded-full"
                style={{ background: '#FF9B5C', boxShadow: '0 0 12px rgba(255,155,92,0.8)' }}
              />
            )}

            <div className="relative">
              <ChevronUp
                size={22}
                className="transition-all duration-300"
                style={
                  moreIsActive || moreOpen
                    ? { color: '#FF9B5C', filter: 'drop-shadow(0 0 6px rgba(255,155,92,0.6))' }
                    : { color: 'rgba(255,255,255,0.3)' }
                }
                strokeWidth={moreIsActive || moreOpen ? 2.5 : 1.8}
              />
              {/* Notification dot if a "more" page is active */}
              {moreIsActive && !moreOpen && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full"
                  style={{ background: '#FF9B5C', boxShadow: '0 0 6px rgba(255,155,92,0.8)' }}
                />
              )}
            </div>

            <span
              className="text-[10px] font-semibold mt-1 transition-colors duration-200"
              style={
                moreIsActive || moreOpen
                  ? { color: '#FF9B5C' }
                  : { color: 'rgba(255,255,255,0.25)' }
              }
            >
              Mehr
            </span>
          </motion.button>
        </nav>
      </div>
    </>
  );
};

export default BottomNav;
