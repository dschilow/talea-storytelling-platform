import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronDown, Clock, Headphones } from 'lucide-react';

import type { Avatar, Chapter, Story } from '../../../types/story';
import { cn } from '../../../lib/utils';
import { StoryAudioActions } from '../../../components/story/StoryAudioActions';
import { AdminGenerationMetrics } from '../../../components/story/AdminGenerationMetrics';
import { StoryAlreadyReadNote } from '../../../components/story/StoryFinaleSheet';
import { ReaderChapter } from './ReaderChapter';
import { ImageLightbox } from './ImageLightbox';
import { estimateReadingMinutes, formatGenre } from './readerText';
import { ReaderHeader, ReaderHeroBackdrop, ReaderProgress, ReaderSectionNav, useReaderScroll } from './ReaderChrome';
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
  /** Chapter books: write the next volume from a teaser or the child's wish. */
  onContinueBook?: (choice: { teaser?: string; wish?: string }) => Promise<void>;
  /** Reading position for the server-side bookmark (0-based chapter index). */
  onProgress?: (chapterIndex: number) => void;
}

/**
 * A chapter book keeps its bookmark on the server too (progress in percent of the
 * planned chapters, so it stays right while the book grows). Used only when this
 * browser has no bookmark of its own, e.g. after reading on the phone.
 */
function serverResumeChapter(story: Story, available: number): number | null {
  const book = story.metadata?.book;
  const pct = Number((story as { profileState?: { progressPct?: number } }).profileState?.progressPct || 0);
  if (!book || book.format !== 'chapter-book' || pct <= 0 || pct >= 100 || available === 0) return null;
  const index = Math.round((pct / 100) * book.chaptersPlanned) - 1;
  return index > 0 ? Math.min(index, available - 1) : null;
}

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
  onContinueBook,
  onProgress,
}) => {
  const {
    scrollerRef,
    heroRef,
    registerItem: registerChapter,
    scrollToItem: scrollToChapter,
    activeIndex: activeChapter,
    reading,
    headerHidden,
    progressScale,
    progressOpacity,
  } = useReaderScroll();

  const language = story.config.language;
  const { scaleId, scale, setScaleId } = useTextScale();
  const [audioOpen, setAudioOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [coverFailed, setCoverFailed] = useState(false);
  const [savedChapter] = useState(() => readSavedChapter(story.id, chapters.length) ?? serverResumeChapter(story, chapters.length));

  const coverUrl = story.coverImageUrl || chapters.find((chapter) => chapter.imageUrl)?.imageUrl || null;
  const showCover = Boolean(coverUrl) && !coverFailed;
  const minutes = useMemo(() => estimateReadingMinutes(chapters), [chapters]);
  // Picture books number their "Seite N"; everything else is a chapter.
  const unitSingular = useMemo(
    () => (chapters.length > 0 && chapters.every((chapter) => /^\s*(seite|page)\b/i.test(chapter.title || '')) ? 'Seite' : 'Kapitel'),
    [chapters],
  );
  const unitPlural = unitSingular === 'Seite' ? 'Seiten' : 'Kapitel';
  // Chapter books are written while the family reads: more chapters may still be on their way.
  const book = story.metadata?.book?.format === 'chapter-book' ? story.metadata.book : null;
  const bookWriting = Boolean(book && book.state !== 'complete');
  // "Was bisher geschah" only covers chapters before the resume point — nothing the child has not heard.
  const recaps = useMemo(
    () => (book?.recaps || []).filter((entry) => savedChapter !== null && entry.chapter <= savedChapter && entry.recap),
    [book?.recaps, savedChapter],
  );
  const unitCount = chapters.length === 1 ? unitSingular : unitPlural;

  // Remember where the reader is — but only once they are past the hero, so
  // opening a story never overwrites the spot they are about to resume from.
  useEffect(() => {
    if (reading && !completion.isCompleted) {
      saveChapterPosition(story.id, activeChapter);
      onProgress?.(activeChapter);
    }
  }, [reading, activeChapter, completion.isCompleted, story.id, onProgress]);

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
    book && bookWriting ? `${chapters.length} von ${book.chaptersPlanned} Kapiteln` : `${chapters.length} ${unitCount}`,
    isCharacterLifeStory ? null : `ca. ${minutes} Min.`,
  ].filter(Boolean);

  return (
    <div
      className="rd-root rd-scope"
      data-theme={isDark ? 'dark' : 'light'}
      style={{ '--rd-scale': scale } as React.CSSProperties}
    >
      <ReaderProgress scale={progressScale} opacity={progressOpacity} />

      <ReaderHeader
        title={story.title}
        meta={reading && chapters.length > 1 ? `${unitSingular} ${activeChapter + 1} von ${chapters.length}` : eyebrow.join(' · ')}
        backLabel={returnLabel}
        onBack={() => onNavigate(returnPath)}
        hidden={headerHidden}
        scaleId={scaleId}
        onScaleChange={setScaleId}
      />

      {reading && chapters.length > 1 && (
        <ReaderSectionNav
          ariaLabel="Kapitel-Navigation"
          activeIndex={activeChapter}
          onSelect={scrollToChapter}
          items={chapters.map((chapter, index) => ({
            key: chapter.id || String(index),
            label: `${unitSingular} ${index + 1}${chapter.title ? `: ${chapter.title}` : ''}`,
            title: chapter.title || undefined,
          }))}
        />
      )}

      <div ref={scrollerRef} className="rd-scroller">
        {/* ── Hero ── */}
        <section ref={heroRef} className="rd-hero">
          <ReaderHeroBackdrop coverUrl={showCover ? coverUrl : null} />

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
              {savedChapter !== null ? `Weiterlesen · ${unitSingular} ${savedChapter + 1}` : book ? 'Buch lesen' : 'Geschichte lesen'}
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </motion.button>

            {recaps.length > 0 && (
              <section className="rd-recap" aria-labelledby="rd-recap-title">
                <h2 id="rd-recap-title" className="rd-recap-title">Was bisher geschah</h2>
                <ol>
                  {recaps.slice(-3).map((entry) => (
                    <li key={entry.chapter} value={entry.chapter}>{entry.recap}</li>
                  ))}
                </ol>
              </section>
            )}

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
              onComplete={index === chapters.length - 1 && !bookWriting ? completion.onComplete : undefined}
              endNote={book && index % 2 === 1 && (bookWriting || index < chapters.length - 1)
                ? `Gute-Nacht-Stelle · Morgen geht es mit Kapitel ${index + 2} weiter.`
                : undefined}
              isCompleted={completion.isCompleted}
              isCompleting={completion.isCompleting}
              completionError={completion.error}
              onOpenImage={openLightbox}
              registerElement={registerChapter}
            />
          ))}
          {book && bookWriting && (
            <div className="rd-book-pending" role="status">
              {book.state === 'stalled' ? (
                <p>Das nächste Kapitel lässt noch auf sich warten. Wir kümmern uns darum.</p>
              ) : (
                <>
                  <span className="rd-spinner" aria-hidden="true" />
                  <p>Kapitel {chapters.length + 1} wird gerade geschrieben. Es erscheint hier von selbst — schau in ein paar Minuten wieder vorbei.</p>
                </>
              )}
            </div>
          )}
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
            <h2 className="rd-finale-title">{bookWriting ? 'Fortsetzung folgt bald' : 'Ende'}</h2>
            <p className="rd-finale-text">
              {isCharacterLifeStory
                ? 'Du kennst nun ein wichtiges Kapitel aus diesem Charakterleben.'
                : bookWriting
                  ? 'Die nächsten Kapitel werden gerade geschrieben. Dein Lesezeichen ist gesetzt.'
                  : 'Du kannst zur Übersicht zurückkehren oder direkt die nächste Geschichte lesen.'}
            </p>
            {book && !bookWriting && onContinueBook && (
              <ContinueBook teasers={book.teasers || []} onContinue={onContinueBook} onNewStory={() => onNavigate('/story')} />
            )}
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

