import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion';
import {
  ArrowRight,
  AudioLines,
  BookOpenText,
  Compass,
  MessageCircleMore,
  MoonStar,
  ShieldCheck,
  Sparkles,
  Users,
  WandSparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import './LandingPage.css';

type IconComponent = LucideIcon;

type IslandFeature = {
  title: string;
  subtitle: string;
  description: string;
  points: string[];
  image: string;
  icon: IconComponent;
  tag: string;
};

type CharacterSpot = {
  name: string;
  image: string;
  mood: string;
  className: string;
};

const islandFeatures: IslandFeature[] = [
  {
    title: 'Story Engine',
    subtitle: 'Personalisierte Geschichten in Minuten',
    description:
      'Aus euren Avataren werden echte Heldinnen und Helden mit rotem Faden, Lernimpulsen und klarem Spannungsbogen.',
    points: [
      'Teilnehmende Charaktere pro Story frei waehlbar',
      'Vorlese- und Lesemodus fuer Kinder und Eltern',
      'Quiz und Fakten direkt im Lesefluss integriert',
    ],
    image: '/landing-assets/generated/story-engine-island.webp',
    icon: BookOpenText,
    tag: 'Insel 01',
  },
  {
    title: 'Doku Studio',
    subtitle: 'Wissen als Erlebnis statt als Textwand',
    description:
      'Wissensdokus verbinden Stimme, Struktur und Visuals zu einer ruhigen, modernen Lernstrecke fuer Schule und Familie.',
    points: [
      'Audio-Dokus fuer unterwegs und zum Einschlafen',
      'Klar strukturierter Reader mit Kapiteln',
      'Themen von Natur bis Raumfahrt moeglich',
    ],
    image: '/landing-assets/generated/doku-studio-island.webp',
    icon: AudioLines,
    tag: 'Insel 02',
  },
  {
    title: 'Avatar Atelier',
    subtitle: 'Charaktere mit Persoenlichkeit und Entwicklung',
    description:
      'Avatare wachsen mit Erinnerungen, Eigenschaften und Meilensteinen. So bleibt jede Story emotional verankert.',
    points: [
      'Avatar Wizard fuer schnelle Erstellung',
      'Persoenlichkeit, Tagebuch und Schatzkammer',
      'Bearbeitungsmodus mit sauberer Profilstruktur',
    ],
    image: '/landing-assets/generated/avatar-atelier-island.webp',
    icon: Users,
    tag: 'Insel 03',
  },
  {
    title: 'Tavi Copilot',
    subtitle: 'Eine KI-Figur fuer Fragen, Ideen und Produktion',
    description:
      'Tavi hilft beim Generieren, erklaert Funktionen und begleitet den kreativen Flow in Story und Doku.',
    points: [
      'Fragen stellen und direkt Antworten bekommen',
      'Stories und Dokus aus einer Konversation starten',
      'Schneller Zugriff ohne Kontextwechsel',
    ],
    image: '/landing-assets/generated/tavi-copilot-orbit.webp',
    icon: MessageCircleMore,
    tag: 'Insel 04',
  },
];

const characterSpots: CharacterSpot[] = [
  {
    name: 'Detektive',
    image: '/landing-assets/generated/characters/detektive.webp',
    mood: 'Story Team',
    className: 'hero-character-a',
  },
  {
    name: 'Wilhelm',
    image: '/landing-assets/generated/characters/wilhelm.webp',
    mood: 'Mentor',
    className: 'hero-character-b',
  },
  {
    name: 'Drache',
    image: '/landing-assets/generated/characters/drache.webp',
    mood: 'Abenteuer',
    className: 'hero-character-c',
  },
  {
    name: 'Oma',
    image: '/landing-assets/generated/characters/oma.webp',
    mood: 'Geborgenheit',
    className: 'hero-character-d',
  },
  {
    name: 'Troll',
    image: '/landing-assets/generated/characters/troll.webp',
    mood: 'Humor',
    className: 'hero-character-e',
  },
  {
    name: 'Raeuber',
    image: '/landing-assets/generated/characters/rauber2.webp',
    mood: 'Spannung',
    className: 'hero-character-f',
  },
];

const journeySteps = [
  'Figuren auswaehlen und Storyziel festlegen',
  'Ton, Tiefe und Lernfokus bestimmen',
  'Ausgabe als Story, Doku und Audio erleben',
  'Mit Quiz, Fakten und Erinnerungen vertiefen',
];

const trustPoints = [
  {
    title: 'Dark und Light Mode',
    description:
      'Ein visuelles System fuer beide Modi. Umschaltbar in den Einstellungen, sauber auf allen Kernseiten.',
    icon: MoonStar,
  },
  {
    title: 'Sicher und familienfreundlich',
    description:
      'Klare Rollen, nachvollziehbare Bedienung und eine Umgebung, die fuer Kinder sowie Erwachsene ruhig bleibt.',
    icon: ShieldCheck,
  },
  {
    title: 'Admin Ready',
    description:
      'Interne Bereiche bleiben erreichbar, waehrend die Hauptnavigation schlank und kundenfreundlich bleibt.',
    icon: Compass,
  },
];

const floatDots = Array.from({ length: 16 }, (_, index) => ({
  left: `${(index * 17) % 96 + 2}%`,
  top: `${(index * 23) % 80 + 8}%`,
  delay: `${(index % 6) * 0.45}s`,
  duration: `${4 + (index % 5) * 1.1}s`,
}));

const sectionVariant = {
  hidden: { opacity: 0, y: 36 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: [0.21, 0.47, 0.32, 0.98] as const,
    },
  },
};

