import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, ChevronDown, LoaderCircle, Sparkles } from 'lucide-react';

import type { Doku } from '../../../types/doku';
import { cn } from '../../../lib/utils';
import { ImageLightbox } from '../../Story/reader/ImageLightbox';
import { estimateReadingMinutes } from '../../Story/reader/readerText';
import { ReaderHeader, ReaderProgress, ReaderSectionNav, useReaderScroll } from '../../Story/reader/ReaderChrome';
import {
  clearChapterPosition,
  readSavedChapter,
  saveChapterPosition,
  useTextScale,
} from '../../Story/reader/useReaderStorage';
import {
  GuessCard,
  GuessReveal,
  RecapChecklist,
  ReportAssignment,
  ReportChapter,
  splitParagraphs,
  TaviLine,
  WowList,
} from './DokuReport';
import '../../Story/reader/StoryReader.css';
import './DokuReport.css';

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

/**
 * Doku reader in the reportage format (see DokuReport.tsx). Shares the scroll
 * chrome with the story reader; the look is its own (DokuReport.css).
 */
export const DokuReaderView: React.FC<DokuReaderViewProps> = ({
  doku,
  dokuId,
  avatarId,
  isDark,
  initialSectionIndex,
  onNavigate,
  completion,
}) => {
  const content = doku.content;
  const sections = useMemo(() => content?.sections ?? [], [content?.sections]);
  const hook = useMemo(() => splitParagraphs(content?.hook ?? ''), [content?.hook]);
  const guess = content?.guess;
  const recap = content?.recap ?? [];
  // Older dokus carry a closing image ("finale") and loose wow facts instead of the recap.
  const closing = content?.closingLine || content?.finale || '';
  const wowFallback = recap.length === 0 ? content?.wowFacts ?? [] : [];
  const stations = sections.filter((section) => section.kind === 'station' || Boolean(section.place)).length;

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
  const [guessPick, setGuessPick] = useState<number | null>(null);

  const coverUrl = !coverFailed ? doku.coverImageUrl || sections.find((section) => section.imageUrl)?.imageUrl || null : null;
  const minutes = useMemo(() => estimateReadingMinutes(sections), [sections]);
  const eyebrow = [
    doku.topic || 'Wissen',
    stations > 0 ? `${stations} ${stations === 1 ? 'Station' : 'Stationen'}` : `${sections.length} Kapitel`,
    `ca. ${minutes} Min.`,
  ];
  const hasIntro = hook.length > 0 || Boolean(guess);

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

  const startReading = () => {
    if (savedSection !== null) return scrollToItem(savedSection);
    if (hasIntro) {
      document.getElementById('rp-start')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    scrollToItem(0);
  };

  const quizContext = useMemo(
    () => ({ avatarId, dokuTitle: doku.title, dokuId, dokuTopic: doku.topic, dokuMetadata: doku.metadata }),
    [avatarId, doku.title, dokuId, doku.topic, doku.metadata],
  );

  return (
    <div
      className="rd-root rd-scope rd-knowledge rp-root"
      data-theme={isDark ? 'dark' : 'light'}
      style={{ '--rd-scale': scale } as React.CSSProperties}
    >
      <ReaderProgress scale={progressScale} opacity={progressOpacity} />

      <ReaderHeader
        title={doku.title}
        meta={reading && sections.length > 1 ? `Kapitel ${activeIndex + 1} von ${sections.length}` : eyebrow.join(' · ')}
        backLabel="Zurück zu Dokus"
        onBack={() => onNavigate('/doku')}
        hidden={headerHidden}
        scaleId={scaleId}
        onScaleChange={setScaleId}
      />

      {reading && sections.length > 1 && (
        <ReaderSectionNav
          ariaLabel="Kapitel-Navigation"
          activeIndex={activeIndex}
          onSelect={scrollToItem}
          items={sections.map((section, index) => ({
            key: `${section.title}-${index}`,
            label: `Kapitel ${index + 1}: ${section.title}`,
            title: section.title,
          }))}
        />
      )}

      <div ref={scrollerRef} className="rd-scroller">
        <section ref={heroRef} className="rp-hero">
          <motion.div
            className="rp-hero-inner"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.2, 0.65, 0.3, 0.9] }}
          >
            <p className="rp-stamp-pill">Reportage</p>
            {coverUrl && (
              <div className="rp-polaroid">
                <span className="rp-tape" aria-hidden="true" />
                <img src={coverUrl} alt={`Titelbild: ${doku.title}`} onError={() => setCoverFailed(true)} />
              </div>
            )}
            <p className="rp-eyebrow">{eyebrow.join(' · ')}</p>
            <h1 className="rp-hero-title">{doku.title}</h1>
            {doku.summary && <p className="rp-hero-summary">{doku.summary}</p>}
            {content?.mainQuestion && <ReportAssignment question={content.mainQuestion} />}
            <button type="button" onClick={startReading} className="rp-primary-btn">
              {savedSection !== null ? `Weiterlesen · Kapitel ${savedSection + 1}` : 'Check starten'}
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
          </motion.div>
        </section>

        {hasIntro && (
          <div id="rp-start" className="rp-article">
            {hook.length > 0 && (
              <div className="rp-intro">
                <p className="rp-kicker">Der Einstieg</p>
                {hook.map((paragraph, index) => (
                  <p key={index} className="rp-intro-text">
                    {paragraph}
                  </p>
                ))}
              </div>
            )}
            {guess && <GuessCard guess={guess} picked={guessPick} onPick={setGuessPick} />}
          </div>
        )}

        <article className="rp-article">
          {sections.map((section, index) => (
            <ReportChapter
              key={`${section.title}-${index}`}
              section={section}
              index={index}
              total={sections.length}
              quiz={quizContext}
              onOpenImage={openLightbox}
              registerElement={registerItem}
            />
          ))}
        </article>

        <section className="rp-finale" aria-label="Abschluss">
          <div className="rp-finale-inner">
            {guess && <GuessReveal guess={guess} picked={guessPick} />}
            {recap.length > 0 && <RecapChecklist points={recap} />}
            {closing && <TaviLine text={closing} label={content?.closingLine ? 'Tavi zum Schluss' : 'Zum Schluss'} />}
            {wowFallback.length > 0 && <WowList facts={wowFallback.map((fact) => ({ title: 'Staunen', fact }))} />}

            <div className="rp-complete">
              <button
                type="button"
                onClick={completion.onComplete}
                disabled={completion.isCompleted || completion.isCompleting}
                aria-busy={completion.isCompleting}
                className={cn('rp-complete-btn', completion.isCompleted && 'rp-complete-btn--done')}
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
                <p role="alert" className="rp-complete-error">
                  {completion.error}
                </p>
              )}
            </div>
            <div className="rp-back">
              <button type="button" onClick={() => onNavigate('/doku')} className="rp-btn rp-btn--ghost">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Zurück zur Übersicht
              </button>
            </div>
          </div>
        </section>
      </div>

      <ImageLightbox src={lightbox?.src ?? null} alt={lightbox?.alt ?? ''} onClose={closeLightbox} />
    </div>
  );
};
