import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronDown, Clock, LoaderCircle, Sparkles, ArrowLeft } from 'lucide-react';

import type { Doku, DokuSection } from '../../../types/doku';
import { cn } from '../../../lib/utils';
import { QuizComponent } from '../../../components/reader/QuizComponent';
import { FactsComponent } from '../../../components/reader/FactsComponent';
import { ActivityComponent } from '../../../components/reader/ActivityComponent';
import { ImageLightbox } from '../../Story/reader/ImageLightbox';
import { canUseDropCap, estimateReadingMinutes } from '../../Story/reader/readerText';
import {
  ReaderHeader,
  ReaderHeroBackdrop,
  ReaderProgress,
  ReaderSectionNav,
  useReaderScroll,
} from '../../Story/reader/ReaderChrome';
import {
  clearChapterPosition,
  readSavedChapter,
  saveChapterPosition,
  useTextScale,
} from '../../Story/reader/useReaderStorage';
import '../../Story/reader/StoryReader.css';

export interface DokuReaderCompletion {
  isCompleted: boolean;
  isCompleting: boolean;
  error: string | null;
  onComplete: () => void;
}

interface DokuReaderViewProps {
  doku: Doku;
  dokuId: string;
  avatarId?: string;
  isDark: boolean;
  /** Jump straight to this section on open (e.g. `?open=quiz`). */
  initialSectionIndex: number | null;
  onNavigate: (path: string) => void;
  completion: DokuReaderCompletion;
}

const REVEAL = { duration: 0.55, ease: [0.2, 0.65, 0.3, 0.9] as [number, number, number, number] };

function splitParagraphs(text: string): string[] {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
}

export const DokuReaderView: React.FC<DokuReaderViewProps> = ({
  doku,
  dokuId,
  avatarId,
  isDark,
  initialSectionIndex,
  onNavigate,
  completion,
}) => {
  const sections = useMemo(() => doku.content?.sections ?? [], [doku.content?.sections]);
  // Separate key space from stories so a doku never resumes at a story's chapter.
  const positionKey = `doku:${doku.id}`;
  const {
    scrollerRef,
    heroRef,
    registerItem,
    scrollToItem,
    activeIndex,
    reading,
    headerHidden,
    progressScale,
    progressOpacity,
  } = useReaderScroll();
  const { scaleId, scale, setScaleId } = useTextScale();
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [coverFailed, setCoverFailed] = useState(false);
  const [savedSection] = useState(() => readSavedChapter(positionKey, sections.length));

  const coverUrl = !coverFailed ? doku.coverImageUrl || sections.find((section) => section.imageUrl)?.imageUrl || null : null;
  const minutes = useMemo(() => estimateReadingMinutes(sections), [sections]);
  const eyebrow = [doku.topic || 'Wissen', `${sections.length} ${sections.length === 1 ? 'Abschnitt' : 'Abschnitte'}`, `ca. ${minutes} Min.`];

  useEffect(() => {
    if (reading && !completion.isCompleted) saveChapterPosition(positionKey, activeIndex);
  }, [reading, activeIndex, completion.isCompleted, positionKey]);

  useEffect(() => {
    if (completion.isCompleted) clearChapterPosition(positionKey);
  }, [completion.isCompleted, positionKey]);

  useEffect(() => {
    if (initialSectionIndex === null) return;
    const timer = window.setTimeout(() => scrollToItem(initialSectionIndex), 160);
    return () => window.clearTimeout(timer);
  }, [initialSectionIndex, scrollToItem]);

  const openLightbox = useCallback((src: string, alt: string) => setLightbox({ src, alt }), []);
  const closeLightbox = useCallback(() => setLightbox(null), []);

  return (
    <div
      className="rd-root rd-scope rd-knowledge"
      data-theme={isDark ? 'dark' : 'light'}
      style={{ '--rd-scale': scale } as React.CSSProperties}
    >
      <ReaderProgress scale={progressScale} opacity={progressOpacity} />

      <ReaderHeader
        title={doku.title}
        meta={reading && sections.length > 1 ? `Abschnitt ${activeIndex + 1} von ${sections.length}` : eyebrow.join(' · ')}
        backLabel="Zurück zu Dokus"
        onBack={() => onNavigate('/doku')}
        hidden={headerHidden}
        scaleId={scaleId}
        onScaleChange={setScaleId}
      />

      {reading && sections.length > 1 && (
        <ReaderSectionNav
          ariaLabel="Abschnitt-Navigation"
          activeIndex={activeIndex}
          onSelect={scrollToItem}
          items={sections.map((section, index) => ({
            key: `${section.title}-${index}`,
            label: `Abschnitt ${index + 1}: ${section.title}`,
            title: section.title,
          }))}
        />
      )}

      <div ref={scrollerRef} className="rd-scroller">
        <section ref={heroRef} className="rd-hero">
          <ReaderHeroBackdrop coverUrl={coverUrl} />
          <motion.div
            className="rd-hero-inner"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.2, 0.65, 0.3, 0.9] }}
          >
            {coverUrl && (
              <img src={coverUrl} alt={`Titelbild: ${doku.title}`} className="rd-hero-cover" onError={() => setCoverFailed(true)} />
            )}
            <p className="rd-eyebrow">
              {eyebrow.map((part, i) => (
                <React.Fragment key={part}>
                  {i > 0 && <span className="rd-eyebrow-sep" aria-hidden="true">·</span>}
                  <span className={i === 0 ? 'rd-eyebrow-genre' : undefined}>
                    {i === eyebrow.length - 1 && <Clock className="rd-eyebrow-icon" aria-hidden="true" />}
                    {part}
                  </span>
                </React.Fragment>
              ))}
            </p>
            <h1 className="rd-hero-title">{doku.title}</h1>
            {doku.summary && <p className="rd-hero-summary">{doku.summary}</p>}
            <motion.button
              type="button"
              onClick={() => scrollToItem(savedSection ?? 0)}
              whileTap={{ scale: 0.97 }}
              className="rd-primary-btn"
            >
              {savedSection !== null ? `Weiterlesen · Abschnitt ${savedSection + 1}` : 'Wissen entdecken'}
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </motion.button>
          </motion.div>
        </section>

        <article className="rd-article">
          {sections.map((section, index) => (
            <DokuSectionView
              key={`${section.title}-${index}`}
              section={section}
              index={index}
              total={sections.length}
              doku={doku}
              dokuId={dokuId}
              avatarId={avatarId}
              isLast={index === sections.length - 1}
              completion={completion}
              onOpenImage={openLightbox}
              registerElement={registerItem}
            />
          ))}
        </article>

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
            <p className="rd-finale-text">Du kannst jederzeit weitere Dokus starten oder diese erneut lesen.</p>
            <button type="button" onClick={() => onNavigate('/doku')} className="rd-secondary-btn">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Zurück zur Übersicht
            </button>
          </motion.div>
        </section>
      </div>

      <ImageLightbox src={lightbox?.src ?? null} alt={lightbox?.alt ?? ''} onClose={closeLightbox} />
    </div>
  );
};

