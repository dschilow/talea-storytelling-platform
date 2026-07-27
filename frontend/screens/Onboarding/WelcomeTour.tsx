import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { useOptionalChildProfiles } from '../../contexts/ChildProfilesContext';
import { TaleaActionButton, taleaDisplayFont } from '@/components/talea/TaleaPastelPrimitives';
import {
  AvatarChapterDemo,
  CHAPTERS,
  DokuChapterBody,
  ParentsChapterBody,
  ReadingChapterDemo,
  StoryChapterDemo,
  TreasureChapterBody,
  type ChapterId,
} from './tourChapters';

interface Props {
  onFinish: () => void;
  /** Called when the user dismisses early; also counts as "seen". */
  onDismiss: () => void;
}

const SWIPE_THRESHOLD = 60;

export default function WelcomeTour({ onFinish, onDismiss }: Props) {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const childProfiles = useOptionalChildProfiles();
  const childName = childProfiles?.activeProfile?.name?.trim() || null;

  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const chapter = CHAPTERS[index];
  const isFirst = index === 0;
  const isLast = index === CHAPTERS.length - 1;

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= CHAPTERS.length) return;
      setDirection(next > index ? 1 : -1);
      setIndex(next);
    },
    [index]
  );

  const finishToAvatar = () => {
    onFinish();
    navigate('/avatar/create');
  };

  // Keyboard: arrows page through, Escape leaves.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDismiss();
        return;
      }
      if (event.key === 'ArrowRight') go(index + 1);
      if (event.key === 'ArrowLeft') go(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index, onDismiss]);

  // The tour covers the whole app — stop the page behind it from scrolling.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Move focus to the new chapter heading so screen readers follow along.
  useEffect(() => {
    headingRef.current?.focus();
  }, [index]);

  // Keep tab focus inside the dialog.
  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusables = node.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, []);

  const greeting = useMemo(() => {
    if (!childName) return 'Willkommen bei Talea';
    return `Willkommen, ${childName}`;
  }, [childName]);

  const body: Record<ChapterId, React.ReactNode> = {
    welcome: null,
    avatar: <AvatarChapterDemo />,
    story: <StoryChapterDemo />,
    reading: <ReadingChapterDemo />,
    doku: <DokuChapterBody />,
    treasure: <TreasureChapterBody />,
    parents: <ParentsChapterBody />,
    start: null,
  };

  // A page turn rather than a slide — the guide reads as a picture book.
  const pageVariants = reduce
    ? {
        enter: { opacity: 0 },
        center: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        enter: (dir: number) => ({ opacity: 0, x: dir * 46, rotateY: dir * 6 }),
        center: { opacity: 1, x: 0, rotateY: 0 },
        exit: (dir: number) => ({ opacity: 0, x: dir * -46, rotateY: dir * -6 }),
      };

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col overflow-hidden bg-[var(--talea-page-solid)]"
      role="dialog"
      aria-modal="true"
      aria-label="Willkommens-Guide"
      ref={dialogRef}
    >
      {/* Ambient wash — warm paper, not a flat backdrop. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-[18%] top-[-12%] h-[32rem] w-[32rem] rounded-full bg-[var(--primary)]/12 blur-[130px]" />
        <div className="absolute -right-[14%] top-[22%] h-[28rem] w-[28rem] rounded-full bg-[var(--talea-accent-peach)]/16 blur-[130px]" />
        <div className="absolute bottom-[-14%] left-[26%] h-[26rem] w-[26rem] rounded-full bg-[var(--talea-accent-sky)]/12 blur-[120px]" />
      </div>

      {/* Header: progress + exit */}
      <header className="relative z-10 flex items-center gap-4 px-4 pt-4 sm:px-8 sm:pt-6">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {CHAPTERS.map((entry, i) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Kapitel ${i + 1}: ${entry.eyebrow}`}
              aria-current={i === index ? 'step' : undefined}
              className="group relative h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--talea-border-light)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/18"
            >
              <motion.span
                className="absolute inset-y-0 left-0 rounded-full bg-[var(--primary)]"
                initial={false}
                animate={{ width: i < index ? '100%' : i === index ? '100%' : '0%', opacity: i <= index ? 1 : 0 }}
                transition={reduce ? { duration: 0.01 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--talea-text-secondary)] transition-colors hover:text-[var(--talea-text-primary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/18"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Überspringen
        </button>
      </header>

      {/* Stage */}
      <div className="relative z-10 flex flex-1 items-center justify-center overflow-y-auto px-4 py-6 sm:px-8">
        <div className="w-full max-w-2xl" style={{ perspective: 1400 }}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.article
              key={chapter.id}
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={reduce ? { duration: 0.12 } : { duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              drag={reduce ? false : 'x'}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.16}
              onDragEnd={(_, info) => {
                if (info.offset.x < -SWIPE_THRESHOLD) go(index + 1);
                if (info.offset.x > SWIPE_THRESHOLD) go(index - 1);
              }}
              className="relative"
            >
              <p className="relative text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--primary)]">
                {chapter.numeral ? `Kapitel ${chapter.numeral}` : chapter.eyebrow}
              </p>

              <h1
                ref={headingRef}
                tabIndex={-1}
                className="relative mt-3 text-[2rem] leading-[1.04] tracking-[-0.01em] text-[var(--talea-text-primary)] outline-none sm:text-[2.9rem]"
                style={{ fontFamily: taleaDisplayFont }}
              >
                {chapter.id === 'welcome' ? greeting : chapter.title}
              </h1>

              <p className="relative mt-3.5 max-w-xl text-[15px] leading-[1.7] text-[var(--talea-text-secondary)]">
                {chapter.id === 'welcome' ? CHAPTERS[0].lede : chapter.lede}
              </p>

              {/* The cover doubles as a table of contents: it tells the reader
                  up front how long this is and what it covers. */}
              {chapter.id === 'welcome' && (
                <ol className="relative mt-7 grid gap-x-8 gap-y-0.5 sm:grid-cols-2">
                  {CHAPTERS.filter((entry) => entry.numeral).map((entry, i) => (
                    <motion.li
                      key={entry.id}
                      initial={reduce ? false : { opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.22 + i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      className="flex items-baseline gap-3 border-b border-dashed border-[var(--talea-border-light)] py-2.5"
                    >
                      <span
                        className="w-7 shrink-0 text-sm text-[var(--primary)]"
                        style={{ fontFamily: taleaDisplayFont }}
                      >
                        {entry.numeral}
                      </span>
                      <span className="text-[15px] text-[var(--talea-text-primary)]">{entry.eyebrow}</span>
                    </motion.li>
                  ))}
                </ol>
              )}

              {body[chapter.id] && <div className="relative mt-6">{body[chapter.id]}</div>}

              {chapter.id === 'start' && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18 }}
                  className="relative mt-7"
                >
                  <TaleaActionButton
                    onClick={finishToAvatar}
                    icon={<Sparkles className="h-4 w-4" />}
                    className="w-full justify-center py-3.5 text-base sm:w-auto sm:px-8"
                  >
                    Ersten Avatar erstellen
                  </TaleaActionButton>
                  <button
                    type="button"
                    onClick={onFinish}
                    className="mt-3 block text-sm text-[var(--talea-text-secondary)] underline underline-offset-4 transition-colors hover:text-[var(--talea-text-primary)] focus-visible:outline-none"
                  >
                    Erstmal selbst umsehen
                  </button>
                </motion.div>
              )}
            </motion.article>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer nav */}
      <footer className="relative z-10 flex items-center justify-between gap-4 px-4 pb-6 sm:px-8 sm:pb-8">
        <TaleaActionButton
          variant="secondary"
          onClick={() => go(index - 1)}
          disabled={isFirst}
          icon={<ArrowLeft className="h-4 w-4" />}
          className={cn(isFirst && 'invisible')}
        >
          Zurück
        </TaleaActionButton>

        <span className="text-xs tabular-nums text-[var(--talea-text-tertiary)]">
          {index + 1} / {CHAPTERS.length}
        </span>

        {!isLast ? (
          <TaleaActionButton onClick={() => go(index + 1)} icon={<ArrowRight className="h-4 w-4" />}>
            {isFirst ? 'Los geht’s' : 'Weiter'}
          </TaleaActionButton>
        ) : (
          <TaleaActionButton variant="secondary" onClick={onFinish}>
            Fertig
          </TaleaActionButton>
        )}
      </footer>
    </div>
  );
}
