import React, { useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
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

/* ─── Data ─── */

const characters = [
  { name: 'Fuchs', image: '/landing-assets/generated/characters/detektive.webp', mood: 'Detektiv' },
  { name: 'Drache', image: '/landing-assets/generated/characters/drache.webp', mood: 'Abenteuer' },
  { name: 'Goblin', image: '/landing-assets/generated/characters/goblin.webp', mood: 'Schalk' },
  { name: 'Oma', image: '/landing-assets/generated/characters/oma.webp', mood: 'Weisheit' },
  { name: 'König', image: '/landing-assets/generated/characters/wilhelm.webp', mood: 'Mentor' },
  { name: 'Troll', image: '/landing-assets/generated/characters/troll.webp', mood: 'Humor' },
  { name: 'Räuber', image: '/landing-assets/generated/characters/rauber.webp', mood: 'Spannung' },
  { name: 'Hexe', image: '/landing-assets/generated/characters/image.webp', mood: 'Magie' },
];

const scenes = [
  {
    tag: 'Story Engine',
    tagIcon: BookOpenText,
    title: 'Dein Kind wird zur Hauptfigur',
    desc: 'Mit unserem KI-Story-Generator erschaffst du in Sekunden personalisierte Geschichten. Wähle Genre, Stimmung, beteiligte Charaktere und erlebe cin cinematisches Leseabenteuer wie in einem Film.',
    points: [
      'Cineastischer, klassischer & Scroll-Reader Modus',
      'Genre, Alter, Länge & Lernfokus frei wählbar',
      'Eigene Avatare als Helden der Geschichte',
      'Quiz & Fakten direkt im Lesefluss integriert',
    ],
    image: '/landing-assets/generated/story-engine-island.webp',
    num: '01',
  },
  {
    tag: 'Wissens-Dokus',
    tagIcon: Brain,
    title: 'Wissen wird zum Erlebnis',
    desc: 'Unsere KI-generierten Wissensdokus verbinden Audio, Struktur und Visuals zu einer modernen Lernstrecke. Von Dinosauriern bis Weltraum – jedes Thema wird zum Abenteuer.',
    points: [
      'Audio-Dokus für unterwegs & zum Einschlafen',
      'Themen von Natur über Technik bis Raumfahrt',
      'Quiz-Bereich direkt verknüpft mit Erklärungen',
      'Didaktische Struktur mit klaren Lernzielen',
    ],
    image: '/landing-assets/generated/doku-studio-island.webp',
    num: '02',
  },
  {
    tag: 'Avatar Atelier',
    tagIcon: Users,
    title: 'Charaktere die wachsen',
    desc: 'Avatare sind mehr als Bilder – sie entwickeln Persönlichkeit, sammeln Erinnerungen, verdienen Perks und meistern Quests. Jede Story macht sie stärker.',
    points: [
      'Avatar-Wizard mit Bild- & Profil-Erstellung',
      'Persönlichkeit, Tagebuch & Schatzkammer',
      'Kompetenzprofil mit Traits, Levels & Fortschritt',
      'Quest- & Perk-System für langfristige Motivation',
    ],
    image: '/landing-assets/generated/avatar-atelier-island.webp',
    num: '03',
  },
  {
    tag: 'Audio Erlebnis',
    tagIcon: Headphones,
    title: 'Geschichten für die Ohren',
    desc: 'Alle Inhalte auch als Audio verfügbar. Der integrierte Player begleitet Kinder unterwegs, im Auto oder beim Einschlafen mit magisch vorgelesenen Geschichten.',
    points: [
      'Text-to-Speech mit natürlicher Stimme',
      'Mobiler & Desktop-Player in der Navigation',
      'Audio-Dokus offline speichern',
      'Perfekt für Autofahrten & Schlafenszeit',
    ],
    image: '/landing-assets/generated/audio-wave-garden.webp',
    num: '04',
  },
  {
    tag: 'Tavi KI-Assistent',
    tagIcon: MessageCircleMore,
    title: 'Dein magischer Begleiter',
    desc: 'Tavi ist die KI-Figur, die Fragen beantwortet, Storys startet, Wissen erklärt und den kreativen Flow begleitet – direkt aus dem Chat heraus.',
    points: [
      'Fragen stellen & sofort Antworten bekommen',
      'Storys & Dokus aus einer Konversation starten',
      'Erklärt Funktionen & hilft bei Ideen',
      'Schneller Zugriff ohne Kontextwechsel',
    ],
    image: '/landing-assets/generated/tavi-copilot-orbit.webp',
    num: '05',
  },
];

const pricingPlans = [
  {
    name: 'Starter',
    price: '4,99',
    stories: 10,
    dokus: 0,
    features: ['10 KI-Geschichten / Monat', 'Alle Lesemodi', 'Avatar-Erstellung', '1 Avatar inklusive'],
    icon: Star,
  },
  {
    name: 'Family',
    price: '9,99',
    stories: 25,
    dokus: 25,
    features: ['25 Geschichten + 25 Dokus', 'Audio-Erlebnis inklusive', 'Quests & Perks', 'Eltern-Dashboard'],
    icon: Crown,
    featured: true,
  },
  {
    name: 'Premium',
    price: '18,99',
    stories: 50,
    dokus: 50,
    features: ['50 Geschichten + 50 Dokus', 'Alles aus Family', 'Tavi KI-Assistent', 'Prioritäts-Generierung'],
    icon: Zap,
  },
];

const trustPoints = [
  {
    icon: ShieldCheck,
    title: 'Eltern-Dashboard mit PIN',
    desc: 'Tabu-Themen, Lernziele und Tageslimits zentral steuern. Sicherheit fließt direkt in die KI-Generierung ein.',
    color: 'var(--c-accent-2)',
  },
  {
    icon: Wand2,
    title: 'KI-Sicherheit eingebaut',
    desc: 'Tabu-Wörter, Altersfilter und Lernregeln werden direkt in den Generierungsprozess eingebettet – präventiv, nicht nachträglich.',
    color: 'var(--c-accent)',
  },
  {
    icon: Rocket,
    title: 'Wächst mit deiner Familie',
    desc: 'Avatar-Fortschritt, Lernkreisläufe und Community-Inhalte sorgen für nachhaltige Nutzung statt kurzfristiger Unterhaltung.',
    color: 'var(--c-accent-3)',
  },
];

const comparisonData = [
  ['Inhalte', 'Nur Geschichten', 'Nur Lernmodule', 'Stories + Dokus + Audio + Quiz'],
  ['Personalisierung', 'Gering', 'Mittel', 'Hoch (Avatar, Alter, Stimmung)'],
  ['Elternkontrolle', 'Oberflächlich', 'Teilweise', 'PIN-Dashboard mit Filtern'],
  ['Langzeitmotivation', 'Niedrig', 'Mittel', 'Quests, Perks, Memory'],
  ['Audio', 'Optional', 'Selten', 'Voll integriert'],
];

/* ─── Particles Factory ─── */
const makeParticles = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    left: `${Math.random() * 100}%`,
    size: 2 + Math.random() * 4,
    delay: `${Math.random() * 8}s`,
    duration: `${6 + Math.random() * 8}s`,
    color:
      i % 3 === 0
        ? 'rgba(167,139,250,0.6)'
        : i % 3 === 1
          ? 'rgba(96,212,200,0.5)'
          : 'rgba(249,115,148,0.5)',
  }));

