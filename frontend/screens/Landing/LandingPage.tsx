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
  { name: 'Drache', image: '/landing-assets/generated/characters/drache.webp', mood: 'Abenteuer', delay: '0.6s' },
  { name: 'Goblin', image: '/landing-assets/generated/characters/goblin.webp', mood: 'Schalk', delay: '1.2s' },
  { name: 'Oma', image: '/landing-assets/generated/characters/oma.webp', mood: 'Weisheit', delay: '1.8s' },
  { name: 'König', image: '/landing-assets/generated/characters/wilhelm.webp', mood: 'Mentor', delay: '2.4s' },
  { name: 'Troll', image: '/landing-assets/generated/characters/troll.webp', mood: 'Humor', delay: '3s' },
  { name: 'Räuber', image: '/landing-assets/generated/characters/rauber.webp', mood: 'Spannung', delay: '3.6s' },
  { name: 'Hexe', image: '/landing-assets/generated/characters/image.webp', mood: 'Magie', delay: '4.2s' },
];

const cineScenes = [
  {
    num: '01',
    tag: 'Story-Engine',
    tagIcon: BookOpenText,
    title: ['Ein Buch.', 'Unendliche', 'Welten.'],
    desc: 'Dein Kind öffnet ein magisches Buch und taucht ein in eine Welt, die nur für sie geschaffen wurde. Jede Geschichte ist einzigartig.',
    points: ['KI-generierte Geschichten in Sekunden', 'Genre, Stimmung & Alter frei wählbar', 'Eigene Avatare als Hauptfiguren'],
    image: '/landing-assets/cine_1_book.png',
    charImg: '/landing-assets/generated/characters/detektive.webp',
    charPos: { bottom: '15%', right: '8%' },
  },
  {
    num: '02',
    tag: 'Cinematic Reading',
    tagIcon: Sparkles,
    title: ['Magie', 'entfaltet', 'sich.'],
    desc: 'Aus Worten werden Welten. Der cineastische Lesemodus verwandelt jede Geschichte in ein visuelles Erlebnis — Szene für Szene, wie ein Film.',
    points: ['3 Lesemodi: Cinematic, Klassisch, Scroll', 'Automatisch generierte Szenenbilder', 'Audio-Erzählung zuschaltbar'],
    image: '/landing-assets/cine_2_magic.png',
    charImg: '/landing-assets/generated/characters/drache.webp',
    charPos: { top: '20%', right: '5%' },
  },
  {
    num: '03',
    tag: 'Avatar-System',
    tagIcon: Users,
    title: ['Deine Helden', 'erwachen', 'zum Leben.'],
    desc: 'Avatare entwickeln Persönlichkeit, sammeln Erinnerungen, verdienen Perks und meistern Quests. Jede Story macht sie stärker.',
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
    desc: 'Verzauberte Wälder, Rätsel und Schätze. Jedes Abenteuer ist einzigartig und auf dein Kind zugeschnitten.',
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
    desc: 'Von Dinosauriern bis Raumfahrt — Audio-Dokus verbinden Quiz und Struktur zu einer Lernstrecke, die Kinder lieben.',
    points: ['Audio-Dokus für unterwegs & Schlafenszeit', 'Quiz direkt verknüpft mit Erklärungen', 'Didaktische Struktur mit Lernzielen'],
    image: '/landing-assets/cine_5_dokus.png',
    charImg: '/landing-assets/generated/characters/oma.webp',
    charPos: { bottom: '18%', right: '6%' },
  },
];

