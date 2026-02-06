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
        <SidebarBody className="justify-between gap-10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-2xl border-r border-white/20 dark:border-white/5">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
            {/* Logo */}
            <div className="flex items-center gap-2.5 px-1 py-4 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#A989F2] to-[#FF6B9D] flex-shrink-0 flex items-center justify-center text-white font-bold shadow-lg shadow-[#A989F2]/25">
                T
              </div>
              {open && (
                <span className="text-xl font-bold bg-gradient-to-r from-[#A989F2] to-[#FF6B9D] bg-clip-text text-transparent whitespace-pre" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
                  Talea
                </span>
              )}
            </div>

            {/* Navigation Links */}
            <div className="flex flex-col gap-1">
              {navItems.map((item, idx) => {
                const active = isActive(item.href);
                return (
                  <div key={idx} className="relative">
                    {/* Active indicator bar */}
                    {active && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                        style={{ background: item.color }}
                      />
                    )}
                    <SidebarLink
                      link={{
                        ...item,
                        icon: (
                          <div
                            className={`h-5 w-5 flex-shrink-0 transition-colors duration-200 ${
                              active ? '' : 'text-slate-500 dark:text-slate-400'
                            }`}
                            style={active ? { color: item.color } : undefined}
                          >
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
          <div className="flex flex-col gap-1 pb-2">
            <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent mb-2" />
            <SidebarLink
              link={{
                label: t('navigation.settings'),
                href: '/settings',
                icon: (
                  <div className={`h-5 w-5 flex-shrink-0 transition-colors ${isActive('/settings') ? 'text-[#A989F2]' : 'text-slate-500 dark:text-slate-400'}`}>
                    <Settings className="h-5 w-5" />
                  </div>
                ),
              }}
            />
            <div onClick={() => signOut()} className="cursor-pointer">
              <SidebarLink
                link={{
                  label: t('navigation.logout'),
                  href: '#',
                  icon: <LogOut className="text-red-400 h-5 w-5 flex-shrink-0" />,
                }}
              />
            </div>
          </div>
        </SidebarBody>
      </AceternitySidebar>
    </div>
  );
};

export default Sidebar;
