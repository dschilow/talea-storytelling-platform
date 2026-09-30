import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import { ArrowLeft, ChevronDown, Clock, Headphones } from 'lucide-react';

import type { Avatar, Chapter, Story } from '../../../types/story';
import { cn } from '../../../lib/utils';
import { StoryAudioActions } from '../../../components/story/StoryAudioActions';
import { AdminGenerationMetrics } from '../../../components/story/AdminGenerationMetrics';
import { StoryAlreadyReadNote } from '../../../components/story/StoryFinaleSheet';
import { ReaderChapter } from './ReaderChapter';
import { ImageLightbox } from './ImageLightbox';
import { estimateReadingMinutes, formatGenre, TEXT_SCALE_STEPS } from './readerText';
import {
  clearChapterPosition,
  readSavedChapter,
  saveChapterPosition,
  useTextScale,
} from './useReaderStorage';
import './StoryReader.css';

export interface StoryReaderCompletion {
  isCompleted: boolean;
  isCompleting: boolean;
  error: string | null;
  isRepeatRead: boolean;
  onComplete: () => void;
}

interface StoryReaderViewProps {
  story: Story;
  chapters: Chapter[];
  castMembers: Array<Partial<Avatar>>;
  isDark: boolean;
  isAdmin: boolean;
  isCharacterLifeStory: boolean;
  returnPath: string;
  returnLabel: string;
  onNavigate: (path: string) => void;
  completion: StoryReaderCompletion;
}

