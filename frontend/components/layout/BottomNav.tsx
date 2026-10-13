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
  /** Further paths that count as this tab (e.g. /quiz for the game room). */
  aliases?: string[];
  path: string;
  labelKey?: string;
  label?: string;
  /** A shorter visible label keeps narrow mobile tabs readable; aria-label stays complete. */
  compactLabel?: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: Home, imageId: 'home', labelKey: 'navigation.home', path: '/' },
  { icon: BookOpen, imageId: 'stories', labelKey: 'navigation.stories', compactLabel: 'Lesen', path: '/stories' },
  { icon: User, imageId: 'avatars', labelKey: 'navigation.avatars', path: '/avatar' },
  { icon: FlaskConical, imageId: 'dokus', label: 'Dokus', path: '/doku' },
  { icon: Gamepad2, imageId: 'quiz', label: 'Spiel', path: '/spiel', aliases: ['/quiz'] },
];

/** Mobile navigation stays within thumb reach and clears the audio mini player. */
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
        <nav className="talea-glass grid h-16 min-w-0 flex-1 grid-cols-5 items-center rounded-full p-[3px]" aria-label="Hauptnavigation">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path, item.aliases);
            const Icon = item.icon;
            return (
              <motion.button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className="relative flex h-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-1 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--primary)]"
                aria-label={labelOf(item)}
                aria-current={active ? 'page' : undefined}
                whileTap={reduceMotion ? undefined : { scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 460, damping: 30 }}
              >
                {active ? (
                  <motion.span
                    layoutId="talea-tab-active"
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full border border-[color-mix(in_srgb,var(--primary)_18%,transparent)] bg-[var(--talea-accent-terracotta-soft)]"
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
                    url={assetUrl('navTab', item.imageId as string)}
                    fallback={<Icon className={cn('h-[22px] w-[22px]', active ? 'text-[var(--primary)]' : 'text-[var(--talea-text-secondary)]')} />}
                    alt=""
                    fallbackClassName="flex h-full w-full items-center justify-center"
                  />
                </span>
                <span
                  className={cn(
                    'relative max-w-full truncate text-[10px] leading-tight tracking-[-0.015em] min-[380px]:text-[11px]',
                    active ? 'font-semibold text-[var(--primary)]' : 'font-medium text-[var(--talea-text-secondary)]'
                  )}
                >
                  {item.compactLabel ? (
                    <>
                      <span className="min-[480px]:hidden">{t('navigation.read', item.compactLabel)}</span>
                      <span className="hidden min-[480px]:inline">{labelOf(item)}</span>
                    </>
                  ) : labelOf(item)}
                </span>
              </motion.button>
            );
          })}
        </nav>

        <motion.button
          type="button"
          onClick={() => window.dispatchEvent(new Event('tavi:open'))}
          className="talea-glass flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-[color-mix(in_srgb,var(--primary)_24%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          aria-label="Tavi fragen"
          whileTap={reduceMotion ? undefined : { scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 460, damping: 30 }}
        >
          <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-[9px]">
            <WizardImage
              url={assetUrl('navTab', 'tavi')}
              fallback={<Bot className="h-6 w-6 text-[var(--primary)]" />}
              alt=""
              fallbackClassName="flex h-full w-full items-center justify-center"
            />
          </span>
        </motion.button>
      </div>
    </div>
  );
};

export default BottomNav;
