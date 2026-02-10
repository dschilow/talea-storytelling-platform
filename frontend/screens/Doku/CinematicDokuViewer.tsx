import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, useScroll, useSpring } from 'framer-motion';
import { ArrowLeft, ChevronDown, Sparkles } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';

import { useBackend } from '../../hooks/useBackend';
import { CinematicText } from '../../components/ui/cinematic-text';
import { Typewriter } from '../../components/ui/typewriter-text';
import type { Doku, DokuSection } from '../../types/doku';
import { cn } from '../../lib/utils';
import { QuizComponent } from '../../components/reader/QuizComponent';
import { FactsComponent } from '../../components/reader/FactsComponent';
import { ActivityComponent } from '../../components/reader/ActivityComponent';
import { useTheme } from '../../contexts/ThemeContext';
import { getOfflineDoku } from '../../utils/offlineDb';

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

const headingFont = '"Cormorant Garamond", "Merriweather", serif';

const getDokuPalette = (isDark: boolean): DokuPalette => {
  if (isDark) {
    return {
      page:
        'radial-gradient(980px 520px at 100% 0%, rgba(66,112,130,0.28) 0%, transparent 56%), radial-gradient(980px 620px at 0% 12%, rgba(80,95,139,0.24) 0%, transparent 62%), #111b27',
      topBar: 'rgba(18,27,40,0.78)',
      topBarBorder: '#2f435f',
      heroOverlay: 'linear-gradient(180deg, rgba(10,16,24,0.15) 0%, rgba(10,16,24,0.78) 100%)',
      card: 'rgba(22,34,50,0.9)',
      cardBorder: '#324a68',
      title: '#e7f0fd',
      body: '#c8d7eb',
      sub: '#9fb2cc',
      accent: '#78a9bb',
      accentSoft: 'rgba(120,169,187,0.2)',
    };
  }

  return {
    page:
      'radial-gradient(980px 520px at 100% 0%, #e7e5f3 0%, transparent 56%), radial-gradient(980px 620px at 0% 12%, #deece6 0%, transparent 62%), #f8f2ea',
    topBar: 'rgba(255,250,243,0.82)',
    topBarBorder: '#dfd2c2',
    heroOverlay: 'linear-gradient(180deg, rgba(32,41,58,0.08) 0%, rgba(32,41,58,0.56) 100%)',
    card: 'rgba(255,250,243,0.92)',
    cardBorder: '#dccdbb',
    title: '#253448',
    body: '#51657f',
    sub: '#6d7f95',
    accent: '#5d8f98',
    accentSoft: 'rgba(122,165,174,0.2)',
  };
};

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

  const isDark = resolvedTheme === 'dark';
  const palette = useMemo(() => getDokuPalette(isDark), [isDark]);

  const { scrollYProgress } = useScroll({ container: containerRef });
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 34,
    restDelta: 0.001,
  });

  useEffect(() => {
    if (dokuId) {
      void loadDoku();
    }
  }, [dokuId]);

  const loadDoku = async () => {
    if (!dokuId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Try to load from offline storage first
      let dokuData: any = await getOfflineDoku(dokuId);

      // If not found offline, fetch from backend
      if (!dokuData) {
        dokuData = await backend.doku.getDoku({ id: dokuId });
      } else {
        console.log('[CinematicDokuViewer] Loaded doku from offline storage');
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
      const firstSection = document.getElementById('section-0');
      firstSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleDokuCompletion = async () => {
    if (!doku || !dokuId || dokuCompleted) {
      return;
    }

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
        body: JSON.stringify({
          dokuId,
          dokuTitle: doku.title,
          topic: doku.topic,
        }),
      });

      if (response.ok) {
        const { showSuccessToast } = await import('../../utils/toastUtils');
        showSuccessToast('Doku abgeschlossen. Wissen erweitert.');
      }
    } catch (error) {
      console.error('Error completing doku:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: palette.page }}>
        <div className="rounded-3xl border px-8 py-7 text-center" style={{ borderColor: palette.cardBorder, background: palette.card }}>
          <div className="mx-auto mb-3 h-12 w-12 animate-spin rounded-full border-4 border-transparent" style={{ borderTopColor: palette.accent, borderRightColor: palette.accent }} />
          <p className="text-sm tracking-[0.18em] uppercase" style={{ color: palette.sub }}>
            Doku wird geladen
          </p>
        </div>
      </div>
    );
  }

  if (!doku) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: palette.page }}>
        <div className="rounded-3xl border px-8 py-7 text-center" style={{ borderColor: palette.cardBorder, background: palette.card }}>
          <p className="text-lg font-semibold" style={{ color: palette.title }}>
            {error || 'Doku wurde nicht gefunden.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/doku')}
            className="mt-4 rounded-full border px-4 py-2 text-sm"
            style={{ borderColor: palette.cardBorder, color: palette.sub }}
          >
            Zurueck zu Dokus
          </button>
        </div>
      </div>
    );
  }

  const sections = doku.content?.sections ?? [];

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: palette.page }}>
      {started && (
        <motion.div
          className="fixed left-0 right-0 top-0 z-[80] h-1 origin-left"
          style={{
            scaleX,
            background: `linear-gradient(90deg, ${palette.accent} 0%, #7f9dcf 100%)`,
          }}
        />
      )}

      <header
        className="fixed left-1/2 top-3 z-[70] flex w-[min(980px,calc(100vw-1.2rem))] -translate-x-1/2 items-center justify-between rounded-2xl border px-3 py-2 backdrop-blur-xl"
        style={{ borderColor: palette.topBarBorder, background: palette.topBar }}
      >
        <button
          type="button"
          onClick={() => navigate('/doku')}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border"
          style={{ borderColor: palette.topBarBorder, color: palette.title, background: palette.card }}
          aria-label="Zurueck zu Dokus"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>

        <div className="min-w-0 px-3 text-center">
          <p className="truncate text-xs uppercase tracking-[0.18em]" style={{ color: palette.sub }}>
            {doku.topic || 'Wissensdoku'}
          </p>
          <p className="truncate text-sm font-semibold" style={{ color: palette.title }}>
            {doku.title}
          </p>
        </div>

        <span className="inline-flex h-10 items-center rounded-full border px-3 text-xs" style={{ borderColor: palette.topBarBorder, color: palette.sub }}>
          {sections.length} Abschnitte
        </span>
      </header>

      <div ref={containerRef} className="h-full overflow-y-auto scroll-smooth pt-0">
        <section className="relative flex min-h-[100svh] items-center justify-center px-4 pb-16 pt-24">
          <div className="absolute inset-0 z-0">
            <img
              src={doku.coverImageUrl || '/placeholder-doku.jpg'}
              alt={doku.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0" style={{ background: palette.heroOverlay }} />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative z-10 mx-auto w-full max-w-4xl rounded-[30px] border p-6 text-center shadow-[0_24px_52px_rgba(16,22,34,0.28)] backdrop-blur"
            style={{ borderColor: palette.cardBorder, background: palette.card }}
          >
            <span className="inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em]" style={{ borderColor: palette.cardBorder, color: palette.sub, background: palette.accentSoft }}>
              Lernmodus
            </span>
            <h1 className="mt-4 text-4xl leading-tight md:text-6xl" style={{ fontFamily: headingFont, color: palette.title }}>
              {doku.title}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed md:text-lg" style={{ color: palette.body }}>
              {doku.summary}
            </p>

            <motion.button
              type="button"
              onClick={handleStart}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_22px_rgba(69,102,128,0.34)]"
              style={{ background: `linear-gradient(135deg, ${palette.accent} 0%, #7f9dcf 100%)` }}
            >
              Wissen starten
              <ChevronDown className="h-4 w-4" />
            </motion.button>
          </motion.div>
        </section>

        {sections.map((section, index) => (
          <SectionView
            key={`${section.title}-${index}`}
            section={section}
            index={index}
            total={sections.length}
            dokuTitle={doku.title}
            dokuId={dokuId || ''}
            coverImageUrl={doku.coverImageUrl}
            palette={palette}
            onComplete={index === sections.length - 1 ? handleDokuCompletion : undefined}
            isCompleted={dokuCompleted}
          />
        ))}

        <section className="relative flex min-h-[40svh] items-center justify-center px-4 pb-24 pt-12">
          <div className="w-full max-w-3xl rounded-[26px] border p-6 text-center" style={{ borderColor: palette.cardBorder, background: palette.card }}>
            <h2 className="text-3xl" style={{ fontFamily: headingFont, color: palette.title }}>
              Ende der Doku
            </h2>
            <p className="mt-2 text-sm" style={{ color: palette.body }}>
              Du kannst jederzeit weitere Dokus starten oder diese erneut lesen.
            </p>
            <button
              type="button"
              onClick={() => navigate('/doku')}
              className="mt-5 rounded-full border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: palette.cardBorder, color: palette.sub }}
            >
              Zurueck zur Uebersicht
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

