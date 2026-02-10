import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle,
  FileText,
  Image,
  Loader2,
  Sparkles,
  Users,
  Wand2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useBackend } from '../../hooks/useBackend';
import { useTranslation } from 'react-i18next';
import LevelUpModal from '../../components/gamification/LevelUpModal';
import type { InventoryItem } from '../../types/avatar';
import { useTheme } from '../../contexts/ThemeContext';
import { useOptionalUserAccess } from '../../contexts/UserAccessContext';
import UpgradePlanModal from '../../components/subscription/UpgradePlanModal';

import Step1AvatarSelection from './wizard-steps/Step1AvatarSelection';
import Step2CategorySelection from './wizard-steps/Step2CategorySelection';
import Step3AgeAndLength from './wizard-steps/Step3AgeAndLength';
import Step4StoryFeeling from './wizard-steps/Step4StoryFeeling';
import Step5SpecialWishes from './wizard-steps/Step5SpecialWishes';
import Step6Summary from './wizard-steps/Step6Summary';

interface WizardState {
  selectedAvatars: string[];
  mainCategory: 'fairy-tales' | 'adventure' | 'magic' | 'animals' | 'scifi' | 'modern' | null;
  subCategory: string | null;
  ageGroup: '3-5' | '6-8' | '9-12' | '13+' | null;
  length: 'short' | 'medium' | 'long' | null;
  feelings: ('funny' | 'warm' | 'exciting' | 'crazy' | 'meaningful')[];
  rhymes: boolean;
  moral: boolean;
  avatarIsHero: boolean;
  famousCharacters: boolean;
  happyEnd: boolean;
  surpriseEnd: boolean;
  customWish: string;
  aiModel: 'gpt-5-nano' | 'gpt-5-mini' | 'gpt-5.2' | 'gemini-3-flash-preview';
}

type GenerationStep = 'profiles' | 'memories' | 'text' | 'validation' | 'images' | 'complete';

type StoryCredits = {
  limit: number | null;
  used: number;
  remaining: number | null;
  costPerGeneration: 1;
};

type BillingPermissions = {
  freeTrialActive: boolean;
  freeTrialDaysRemaining: number;
};

type Palette = {
  pageGradient: string;
  panel: string;
  panelBorder: string;
  text: string;
  muted: string;
  soft: string;
  primary: string;
  primaryText: string;
  secondary: string;
};

const headingFont = '"Cormorant Garamond", serif';

function getPalette(isDark: boolean): Palette {
  if (isDark) {
    return {
      pageGradient:
        'radial-gradient(980px 540px at 100% 0%, rgba(87,113,160,0.28) 0%, transparent 57%), radial-gradient(940px 520px at 0% 16%, rgba(88,129,121,0.24) 0%, transparent 62%), linear-gradient(180deg,#121b28 0%, #0f1723 100%)',
      panel: 'rgba(23,33,47,0.92)',
      panelBorder: '#314258',
      text: '#e8eef8',
      muted: '#9db0c8',
      soft: 'rgba(145,166,194,0.16)',
      primary: 'linear-gradient(135deg,#d5bdaf 0%,#e3d5ca 46%,#d6ccc2 100%)',
      primaryText: '#121b2a',
      secondary: 'rgba(34,46,63,0.88)',
    };
  }

  return {
    pageGradient:
      'radial-gradient(980px 560px at 100% 0%, #f2dfdc 0%, transparent 58%), radial-gradient(960px 520px at 0% 18%, #dae8de 0%, transparent 62%), linear-gradient(180deg,#f8f1e8 0%, #f6efe4 100%)',
    panel: 'rgba(255,250,243,0.93)',
    panelBorder: '#dfcfbb',
    text: '#1b2838',
    muted: '#617387',
    soft: 'rgba(230,220,205,0.72)',
    primary: 'linear-gradient(135deg,#f2d9d6 0%,#e8d8e9 46%,#d5e3cf 100%)',
    primaryText: '#2c394a',
    secondary: 'rgba(255,248,238,0.95)',
  };
}

