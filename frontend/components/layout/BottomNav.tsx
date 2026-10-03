import React from 'react';
import { Bot, BookOpen, FlaskConical, Gamepad2, Home, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { WizardImage } from '@/components/avatar-form/WizardImage';
import { useWizardAssets } from '@/hooks/useWizardAssets';

interface NavItem {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /** Wizard-asset id within the "navTab" group; renders a Talea illustration instead of the icon. */
  imageId?: string;
  /** Static illustration (public/) instead of a wizard asset. */
  imageSrc?: string;
  /** Further paths that count as this tab (e.g. /quiz for the game room). */
  aliases?: string[];
  path: string;
  labelKey?: string;
  label?: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: Home, imageId: 'home', labelKey: 'navigation.home', path: '/' },
  { icon: BookOpen, imageId: 'stories', labelKey: 'navigation.stories', path: '/stories' },
  { icon: User, imageId: 'avatars', labelKey: 'navigation.avatars', path: '/avatar' },
  { icon: FlaskConical, imageId: 'dokus', label: 'Dokus', path: '/doku' },
  { icon: Gamepad2, imageSrc: '/game/nav/spiel.webp', label: 'Spiel', path: '/spiel', aliases: ['/quiz'] },
];

/**
 * Mobile tab bar in the current iOS style: a floating glass capsule with the
 * active tab on its own lighter capsule, and Tavi as a separate round button
 * next to it (where iOS puts search). Audio lives in GlobalAudioPlayer, which
 * floats its mini player above this bar.
 */
const BottomNav: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const { assetUrl } = useWizardAssets();

  const isActive = (path: string, aliases: string[] = []) =>
    path === '/'
      ? location.pathname === '/'
      : [path, ...aliases].some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`));
  const labelOf = (item: NavItem) => item.label ?? (item.labelKey ? t(item.labelKey) : '');

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:hidden">
      <div className="pointer-events-auto flex items-center gap-1.5">
        <nav className="talea-glass flex h-[62px] min-w-0 flex-1 items-center rounded-full p-[3px]" aria-label="Hauptnavigation">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path, item.aliases);
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className="relative flex h-full min-w-0 flex-auto flex-col items-center justify-center gap-0.5 rounded-full px-1.5"
                aria-label={labelOf(item)}
                aria-current={active ? 'page' : undefined}
              >
                {active ? (
                  <motion.span
                    layoutId="talea-tab-active"
                    className="absolute inset-0 rounded-full bg-[color-mix(in_srgb,var(--primary)_14%,var(--talea-surface-primary))]"
                    transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                  />
                ) : null}
                <span
                  className={cn(
                    'relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-[8px] transition-[opacity,filter] duration-200',
                    active ? 'opacity-100' : 'opacity-75 saturate-[0.7]'
                  )}
                >
                  <WizardImage
                    url={item.imageSrc ?? assetUrl('navTab', item.imageId as string)}
                    fallback={<Icon className={cn('h-[22px] w-[22px]', active ? 'text-[var(--primary)]' : 'text-[var(--talea-text-secondary)]')} />}
                    alt=""
                    fallbackClassName="flex h-full w-full items-center justify-center"
                  />
                </span>
                <span
                  className={cn(
                    'relative max-w-full truncate text-[10px] leading-tight tracking-[-0.015em]',
                    active ? 'font-semibold text-[var(--primary)]' : 'font-medium text-[var(--talea-text-secondary)]'
                  )}
                >
                  {labelOf(item)}
                </span>
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event('tavi:open'))}
          className="talea-glass flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
          aria-label="Tavi fragen"
        >
          <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-[9px]">
            <WizardImage
              url={assetUrl('navTab', 'tavi')}
              fallback={<Bot className="h-6 w-6 text-[var(--primary)]" />}
              alt=""
              fallbackClassName="flex h-full w-full items-center justify-center"
            />
          </span>
        </button>
      </div>
    </div>
  );
};

export default BottomNav;
