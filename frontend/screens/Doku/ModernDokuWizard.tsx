import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';

import { useBackend } from '../../hooks/useBackend';
import { useTheme } from '../../contexts/ThemeContext';
import UpgradePlanModal from '../../components/subscription/UpgradePlanModal';

type DokuApiLanguage = 'de' | 'en' | 'fr' | 'es' | 'it' | 'nl';

const DOKU_API_LANGUAGES: DokuApiLanguage[] = ['de', 'en', 'fr', 'es', 'it', 'nl'];

const toDokuLanguage = (candidate?: string | null): DokuApiLanguage => {
  if (!candidate) return 'de';
  return DOKU_API_LANGUAGES.includes(candidate as DokuApiLanguage)
    ? (candidate as DokuApiLanguage)
    : 'de';
};

type DokuWizardState = {
  topic: string;
  ageGroup: '3-5' | '6-8' | '9-12' | '13+';
  depth: 'basic' | 'standard' | 'deep';
  perspective: 'science' | 'history' | 'technology' | 'nature' | 'culture';
  tone: 'fun' | 'neutral' | 'curious';
  length: 'short' | 'medium' | 'long';
  includeInteractive: boolean;
  quizQuestions: number;
  handsOnActivities: number;
};

type DokuCredits = {
  limit: number | null;
  used: number;
  remaining: number | null;
  costPerGeneration: 1;
};

type BillingPermissions = {
  freeTrialActive: boolean;
  freeTrialDaysRemaining: number;
};

type GenerationPhase = 'text' | 'cover' | 'sections' | 'personality' | 'complete';

const steps = ['Thema', 'Alter & Tiefe', 'Perspektive', 'Inhalt', 'Zusammenfassung'] as const;

const topics = [
  'Dinosaurier',
  'Vulkane',
  'Weltraum',
  'Ozeane',
  'Pflanzen',
  'Bienen',
  'Klimawandel',
  'Chemie im Alltag',
];

const ageOptions = [
  { value: '3-5', label: '3-5 Jahre', desc: 'Sehr einfach' },
  { value: '6-8', label: '6-8 Jahre', desc: 'Spielerisch' },
  { value: '9-12', label: '9-12 Jahre', desc: 'Mehr Zusammenhaenge' },
  { value: '13+', label: '13+ Jahre', desc: 'Komplex' },
] as const;

const depthOptions = [
  { value: 'basic', label: 'Grundlagen', desc: 'Kurz und klar' },
  { value: 'standard', label: 'Standard', desc: 'Ausgewogen' },
  { value: 'deep', label: 'Tief', desc: 'Ausfuehrlich' },
] as const;

const perspectiveOptions = [
  { value: 'science', label: 'Naturwissenschaft', desc: 'Wie funktioniert es?' },
  { value: 'history', label: 'Geschichte', desc: 'Wie war es frueher?' },
  { value: 'technology', label: 'Technik', desc: 'Wie wird es gebaut?' },
  { value: 'nature', label: 'Natur', desc: 'Was lebt und waechst?' },
  { value: 'culture', label: 'Kultur', desc: 'Was bedeutet es?' },
] as const;

const toneOptions = [
  { value: 'fun', label: 'Lustig', desc: 'Mit Humor' },
  { value: 'curious', label: 'Neugierig', desc: 'Entdeckerstil' },
  { value: 'neutral', label: 'Sachlich', desc: 'Klar und ruhig' },
] as const;

const lengthOptions = [
  { value: 'short', label: 'Kurz', desc: '3 Abschnitte' },
  { value: 'medium', label: 'Mittel', desc: '5 Abschnitte' },
  { value: 'long', label: 'Lang', desc: '7 Abschnitte' },
] as const;

const phaseLabels: Record<GenerationPhase, string> = {
  text: 'Text wird erstellt',
  cover: 'Cover wird erstellt',
  sections: 'Kapitelbilder werden erstellt',
  personality: 'Wissen wird verteilt',
  complete: 'Fertig',
};

