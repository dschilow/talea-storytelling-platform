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
import './LandingPage.css';

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

type IslandFeature = {
  title: string;
  subtitle: string;
  description: string;
  points: string[];
  image: string;
  icon: IconComponent;
  tag: string;
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
    image: '/landing-assets/stories.png',
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
    image: '/landing-assets/cine_5_dokus.png',
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
    image: '/landing-assets/avatars.png',
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
    image: '/landing-assets/idea.png',
    icon: MessageCircleMore,
    tag: 'Insel 04',
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
  const shouldReduceMotion = useReducedMotion();
  const startTarget = isSignedIn ? '/' : '/auth';

  const { scrollYProgress } = useScroll({
    target: pageRef,
    offset: ['start start', 'end end'],
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

  return (
    <div ref={pageRef} className="landing-root">
      <motion.div className="landing-progress" style={{ scaleX: scrollYProgress }} />

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
              <img src="/landing-assets/hero.png" alt="Magische Inselwelt fuer Talea" />
              <div className="hero-visual-badges">
                <span>Story</span>
                <span>Doku</span>
                <span>Audio</span>
              </div>
            </div>
          </motion.div>
        </section>

        <motion.section
          id="islands"
          className="landing-section"
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

        <section id="flow" className="landing-section split-layout">
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
            <div className="panel-image">
              <img src="/landing-assets/cine_2_magic.png" alt="Workflow Visual fuer Talea" />
            </div>
            <div className="panel-audio-chip">
              <AudioLines size={16} />
              Audio-Player integriert in mobile Navigation
            </div>
          </motion.article>
        </section>

        <section id="trust" className="landing-section split-layout">
          <motion.article
            className="panel-card panel-card-visual"
            variants={sectionVariant}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
          >
            <div className="panel-image">
              <img src="/landing-assets/cine_3_avatars.png" alt="Avatar und Profilwelt in Talea" />
            </div>
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
        </section>

        <motion.section
          className="landing-section final-cta"
          variants={sectionVariant}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
        >
          <div className="final-cta-panel">
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
