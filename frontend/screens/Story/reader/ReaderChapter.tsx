import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { LoaderCircle, Sparkles, Check } from 'lucide-react';

import type { Chapter } from '../../../types/story';
import { cn } from '../../../lib/utils';
import { buildChapterTextSegments, resolveChapterImageInsertPoints, splitBookParagraphs } from '../../../utils/chapterImagePlacement';
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
  /** Chapter books: a quiet line after the chapter (bookmark / good-night stop). */
  endNote?: string;
  /** Chapter books: paragraphs (0-based) after which a picture is still being painted. */
  pendingPictures?: number[];
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
  endNote,
  pendingPictures,
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
  // Chapter books place each picture after a stored paragraph; other stories get the two-slot layout.
  // A chapter book chapter whose pictures are still being painted is laid out the same way already,
  // so the text does not reflow when they arrive.
  const bookImages = Array.isArray(chapter.images) && chapter.images.length > 0 ? chapter.images : null;
  const waitingFor = bookImages ? [] : pendingPictures || [];
  const bookLayout = Boolean(bookImages) || waitingFor.length > 0;
  const primaryImage = bookLayout ? null : chapter.imageUrl || null;
  const scenicImage = bookLayout ? null : chapter.scenicImageUrl || null;

  const paragraphs = useMemo(
    () =>
      bookLayout
        ? splitBookParagraphs(String(chapter.content || ''))
        : buildChapterTextSegments(String(chapter.content || ''), Boolean(primaryImage), Boolean(scenicImage), {
            splitMidSentence: false,
          }),
    [chapter.content, primaryImage, scenicImage, bookLayout],
  );
  const insertPoints = resolveChapterImageInsertPoints(paragraphs.length, Boolean(primaryImage), Boolean(scenicImage));
  const bookImagesAfter = (paragraphIndex: number) =>
    (bookImages || []).filter((image) => Math.min(image.afterParagraph, paragraphs.length - 1) === paragraphIndex);

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
            {bookImagesAfter(paragraphIndex).map((image) => (
              <React.Fragment key={image.url}>{renderFigure(image.url, 'Szene')}</React.Fragment>
            ))}
            {waitingFor
              .filter((after) => Math.min(after, paragraphs.length - 1) === paragraphIndex)
              .map((after, pictureIndex) => (
                <figure key={`pending-${after}-${pictureIndex}`} className="rd-figure" aria-hidden="true">
                  <div className="rd-figure-pending">
                    <Sparkles className="h-5 w-5" />
                    <span>Bild wird gemalt …</span>
                  </div>
                </figure>
              ))}
          </React.Fragment>
        ))}
      </div>

      {endNote && <p className="rd-chapter-endnote">{endNote}</p>}

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
