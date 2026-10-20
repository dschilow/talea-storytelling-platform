import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ChevronDown, Clock, Play } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useBackend } from "@/hooks/useBackend";
import { useTheme } from "@/contexts/ThemeContext";
import { useOptionalChildProfiles } from "@/contexts/ChildProfilesContext";
import type { Chapter } from "@/types/story";
import { ReaderChapter } from "../Story/reader/ReaderChapter";
import { ImageLightbox } from "../Story/reader/ImageLightbox";
import { ReaderHeader, ReaderHeroBackdrop, ReaderProgress, ReaderSectionNav, useReaderScroll } from "../Story/reader/ReaderChrome";
import { clearChapterPosition, readSavedChapter, saveChapterPosition, useTextScale } from "../Story/reader/useReaderStorage";
import { CollectibleCard } from "./components/CollectibleCard";
import { episodeLabel, episodeReaderPath, errorMessage, formatRelease, seriesPath, type LibraryCollectible, type LibraryEpisodeResponse } from "./libraryShared";
import "../Story/reader/StoryReader.css";
import "./OriginalsReader.css";

/**
 * Reads one episode of a Talea Original with the story reader's look. At the end
 * the child gets the episode's card (once), the teaser for next Friday and the
 * way to the next episode.
 */
const OriginalsEpisodeReader: React.FC = () => {
  const { episodeId = "" } = useParams<{ episodeId: string }>();
  const navigate = useNavigate();
  const backend = useBackend();
  const { resolvedTheme } = useTheme();
  const profileId = useOptionalChildProfiles()?.activeProfileId;
  const [episode, setEpisode] = useState<LibraryEpisodeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEpisode(null);
    setError(null);
    backend.story
      .libraryEpisode({ id: episodeId, profileId: profileId || undefined })
      .then((next) => !cancelled && setEpisode(next))
      .catch((loadError) => !cancelled && setError(errorMessage(loadError, "Diese Folge konnte nicht geöffnet werden.")));
    return () => {
      cancelled = true;
    };
  }, [backend, episodeId, profileId]);

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="max-w-sm text-[15px] text-[var(--talea-text-secondary)]">{error}</p>
        <button type="button" onClick={() => navigate(-1)} className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--talea-surface-inset)] px-5 font-semibold text-[var(--primary)]">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </button>
      </div>
    );
  }
  if (!episode) {
    return <div className="rd-root rd-scope min-h-screen" data-theme={resolvedTheme === "dark" ? "dark" : "light"} aria-busy="true" />;
  }
  return <EpisodeView key={episode.id} episode={episode} isDark={resolvedTheme === "dark"} profileId={profileId || undefined} />;
};