const GENERATION_STEPS: { key: GenerationStep; icon: React.ElementType; label: string; description: string }[] = [
  { key: 'profiles', icon: Users, label: 'Avatar-Profile', description: 'Lade visuelle Profile und Eigenschaften' },
  { key: 'memories', icon: Sparkles, label: 'Erinnerungen', description: 'Sammle Erlebnisse und Entwicklung' },
  { key: 'text', icon: FileText, label: 'Geschichte', description: 'KI schreibt die Geschichte' },
  { key: 'validation', icon: CheckCircle, label: 'Validierung', description: 'Pruefe Struktur und Konsistenz' },
  { key: 'images', icon: Image, label: 'Illustrationen', description: 'Erstelle Cover und Szenenbilder' },
  { key: 'complete', icon: CheckCircle, label: 'Fertig', description: 'Speichern und Avatar-Update' },
];

const WizardBackground: React.FC<{ palette: Palette }> = ({ palette }) => (
  <div className="pointer-events-none fixed inset-0 -z-10" style={{ background: palette.pageGradient }} />
);

const StepIndicator: React.FC<{ activeStep: number; labels: string[]; palette: Palette }> = ({
  activeStep,
  labels,
  palette,
}) => (
  <div className="flex items-center justify-center gap-2 mb-6 px-2 overflow-x-auto">
    {labels.map((label, i) => (
      <React.Fragment key={label}>
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold"
            style={
              i < activeStep
                ? { background: '#34D399', color: '#0f1828' }
                : i === activeStep
                ? { background: '#d5bdaf2b', border: '2px solid #a88f80', color: '#a88f80' }
                : { background: palette.soft, border: `1px solid ${palette.panelBorder}`, color: palette.muted }
            }
          >
            {i < activeStep ? <Check className="w-3.5 h-3.5" /> : i + 1}
          </div>
          <span className="text-[10px] font-medium whitespace-nowrap" style={{ color: i <= activeStep ? palette.text : palette.muted }}>
            {label}
          </span>
        </div>
        {i < labels.length - 1 && (
          <div className="h-px w-6 rounded-full" style={{ background: i < activeStep ? '#34D399' : palette.panelBorder }} />
        )}
      </React.Fragment>
    ))}
  </div>
);

const GenerationProgress: React.FC<{ currentStep: GenerationStep; palette: Palette }> = ({ currentStep, palette }) => {
  const currentIndex = GENERATION_STEPS.findIndex((step) => step.key === currentStep);

  return (
    <div className="relative min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-3xl border p-6 md:p-7" style={{ background: palette.panel, borderColor: palette.panelBorder }}>
        <div className="mb-5 flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: palette.soft }}>
            <BookOpen className="h-5 w-5" style={{ color: palette.text }} />
          </div>
          <div>
            <h2 className="text-3xl leading-none" style={{ fontFamily: headingFont, color: palette.text }}>
              Geschichte wird erstellt
            </h2>
            <p className="text-xs mt-1" style={{ color: palette.muted }}>
              Dieser Schritt dauert in der Regel unter 2 Minuten.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {GENERATION_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentIndex;
            const isDone = index < currentIndex;

            return (
              <div
                key={step.key}
                className="flex items-center gap-3 rounded-2xl border px-3 py-3"
                style={{
                  borderColor: isActive ? '#a88f80' : palette.panelBorder,
                  background: isActive ? palette.soft : palette.secondary,
                }}
              >
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: isDone ? '#34D39922' : palette.soft }}>
                  {isDone ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : isActive ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}>
                      <Loader2 className="h-4 w-4" style={{ color: palette.text }} />
                    </motion.div>
                  ) : (
                    <Icon className="h-4 w-4" style={{ color: palette.muted }} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: palette.text }}>
                    {step.label}
                  </p>
                  <p className="text-xs" style={{ color: palette.muted }}>
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 h-2 w-full overflow-hidden rounded-full" style={{ background: palette.soft }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg,#a88f80,#d6ccc2,#d5bdaf)' }}
            animate={{ width: `${((currentIndex + 1) / GENERATION_STEPS.length) * 100}%` }}
            transition={{ duration: 0.35 }}
          />
        </div>
      </div>
    </div>
  );
};

