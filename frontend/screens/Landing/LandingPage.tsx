import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import {
  ArrowRight,
  AudioLines,
  BookOpenText,
  Brain,
  Check,
  ChevronDown,
  Crown,
  Headphones,
  MessageCircleMore,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Wand2,
  Zap,
} from 'lucide-react';
import './LandingPage.css';

gsap.registerPlugin(ScrollTrigger);

/* ═══════════════════════════════════
   DATA
   ═══════════════════════════════════ */

const characters = [
  { name: 'Fuchs', image: '/landing-assets/generated/characters/detektive.webp', mood: 'Detektiv', delay: '0s' },
  { name: 'Drache', image: '/landing-assets/generated/characters/drache.webp', mood: 'Abenteuer', delay: '0.5s' },
  { name: 'Goblin', image: '/landing-assets/generated/characters/goblin.webp', mood: 'Schalk', delay: '1s' },
  { name: 'Oma', image: '/landing-assets/generated/characters/oma.webp', mood: 'Weisheit', delay: '1.5s' },
  { name: 'König', image: '/landing-assets/generated/characters/wilhelm.webp', mood: 'Mentor', delay: '2s' },
  { name: 'Troll', image: '/landing-assets/generated/characters/troll.webp', mood: 'Humor', delay: '2.5s' },
  { name: 'Räuber', image: '/landing-assets/generated/characters/rauber.webp', mood: 'Spannung', delay: '3s' },
  { name: 'Hexe', image: '/landing-assets/generated/characters/image.webp', mood: 'Magie', delay: '3.5s' },
];

const cineScenes = [
  {
    num: '01',
    tag: 'Es beginnt',
    tagIcon: BookOpenText,
    title: ['Ein Buch.', 'Unendliche', 'Welten.'],
    desc: 'Alles beginnt mit einem magischen Buch. Dein Kind öffnet es – und taucht ein in eine Welt, die nur für sie geschaffen wurde.',
    points: ['KI-generierte Geschichten in Sekunden', 'Genre, Stimmung & Alter frei wählbar', 'Eigene Avatare als Hauptfiguren'],
    image: '/landing-assets/cine_1_book.png',
    charImg: '/landing-assets/generated/characters/detektive.webp',
    charPos: { bottom: '15%', right: '8%' },
  },
  {
    num: '02',
    tag: 'Story-Magie',
    tagIcon: Sparkles,
    title: ['Magie', 'entfaltet', 'sich.'],
    desc: 'Aus Worten werden Welten. Unser cineastischer Lesemodus verwandelt jede Geschichte in ein visuelles Erlebnis – Szene für Szene, wie ein Film.',
    points: ['3 Lesemodi: Cinematic, Klassisch, Scroll', 'Automatisch generierte Szenenbilder', 'Audio-Erzählung zuschaltbar'],
    image: '/landing-assets/cine_2_magic.png',
    charImg: '/landing-assets/generated/characters/drache.webp',
    charPos: { top: '20%', right: '5%' },
  },
  {
    num: '03',
    tag: 'Avatare',
    tagIcon: Users,
    title: ['Deine Helden', 'erwachen', 'zum Leben.'],
    desc: 'Avatare sind mehr als Bilder. Sie entwickeln Persönlichkeit, sammeln Erinnerungen, verdienen Perks und meistern Quests. Jede Story macht sie stärker.',
    points: ['Avatar-Wizard mit eigenem Profil', 'Persönlichkeit, Tagebuch & Schatzkammer', 'Quest- & Perk-System für Motivation'],
    image: '/landing-assets/cine_3_avatars.png',
    charImg: '/landing-assets/generated/characters/goblin.webp',
    charPos: { bottom: '10%', left: '5%' },
  },
  {
    num: '04',
    tag: 'Abenteuer',
    tagIcon: Rocket,
    title: ['In jedem', 'Wald steckt', 'ein Geheimnis.'],
    desc: 'Deine Charaktere erkunden verzauberte Wälder, lösen Rätsel und finden Schätze. Jedes Abenteuer ist einzigartig und auf dein Kind zugeschnitten.',
    points: ['50+ Story-Vorlagen aus Märchen & Sagen', 'Artefakte & Schätze zum Sammeln', 'Langfristige Questlinien & Fortschritt'],
    image: '/landing-assets/cine_4_stories.png',
    charImg: '/landing-assets/generated/characters/wilhelm.webp',
    charPos: { top: '15%', left: '6%' },
  },
  {
    num: '05',
    tag: 'Wissens-Dokus',
    tagIcon: Brain,
    title: ['Wissen wird', 'zum größten', 'Abenteuer.'],
    desc: 'Von Dinosauriern bis Raumfahrt – unsere KI-Dokus verbinden Audio, Quiz und Struktur zu einer modernen Lernstrecke, die Kinder lieben.',
    points: ['Audio-Dokus für unterwegs & Schlafenszeit', 'Quiz direkt verknüpft mit Erklärungen', 'Didaktische Struktur mit Lernzielen'],
    image: '/landing-assets/cine_5_dokus.png',
    charImg: '/landing-assets/generated/characters/oma.webp',
    charPos: { bottom: '18%', right: '6%' },
  },
];