// Fixed positions instead of Math.random(): the hero must look the same on every render.
const HERO_PARTICLES = [
  { x: '14%', dur: '13s', delay: '0s' },
  { x: '31%', dur: '17s', delay: '4s' },
  { x: '47%', dur: '12s', delay: '8s' },
  { x: '63%', dur: '16s', delay: '2s' },
  { x: '79%', dur: '14s', delay: '6s' },
  { x: '90%', dur: '18s', delay: '10s' },
] as const;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const StoryReaderView: React.FC<StoryReaderViewProps> = ({
  story,
  chapters,
  castMembers,
  isDark,
  isAdmin,
  isCharacterLifeStory,
  returnPath,
  returnLabel,
  onNavigate,
  completion,
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const chapterEls = useRef<Array<HTMLElement | null>>([]);

  const language = story.config.language;
  const { scaleId, scale, setScaleId } = useTextScale();
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const [activeChapter, setActiveChapter] = useState(0);
  const [reading, setReading] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [coverFailed, setCoverFailed] = useState(false);
  const [savedChapter] = useState(() => readSavedChapter(story.id, chapters.length));

  const coverUrl = story.coverImageUrl || chapters.find((chapter) => chapter.imageUrl)?.imageUrl || null;
  const showCover = Boolean(coverUrl) && !coverFailed;
  const minutes = useMemo(() => estimateReadingMinutes(chapters), [chapters]);
  // Picture books number their "Seite N"; everything else is a chapter.
  const unitSingular = useMemo(
    () => (chapters.length > 0 && chapters.every((chapter) => /^\s*(seite|page)\b/i.test(chapter.title || '')) ? 'Seite' : 'Kapitel'),
    [chapters],
  );
  const unitPlural = unitSingular === 'Seite' ? 'Seiten' : 'Kapitel';
  const unitCount = chapters.length === 1 ? unitSingular : unitPlural;

  // The scroller exists from the first render of this component, so the ref is
  // always hydrated when useScroll subscribes (the loading screen lives in the parent).
  const { scrollY, scrollYProgress } = useScroll({ container: scrollerRef });
  const progressScale = useSpring(scrollYProgress, { stiffness: 120, damping: 34, restDelta: 0.001 });
  const progressOpacity = useTransform(scrollY, [0, 160], [0, 1]);

  const lastScrollY = useRef(0);
  useMotionValueEvent(scrollY, 'change', (y) => {
    const previous = lastScrollY.current;
    lastScrollY.current = y;

    // Immersive reading: the bar leaves while scrolling down, returns on scroll up.
    if (y < 120 || y < previous - 6) setHeaderHidden(false);
    else if (y > previous + 6) {
      setHeaderHidden(true);
      setSizeMenuOpen(false);
    }

    const heroHeight = heroRef.current?.offsetHeight ?? 0;
    setReading(y > heroHeight * 0.6);

    // The active chapter is the last one whose top edge has passed the upper third.
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const line = scroller.getBoundingClientRect().top + scroller.clientHeight * 0.33;
    let active = 0;
    chapterEls.current.forEach((element, index) => {
      if (element && element.getBoundingClientRect().top <= line) active = index;
    });
    setActiveChapter(active);
  });

  // Remember where the reader is — but only once they are past the hero, so
  // opening a story never overwrites the spot they are about to resume from.
  useEffect(() => {
    if (reading && !completion.isCompleted) saveChapterPosition(story.id, activeChapter);
  }, [reading, activeChapter, completion.isCompleted, story.id]);

  const registerChapter = useCallback((index: number, element: HTMLElement | null) => {
    chapterEls.current[index] = element;
  }, []);

  const scrollToChapter = useCallback((index: number) => {
    chapterEls.current[index]?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    });
  }, []);

  const handleStart = () => scrollToChapter(savedChapter ?? 0);

  // A finished story starts from the top next time.
  useEffect(() => {
    if (completion.isCompleted) clearChapterPosition(story.id);
  }, [completion.isCompleted, story.id]);

  const closeLightbox = useCallback(() => setLightbox(null), []);
  const openLightbox = useCallback((src: string, alt: string) => setLightbox({ src, alt }), []);

  const genre = formatGenre(story.config.genre);
  const eyebrow = [
    genre,
    `${chapters.length} ${unitCount}`,
    isCharacterLifeStory ? null : `ca. ${minutes} Min.`,
  ].filter(Boolean);

  return (
    <div
      className="rd-root rd-scope"
      data-theme={isDark ? 'dark' : 'light'}
      style={{ '--rd-scale': scale } as React.CSSProperties}
    >
      {/* Reading progress — fades in once the hero is left */}
      <motion.div
        className="rd-progress"
        style={{ scaleX: progressScale, opacity: progressOpacity }}
        aria-hidden="true"
      />

      <header className={cn('rd-header', headerHidden && 'rd-header--hidden')}>
        <button type="button" className="rd-icon-btn" onClick={() => onNavigate(returnPath)} aria-label={returnLabel}>
          <ArrowLeft className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>

        <div className="rd-header-title">
          <span className="rd-header-story">{story.title}</span>
          <span className="rd-header-meta">
            {reading && chapters.length > 1 ? `${unitSingular} ${activeChapter + 1} von ${chapters.length}` : eyebrow.join(' · ')}
          </span>
        </div>

        <button
          type="button"
          className={cn('rd-icon-btn', sizeMenuOpen && 'rd-icon-btn--active')}
          onClick={() => setSizeMenuOpen((open) => !open)}
          aria-label="Schriftgröße ändern"
          aria-haspopup="true"
          aria-expanded={sizeMenuOpen}
        >
          <span className="rd-aa" aria-hidden="true">Aa</span>
        </button>

        {sizeMenuOpen && (
          <div className="rd-menu" role="radiogroup" aria-label="Schriftgröße">
            {TEXT_SCALE_STEPS.map((step, stepIndex) => (
              <button
                key={step.id}
                type="button"
                role="radio"
                aria-checked={scaleId === step.id}
                aria-label={step.label}
                className={cn('rd-size-btn', scaleId === step.id && 'rd-size-btn--active')}
                onClick={() => setScaleId(step.id)}
              >
                <span style={{ fontSize: `${0.9 + stepIndex * 0.24}rem` }}>Aa</span>
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Outside the header on purpose: its transform/backdrop-filter would shrink a fixed child to the header box. */}
      {sizeMenuOpen && <div className="rd-menu-backdrop" onClick={() => setSizeMenuOpen(false)} aria-hidden="true" />}

      {/* Chapter dots (desktop) */}
      {reading && chapters.length > 1 && (
        <nav className="rd-chapter-nav" aria-label="Kapitel-Navigation">
          {chapters.map((chapter, index) => (
            <button
              key={chapter.id || index}
              type="button"
              onClick={() => scrollToChapter(index)}
              className={cn('rd-chapter-dot', activeChapter === index && 'rd-chapter-dot--active')}
              aria-label={`${unitSingular} ${index + 1}${chapter.title ? `: ${chapter.title}` : ''}`}
              aria-current={activeChapter === index ? 'true' : undefined}
              title={chapter.title || undefined}
            />
          ))}
        </nav>
      )}

      <div ref={scrollerRef} className="rd-scroller">
        {/* ── Hero ── */}
        <section ref={heroRef} className="rd-hero">
          {showCover && <div className="rd-hero-backdrop" style={{ backgroundImage: `url("${coverUrl}")` }} aria-hidden="true" />}
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

          <motion.div
            className="rd-hero-inner"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.2, 0.65, 0.3, 0.9] }}
          >
            {showCover && (
              <img
                src={coverUrl!}
                alt={`Titelbild: ${story.title}`}
                className="rd-hero-cover"
                onError={() => setCoverFailed(true)}
              />
            )}

            <p className="rd-eyebrow">
              {eyebrow.map((part, i) => (
                <React.Fragment key={String(part)}>
                  {i > 0 && <span className="rd-eyebrow-sep" aria-hidden="true">·</span>}
                  <span className={i === 0 ? 'rd-eyebrow-genre' : undefined}>
                    {i === eyebrow.length - 1 && !isCharacterLifeStory && <Clock className="rd-eyebrow-icon" aria-hidden="true" />}
                    {part}
                  </span>
                </React.Fragment>
              ))}
            </p>

            <h1 className="rd-hero-title">{story.title}</h1>
            {story.summary && <p className="rd-hero-summary">{story.summary}</p>}

            <motion.button
              type="button"
              onClick={handleStart}
              whileTap={{ scale: 0.97 }}
              className="rd-primary-btn"
            >
              {savedChapter !== null ? `Weiterlesen · ${unitSingular} ${savedChapter + 1}` : 'Geschichte lesen'}
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </motion.button>

            {chapters.length > 0 && !isCharacterLifeStory && (
              <div className="rd-hero-audio">
                <button
                  type="button"
                  className="rd-ghost-btn"
                  onClick={() => setAudioOpen((open) => !open)}
                  aria-expanded={audioOpen}
                  aria-controls="rd-audio-panel"
                >
                  <Headphones className="h-4 w-4" aria-hidden="true" />
                  Vorlesen lassen
                </button>
                {/* Stays mounted while collapsed so the panel keeps checking for existing audio. */}
                <div id="rd-audio-panel" className={cn('rd-collapse', audioOpen && 'rd-collapse--open')} inert={!audioOpen}>
                  <div className="rd-collapse-inner">
                    <StoryAudioActions
                      storyId={story.id}
                      storyTitle={story.title}
                      chapters={chapters}
                      coverImageUrl={story.coverImageUrl}
                    />
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </section>

        {/* ── Chapters ── */}
        <article className="rd-article">
          {chapters.map((chapter, index) => (
            <ReaderChapter
              key={chapter.id || `${chapter.title}-${index}`}
              chapter={chapter}
              index={index}
              language={language}
              onComplete={index === chapters.length - 1 ? completion.onComplete : undefined}
              isCompleted={completion.isCompleted}
              isCompleting={completion.isCompleting}
              completionError={completion.error}
              onOpenImage={openLightbox}
              registerElement={registerChapter}
            />
          ))}
        </article>

        {/* ── Cast ── */}
        {castMembers.length > 0 && (
          <section className="rd-cast" aria-labelledby="rd-cast-title">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5 }}
            >
              <h2 id="rd-cast-title" className="rd-cast-title">Die Helden dieser Geschichte</h2>
              <ul className="rd-cast-list">
                {castMembers.map((member, index) => (
                  <li key={`${member.id || member.name}-${index}`} className="rd-cast-item">
                    <span className="rd-cast-avatar">
                      {member.imageUrl ? (
                        <img src={member.imageUrl} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <span aria-hidden="true">{(member.name || '?').trim().charAt(0).toUpperCase()}</span>
                      )}
                    </span>
                    <span className="rd-cast-name">{member.name || 'Unbekannt'}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </section>
        )}

        {isAdmin && <AdminGenerationMetrics metadata={story.metadata} storyId={story.id} storyTitle={story.title} />}

        {/* ── Finale ── */}
        <section className="rd-finale">
          <motion.div
            className="rd-finale-inner"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="rd-ornament" aria-hidden="true">
              <span className="rd-ornament-line" />
              <span className="rd-ornament-diamond" />
              <span className="rd-ornament-line" />
            </span>
            <h2 className="rd-finale-title">Ende</h2>
            <p className="rd-finale-text">
              {isCharacterLifeStory
                ? 'Du kennst nun ein wichtiges Kapitel aus diesem Charakterleben.'
                : 'Du kannst zur Übersicht zurückkehren oder direkt die nächste Geschichte lesen.'}
            </p>
            <button type="button" onClick={() => onNavigate(returnPath)} className="rd-secondary-btn">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Zurück zur Übersicht
            </button>
            {completion.isRepeatRead && <StoryAlreadyReadNote isDark={isDark} />}
          </motion.div>
        </section>
      </div>

      <ImageLightbox src={lightbox?.src ?? null} alt={lightbox?.alt ?? ''} onClose={closeLightbox} />
    </div>
  );
};