const DokuSectionView: React.FC<{
  section: DokuSection;
  index: number;
  total: number;
  doku: Doku;
  dokuId: string;
  avatarId?: string;
  isLast: boolean;
  completion: DokuReaderCompletion;
  onOpenImage: (src: string, alt: string) => void;
  registerElement: (index: number, element: HTMLElement | null) => void;
}> = ({ section, index, total, doku, dokuId, avatarId, isLast, completion, onOpenImage, registerElement }) => {
  const paragraphs = useMemo(() => splitParagraphs(section.content), [section.content]);
  const [imageFailed, setImageFailed] = useState(false);
  const imageAlt = `${section.title} – Illustration`;

  return (
    <section
      id={`section-${index}`}
      ref={(element) => registerElement(index, element)}
      className="rd-chapter"
      aria-labelledby={`section-${index}-title`}
    >
      <motion.header
        className="rd-chapter-head"
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={REVEAL}
      >
        <span className="rd-chapter-kicker">
          Abschnitt {index + 1} von {total}
        </span>
        <h2 id={`section-${index}-title`} className="rd-chapter-title">
          {section.title}
        </h2>
        <span className="rd-ornament" aria-hidden="true">
          <span className="rd-ornament-line" />
          <span className="rd-ornament-diamond" />
          <span className="rd-ornament-line" />
        </span>
      </motion.header>

      {/* Only a section's own picture — repeating the cover in every section added nothing. */}
      {section.imageUrl && !imageFailed ? (
        <motion.figure
          className="rd-figure"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={REVEAL}
        >
          <button type="button" className="rd-figure-btn" onClick={() => onOpenImage(section.imageUrl!, imageAlt)} aria-label={`${imageAlt} – vergrößern`}>
            <img
              src={section.imageUrl}
              alt=""
              className="rd-figure-img rd-figure-img--loaded"
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              onError={() => setImageFailed(true)}
            />
          </button>
        </motion.figure>
      ) : null}

      <div className="rd-prose">
        {paragraphs.map((paragraph, paragraphIndex) => (
          <motion.p
            key={paragraphIndex}
            className={cn('rd-paragraph', paragraphIndex === 0 && canUseDropCap(paragraph) && 'rd-dropcap')}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '0px 0px -6% 0px' }}
            transition={REVEAL}
          >
            {paragraph}
          </motion.p>
        ))}
      </div>

      <div className="rd-interactive">
        <FactsComponent section={section} variant="inline" />
        <ActivityComponent section={section} variant="inline" />
        <QuizComponent
          section={section}
          dokuTitle={doku.title}
          dokuId={dokuId}
          avatarId={avatarId}
          dokuTopic={doku.topic}
          dokuMetadata={doku.metadata}
          variant="inline"
          onPersonalityChange={(changes) => {
            import('../../../utils/toastUtils').then(({ showPersonalityUpdateToast }) => {
              showPersonalityUpdateToast(changes);
            });
          }}
        />
      </div>

      {isLast && (
        <div className="rd-complete">
          <button
            type="button"
            onClick={completion.onComplete}
            disabled={completion.isCompleted || completion.isCompleting}
            aria-busy={completion.isCompleting}
            className={cn('rd-complete-btn', completion.isCompleted && 'rd-complete-btn--done')}
          >
            {completion.isCompleting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : completion.isCompleted ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            )}
            {completion.isCompleted
              ? 'Abgeschlossen'
              : completion.isCompleting
                ? 'Fortschritt wird gespeichert …'
                : completion.error
                  ? 'Speichern erneut versuchen'
                  : 'Doku abschließen'}
          </button>
          {completion.error && !completion.isCompleted && (
            <p role="alert" className="rd-complete-error">
              {completion.error}
            </p>
          )}
        </div>
      )}
    </section>
  );
};