/** End of a chapter book: pick one of the author's ideas for the next volume, or wish something of your own. */
const ContinueBook: React.FC<{
  teasers: string[];
  onContinue: (choice: { teaser?: string; wish?: string }) => Promise<void>;
  onNewStory: () => void;
}> = ({ teasers, onContinue, onNewStory }) => {
  const [teaser, setTeaser] = useState<string | null>(null);
  const [wish, setWish] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = Boolean(teaser || wish.trim());

  const start = async () => {
    if (!ready || pending) return;
    setPending(true);
    setError(null);
    try {
      await onContinue({ teaser: teaser || undefined, wish: wish.trim() || undefined });
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Der nächste Band konnte nicht gestartet werden.');
      setPending(false);
    }
  };

  return (
    <div className="rd-continue">
      <h3 className="rd-continue-title">Wie geht es weiter?</h3>
      {teasers.map((entry) => (
        <button
          key={entry}
          type="button"
          className="rd-continue-option"
          aria-pressed={teaser === entry}
          onClick={() => setTeaser((current) => (current === entry ? null : entry))}
        >
          {entry}
        </button>
      ))}
      <textarea
        className="rd-continue-wish"
        placeholder="Oder dein eigener Wunsch für den nächsten Band …"
        value={wish}
        maxLength={300}
        onChange={(event) => setWish(event.target.value)}
      />
      {error && <p role="alert" className="rd-complete-error">{error}</p>}
      <button type="button" className="rd-primary-btn" onClick={start} disabled={!ready || pending} aria-busy={pending}>
        {pending ? 'Der nächste Band wird vorbereitet …' : 'Nächsten Band schreiben'}
      </button>
      <button type="button" className="rd-ghost-btn" onClick={onNewStory}>
        Lieber eine ganz neue Geschichte
      </button>
    </div>
  );
};
