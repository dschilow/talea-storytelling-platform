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
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useBackend } from '../../hooks/useBackend';
import { useTranslation } from 'react-i18next';
import LevelUpModal from '../../components/gamification/LevelUpModal';
import type { InventoryItem } from '../../types/avatar';
import { useTheme } from '../../contexts/ThemeContext';
import { useOptionalChildProfiles } from '../../contexts/ChildProfilesContext';
import UpgradePlanModal from '../../components/subscription/UpgradePlanModal';
import { ageToAgeGroup, getPreferredAvatarIds } from '@/lib/child-profile-defaults';
import { useStoryAgentFlow, ActiveAgentStack } from '../../agents';
import { cn } from '@/lib/utils';
import {
  TaleaActionButton,
  TaleaPageBackground,
  TaleaProgressSteps,
  taleaBodyFont,
  taleaChipClass,
  taleaDisplayFont,
  taleaPageShellClass,
  taleaSurfaceClass,
} from '@/components/talea/TaleaPastelPrimitives';

import Step1AvatarSelection from './wizard-steps/Step1AvatarSelection';
import Step2CategorySelection from './wizard-steps/Step2CategorySelection';
import Step3AgeAndLength from './wizard-steps/Step3AgeAndLength';
import Step4StoryFeeling from './wizard-steps/Step4StoryFeeling';
import Step5SpecialWishes from './wizard-steps/Step5SpecialWishes';
import Step6Summary from './wizard-steps/Step6Summary';
import { generateStoryWithModelFallback } from './storyGenerateWithModelFallback';

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
  aiModel:
  | 'claude-sonnet-4-6'
  | 'gpt-5.4'
  | 'gpt-5.4-mini'
  | 'gemini-3-flash-preview'
  | 'gemini-3-pro-preview'
  | 'gemini-3.1-pro-preview';
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

const headingFont = taleaDisplayFont;
const bodyFont = taleaBodyFont;

function getPalette(_isDark: boolean): Palette {
  return {
    pageGradient: 'var(--talea-page)',
    panel: 'var(--talea-surface-primary)',
    panelBorder: 'var(--talea-border-light)',
    text: 'var(--talea-text-primary)',
    muted: 'var(--talea-text-secondary)',
    soft: 'var(--talea-surface-inset)',
    primary: 'linear-gradient(135deg,var(--primary) 0%, color-mix(in srgb, var(--talea-accent-sky) 72%, white) 100%)',
    primaryText: 'var(--primary-foreground)',
    secondary: 'var(--talea-surface-inset)',
  };
}

const GENERATION_STEPS: { key: GenerationStep; icon: React.FC<{ className?: string; style?: React.CSSProperties }>; label: string; description: string }[] = [
  { key: 'profiles', icon: Users, label: 'Avatare vorbereiten', description: 'Schaue mir deine Avatare genau an' },
  { key: 'memories', icon: Sparkles, label: 'Erinnerungen sammeln', description: 'Was haben deine Avatare schon erlebt?' },
  { key: 'text', icon: FileText, label: 'Geschichte schreiben', description: 'Deine Geschichte wird gerade geschrieben' },
  { key: 'validation', icon: CheckCircle, label: 'Alles prüfen', description: 'Passt die Geschichte zusammen?' },
  { key: 'images', icon: Image, label: 'Bilder malen', description: 'Die Bilder für deine Geschichte entstehen' },
  { key: 'complete', icon: CheckCircle, label: 'Fertig!', description: 'Alles gespeichert - viel Spaß beim Lesen!' },
];

const WizardBackground: React.FC<{ isDark: boolean }> = ({ isDark }) => <TaleaPageBackground isDark={isDark} />;