const cardVariant = {
  hidden: { opacity: 0, y: 24 },
  show: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: index * 0.08,
      duration: 0.5,
      ease: [0.2, 0.65, 0.3, 0.95] as const,
    },
  }),
};

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isSignedIn } = useUser();
  const pageRef = useRef<HTMLDivElement>(null);
  const islandsRef = useRef<HTMLElement>(null);
  const flowRef = useRef<HTMLElement>(null);
  const trustRef = useRef<HTMLElement>(null);
  const ctaRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const startTarget = isSignedIn ? '/' : '/auth';

  const { scrollYProgress } = useScroll({
    target: pageRef,
    offset: ['start start', 'end end'],
  });
  const { scrollYProgress: islandsProgress } = useScroll({
    target: islandsRef,
    offset: ['start end', 'end start'],
  });
  const { scrollYProgress: flowProgress } = useScroll({
    target: flowRef,
    offset: ['start end', 'end start'],
  });
  const { scrollYProgress: trustProgress } = useScroll({
    target: trustRef,
    offset: ['start end', 'end start'],
  });
  const { scrollYProgress: ctaProgress } = useScroll({
    target: ctaRef,
    offset: ['start end', 'end start'],
  });

  const skyY = useTransform(
    scrollYProgress,
    [0, 1],
    [0, shouldReduceMotion ? 0 : -220]
  );
  const cloudY = useTransform(
    scrollYProgress,
    [0, 1],
    [0, shouldReduceMotion ? 0 : -90]
  );
  const castleY = useTransform(
    scrollYProgress,
    [0, 1],
    [0, shouldReduceMotion ? 0 : -130]
  );
  const headlineY = useTransform(
    scrollYProgress,
    [0, 0.4],
    [0, shouldReduceMotion ? 0 : -60]
  );
  const charactersY = useTransform(
    scrollYProgress,
    [0, 0.5],
    [0, shouldReduceMotion ? 0 : -42]
  );
  const ribbonAY = useTransform(scrollYProgress, [0, 1], [0, shouldReduceMotion ? 0 : -360]);
  const ribbonBY = useTransform(scrollYProgress, [0, 1], [0, shouldReduceMotion ? 0 : -180]);
  const islandsHeadingY = useTransform(
    islandsProgress,
    [0, 0.5, 1],
    [shouldReduceMotion ? 0 : 26, 0, shouldReduceMotion ? 0 : -26]
  );
  const islandCardYEven = useTransform(
    islandsProgress,
    [0, 1],
    [shouldReduceMotion ? 0 : 24, shouldReduceMotion ? 0 : -24]
  );
  const islandCardYOdd = useTransform(
    islandsProgress,
    [0, 1],
    [shouldReduceMotion ? 0 : -18, shouldReduceMotion ? 0 : 18]
  );
  const flowSectionY = useTransform(
    flowProgress,
    [0, 0.5, 1],
    [shouldReduceMotion ? 0 : 24, 0, shouldReduceMotion ? 0 : -16]
  );
  const flowMainImageY = useTransform(
    flowProgress,
    [0, 1],
    [shouldReduceMotion ? 0 : 34, shouldReduceMotion ? 0 : -36]
  );
  const flowFloatingImageY = useTransform(
    flowProgress,
    [0, 1],
    [shouldReduceMotion ? 0 : -26, shouldReduceMotion ? 0 : 34]
  );
  const trustSectionY = useTransform(
    trustProgress,
    [0, 0.5, 1],
    [shouldReduceMotion ? 0 : 20, 0, shouldReduceMotion ? 0 : -14]
  );
  const trustImageY = useTransform(
    trustProgress,
    [0, 1],
    [shouldReduceMotion ? 0 : 30, shouldReduceMotion ? 0 : -30]
  );
  const ctaPanoramaY = useTransform(
    ctaProgress,
    [0, 1],
    [shouldReduceMotion ? 0 : 22, shouldReduceMotion ? 0 : -22]
  );

  return (
    <div ref={pageRef} className="landing-root">
      <motion.div className="landing-progress" style={{ scaleX: scrollYProgress }} />
      <motion.div className="landing-parallax-ribbon landing-parallax-ribbon-a" style={{ y: ribbonAY }} />
      <motion.div className="landing-parallax-ribbon landing-parallax-ribbon-b" style={{ y: ribbonBY }} />

      <header className="landing-nav">
        <button
          type="button"
          className="landing-logo"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Zurueck zum Anfang"
        >
          <img src="/talea_logo.png?v=20260209" alt="Talea Logo" />
          <span>
            Talea
            <small>Storytelling Platform</small>
          </span>
        </button>

        <nav className="landing-links" aria-label="Landing Navigation">
          <a href="#islands">Funktionen</a>
          <a href="#flow">Ablauf</a>
          <a href="#trust">Qualitaet</a>
          <button type="button" onClick={() => navigate(startTarget)} className="landing-start-ghost">
            App starten
          </button>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <motion.div className="hero-layer hero-sky-layer" style={{ y: skyY }} />
          <motion.div className="hero-layer hero-cloud-layer" style={{ y: cloudY }} />

          <div className="hero-dots" aria-hidden="true">
            {floatDots.map((dot, index) => (
              <span
                key={index}
                style={{
                  left: dot.left,
                  top: dot.top,
                  animationDelay: dot.delay,
                  animationDuration: dot.duration,
                }}
              />
            ))}
          </div>

          <motion.div className="hero-content" style={{ y: headlineY }}>
            <p className="hero-kicker">
              <Sparkles size={16} />
              Creative Learning Universe
            </p>
            <h1>
              Die Geschichtenwelt,
              <br />
              die sich wie ein Freizeitpark fuer Fantasie anfuehlt.
            </h1>
            <p>
              Talea verbindet Storys, Wissensdokus, Avatare und Audio zu einer einzigen
              Erlebnisreise. Modern, klar und bereit fuer echte Familiennutzung.
            </p>

            <div className="hero-actions">
              <button type="button" className="landing-start-solid" onClick={() => navigate(startTarget)}>
                App starten
                <ArrowRight size={16} />
              </button>
              <a href="#islands" className="landing-inline-link">
                Funktionen entdecken
              </a>
            </div>

            <div className="hero-character-row" aria-label="Beispielcharaktere">
              <span>Lio</span>
              <span>Mila</span>
              <span>Noru</span>
              <span>Tavi</span>
              <span>+ eigene Figuren</span>
            </div>
          </motion.div>

          <motion.div className="hero-visual-shell" style={{ y: castleY }}>
            <div className="hero-visual-glow" />
            <div className="hero-visual-frame">
              <img src="/landing-assets/generated/hero-castle-island.webp" alt="Magische Inselwelt fuer Talea" />
              <div className="hero-visual-badges">
                <span>Story</span>
                <span>Doku</span>
                <span>Audio</span>
              </div>
            </div>
          </motion.div>

          <motion.div className="hero-character-cloud" style={{ y: charactersY }}>
            {characterSpots.map((character, index) => (
              <motion.figure
                key={character.name}
                className={`hero-character-card ${character.className}`}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.35 + index * 0.08,
                  duration: 0.45,
                  ease: [0.2, 0.65, 0.3, 0.95],
                }}
              >
                <img src={character.image} alt={`${character.name} Charakter`} />
                <figcaption>
                  <span>{character.name}</span>
                  <small>{character.mood}</small>
                </figcaption>
              </motion.figure>
            ))}
          </motion.div>
        </section>

        <motion.section
          id="islands"
          ref={islandsRef}
          className="landing-section"
          style={{ y: islandsHeadingY }}
          variants={sectionVariant}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
        >
          <div className="section-head">
            <p>Funktionen als Inseln</p>
            <h2>Jede Insel loest einen echten Teil der Nutzerreise</h2>
          </div>

          <div className="island-grid">
            {islandFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.article
                  key={feature.title}
                  className="island-card"
                  style={{ y: index % 2 === 0 ? islandCardYEven : islandCardYOdd }}
                  variants={cardVariant}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, amount: 0.2 }}
                  custom={index}
                >
                  <div className="island-card-top">
                    <span className="island-tag">{feature.tag}</span>
                    <span className="island-icon-wrap">
                      <Icon size={18} />
                    </span>
                  </div>

                  <h3>{feature.title}</h3>
                  <h4>{feature.subtitle}</h4>
                  <p>{feature.description}</p>

                  <ul>
                    {feature.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>

                  <div className="island-image-frame">
                    <img src={feature.image} alt={`${feature.title} Vorschau`} />
                  </div>
                </motion.article>
              );
            })}
          </div>
        </motion.section>

        <motion.section id="flow" ref={flowRef} className="landing-section split-layout" style={{ y: flowSectionY }}>
          <motion.article
            className="panel-card"
            variants={sectionVariant}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
          >
            <p className="panel-label">
              <WandSparkles size={16} />
              Produktionsfluss
            </p>
            <h2>Von Idee bis fertigem Audio in einem String</h2>
            <p>
              Der Ablauf ist bewusst einfach gehalten: Charaktere waehlen, Modus setzen,
              generieren, lesen oder hoeren. Das reduziert Reibung und fuehlt sich professionell
              statt technisch an.
            </p>

            <ol className="journey-list">
              {journeySteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </motion.article>

          <motion.article
            className="panel-card panel-card-visual"
            variants={sectionVariant}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
          >
            <div className="panel-image-stack">
              <motion.div className="panel-image panel-image-main" style={{ y: flowMainImageY }}>
                <img src="/landing-assets/generated/journey-map.webp" alt="Workflow Visual fuer Talea" />
              </motion.div>
              <motion.div className="panel-image panel-image-floating" style={{ y: flowFloatingImageY }}>
                <img src="/landing-assets/generated/audio-wave-garden.webp" alt="Audio Visual fuer Talea" />
              </motion.div>
            </div>
            <div className="panel-audio-chip">
              <AudioLines size={16} />
              Audio-Player integriert in mobile Navigation
            </div>
          </motion.article>
        </motion.section>

        <motion.section id="trust" ref={trustRef} className="landing-section split-layout" style={{ y: trustSectionY }}>
          <motion.article
            className="panel-card panel-card-visual"
            variants={sectionVariant}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
          >
            <motion.div className="panel-image" style={{ y: trustImageY }}>
              <img src="/landing-assets/generated/trust-guardian-arch.webp" alt="Sicherheit und Stabilitaet in Talea" />
            </motion.div>
            <div className="hero-character-row">
              <span>Profil</span>
              <span>Tagebuch</span>
              <span>Schatzkammer</span>
              <span>Persoenlichkeit</span>
            </div>
          </motion.article>

          <motion.article
            className="panel-card"
            variants={sectionVariant}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
          >
            <p className="panel-label">
              <ShieldCheck size={16} />
              Produktqualitaet
            </p>
            <h2>Robust fuer Alltag, Schule und Admin-Betrieb</h2>
            <div className="trust-grid">
              {trustPoints.map((point) => {
                const Icon = point.icon;
                return (
                  <div key={point.title} className="trust-item">
                    <span>
                      <Icon size={16} />
                    </span>
                    <div>
                      <h4>{point.title}</h4>
                      <p>{point.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.article>
        </motion.section>

        <motion.section
          ref={ctaRef}
          className="landing-section final-cta"
          variants={sectionVariant}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
        >
          <div className="final-cta-panel final-cta-panel-image">
            <motion.img src="/landing-assets/generated/final-panorama.webp" alt="" aria-hidden="true" style={{ y: ctaPanoramaY }} />
            <p>Bereit fuer den Launch?</p>
            <h2>Startet jetzt in Talea und baut eure eigene Story-Welt.</h2>
            <div className="final-cta-actions">
              <button type="button" className="landing-start-solid" onClick={() => navigate(startTarget)}>
                Zur App
                <ArrowRight size={16} />
              </button>
              <button type="button" className="landing-start-ghost" onClick={() => navigate('/auth')}>
                Login / Account
              </button>
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
};

export default LandingPage;