const features = [
  { icon: Wand2, title: 'Story-Wizard', desc: 'Erstelle in 5 Schritten eine perfekte Geschichte mit KI-Unterstützung.' },
  { icon: Headphones, title: 'Audio-Erlebnis', desc: 'Alle Inhalte als Hörgeschichte – perfekt für Autofahrten und Schlafenszeit.' },
  { icon: MessageCircleMore, title: 'Tavi KI-Assistent', desc: 'Stelle Fragen, starte Stories und lass dir Funktionen erklären – aus dem Chat heraus.' },
  { icon: AudioLines, title: 'Quiz & Fakten', desc: 'Interaktive Quiz-Bereiche direkt in jeder Doku – Wissen spielerisch prüfen.' },
  { icon: ShieldCheck, title: 'Eltern-Dashboard', desc: 'Tabu-Themen, Lernziele und Tageslimits zentral steuern mit PIN-Schutz.' },
  { icon: Sparkles, title: 'Cinematic Reading', desc: 'Liest sich wie ein Film. Szene für Szene, mit generierten Bildern und Übergängen.' },
];

const pricingPlans = [
  {
    name: 'Starter', price: '4,99', icon: Star,
    features: ['10 KI-Geschichten / Monat', 'Alle Lesemodi', 'Avatar-Erstellung', '1 Avatar inklusive'],
  },
  {
    name: 'Family', price: '9,99', icon: Crown, featured: true,
    features: ['25 Geschichten + 25 Dokus', 'Audio-Erlebnis inklusive', 'Quests & Perks', 'Eltern-Dashboard'],
  },
  {
    name: 'Premium', price: '18,99', icon: Zap,
    features: ['50 Geschichten + 50 Dokus', 'Tavi KI-Assistent', 'Prioritäts-Generierung', 'Alles aus Family'],
  },
];

const trustPoints = [
  { icon: ShieldCheck, title: 'Eltern-Dashboard mit PIN', desc: 'Tabu-Themen, Lernziele und Tageslimits zentral steuern. Sicherheit fließt direkt in die KI-Generierung ein.', color: 'var(--c-accent2)' },
  { icon: Wand2, title: 'KI-Sicherheit eingebaut', desc: 'Tabu-Wörter, Altersfilter und Lernregeln werden direkt in den Prompt eingebettet – präventiv, nicht nachträglich.', color: 'var(--c-accent)' },
  { icon: Rocket, title: 'Wächst mit deiner Familie', desc: 'Avatar-Fortschritt, Lernkreisläufe und Quests sorgen für nachhaltige Nutzung statt kurzfristiger Unterhaltung.', color: 'var(--c-accent3)' },
];

const comparisonData = [
  ['Inhalte', 'Nur Geschichten', 'Nur Lernmodule', 'Stories + Dokus + Audio + Quiz'],
  ['Personalisierung', 'Gering', 'Mittel', 'Hoch (Avatar, Alter, Stimmung)'],
  ['Elternkontrolle', 'Oberflächlich', 'Teilweise', 'PIN-Dashboard mit Filtern'],
  ['Langzeitmotivation', 'Niedrig', 'Mittel', 'Quests, Perks, Memory'],
  ['Audio', 'Optional', 'Selten', 'Voll integriert'],
];

/* ═══════════════════════════════════
   PARTICLE SYSTEM
   ═══════════════════════════════════ */

interface Particle {
  x: number; y: number; vx: number; vy: number;
  size: number; color: string; alpha: number; life: number; maxLife: number;
}