const features = [
  { icon: Wand2, title: 'Story-Wizard', desc: 'Erstelle in 5 Schritten eine perfekte Geschichte mit KI-Unterstützung.' },
  { icon: Headphones, title: 'Audio-Erlebnis', desc: 'Alle Inhalte als Hörgeschichte — perfekt für Autofahrten und Schlafenszeit.' },
  { icon: MessageCircleMore, title: 'Tavi KI-Assistent', desc: 'Stelle Fragen, starte Stories und lass dir Funktionen erklären — direkt aus dem Chat.' },
  { icon: AudioLines, title: 'Quiz & Fakten', desc: 'Interaktive Quiz-Bereiche direkt in jeder Doku — Wissen spielerisch prüfen.' },
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
  { icon: ShieldCheck, title: 'Eltern-Dashboard mit PIN', desc: 'Tabu-Themen, Lernziele und Tageslimits zentral steuern. Sicherheit fließt direkt in die KI-Generierung ein.' },
  { icon: Wand2, title: 'KI-Sicherheit eingebaut', desc: 'Tabu-Wörter, Altersfilter und Lernregeln werden direkt in den Prompt eingebettet — präventiv, nicht nachträglich.' },
  { icon: Rocket, title: 'Wächst mit deiner Familie', desc: 'Avatar-Fortschritt, Lernkreisläufe und Quests sorgen für nachhaltige Nutzung statt kurzfristiger Unterhaltung.' },
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
  const colors = [
    'rgba(232,168,56,0.6)',
    'rgba(196,120,50,0.5)',
    'rgba(240,216,168,0.5)',
    'rgba(136,200,232,0.3)',
  ];
  return {
    x: Math.random() * w, y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
    size: 1 + Math.random() * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    alpha: 0, life: 250 + Math.random() * 350, maxLife: 600,
  };
}