export default function TaleaStoryWizard() {
  const navigate = useNavigate();
  const backend = useBackend();
  const { userId } = useAuth();
  const { isAdmin } = useOptionalUserAccess();
  const { t, i18n } = useTranslation();
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';
  const palette = useMemo(() => getPalette(isDark), [isDark]);

  const labels = [
    t('wizard.steps.avatars'),
    t('wizard.steps.category'),
    t('wizard.steps.ageLength'),
    t('wizard.steps.feeling'),
    t('wizard.steps.wishes'),
    t('wizard.steps.summary'),
  ];

  const [activeStep, setActiveStep] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<GenerationStep>('profiles');
  const [userLanguage, setUserLanguage] = useState<string>('de');
  const [storyCredits, setStoryCredits] = useState<StoryCredits | null>(null);
  const [billingPermissions, setBillingPermissions] = useState<BillingPermissions | null>(null);
  const [lootArtifact, setLootArtifact] = useState<InventoryItem | null>(null);
  const [showLootModal, setShowLootModal] = useState(false);
  const [pendingStoryId, setPendingStoryId] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState(
    'Dein aktueller Plan hat keine freien StoryCredits mehr. Wechsle in den Einstellungen den Plan.'
  );

  const [state, setState] = useState<WizardState>({
    selectedAvatars: [],
    mainCategory: null,
    subCategory: null,
    ageGroup: null,
    length: null,
    feelings: [],
    rhymes: false,
    moral: false,
    avatarIsHero: true,
    famousCharacters: false,
    happyEnd: true,
    surpriseEnd: false,
    customWish: '',
    aiModel: 'gpt-5-mini',
  });

  useEffect(() => {
    if (i18n.language) setUserLanguage(i18n.language);
  }, [i18n.language]);

  useEffect(() => {
    if (!isAdmin && state.aiModel !== 'gpt-5-mini') {
      setState((prev) => ({ ...prev, aiModel: 'gpt-5-mini' }));
    }
  }, [isAdmin, state.aiModel]);

  useEffect(() => {
    let active = true;

    const loadCredits = async () => {
      if (!userId) return;
      try {
        const profile = await backend.user.me();
        if (!active) return;
        setStoryCredits((profile as any).billing?.storyCredits ?? null);
        setBillingPermissions((profile as any).billing?.permissions ?? null);
      } catch (error) {
        console.error('[StoryWizard] Failed to load story credits:', error);
      }
    };

    void loadCredits();

    return () => {
      active = false;
    };
  }, [backend, userId]);

  const updateState = (updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (activeStep < labels.length - 1) setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    if (activeStep > 0) setActiveStep((prev) => prev - 1);
  };

  const canProceed = () => {
    switch (activeStep) {
      case 0:
        return state.selectedAvatars.length > 0;
      case 1:
        return state.mainCategory !== null;
      case 2:
        return state.ageGroup !== null && state.length !== null;
      case 3:
        return state.feelings.length > 0;
      case 4:
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleGenerate = async () => {
    if (!userId) {
      alert(t('story.wizard.alerts.loginRequired'));
      return;
    }

    if (storyCredits && storyCredits.remaining !== null && storyCredits.remaining <= 0) {
      if (billingPermissions && !billingPermissions.freeTrialActive) {
        setUpgradeMessage('Deine Free-Testphase ist abgelaufen. Wechsle auf Starter, Familie oder Premium, um weiter Storys zu generieren.');
      } else {
        setUpgradeMessage('Keine StoryCredits mehr fuer diesen Monat. Wechsle den Plan in den Einstellungen.');
      }
      setShowUpgradeModal(true);
      return;
    }

    try {
      setGenerating(true);
      setGenerationStep('profiles');
      await new Promise((r) => setTimeout(r, 1200));
      setGenerationStep('memories');
      await new Promise((r) => setTimeout(r, 1200));
      setGenerationStep('text');

      const storyConfig = mapWizardStateToAPI(state, userLanguage, isAdmin);
      const story = await backend.story.generate({ userId, config: storyConfig });

      setStoryCredits((prev) =>
        prev
          ? {
              ...prev,
              used: prev.used + 1,
              remaining: prev.remaining === null ? null : Math.max(0, prev.remaining - 1),
            }
          : prev
      );

      setGenerationStep('validation');
      await new Promise((r) => setTimeout(r, 900));
      setGenerationStep('images');
      await new Promise((r) => setTimeout(r, 1200));
      setGenerationStep('complete');
      await new Promise((r) => setTimeout(r, 800));

      const storyData = story as any;
      const newArtifact = storyData.newArtifact || storyData.metadata?.newArtifact;
      if (newArtifact) {
        const lootItem: InventoryItem = {
          id: crypto.randomUUID(),
          name: newArtifact.name,
          type: newArtifact.type || 'TOOL',
          level: 1,
          sourceStoryId: story.id,
          description: newArtifact.description,
          visualPrompt: newArtifact.visualDescriptorKeywords?.join(', ') || '',
          tags: newArtifact.visualDescriptorKeywords || [],
          acquiredAt: new Date().toISOString(),
          imageUrl: newArtifact.imageUrl,
          storyEffect: newArtifact.storyEffect,
        };
        setLootArtifact(lootItem);
        setPendingStoryId(story.id);
        setShowLootModal(true);
      } else {
        navigate(`/story-reader/${story.id}`);
      }
    } catch (error) {
      console.error('[StoryWizard] Error:', error);
      let errorMessage = t('story.wizard.alerts.error');
      if (error instanceof Error) {
        if (error.message.includes('length limit exceeded')) errorMessage = t('story.wizard.alerts.tooLong');
        else if (error.message.includes('timeout')) errorMessage = t('story.wizard.alerts.timeout');
        else if (error.message.includes('Abo-Limit erreicht')) {
          setUpgradeMessage(error.message);
          setShowUpgradeModal(true);
          return;
        }
      }
      alert(errorMessage);
    } finally {
      setGenerating(false);
      setGenerationStep('profiles');
    }
  };

  const handleLootModalClose = () => {
    setShowLootModal(false);
    setLootArtifact(null);
    if (pendingStoryId) {
      navigate(`/story-reader/${pendingStoryId}`);
      setPendingStoryId(null);
    }
  };

  const renderStep = () => {
    const storyGenerationBlocked = Boolean(
      storyCredits && storyCredits.remaining !== null && storyCredits.remaining <= 0
    );

    const blockedMessage = storyGenerationBlocked
      ? billingPermissions && !billingPermissions.freeTrialActive
        ? 'Free-Testphase abgelaufen. Upgrade im Profil noetig.'
        : 'StoryCredits fuer diesen Monat aufgebraucht.'
      : undefined;

    switch (activeStep) {
      case 0:
        return <Step1AvatarSelection state={state} updateState={updateState} />;
      case 1:
        return <Step2CategorySelection state={state} updateState={updateState} />;
      case 2:
        return <Step3AgeAndLength state={state} updateState={updateState} showModelSelection={isAdmin} />;
      case 3:
        return <Step4StoryFeeling state={state} updateState={updateState} />;
      case 4:
        return <Step5SpecialWishes state={state} updateState={updateState} />;
      case 5:
        return (
          <Step6Summary
            state={state}
            onGenerate={handleGenerate}
            storyCredits={storyCredits}
            generateDisabled={storyGenerationBlocked}
            generateDisabledMessage={blockedMessage}
          />
        );
      default:
        return null;
    }
  };

  if (generating) {
    return (
      <div className="relative min-h-screen pb-10 pt-6">
        <WizardBackground palette={palette} />
        <GenerationProgress currentStep={generationStep} palette={palette} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-10 pt-4">
      <WizardBackground palette={palette} />

      <div className="relative z-10">
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: palette.muted }}>
              Story Wizard
            </p>
            <h1 className="text-4xl leading-none" style={{ fontFamily: headingFont, color: palette.text }}>
              Neue Geschichte
            </h1>
          </div>

          <button
            type="button"
            onClick={() => navigate('/stories')}
            className="inline-flex h-10 items-center rounded-xl border px-3 text-sm font-semibold"
            style={{ borderColor: palette.panelBorder, background: palette.secondary, color: palette.text }}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Zur Bibliothek
          </button>
        </motion.header>

        <StepIndicator activeStep={activeStep} labels={labels} palette={palette} />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border p-5 md:p-7"
          style={{ borderColor: palette.panelBorder, background: palette.panel }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.22 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-5 flex items-center justify-between"
        >
          <button
            type="button"
            onClick={activeStep === 0 ? () => navigate('/stories') : handleBack}
            className="inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold"
            style={{ borderColor: palette.panelBorder, background: palette.secondary, color: palette.text }}
          >
            <ArrowLeft className="h-4 w-4" />
            Zurueck
          </button>

          {activeStep < labels.length - 1 && (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed()}
              className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-45"
              style={{
                background: canProceed() ? palette.primary : palette.soft,
                color: canProceed() ? palette.primaryText : palette.muted,
              }}
            >
              Weiter
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </motion.div>
      </div>

      <LevelUpModal
        isOpen={showLootModal}
        onClose={handleLootModalClose}
        item={lootArtifact || undefined}
        type="new_item"
      />
      <UpgradePlanModal
        open={showUpgradeModal}
        message={upgradeMessage}
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}

function mapWizardStateToAPI(state: WizardState, userLanguage: string, isAdmin: boolean) {
  const genreMap: Record<string, string> = {
    'fairy-tales': 'fairy_tales',
    adventure: 'adventure',
    magic: 'magic',
    animals: 'animals',
    scifi: 'scifi',
    modern: 'modern',
  };

  let tone: 'warm' | 'witty' | 'epic' | 'soothing' | 'mischievous' | 'wonder' = 'warm';
  if (state.feelings.includes('funny')) tone = 'witty';
  else if (state.feelings.includes('exciting')) tone = 'epic';
  else if (state.feelings.includes('warm')) tone = 'warm';
  else if (state.feelings.includes('crazy')) tone = 'mischievous';
  else if (state.feelings.includes('meaningful')) tone = 'soothing';
  else if (state.mainCategory === 'magic') tone = 'wonder';

  const genre = state.mainCategory ? genreMap[state.mainCategory] || 'adventure' : 'adventure';

  return {
    avatarIds: state.selectedAvatars,
    ageGroup: (state.ageGroup || '6-8') as '3-5' | '6-8' | '9-12' | '13+',
    genre,
    length: (state.length || 'medium') as 'short' | 'medium' | 'long',
    complexity: 'medium' as 'simple' | 'medium' | 'complex',
    setting: state.mainCategory === 'fairy-tales' ? 'fantasy' : 'varied',
    suspenseLevel: state.feelings.includes('exciting') ? 2 : 1,
    humorLevel: state.feelings.includes('funny') ? 2 : 1,
    tone,
    pacing: (state.feelings.includes('exciting') ? 'fast' : 'balanced') as 'fast' | 'balanced' | 'slow',
    allowRhymes: state.rhymes,
    hasTwist: state.surpriseEnd,
    customPrompt: state.customWish || undefined,
    language: userLanguage as 'de' | 'en' | 'fr' | 'es' | 'it' | 'nl' | 'ru',
    aiModel: isAdmin ? state.aiModel : 'gpt-5-mini',
    preferences: {
      useFairyTaleTemplate: state.mainCategory === 'fairy-tales' || state.mainCategory === 'magic',
    },
  } as any;
}