const SectionView: React.FC<{
  section: DokuSection;
  index: number;
  total: number;
  dokuTitle: string;
  dokuId: string;
  coverImageUrl?: string;
  palette: DokuPalette;
  onComplete?: () => void;
  isCompleted?: boolean;
}> = ({ section, index, total, dokuTitle, dokuId, coverImageUrl, palette, onComplete, isCompleted }) => {
  const [headerInView, setHeaderInView] = useState(false);

  return (
    <section id={`section-${index}`} className="relative px-4 py-10 md:px-6 md:py-14">
      <motion.article
        initial={{ opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.46 }}
        className="mx-auto w-full max-w-6xl overflow-hidden rounded-[30px] border shadow-[0_18px_44px_rgba(21,30,44,0.2)]"
        style={{ borderColor: palette.cardBorder, background: palette.card }}
      >
        <div className="relative h-56 overflow-hidden md:h-[320px]">
          <img
            src={section.imageUrl || coverImageUrl || '/placeholder-doku.jpg'}
            alt={section.title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0" style={{ background: palette.heroOverlay }} />
          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
            <span className="inline-flex rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.14em]" style={{ borderColor: 'rgba(255,255,255,0.28)', color: '#f2f6fb', background: 'rgba(10,14,22,0.34)' }}>
              Abschnitt {index + 1} / {total}
            </span>
            <h2 className="mt-3 text-3xl leading-tight text-white md:text-5xl" style={{ fontFamily: headingFont }}>
              {headerInView ? (
                <Typewriter text={section.title} speed={48} delay={300} cursor="" />
              ) : (
                section.title
              )}
            </h2>
          </div>
          <div className="absolute inset-0" onMouseEnter={() => setHeaderInView(true)} onFocus={() => setHeaderInView(true)} />
        </div>

        <div className="space-y-7 p-5 md:p-8">
          <CinematicText
            text={section.content}
            paragraphClassName="!text-base md:!text-lg lg:!text-xl !leading-relaxed !tracking-normal !drop-shadow-none"
            paragraphStyle={{ color: palette.title }}
            className="space-y-5"
          />

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

          {onComplete && (
            <div className="pt-2">
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                onClick={onComplete}
                disabled={isCompleted}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-transform',
                  isCompleted ? 'cursor-default' : 'hover:-translate-y-[1px]'
                )}
                style={{
                  borderColor: palette.cardBorder,
                  color: isCompleted ? '#7fb591' : palette.title,
                  background: isCompleted ? 'rgba(119,172,141,0.16)' : palette.accentSoft,
                }}
              >
                <Sparkles className="h-4 w-4" />
                {isCompleted ? 'Abgeschlossen' : 'Doku abschliessen'}
              </motion.button>
            </div>
          )}
        </div>
      </motion.article>
    </section>
  );
};

export default CinematicDokuViewer;
