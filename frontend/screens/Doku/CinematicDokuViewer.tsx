import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, useScroll, useSpring, useInView } from 'framer-motion';
import { ArrowLeft, ChevronDown, Sparkles, BookOpen } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';

import { useBackend } from '../../hooks/useBackend';
import { CinematicText } from '../../components/ui/cinematic-text';
import type { Doku, DokuSection } from '../../types/doku';
import { cn } from '../../lib/utils';
import { QuizComponent } from '../../components/reader/QuizComponent';
import { FactsComponent } from '../../components/reader/FactsComponent';
import { ActivityComponent } from '../../components/reader/ActivityComponent';
import { useTheme } from '../../contexts/ThemeContext';
import { getOfflineDoku } from '../../utils/offlineDb';
import '../Story/CinematicStoryViewer.css';

/* ── Palette (teal/knowledge tint over the shared warm base) ── */
type DokuPalette = {
  page: string;
  topBar: string;
  topBarBorder: string;
  heroOverlay: string;
  card: string;
  cardBorder: string;
  title: string;
  body: string;
  sub: string;
  accent: string;
  accentSoft: string;
};

const getDokuPalette = (isDark: boolean): DokuPalette => {
  if (isDark) {
    return {
      page: '#0a0908',
      topBar: 'rgba(10,9,8,0.82)',
      topBarBorder: 'rgba(120,169,187,0.12)',
      heroOverlay: 'linear-gradient(180deg, rgba(10,9,8,0.1) 0%, rgba(10,9,8,0.85) 100%)',
      card: 'rgba(18,16,12,0.9)',
      cardBorder: 'rgba(120,169,187,0.1)',
      title: '#e8ddd0',
      body: '#b8a898',
      sub: '#786858',
      accent: '#78a9bb',
      accentSoft: 'rgba(120,169,187,0.08)',
    };
  }
  return {
    page: '#faf6f0',
    topBar: 'rgba(250,246,240,0.85)',
    topBarBorder: 'rgba(93,143,152,0.12)',
    heroOverlay: 'linear-gradient(180deg, rgba(32,28,20,0.08) 0%, rgba(32,28,20,0.6) 100%)',
    card: 'rgba(255,252,248,0.92)',
    cardBorder: 'rgba(93,143,152,0.1)',
    title: '#2c2418',
    body: '#5c4e3e',
    sub: '#8c7e6e',
    accent: '#5d8f98',
    accentSoft: 'rgba(93,143,152,0.08)',
  };
};

/* ── Ambient Particles (knowledge sparkle – cooler tones) ── */
const PARTICLES = Array.from({ length: 6 }, (_, i) => ({
  id: i,
  x: `${15 + Math.random() * 70}%`,
  dur: `${11 + Math.random() * 7}s`,
  delay: `${Math.random() * 9}s`,
}));