function Choice({
  selected,
  onClick,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-2xl border p-3 text-left transition-colors ${
        selected ? 'bg-accent/55' : 'bg-card/70 hover:bg-accent/35'
      }`}
      style={{ borderColor: selected ? '#d5bdaf66' : 'var(--color-border)' }}
    >
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      {selected && (
        <span className="absolute right-2 top-2 rounded-full bg-[#b79f8e] px-2 py-0.5 text-[10px] font-bold text-white">
          OK
        </span>
      )}
    </button>
  );
}

export default function ModernDokuWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const backend = useBackend();
  const { userId } = useAuth();
  const { user } = useUser();
  const { i18n } = useTranslation();
  const { resolvedTheme } = useTheme();

  const [activeStep, setActiveStep] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [phase, setPhase] = useState<GenerationPhase>('text');
  const [language, setLanguage] = useState<DokuApiLanguage>('de');
  const [credits, setCredits] = useState<DokuCredits | null>(null);
  const [permissions, setPermissions] = useState<BillingPermissions | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState(
    'Keine DokuCredits verfuegbar. Bitte den Plan in den Einstellungen wechseln.'
  );
  const [state, setState] = useState<DokuWizardState>({
    topic: searchParams.get('topicTags') ?? '',
    ageGroup: '6-8',
    depth: 'standard',
    perspective: 'science',
    tone: 'curious',
    length: 'medium',
    includeInteractive: true,
    quizQuestions: 3,
    handsOnActivities: 1,
  });

  const headingColor = useMemo(() => (resolvedTheme === 'dark' ? '#e7eef9' : '#1b2838'), [resolvedTheme]);
  const mutedColor = useMemo(() => (resolvedTheme === 'dark' ? '#9db0c8' : '#617387'), [resolvedTheme]);

  useEffect(() => {
    setLanguage(toDokuLanguage(i18n.language));
  }, [i18n.language]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!backend || !user) return;
      try {
        const profile = await backend.user.me();
        if (profile.preferredLanguage) {
          setLanguage(toDokuLanguage(profile.preferredLanguage));
        }
        setCredits((profile as any).billing?.dokuCredits ?? null);
        setPermissions((profile as any).billing?.permissions ?? null);
      } catch (error) {
        console.error('[ModernDokuWizard] Failed to load profile:', error);
      }
    };
    void loadProfile();
  }, [backend, user]);

  const updateState = (updates: Partial<DokuWizardState>) => setState((prev) => ({ ...prev, ...updates }));
  const canProceed = activeStep === 0 ? state.topic.trim().length >= 3 : true;
  const generationBlocked = Boolean(credits && credits.remaining !== null && credits.remaining <= 0);

  const createDoku = async () => {
    if (!userId || !state.topic.trim()) return;
    if (generationBlocked) {
      if (permissions && !permissions.freeTrialActive) {
        setUpgradeMessage('Deine Free-Testphase ist abgelaufen. Wechsle auf Starter, Familie oder Premium, um weitere Dokus zu generieren.');
      } else {
        setUpgradeMessage('Keine DokuCredits mehr fuer diesen Monat. Wechsle den Plan in den Einstellungen.');
      }
      setShowUpgradeModal(true);
      return;
    }

    let timer: ReturnType<typeof setInterval> | null = null;

    try {
      setGenerating(true);
      setPhase('text');
      timer = setInterval(() => {
        setPhase((prev) => {
          if (prev === 'text') return 'cover';
          if (prev === 'cover') return 'sections';
          if (prev === 'sections') return 'personality';
          return prev;
        });
      }, 3200);

      const created = await backend.doku.generateDoku({
        userId,
        config: {
          topic: state.topic.trim(),
          ageGroup: state.ageGroup,
          depth: state.depth,
          perspective: state.perspective,
          tone: state.tone,
          length: state.length,
          includeInteractive: state.includeInteractive,
          quizQuestions: state.includeInteractive ? state.quizQuestions : 0,
          handsOnActivities: state.includeInteractive ? state.handsOnActivities : 0,
          language,
        },
      });

      setCredits((prev) =>
        prev
          ? {
              ...prev,
              used: prev.used + 1,
              remaining: prev.remaining === null ? null : Math.max(0, prev.remaining - 1),
            }
          : prev
      );

      if (timer) clearInterval(timer);
      setPhase('complete');
      await new Promise((resolve) => setTimeout(resolve, 850));
      navigate(`/doku-reader/${created.id}`);
    } catch (error) {
      console.error('[ModernDokuWizard] Error generating doku:', error);
      if (error instanceof Error && error.message.includes('Abo-Limit erreicht')) {
        setUpgradeMessage(error.message);
        setShowUpgradeModal(true);
      } else {
        alert('Doku konnte nicht erstellt werden. Bitte versuche es erneut.');
      }
    } finally {
      if (timer) clearInterval(timer);
      setGenerating(false);
      setPhase('text');
    }
  };

  const summary = [
    { label: 'Thema', value: state.topic },
    { label: 'Altersgruppe', value: `${state.ageGroup} Jahre` },
    { label: 'Tiefe', value: depthOptions.find((item) => item.value === state.depth)?.label || '-' },
    { label: 'Perspektive', value: perspectiveOptions.find((item) => item.value === state.perspective)?.label || '-' },
    { label: 'Ton', value: toneOptions.find((item) => item.value === state.tone)?.label || '-' },
    { label: 'Abschnitte', value: lengthOptions.find((item) => item.value === state.length)?.desc || '-' },
    {
      label: 'Interaktiv',
      value: state.includeInteractive ? `${state.quizQuestions} Quiz + ${state.handsOnActivities} Aktivitaeten` : 'Ohne',
    },
  ];

  return (
    <div className="relative min-h-screen pb-24">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(980px_560px_at_100%_0%,#f2dfdc_0%,transparent_58%),radial-gradient(980px_520px_at_0%_18%,#dae8de_0%,transparent_62%),linear-gradient(180deg,#f8f1e8_0%,#f6efe4_100%)] dark:bg-[radial-gradient(980px_520px_at_100%_0%,rgba(108,94,145,0.28)_0%,transparent_58%),radial-gradient(920px_520px_at_0%_18%,rgba(84,128,121,0.25)_0%,transparent_62%),linear-gradient(180deg,#121a26_0%,#0f1723_100%)]" />

      <div className="pt-4">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: mutedColor }}>
              Doku Wizard
            </p>
            <h1 className="text-4xl leading-none" style={{ color: headingColor, fontFamily: '"Cormorant Garamond", serif' }}>
              Neue Doku
            </h1>
          </div>
          <button
            type="button"
            onClick={() => navigate('/doku')}
            className="inline-flex h-10 items-center rounded-xl border border-border bg-card/70 px-3 text-sm font-semibold text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Zur Doku-Ansicht
          </button>
        </header>

        {generating ? (
          <div className="mx-auto max-w-xl rounded-3xl border border-border bg-card/70 p-6">
            <div className="mb-6 text-center">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }} className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#d5bdaf1f]">
                <Loader2 className="h-7 w-7 text-[#a88f80]" />
              </motion.div>
              <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
                {phaseLabels[phase]}
              </h2>
            </div>
            <div className="space-y-2">
              {(Object.keys(phaseLabels) as GenerationPhase[]).map((item, index) => (
                <div key={item} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${item === phase ? 'border-[#d5bdaf66] bg-[#d5bdaf14]' : 'border-border bg-card/60'}`}>
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    {index < (Object.keys(phaseLabels) as GenerationPhase[]).indexOf(phase) ? <Check className="h-4 w-4 text-[#b79f8e]" /> : <Sparkles className="h-4 w-4" />}
                  </span>
                  <span className="text-sm font-semibold text-foreground">{phaseLabels[item]}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="mb-7 flex items-center justify-center gap-2">
              {steps.map((label, index) => (
                <React.Fragment key={label}>
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${index < activeStep ? 'bg-[#b79f8e] text-white' : index === activeStep ? 'bg-[#a88f80] text-white' : 'bg-muted text-muted-foreground'}`}>
                    {index < activeStep ? <Check className="h-4 w-4" /> : index + 1}
                  </span>
                  {index < steps.length - 1 && <span className={`h-px w-6 rounded-full ${index < activeStep ? 'bg-[#b79f8e]' : 'bg-border'}`} />}
                </React.Fragment>
              ))}
            </div>

            <div className="rounded-3xl border border-border bg-card/70 p-5 md:p-7">
              <AnimatePresence mode="wait">
                <motion.div key={activeStep} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
                  {activeStep === 0 && (
                    <div className="space-y-5">
                      <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: '"Cormorant Garamond", serif' }}>Thema waehlen</h2>
                      <input type="text" value={state.topic} onChange={(e) => updateState({ topic: e.target.value })} placeholder="z.B. Vulkane oder Sonnensystem" className="h-12 w-full rounded-2xl border border-border bg-card/70 px-4 text-sm text-foreground outline-none focus:border-[#a88f80]" />
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                        {topics.map((topic) => (
                          <button key={topic} type="button" onClick={() => updateState({ topic })} className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold ${state.topic === topic ? 'bg-accent/55' : 'bg-card/70 hover:bg-accent/35'}`} style={{ borderColor: state.topic === topic ? '#d5bdaf66' : 'var(--color-border)' }}>
                            {topic}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {activeStep === 1 && (
                    <div className="space-y-6">
                      <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: '"Cormorant Garamond", serif' }}>Alter und Tiefe</h2>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{ageOptions.map((item) => <Choice key={item.value} selected={state.ageGroup === item.value} onClick={() => updateState({ ageGroup: item.value })} title={item.label} description={item.desc} />)}</div>
                      <div className="grid grid-cols-3 gap-3">{depthOptions.map((item) => <Choice key={item.value} selected={state.depth === item.value} onClick={() => updateState({ depth: item.value })} title={item.label} description={item.desc} />)}</div>
                    </div>
                  )}
                  {activeStep === 2 && (
                    <div className="space-y-6">
                      <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: '"Cormorant Garamond", serif' }}>Perspektive und Ton</h2>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">{perspectiveOptions.map((item) => <Choice key={item.value} selected={state.perspective === item.value} onClick={() => updateState({ perspective: item.value })} title={item.label} description={item.desc} />)}</div>
                      <div className="grid grid-cols-3 gap-3">{toneOptions.map((item) => <Choice key={item.value} selected={state.tone === item.value} onClick={() => updateState({ tone: item.value })} title={item.label} description={item.desc} />)}</div>
                    </div>
                  )}
                  {activeStep === 3 && (
                    <div className="space-y-6">
                      <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: '"Cormorant Garamond", serif' }}>Inhalt</h2>
                      <div className="grid grid-cols-3 gap-3">{lengthOptions.map((item) => <Choice key={item.value} selected={state.length === item.value} onClick={() => updateState({ length: item.value })} title={item.label} description={item.desc} />)}</div>
                      <div className="rounded-2xl border border-border bg-card/70 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div><p className="text-sm font-semibold text-foreground">Interaktive Elemente</p><p className="text-xs text-muted-foreground">Quizfragen und Aktivitaeten</p></div>
                          <button type="button" onClick={() => updateState({ includeInteractive: !state.includeInteractive })} className={`relative h-7 w-14 rounded-full ${state.includeInteractive ? 'bg-[#a88f80]' : 'bg-muted'}`}><motion.span animate={{ x: state.includeInteractive ? 28 : 2 }} className="absolute top-0.5 h-6 w-6 rounded-full bg-white" /></button>
                        </div>
                        {state.includeInteractive && (
                          <div className="grid grid-cols-2 gap-4 border-t border-border pt-3">
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quizfragen</p>
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => updateState({ quizQuestions: Math.max(0, state.quizQuestions - 1) })} className="h-8 w-8 rounded-lg border border-border bg-card/70">-</button>
                                <span className="w-6 text-center">{state.quizQuestions}</span>
                                <button type="button" onClick={() => updateState({ quizQuestions: Math.min(10, state.quizQuestions + 1) })} className="h-8 w-8 rounded-lg border border-border bg-card/70">+</button>
                              </div>
                            </div>
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aktivitaeten</p>
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => updateState({ handsOnActivities: Math.max(0, state.handsOnActivities - 1) })} className="h-8 w-8 rounded-lg border border-border bg-card/70">-</button>
                                <span className="w-6 text-center">{state.handsOnActivities}</span>
                                <button type="button" onClick={() => updateState({ handsOnActivities: Math.min(5, state.handsOnActivities + 1) })} className="h-8 w-8 rounded-lg border border-border bg-card/70">+</button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {activeStep === 4 && (
                    <div className="space-y-5">
                      <h2 className="text-2xl font-bold text-foreground" style={{ fontFamily: '"Cormorant Garamond", serif' }}>Zusammenfassung</h2>
                      <div className="rounded-2xl border border-border bg-card/70 p-4">
                        <div className="space-y-2">{summary.map((item) => <div key={item.label} className="flex items-center justify-between gap-4 border-b border-border/70 py-2 text-sm last:border-0"><span className="font-semibold text-muted-foreground">{item.label}</span><span className="text-right font-semibold text-foreground">{item.value}</span></div>)}</div>
                      </div>
                      <button type="button" onClick={createDoku} disabled={generationBlocked} className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-6 py-4 text-base font-bold text-[#233347] shadow-[0_12px_24px_rgba(43,57,77,0.16)] ${generationBlocked ? 'cursor-not-allowed opacity-60' : 'hover:-translate-y-0.5'}`} style={{ borderColor: '#d4c5b5', background: 'linear-gradient(135deg,#f2d9d6 0%,#e8d8e9 42%,#d6e3cf 100%)' }}>
                        <Sparkles className="h-5 w-5" />
                        {generationBlocked ? 'Nicht verfuegbar' : 'Doku erstellen (1 DokuCredit)'}
                      </button>
                      {credits && <p className="text-xs text-muted-foreground">Credits: {credits.remaining === null ? 'unbegrenzt' : credits.remaining} verbleibend</p>}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <button type="button" onClick={activeStep === 0 ? () => navigate('/doku') : () => setActiveStep((prev) => prev - 1)} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/70 px-4 py-2.5 text-sm font-semibold text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Zurueck
              </button>
              {activeStep < steps.length - 1 && (
                <button type="button" onClick={() => setActiveStep((prev) => prev + 1)} disabled={!canProceed} className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45" style={{ background: canProceed ? 'linear-gradient(135deg,#f2d9d6 0%,#e8d8e9 42%,#d6e3cf 100%)' : '#dbe3ef', color: canProceed ? '#233347' : '#7a8799' }}>
                  Weiter
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
      <UpgradePlanModal
        open={showUpgradeModal}
        message={upgradeMessage}
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}

