import React, { useState } from 'react';
import { Home, BookOpen, User, FlaskConical, Settings, LogOut, Sparkles, Gem, BookMarked, Code } from 'lucide-react';
import { useClerk } from '@clerk/clerk-react';
import { Sidebar as AceternitySidebar, SidebarBody, SidebarLink } from '../ui/sidebar';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

const Sidebar: React.FC = () => {
  const { signOut } = useClerk();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { icon: <Home className="h-5 w-5 flex-shrink-0" />, label: t('navigation.home'), href: '/', color: '#A989F2' },
    { icon: <User className="h-5 w-5 flex-shrink-0" />, label: t('navigation.avatars'), href: '/avatar', color: '#2DD4BF' },
    { icon: <BookOpen className="h-5 w-5 flex-shrink-0" />, label: t('navigation.stories'), href: '/stories', color: '#FF6B9D' },
    { icon: <FlaskConical className="h-5 w-5 flex-shrink-0" />, label: t('navigation.doku'), href: '/doku', color: '#FF9B5C' },
    { icon: <Sparkles className="h-5 w-5 flex-shrink-0" />, label: t('navigation.characters'), href: '/characters', color: '#A989F2' },
    { icon: <Gem className="h-5 w-5 flex-shrink-0" />, label: t('navigation.artifacts'), href: '/artifacts', color: '#FF6B9D' },
    { icon: <BookMarked className="h-5 w-5 flex-shrink-0" />, label: t('navigation.fairytales'), href: '/fairytales', color: '#2DD4BF' },
    { icon: <Code className="h-5 w-5 flex-shrink-0" />, label: t('navigation.logs'), href: '/logs', color: '#64748B' },
  ];

  const isActive = (href: string) => location.pathname === href;

  return (
    <div className="hidden md:flex h-screen sticky top-0 left-0 z-50">
      <AceternitySidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10 border-r border-white/[0.06]"
          style={{ background: 'linear-gradient(180deg, rgba(15,10,30,0.97), rgba(13,27,42,0.97))', backdropFilter: 'blur(24px)' } as React.CSSProperties}>
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
            {/* Logo — Animated gradient */}
            <div className="flex items-center gap-2.5 px-1 py-4 mb-6">
              <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-extrabold text-lg relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #A989F2, #FF6B9D)', boxShadow: '0 4px 20px rgba(169,137,242,0.4)' }}>
                T
                {/* Shimmer */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute -inset-full"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)', animation: 'shimmer 3s ease-in-out infinite' }} />
                </div>
              </div>
              {open && (
                <span className="text-xl font-extrabold bg-gradient-to-r from-[#A989F2] via-[#FF6B9D] to-[#FF9B5C] bg-clip-text text-transparent whitespace-pre"
                  style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
                  Talea
                </span>
              )}
            </div>

            {/* Navigation Links */}
            <div className="flex flex-col gap-0.5">
              {navItems.map((item, idx) => {
                const active = isActive(item.href);
                return (
                  <div key={idx} className="relative group">
                    {/* Active glow indicator */}
                    {active && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full"
                        style={{ background: item.color, boxShadow: `0 0 10px ${item.color}80, 0 0 20px ${item.color}40` }} />
                    )}

                    {/* Active row glow */}
                    {active && (
                      <div className="absolute inset-0 rounded-lg"
                        style={{ background: `${item.color}10` }} />
                    )}

                    <SidebarLink
                      link={{
                        ...item,
                        icon: (
                          <div className="h-5 w-5 flex-shrink-0 transition-all duration-300"
                            style={active
                              ? { color: item.color, filter: `drop-shadow(0 0 6px ${item.color}80)` }
                              : { color: 'rgba(255,255,255,0.3)' }
                            }>
                            {item.icon}
                          </div>
                        ),
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom: Settings & Logout */}
          <div className="flex flex-col gap-0.5 pb-2">
            {/* Divider glow */}
            <div className="h-px mb-3"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(169,137,242,0.2), transparent)' }} />

            <div className="relative">
              {isActive('/settings') && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full"
                  style={{ background: '#A989F2', boxShadow: '0 0 10px rgba(169,137,242,0.5)' }} />
              )}
              <SidebarLink
                link={{
                  label: t('navigation.settings'),
                  href: '/settings',
                  icon: (
                    <div className="h-5 w-5 flex-shrink-0 transition-all duration-300"
                      style={isActive('/settings')
                        ? { color: '#A989F2', filter: 'drop-shadow(0 0 6px rgba(169,137,242,0.8))' }
                        : { color: 'rgba(255,255,255,0.3)' }
                      }>
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
                    <div className="h-5 w-5 flex-shrink-0 transition-all duration-300"
                      style={{ color: 'rgba(248,113,113,0.6)' }}>
                      <LogOut className="h-5 w-5" />
                    </div>
                  ),
                }}
              />
            </div>
          </div>
        </SidebarBody>
      </AceternitySidebar>

      {/* CSS for shimmer animation */}
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
