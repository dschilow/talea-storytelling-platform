import React, { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, BookOpen, Check, Compass, Map, Pause, Sparkles, Volume2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useOptionalChildProfiles } from '../../contexts/ChildProfilesContext';
import { CHAPTERS, tourAudio, tourImage, type ChapterMeta } from './tourChapters';
import './WelcomeTour.css';

interface Props {
  onFinish: () => void;
  onDismiss: () => void;
}

function TourIllustration({ chapter }: { chapter: ChapterMeta }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="tour-illustration" aria-busy={!loaded && !failed}>
      {!loaded && !failed && <div className="tour-image-placeholder" aria-hidden="true"><BookOpen size={40} /><span>Das Bild kommt gleich …</span></div>}
      {failed ? (
        <div className="tour-image-placeholder" role="img" aria-label={chapter.imageAlt}><BookOpen size={48} /><span>{chapter.imageAlt}</span></div>
      ) : (
        <img src={tourImage(chapter.id)} alt={chapter.imageAlt} width="768" height="768" decoding="async" fetchPriority="high" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} className={loaded ? 'is-loaded' : ''} />
      )}
    </div>
  );
}

export default function WelcomeTour({ onFinish, onDismiss }: Props) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const childProfiles = useOptionalChildProfiles();
  const childName = childProfiles?.activeProfile?.name?.trim();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [overview, setOverview] = useState(false);
  const [discovery, setDiscovery] = useState<number | null>(null);
  const [narrationEnabled, setNarrationEnabled] = useState(false);
  const [narrationPlaying, setNarrationPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const overviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const chapter = CHAPTERS[index];
  const isLast = index === CHAPTERS.length - 1;

  const go = useCallback((next: number) => {
    if (next < 0 || next >= CHAPTERS.length) return;
    audioRef.current?.pause();
    setDirection(next >= index ? 1 : -1);
    setDiscovery(null);
    setAudioError(false);
    setOverview(false);
    setIndex(next);
    stageRef.current?.scrollTo({ top: 0 });
  }, [index]);

  const leaveTo = (path: string) => {
    audioRef.current?.pause();
    onFinish();
    navigate(path);
  };

  // Narration starts only after the child chooses it; then it follows page turns.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let cancelled = false;
    audio.pause();
    audio.currentTime = 0;
    setNarrationPlaying(false);
    if (narrationEnabled && !overview && !document.hidden) {
      document.querySelectorAll<HTMLMediaElement>('audio, video').forEach(media => {
        if (media !== audio && !media.paused) media.pause();
      });
      void audio.play().catch(error => {
        if (cancelled || error?.name === 'AbortError') return;
        setAudioError(true);
        setNarrationEnabled(false);
      });
    }
    return () => { cancelled = true; audio.pause(); };
  }, [chapter.id, narrationEnabled, overview]);

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (document.hidden) {
        audioRef.current?.pause();
        setNarrationEnabled(false);
      }
    };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden);
  }, []);

  useEffect(() => {
    stageRef.current?.scrollTo({ top: 0 });
    if (overview) overviewHeadingRef.current?.focus({ preventScroll: true });
  }, [overview]);

  // Only warm the next picture, rather than downloading the whole tour on login.
  useEffect(() => {
    const next = CHAPTERS[index + 1];
    if (next) { const image = new Image(); image.src = tourImage(next.id); }
  }, [index]);

  const activeDiscovery = discovery === null ? null : chapter.discoveries[discovery];

  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onDismiss(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="tour-overlay" />
        <Dialog.Content
          className="welcome-tour"
          onOpenAutoFocus={event => {
            previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            event.preventDefault();
            headingRef.current?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={event => {
            event.preventDefault();
            if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus({ preventScroll: true });
          }}
          onKeyDown={event => {
            if (overview || event.altKey || event.ctrlKey || event.metaKey) return;
            if ((event.target as HTMLElement).closest('input, textarea, select, [role="tablist"]')) return;
            if (event.key === 'ArrowRight') { event.preventDefault(); go(index + 1); }
            if (event.key === 'ArrowLeft') { event.preventDefault(); go(index - 1); }
          }}
          aria-describedby="tour-description"
        >
          <header className="tour-header">
            <span className="tour-brand"><Compass size={22} /><span>Tavi zeigt dir Talea<small>Deine Entdeckungsreise</small></span></span>
            <div className="tour-header-actions">
              <button type="button" className="tour-tool-button" onClick={() => { setAudioError(false); setNarrationEnabled(value => !value); }} aria-pressed={narrationEnabled} disabled={overview} aria-label={narrationEnabled ? 'Vorlesen ausschalten' : 'Tavi liest diese und die nächsten Seiten vor'}>
                {narrationPlaying ? <Pause size={18} /> : <Volume2 size={18} />}<span data-short={narrationEnabled ? 'Stopp' : 'Vorlesen'}>{narrationEnabled ? 'Ton aus' : 'Tavi erzählt'}</span>
              </button>
              <button type="button" className="tour-tool-button" onClick={() => setOverview(value => !value)} aria-expanded={overview} aria-controls="tour-stage"><Map size={18} /><span data-short={overview ? 'Zurück' : 'Orte'}>{overview ? 'Zur Seite' : 'Alle Orte'}</span></button>
              <Dialog.Close asChild><button type="button" className="tour-close" aria-label="Rundgang schließen und später selbst entdecken"><X size={20} /></button></Dialog.Close>
            </div>
          </header>
          <progress className="tour-progress" max={CHAPTERS.length} value={index + 1} aria-label="Fortschritt im Rundgang" />

          <main id="tour-stage" ref={stageRef} className="tour-stage">
            {overview ? (
              <section id="tour-map" className="tour-overview" aria-labelledby="tour-overview-title">
                <Dialog.Title asChild><h1 id="tour-overview-title" ref={overviewHeadingRef} tabIndex={-1}>Wo möchtest du hin?</h1></Dialog.Title>
                <Dialog.Description id="tour-description">Tippe auf ein Bild. Tavi zeigt dir diesen Ort.</Dialog.Description>
                <nav className="tour-place-grid" aria-label="Orte im Rundgang">
                  {CHAPTERS.slice(1, -1).map((entry, i) => (
                    <button type="button" key={entry.id} onClick={() => go(i + 1)} aria-label={`${entry.label} im Rundgang entdecken`} aria-current={entry.id === chapter.id ? 'step' : undefined}>
                      <img src={tourImage(entry.id)} alt="" width="768" height="768" loading="lazy" />
                      <span>{entry.label}</span><ArrowRight size={16} aria-hidden="true" />
                    </button>
                  ))}
                </nav>
              </section>
            ) : (
              <AnimatePresence mode="wait" custom={direction}>
                <motion.article
                  key={chapter.id}
                  custom={direction}
                  variants={{ enter: (dir: number) => ({ opacity: reduceMotion ? 1 : 0, x: reduceMotion ? 0 : dir * 18 }), center: { opacity: 1, x: 0 }, exit: (dir: number) => ({ opacity: reduceMotion ? 1 : 0, x: reduceMotion ? 0 : dir * -12 }) }}
                  initial="enter" animate="center" exit="exit"
                  transition={{ duration: reduceMotion ? 0 : 0.2 }}
                  onAnimationComplete={() => headingRef.current?.focus({ preventScroll: true })}
                  className="tour-book" data-tour-chapter={chapter.id}
                  style={{ '--tour-accent': chapter.accent } as CSSProperties}
                >
                  <div className="tour-picture-page"><TourIllustration chapter={chapter} /><span className="tour-picture-caption" aria-hidden="true">{chapter.label}<span>✦</span></span></div>
                  <div className="tour-copy-page">
                    <p className="tour-eyebrow">{chapter.id === 'welcome' && childName ? `Hallo, ${childName}!` : chapter.label}</p>
                    <Dialog.Title asChild><h1 ref={headingRef} tabIndex={-1}>{chapter.title}</h1></Dialog.Title>
                    <Dialog.Description id="tour-description" className="tour-lede">{chapter.lede}</Dialog.Description>

                    <div className="tour-discoveries" role="group" aria-label="Kleine Entdeckungen zum Antippen">
                      {chapter.discoveries.map((entry, i) => (
                        <button key={entry.label} type="button" aria-pressed={!entry.chapter && discovery === i} onClick={() => {
                          if (entry.chapter) go(CHAPTERS.findIndex(candidate => candidate.id === entry.chapter));
                          else setDiscovery(i);
                        }}>
                          <span className="tour-discovery-symbol" aria-hidden="true">{entry.symbol}</span><span>{entry.label}</span>
                          {discovery === i && <Check size={14} className="tour-discovery-check" aria-hidden="true" />}
                        </button>
                      ))}
                    </div>
                    <p className={`tour-discovery-caption${activeDiscovery ? ' is-discovered' : ''}`} role="status">{activeDiscovery?.explanation ?? (chapter.id === 'welcome' || isLast ? 'Such dir einen Ort aus oder blättere weiter.' : 'Tippe auf ein Bildchen und entdecke mehr.')}</p>

                    {isLast && <button type="button" className="tour-start-button" onClick={() => leaveTo('/avatar/create')}><Sparkles size={18} />Ersten Helden gestalten<ArrowRight size={18} /></button>}
                    <details className="tour-more" key={`${chapter.id}-details`}>
                      <summary>{chapter.id === 'parents' ? 'Für Eltern: gut zu wissen' : 'Wo finde ich das? Mehr entdecken'}</summary>
                      <p>{chapter.details}</p>
                      {chapter.location && <p className="tour-location"><Compass size={15} />{chapter.location}</p>}
                      {chapter.destination && <button type="button" className="tour-location-link" onClick={() => leaveTo(chapter.destination!)}>Diesen Bereich öffnen<ArrowRight size={15} /></button>}
                    </details>
                  </div>
                </motion.article>
              </AnimatePresence>
            )}
          </main>

          {audioError && <p className="tour-audio-error" role="status">Tavis Stimme lädt gerade nicht. Du kannst die Bilder trotzdem weiterentdecken.</p>}
          <footer className="tour-footer">
            <button type="button" className="tour-back-button" onClick={() => go(index - 1)} disabled={index === 0 || overview}><ArrowLeft size={18} /><span>Zurück</span></button>
            <span className="tour-page-number">{index + 1}<span> / {CHAPTERS.length}</span></span>
            <button type="button" className="tour-next-button" onClick={() => { if (overview) setOverview(false); else if (isLast) onFinish(); else go(index + 1); }}><span>{overview ? 'Zur Seite' : isLast ? 'Selbst entdecken' : index === 0 ? 'Komm mit!' : 'Weiter'}</span><ArrowRight size={18} /></button>
          </footer>
          <audio ref={audioRef} src={tourAudio(chapter.id)} preload="none" onPlay={() => setNarrationPlaying(true)} onPause={() => setNarrationPlaying(false)} onEnded={() => setNarrationPlaying(false)} onError={() => { setAudioError(true); setNarrationPlaying(false); setNarrationEnabled(false); }} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
