import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ChevronLeft,
  ArrowRight,
  BookOpen,
  Check,
  FlaskConical,
  Loader2,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useBackend } from '../../hooks/useBackend';
import { fetchCharacterSeries, resetCharacterSeries } from '../../utils/characterSeriesApi';
import { useTranslation } from 'react-i18next';
import LevelUpModal from '../../components/gamification/LevelUpModal';
import type { InventoryItem } from '../../types/avatar';
import { useTheme } from '../../contexts/ThemeContext';
import { useOptionalChildProfiles } from '../../contexts/ChildProfilesContext';
import { useOptionalUserAccess } from '../../contexts/UserAccessContext';
import UpgradePlanModal from '../../components/subscription/UpgradePlanModal';
import { ageToAgeGroup, getPreferredAvatarIds } from '@/lib/child-profile-defaults';
import { useStoryAgentFlow, ActiveAgentStack } from '../../agents';
import { cn } from '@/lib/utils';
import {
  TaleaActionButton,
  TaleaPageBackground,
  taleaBodyFont,
  taleaDisplayFont,
  taleaPageShellClass,
} from '@/components/talea/TaleaPastelPrimitives';

import Step1AvatarSelection from './wizard-steps/Step1AvatarSelection';
import type { BroughtArtifactSelection } from './wizard-steps/ArtifactCompanionPicker';
import Step2CategorySelection from './wizard-steps/Step2CategorySelection';
import StepCharacterSeries, { type CharacterSeriesChoice, type CharacterSeriesSelection } from './wizard-steps/StepCharacterSeries';
import StepStoryShape from './wizard-steps/StepStoryShape';
import StepExtras from './wizard-steps/StepExtras';
import { DEFAULT_LEARNING_MODE, type LearningModeValue } from './wizard-steps/LearningModeSection';
import StepReady from './wizard-steps/StepReady';
import StepEngineMode from './wizard-steps/StepEngineMode';
import StepBookFormat, { readStoredHeroRelation, type ExperienceForm } from './wizard-steps/StepBookFormat';
import { StoryWizardIcon, type StoryWizardIconName } from './wizard-steps/StoryWizardIcon';
import { followChapterBook, type BookWaitStep } from './chapterBookProgress';
import { WizardStepBar } from './wizard-steps/wizardChoices';
import {
  createStoryGenerationId,
  generateStoryWithModelFallback,
  recoverGeneratedStoryAfterFailure,
  shouldAttemptStoryGenerationRecovery,
} from './storyGenerateWithModelFallback';
import {
  DEFAULT_OPENROUTER_STORY_MODEL,
  type AIModel,
  type AIProvider,
  type OpenRouterStoryModel,
} from '@/types/story';

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
  learningMode: LearningModeValue;
  aiModel: AIModel;
  aiProvider: AIProvider;
  openRouterModel: OpenRouterStoryModel;
  developerMode: boolean;
  storybookMode: boolean;
  bookWorkshopMode: boolean;
  wonderStoryMode: boolean;
  /** Talea-Folge (talea-folge-v1): the Talea Originals' method for the family's own heroes. */
  episodeMode: boolean;
  /** null: a standalone story; auto or an ID: a personal character series. */
  characterSeries: CharacterSeriesSelection;
  /** Admin-only test override for the character series episode number (1..20). */
  characterSeriesEpisodeOverride: number | null;
  /** Chapter book (chapter-book-v1): a volume read over several evenings. */
  chapterBookMode: boolean;
  experienceForm: ExperienceForm | null;
  bookChapters: number;
  bookImagesPerChapter: number;
  /** How the heroes belong together ("Geschwister", "Freunde"); the story names it only when set. */
  heroRelation: string | null;
  /** Schatzkammer: owned artifact taken along into this story (Mitnehmen-Loop). */
  broughtArtifact: BroughtArtifactSelection | null;
}

// A story from one long request shows 'profiles' -> 'memories' -> 'text' -> 'complete'; a chapter book shows
// 'plan' -> 'chapter' -> 'complete' from the real stage of its job (see chapterBookProgress.ts). Nothing is
// played back on a timer after the work is done.
type GenerationStep = 'profiles' | 'memories' | 'text' | BookWaitStep | 'complete';

// Four quick picture choices (who, world, length + mood, extras) and the start page.
// Age comes from the child profile and is changed on the last page; learning, the
// treasure and the own wish are folded into "extras" because they are optional.
type StepKey = 'mode' | 'avatars' | 'category' | 'book' | 'shape' | 'extras' | 'ready';