/* ── Main Component ── */
const CinematicDokuViewer: React.FC = () => {
  const { dokuId } = useParams<{ dokuId: string }>();
  const navigate = useNavigate();
  const backend = useBackend();
  const { getToken } = useAuth();
  const { resolvedTheme } = useTheme();

  const containerRef = useRef<HTMLDivElement>(null);

  const [doku, setDoku] = useState<Doku | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [dokuCompleted, setDokuCompleted] = useState(false);
  const [activeSection, setActiveSection] = useState(0);

  const isDark = resolvedTheme === 'dark';
  const palette = useMemo(() => getDokuPalette(isDark), [isDark]);

  const { scrollYProgress } = useScroll({ container: containerRef });
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 34, restDelta: 0.001 });

  useEffect(() => {
    if (dokuId) void loadDoku();
  }, [dokuId]);

  const loadDoku = async () => {
    if (!dokuId) return;
    try {
      setLoading(true);
      setError(null);
      let dokuData: any = await getOfflineDoku(dokuId);
      if (!dokuData) {
        dokuData = await backend.doku.getDoku({ id: dokuId });
      }
      setDoku(dokuData as unknown as Doku);
    } catch (err) {
      console.error('Error loading doku:', err);
      setError('Doku konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = () => {
    setStarted(true);
    setTimeout(() => {
      const el = document.getElementById('section-0');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleDokuCompletion = async () => {
    if (!doku || !dokuId || dokuCompleted) return;
    try {
      setDokuCompleted(true);
      const token = await getToken();
      const { getBackendUrl } = await import('../../config');
      const target = getBackendUrl();
      const response = await fetch(`${target}/doku/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ dokuId, dokuTitle: doku.title, topic: doku.topic }),
      });
      if (response.ok) {
        const { showSuccessToast } = await import('../../utils/toastUtils');
        showSuccessToast('Doku abgeschlossen. Wissen erweitert.');
      }
    } catch (error) {
      console.error('Error completing doku:', error);
    }
  };

  const scrollToSection = useCallback((idx: number) => {
    const el = document.getElementById(`section-${idx}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className={cn('sr-loading', isDark ? 'sr-page--dark' : 'sr-page--light')}>
        <div className="sr-loading-spinner" style={{ borderTopColor: palette.accent }} />
        <p className="sr-loading-text">Doku wird geladen</p>
      </div>
    );
  }

  /* ── Error / Not Found ── */
  if (!doku) {
    return (
      <div className={cn('sr-loading', isDark ? 'sr-page--dark' : 'sr-page--light')}>
        <p style={{ fontFamily: 'var(--sr-font-heading)', fontSize: '1.4rem', color: palette.title }}>
          {error || 'Doku wurde nicht gefunden.'}
        </p>
        <button type="button" onClick={() => navigate('/doku')} className="sr-finale-btn" style={{ marginTop: '1rem', borderColor: `${palette.accent}33`, color: palette.accent }}>
          Zurueck zu Dokus
        </button>
      </div>
    );
  }

  const sections = doku.content?.sections ?? [];

  return (
    <div className={cn('fixed inset-0 overflow-hidden', isDark ? 'sr-page--dark' : 'sr-page--light')}>
      {/* Film grain texture */}
      <div className="sr-film-grain" />

      {/* Ambient floating particles */}
      {isDark && PARTICLES.map((p) => (
        <div
          key={p.id}
          className="sr-ambient-particle"
          style={{
            '--x': p.x, '--dur': p.dur, '--delay': p.delay,
            background: 'rgba(120,169,187,0.2)',
            boxShadow: '0 0 4px rgba(120,169,187,0.12)',
          } as React.CSSProperties}
        />
      ))}

      {/* Progress bar */}
      {started && (
        <motion.div
          className="fixed left-0 right-0 top-0 z-[80] origin-left"
          style={{
            scaleX,
            height: '3px',
            background: `linear-gradient(90deg, ${palette.accent} 0%, #7f9dcf 50%, ${palette.accent} 100%)`,
            boxShadow: `0 0 12px ${palette.accent}66, 0 0 24px ${palette.accent}26`,
          }}
        />
      )}

      {/* Floating header */}
      <header
        className="sr-header fixed left-1/2 top-3 z-[70] flex w-[min(720px,calc(100vw-1.2rem))] -translate-x-1/2 items-center justify-between rounded-2xl border px-3 py-2"
        style={{ borderColor: palette.topBarBorder, background: palette.topBar }}
      >
        <button
          type="button"
          onClick={() => navigate('/doku')}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors"
          style={{ color: palette.sub }}
          aria-label="Zurueck zu Dokus"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="min-w-0 px-3 text-center">
          <p className="truncate text-[0.65rem] uppercase tracking-[0.2em]" style={{ color: palette.sub, fontFamily: 'var(--sr-font-ui)' }}>
            {doku.topic || 'Wissensdoku'}
          </p>
          <p className="truncate text-sm font-semibold" style={{ color: palette.title, fontFamily: 'var(--sr-font-heading)' }}>
            {doku.title}
          </p>
        </div>

        <span
          className="inline-flex h-9 items-center rounded-full px-2.5 text-[0.65rem] uppercase tracking-[0.15em]"
          style={{ color: palette.sub, fontFamily: 'var(--sr-font-ui)' }}
        >
          {sections.length} Abs.
        </span>
      </header>

      {/* Section navigation dots */}
      {started && sections.length > 1 && (
        <nav className="sr-chapter-nav" aria-label="Abschnitt Navigation">
          {sections.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => scrollToSection(idx)}
              className={cn('sr-chapter-nav-dot', activeSection === idx && 'sr-chapter-nav-dot--active')}
              style={activeSection === idx ? { background: palette.accent, borderColor: palette.accent, boxShadow: `0 0 8px ${palette.accent}66` } : {}}
              aria-label={`Abschnitt ${idx + 1}`}
            />
          ))}
        </nav>
      )}

      {/* Scrollable content */}
      <div ref={containerRef} className="h-full overflow-y-auto scroll-smooth">
        {/* ── Hero Section ── */}
        <section className="sr-hero-cover">
          <img
            src={doku.coverImageUrl || '/placeholder-doku.jpg'}
            alt={doku.title}
            className="sr-hero-img"
          />
          <div className="sr-hero-overlay" />
          <div className="sr-hero-vignette" />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.2, 0.65, 0.3, 0.9] }}
            className="sr-hero-card"
          >
            <span className="sr-hero-badge" style={{ color: `${palette.accent}b3`, borderColor: `${palette.accent}26`, background: `${palette.accent}0f` }}>
              <BookOpen className="h-3 w-3" />
              Lernmodus
            </span>

            <h1 className="sr-hero-title">{doku.title}</h1>
            <p className="sr-hero-summary">{doku.summary}</p>

            <motion.button
              type="button"
              onClick={handleStart}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="sr-hero-start-btn"
              style={{
                background: `linear-gradient(135deg, ${palette.accent} 0%, #9fc8d4 50%, ${palette.accent} 100%)`,
                boxShadow: `0 8px 24px ${palette.accent}4d, 0 2px 8px ${palette.accent}33`,
              }}
            >
              Wissen entdecken
              <ChevronDown className="h-4 w-4" />
            </motion.button>
          </motion.div>
        </section>

        {/* ── Sections ── */}
        {sections.map((section, index) => (
          <React.Fragment key={`${section.title}-${index}`}>
            {/* Divider */}
            <motion.div
              className="sr-chapter-divider"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.6 }}
            >
              <div className="sr-chapter-divider-line" style={{ background: `linear-gradient(180deg, transparent 0%, ${palette.accent}66 50%, transparent 100%)` }} />
              <div className="sr-chapter-divider-ornament" style={{ background: `${palette.accent}80`, boxShadow: `0 0 8px ${palette.accent}4d` }} />
              <div className="sr-chapter-divider-line" style={{ background: `linear-gradient(180deg, transparent 0%, ${palette.accent}66 50%, transparent 100%)` }} />
            </motion.div>

            <SectionView
              section={section}
              index={index}
              total={sections.length}
              dokuTitle={doku.title}
              dokuId={dokuId || ''}
              coverImageUrl={doku.coverImageUrl}
              palette={palette}
              isDark={isDark}
              onComplete={index === sections.length - 1 ? handleDokuCompletion : undefined}
              isCompleted={dokuCompleted}
              onBecomeActive={() => setActiveSection(index)}
            />
          </React.Fragment>
        ))}

        {/* ── Finale ── */}
        <section className="sr-finale">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            <div className="sr-finale-ornament">
              <div className="sr-finale-ornament-line" style={{ background: `${palette.accent}4d` }} />
              <div className="sr-finale-ornament-diamond" style={{ background: `${palette.accent}66` }} />
              <div className="sr-finale-ornament-line" style={{ background: `${palette.accent}4d` }} />
            </div>

            <h2 className="sr-finale-title" style={{ color: palette.title }}>
              Ende der Doku
            </h2>
            <p className="sr-finale-text" style={{ color: palette.body }}>
              Du kannst jederzeit weitere Dokus starten oder diese erneut lesen.
            </p>
            <button
              type="button"
              onClick={() => navigate('/doku')}
              className="sr-finale-btn"
              style={{ borderColor: `${palette.accent}33`, color: palette.accent }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Zurueck zur Uebersicht
            </button>
          </motion.div>
        </section>
      </div>
    </div>
  );
};

