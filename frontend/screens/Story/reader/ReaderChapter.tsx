import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { LoaderCircle, Sparkles, Check } from 'lucide-react';

import type { Chapter } from '../../../types/story';
import { cn } from '../../../lib/utils';
import { buildChapterTextSegments, resolveChapterImageInsertPoints } from '../../../utils/chapterImagePlacement';
import { canUseDropCap, describeChapterHeading } from './readerText';

interface ReaderChapterProps {
  chapter: Chapter;
  index: number;
  language?: string;
  /** Set on the last chapter only — it hosts the completion trigger. */
  onComplete?: () => void;
  isCompleted?: boolean;
  isCompleting?: boolean;
  completionError?: string | null;
  onOpenImage: (src: string, alt: string) => void;
  registerElement: (index: number, element: HTMLElement | null) => void;
}

const REVEAL = { duration: 0.55, ease: [0.2, 0.65, 0.3, 0.9] as [number, number, number, number] };

export const ReaderChapter: React.FC<ReaderChapterProps> = ({
  chapter,
  index,
  language,
  onComplete,
  isCompleted,
  isCompleting,
  completionError,
  onOpenImage,
  registerElement,
}) => {
  // Auto-completion: when the child scrolls to the end of the LAST chapter,
  // save the progress and show the rewards without requiring a button tap —
  // kids simply do not press "Geschichte abschließen". The button stays as a
  // visible status + manual retry fallback (e.g. after a network error).
  const completionZoneRef = useRef<HTMLDivElement>(null);
  const completionZoneInView = useInView(completionZoneRef, { amount: 0.6 });
  const autoCompleteFiredRef = useRef(false);
  const autoCompleteTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (autoCompleteTimerRef.current !== null) window.clearTimeout(autoCompleteTimerRef.current);
  }, []);
  useEffect(() => {
    if (!onComplete || isCompleted || isCompleting) return;
    if (!completionZoneInView || autoCompleteFiredRef.current) return;
    // Fire exactly once; the timer must survive unrelated parent re-renders,
    // so it is only cleared on unmount (onComplete itself is idempotent).
    autoCompleteFiredRef.current = true;
    autoCompleteTimerRef.current = window.setTimeout(() => onComplete(), 700);
  }, [completionZoneInView, onComplete, isCompleted, isCompleting]);

  const heading = describeChapterHeading(chapter, index, language);
  const primaryImage = chapter.imageUrl || null;
  const scenicImage = chapter.scenicImageUrl || null;

  const paragraphs = useMemo(
    () =>
      buildChapterTextSegments(String(chapter.content || ''), Boolean(primaryImage), Boolean(scenicImage), {
        splitMidSentence: false,
      }),
    [chapter.content, primaryImage, scenicImage],
  );
  const insertPoints = resolveChapterImageInsertPoints(paragraphs.length, Boolean(primaryImage), Boolean(scenicImage));

  const renderFigure = (src: string, kind: 'Szene' | 'Umgebung') => {
    const alt = `${heading.title || heading.kicker} – ${kind}`;
    return (
      <motion.figure
        className="rd-figure"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={REVEAL}
      >
        <FigureImage src={src} alt={alt} eager={index === 0} onOpen={() => onOpenImage(src, alt)} />
      </motion.figure>
    );
  };

  return (
    <section
      id={`chapter-${index}`}
      ref={(element) => registerElement(index, element)}
      className="rd-chapter"
      aria-labelledby={`chapter-${index}-title`}
    >
      <motion.header
        className="rd-chapter-head"
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={REVEAL}
      >
        <span className="rd-chapter-kicker">{heading.kicker}</span>
        {heading.title ? (
          <h2 id={`chapter-${index}-title`} className="rd-chapter-title">
            {heading.title}
          </h2>
        ) : (
          <h2 id={`chapter-${index}-title`} className="rd-visually-hidden">
            {heading.kicker}
          </h2>
        )}
        <span className="rd-ornament" aria-hidden="true">
          <span className="rd-ornament-line" />
          <span className="rd-ornament-diamond" />
          <span className="rd-ornament-line" />
        </span>
      </motion.header>

      <div className="rd-prose" lang={language || 'de'}>
        {paragraphs.map((paragraph, paragraphIndex) => (
          <React.Fragment key={`${chapter.id || index}-p-${paragraphIndex}`}>
            <motion.p
              className={cn('rd-paragraph', paragraphIndex === 0 && canUseDropCap(paragraph) && 'rd-dropcap')}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '0px 0px -6% 0px' }}
              transition={REVEAL}
            >
              {paragraph}
            </motion.p>

            {primaryImage && insertPoints.primaryAfterSegment === paragraphIndex && renderFigure(primaryImage, 'Szene')}
            {scenicImage && insertPoints.scenicAfterSegment === paragraphIndex && renderFigure(scenicImage, 'Umgebung')}
          </React.Fragment>
        ))}
      </div>

      {onComplete && (
        <motion.div
          ref={completionZoneRef}
          className="rd-complete"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <button
            type="button"
            onClick={onComplete}
            disabled={isCompleted || isCompleting}
            aria-busy={isCompleting}
            className={cn('rd-complete-btn', isCompleted && 'rd-complete-btn--done')}
          >
            {isCompleting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : isCompleted ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            )}
            {isCompleted
              ? 'Abgeschlossen'
              : isCompleting
                ? 'Fortschritt wird gespeichert …'
                : completionError
                  ? 'Speichern erneut versuchen'
                  : 'Geschichte abschließen'}
          </button>
          {completionError && !isCompleted && (
            <p role="alert" className="rd-complete-error">
              {completionError}
            </p>
          )}
        </motion.div>
      )}
    </section>
  );
};

/**
 * Square illustration that reserves its space up front (no layout jump while it
 * loads), fades in once decoded and opens full-screen on tap.
 */
const FigureImage: React.FC<{ src: string; alt: string; eager: boolean; onOpen: () => void }> = ({
  src,
  alt,
  eager,
  onOpen,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Cached images can finish before React attaches onLoad.
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) setLoaded(true);
  }, [src]);

  // A broken illustration is worse than none: collapse instead of showing an icon.
  if (failed) return null;

  return (
    <button type="button" className="rd-figure-btn" onClick={onOpen} aria-label={`${alt} – vergrößern`}>
      <img
        ref={imgRef}
        src={src}
        alt=""
        className={cn('rd-figure-img', loaded && 'rd-figure-img--loaded')}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </button>
  );
};
