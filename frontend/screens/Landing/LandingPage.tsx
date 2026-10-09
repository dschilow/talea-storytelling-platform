import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowDown, ArrowRight, BookOpenText, Check, ChevronDown, Compass,
  Crown, Headphones, Heart, MessageCircleMore, Pause, Play, ShieldCheck,
  Sparkles, Star, Telescope, Users, X,
} from 'lucide-react';
import {
  AUDIO_ACCESS_LABELS, FREE_TRIAL_DAYS, FREE_TRIAL_QUOTAS, PLAN_AUDIO_LIBRARY_ACCESS,
  PLAN_DAILY_LIMITS, PLAN_FEATURE_ROWS, PLAN_IMAGES, PLAN_OFFLINE_LIMITS, PLAN_ORDER,
  PLAN_PRICES, PLAN_PROFILE_LIMITS, PLAN_QUOTAS, PLAN_TAVI_MESSAGES, PLAN_TITLES,
  formatEuro, type SubscriptionPlan,
} from '../../constants/planCatalog';
import JourneyAtmosphere from './JourneyAtmosphere';
import { NovaRays, SkyClouds, SoundWave, StarTrail } from './JourneyArtwork';
import './LandingPage.css';

gsap.registerPlugin(ScrollTrigger);
const ASSETS = '/landing-assets/journey';
const AUDIO_DOKU_PREVIEW = '/audio-doku/Talea_intro-preview.mp3';
const islands = [
  {
    id: 'geschichten', label: 'Geschichten', place: 'Das Geschichten-Schloss', icon: BookOpenText,
    title: <>Es war einmal.<br /><em>Und zwar dein Kind.</em></>,
    description: 'Ein mutiger Weltraumfuchs? Eine Prinzessin, die Drachen rettet? Dein Kind bestimmt die Richtung. Talea macht daraus eine ganz persönliche Geschichte.',
    features: ['Eigene Helden in jeder Geschichte', 'Alter, Welt und Stimmung selbst wählen', 'Mit Bildern, die die Fantasie weitertragen'],
    image: `${ASSETS}/story-island.webp`, color: '#f5c98e', note: 'Eine Idee wird ein ganzes Abenteuer.',
  },
  {
    id: 'avatare', label: 'Avatare', place: 'Das Atelier der Helden', icon: Users,
    title: <>Kleine Helden.<br /><em>Große Persönlichkeit.</em></>,
    description: 'Hier entsteht der Held deines Kindes. Mit eigenem Aussehen, einer Persönlichkeit und Erinnerungen, die mit jedem Abenteuer wachsen.',
    features: ['Aussehen und Persönlichkeit gestalten', 'Mut, Neugier und Empathie entwickeln', 'Erinnerungen, Quests und Schätze sammeln'],
    image: `${ASSETS}/avatar-island.webp`, color: '#b7dec9', note: 'Jede Geschichte hinterlässt etwas.',
  },
  {
    id: 'hoeren', label: 'Lesen & Hören', place: 'Der Garten der Geschichten', icon: Headphones,
    title: <>Augen auf.<br /><em>Oder einfach zu.</em></>,
    description: 'Lesen wie im Kino. Zuhören wie im Traum. Entdeckt bebilderte Geschichten, einen filmischen Lesemodus und Audio für eure kleinen Auszeiten.',
    features: ['Filmisch, klassisch oder im Scroll-Modus lesen', 'Geschichten vorlesen lassen', 'Audio-Dokus für neugierige Ohren'],
    image: `${ASSETS}/audio-island.webp`, color: '#f1b8ae', note: 'Für die Rückbank. Und die Bettkante.',
  },
  {
    id: 'wissen', label: 'Wissen', place: 'Die Insel der Entdeckungen', icon: Telescope,
    title: <>Warum? Wieso?<br /><em>Was wäre, wenn?</em></>,
    description: 'Von Dinosauriern bis zu fernen Planeten: Aus großen Kinderfragen werden verständliche Wissens-Dokus. Und aus neuem Wissen wird das nächste Abenteuer.',
    features: ['Wissens-Dokus zu eigenen Lieblingsthemen', 'Mit Quizfragen spielerisch weiterdenken', 'Lernpfade und den eigenen Kosmos entdecken'],
    image: `${ASSETS}/knowledge-island.webp`, color: '#a9cce9', note: 'Neugier ist der schönste Kompass.',
  },
  {
    id: 'tavi', label: 'Tavi', place: 'Ein Freund für unterwegs', icon: MessageCircleMore,
    title: <>Tausend Fragen.<br /><em>Ein kleiner Begleiter.</em></>,
    description: 'Tavi ist euer KI-Assistent in Talea. Er beantwortet Fragen, hilft beim Entdecken und kann in den Bezahlplänen Geschichten und Dokus direkt im Chat erstellen.',
    features: ['Fragen stellen und Ideen finden', 'Die Talea-Welt gemeinsam entdecken', 'Geschichten und Dokus direkt im Chat starten'],
    image: `${ASSETS}/tavi-island.webp`, color: '#c9b7ea', note: '„Wohin soll unser nächstes Abenteuer gehen?“',
  },
];