const STEP_ICONS: Record<StepKey, StoryWizardIconName> = {
  mode: 'sliders',
  avatars: 'people',
  category: 'globe',
  book: 'books3',
  shape: 'smile',
  extras: 'shootingStar',
  ready: 'sparkles',
};

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

interface GenerationStepInfo {
  key: GenerationStep;
  icon: StoryWizardIconName;
  label: string;
  description: string;
}

const SINGLE_STEPS: GenerationStepInfo[] = [
  { key: 'profiles', icon: 'people', label: 'Figuren vorbereiten', description: 'Talea schaut sich deine Figuren genau an.' },
  { key: 'memories', icon: 'openBook', label: 'Erinnerungen sammeln', description: 'Was haben deine Figuren schon erlebt?' },
  { key: 'text', icon: 'pencil', label: 'Geschichte schreiben', description: 'Text und Bilder entstehen gerade – das dauert ein paar Minuten.' },
  { key: 'complete', icon: 'sparkles', label: 'Fertig!', description: 'Alles gespeichert – viel Spaß beim Lesen!' },
];

const BOOK_STEPS: GenerationStepInfo[] = [
  { key: 'plan', icon: 'compass', label: 'Idee, Figuren und Plan', description: 'Eine Idee wird gewählt, passende Figuren werden gesucht und das ganze Buch wird geplant.' },
  { key: 'chapter', icon: 'pencil', label: 'Das erste Kapitel', description: 'Text und Bilder entstehen gerade.' },
  { key: 'complete', icon: 'sparkles', label: 'Die ersten Kapitel sind da!', description: 'Los geht’s – der Rest entsteht, während ihr lest.' },
];

const WizardBackground: React.FC<{ isDark: boolean }> = ({ isDark }) => <TaleaPageBackground isDark={isDark} />;