const EpisodeView: React.FC<{ episode: LibraryEpisodeResponse; isDark: boolean; profileId?: string }> = ({ episode, isDark, profileId }) => {
  const navigate = useNavigate();
  const backend = useBackend();
  const { scrollerRef, heroRef, registerItem, scrollToItem, activeIndex, reading, headerHidden, progressScale, progressOpacity } = useReaderScroll();
  const { scaleId, scale, setScaleId } = useTextScale();
  const storageKey = `originals:${episode.id}`;
  const [savedChapter] = useState(() => readSavedChapter(storageKey, episode.chapters.length) ?? (episode.progress.chapterIndex > 0 && !episode.progress.finished ? episode.progress.chapterIndex : null));
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const [completion, setCompletion] = useState({ done: episode.progress.finished, pending: false, error: null as string | null });
  const [reward, setReward] = useState<LibraryCollectible | null>(null);
  const lastSaved = useRef(-1);

  // Chapters as the story reader knows them; the picture sits after its paragraph.
  const chapters: Chapter[] = useMemo(
    () =>
      episode.chapters.map((chapter, index) => ({
        id: `${episode.id}-${index}`,
        title: chapter.title,
        content: chapter.text,
        order: index + 1,
        ...(chapter.imageUrl ? { images: [{ url: chapter.imageUrl, afterParagraph: chapter.afterParagraph ?? 3 }] } : {}),
      })),
    [episode],
  );

  // Bookmark: this device right away, the server once per chapter (another device continues there).
  useEffect(() => {
    if (!reading || completion.done) return;
    saveChapterPosition(storageKey, activeIndex);
    if (activeIndex === lastSaved.current) return;
    lastSaved.current = activeIndex;
    void backend.story.saveLibraryProgress({ episodeId: episode.id, profileId, chapterIndex: activeIndex, finished: false }).catch(() => undefined);
  }, [reading, activeIndex, completion.done, storageKey, backend, episode.id, profileId]);

  const complete = useCallback(async () => {
    if (completion.pending) return;
    setCompletion((state) => ({ ...state, pending: true, error: null }));
    try {
      const result = await backend.story.saveLibraryProgress({ episodeId: episode.id, profileId, chapterIndex: episode.chapters.length - 1, finished: true });
      clearChapterPosition(storageKey);
      setCompletion({ done: true, pending: false, error: null });
      if (result.finishedNow && result.collectible) setReward(result.collectible);
    } catch (saveError) {
      setCompletion({ done: false, pending: false, error: errorMessage(saveError, "Das hat nicht geklappt. Bitte nochmal tippen.") });
    }
  }, [backend, completion.pending, episode.id, episode.chapters.length, profileId, storageKey]);

  const back = () => navigate(seriesPath(episode.seriesSlug));
  const eyebrow = [episode.seriesTitle, episodeLabel(episode), `ca. ${episode.readingMinutes} Min.`];

  return (
    <div className="rd-root rd-scope og-reader" data-theme={isDark ? "dark" : "light"} style={{ "--rd-scale": scale } as React.CSSProperties}>
      <ReaderProgress scale={progressScale} opacity={progressOpacity} />
      <ReaderHeader
        title={episode.title}
        meta={reading ? `Kapitel ${activeIndex + 1} von ${chapters.length}` : `${episode.seriesTitle} · ${episodeLabel(episode)}`}
        backLabel={`Zurück zu ${episode.seriesTitle}`}
        onBack={back}
        hidden={headerHidden}
        scaleId={scaleId}
        onScaleChange={setScaleId}
      />
      {reading ? (
        <ReaderSectionNav
          ariaLabel="Kapitel-Navigation"
          activeIndex={activeIndex}
          onSelect={scrollToItem}
          items={chapters.map((chapter, index) => ({ key: chapter.id, label: `Kapitel ${index + 1}: ${chapter.title}`, title: chapter.title }))}
        />
      ) : null}

      <div ref={scrollerRef} className="rd-scroller">
        <section ref={heroRef} className="rd-hero">
          <ReaderHeroBackdrop coverUrl={episode.coverImageUrl || null} />
          <motion.div className="rd-hero-inner" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.2, 0.65, 0.3, 0.9] }}>
            {episode.coverImageUrl ? <img src={episode.coverImageUrl} alt={`Titelbild: ${episode.title}`} className="rd-hero-cover" /> : null}
            <p className="rd-eyebrow">
              {eyebrow.map((part, index) => (
                <React.Fragment key={part}>
                  {index > 0 ? <span className="rd-eyebrow-sep" aria-hidden="true">·</span> : null}
                  <span className={index === 0 ? "rd-eyebrow-genre" : undefined}>
                    {index === eyebrow.length - 1 ? <Clock className="rd-eyebrow-icon" aria-hidden="true" /> : null}
                    {part}
                  </span>
                </React.Fragment>
              ))}
            </p>
            <h1 className="rd-hero-title">{episode.title}</h1>
            {episode.summary ? <p className="rd-hero-summary">{episode.summary}</p> : null}
            <motion.button type="button" whileTap={{ scale: 0.97 }} className="rd-primary-btn" onClick={() => scrollToItem(savedChapter ?? 0)}>
              {savedChapter !== null ? `Weiterlesen · Kapitel ${savedChapter + 1}` : "Folge lesen"}
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </motion.button>
          </motion.div>
        </section>

        <article className="rd-article">
          {chapters.map((chapter, index) => (
            <ReaderChapter
              key={chapter.id}
              chapter={chapter}
              index={index}
              language="de"
              onComplete={index === chapters.length - 1 ? complete : undefined}
              isCompleted={completion.done}
              isCompleting={completion.pending}
              completionError={completion.error}
              onOpenImage={(src, alt) => setLightbox({ src, alt })}
              registerElement={registerItem}
            />
          ))}
        </article>

        <section className="rd-finale">
          <div className="rd-finale-inner og-finale">
            <span className="rd-ornament" aria-hidden="true">
              <span className="rd-ornament-line" />
              <span className="rd-ornament-diamond" />
              <span className="rd-ornament-line" />
            </span>
            <h2 className="rd-finale-title">Ende der Folge</h2>
            <CollectibleCard collectible={episode.collectible} size="md" />
            <p className="rd-finale-text">
              {completion.done ? "Diese Karte liegt jetzt in deiner Sammlung." : "Lies bis zum Ende, dann wandert diese Karte in deine Sammlung."}
            </p>
            {episode.teaser ? <p className="og-finale-teaser">{episode.teaser}</p> : null}
            <div className="og-finale-actions">
              {episode.nextEpisode?.available ? (
                <button type="button" className="rd-primary-btn" onClick={() => navigate(episodeReaderPath(episode.nextEpisode!.id))}>
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" /> Nächste Folge: {episode.nextEpisode.title}
                </button>
              ) : episode.nextEpisode?.publishAt ? (
                <p className="rd-finale-text">Die nächste Folge erscheint {formatRelease(episode.nextEpisode.publishAt)}.</p>
              ) : null}
              <button type="button" className="rd-secondary-btn" onClick={back}>
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Zur Reihe
              </button>
            </div>
          </div>
        </section>
      </div>

      <ImageLightbox src={lightbox?.src ?? null} alt={lightbox?.alt ?? ""} onClose={() => setLightbox(null)} />
      <RewardDialog collectible={reward} onClose={() => setReward(null)} />
    </div>
  );
};

