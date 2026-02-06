import React, { useState } from 'react';
import {
  Home, BookOpen, User, FlaskConical, Settings, LogOut,
  Sparkles, Gem, BookMarked, Code, Wand2,
} from 'lucide-react';
import { useClerk } from '@clerk/clerk-react';
import { Sidebar as AceternitySidebar, SidebarBody, SidebarLink } from '../ui/sidebar';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

// ─── Navigation Groups ───
const NAV_GROUPS = [
  {
    // No label for primary group
    items: [
      { icon: Home, label: 'navigation.home', href: '/', color: '#A989F2' },
      { icon: User, label: 'navigation.avatars', href: '/avatar', color: '#2DD4BF' },
      { icon: BookOpen, label: 'navigation.stories', href: '/stories', color: '#FF6B9D' },
      { icon: FlaskConical, label: 'navigation.doku', href: '/doku', color: '#FF9B5C' },
    ],
  },
  {
    label: 'Kreativ',
    items: [
      { icon: Sparkles, label: 'navigation.characters', href: '/characters', color: '#A989F2' },
      { icon: Gem, label: 'navigation.artifacts', href: '/artifacts', color: '#FF6B9D' },
      { icon: BookMarked, label: 'navigation.fairytales', href: '/fairytales', color: '#2DD4BF' },
    ],
  },
  {
    label: 'System',
    items: [
      { icon: Code, label: 'navigation.logs', href: '/logs', color: '#64748B' },
    ],
  },
];

const Sidebar: React.FC = () => {
  const { signOut } = useClerk();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (href: string) => location.pathname === href;

  return (
    <div className="hidden md:flex h-screen fixed top-0 left-0 z-50">
      <AceternitySidebar open={open} setOpen={setOpen}>
        <SidebarBody
          className="justify-between gap-6 border-r border-white/[0.06]"
          style={{
            background: 'linear-gradient(180deg, rgba(15,10,30,0.97), rgba(13,27,42,0.97))',
            backdropFilter: 'blur(24px)',
          } as React.CSSProperties}
        >
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
            {/* Logo */}
            <div className="flex items-center gap-2.5 px-1 py-4 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-extrabold text-lg relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #A989F2, #FF6B9D)',
                  boxShadow: '0 4px 20px rgba(169,137,242,0.4)',
                }}
              >
                T
                <div className="absolute inset-0 overflow-hidden">
                  <div
                    className="absolute -inset-full"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                      animation: 'shimmer 3s ease-in-out infinite',
                    }}
                  />
                </div>
              </div>
              {open && (
                <span
                  className="text-xl font-extrabold bg-gradient-to-r from-[#A989F2] via-[#FF6B9D] to-[#FF9B5C] bg-clip-text text-transparent whitespace-pre"
                  style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}
                >
                  Talea
                </span>
              )}
            </div>

            {/* ── Create Story CTA ── */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/story')}
              className="relative mb-5 mx-0.5 overflow-hidden rounded-xl flex items-center gap-2.5 py-2.5 px-2.5 shadow-lg transition-all"
              style={{
                background: 'linear-gradient(135deg, #A989F2 0%, #FF6B9D 50%, #FF9B5C 100%)',
                boxShadow: '0 4px 20px rgba(169,137,242,0.35), 0 2px 6px rgba(255,107,157,0.2)',
              }}
            >
              {/* Shimmer */}
              <div className="absolute inset-0 overflow-hidden">
                <div
                  className="absolute -inset-full"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
                    animation: 'shimmer 3s ease-in-out infinite',
                  }}
                />
              </div>
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                <Wand2 className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              {open && (
                <span
                  className="text-sm font-bold text-white whitespace-pre"
                  style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}
                >
                  Neue Geschichte
                </span>
              )}
            </motion.button>

            {/* ── Navigation Groups ── */}
            <div className="flex flex-col gap-1">
              {NAV_GROUPS.map((group, gi) => (
                <div key={gi}>
                  {/* Group divider with optional label */}
                  {gi > 0 && (
                    <div className="my-3 flex items-center gap-2 px-1">
                      <div
                        className="flex-1 h-px"
                        style={{ background: 'linear-gradient(90deg, transparent, rgba(169,137,242,0.15), transparent)' }}
                      />
                      {open && group.label && (
                        <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/20 whitespace-nowrap">
                          {group.label}
                        </span>
                      )}
                      <div
                        className="flex-1 h-px"
                        style={{ background: 'linear-gradient(90deg, transparent, rgba(169,137,242,0.15), transparent)' }}
                      />
                    </div>
                  )}

                  {/* Group items */}
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const active = isActive(item.href);
                      const Icon = item.icon;
                      return (
                        <div key={item.href} className="relative group">
                          {/* Active glow bar */}
                          {active && (
                            <motion.div
                              layoutId="sidebarActiveBar"
                              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full"
                              style={{ background: item.color, boxShadow: `0 0 10px ${item.color}80, 0 0 20px ${item.color}40` }}
                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            />
                          )}

                          {/* Active row glow */}
                          {active && (
                            <div
                              className="absolute inset-0 rounded-lg"
                              style={{ background: `${item.color}10` }}
                            />
                          )}

                          <SidebarLink
                            link={{
                              label: t(item.label),
                              href: item.href,
                              icon: (
                                <div
                                  className="h-5 w-5 flex-shrink-0 transition-all duration-300"
                                  style={
                                    active
                                      ? { color: item.color, filter: `drop-shadow(0 0 6px ${item.color}80)` }
                                      : { color: 'rgba(255,255,255,0.3)' }
                                  }
                                >
                                  <Icon className="h-5 w-5" />
                                </div>
                              ),
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Bottom: Settings & Logout ── */}
          <div className="flex flex-col gap-0.5 pb-2">
            <div
              className="h-px mb-3"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(169,137,242,0.2), transparent)' }}
            />

            <div className="relative">
              {isActive('/settings') && (
                <motion.div
                  layoutId="sidebarActiveBar"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full"
                  style={{ background: '#A989F2', boxShadow: '0 0 10px rgba(169,137,242,0.5)' }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              {isActive('/settings') && (
                <div className="absolute inset-0 rounded-lg" style={{ background: 'rgba(169,137,242,0.06)' }} />
              )}
              <SidebarLink
                link={{
                  label: t('navigation.settings'),
                  href: '/settings',
                  icon: (
                    <div
                      className="h-5 w-5 flex-shrink-0 transition-all duration-300"
                      style={
                        isActive('/settings')
                          ? { color: '#A989F2', filter: 'drop-shadow(0 0 6px rgba(169,137,242,0.8))' }
                          : { color: 'rgba(255,255,255,0.3)' }
                      }
                    >
                      <Settings className="h-5 w-5" />
                    </div>
                  ),
                }}
              />
            </div>

            <div onClick={() => signOut()} className="cursor-pointer group">
              <SidebarLink
                link={{
                  label: t('navigation.logout'),
                  href: '#',
                  icon: (
                    <div className="h-5 w-5 flex-shrink-0 transition-all duration-300" style={{ color: 'rgba(248,113,113,0.6)' }}>
                      <LogOut className="h-5 w-5" />
                    </div>
                  ),
                }}
              />
            </div>
          </div>
        </SidebarBody>
      </AceternitySidebar>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          50%, 100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default Sidebar;