function spawnFirefly(w: number, h: number): Particle {
  const colors = ['rgba(167,139,250,0.8)', 'rgba(96,212,200,0.7)', 'rgba(245,197,66,0.6)', 'rgba(249,115,112,0.6)'];
  return {
    x: Math.random() * w, y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
    size: 1 + Math.random() * 2.5,
    color: colors[Math.floor(Math.random() * colors.length)],
    alpha: 0, life: 200 + Math.random() * 300, maxLife: 500,
  };
}

function spawnCursorSparkle(x: number, y: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.5 + Math.random() * 1.5;
  return {
    x, y,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 0.5,
    size: 1 + Math.random() * 2,
    color: `hsla(${260 + Math.random() * 40}, 80%, 75%, 0.9)`,
    alpha: 1, life: 30 + Math.random() * 30, maxLife: 60,
  };
}

/* ═══════════════════════════════════
   COMPONENT
   ═══════════════════════════════════ */

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isSignedIn } = useUser();
  const startTarget = isSignedIn ? '/' : '/auth';

  /* Refs */
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorDot = useRef<HTMLDivElement>(null);
  const cursorRing = useRef<HTMLDivElement>(null);
  const cursorGlow = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const sceneRefs = useRef<(HTMLElement | null)[]>([]);
  const featureRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  const mousePos = useRef({ x: -100, y: -100 });
  const particles = useRef<Particle[]>([]);
  const rafId = useRef<number>(0);
  const [navScrolled, setNavScrolled] = useState(false);

  /* ── Lenis + GSAP ScrollTrigger ── */
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.2, smoothWheel: true, touchMultiplier: 1.5 });

    lenis.on('scroll', () => { ScrollTrigger.update(); });
    gsap.ticker.add((time) => { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    /* Nav background on scroll */
    const handleScroll = () => { setNavScrolled(window.scrollY > 60); };
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      lenis.destroy();
      gsap.ticker.remove(lenis.raf as any);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  /* ── GSAP Animations ── */
  useEffect(() => {
    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {

      /* Scroll progress bar */
      if (progressRef.current) {
        gsap.to(progressRef.current, {
          scaleX: 1, ease: 'none',
          scrollTrigger: { trigger: 'body', start: 'top top', end: 'bottom bottom', scrub: 0.3 },
        });
      }

      /* Hero entrance */
      const heroTl = gsap.timeline({ delay: 0.3 });
      heroTl
        .to('.hero-title .word', {
          opacity: 1, y: 0, rotateX: 0,
          duration: 0.8, stagger: 0.12, ease: 'power3.out',
        })
        .to('.hero-sub', { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, '-=0.3')
        .to('.hero-actions', { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '-=0.2')
        .to('.hero-characters', { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, '-=0.3')
        .to('.scroll-cue', { opacity: 1, duration: 0.5 }, '-=0.2');

      /* Cinematic scenes – pinned with scrub animation */
      mm.add('(min-width: 769px)', () => {
        sceneRefs.current.forEach((scene) => {
          if (!scene) return;
          const bg = scene.querySelector('.cine-scene-bg img') as HTMLElement;
          const lines = scene.querySelectorAll('.cine-scene-title .line-inner');
          const desc = scene.querySelector('.cine-scene-desc') as HTMLElement;
          const points = scene.querySelectorAll('.cine-scene-points li');
          const tag = scene.querySelector('.cine-scene-tag') as HTMLElement;
          const charEl = scene.querySelector('.scene-character') as HTMLElement;

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: scene,
              start: 'top top',
              end: '+=150%',
              pin: true,
              scrub: 1,
              anticipatePin: 1,
            },
          });

          tl.fromTo(bg, { scale: 1.3 }, { scale: 1, duration: 1, ease: 'none' })
            .fromTo(tag, { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.3 }, 0.2)
            .fromTo(lines, { y: '110%' }, { y: '0%', duration: 0.4, stagger: 0.08, ease: 'power3.out' }, 0.3)
            .fromTo(desc, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.3 }, 0.5)
            .fromTo(points, { opacity: 0, x: -15 }, { opacity: 1, x: 0, duration: 0.2, stagger: 0.06 }, 0.6);

          if (charEl) {
            tl.fromTo(charEl, { opacity: 0, scale: 0.5, rotate: -15 },
              { opacity: 0.8, scale: 1, rotate: 0, duration: 0.4, ease: 'back.out(1.4)' }, 0.7);
          }
        });
      });

      /* Mobile: no pinning, just reveal animations */
      mm.add('(max-width: 768px)', () => {
        sceneRefs.current.forEach((scene) => {
          if (!scene) return;
          const lines = scene.querySelectorAll('.cine-scene-title .line-inner');
          const desc = scene.querySelector('.cine-scene-desc');
          const points = scene.querySelectorAll('.cine-scene-points li');

          gsap.fromTo(lines, { y: '100%' }, {
            y: '0%', stagger: 0.08, duration: 0.6, ease: 'power3.out',
            scrollTrigger: { trigger: scene, start: 'top 75%' },
          });
          if (desc) gsap.fromTo(desc, { opacity: 0, y: 20 }, {
            opacity: 1, y: 0, duration: 0.5,
            scrollTrigger: { trigger: desc, start: 'top 80%' },
          });
          gsap.fromTo(points, { opacity: 0, x: -10 }, {
            opacity: 1, x: 0, stagger: 0.05, duration: 0.4,
            scrollTrigger: { trigger: scene, start: 'top 60%' },
          });
        });
      });

      /* Horizontal feature scroll (desktop only) */
      mm.add('(min-width: 769px)', () => {
        if (featureRef.current && trackRef.current) {
          const trackWidth = trackRef.current.scrollWidth - window.innerWidth + 200;
          gsap.to(trackRef.current, {
            x: -trackWidth,
            ease: 'none',
            scrollTrigger: {
              trigger: featureRef.current,
              start: 'top top',
              end: `+=${trackWidth}`,
              pin: true,
              scrub: 1,
              anticipatePin: 1,
            },
          });
        }
      });

      /* Cinematic dividers */
      gsap.utils.toArray<HTMLElement>('.cine-divider-word').forEach((word) => {
        gsap.fromTo(word, { opacity: 0, scale: 0.8, y: 30 }, {
          opacity: 1, scale: 1, y: 0, duration: 0.8, ease: 'power3.out',
          scrollTrigger: { trigger: word, start: 'top 85%' },
        });
      });

      /* Pricing cards */
      gsap.fromTo('.pricing-card', { opacity: 0, y: 50, rotateX: 10 }, {
        opacity: 1, y: 0, rotateX: 0, duration: 0.6, stagger: 0.12, ease: 'power3.out',
        scrollTrigger: { trigger: '.pricing-grid', start: 'top 80%' },
      });

      /* Trust cards */
      gsap.fromTo('.trust-card', { opacity: 0, y: 40 }, {
        opacity: 1, y: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out',
        scrollTrigger: { trigger: '.trust-grid', start: 'top 80%' },
      });

      /* Comparison table rows */
      gsap.fromTo('.comparison-table tr', { opacity: 0, x: -20 }, {
        opacity: 1, x: 0, duration: 0.4, stagger: 0.06,
        scrollTrigger: { trigger: '.comparison-table', start: 'top 80%' },
      });

    }, rootRef);

    return () => { ctx.revert(); mm.revert(); };
  }, []);

  /* ── Particle Canvas ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    /* Seed initial fireflies */
    for (let i = 0; i < 35; i++) {
      particles.current.push(spawnFirefly(canvas.width, canvas.height));
    }

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      /* Spawn cursor sparkles */
      if (mousePos.current.x > 0 && Math.random() > 0.7) {
        particles.current.push(spawnCursorSparkle(mousePos.current.x, mousePos.current.y));
      }

      /* Respawn fireflies */
      const fireflyCount = particles.current.filter(p => p.maxLife > 100).length;
      if (fireflyCount < 30) {
        particles.current.push(spawnFirefly(canvas.width, canvas.height));
      }

      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;

        /* Fireflies: fade in/out smoothly */
        if (p.maxLife > 100) {
          const progress = 1 - (p.life / p.maxLife);
          p.alpha = progress < 0.1 ? progress * 10 : progress > 0.85 ? (1 - progress) * 6.67 : 0.7 + Math.sin(Date.now() * 0.003 + i) * 0.3;
          p.vx += (Math.random() - 0.5) * 0.02;
          p.vy += (Math.random() - 0.5) * 0.02;
          p.vx *= 0.99; p.vy *= 0.99;
        } else {
          /* Cursor sparkles: gravity + fade */
          p.vy += 0.03;
          p.alpha = Math.max(0, p.life / p.maxLife);
        }

        if (p.life <= 0) { particles.current.splice(i, 1); continue; }

        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        /* Firefly glow */
        if (p.maxLife > 100 && p.alpha > 0.3) {
          ctx.globalAlpha = p.alpha * 0.15;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      rafId.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(rafId.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  /* ── Custom Cursor ── */
  const handleMouseMove = useCallback((e: MouseEvent) => {
    mousePos.current = { x: e.clientX, y: e.clientY };

    if (cursorDot.current) {
      cursorDot.current.style.left = `${e.clientX}px`;
      cursorDot.current.style.top = `${e.clientY}px`;
    }
    if (cursorRing.current) {
      gsap.to(cursorRing.current, {
        left: e.clientX, top: e.clientY,
        duration: 0.15, ease: 'power2.out',
      });
    }
    if (cursorGlow.current) {
      gsap.to(cursorGlow.current, {
        left: e.clientX, top: e.clientY,
        duration: 0.4, ease: 'power2.out',
      });
    }
  }, []);

  const handleCursorEnter = useCallback(() => {
    rootRef.current?.classList.add('cursor-active');
  }, []);
  const handleCursorLeave = useCallback(() => {
    rootRef.current?.classList.remove('cursor-active');
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);

    /* Attach hover listeners to interactive elements */
    const interactives = document.querySelectorAll('a, button, .tilt-card, .pricing-card, .trust-card, .character-figure');
    interactives.forEach((el) => {
      el.addEventListener('mouseenter', handleCursorEnter);
      el.addEventListener('mouseleave', handleCursorLeave);
    });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      interactives.forEach((el) => {
        el.removeEventListener('mouseenter', handleCursorEnter);
        el.removeEventListener('mouseleave', handleCursorLeave);
      });
    };
  }, [handleMouseMove, handleCursorEnter, handleCursorLeave]);

  /* ── 3D Tilt Handler ── */
  const handleTilt = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const inner = card.querySelector('.tilt-card-inner') as HTMLElement;
    const shine = card.querySelector('.tilt-card-shine') as HTMLElement;
    if (!inner) return;

    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    inner.style.transform = `rotateY(${x * 12}deg) rotateX(${-y * 12}deg) translateZ(10px)`;
    if (shine) {
      shine.style.setProperty('--shine-x', `${(x + 0.5) * 100}%`);
      shine.style.setProperty('--shine-y', `${(y + 0.5) * 100}%`);
    }
  }, []);

  const handleTiltReset = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const inner = e.currentTarget.querySelector('.tilt-card-inner') as HTMLElement;
    if (inner) inner.style.transform = 'rotateY(0deg) rotateX(0deg) translateZ(0px)';
  }, []);

  /* ── Magnetic Button ── */
  const handleMagnet = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    gsap.to(btn, { x: x * 0.25, y: y * 0.25, duration: 0.3, ease: 'power2.out' });
  }, []);

  const handleMagnetReset = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    gsap.to(e.currentTarget, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
  }, []);

  /* ═══════════════════════════════════
     RENDER
     ═══════════════════════════════════ */

  return (
    <div ref={rootRef} className="landing-root">
      {/* Atmosphere layers */}
      <div className="film-grain" />
      <div className="vignette" />
      <canvas ref={canvasRef} className="particle-canvas" />

      {/* Custom cursor */}
      <div ref={cursorDot} className="cursor-dot" />
      <div ref={cursorRing} className="cursor-ring" />
      <div ref={cursorGlow} className="cursor-glow" />

      {/* Scroll progress */}
      <div ref={progressRef} className="scroll-progress" style={{ transform: 'scaleX(0)' }} />

      {/* ─── NAV ─── */}
      <header ref={navRef} className={`landing-nav${navScrolled ? ' scrolled' : ''}`}>
        <button type="button" className="landing-logo"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <img src="/talea_logo.png?v=20260209" alt="Talea" />
          <span>Talea<small>Storytelling Platform</small></span>
        </button>
        <nav className="landing-links">
          <a href="#features">Funktionen</a>
          <a href="#pricing">Preise</a>
          <a href="#trust">Sicherheit</a>
          <button type="button" className="nav-cta" onClick={() => navigate(startTarget)}>
            App starten <ArrowRight size={14} />
          </button>
        </nav>
      </header>

      <main>
        {/* ═══════════ HERO ═══════════ */}
        <section ref={heroRef} className="hero-scene">
          <div className="hero-ambient" />

          <p className="hero-kicker"><Sparkles size={14} />KI-Storytelling für Familien</p>

          <h1 className="hero-title">
            <span className="word">Wo&nbsp;</span>
            <span className="word">Kinder&nbsp;</span>
            <span className="word">zu&nbsp;</span>
            <span className="word word-accent">Helden&nbsp;</span>
            <span className="word">ihrer&nbsp;</span>
            <span className="word">eigenen&nbsp;</span>
            <span className="word">Geschichte&nbsp;</span>
            <span className="word">werden.</span>
          </h1>

          <p className="hero-sub gsap-hidden" style={{ transform: 'translateY(20px)' }}>
            Personalisierte Geschichten, Wissensdokus, Quiz und Audio&#8202;–&#8202;in einer
            magischen App. Dein Kind erlebt Abenteuer mit eigenen Avataren.
          </p>

          <div className="hero-actions gsap-hidden" style={{ transform: 'translateY(20px)' }}>
            <button type="button" className="btn-magic"
              onMouseMove={handleMagnet} onMouseLeave={handleMagnetReset}
              onClick={() => navigate(startTarget)}>
              Abenteuer starten <ArrowRight size={18} />
            </button>
            <a href="#features" className="btn-ghost">
              <ChevronDown size={16} /> Entdecken
            </a>
          </div>

          {/* Character parade */}
          <div className="hero-characters gsap-hidden" style={{ transform: 'translateY(30px)' }}>
            <div className="character-strip">
              {characters.map((c) => (
                <figure key={c.name} className="character-figure" style={{ '--float-delay': c.delay } as React.CSSProperties}>
                  <img src={c.image} alt={c.name} loading="eager" />
                  <figcaption>
                    {c.name}
                    <span className="char-mood">{c.mood}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>

          <div className="scroll-cue" style={{ opacity: 0 }}>
            <span className="scroll-cue-line" />
            Scrollen
          </div>
        </section>

        {/* ═══════════ CINEMATIC SCENES ═══════════ */}
        {cineScenes.map((scene, idx) => {
          const TagIcon = scene.tagIcon;
          return (
            <section key={scene.num}
              ref={(el) => { sceneRefs.current[idx] = el; }}
              className="cine-scene">
              <div className="cine-scene-bg">
                <img src={scene.image} alt={`Szene ${scene.num}`} loading="lazy" />
              </div>
              <div className="cine-scene-overlay" />
              <div className="cine-scene-content">
                <span className="cine-scene-num">{scene.num}</span>
                <span className="cine-scene-tag"><TagIcon size={14} /> {scene.tag}</span>
                <h2 className="cine-scene-title">
                  {scene.title.map((line, li) => (
                    <span key={li} className="line"><span className="line-inner">{line}</span></span>
                  ))}
                </h2>
                <p className="cine-scene-desc">{scene.desc}</p>
                <ul className="cine-scene-points">
                  {scene.points.map((pt) => <li key={pt}>{pt}</li>)}
                </ul>
              </div>
              {/* Character easter egg */}
              <div className="scene-character" style={scene.charPos}>
                <img src={scene.charImg} alt="Character" />
              </div>
            </section>
          );
        })}

        {/* ═══════════ DIVIDER ═══════════ */}
        <div className="cine-divider">
          <span className="cine-divider-word" data-text="FEATURES">FEATURES</span>
        </div>

        {/* ═══════════ HORIZONTAL FEATURES ═══════════ */}
        <section id="features" ref={featureRef} className="features-horizontal">
          <div className="features-header">
            <span className="section-badge"><Sparkles size={12} /> Funktionen</span>
            <h2 className="section-title">Alles was deine Familie braucht</h2>
            <p className="section-sub">
              Jede Funktion fühlt sich an wie eine eigene magische Insel.
            </p>
          </div>
          <div ref={trackRef} className="features-track">
            {features.map((feat) => {
              const FIcon = feat.icon;
              return (
                <div key={feat.title} className="tilt-card"
                  onMouseMove={handleTilt} onMouseLeave={handleTiltReset}>
                  <div className="tilt-card-shine" />
                  <div className="tilt-card-inner">
                    <div className="tilt-card-icon"><FIcon size={22} /></div>
                    <h3>{feat.title}</h3>
                    <p>{feat.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ═══════════ DIVIDER ═══════════ */}
        <div className="cine-divider">
          <span className="cine-divider-word" data-text="PREISE">PREISE</span>
        </div>

        {/* ═══════════ PRICING ═══════════ */}
        <section id="pricing" className="pricing-section">
          <span className="section-badge"><Crown size={12} /> Preise</span>
          <h2 className="section-title">Wähle dein Abenteuer‑Paket</h2>
          <p className="section-sub">Starte mit dem Starter‑Plan und upgrade jederzeit. Monatlich kündbar.</p>

          <div className="pricing-grid">
            {pricingPlans.map((plan) => {
              const PIcon = plan.icon;
              return (
                <div key={plan.name}
                  className={`pricing-card${plan.featured ? ' pricing-card--featured' : ''}`}>
                  {plan.featured && <span className="pricing-badge">Beliebteste Wahl</span>}
                  <div className="pricing-icon"><PIcon size={22} /></div>
                  <h3 className="pricing-name">{plan.name}</h3>
                  <p className="pricing-price">{plan.price}€<small> / Monat</small></p>
                  <div className="pricing-divider" />
                  <ul className="pricing-features">
                    {plan.features.map((f) => <li key={f}><Check size={14} />{f}</li>)}
                  </ul>
                  <button type="button" className="pricing-cta"
                    onMouseMove={handleMagnet} onMouseLeave={handleMagnetReset}
                    onClick={() => navigate(startTarget)}>
                    {plan.featured ? 'Jetzt starten' : 'Plan wählen'} <ArrowRight size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* ═══════════ COMPARISON ═══════════ */}
        <section className="comparison-section">
          <span className="section-badge"><Zap size={12} /> Vergleich</span>
          <h2 className="section-title">Warum Talea anders ist</h2>
          <div className="comparison-wrap">
            <table className="comparison-table">
              <thead>
                <tr><th>Kriterium</th><th>Story-Apps</th><th>Lern-Apps</th><th>Talea ✦</th></tr>
              </thead>
              <tbody>
                {comparisonData.map((row) => (
                  <tr key={row[0]}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ═══════════ DIVIDER ═══════════ */}
        <div className="cine-divider">
          <span className="cine-divider-word" data-text="SICHERHEIT">SICHERHEIT</span>
        </div>

        {/* ═══════════ TRUST ═══════════ */}
        <section id="trust" className="trust-section">
          <span className="section-badge"><ShieldCheck size={12} /> Für Eltern</span>
          <h2 className="section-title">Volle Kontrolle, volle Magie</h2>
          <p className="section-sub">
            Talea gibt Eltern echte Werkzeuge – nicht nur einen Kindermodus‑Schalter.
          </p>
          <div className="trust-grid">
            {trustPoints.map((tp) => {
              const TIcon = tp.icon;
              return (
                <div key={tp.title} className="trust-card">
                  <div className="trust-card-icon" style={{ color: tp.color }}><TIcon size={20} /></div>
                  <h4>{tp.title}</h4>
                  <p>{tp.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ═══════════ FINAL CTA ═══════════ */}
        <section className="final-cta-scene">
          <div className="final-cta-bg">
            <img src="/landing-assets/cine_6_outro.png" alt="" />
          </div>
          <div className="final-cta-content">
            <span className="section-badge" style={{ marginBottom: '1rem' }}>
              <Sparkles size={12} /> Bereit?
            </span>
            <h2 className="final-cta-title">
              Die Reise beginnt<br />mit einem Klick.
            </h2>
            <p className="section-sub" style={{ margin: '1rem auto 2rem', maxWidth: 500 }}>
              Über 50 Charaktere warten darauf, Teil eurer Geschichte zu werden.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="btn-magic"
                onMouseMove={handleMagnet} onMouseLeave={handleMagnetReset}
                onClick={() => navigate(startTarget)}>
                Jetzt starten <ArrowRight size={18} />
              </button>
              <button type="button" className="btn-ghost" onClick={() => navigate('/auth')}>
                Login / Account
              </button>
            </div>
            <div className="final-cta-characters">
              {characters.slice(0, 6).map((c) => (
                <img key={c.name} src={c.image} alt={c.name} />
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <p>© 2026 Talea · Storytelling Platform · <a href="/auth">Login</a></p>
      </footer>
    </div>
  );
};

export default LandingPage;