const GenerationProgress: React.FC<{
  steps: GenerationStepInfo[];
  currentStep: GenerationStep;
  palette: Palette;
  /** A book keeps writing in the background; the child may leave while it does. */
  onLeave?: () => void;
}> = ({ steps, currentStep, palette, onLeave }) => {
  const currentIndex = Math.max(0, steps.findIndex((step) => step.key === currentStep));
  const isBook = Boolean(onLeave);
  const lastIndex = steps.length - 1;

  return (
    <div className="relative flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-3xl border p-6 md:p-7" style={{ background: palette.panel, borderColor: palette.panelBorder }}>
        <div className="mb-5 flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: palette.soft, color: 'var(--primary)' }}>
            <StoryWizardIcon name={isBook ? 'books3' : 'openBook'} className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-3xl leading-none" style={{ fontFamily: headingFont, color: palette.text }}>
              {isBook ? 'Dein Buch entsteht' : 'Deine Geschichte wird gezaubert'}
            </h2>
            <p className="mt-1 text-xs" style={{ color: palette.muted }}>
              {isBook ? 'Das erste Kapitel ist in etwa 5 bis 10 Minuten da.' : 'Das dauert einen Moment.'}
            </p>
          </div>
        </div>

        <ol className="space-y-3" aria-label="Das passiert gerade">
          {steps.map((step, index) => {
            const isActive = index === currentIndex && index !== lastIndex;
            const isDone = index < currentIndex || (index === lastIndex && currentIndex === lastIndex);

            return (
              <li
                key={step.key}
                aria-current={isActive ? 'step' : undefined}
                className="flex items-center gap-3 rounded-2xl border px-3 py-3 transition-colors"
                style={{
                  borderColor: isActive ? 'var(--primary)' : palette.panelBorder,
                  background: isActive ? palette.soft : palette.secondary,
                  opacity: !isActive && !isDone ? 0.7 : 1,
                }}
              >
                <div
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: isDone ? 'var(--talea-success-soft)' : isActive ? 'var(--talea-accent-terracotta-soft)' : palette.soft,
                    color: isDone ? 'var(--talea-success)' : isActive ? 'var(--primary)' : palette.muted,
                  }}
                >
                  <StoryWizardIcon name={step.icon} className="h-8 w-8" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold" style={{ color: palette.text }}>
                    {step.label}
                  </p>
                  <p className="text-xs" style={{ color: palette.muted }}>
                    {step.description}
                  </p>
                </div>

                <div className="flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden>
                  {isDone ? (
                    <Check className="h-5 w-5" strokeWidth={3} style={{ color: 'var(--talea-success)' }} />
                  ) : isActive ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}>
                      <Loader2 className="h-5 w-5" style={{ color: 'var(--primary)' }} />
                    </motion.div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>

        {/* Half a step for the one that is running: the bar never claims more than is known. */}
        <div className="mt-5 h-2 w-full overflow-hidden rounded-full" style={{ background: palette.soft }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'var(--primary)' }}
            animate={{ width: `${((currentIndex + (currentIndex === lastIndex ? 1 : 0.5)) / steps.length) * 100}%` }}
            transition={{ duration: 0.35 }}
          />
        </div>

        {onLeave && (
          <div className="mt-5 space-y-3 text-center">
            <p className="text-[13px]" style={{ color: palette.muted }}>
              Du musst nicht warten: Das Buch erscheint in deiner Bibliothek, sobald die ersten Kapitel fertig sind.
            </p>
            <TaleaActionButton type="button" variant="secondary" onClick={onLeave} className="w-full">
              In die Bibliothek
            </TaleaActionButton>
          </div>
        )}
      </div>
    </div>
  );
};

export default function TaleaStoryWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const backend = useBackend();
  const { userId, getToken } = useAuth();
  const childProfiles = useOptionalChildProfiles();
  const { isAdmin } = useOptionalUserAccess();
  const activeProfileId = childProfiles?.activeProfileId;
  const activeProfile = childProfiles?.activeProfile ?? null;
  const { t, i18n } = useTranslation();
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';
  const palette = useMemo(() => getPalette(isDark), [isDark]);

  // The "Modus" step (Normal vs. Developer pipeline) and the raw AI-model
  // picker are internal engineering controls: they expose pipeline internals,
  // vendor names and per-token purchase prices. Customers only ever see the
  // product steps; admins keep the full instrument panel.
  const showEngineControls = isAdmin === true;


  const VALID_CATEGORIES = ['fairy-tales', 'adventure', 'magic', 'animals', 'scifi', 'modern'] as const;
  const tagParam = searchParams.get('tags');
  const mapAvatarId = searchParams.get('mapAvatarId');
  // Deep link from the Schatzkammer: "In eine neue Geschichte mitnehmen".
  const bringArtifactId = searchParams.get('bringArtifact');
  const bringAvatarId = searchParams.get('bringAvatar');

  const tagList = tagParam ? tagParam.split(',').map(s => s.trim()) : [];
  const initialCategory = VALID_CATEGORIES.find(c => tagList.includes(c as any)) as WizardState['mainCategory'] || null;
  const isMapAutoFill = Boolean(mapAvatarId && tagParam);
  const customTags = tagList.filter(t => !VALID_CATEGORIES.includes(t as any)).join(', ');

  const [activeStep, setActiveStep] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<GenerationStep>('profiles');
  const { onPhaseChange, onStoryReady } = useStoryAgentFlow();
  const [userLanguage, setUserLanguage] = useState<string>('de');
  const [storyCredits, setStoryCredits] = useState<StoryCredits | null>(null);
  const [billingPermissions, setBillingPermissions] = useState<BillingPermissions | null>(null);
  const [dailyStoryCredits, setDailyStoryCredits] = useState<StoryCredits | null>(null);
  const [lootArtifact, setLootArtifact] = useState<InventoryItem | null>(null);
  const [showLootModal, setShowLootModal] = useState(false);
  const [pendingStoryId, setPendingStoryId] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState(
    'Du hast gerade keine Geschichten-Münzen mehr. Frag deine Eltern, ob sie den Plan wechseln möchten.'
  );

  const [state, setState] = useState<WizardState>({
    selectedAvatars: mapAvatarId ? [mapAvatarId] : bringAvatarId ? [bringAvatarId] : [],
    mainCategory: initialCategory || (isMapAutoFill ? 'adventure' : null),
    subCategory: null,
    ageGroup: isMapAutoFill ? '6-8' : null,
    // A sensible default is one decision less; the child can still change it.
    length: 'medium',
    feelings: isMapAutoFill ? ['exciting'] : [],
    rhymes: false,
    moral: false,
    avatarIsHero: true,
    famousCharacters: false,
    happyEnd: true,
    surpriseEnd: false,
    customWish: customTags ? `Thema: ${customTags}` : '',
    learningMode: DEFAULT_LEARNING_MODE,
    aiModel: 'gemini-3.1-pro-preview',
    // Release default: OpenRouter + Kimi K2.6 — best measured story
    // quality/cost writer (run a75b53af: $0.010 writer cost, 997 words,
    // 30.7% dialogue vs gpt-mini runs at ~25% with missing sacrifices).
    // The picker in Step 3 still lets the user change this freely.
    aiProvider: 'openrouter',
    openRouterModel: DEFAULT_OPENROUTER_STORY_MODEL,
    developerMode: false,
    storybookMode: false,
    bookWorkshopMode: false,
    wonderStoryMode: false,
    episodeMode: false,
    characterSeries: null,
    characterSeriesEpisodeOverride: null,
    chapterBookMode: false,
    experienceForm: null,
    bookChapters: 12,
    bookImagesPerChapter: 2,
    heroRelation: readStoredHeroRelation(),
    broughtArtifact: null,
  });
  const stepKeys = useMemo(
    () =>
      [
        ...(showEngineControls ? (['mode'] as const) : []),
        'avatars',
        'category',
        ...(state.chapterBookMode ? (['book'] as const) : []),
        'shape',
        'extras',
        'ready',
      ] as StepKey[],
    [showEngineControls, state.chapterBookMode]
  );

  const stepLabels: Record<StepKey, string> = {
    mode: 'Art',
    avatars: t('wizard.steps.avatars'),
    category: t('wizard.steps.category'),
    book: 'Buch',
    shape: t('wizard.steps.shape'),
    extras: t('wizard.steps.extras'),
    ready: t('wizard.steps.summary'),
  };

  const labels = stepKeys.map((key) => stepLabels[key]);
  const stepBarItems = stepKeys.map((key) => ({ id: key, label: stepLabels[key], icon: STEP_ICONS[key] }));
  const goToStep = (key: StepKey) => {
    const index = stepKeys.indexOf(key);
    if (index >= 0) setActiveStep(index);
  };

  const lastAppliedProfileRef = React.useRef<string | null>(null);
  const bringDeepLinkAppliedRef = React.useRef(false);

  const [characterSeries, setCharacterSeries] = useState<CharacterSeriesChoice[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [seriesRetry, setSeriesRetry] = useState(0);
  const [seriesOpen, setSeriesOpen] = useState(false);

  useEffect(() => {
    if (state.characterSeries !== null) setSeriesOpen(true);
  }, [state.characterSeries]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const controller = new AbortController();
    setSeriesLoading(true);
    setSeriesError(null);
    setCharacterSeries([]);
    (async () => {
      try {
        const result = await fetchCharacterSeries(getToken, activeProfileId, controller.signal);
        if (active) setCharacterSeries(result);
      } catch (error) {
        if (active) {
          console.warn('[StoryWizard] Character series could not be loaded:', error);
          setSeriesError('Die Figurenwelten konnten gerade nicht geladen werden.');
        }
      } finally {
        if (active) setSeriesLoading(false);
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [getToken, activeProfileId, userId, seriesRetry]);

  // Resolve the Schatzkammer deep link ("mitnehmen") into a full selection.
  useEffect(() => {
    if (!bringArtifactId || !bringAvatarId || bringDeepLinkAppliedRef.current) return;
    bringDeepLinkAppliedRef.current = true;
    (async () => {
      try {
        const result = await backend.story.bringableArtifacts({ avatarIds: [bringAvatarId] });
        const match = (result?.artifacts || []).find((entry: any) => entry.artifactId === bringArtifactId);
        if (match) {
          setState((prev) => ({
            ...prev,
            selectedAvatars: prev.selectedAvatars.includes(bringAvatarId)
              ? prev.selectedAvatars
              : [...prev.selectedAvatars, bringAvatarId],
            broughtArtifact: {
              artifactId: match.artifactId,
              avatarId: match.avatarId,
              avatarName: match.avatarName,
              name: match.name,
              emoji: match.emoji,
              imageUrl: match.imageUrl,
              level: match.level,
              journeys: match.journeys,
              journeysUntilNextLevel: match.journeysUntilNextLevel,
              nextLevel: match.nextLevel,
            },
          }));
        }
      } catch (err) {
        console.warn('[StoryWizard] Failed to resolve brought artifact deep link:', err);
      }
    })();
  }, [backend, bringArtifactId, bringAvatarId]);

  useEffect(() => {
    if (i18n.language) setUserLanguage(i18n.language);
  }, [i18n.language]);

  // The step list depends on the admin flag, which resolves asynchronously.
  // Jump the map deep link straight to the summary and never leave the user
  // stranded on an index that no longer exists once the flag arrives.
  const mapAutoFillAppliedRef = React.useRef(false);
  useEffect(() => {
    if (isMapAutoFill && !mapAutoFillAppliedRef.current) {
      mapAutoFillAppliedRef.current = true;
      setActiveStep(stepKeys.length - 1);
      return;
    }
    setActiveStep((prev) => Math.min(prev, stepKeys.length - 1));
  }, [isMapAutoFill, stepKeys.length]);

  useEffect(() => {
    if (!activeProfile || isMapAutoFill || lastAppliedProfileRef.current === activeProfile.id) {
      return;
    }

    lastAppliedProfileRef.current = activeProfile.id;
    const defaultAgeGroup = ageToAgeGroup(activeProfile.age);
    const defaultAvatarIds = getPreferredAvatarIds(activeProfile).slice(0, 1);

    setState((prev) => ({
      ...prev,
      ageGroup: defaultAgeGroup || prev.ageGroup,
      selectedAvatars: defaultAvatarIds.length > 0 ? defaultAvatarIds : prev.selectedAvatars,
    }));
  }, [activeProfile, isMapAutoFill]);

  const refreshCredits = useCallback(
    async (isActive: () => boolean = () => true) => {
      if (!userId) return;
      try {
        const profile = await backend.user.me();
        if (!isActive()) return;
        setStoryCredits((profile as any).billing?.storyCredits ?? null);
        setDailyStoryCredits((profile as any).billing?.dailyStoryCredits ?? null);
        setBillingPermissions((profile as any).billing?.permissions ?? null);
      } catch (error) {
        console.error('[StoryWizard] Failed to load story credits:', error);
      }
    },
    [backend, userId]
  );

  useEffect(() => {
    let active = true;
    void refreshCredits(() => active);
    return () => {
      active = false;
    };
  }, [refreshCredits]);

  // A chapter book is followed for minutes: leaving the page ends the wait, it never opens a book behind the user's back.
  const stopWaitingRef = React.useRef(false);
  useEffect(() => {
    return () => {
      stopWaitingRef.current = true;
    };
  }, []);

  const leaveToLibrary = () => {
    stopWaitingRef.current = true;
    onStoryReady();
    navigate('/stories');
  };

  const updateState = (updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  /** Admin test tool: the series starts again at episode 1 for the active profile. */
  const handleSeriesReset = async (seriesId: string) => {
    const result = await resetCharacterSeries(getToken, seriesId, activeProfileId);
    updateState({ characterSeriesEpisodeOverride: null });
    setSeriesRetry((n) => n + 1);
    return result.resetEpisodes;
  };

  const handleNext = () => {
    if (activeStep < labels.length - 1) setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    if (activeStep > 0) setActiveStep((prev) => prev - 1);
  };

  const selectedSeriesGenre = state.mainCategory === 'fairy-tales' ? 'fairy_tales' : state.mainCategory;
  const hasMatchingSeries = Boolean(selectedSeriesGenre && characterSeries.some((series) => series.genres?.includes(selectedSeriesGenre)));

  /** Why "Weiter" is blocked — shown to the user instead of a dead button. */
  const blockedReason = (): string | null => {
    switch (stepKeys[activeStep]) {
      case 'avatars':
        return state.selectedAvatars.length > 0 ? null : 'Wähle mindestens einen Avatar aus.';
      case 'category':
        if (state.mainCategory === null) return 'Wähle eine Welt aus.';
        if (state.characterSeries !== null && (seriesLoading || seriesError || characterSeries.length === 0)) return 'Die Figurenwelten sind gerade nicht verfügbar. Versuche es erneut oder wähle eine neue Geschichte.';
        if (state.characterSeries === 'auto' && !hasMatchingSeries) return 'Für diese Welt gibt es noch keinen passenden Vorschlag. Wähle eine Figur selbst aus.';
        if (state.characterSeries !== null && state.characterSeries !== 'auto' && !characterSeries.some((series) => series.id === state.characterSeries)) return 'Wähle eine verfügbare Figur aus.';
        return null;
      case 'book':
        return state.experienceForm ? null : 'Wähle aus, was für ein Buch es werden soll.';
      case 'shape':
        if (state.length === null && !state.chapterBookMode) return 'Wähle noch eine Länge aus.';
        return state.feelings.length > 0 ? null : 'Wähle mindestens ein Gefühl aus.';
      case 'extras':
        return state.learningMode.enabled && state.learningMode.subjects.length === 0
          ? 'Wähle mindestens ein Fach aus — oder schalte den Lernmodus wieder aus.'
          : null;
      default:
        return null;
    }
  };

  const canProceed = () => blockedReason() === null;

  const openGeneratedStory = (story: any) => {
    const newArtifact = story.newArtifact || story.metadata?.newArtifact;
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
  };

  const handleGenerate = async () => {
    if (!userId) {
      alert(t('story.wizard.alerts.loginRequired'));
      return;
    }

    if (state.characterSeries !== null && (seriesLoading || seriesError || characterSeries.length === 0 || (state.characterSeries === 'auto' && !hasMatchingSeries) || (state.characterSeries !== 'auto' && !characterSeries.some((series) => series.id === state.characterSeries)))) {
      setSeriesOpen(true);
      goToStep('category');
      return;
    }

    if (storyCredits && storyCredits.remaining !== null && storyCredits.remaining <= 0) {
      if (billingPermissions && !billingPermissions.freeTrialActive && storyCredits.limit !== null && storyCredits.limit <= 1) {
        setUpgradeMessage('Deine kostenlose Geschichte für diesen Monat ist schon erstellt. Frag deine Eltern, ob sie einen Plan aussuchen möchten.');
      } else {
        setUpgradeMessage('Deine Story-Münzen für diesen Monat sind aufgebraucht. Frag deine Eltern!');
      }
      setShowUpgradeModal(true);
      return;
    }

    if (dailyStoryCredits && dailyStoryCredits.remaining !== null && dailyStoryCredits.remaining <= 0) {
      setUpgradeMessage('Für heute sind alle Geschichten erstellt. Morgen geht es weiter!');
      setShowUpgradeModal(true);
      return;
    }

    const storyId = createStoryGenerationId();
    const isBook = state.chapterBookMode;
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    try {
      setGenerating(true);
      stopWaitingRef.current = false;
      if (isBook) {
        // The call below only queues the job; the first step is already running.
        setGenerationStep('plan');
        onPhaseChange('text');
      } else {
        setGenerationStep('profiles');
        onPhaseChange('profiles');
        setGenerationStep('text');
        onPhaseChange('text');
      }

      const storyConfig = mapWizardStateToAPI(state, userLanguage);
      const story = await generateStoryWithModelFallback(backend.story.generate, {
        storyId,
        userId,
        config: storyConfig,
        profileId: activeProfileId || undefined,
      } as any);

      const spendOne = (prev: StoryCredits | null) =>
        prev
          ? {
            ...prev,
            used: prev.used + 1,
            remaining: prev.remaining === null ? null : Math.max(0, prev.remaining - 1),
          }
          : prev;
      setStoryCredits(spendOne);
      setDailyStoryCredits(spendOne);

      if (isBook) {
        // Minutes of real work follow. Show the job's own stage and open the book when its first chapters exist.
        const outcome = await followChapterBook(
          {
            bookStatus: (request) => backend.story.bookStatus(request),
            getStory: (request) => backend.story.get(request),
            sleep: wait,
          },
          storyId,
          { onStep: setGenerationStep, shouldStop: () => stopWaitingRef.current }
        );
        if (stopWaitingRef.current || outcome.kind === 'stopped') return;
        if (outcome.kind === 'failed') {
          await refreshCredits();
          alert('Dein Buch konnte leider nicht geschrieben werden. Deine Münze bekommst du zurück.');
          return;
        }
        setGenerationStep('complete');
        onPhaseChange('complete');
        await wait(800);
        if (stopWaitingRef.current) return;
        openGeneratedStory(outcome.story);
        return;
      }

      // The request returned: the story is written, checked and illustrated.
      setGenerationStep('complete');
      onPhaseChange('complete');
      await wait(800);

      openGeneratedStory(story);
    } catch (error) {
      console.error('[StoryWizard] Error:', error);
      if (shouldAttemptStoryGenerationRecovery(error)) {
        const recoveredStory = await recoverGeneratedStoryAfterFailure(
          backend.story,
          storyId,
          activeProfileId || undefined,
          { maxWaitMs: state.wonderStoryMode || state.episodeMode || state.characterSeries !== null ? 15 * 60_000 : undefined, shouldStop: () => stopWaitingRef.current }
        );
        if (stopWaitingRef.current) return;
        if (recoveredStory) {
          setGenerationStep('complete');
          onPhaseChange('complete');
          openGeneratedStory(recoveredStory);
          return;
        }
      }

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
      ? billingPermissions && !billingPermissions.freeTrialActive && storyCredits?.limit !== null && (storyCredits?.limit ?? 0) <= 1
        ? 'Kostenlose Geschichte für diesen Monat schon erstellt - frag deine Eltern!'
        : 'Story-Münzen für diesen Monat aufgebraucht.'
      : undefined;

    switch (stepKeys[activeStep]) {
      case 'mode':
        return <StepEngineMode state={state} updateState={updateState} />;
      case 'avatars':
        return <Step1AvatarSelection state={state} updateState={updateState} />;
      case 'category':
        return (
          <div className="space-y-6">
            <Step2CategorySelection state={state} updateState={updateState} />
            <section className="rounded-[1.375rem] border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] p-4 sm:p-5">
              <button type="button" aria-expanded={seriesOpen} onClick={() => setSeriesOpen((open) => !open)} className="flex min-h-11 w-full items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--talea-surface-inset)] text-[var(--primary)]"><BookOpen aria-hidden className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1"><span className="block font-semibold text-[var(--talea-text-primary)]">Figurenabenteuer entdecken</span><span className="block text-sm text-[var(--talea-text-secondary)]">Wiederkehrende Figuren und eure eigenen Folgen</span></span>
                <span aria-hidden className="text-xl text-[var(--primary)]">{seriesOpen ? '−' : '+'}</span>
              </button>
              {seriesOpen && <div className="mt-5"><StepCharacterSeries selection={state.characterSeries} onSelect={(selection) => updateState({ characterSeries: selection, ...(selection === null ? { characterSeriesEpisodeOverride: null } : {}), ...(selection !== null ? { developerMode: false, storybookMode: false, bookWorkshopMode: false, wonderStoryMode: false, episodeMode: false, chapterBookMode: false } : {}) })} series={characterSeries} loading={seriesLoading} error={seriesError} onRetry={() => setSeriesRetry((n) => n + 1)} genre={state.mainCategory} isAdmin={isAdmin === true} episodeOverride={state.characterSeriesEpisodeOverride} onEpisodeOverrideChange={(ep) => updateState({ characterSeriesEpisodeOverride: ep })} onResetProgress={isAdmin === true ? handleSeriesReset : undefined} /></div>}
            </section>
          </div>
        );
      case 'book':
        return <StepBookFormat state={state} updateState={updateState} />;
      case 'shape':
        return <StepStoryShape state={state} updateState={updateState} hideLength={state.chapterBookMode} />;
      case 'extras':
        return <StepExtras state={state} updateState={updateState} />;
      case 'ready':
        return (
          <StepReady
            state={state}
            characterSeriesLabel={state.characterSeries === 'auto' ? 'Überrasch mich' : characterSeries.find((series) => series.id === state.characterSeries)?.title}
            updateState={updateState}
            onEdit={goToStep}
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
          <GenerationProgress
            steps={state.chapterBookMode ? BOOK_STEPS : SINGLE_STEPS}
            currentStep={generationStep}
            palette={palette}
            onLeave={state.chapterBookMode ? leaveToLibrary : undefined}
          />
        </div>
        <div className="relative z-10 mx-auto mt-4 max-w-xl px-4">
          <ActiveAgentStack />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-10 pt-1" style={{ fontFamily: bodyFont }}>
      <WizardBackground isDark={isDark} />

      {/* One narrow column: big picture tiles stay together instead of spreading over a wide screen. */}
      <div className={cn(taleaPageShellClass, 'relative z-10 max-w-3xl')}>
        {/* iOS flow: back link, large title, progress — then the step on the page itself. */}
        <motion.header initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="px-1">
          <button
            type="button"
            onClick={() => navigate('/stories')}
            className="-ml-1 inline-flex items-center gap-0.5 rounded-lg py-1 pr-2 text-[17px] text-[var(--primary)] hover:opacity-75"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
            Bibliothek
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-[2rem] font-bold leading-tight text-[var(--talea-text-primary)] md:text-[2.5rem]" style={{ fontFamily: headingFont }}>
              Neue Geschichte
            </h1>
            {state.developerMode && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-[12px] font-semibold text-amber-700 dark:text-amber-300">
                <FlaskConical className="h-3.5 w-3.5" /> Dev Mode
              </span>
            )}
            {(state.storybookMode || state.bookWorkshopMode || state.chapterBookMode || state.wonderStoryMode || state.episodeMode) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
                <BookOpen className="h-3.5 w-3.5" /> {state.episodeMode ? 'Talea-Folge' : state.wonderStoryMode ? 'Wunder & Witz' : state.chapterBookMode ? 'Kapitelbuch' : state.bookWorkshopMode ? 'Buchwerkstatt' : 'Bilderbuch'}
              </span>
            )}
          </div>
          <div className="mt-5">
            <WizardStepBar steps={stepBarItems} activeIndex={activeStep} onSelect={setActiveStep} />
          </div>
        </motion.header>

        <div className="mt-6">
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
        </div>

        {/* Sticky action bar: "Weiter" is always reachable, above the tab bar on phones. */}
        {/* The last page has its own big button; a floating bar holding only "Zurück" would cover it. */}
        <div
          className={cn(
            'z-30 mt-6',
            activeStep < labels.length - 1 &&
              'sticky bottom-[calc(max(env(safe-area-inset-bottom),0.75rem)+70px+var(--talea-player-offset,0px))] md:bottom-4'
          )}
        >
          {/* On a phone the reason sits above the bar, so a grey "Weiter" never goes unexplained. */}
          {activeStep < labels.length - 1 && blockedReason() && (
            <p className="mx-auto mb-1.5 w-fit max-w-full rounded-full bg-[var(--talea-glass-bg)] px-3 py-1 text-center text-[13px] font-medium text-[var(--talea-text-secondary)] backdrop-blur-xl sm:hidden">
              {blockedReason()}
            </p>
          )}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--talea-border-light)] bg-[var(--talea-glass-bg)] p-2 shadow-[var(--talea-shadow-strong)] backdrop-blur-xl backdrop-saturate-150">
            <TaleaActionButton
              type="button"
              variant="ghost"
              onClick={activeStep === 0 ? () => navigate('/stories') : handleBack}
              icon={<ArrowLeft className="h-4 w-4" />}
            >
              Zurück
            </TaleaActionButton>

            {activeStep < labels.length - 1 && (
              <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
                {blockedReason() && (
                  <p className="hidden min-w-0 truncate text-right text-[13px] text-[var(--talea-text-secondary)] sm:block">
                    {blockedReason()}
                  </p>
                )}
                <TaleaActionButton type="button" onClick={handleNext} disabled={!canProceed()} className="min-w-[8.5rem]">
                  Weiter
                  <ArrowRight className="ml-1.5 inline-block h-4 w-4 align-[-3px]" strokeWidth={2.6} aria-hidden />
                </TaleaActionButton>
              </div>
            )}
          </div>
        </div>
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

  // `tone` can only ever carry ONE feeling. The wizard lets the child pick up
  // to three, so the full selection is forwarded as emotionalFlavors — the
  // engine blends all of them into humor/suspense/pacing and the style block.
  const flavorMap: Record<string, string> = {
    funny: 'lachfreude',
    warm: 'warmherzigkeit',
    exciting: 'prickeln',
    crazy: 'uebermut',
    meaningful: 'zusammenhalt',
  };
  const emotionalFlavors = state.feelings.map((feeling) => flavorMap[feeling]).filter(Boolean);

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
    emotionalFlavors,
    pacing: (state.feelings.includes('exciting') ? 'fast' : 'balanced') as 'fast' | 'balanced' | 'slow',
    allowRhymes: state.rhymes,
    hasTwist: state.surpriseEnd,
    // Step "Besondere Wünsche" — every toggle the wizard shows and the summary
    // confirms back to the child has to reach the prompt.
    requireMoral: state.moral,
    avatarIsHero: state.avatarIsHero,
    allowFamousCharacters: state.famousCharacters,
    requireHappyEnd: state.happyEnd,
    // Only send a learning mode the user actually configured — an enabled mode
    // without subjects would produce an empty guidance block in the prompt.
    learningMode:
      state.learningMode.enabled && state.learningMode.subjects.length > 0
        ? {
            enabled: true,
            subjects: state.learningMode.subjects,
            difficulty: state.learningMode.difficulty,
            learningObjectives: state.learningMode.learningObjectives,
            assessmentType: state.learningMode.assessmentType,
          }
        : undefined,
    customPrompt: state.customWish || undefined,
    language: userLanguage as 'de' | 'en' | 'fr' | 'es' | 'it' | 'nl' | 'ru',
    aiModel: state.aiModel,
    aiProvider: state.aiProvider,
    openRouterModel: state.aiProvider === 'openrouter' ? state.openRouterModel : undefined,
    preferences: {
      useFairyTaleTemplate: state.mainCategory === 'fairy-tales' || state.mainCategory === 'magic',
    },
    developerMode: state.developerMode || undefined,
    storybookMode: state.characterSeries !== null || state.storybookMode || state.bookWorkshopMode || state.chapterBookMode || state.wonderStoryMode || state.episodeMode || undefined,
    storybookEngine: state.characterSeries !== null ? 'character-series-v1' : state.episodeMode ? 'talea-folge-v1' : state.wonderStoryMode ? 'wonder-story-v1' : state.chapterBookMode ? 'chapter-book-v1' : state.bookWorkshopMode ? 'book-workshop-v1' : state.storybookMode ? 'storybook-v2' : undefined,
    characterSeriesId: state.characterSeries && state.characterSeries !== 'auto' ? state.characterSeries : undefined,
    characterSeriesEpisodeOverride: state.characterSeries !== null && state.characterSeriesEpisodeOverride ? state.characterSeriesEpisodeOverride : undefined,
    ...(state.chapterBookMode
      ? { bookChapters: state.bookChapters, bookImagesPerChapter: state.bookImagesPerChapter, experienceForm: state.experienceForm || undefined, heroRelation: state.selectedAvatars.length > 1 ? state.heroRelation || undefined : undefined, length: 'long' }
      : {}),
    broughtArtifact:
      state.broughtArtifact && state.selectedAvatars.includes(state.broughtArtifact.avatarId)
        ? {
            artifactId: state.broughtArtifact.artifactId,
            avatarId: state.broughtArtifact.avatarId,
          }
        : undefined,
  } as any;
}