/* ── Section View ── */
const SectionView: React.FC<{
  section: DokuSection;
  index: number;
  total: number;
  dokuTitle: string;
  dokuId: string;
  coverImageUrl?: string;
  palette: DokuPalette;
  isDark: boolean;
  onComplete?: () => void;
  isCompleted?: boolean;
  onBecomeActive: () => void;
}> = ({ section, index, total, dokuTitle, dokuId, coverImageUrl, palette, isDark, onComplete, isCompleted, onBecomeActive }) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { amount: 0.3 });

  useEffect(() => {
    if (isInView) onBecomeActive();
  }, [isInView]);

  return (
    <section
      id={`section-${index}`}
      ref={sectionRef}
      className="sr-chapter"
      style={{ paddingTop: '1rem', paddingBottom: '2rem' }}
    >
      {/* Section Image */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.7, ease: [0.2, 0.65, 0.3, 0.9] }}
        className="sr-chapter-image-wrap"
      >
        <img
          src={section.imageUrl || coverImageUrl || '/placeholder-doku.jpg'}
          alt={section.title}
          className="sr-chapter-image"
        />
        <div className="sr-chapter-image-overlay" />

        <div className="sr-chapter-image-header">
          <span className="sr-chapter-number">
            Abschnitt {index + 1} von {total}
          </span>
          <h2 className="sr-chapter-title">{section.title}</h2>
        </div>
      </motion.div>

      {/* Section Content */}
      <div className="sr-chapter-content">
        <CinematicText
          text={section.content}
          paragraphClassName="sr-paragraph"
          paragraphStyle={{ color: palette.title }}
          className="space-y-0"
          enableDropCap
        />

        {/* Doku-specific interactive components */}
        <div style={{ marginTop: '2rem' }} className="space-y-4">
          <FactsComponent section={section} variant="inline" />
          <ActivityComponent section={section} variant="inline" />
          <QuizComponent
            section={section}
            dokuTitle={dokuTitle}
            dokuId={dokuId}
            variant="inline"
            onPersonalityChange={(changes) => {
              import('../../utils/toastUtils').then(({ showPersonalityUpdateToast }) => {
                showPersonalityUpdateToast(changes);
              });
            }}
          />
        </div>

        {onComplete && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 }}
            style={{ marginTop: '2rem' }}
          >
            <button
              type="button"
              onClick={onComplete}
              disabled={isCompleted}
              className={cn('sr-complete-btn', isCompleted ? 'sr-complete-btn--done' : 'sr-complete-btn--default')}
              style={!isCompleted ? { borderColor: `${palette.accent}40`, background: `${palette.accent}14`, color: palette.accent } : {}}
            >
              <Sparkles className="h-4 w-4" />
              {isCompleted ? 'Abgeschlossen' : 'Doku abschliessen'}
            </button>
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default CinematicDokuViewer;
