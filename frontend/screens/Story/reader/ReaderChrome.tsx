import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

import { cn } from '../../../lib/utils';
import { TEXT_SCALE_STEPS, type TextScaleId } from './readerText';

/*
 * Shared "chrome" of the story and doku readers: scroll tracking, reading
 * progress, the auto-hiding header with the text-size menu, the section dots
 * and the cinematic hero backdrop. Both readers render their own content.
 */

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Scroll state of a reader. Must be used by a component whose scroller exists
 * on first render (the loading screen lives in the route component), so the ref
 * is hydrated when useScroll subscribes.
 */
export function useReaderScroll() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const itemEls = useRef<Array<HTMLElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reading, setReading] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);

  const { scrollY, scrollYProgress } = useScroll({ container: scrollerRef });
  const progressScale = useSpring(scrollYProgress, { stiffness: 120, damping: 34, restDelta: 0.001 });
  const progressOpacity = useTransform(scrollY, [0, 160], [0, 1]);

  const lastScrollY = useRef(0);
  useMotionValueEvent(scrollY, 'change', (y) => {
    const previous = lastScrollY.current;
    lastScrollY.current = y;

    // Immersive reading: the bar leaves while scrolling down, returns on scroll up.
    if (y < 120 || y < previous - 6) setHeaderHidden(false);
    else if (y > previous + 6) setHeaderHidden(true);

    const heroHeight = heroRef.current?.offsetHeight ?? 0;
    setReading(y > heroHeight * 0.6);

    // The active item is the last one whose top edge has passed the upper third.
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const line = scroller.getBoundingClientRect().top + scroller.clientHeight * 0.33;
    let active = 0;
    itemEls.current.forEach((element, index) => {
      if (element && element.getBoundingClientRect().top <= line) active = index;
    });
    setActiveIndex(active);
  });

  const registerItem = useCallback((index: number, element: HTMLElement | null) => {
    itemEls.current[index] = element;
  }, []);

  const scrollToItem = useCallback((index: number) => {
    itemEls.current[index]?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    });
  }, []);

  return {
    scrollerRef,
    heroRef,
    registerItem,
    scrollToItem,
    activeIndex,
    reading,
    headerHidden,
    progressScale,
    progressOpacity,
  };
}

/** Reading progress — fades in once the hero is left. */
export const ReaderProgress: React.FC<{ scale: MotionValue<number>; opacity: MotionValue<number> }> = ({ scale, opacity }) => (
  <motion.div className="rd-progress" style={{ scaleX: scale, opacity }} aria-hidden="true" />
);

export const ReaderHeader: React.FC<{
  title: string;
  meta: string;
  backLabel: string;
  onBack: () => void;
  hidden: boolean;
  scaleId: TextScaleId;
  onScaleChange: (id: TextScaleId) => void;
}> = ({ title, meta, backLabel, onBack, hidden, scaleId, onScaleChange }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (hidden) setMenuOpen(false);
  }, [hidden]);

  return (
    <>
      <header className={cn('rd-header', hidden && 'rd-header--hidden')}>
        <button type="button" className="rd-icon-btn" onClick={onBack} aria-label={backLabel}>
          <ArrowLeft className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>

        <div className="rd-header-title">
          <span className="rd-header-story">{title}</span>
          <span className="rd-header-meta">{meta}</span>
        </div>

        <button
          type="button"
          className={cn('rd-icon-btn', menuOpen && 'rd-icon-btn--active')}
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Schriftgröße ändern"
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          <span className="rd-aa" aria-hidden="true">Aa</span>
        </button>

        {menuOpen && (
          <div className="rd-menu" role="radiogroup" aria-label="Schriftgröße">
            {TEXT_SCALE_STEPS.map((step, stepIndex) => (
              <button
                key={step.id}
                type="button"
                role="radio"
                aria-checked={scaleId === step.id}
                aria-label={step.label}
                className={cn('rd-size-btn', scaleId === step.id && 'rd-size-btn--active')}
                onClick={() => onScaleChange(step.id)}
              >
                <span style={{ fontSize: `${0.9 + stepIndex * 0.24}rem` }}>Aa</span>
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Outside the header on purpose: its transform/backdrop-filter would shrink a fixed child to the header box. */}
      {menuOpen && <div className="rd-menu-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
    </>
  );
};

/** Section dots on the right edge (desktop only, see CSS). */
export const ReaderSectionNav: React.FC<{
  items: Array<{ key: string; label: string; title?: string }>;
  activeIndex: number;
  onSelect: (index: number) => void;
  ariaLabel: string;
}> = ({ items, activeIndex, onSelect, ariaLabel }) => (
  <nav className="rd-chapter-nav" aria-label={ariaLabel}>
    {items.map((item, index) => (
      <button
        key={item.key}
        type="button"
        onClick={() => onSelect(index)}
        className={cn('rd-chapter-dot', activeIndex === index && 'rd-chapter-dot--active')}
        aria-label={item.label}
        aria-current={activeIndex === index ? 'true' : undefined}
        title={item.title}
      />
    ))}
  </nav>
);

// Fixed positions instead of Math.random(): the hero must look the same on every render.
const HERO_PARTICLES = [
  { x: '14%', dur: '13s', delay: '0s' },
  { x: '31%', dur: '17s', delay: '4s' },
  { x: '47%', dur: '12s', delay: '8s' },
  { x: '63%', dur: '16s', delay: '2s' },
  { x: '79%', dur: '14s', delay: '6s' },
  { x: '90%', dur: '18s', delay: '10s' },
] as const;

/** Blurred cover, scrim and floating particles behind the hero content. */
export const ReaderHeroBackdrop: React.FC<{ coverUrl: string | null }> = ({ coverUrl }) => (
  <>
    {coverUrl && <div className="rd-hero-backdrop" style={{ backgroundImage: `url("${coverUrl}")` }} aria-hidden="true" />}
    <div className="rd-hero-scrim" aria-hidden="true" />
    <div className="rd-hero-particles" aria-hidden="true">
      {HERO_PARTICLES.map((particle) => (
        <i
          key={particle.x}
          className="rd-particle"
          style={{ '--x': particle.x, '--dur': particle.dur, '--delay': particle.delay } as React.CSSProperties}
        />
      ))}
    </div>
  </>
);
