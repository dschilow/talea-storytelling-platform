import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { NavIcon, type NavIconName } from '@/components/navigation/NavIcon';

interface NavItem {
  icon: NavIconName;
  /** Further paths that count as this tab (e.g. /quiz for the game room). */
  aliases?: string[];
  path: string;
  labelKey?: string;
  label?: string;
  /** A shorter visible label keeps narrow mobile tabs readable; aria-label stays complete. */
  compactLabel?: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: 'home', labelKey: 'navigation.home', path: '/' },
  { icon: 'stories', labelKey: 'navigation.stories', compactLabel: 'Lesen', path: '/stories', aliases: ['/originals', '/episode-reader'] },
  { icon: 'avatars', labelKey: 'navigation.avatars', path: '/avatar' },
  { icon: 'dokus', label: 'Dokus', path: '/doku' },
  { icon: 'game', label: 'Spiel', path: '/spiel', aliases: ['/quiz'] },
];

const MotionLink = motion.create(Link);
const PRESS_SPRING = { type: 'spring', stiffness: 460, damping: 30 } as const;

/** Mobile navigation stays within thumb reach and clears the audio mini player. */
const BottomNav: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  const isActive = (path: string, aliases: string[] = []) =>
    path === '/'
      ? location.pathname === '/'
      : [path, ...aliases].some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`));
  const labelOf = (item: NavItem) => item.label ?? (item.labelKey ? t(item.labelKey) : '');

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:hidden">
      <div className="pointer-events-auto flex items-center gap-2">
        <nav className="talea-glass grid h-16 min-w-0 flex-1 grid-cols-5 items-center rounded-full p-1" aria-label="Hauptnavigation">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path, item.aliases);
            return (
              <MotionLink
                key={item.path}
                to={item.path}
                className={cn(
                  'relative flex h-full min-w-0 flex-col items-center justify-center gap-[3px] rounded-full px-1 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--primary)]',
                  active ? 'text-[var(--primary)]' : 'text-[var(--talea-text-secondary)]'
                )}
                aria-label={labelOf(item)}
                aria-current={active ? 'page' : undefined}
                whileTap={reduceMotion ? undefined : { scale: 0.92 }}
                transition={PRESS_SPRING}
              >
                {active ? (
                  <motion.span
                    layoutId="talea-tab-active"
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]"
                    transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                  />
                ) : null}
                {/* Remounts on activation so the icon springs in, like iOS tab symbols. */}
                <motion.span
                  key={active ? 'active' : 'idle'}
                  className="relative flex"
                  initial={active && !reduceMotion ? { scale: 0.78 } : false}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 14 }}
                >
                  <NavIcon name={item.icon} active={active} className="h-[25px] w-[25px]" />
                </motion.span>
                <span
                  className={cn(
                    'relative max-w-full truncate text-[10.5px] leading-tight tracking-[-0.01em] min-[380px]:text-[11px]',
                    active ? 'font-semibold' : 'font-medium'
                  )}
                >
                  {item.compactLabel ? (
                    <>
                      <span className="min-[480px]:hidden">{t('navigation.read', item.compactLabel)}</span>
                      <span className="hidden min-[480px]:inline">{labelOf(item)}</span>
                    </>
                  ) : labelOf(item)}
                </span>
              </MotionLink>
            );
          })}
        </nav>

        <motion.button
          type="button"
          onClick={() => window.dispatchEvent(new Event('tavi:open'))}
          className="talea-glass flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          aria-label="Tavi fragen"
          whileTap={reduceMotion ? undefined : { scale: 0.92 }}
          transition={PRESS_SPRING}
        >
          <NavIcon name="tavi" active className="h-8 w-8" />
        </motion.button>
      </div>
    </div>
  );
};

export default BottomNav;
