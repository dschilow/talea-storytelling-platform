import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { Captions, Maximize, Minimize, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import './LandingFilm.css';

const FILM = '/landing-assets/film/talea-film.mp4';
const POSTER = '/landing-assets/film/talea-film-poster.webp';
const CAPTIONS = '/landing-assets/film/talea-film.de.vtt';
const FILM_SECONDS = 88;

const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * The Talea promo film on the landing page: poster with a large play button,
 * then a slim player bar that matches the night-and-gold journey design.
 * Nothing is downloaded until the visitor presses play.
 */
export default function LandingFilm({ onPlay }: { onPlay?: () => void }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [started, setStarted] = useState(false);
  const [nearViewport, setNearViewport] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [captions, setCaptions] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(FILM_SECONDS);
  const [buffered, setBuffered] = useState(0);
  const [chrome, setChrome] = useState(true);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    if (!('IntersectionObserver' in window)) { setNearViewport(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: '400px' });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  // pause when the tab is hidden; track fullscreen changes (also via Esc)
  useEffect(() => {
    const onHidden = () => { if (document.hidden) videoRef.current?.pause(); };
    const onFullscreen = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener('visibilitychange', onHidden);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      document.removeEventListener('fullscreenchange', onFullscreen);
      window.clearTimeout(hideTimer.current);
    };
  }, []);

  // the poster button disappears on start: keep keyboard focus inside the player
  useEffect(() => { if (started) toggleRef.current?.focus({ preventScroll: true }); }, [started]);

  useEffect(() => {
    const track = videoRef.current?.textTracks[0];
    if (track) track.mode = captions ? 'showing' : 'hidden';
  }, [captions, started]);

  // controls fade out while the film plays and the pointer rests
  const wake = () => {
    setChrome(true);
    window.clearTimeout(hideTimer.current);
    if (playing) hideTimer.current = window.setTimeout(() => setChrome(false), 2600);
  };
  useEffect(() => { wake(); }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) { video.pause(); return; }
    setStarted(true);
    try { await video.play(); } catch { setPlaying(false); }
  };
  const seek = (event: ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Number(event.target.value);
    setTime(video.currentTime);
  };
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };
  const toggleFullscreen = async () => {
    const frame = frameRef.current;
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!frame) return;
    if (document.fullscreenElement) { await document.exitFullscreen(); return; }
    if (frame.requestFullscreen) await frame.requestFullscreen();
    else video?.webkitEnterFullscreen?.(); // iOS Safari: native player
  };
  const updateBuffer = () => {
    const video = videoRef.current;
    if (video && video.buffered.length) setBuffered(video.buffered.end(video.buffered.length - 1));
  };

  const progress = duration ? (time / duration) * 100 : 0;
  return (
    <section id="film" className="landing-film" aria-labelledby="film-title">
      <div className="landing-film-heading">
        <span className="journey-eyebrow"><Play size={13} fill="currentColor" />Talea in 90 Sekunden</span>
        <h2 id="film-title">Einmal kurz<br /><em>hineinschauen.</em></h2>
        <p>Vom eigenen Helden über die erste Geschichte bis zur Audio-Doku – erzählt von Tavi.</p>
      </div>
      <div
        ref={frameRef}
        className="film-frame"
        data-started={started}
        data-playing={playing}
        data-chrome={chrome || !playing}
        onPointerMove={wake}
        onPointerDown={wake}
        onFocus={wake}
      >
        <video
          ref={videoRef}
          className="film-video"
          poster={nearViewport || started ? POSTER : undefined}
          preload="none"
          playsInline
          onClick={toggle}
          onPlay={() => { setPlaying(true); onPlay?.(); }}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setChrome(true); }}
          onTimeUpdate={event => setTime(event.currentTarget.currentTime)}
          onLoadedMetadata={event => setDuration(event.currentTarget.duration || FILM_SECONDS)}
          onProgress={updateBuffer}
          aria-label="Talea Werbefilm"
        >
          <source src={FILM} type="video/mp4" />
          <track kind="captions" src={CAPTIONS} srcLang="de" label="Deutsch" />
        </video>

        {!started && (
          <button type="button" className="film-start" onClick={toggle} aria-label="Film abspielen">
            <span className="film-start-button"><Play size={34} fill="currentColor" /></span>
            <span className="film-start-label">Film ansehen<small>{clock(FILM_SECONDS)} · mit Ton</small></span>
          </button>
        )}

        {started && (
          <div className="film-controls" role="group" aria-label="Filmsteuerung">
            <button ref={toggleRef} type="button" className="film-control" onClick={toggle} aria-label={playing ? 'Pausieren' : 'Abspielen'}>
              {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>
            <div className="film-progress" style={{ '--film-progress': `${progress}%`, '--film-buffer': `${duration ? (buffered / duration) * 100 : 0}%` } as CSSProperties}>
              <input
                type="range" min={0} max={duration} step={0.1} value={time} onChange={seek}
                aria-label="Position im Film" aria-valuetext={`${clock(time)} von ${clock(duration)}`}
              />
            </div>
            <span className="film-time">{clock(time)} <span>/ {clock(duration)}</span></span>
            <button type="button" className="film-control" onClick={() => setCaptions(value => !value)} aria-pressed={captions} aria-label="Untertitel" title="Untertitel">
              <Captions size={18} />
            </button>
            <button type="button" className="film-control" onClick={toggleMute} aria-label={muted ? 'Ton an' : 'Ton aus'}>
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button type="button" className="film-control" onClick={toggleFullscreen} aria-label={fullscreen ? 'Vollbild beenden' : 'Vollbild'}>
              {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