const StepIndicator: React.FC<{ activeStep: number; labels: string[]; palette: Palette }> = ({ activeStep, labels }) => (
  <div className={cn(taleaSurfaceClass, 'mb-4 px-3 py-3')}>
    <TaleaProgressSteps
      steps={labels.map((label, index) => ({ id: `wizard-step-${index}`, label }))}
      activeIndex={activeStep}
    />
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
              Deine Geschichte wird gezaubert
            </h2>
            <p className="text-xs mt-1" style={{ color: palette.muted }}>
              Das dauert nur einen kleinen Moment - gleich geht's los!
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
                  borderColor: isActive ? 'var(--talea-text-tertiary)' : palette.panelBorder,
                  background: isActive ? palette.soft : palette.secondary,
                }}
              >
                <div
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: isDone ? 'var(--talea-success-soft)' : palette.soft }}
                >
                  {isDone ? (
                    <Check className="h-4 w-4" style={{ color: 'var(--talea-success)' }} />
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
            style={{ background: 'linear-gradient(90deg,var(--talea-text-tertiary),var(--talea-border-soft),var(--primary))' }}
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
  const [searchParams] = useSearchParams();
  const backend = useBackend();
  const { userId } = useAuth();
  const childProfiles = useOptionalChildProfiles();
  const activeProfileId = childProfiles?.activeProfileId;
  const activeProfile = childProfiles?.activeProfile ?? null;
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

  const VALID_CATEGORIES = ['fairy-tales', 'adventure', 'magic', 'animals', 'scifi', 'modern'] as const;
  const tagParam = searchParams.get('tags');
  const mapAvatarId = searchParams.get('mapAvatarId');

  const tagList = tagParam ? tagParam.split(',').map(s => s.trim()) : [];
  const initialCategory = VALID_CATEGORIES.find(c => tagList.includes(c as any)) as WizardState['mainCategory'] || null;
  const isMapAutoFill = Boolean(mapAvatarId && tagParam);
  const customTags = tagList.filter(t => !VALID_CATEGORIES.includes(t as any)).join(', ');

  const [activeStep, setActiveStep] = useState(isMapAutoFill ? 5 : 0);
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<GenerationStep>('profiles');
  const { onPhaseChange, onStoryReady } = useStoryAgentFlow();
  const [userLanguage, setUserLanguage] = useState<string>('de');
  const [storyCredits, setStoryCredits] = useState<StoryCredits | null>(null);
  const [billingPermissions, setBillingPermissions] = useState<BillingPermissions | null>(null);
  const [lootArtifact, setLootArtifact] = useState<InventoryItem | null>(null);
  const [showLootModal, setShowLootModal] = useState(false);
  const [pendingStoryId, setPendingStoryId] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState(
    'Du hast gerade keine Geschichten-Münzen mehr. Frag deine Eltern, ob sie den Plan wechseln möchten.'
  );

  const [state, setState] = useState<WizardState>({
    selectedAvatars: mapAvatarId ? [mapAvatarId] : [],
    mainCategory: initialCategory || (isMapAutoFill ? 'adventure' : null),
    subCategory: null,
    ageGroup: isMapAutoFill ? '6-8' : null,
    length: isMapAutoFill ? 'medium' : null,
    feelings: isMapAutoFill ? ['exciting'] : [],
    rhymes: false,
    moral: false,
    avatarIsHero: true,
    famousCharacters: false,
    happyEnd: true,
    surpriseEnd: false,
    customWish: customTags ? `Thema: ${customTags}` : '',
    aiModel: 'gemini-3.1-pro-preview',
  });
  const lastAppliedProfileRef = React.useRef<string | null>(null);

  useEffect(() => {
    if (i18n.language) setUserLanguage(i18n.language);
  }, [i18n.language]);

  useEffect(() => {
    if (!activeProfile || isMapAutoFill || lastAppliedProfileRef.current === activeProfile.id) {
      return;
    }

    lastAppliedProfileRef.current = activeProfile.id;
    const defaultAgeGroup = ageToAgeGroup(activeProfile.age);
    const defaultAvatarIds = getPreferredAvatarIds(activeProfile).slice(0, 3);

    setState((prev) => ({
      ...prev,
      ageGroup: defaultAgeGroup || prev.ageGroup,
      selectedAvatars: defaultAvatarIds.length > 0 ? defaultAvatarIds : prev.selectedAvatars,
    }));
  }, [activeProfile, isMapAutoFill]);

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
        setUpgradeMessage('Deine Probierzeit ist vorbei. Frag deine Eltern, ob sie einen Plan aussuchen möchten.');
      } else {
        setUpgradeMessage('Deine Geschichten-Münzen für diesen Monat sind aufgebraucht. Frag deine Eltern!');
      }
      setShowUpgradeModal(true);
      return;
    }

    try {
      setGenerating(true);
      setGenerationStep('profiles');
      onPhaseChange('profiles');
      await new Promise((r) => setTimeout(r, 1200));
      setGenerationStep('memories');
      onPhaseChange('memories');
      await new Promise((r) => setTimeout(r, 1200));
      setGenerationStep('text');
      onPhaseChange('text');

      const storyConfig = mapWizardStateToAPI(state, userLanguage);
      const story = await generateStoryWithModelFallback(backend.story.generate, {
        userId,
        config: storyConfig,
        profileId: activeProfileId || undefined,
      });

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
      onPhaseChange('validation');
      await new Promise((r) => setTimeout(r, 900));
      setGenerationStep('images');
      onPhaseChange('images');
      await new Promise((r) => setTimeout(r, 1200));
      setGenerationStep('complete');
      onPhaseChange('complete');
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
        onStoryReady();
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
      onStoryReady();
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
        ? 'Probierzeit vorbei - frag deine Eltern!'
        : 'Geschichten-Münzen für diesen Monat aufgebraucht.'
      : undefined;

    switch (activeStep) {
      case 0:
        return <Step1AvatarSelection state={state} updateState={updateState} />;
      case 1:
        return <Step2CategorySelection state={state} updateState={updateState} />;
      case 2:
        return <Step3AgeAndLength state={state} updateState={updateState} showModelSelection />;
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
      <div className="relative min-h-screen pb-10 pt-6" style={{ fontFamily: bodyFont }}>
        <WizardBackground isDark={isDark} />
        <div className={taleaPageShellClass}>
          <GenerationProgress currentStep={generationStep} palette={palette} />
        </div>
        <div className="relative z-10 mx-auto mt-4 max-w-xl px-4">
          <ActiveAgentStack />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-10 pt-2" style={{ fontFamily: bodyFont }}>
      <WizardBackground isDark={isDark} />

      <div className={cn(taleaPageShellClass, 'relative z-10')}>
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(taleaSurfaceClass, 'mb-4 flex flex-wrap items-end justify-between gap-4 px-4 py-4 md:px-5')}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={taleaChipClass}>Story Wizard</span>
              <span className="inline-flex items-center rounded-full border border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)] px-3 py-1 text-[11px] font-medium text-[var(--talea-text-secondary)]">
                Schritt {activeStep + 1} / {labels.length}
              </span>
            </div>
            <h1 className="mt-3 text-[1.85rem] leading-[0.98] text-[var(--talea-text-primary)] sm:text-[2.25rem]" style={{ fontFamily: headingFont }}>
              Neue Geschichte
            </h1>
          </div>

          <TaleaActionButton
            type="button"
            variant="secondary"
            onClick={() => navigate('/stories')}
            icon={<ArrowLeft className="h-4 w-4" />}
          >
            Zur Bibliothek
          </TaleaActionButton>
        </motion.header>

        <StepIndicator activeStep={activeStep} labels={labels} palette={palette} />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(taleaSurfaceClass, 'p-5 md:p-7')}
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
          <TaleaActionButton
            type="button"
            variant="secondary"
            onClick={activeStep === 0 ? () => navigate('/stories') : handleBack}
            icon={<ArrowLeft className="h-4 w-4" />}
          >
            Zurück
          </TaleaActionButton>

          {activeStep < labels.length - 1 && (
            <TaleaActionButton type="button" onClick={handleNext} disabled={!canProceed()}>
              Weiter
            </TaleaActionButton>
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

function mapWizardStateToAPI(state: WizardState, userLanguage: string) {
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
    aiModel: state.aiModel,
    preferences: {
      useFairyTaleTemplate: state.mainCategory === 'fairy-tales' || state.mainCategory === 'magic',
    },
  } as any;
}