/** The hand-over: the card turns around once, then waits to be put away. */
const RewardDialog: React.FC<{ collectible: LibraryCollectible | null; onClose: () => void }> = ({ collectible, onClose }) => {
  const reduceMotion = useReducedMotion();
  return (
    <DialogPrimitive.Root open={Boolean(collectible)} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[2000] bg-[rgba(20,12,8,0.78)] backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed inset-0 z-[2001] flex flex-col items-center justify-center gap-6 overflow-y-auto p-6 text-center text-white focus:outline-none max-sm:justify-start max-sm:pt-12">
          <AnimatePresence>
            {collectible ? (
              <>
                <motion.div initial={{ opacity: 0, y: reduceMotion ? 0 : -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#ffd9c4]">Neue Karte für deine Sammlung</p>
                  <DialogPrimitive.Title className="mt-1 text-[1.8rem] font-bold leading-tight" style={{ fontFamily: "var(--talea-font-display)" }}>
                    {collectible.title}
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="sr-only">Die Sammelkarte dieser Folge.</DialogPrimitive.Description>
                </motion.div>
                <motion.div
                  style={{ perspective: 1200 }}
                  initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.6, rotateY: reduceMotion ? 0 : 180 }}
                  animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.9, ease: [0.2, 0.8, 0.25, 1] }}
                >
                  <CollectibleCard collectible={collectible} size="lg" />
                </motion.div>
                <DialogPrimitive.Close className="inline-flex min-h-12 items-center rounded-full bg-white px-6 text-[15px] font-bold text-[#24160e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  In die Sammlung legen
                </DialogPrimitive.Close>
              </>
            ) : null}
          </AnimatePresence>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default OriginalsEpisodeReader;