/* ─── Animation Variants ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.85 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

/* ─── Component ─── */
const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isSignedIn } = useUser();
  const pageRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const startTarget = isSignedIn ? '/' : '/auth';
  const particles = useMemo(() => makeParticles(30), []);

  const { scrollYProgress } = useScroll();

  // Parallax refs for each scene
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const motionFactor = shouldReduceMotion ? 0 : 1;
  const heroBgY = useTransform(heroProgress, [0, 1], [0, 200 * motionFactor]);
  const heroContentY = useTransform(heroProgress, [0, 1], [0, -80 * motionFactor]);

  // Orb motion
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 40, damping: 20 });
  const orbAX = useTransform(smoothProgress, [0, 1], [0, 150 * motionFactor]);
  const orbAY = useTransform(smoothProgress, [0, 1], [0, 300 * motionFactor]);
  const orbBX = useTransform(smoothProgress, [0, 1], [0, -120 * motionFactor]);
  const orbBY = useTransform(smoothProgress, [0, 1], [0, -250 * motionFactor]);

  return (
    <div ref={pageRef} className="landing-root">
      {/* Scroll progress */}
      <motion.div className="landing-progress" style={{ scaleX: scrollYProgress }} />

      {/* Ambient orbs */}
      <motion.div className="landing-orb landing-orb--a" style={{ x: orbAX, y: orbAY }} />
      <motion.div className="landing-orb landing-orb--b" style={{ x: orbBX, y: orbBY }} />
      <div className="landing-orb landing-orb--c" />

      {/* ─── Navigation ─── */}
      <header className="landing-nav">
        <button
          type="button"
          className="landing-logo"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Zurück zum Anfang"
        >
          <img src="/talea_logo.png?v=20260209" alt="Talea Logo" />
          <span>
            Talea
            <small>Storytelling Platform</small>
          </span>
        </button>

        <nav className="landing-links" aria-label="Landing Navigation">
          <a href="#features">Funktionen</a>
          <a href="#pricing">Preise</a>
          <a href="#trust">Sicherheit</a>
          <button
            type="button"
            className="landing-nav-cta"
            onClick={() => navigate(startTarget)}
          >
            App starten
            <ArrowRight size={14} />
          </button>
        </nav>
      </header>

      <main>
        {/* ═══════════ HERO ═══════════ */}
        <section ref={heroRef} className="landing-hero">
          <motion.div className="hero-bg-image" style={{ y: heroBgY }}>
            <img
              src="/landing-assets/generated/hero-castle-island.webp"
              alt="Magische Inselwelt"
            />
          </motion.div>

          {/* Particles */}
          <div className="hero-particles" aria-hidden="true">
            {particles.map((p, i) => (
              <span
                key={i}
                style={{
                  left: p.left,
                  bottom: '-10px',
                  width: p.size,
                  height: p.size,
                  background: p.color,
                  animationDelay: p.delay,
                  animationDuration: p.duration,
                }}
              />
            ))}
          </div>

          <motion.div
            className="hero-content"
            style={{ y: heroContentY }}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="hero-kicker">
              <Sparkles size={14} />
              Die KI-Lern- und Story-Plattform für Familien
            </p>

            <h1 className="hero-title">
              <span className="hero-title-gradient">Wo Kinder zu </span>
              <span className="hero-title-large">Helden</span>
              <span className="hero-title-gradient"> ihrer eigenen Geschichte werden.</span>
            </h1>

            <p className="hero-sub">
              Personalisierte Geschichten, Wissensdokus, Quiz und Audio – in einer
              magischen App. Dein Kind erlebt Abenteuer mit eigenen Avataren, während du
              als Elternteil alles sicher steuerst.
            </p>

            <div className="hero-actions">
              <button
                type="button"
                className="btn-magic"
                onClick={() => navigate(startTarget)}
              >
                Jetzt Abenteuer starten
                <ArrowRight size={18} />
              </button>
              <a href="#features" className="btn-ghost">
                <ChevronDown size={16} />
                Funktionen entdecken
              </a>
            </div>
          </motion.div>

          {/* Character parade */}
          <motion.div
            className="hero-characters"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="character-parade">
              {characters.map((char, i) => (
                <motion.figure
                  key={char.name}
                  className="character-card"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: i % 2 === 0 ? -12 : 0 }}
                  transition={{
                    delay: 0.5 + i * 0.07,
                    duration: 0.5,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <img src={char.image} alt={char.name} />
                  <figcaption>
                    {char.name}
                    <small>{char.mood}</small>
                  </figcaption>
                </motion.figure>
              ))}
            </div>
          </motion.div>

          {/* Scroll cue */}
          <div className="scroll-cue">
            <span className="scroll-cue-line" />
            Scrollen
          </div>
        </section>

        {/* ═══════════ EXPLOSION DIVIDER ═══════════ */}
        <motion.div
          className="explosion-divider"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
        >
          <span className="explosion-divider-word">MAGIE</span>
        </motion.div>

        {/* ═══════════ FEATURE SCENES ═══════════ */}
        <section id="features" className="landing-section">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            style={{ textAlign: 'center', marginBottom: '2rem' }}
          >
            <span className="section-badge">
              <Sparkles size={12} />
              Features
            </span>
            <h2 className="section-title">
              Alles was deine Familie<br />zum Lernen und Träumen braucht
            </h2>
            <p className="section-sub" style={{ margin: '0.8rem auto' }}>
              Jede Funktion fühlt sich an wie eine eigene magische Insel –
              zusammen bilden sie ein komplettes Lern-Universum.
            </p>
          </motion.div>

          {scenes.map((scene, idx) => {
            const TagIcon = scene.tagIcon;
            return (
              <motion.div
                key={scene.num}
                className="scene"
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.2 }}
              >
                <div className="scene-content">
                  <span className="scene-number">{scene.num}</span>
                  <span className="scene-tag">
                    <TagIcon size={14} />
                    {scene.tag}
                  </span>
                  <h3 className="scene-title">{scene.title}</h3>
                  <p className="scene-desc">{scene.desc}</p>
                  <ul className="scene-points">
                    {scene.points.map((pt) => (
                      <li key={pt}>{pt}</li>
                    ))}
                  </ul>
                </div>

                <motion.div
                  className="scene-visual"
                  variants={scaleIn}
                >
                  <div className="scene-visual-glow" />
                  <img src={scene.image} alt={`${scene.tag} Vorschau`} />
                </motion.div>
              </motion.div>
            );
          })}
        </section>

        {/* ═══════════ EXPLOSION DIVIDER ═══════════ */}
        <motion.div
          className="explosion-divider"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
        >
          <span className="explosion-divider-word">ABENTEUER</span>
        </motion.div>

        {/* ═══════════ PRICING ═══════════ */}
        <section id="pricing" className="landing-section pricing-section">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
          >
            <span className="section-badge">
              <Crown size={12} />
              Preise
            </span>
            <h2 className="section-title">
              Wähle dein Abenteuer-Paket
            </h2>
            <p className="section-sub" style={{ margin: '0.8rem auto' }}>
              Starte mit dem Starter-Plan und upgrade jederzeit.
              Alle Pläne monatlich kündbar.
            </p>
          </motion.div>

          <motion.div
            className="pricing-grid"
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
          >
            {pricingPlans.map((plan) => {
              const PlanIcon = plan.icon;
              return (
                <motion.div
                  key={plan.name}
                  className={`pricing-card${plan.featured ? ' pricing-card--featured' : ''}`}
                  variants={fadeUp}
                >
                  {plan.featured && (
                    <span className="pricing-badge">Beliebteste Wahl</span>
                  )}
                  <div className="pricing-icon">
                    <PlanIcon size={22} />
                  </div>
                  <h3 className="pricing-name">{plan.name}</h3>
                  <p className="pricing-price">
                    {plan.price}€<small> / Monat</small>
                  </p>
                  <div className="pricing-divider" />
                  <ul className="pricing-features">
                    {plan.features.map((f) => (
                      <li key={f}>
                        <Check size={14} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="pricing-cta"
                    onClick={() => navigate(startTarget)}
                  >
                    {plan.featured ? 'Jetzt starten' : 'Plan wählen'}
                    <ArrowRight size={14} />
                  </button>
                </motion.div>
              );
            })}
          </motion.div>
        </section>

        {/* ═══════════ COMPARISON TABLE ═══════════ */}
        <section className="landing-section comparison-section">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
          >
            <span className="section-badge">
              <Zap size={12} />
              Vergleich
            </span>
            <h2 className="section-title">
              Warum Talea anders ist
            </h2>
          </motion.div>

          <motion.div
            className="comparison-table-wrap"
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
          >
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Kriterium</th>
                  <th>Story-Apps</th>
                  <th>Lern-Apps</th>
                  <th>Talea ✦</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, ci) => (
                      <td key={ci}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </section>

        {/* ═══════════ EXPLOSION DIVIDER ═══════════ */}
        <motion.div
          className="explosion-divider"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
        >
          <span className="explosion-divider-word">SICHERHEIT</span>
        </motion.div>

        {/* ═══════════ TRUST SECTION ═══════════ */}
        <section id="trust" className="landing-section">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            style={{ textAlign: 'center', marginBottom: '1rem' }}
          >
            <span className="section-badge">
              <ShieldCheck size={12} />
              Für Eltern
            </span>
            <h2 className="section-title">
              Volle Kontrolle,<br />volle Magie
            </h2>
            <p className="section-sub" style={{ margin: '0.8rem auto' }}>
              Talea gibt Eltern echte Werkzeuge – nicht nur einen Kindermodus-Schalter.
              Sicherheit ist in den Kern eingebaut.
            </p>
          </motion.div>

          <motion.div
            className="trust-row"
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
          >
            {trustPoints.map((tp) => {
              const TIcon = tp.icon;
              return (
                <motion.div key={tp.title} className="trust-card" variants={fadeUp}>
                  <div
                    className="trust-card-icon"
                    style={{ color: tp.color }}
                  >
                    <TIcon size={20} />
                  </div>
                  <h4>{tp.title}</h4>
                  <p>{tp.desc}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </section>

        {/* ═══════════ READING THEATER SCENE ═══════════ */}
        <motion.section
          className="landing-section"
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          <div className="scene" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
            <div className="scene-content">
              <span className="scene-tag">
                <BookOpenText size={14} />
                Cinematic Reading
              </span>
              <h3 className="scene-title">
                Lesen fühlt sich an<br />wie ein Film schauen
              </h3>
              <p className="scene-desc">
                Unser cineastischer Lesemodus verwandelt jede Geschichte in ein visuelles
                Erlebnis. Szene für Szene, Panel für Panel – als ob dein Kind einen animierten
                Film erlebt. Ergänzt durch klassischen Lesetext und Scroll-Reader für
                jede Vorliebe.
              </p>
              <ul className="scene-points">
                <li>3 Lesemodi: Cinematic, Klassisch, Scroll-Reader</li>
                <li>Automatisch generierte Szenenbilder</li>
                <li>Stimmungsvolle Übergänge zwischen Kapiteln</li>
                <li>Audio-Erzählung optional zuschaltbar</li>
              </ul>
            </div>
            <motion.div className="scene-visual" variants={scaleIn}>
              <div className="scene-visual-glow" />
              <img
                src="/landing-assets/generated/reading-theater.webp"
                alt="Cinematic Reading Experience"
              />
            </motion.div>
          </div>
        </motion.section>

        {/* ═══════════ FINAL CTA ═══════════ */}
        <section className="landing-section final-cta">
          <motion.div
            className="final-cta-panel"
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="final-cta-bg">
              <img
                src="/landing-assets/generated/final-panorama.webp"
                alt=""
                aria-hidden="true"
              />
            </div>
            <div className="final-cta-content">
              <span className="section-badge" style={{ marginBottom: '0.8rem' }}>
                <Sparkles size={12} />
                Bereit für die Reise?
              </span>
              <h2 className="final-cta-title">
                Startet jetzt in Talea und<br />
                baut eure eigene Story-Welt.
              </h2>
              <p className="section-sub" style={{ margin: '0.8rem auto', maxWidth: 520 }}>
                Über 50 Charaktere warten darauf, Teil eurer Geschichte zu werden.
                Kostenlos testen – kein Risiko.
              </p>
              <div className="final-cta-actions">
                <button
                  type="button"
                  className="btn-magic"
                  onClick={() => navigate(startTarget)}
                >
                  Jetzt starten
                  <ArrowRight size={18} />
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => navigate('/auth')}
                >
                  Login / Account
                </button>
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      {/* ─── Footer ─── */}
      <footer className="landing-footer">
        <p>
          © 2026 Talea · Storytelling Platform ·{' '}
          <a href="/auth">Login</a>
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;