const planMeta: Record<SubscriptionPlan, { icon: typeof Star; tagline: string }> = {
  free: { icon: Compass, tagline: 'Für den ersten Funken Fantasie.' },
  starter: { icon: Star, tagline: 'Für kleine, tägliche Abenteuer.' },
  familie: { icon: Heart, tagline: 'Für die ganze Geschichtenfamilie.' },
  premium: { icon: Crown, tagline: 'Für große Geschichtenfans.' },
};
const faqs = [
  { question: 'Was genau ist Talea?', answer: 'Talea verbindet personalisierte KI-Geschichten, eigene Avatare, Wissens-Dokus, Audio und Quiz in einer App. Ihr gestaltet eure Helden und wählt, was ihr als Nächstes erleben oder lernen möchtet.' },
  { question: 'Kann ich Talea kostenlos ausprobieren?', answer: `Ja. Nach der Registrierung stehen euch in den ersten ${FREE_TRIAL_DAYS} Tagen ${FREE_TRIAL_QUOTAS.stories} Geschichten und ${FREE_TRIAL_QUOTAS.dokus} Dokus zum Entdecken zur Verfügung. Danach enthält der kostenlose Entdecker-Plan monatlich ${PLAN_QUOTAS.free.stories} Geschichte und ${PLAN_QUOTAS.free.dokus} Doku. Für den kostenlosen Einstieg braucht ihr kein Bezahlabo.` },
  { question: 'Für welches Alter sind die Geschichten gedacht?', answer: 'Im Geschichten-Wizard wählt ihr die Altersgruppe: 3–5, 6–8, 9–12 oder 13+. Sprache, Länge und Inhalt werden darauf abgestimmt. Gerade bei jüngeren Kindern macht gemeinsames Lesen und Entdecken besonders viel Freude.' },
  { question: 'Was können Eltern einstellen?', answer: 'Im Elternbereich legt ihr unter anderem Tabu-Themen, Lernziele und Tageslimits fest. Ein PIN schützt die Einstellungen. Im Familien- und Premium-Plan könnt ihr zusätzlich Budgets für einzelne Kinderprofile verwalten.' },
  { question: 'Wie funktionieren die Kontingente?', answer: 'Eine neu erstellte Geschichte verbraucht eine Story-Münze, eine neue Doku eine Doku-Münze. Die monatlichen Kontingente gelten für alle Kinderprofile zusammen. Bereits gespeicherte Inhalte könnt ihr wieder aufrufen; für neue Inhalte gelten die Kontingente und Tageslimits des gewählten Plans.' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const [gentleMode, setGentleMode] = useState(false);
  const [activeIsland, setActiveIsland] = useState(0);
  const [annual, setAnnual] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [inJourney, setInJourney] = useState(false);
  const [isCompact, setIsCompact] = useState(() => window.innerWidth < 900);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioDokuPlaying, setAudioDokuPlaying] = useState(false);
  const [audioDokuError, setAudioDokuError] = useState(false);
  const animated = !prefersReducedMotion && !gentleMode;
  const cinematic = animated && !isCompact;
  const rootRef = useRef<HTMLDivElement>(null);
  const runwayRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioDokuRef = useRef<HTMLAudioElement>(null);
  const start = useCallback(() => navigate('/auth?mode=signup'), [navigate]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 899px)');
    const update = () => setIsCompact(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const update = () => setNavScrolled(window.scrollY > 40);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  useEffect(() => {
    if (activeIsland !== 2) { audioRef.current?.pause(); setAudioPlaying(false); }
    const pauseAudio = () => {
      if (document.hidden) {
        audioRef.current?.pause();
        audioDokuRef.current?.pause();
      }
    };
    document.addEventListener('visibilitychange', pauseAudio);
    return () => document.removeEventListener('visibilitychange', pauseAudio);
  }, [activeIsland]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const runway = runwayRef.current;
    const stage = stageRef.current;
    const track = trackRef.current;
    if (!root || !runway || !stage || !track) return;
    setInJourney(false);
    const context = gsap.context(() => {
      gsap.to('.journey-page-progress', {
        scaleX: 1, ease: 'none',
        scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: true },
      });
      if (!animated) return;
      gsap.from('.opening-copy > *', { y: 24, opacity: 0, duration: 1.1, stagger: 0.12, ease: 'power3.out', clearProps: 'all' });
      gsap.from('.opening-landscape', { scale: 1.08, duration: 2.2, ease: 'power2.out' });
      gsap.to('.opening-landscape', {
        yPercent: 12, scale: 1.08, ease: 'none',
        scrollTrigger: { trigger: '.journey-opening', start: 'top top', end: 'bottom top', scrub: true },
      });
      if (cinematic) {
        const timeline = gsap.timeline({
          onUpdate: () => {
            const position = Math.abs(Number(gsap.getProperty(track, 'x'))) / stage.clientWidth;
            setActiveIsland(Math.min(islands.length - 1, Math.round(position)));
          },
          scrollTrigger: {
            trigger: runway, start: 'top top', end: 'bottom bottom', scrub: 0.65,
            invalidateOnRefresh: true,
            onToggle: self => setInJourney(self.isActive),
          },
        });
        timeline.to({}, { duration: 0.8 });
        islands.slice(1).forEach((_, i) => {
          timeline.to(track, { x: () => -(i + 1) * stage.clientWidth, duration: 0.8, ease: 'power2.inOut' });
          timeline.to({}, { duration: 0.8 });
        });
        timelineRef.current = timeline;
        gsap.to('.journey-moon', { x: -180, y: 50, ease: 'none', scrollTrigger: { trigger: runway, start: 'top top', end: 'bottom bottom', scrub: true } });
        gsap.to('.journey-stage > .sky-clouds', { xPercent: -8, ease: 'none', scrollTrigger: { trigger: runway, start: 'top top', end: 'bottom bottom', scrub: true } });
      } else {
        gsap.utils.toArray<HTMLElement>('.island-scene').forEach((scene, i) => {
          gsap.from(scene.querySelector('.island-art'), {
            y: 35, opacity: 0, duration: 0.9, ease: 'power2.out',
            scrollTrigger: { trigger: scene, start: 'top 75%', once: true, onEnter: () => setActiveIsland(i), onEnterBack: () => setActiveIsland(i) },
          });
        });
      }
      gsap.from('.parents-copy > *', {
        y: 20, opacity: 0, duration: 0.8, stagger: 0.1, clearProps: 'all',
        scrollTrigger: { trigger: '#parents', start: 'top 75%', once: true },
      });
      {
        // A single scroll-controlled bloom also works on touch screens.
        const nova = gsap.timeline({ scrollTrigger: { trigger: '.nova-runway', start: 'top top', end: 'bottom bottom', scrub: 0.5 } });
        nova.to('.nova-before', { opacity: 0, y: -30, duration: 0.2 }, 0.1)
          .to('.nova-core', { scale: 2.5, duration: 0.3, ease: 'power2.in' }, 0.05)
          .fromTo('.nova-rays', { scale: 0.5, opacity: 0 }, { scale: 2.8, opacity: 0.9, duration: 0.4 }, 0.12)
          .to('.nova-ring', { scale: 18, opacity: 0, duration: 0.5, stagger: 0.04 }, 0.22)
          .to('.nova-core', { scale: 65, duration: 0.42, ease: 'power3.in' }, 0.3)
          .to('.nova-wash', { opacity: 1, duration: 0.28 }, 0.4)
          .to('.nova-stage', { backgroundColor: '#faf6ed', duration: 0.1 }, 0.64)
          .set(['.nova-core', '.nova-rays'], { opacity: 0 }, 0.68)
          .to('.nova-wash', { opacity: 0, duration: 0.2 }, 0.72)
          .fromTo('.nova-after', { y: 35, opacity: 0 }, { y: 0, opacity: 1, duration: 0.25 }, 0.73)
          .to({}, { duration: 0.15 });
      }
    }, root);
    let disposed = false;
    const refresh = () => { if (!disposed) ScrollTrigger.refresh(); };
    document.fonts.ready.then(refresh);
    const images = [...root.querySelectorAll('img')];
    images.forEach(img => img.addEventListener('load', refresh));
    const frame = requestAnimationFrame(refresh);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      images.forEach(img => img.removeEventListener('load', refresh));
      timelineRef.current = null;
      context.revert();
    };
  }, [animated, cinematic, isCompact]);

  const goToIsland = useCallback((index: number, immediate = false) => {
    const behavior = animated && !immediate ? 'smooth' : 'instant';
    const timeline = timelineRef.current;
    const trigger = timeline?.scrollTrigger;
    if (timeline && trigger) {
      const progress = index === 0 ? 0 : (index * 1.6 + 0.4) / timeline.duration();
      window.scrollTo({ top: trigger.start + (trigger.end - trigger.start) * progress, behavior });
    } else {
      document.getElementById(islands[index].id)?.scrollIntoView({ behavior, block: 'start' });
    }
  }, [animated]);
  const toggleGentleMode = () => {
    const current = inJourney ? activeIsland : null;
    setGentleMode(value => !value);
    if (current !== null) requestAnimationFrame(() => requestAnimationFrame(() => goToIsland(current, true)));
  };
  const toggleAudio = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) { try { await audio.play(); } catch { setAudioPlaying(false); } }
    else audio.pause();
  };
  const toggleAudioDoku = async () => {
    const audio = audioDokuRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    setAudioDokuError(false);
    if (audio.error) audio.load();
    try {
      await audio.play();
    } catch (error) {
      setAudioDokuPlaying(false);
      if (!(error instanceof DOMException && error.name === 'AbortError')) setAudioDokuError(true);
    }
  };

  return (
    <div ref={rootRef} className="talea-journey" data-motion={animated ? 'full' : 'gentle'} data-cinematic={cinematic ? 'true' : 'false'}>
      <a className="journey-skip" href="#pricing">Direkt zu den Preisen</a>
      <div className="journey-page-progress" aria-hidden="true" />
      <header className={`journey-nav${navScrolled ? ' journey-nav--scrolled' : ''}`}>
        <a className="journey-brand" href="#intro" aria-label="Talea – zum Anfang"><BookOpenText strokeWidth={1.4} /><span>talea<span className="brand-star">✦</span></span></a>
        <nav className="journey-nav-links" aria-label="Hauptnavigation"><a href="#journey">Die Reise</a><a href="#audio-dokus">Audio-Dokus</a><a href="#parents">Für Eltern</a><a href="#pricing">Preise</a></nav>
        <div className="journey-nav-actions">
          <button type="button" className="motion-control" onClick={toggleGentleMode} aria-pressed={gentleMode || !!prefersReducedMotion} aria-label={animated ? 'Weniger Bewegung aktivieren' : 'Volle Animationen aktivieren'} title={animated ? 'Weniger Bewegung' : 'Volle Animationen'} disabled={!!prefersReducedMotion}>{animated ? <Pause size={15} /> : <Play size={15} />}<span>{animated ? 'Film-Modus' : 'Ruhiger Modus'}</span></button>
          <Link className="journey-login" to="/auth">Anmelden</Link>
          <button type="button" className="journey-button journey-button--small" onClick={start}>Kostenlos starten<ArrowRight size={15} /></button>
        </div>
      </header>
      <main>
        <section id="intro" className="journey-opening" aria-labelledby="opening-title">
          <img className="opening-landscape" src={`${ASSETS}/cinematic-world.webp`} alt="Ein leuchtendes Märchenschloss auf einer schwebenden Insel, verbunden mit weiteren Inseln über goldene Sternenpfade." fetchPriority="high" width="1672" height="941" />
          <div className="opening-shade" aria-hidden="true" /><JourneyAtmosphere animated={animated} />
          <div className="opening-copy">
            <p className="journey-eyebrow"><span className="eyebrow-star">✦</span>Eine kleine Idee. Eine unendliche Welt.</p>
            <h1 id="opening-title">Dein Kind.<br />Die Hauptrolle.<br /><em>Eine ganze Welt.</em></h1>
            <p className="opening-description">Geschichten, in denen dein Kind der Held ist.<br className="desktop-break" /> Abenteuer, die mit ihm wachsen. Und Wissen,<br className="desktop-break" /> das sich nach Magie anfühlt.</p>
            <div className="opening-actions"><button type="button" className="journey-button" onClick={() => goToIsland(0)}>Die Welt entdecken<ArrowRight size={18} /></button><button type="button" className="opening-free-link" onClick={start}>Kostenlos ausprobieren</button></div>
            <p className="opening-reassurance"><ShieldCheck size={13} />Für neugierige Kinder. Mit Eltern an ihrer Seite.</p>
          </div>
          <div className="opening-island-label" aria-hidden="true"><span className="map-marker"><Sparkles size={15} /></span><span>Willkommen in Talea<small>Deine Fantasie hat ein Zuhause.</small></span></div>
          <div className="opening-bottom"><a href="#journey" className="scroll-invitation"><span className="scroll-line" /><span>Scrollen. Staunen. Weiterträumen.</span><ArrowDown size={14} /></a><span className="opening-coordinate">Eine Reise in fünf Kapiteln<span>01 — ∞</span></span></div>
        </section>
        <section id="journey" className="journey-introduction" aria-labelledby="journey-title">
          <span className="journey-eyebrow">Die Welt von Talea</span><h2 id="journey-title">Folge dem <em>Funkeln.</em></h2><p>Fünf Inseln. Tausend Möglichkeiten. Eine Welt, die eure ist.</p>
          <div className="journey-chapter-list">{islands.map((island, i) => <button type="button" key={island.id} onClick={() => goToIsland(i)}><span>0{i + 1}</span>{island.label}<ArrowRight size={12} /></button>)}</div>
          <a className="journey-audio-invitation" href="#audio-dokus"><Headphones size={16} />Neugierig auf unsere Audio-Dokus? Jetzt reinhören<ArrowDown size={14} /></a>
        </section>
        <section ref={runwayRef} className="journey-runway" aria-label="Die fünf Inseln von Talea">
          <div ref={stageRef} className="journey-stage">
            <div className="journey-moon" aria-hidden="true" /><JourneyAtmosphere animated={cinematic} /><StarTrail animated={animated} />
            <div ref={trackRef} className="journey-track">
              {islands.map((island, i) => {
                const Icon = island.icon;
                return <article id={island.id} key={island.id} className={`island-scene island-scene--${island.id}`} style={{ '--island-accent': island.color } as CSSProperties} inert={cinematic && activeIsland !== i} aria-labelledby={`${island.id}-title`}>
                  <div className="island-aura" aria-hidden="true" />
                  <div className="island-art">
                    <img src={island.image} alt={`${island.place}: eine schwebende Insel mit ${i === 0 ? 'Buch und Märchenschloss' : i === 1 ? 'magischer Werkstatt, Fuchs, Drache und einer kleinen Entdeckerin' : i === 2 ? 'Grammophon und musikalischem Garten' : i === 3 ? 'Observatorium, Teleskop und Planeten' : 'Tavi, dem freundlichen türkisfarbenen Flaschengeist'}.`} width="1000" height="1000" loading={i === 0 ? 'eager' : 'lazy'} decoding="async" />
                    {i === 1 && <div className="island-floating-note"><Heart size={16} /><span>Mit jedem Abenteuer<small>wächst ein bisschen Mut.</small></span></div>}
                    {i === 3 && <div className="discovery-orbit" aria-hidden="true"><span /><span /><span /></div>}
                    {i === 4 && <div className="tavi-dialogue"><span><Sparkles size={14} />Tavi</span><p>„Was möchtest du heute entdecken?“</p><i>Dein KI-Begleiter in Talea</i></div>}
                  </div>
                  <div className="island-copy">
                    <span className="island-chapter">Kapitel 0{i + 1}<span /><span>{island.place}</span></span>
                    <span className="island-icon"><Icon size={22} strokeWidth={1.4} /></span>
                    <h2 id={`${island.id}-title`}>{island.title}</h2><p className="island-description">{island.description}</p>
                    <ul className="island-features">{island.features.map(feature => <li key={feature}><Check size={15} />{feature}</li>)}</ul>
                    {i === 2 ? <div className="audio-preview" data-playing={audioPlaying}>
                      <button type="button" onClick={toggleAudio} aria-label={audioPlaying ? 'Tavi-Hörprobe pausieren' : 'Tavi-Hörprobe abspielen'}>{audioPlaying ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}</button>
                      <div><span>So klingt euer Begleiter</span><small>Tavi kennenlernen · Hörprobe</small></div><SoundWave />
                      <audio ref={audioRef} src="/voices/Tavi.mp3" preload="none" onPlay={() => { audioDokuRef.current?.pause(); setAudioPlaying(true); }} onPause={() => setAudioPlaying(false)} onEnded={() => setAudioPlaying(false)} />
                    </div> : <p className="island-footnote"><Sparkles size={13} />{island.note}</p>}
                  </div><span className="island-large-number" aria-hidden="true">0{i + 1}</span>
                </article>;
              })}
            </div>
            <SkyClouds id="journey" />
            {cinematic && <nav className="island-navigation" aria-label="Insel-Navigation"><span className="island-navigation-caption"><Compass size={14} />Unsere Reise</span><ol>{islands.map((island, i) => <li key={island.id}><button type="button" className={activeIsland === i ? 'is-active' : ''} onClick={() => goToIsland(i)} aria-current={activeIsland === i ? 'step' : undefined}><span className="island-nav-dot">0{i + 1}</span><span>{island.label}</span></button></li>)}</ol><a href="#pricing" className="journey-skip-film">Zu den Preisen<ArrowRight size={13} /></a></nav>}
          </div>
        </section>
        <section id="audio-dokus" className="journey-audio-dokus" aria-labelledby="audio-dokus-title">
          <div className="audio-doku-copy">
            <span className="journey-eyebrow"><Headphones size={14} />Audio-Dokus für neugierige Ohren</span>
            <h2 id="audio-dokus-title">Große Fragen.<br /><em>Spannend erzählt.</em></h2>
            <p>Wie lebten die Dinosaurier? Was gibt es im Weltall zu entdecken? Unsere Audio-Dokus erklären spannende Themen kindgerecht und nehmen dein Kind mit auf eine Wissensreise – einfach zuhören und Neues entdecken.</p>
            <ul className="audio-doku-features">
              <li><Check size={15} />Wissen verständlich und lebendig erzählt</li>
              <li><Check size={15} />Für kleine Hörpausen zuhause und unterwegs</li>
            </ul>
            <button type="button" className="parents-link" onClick={start}>Mit Talea weiterentdecken<ArrowRight size={16} /></button>
          </div>
          <figure className="audio-doku-player">
            <img src={`${ASSETS}/audio-island.webp`} alt="" width="1000" height="1000" loading="lazy" decoding="async" />
            <figcaption className="sr-only">
              <h3 id="audio-doku-preview-title">Reinhören in die Talea-Welt</h3>
              <p id="audio-doku-preview-description">Talea-Intro · Hörprobe ohne Anmeldung</p>
            </figcaption>
            <div className="audio-preview audio-preview--doku" data-playing={audioDokuPlaying}>
              <button type="button" onClick={toggleAudioDoku} aria-label={audioDokuPlaying ? 'Audio-Doku-Hörprobe pausieren' : 'Audio-Doku-Hörprobe abspielen'} aria-pressed={audioDokuPlaying} aria-describedby="audio-doku-preview-description">{audioDokuPlaying ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}</button>
              <div><span>So klingen unsere Audio-Dokus</span><small>Talea kennenlernen · Hörprobe</small></div><SoundWave />
              <audio
                ref={audioDokuRef}
                src={AUDIO_DOKU_PREVIEW}
                preload="none"
                aria-labelledby="audio-doku-preview-title"
                onPlay={() => { audioRef.current?.pause(); setAudioDokuPlaying(true); }}
                onPause={() => setAudioDokuPlaying(false)}
                onEnded={() => setAudioDokuPlaying(false)}
                onLoadStart={() => setAudioDokuError(false)}
                onError={() => { setAudioDokuPlaying(false); setAudioDokuError(true); }}
              />
            </div>
            {audioDokuError && <p className="audio-doku-error" role="status">Die Hörprobe konnte nicht geladen werden. Öffne die MP3 über den Link darunter direkt.</p>}
            <a className="audio-doku-direct-link" href={AUDIO_DOKU_PREVIEW} target="_blank" rel="noopener noreferrer">Hörprobe als MP3 öffnen<ArrowRight size={14} /><span className="sr-only"> (öffnet in einem neuen Tab)</span></a>
          </figure>
        </section>
        <section id="parents" className="journey-parents" aria-labelledby="parents-title">
          <div className="parents-copy"><span className="journey-eyebrow"><ShieldCheck size={14} />Für Eltern</span><h2 id="parents-title">Große Abenteuer.<br /><em>In guten Händen.</em></h2><p>Ihr gebt den Rahmen vor. Eure Kinder füllen ihn mit Fantasie. Talea hilft euch, beides zusammenzubringen.</p><button type="button" className="parents-link" onClick={start}>Gemeinsam losziehen<ArrowRight size={16} /></button></div>
          <div className="parents-promises">
            <div><span><ShieldCheck size={22} /></span><div><h3>Eure Regeln reisen mit.</h3><p>Tabu-Themen, Tageslimits und PIN-Schutz für eure Elterneinstellungen.</p></div></div>
            <div><span><Users size={22} /></span><div><h3>Jedes Kind hat seine Welt.</h3><p>Eigene Kinderprofile, passende Altersgruppen und persönliche Helden.</p></div></div>
            <div><span><Telescope size={22} /></span><div><h3>Neugier bekommt eine Richtung.</h3><p>Lernziele setzen und Geschichten mit Wissen verbinden.</p></div></div>
          </div>
        </section>
        <section className="nova-runway" aria-label="Das Finale der Reise"><div className="nova-stage">
          <div className="nova-before"><span className="journey-eyebrow">Alles beginnt mit einem Funken.</span><h2>Was, wenn daraus<br /><em>eine ganze Welt wird?</em></h2><p>Scroll weiter. Eure Geschichte wartet.</p></div>
          <div className="nova-star" aria-hidden="true"><div className="nova-core" /><div className="nova-ring" /><div className="nova-ring nova-ring--second" /><NovaRays /></div><div className="nova-wash" aria-hidden="true" />
          <div className="nova-after"><span className="nova-after-star" aria-hidden="true">✦</span><p>Die nächste Geschichte?</p><h2><em>Die gehört euch.</em></h2><a href="#pricing">Findet euer Abenteuer<ArrowDown size={18} /></a></div>
        </div></section>
        <section id="pricing" className="journey-pricing" aria-labelledby="pricing-title">
          <div className="pricing-heading"><span className="journey-eyebrow"><Sparkles size={14} />Ein Platz für eure Fantasie</span><h2 id="pricing-title">Kleine Preise.<br /><em>Große Geschichten.</em></h2><p>Startet kostenlos. Findet euren Rhythmus.<br />Und wählt den Plan, der zu eurer Familie passt.</p></div>
          <div className="billing-switch" role="group" aria-label="Abrechnungszeitraum"><button type="button" aria-pressed={!annual} onClick={() => setAnnual(false)}>Monatlich</button><button type="button" aria-pressed={annual} onClick={() => setAnnual(true)}>Jährlich<span>33 % sparen</span></button></div>
          <div className="journey-plan-grid">{PLAN_ORDER.map(plan => {
            const Icon = planMeta[plan].icon;
            const recommended = plan === 'familie';
            const yearlyPrice = PLAN_PRICES[plan].yearly;
            const price = annual && yearlyPrice !== null ? yearlyPrice / 12 : PLAN_PRICES[plan].monthly;
            const features = [
              `${PLAN_PROFILE_LIMITS[plan]} ${PLAN_PROFILE_LIMITS[plan] === 1 ? 'Kinderprofil' : 'Kinderprofile'}`,
              `${PLAN_TAVI_MESSAGES[plan]} Tavi-Nachrichten / Monat`, `${PLAN_IMAGES[plan]} KI-Bilder / Monat`,
              `Audio-Dokus: ${AUDIO_ACCESS_LABELS[PLAN_AUDIO_LIBRARY_ACCESS[plan]]}`,
              plan === 'familie' || plan === 'premium' ? 'Elternkontrolle mit Profil-Budgets' : 'Basis-Elternkontrolle',
              PLAN_OFFLINE_LIMITS[plan] ? `Bis zu ${PLAN_OFFLINE_LIMITS[plan]} Inhalte offline / Profil` : null,
            ].filter((feature): feature is string => !!feature);
            return <article key={plan} className={`journey-plan${recommended ? ' journey-plan--featured' : ''}`} aria-label={`Plan ${PLAN_TITLES[plan]}`}>
              {recommended && <div className="journey-plan-badge"><Heart size={12} />Für die ganze Familie</div>}
              <div className="plan-top"><span className="plan-icon"><Icon size={21} strokeWidth={1.5} /></span><h3>{PLAN_TITLES[plan]}</h3><p>{planMeta[plan].tagline}</p></div>
              <div className="plan-price"><strong>{price.toLocaleString('de-DE', { minimumFractionDigits: plan === 'free' ? 0 : 2, maximumFractionDigits: 2 })}<span>€</span></strong><span> / Monat</span></div>
              <p className="plan-billing">{plan === 'free' ? 'Dauerhaft kostenlos' : annual && yearlyPrice !== null ? `${formatEuro(yearlyPrice)} jährlich abgerechnet` : 'Monatlich abgerechnet'}</p>
              <div className="plan-quota"><div><strong>{PLAN_QUOTAS[plan].stories}</strong><span>Geschichten</span></div><span>+</span><div><strong>{PLAN_QUOTAS[plan].dokus}</strong><span>Dokus</span></div><small>pro Monat · max. je {PLAN_DAILY_LIMITS[plan].stories} pro Tag</small></div>
              <ul>{features.map(feature => <li key={feature}><Check size={14} />{feature}</li>)}</ul>
              {plan === 'free' && <p className="free-trial-note">Zum Start: {FREE_TRIAL_QUOTAS.stories} Geschichten + {FREE_TRIAL_QUOTAS.dokus} Dokus in {FREE_TRIAL_DAYS} Tagen.</p>}
              <button type="button" onClick={start} className="plan-button">{plan === 'free' ? 'Kostenlos starten' : 'Account erstellen'}<ArrowRight size={15} /></button>
            </article>;
          })}</div>
          <p className="pricing-footnote">Nach der Anmeldung wählt ihr euren Plan. Alle Kontingente gelten gemeinsam für eure Kinderprofile.</p>
          <details className="plan-comparison"><summary>Alle Funktionen vergleichen<ChevronDown size={17} /></summary><div className="plan-comparison-scroll" role="region" aria-label="Planvergleich, horizontal scrollbar" tabIndex={0}><table><caption className="sr-only">Alle Talea-Pläne und ihre Funktionen</caption><thead><tr><th scope="col">Euer Abenteuer enthält</th>{PLAN_ORDER.map(plan => <th key={plan} scope="col">{PLAN_TITLES[plan]}</th>)}</tr></thead><tbody>{PLAN_FEATURE_ROWS.map(row => <tr key={row.label}><th scope="row">{row.label}{row.hint && <small>{row.hint}</small>}</th>{PLAN_ORDER.map(plan => <td key={plan}>{typeof row.values[plan] === 'boolean' ? row.values[plan] ? <Check size={16} aria-label="Enthalten" /> : <X size={15} aria-label="Nicht enthalten" /> : row.values[plan]}</td>)}</tr>)}</tbody></table></div></details>
          <section className="journey-faq" aria-labelledby="faq-title"><div><span className="journey-eyebrow">Noch ein bisschen neugierig?</span><h2 id="faq-title">Gute Fragen.<br /><em>Klare Antworten.</em></h2></div><div className="faq-list">{faqs.map(faq => <details key={faq.question}><summary>{faq.question}<ChevronDown size={17} /></summary><p>{faq.answer}</p></details>)}</div></section>
          <div className="journey-last-call"><span aria-hidden="true">✦</span><h2>Eure Fantasie.<br /><em>Ab hier geht’s weiter.</em></h2><button type="button" className="journey-button" onClick={start}>Unser erstes Abenteuer<ArrowRight size={17} /></button><p>Kostenlos anfangen. Gemeinsam weiterträumen.</p></div>
        </section>
      </main>
      <footer className="journey-footer"><a className="journey-brand" href="#intro"><BookOpenText strokeWidth={1.4} /><span>talea<span className="brand-star">✦</span></span></a><span>Für kleine Menschen mit großen Ideen.</span><p>© {new Date().getFullYear()} Talea<Link to="/auth">Anmelden</Link><a href="#pricing">Preise</a></p></footer>
    </div>
  );
}
