import React, { useId, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { NavIcon, type NavIconName } from '@/components/navigation/NavIcon';

export interface IconTabItem<T extends string> {
  id: T;
  label: string;
  icon: NavIconName;
  /** Shown after the label, e.g. how many dokus a tab holds. */
  count?: React.ReactNode;
}

interface IconTabsProps<T extends string> {
  items: IconTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Accessible name of the tab list. */
  label: string;
  /** Prefix for the tab element ids; panels reference them through `iconTabId`. */
  idBase: string;
  /** Id of the panel a tab controls. */
  panelId: (id: T) => string;
  className?: string;
}

export const iconTabId = (idBase: string, id: string) => `${idBase}-tab-${id}`;

/**
 * Segmented tabs that lead with a picture, like the bottom navigation: a child
 * who cannot read yet recognises "Hörwelt" by its headphones. The label stays
 * underneath for everyone else and names the tab for screen readers.
 */
export function IconTabs<T extends string>({ items, value, onChange, label, idBase, panelId, className }: IconTabsProps<T>) {
  const reduceMotion = useReducedMotion();
  const highlightId = `icon-tabs-${useId()}`;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = items.length - 1;
    const next =
      event.key === 'ArrowRight' || event.key === 'ArrowDown' ? (index === last ? 0 : index + 1)
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? (index === 0 ? last : index - 1)
          : event.key === 'Home' ? 0
            : event.key === 'End' ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    onChange(items[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('grid grid-flow-col auto-cols-fr gap-0.5 rounded-[1.1rem] bg-[var(--talea-surface-inset)] p-1', className)}
    >
      {items.map((item, index) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            ref={(node) => { tabRefs.current[index] = node; }}
            type="button"
            role="tab"
            id={iconTabId(idBase, item.id)}
            aria-selected={active}
            aria-controls={panelId(item.id)}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'relative flex min-h-[3.75rem] min-w-0 flex-col items-center justify-center gap-1 rounded-[0.85rem] px-1.5 py-1.5 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--primary)]',
              active ? 'text-[var(--primary)]' : 'text-[var(--talea-text-secondary)] hover:text-[var(--talea-text-primary)]'
            )}
          >
            {active ? (
              <motion.span
                layoutId={highlightId}
                aria-hidden="true"
                className="absolute inset-0 rounded-[0.85rem] bg-[var(--talea-accent-terracotta-soft)] shadow-[var(--talea-shadow-soft)]"
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
              />
            ) : null}
            {/* Remounts on activation so the picture springs in, like the tab bar. */}
            <motion.span
              key={active ? 'active' : 'idle'}
              className="relative flex"
              initial={active && !reduceMotion ? { scale: 0.78 } : false}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 520, damping: 14 }}
            >
              <NavIcon name={item.icon} active={active} className="h-[26px] w-[26px]" />
            </motion.span>
            <span className="relative flex max-w-full items-baseline gap-1 text-[13px] leading-tight">
              <span className={cn('truncate', active ? 'font-semibold' : 'font-medium')}>{item.label}</span>
              {item.count !== undefined ? (
                <span className="shrink-0 text-[11.5px] font-medium tabular-nums text-[var(--talea-text-tertiary)]">{item.count}</span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default IconTabs;