function spawnCursorSparkle(x: number, y: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.4 + Math.random() * 1.2;
  return {
    x, y,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 0.4,
    size: 0.8 + Math.random() * 1.5,
    color: `hsla(${35 + Math.random() * 20}, 75%, 65%, 0.85)`,
    alpha: 1, life: 35 + Math.random() * 35, maxLife: 70,
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
  const [activeScene, setActiveScene] = useState(-1);
  const [showStoryArc, setShowStoryArc] = useState(false);
  const storyArcRef = useRef<HTMLDivElement>(null);

  /* ── Lenis + GSAP ScrollTrigger ── */
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.3, smoothWheel: true, touchMultiplier: 1.5 });

    lenis.on('scroll', () => { ScrollTrigger.update(); });
    gsap.ticker.add((time) => { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    const handleScroll = () => { setNavScrolled(window.scrollY > 50); };
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

      /* Hero entrance — dramatic stagger */
      const heroTl = gsap.timeline({ delay: 0.3 });
      heroTl
        .to('.hero-title .word', {
          opacity: 1, y: 0, rotateX: 0, skewX: 0,
          duration: 0.85, stagger: 0.1, ease: 'expo.out',
        })
        .to('.hero-sub', { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, '-=0.4')
        .to('.hero-actions', { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' }, '-=0.25')
        .to('.hero-characters', { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, '-=0.35')
        .to('.scroll-cue', { opacity: 1, duration: 0.5 }, '-=0.2');

      /* Cinematic scenes – pinned with parallax scrub */
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
              end: '+=160%',
              pin: true,
              scrub: 1,
              anticipatePin: 1,
            },
          });

          /* Cinematic camera: slow zoom-in with vertical pan */
          tl.fromTo(bg,
            { scale: 1.4, y: 30, filter: 'brightness(0.6) saturate(0.5)' },
            { scale: 1.05, y: -25, filter: 'brightness(0.9) saturate(0.85)', duration: 1, ease: 'none' }
          )
            /* Tag slides in from left */
            .fromTo(tag, { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.3 }, 0.12)
            /* Title lines reveal — dramatic stagger */
            .fromTo(lines, { y: '130%', rotateX: 15 }, { y: '0%', rotateX: 0, duration: 0.5, stagger: 0.1, ease: 'power3.out' }, 0.2)
            /* Description fades up */
            .fromTo(desc, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.35 }, 0.5)
            /* Points slide in one by one */
            .fromTo(points, { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.25, stagger: 0.08 }, 0.6);

          /* Character pops in with dramatic entrance */
          if (charEl) {
            tl.fromTo(charEl,
              { opacity: 0, scale: 0.3, rotate: -25, y: 30 },
              { opacity: 0.8, scale: 1, rotate: 0, y: 0, duration: 0.5, ease: 'back.out(1.6)' },
              0.7
            );
          }
        });
      });

      /* Mobile: reveal animations */
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

      /* Horizontal features (desktop) */
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

      /* Chapter cards — cinematic reveal */
      gsap.utils.toArray<HTMLElement>('.chapter-card').forEach((card) => {
        const num = card.querySelector('.chapter-number') as HTMLElement;
        const title = card.querySelector('.chapter-title') as HTMLElement;
        const sub = card.querySelector('.chapter-subtitle') as HTMLElement;
        const line = card.querySelector('.chapter-line') as HTMLElement;

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: card,
            start: 'top 70%',
            end: 'bottom 30%',
            toggleActions: 'play none none reverse',
          },
        });

        if (num) tl.to(num, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0);
        if (line) tl.to(line, { width: '80px', duration: 0.8, ease: 'expo.out' }, 0.1);
        if (title) tl.to(title, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 0.2);
        if (sub) tl.to(sub, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0.4);
      });

      /* Story arc visibility */
      ScrollTrigger.create({
        trigger: '.cine-scene',
        start: 'top center',
        endTrigger: '.final-cta-scene',
        end: 'top center',
        onToggle: (self) => setShowStoryArc(self.isActive),
      });

      /* Track active scene */
      sceneRefs.current.forEach((scene, i) => {
        if (!scene) return;
        ScrollTrigger.create({
          trigger: scene,
          start: 'top center',
          end: 'bottom center',
          onEnter: () => setActiveScene(i),
          onEnterBack: () => setActiveScene(i),
        });
      });

      /* Dividers */
      gsap.utils.toArray<HTMLElement>('.cine-divider-word').forEach((word) => {
        gsap.fromTo(word, { opacity: 0, scale: 0.85, y: 25 }, {
          opacity: 1, scale: 1, y: 0, duration: 0.9, ease: 'power3.out',
          scrollTrigger: { trigger: word, start: 'top 85%' },
        });
      });

      /* Pricing cards */
      gsap.fromTo('.pricing-card', { opacity: 0, y: 55, rotateX: 8 }, {
        opacity: 1, y: 0, rotateX: 0, duration: 0.65, stagger: 0.13, ease: 'power3.out',
        scrollTrigger: { trigger: '.pricing-grid', start: 'top 80%' },
      });

      /* Trust cards */
      gsap.fromTo('.trust-card', { opacity: 0, y: 45 }, {
        opacity: 1, y: 0, duration: 0.55, stagger: 0.1, ease: 'power2.out',
        scrollTrigger: { trigger: '.trust-grid', start: 'top 80%' },
      });

      /* Comparison table */
      gsap.fromTo('.comparison-table tr', { opacity: 0, x: -15 }, {
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

    for (let i = 0; i < 30; i++) {
      particles.current.push(spawnFirefly(canvas.width, canvas.height));
    }

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (mousePos.current.x > 0 && Math.random() > 0.75) {
        particles.current.push(spawnCursorSparkle(mousePos.current.x, mousePos.current.y));
      }

      const fireflyCount = particles.current.filter(p => p.maxLife > 100).length;
      if (fireflyCount < 25) {
        particles.current.push(spawnFirefly(canvas.width, canvas.height));
      }

      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;

        if (p.maxLife > 100) {
          const progress = 1 - (p.life / p.maxLife);
          p.alpha = progress < 0.1 ? progress * 10 : progress > 0.85 ? (1 - progress) * 6.67 : 0.6 + Math.sin(Date.now() * 0.002 + i) * 0.25;
          p.vx += (Math.random() - 0.5) * 0.015;
          p.vy += (Math.random() - 0.5) * 0.015;
          p.vx *= 0.99; p.vy *= 0.99;
        } else {
          p.vy += 0.025;
          p.alpha = Math.max(0, p.life / p.maxLife);
        }

        if (p.life <= 0) { particles.current.splice(i, 1); continue; }

        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        if (p.maxLife > 100 && p.alpha > 0.25) {
          ctx.globalAlpha = p.alpha * 0.12;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 5, 0, Math.PI * 2);
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
        duration: 0.18, ease: 'power2.out',
      });
    }
    if (cursorGlow.current) {
      gsap.to(cursorGlow.current, {
        left: e.clientX, top: e.clientY,
        duration: 0.45, ease: 'power2.out',
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

  /* ── 3D Tilt ── */
  const handleTilt = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const inner = card.querySelector('.tilt-card-inner') as HTMLElement;
    const shine = card.querySelector('.tilt-card-shine') as HTMLElement;
    if (!inner) return;

    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    inner.style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 14}deg) translateZ(12px)`;
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
    gsap.to(btn, { x: x * 0.2, y: y * 0.2, duration: 0.3, ease: 'power2.out' });
  }, []);

  const handleMagnetReset = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    gsap.to(e.currentTarget, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
  }, []);

  /* ═══════════════════════════════════
     RENDER
     ═══════════════════════════════════ */

  return (
    <div ref={rootRef} className="landing-root">
      {/* Atmosphere */}
      <div className="film-grain" />
      <div className="vignette" />
      <canvas ref={canvasRef} className="particle-canvas" />

      {/* Custom cursor */}
      <div ref={cursorDot} className="cursor-dot" />
      <div ref={cursorRing} className="cursor-ring" />
      <div ref={cursorGlow} className="cursor-glow" />

      {/* Scroll progress */}
      <div ref={progressRef} className="scroll-progress" style={{ transform: 'scaleX(0)' }} />

      {/* Story Arc — vertical scene navigation */}
      <div ref={storyArcRef} className={`story-arc${showStoryArc ? ' visible' : ''}`}>
        {cineScenes.map((scene, i) => (
          <React.Fragment key={scene.num}>
            <div className={`story-arc-dot${activeScene === i ? ' active' : ''}${activeScene > i ? ' passed' : ''}`} />
            {i < cineScenes.length - 1 && (
              <div className="story-arc-line">
                <div className="story-arc-progress" style={{ height: activeScene > i ? '100%' : activeScene === i ? '50%' : '0%' }} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

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
            App starten <ArrowRight size={13} />
          </button>
        </nav>
      </header>

      <main>
        {/* ═══════════ HERO ═══════════ */}
        <section ref={heroRef} className="hero-scene">
          <div className="hero-ambient" />

          {/* Burst lines */}
          <div className="hero-burst" aria-hidden="true">
            {Array.from({ length: 14 }).map((_, i) => (
              <div
                key={i}
                className="hero-burst-line"
                style={{
                  transform: `rotate(${i * (360 / 14)}deg)`,
                  animationDelay: `${i * 0.035}s`,
                  opacity: 0.35 + (i % 3) * 0.12,
                }}
              />
            ))}
          </div>

          <p className="hero-kicker"><Sparkles size={13} />KI-Storytelling für Familien</p>

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
            Personalisierte Geschichten, Wissensdokus, Quiz und Audio&#8202;—&#8202;in einer
            magischen App. Dein Kind erlebt Abenteuer mit eigenen Avataren.
          </p>

          <div className="hero-actions gsap-hidden" style={{ transform: 'translateY(20px)' }}>
            <button type="button" className="btn-magic"
              onMouseMove={handleMagnet} onMouseLeave={handleMagnetReset}
              onClick={() => navigate(startTarget)}>
              Abenteuer starten <ArrowRight size={17} />
            </button>
            <a href="#features" className="btn-ghost">
              <ChevronDown size={15} /> Entdecken
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

        {/* ═══════════ CHAPTER I — Intro ═══════════ */}
        <div className="chapter-card">
          <span className="chapter-number">Kapitel I</span>
          <div className="chapter-line" />
          <h2 className="chapter-title">Es war einmal...</h2>
          <p className="chapter-subtitle">Eine Geschichte, die nur für dein Kind geschrieben wird</p>
        </div>

        {/* ═══════════ CINEMATIC SCENES ═══════════ */}
        {cineScenes.map((scene, idx) => {
          const TagIcon = scene.tagIcon;
          const chapterLabels = ['', 'Kapitel II', 'Kapitel III', 'Kapitel IV', 'Kapitel V'];
          const chapterTitles = ['', 'Die Magie erwacht', 'Helden werden geboren', 'Das Abenteuer ruft', 'Wissen ist Macht'];
          return (
            <React.Fragment key={scene.num}>
              {/* Chapter transition card */}
              {idx > 0 && (
                <div className="chapter-card">
                  <span className="chapter-number">{chapterLabels[idx]}</span>
                  <div className="chapter-line" />
                  <h2 className="chapter-title">{chapterTitles[idx]}</h2>
                </div>
              )}

              <section
                ref={(el) => { sceneRefs.current[idx] = el; }}
                className="cine-scene">
                {/* Scene counter */}
                <div className="scene-counter">
                  <span className="scene-counter-line" />
                  <span><span className="scene-counter-current">{scene.num}</span> / 05</span>
                </div>

                <div className="cine-scene-bg">
                  <img src={scene.image} alt={`Szene ${scene.num}`} loading="lazy" />
                </div>
                <div className="cine-scene-overlay" />
                <div className="spotlight" />
                <div className="cine-scene-content">
                  <span className="cine-scene-num">{scene.num}</span>
                  <span className="cine-scene-tag"><TagIcon size={13} /> {scene.tag}</span>
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
                <div className="scene-character" style={scene.charPos}>
                  <img src={scene.charImg} alt="Character" />
                </div>
              </section>
            </React.Fragment>
          );
        })}

        {/* ═══════════ DIVIDER ═══════════ */}
        <div className="cine-divider">
          <span className="cine-divider-word" data-text="FEATURES">FEATURES</span>
        </div>

        {/* ═══════════ HORIZONTAL FEATURES ═══════════ */}
        <section id="features" ref={featureRef} className="features-horizontal">
          <div className="features-header">
            <span className="section-badge"><Sparkles size={11} /> Funktionen</span>
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
                    <div className="tilt-card-icon"><FIcon size={21} /></div>
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
          <span className="section-badge"><Crown size={11} /> Preise</span>
          <h2 className="section-title">Wähle dein Abenteuer-Paket</h2>
          <p className="section-sub">Starte mit dem Starter-Plan und upgrade jederzeit. Monatlich kündbar.</p>

          <div className="pricing-grid">
            {pricingPlans.map((plan) => {
              const PIcon = plan.icon;
              return (
                <div key={plan.name}
                  className={`pricing-card${plan.featured ? ' pricing-card--featured' : ''}`}>
                  {plan.featured && <span className="pricing-badge">Beliebteste Wahl</span>}
                  <div className="pricing-icon"><PIcon size={21} /></div>
                  <h3 className="pricing-name">{plan.name}</h3>
                  <p className="pricing-price">{plan.price}€<small> / Monat</small></p>
                  <div className="pricing-divider" />
                  <ul className="pricing-features">
                    {plan.features.map((f) => <li key={f}><Check size={13} />{f}</li>)}
                  </ul>
                  <button type="button" className="pricing-cta"
                    onMouseMove={handleMagnet} onMouseLeave={handleMagnetReset}
                    onClick={() => navigate(startTarget)}>
                    {plan.featured ? 'Jetzt starten' : 'Plan wählen'} <ArrowRight size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* ═══════════ COMPARISON ═══════════ */}
        <section className="comparison-section">
          <span className="section-badge"><Zap size={11} /> Vergleich</span>
          <h2 className="section-title">Warum Talea anders ist</h2>
          <div className="comparison-wrap">
            <table className="comparison-table">
              <thead>
                <tr><th>Kriterium</th><th>Story-Apps</th><th>Lern-Apps</th><th>Talea</th></tr>
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
          <span className="section-badge"><ShieldCheck size={11} /> Für Eltern</span>
          <h2 className="section-title">Volle Kontrolle, volle Magie</h2>
          <p className="section-sub">
            Talea gibt Eltern echte Werkzeuge — nicht nur einen Kindermodus-Schalter.
          </p>
          <div className="trust-grid">
            {trustPoints.map((tp) => {
              const TIcon = tp.icon;
              return (
                <div key={tp.title} className="trust-card">
                  <div className="trust-card-icon"><TIcon size={19} /></div>
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
            <span className="section-badge" style={{ marginBottom: '1.2rem' }}>
              <Sparkles size={11} /> Bereit?
            </span>
            <h2 className="final-cta-title">
              Die Reise beginnt<br />mit einem Klick.
            </h2>
            <p className="section-sub" style={{ margin: '1.2rem auto 2.5rem', maxWidth: 480 }}>
              Über 50 Charaktere warten darauf, Teil eurer Geschichte zu werden.
            </p>
            <div style={{ display: 'flex', gap: '1.2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="btn-magic"
                onMouseMove={handleMagnet} onMouseLeave={handleMagnetReset}
                onClick={() => navigate(startTarget)}>
                Jetzt starten <ArrowRight size={17} />
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
