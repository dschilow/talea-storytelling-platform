import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';

import { useBackend } from '../../hooks/useBackend';
import { useTheme } from '../../contexts/ThemeContext';
import { useOptionalChildProfiles } from '../../contexts/ChildProfilesContext';
import UpgradePlanModal from '../../components/subscription/UpgradePlanModal';
import { SuggestionGrid } from '../Cosmos/SuggestionGrid';
import { useTopicSuggestions } from '../Cosmos/useTopicSuggestions';
import { fetchCosmosState, type TopicSuggestionItemDTO } from '../Cosmos/apiCosmosClient';
import { resolveCosmosDomains } from '../Cosmos/CosmosAssetsRegistry';
import { ageToAgeGroup } from '@/lib/child-profile-defaults';
import { cn } from '@/lib/utils';
import {
  TaleaActionButton,
  TaleaPageBackground,
  TaleaProgressSteps,
  taleaBodyFont,
  taleaDisplayFont,
  taleaInputClass,
  taleaPageShellClass,
} from '@/components/talea/TaleaPastelPrimitives';

type DokuApiLanguage = 'de' | 'en' | 'fr' | 'es' | 'it' | 'nl';
type DokuPerspective = 'science' | 'history' | 'technology' | 'nature' | 'culture';

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
  perspective: DokuPerspective;
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

const wizardSteps = [
  { id: 'topic', label: 'Thema' },
  { id: 'audience', label: 'Alter' },
  { id: 'voice', label: 'Stil' },
  { id: 'content', label: 'Inhalt' },
  { id: 'summary', label: 'Fertig' },
];

interface DomainDokuPreset {
  id: string;
  label: string;
  description: string;
  perspective: DokuPerspective;
  topics: string[];
  emoji: string;
  isExtra?: boolean;
}

const CORE_DOMAIN_PRESETS: DomainDokuPreset[] = [
  {
    id: 'nature',
    label: 'Natur & Tiere',
    description: 'Tiere, Pflanzen und ihre Lebensräume entdecken.',
    perspective: 'nature',
    topics: ['Wie sprechen Tiere miteinander?', 'Wie bauen Ameisen ihre Stadt?', 'Warum wechseln Blätter die Farbe?'],
    emoji: '🌿',
  },
  {
    id: 'space',
    label: 'Weltraum',
    description: 'Planeten, Sterne und Rätsel im All.',
    perspective: 'science',
    topics: ['Unser Sonnensystem', 'Wie entstehen Sterne?', 'Warum hat der Mars rote Farbe?'],
    emoji: '🚀',
  },
  {
    id: 'history',
    label: 'Geschichte & Kulturen',
    description: 'Wie Menschen früher lebten und was sie gebaut haben.',
    perspective: 'history',
    topics: ['Das alte Ägypten', 'Wie lebten Kinder im Mittelalter?', 'Warum wurden Burgen gebaut?'],
    emoji: '🏛️',
  },
  {
    id: 'tech',
    label: 'Technik & Erfindungen',
    description: 'Maschinen, Roboter und coole Erfindungen.',
    perspective: 'technology',
    topics: ['Wie Roboter lernen', 'Wie funktioniert ein Mikrochip?', 'Wie kommt Strom ins Haus?'],
    emoji: '🤖',
  },
  {
    id: 'body',
    label: 'Mensch & Körper',
    description: 'Dein Körper, dein Gehirn und deine Sinne.',
    perspective: 'science',
    topics: ['Warum brauchen wir Schlaf?', 'Wie arbeitet das Gehirn?', 'Wie heilt eine Wunde?'],
    emoji: '🧠',
  },
  {
    id: 'earth',
    label: 'Erde & Klima',
    description: 'Wetter, Vulkane und Naturkräfte.',
    perspective: 'science',
    topics: ['Wie entstehen Wolken?', 'Warum gibt es Jahreszeiten?', 'Wie entsteht ein Vulkan?'],
    emoji: '🌍',
  },
  {
    id: 'arts',
    label: 'Kunst & Musik',
    description: 'Musik, Farben, Kreativität und Ausdruck.',
    perspective: 'culture',
    topics: ['Wie macht Musik Stimmung?', 'Warum harmonieren Farben?', 'Wie entsteht ein Comic?'],
    emoji: '🎨',
  },
  {
    id: 'logic',
    label: 'Logik & Rätsel',
    description: 'Knobeln, Muster erkennen und schlau denken.',
    perspective: 'science',
    topics: ['Wie plant man mehrere Schritte voraus?', 'Wie funktionieren Wenn-Dann-Regeln?', 'Wie löst man Knobelrätsel?'],
    emoji: '🧩',
  },
];

const EXTRA_DOMAIN_PRESETS: DomainDokuPreset[] = [
  {
    id: 'dinosaurs',
    label: 'Dinosaurier',
    description: 'Riesige Urzeitechsen und versteinerte Knochen.',
    perspective: 'science',
    topics: ['Warum starben Dinosaurier aus?', 'Wie entstehen Fossilien?', 'Wer war der T-Rex?'],
    emoji: '🦕',
    isExtra: true,
  },
  {
    id: 'oceans',
    label: 'Ozeane & Tiefsee',
    description: 'Geheimnisvolle Meere und seltsame Tiefsee-Wesen.',
    perspective: 'nature',
    topics: ['Was lebt in der Tiefsee?', 'Warum ist das Meer salzig?', 'Wie entstehen Wellen?'],
    emoji: '🌊',
    isExtra: true,
  },
  {
    id: 'myths',
    label: 'Mythen & Legenden',
    description: 'Drachen, Götter und spannende Sagen.',
    perspective: 'history',
    topics: ['Warum gibt es Drachen-Mythen?', 'Wer waren die Götter in Griechenland?', 'Wie entstehen Legenden?'],
    emoji: '🐉',
    isExtra: true,
  },
  {
    id: 'coding',
    label: 'Coding & Computer',
    description: 'Wie Computer denken und Programme funktionieren.',
    perspective: 'technology',
    topics: ['Was ist ein Algorithmus?', 'Wie lernen Computer Muster?', 'Wie denkt ein Computer?'],
    emoji: '💻',
    isExtra: true,
  },
  {
    id: 'chemistry',
    label: 'Chemie im Alltag',
    description: 'Coole Experimente und spannende Reaktionen.',
    perspective: 'science',
    topics: ['Warum rostet Eisen?', 'Wie funktioniert Seife?', 'Warum sprudelt eine Brausetablette?'],
    emoji: '🧪',
    isExtra: true,
  },
  {
    id: 'sports_science',
    label: 'Sport & Bewegung',
    description: 'Warum Bewegung so toll ist und wie Muskeln arbeiten.',
    perspective: 'science',
    topics: ['Warum wärmen wir uns auf?', 'Wie trainieren Muskeln?', 'Was macht Ausdauer aus?'],
    emoji: '⚽',
    isExtra: true,
  },
];

const DOMAIN_DOKU_PRESETS: Record<string, DomainDokuPreset> = Object.fromEntries(
  [...CORE_DOMAIN_PRESETS, ...EXTRA_DOMAIN_PRESETS].map((preset) => [preset.id, preset])
);

const PERSPECTIVE_DOMAIN_MAP: Record<DokuPerspective, string> = {
  science: 'space',
  history: 'history',
  technology: 'tech',
  nature: 'nature',
  culture: 'arts',
};

function normalizeSuggestionDomain(domainId: string | null | undefined): string | null {
  const value = String(domainId || '').trim().toLowerCase();
  if (!value) return null;
  const normalized = value === 'art' ? 'arts' : value;
  const safe = normalized
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_')
    .slice(0, 40);
  return safe || null;
}

function toDomainFromPerspective(perspective: DokuPerspective): string {
  return PERSPECTIVE_DOMAIN_MAP[perspective] ?? 'space';
}

function inferPerspectiveForDomain(domainId: string): DokuPerspective {
  if (DOMAIN_DOKU_PRESETS[domainId]?.perspective) return DOMAIN_DOKU_PRESETS[domainId].perspective;
  if (/history|myth|culture|roman|mittelalter|ancient/i.test(domainId)) return 'history';
  if (/nature|animal|ocean|forest|earth|climate/i.test(domainId)) return 'nature';
  if (/tech|robot|coding|ai|invent|machine/i.test(domainId)) return 'technology';
  if (/art|music|paint|creative|design/i.test(domainId)) return 'culture';
  return 'science';
}

const ageOptions = [
  { value: '3-5', label: '3-5 Jahre', desc: 'Ganz einfach erklärt', emoji: '🐣' },
  { value: '6-8', label: '6-8 Jahre', desc: 'Spielerisch und spannend', emoji: '🌱' },
  { value: '9-12', label: '9-12 Jahre', desc: 'Mit mehr Zusammenhängen', emoji: '🚀' },
  { value: '13+', label: '13+ Jahre', desc: 'Für Wissensprofis', emoji: '🎓' },
] as const;

const depthOptions = [
  { value: 'basic', label: 'Kurz erklärt', desc: 'Das Wichtigste auf einen Blick', emoji: '⚡' },
  { value: 'standard', label: 'Normal', desc: 'Gut erklärt mit Beispielen', emoji: '📖' },
  { value: 'deep', label: 'Alles genau wissen', desc: 'Für echte Entdecker', emoji: '🔬' },
] as const;

const perspectiveOptions = [
  { value: 'science', label: 'Wie ein Forscher', desc: 'Wie funktioniert das?', emoji: '🔬' },
  { value: 'history', label: 'Wie ein Zeitreisender', desc: 'Wie war das früher?', emoji: '⏳' },
  { value: 'technology', label: 'Wie ein Erfinder', desc: 'Wie wird es gebaut?', emoji: '⚙️' },
  { value: 'nature', label: 'Wie ein Entdecker', desc: 'Was lebt und wächst?', emoji: '🌿' },
  { value: 'culture', label: 'Wie ein Weltreisender', desc: 'Was bedeutet es?', emoji: '🌍' },
] as const;

const toneOptions = [
  { value: 'fun', label: 'Lustig', desc: 'Lernen mit Lachen', emoji: '😄' },
  { value: 'curious', label: 'Neugierig', desc: 'Wie ein Entdecker', emoji: '🔍' },
  { value: 'neutral', label: 'Ruhig und klar', desc: 'Einfach gut erklärt', emoji: '✨' },
] as const;

const lengthOptions = [
  { value: 'short', label: 'Kurz', desc: '3 Abschnitte', emoji: '📄' },
  { value: 'medium', label: 'Mittel', desc: '5 Abschnitte', emoji: '📰' },
  { value: 'long', label: 'Lang', desc: '7 Abschnitte', emoji: '📚' },
] as const;

const phaseLabels: Record<GenerationPhase, string> = {
  text: 'Deine Doku wird geschrieben',
  cover: 'Das Titelbild wird gemalt',
  sections: 'Bilder für die Kapitel entstehen',
  personality: 'Dein Avatar lernt etwas dazu!',
  complete: 'Fertig!',
};

const toPerspective = (candidate?: string | null): DokuPerspective | null => {
  const value = String(candidate || '').trim().toLowerCase();
  if (
    value === 'science' ||
    value === 'history' ||
    value === 'technology' ||
    value === 'nature' ||
    value === 'culture'
  ) {
    return value;
  }
  return null;
};

// ────────────────────────────────────────────────────────────────────────────────
// Choice Card — schöne, einheitliche Auswahlkachel mit Animation
// ────────────────────────────────────────────────────────────────────────────────
function Choice({
  selected,
  onClick,
  title,
  description,
  emoji,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
  emoji?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      className={cn(
        'group relative flex flex-col gap-1.5 rounded-2xl border p-4 text-left transition-colors',
        selected
          ? 'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_12%,var(--talea-surface-primary))] shadow-[0_8px_22px_rgba(123,168,156,0.18)]'
          : 'border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] hover:border-[var(--talea-border-soft)] hover:bg-[var(--talea-surface-inset)]'
      )}
    >
      {emoji && <span className="text-2xl leading-none">{emoji}</span>}
      <p
        className="text-sm font-semibold leading-tight"
        style={{ color: 'var(--talea-text-primary)' }}
      >
        {title}
      </p>
      <p className="text-xs leading-snug" style={{ color: 'var(--talea-text-muted)' }}>
        {description}
      </p>

      {selected && (
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          className="absolute right-2.5 top-2.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow"
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </motion.span>
      )}
    </motion.button>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Counter
// ────────────────────────────────────────────────────────────────────────────────
function Counter({
  value,
  onChange,
  min,
  max,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  label: string;
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--talea-text-muted)]">
        {label}
      </p>
      <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] p-1 shadow-sm">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--talea-text-primary)] transition-colors hover:bg-[var(--talea-surface-inset)] disabled:opacity-30"
          aria-label="Weniger"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span
          className="w-8 text-center text-base font-bold tabular-nums"
          style={{ color: 'var(--talea-text-primary)' }}
        >
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--talea-text-primary)] transition-colors hover:bg-[var(--talea-surface-inset)] disabled:opacity-30"
          aria-label="Mehr"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────────
// Main Wizard
// ────────────────────────────────────────────────────────────────────────────────
export default function ModernDokuWizard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const backend = useBackend();
  const { userId, getToken } = useAuth();
  const childProfiles = useOptionalChildProfiles();
  const activeProfileId = childProfiles?.activeProfileId;
  const activeProfile = childProfiles?.activeProfile ?? null;
  const { user } = useUser();
  const { i18n } = useTranslation();
  const { resolvedTheme } = useTheme();
  const reduceMotion = useReducedMotion();

  const isDark = resolvedTheme === 'dark';

  const domainParam = normalizeSuggestionDomain(searchParams.get('domain'));
  const legacyTopicParam = searchParams.get('topicTags');
  const topicParam = searchParams.get('topic') || legacyTopicParam;
  const initialDomainId =
    domainParam || toDomainFromPerspective(toPerspective(searchParams.get('perspective')) ?? 'science');
  const selectedDomainPreset = DOMAIN_DOKU_PRESETS[initialDomainId];
  const initialTopic = topicParam ?? selectedDomainPreset?.topics[0] ?? '';
  const initialPerspective =
    toPerspective(searchParams.get('perspective')) ??
    selectedDomainPreset?.perspective ??
    inferPerspectiveForDomain(initialDomainId);
  const shouldJumpToSummary = Boolean(legacyTopicParam && !searchParams.get('domain') && !searchParams.get('topic'));

  const [activeStep, setActiveStep] = useState(shouldJumpToSummary ? 4 : 0);
  const [generating, setGenerating] = useState(false);
  const [phase, setPhase] = useState<GenerationPhase>('text');
  const [language, setLanguage] = useState<DokuApiLanguage>('de');
  const [selectedDomainId, setSelectedDomainId] = useState<string>(initialDomainId);
  const [showMoreCategories, setShowMoreCategories] = useState(false);
  const [dynamicDomainIds, setDynamicDomainIds] = useState<string[]>([]);
  const [credits, setCredits] = useState<DokuCredits | null>(null);
  const [permissions, setPermissions] = useState<BillingPermissions | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState(
    'Du hast gerade keine Doku-Münzen mehr. Frag deine Eltern, ob sie den Plan wechseln möchten.'
  );
  const [state, setState] = useState<DokuWizardState>({
    topic: initialTopic,
    ageGroup: '6-8',
    depth: 'standard',
    perspective: initialPerspective,
    tone: 'curious',
    length: 'medium',
    includeInteractive: true,
    quizQuestions: 3,
    handsOnActivities: 1,
  });
  const lastAppliedDomainRef = useRef<string>(initialDomainId);
  const lastAppliedProfileRef = useRef<string | null>(null);

  // Tavi prefill
  useEffect(() => {
    const taviPrefill = (location.state as any)?.taviPrefill;
    if (!taviPrefill) return;
    const updates: Partial<DokuWizardState> = {};
    if (taviPrefill.topic) updates.topic = taviPrefill.topic;
    if (taviPrefill.ageGroup) updates.ageGroup = taviPrefill.ageGroup;
    if (taviPrefill.depth) updates.depth = taviPrefill.depth;
    if (taviPrefill.perspective) updates.perspective = taviPrefill.perspective;
    if (taviPrefill.tone) updates.tone = taviPrefill.tone;
    if (Object.keys(updates).length > 0) {
      setState((prev) => ({ ...prev, ...updates }));
    }
    if (taviPrefill.domain) setSelectedDomainId(taviPrefill.domain);
    window.history.replaceState({}, document.title);
  }, [location.state]);

  useEffect(() => {
    if (!domainParam) return;
    setSelectedDomainId(domainParam);
  }, [domainParam]);

  useEffect(() => {
    if (!activeProfile || lastAppliedProfileRef.current === activeProfile.id) return;
    lastAppliedProfileRef.current = activeProfile.id;
    const defaultAgeGroup = ageToAgeGroup(activeProfile.age);
    if (!defaultAgeGroup) return;
    setState((prev) => ({ ...prev, ageGroup: defaultAgeGroup }));
  }, [activeProfile]);

  useEffect(() => {
    let active = true;
    async function loadDomainCandidates() {
      if (!userId) return;
      try {
        const token = await getToken();
        const remote = await fetchCosmosState(
          {
            childId: activeProfileId || undefined,
            profileId: activeProfileId || undefined,
          },
          { token }
        );
        if (!active) return;
        const ids = Array.from(
          new Set(
            (remote.domains || [])
              .map((entry) => normalizeSuggestionDomain(entry.domainId))
              .filter((entry): entry is string => Boolean(entry))
          )
        );
        setDynamicDomainIds(ids);
      } catch (error) {
        if (active) console.warn('[ModernDokuWizard] could not load dynamic categories', error);
      }
    }
    void loadDomainCandidates();
    return () => {
      active = false;
    };
  }, [activeProfileId, getToken, userId]);

  const categoryPresets = useMemo(() => {
    const dynamicPresets: DomainDokuPreset[] = resolveCosmosDomains(dynamicDomainIds)
      .filter((domain) => !DOMAIN_DOKU_PRESETS[domain.id])
      .map((domain) => ({
        id: domain.id,
        label: domain.label,
        description: 'Eine neue Welt zum Entdecken!',
        perspective: inferPerspectiveForDomain(domain.id),
        topics: [
          `Wie funktioniert ${domain.label}?`,
          `Welche Geheimnisse stecken in ${domain.label}?`,
          `Warum ist ${domain.label} so spannend?`,
        ],
        emoji: '✨',
      }));

    const merged = [...CORE_DOMAIN_PRESETS, ...dynamicPresets];
    if (showMoreCategories) merged.push(...EXTRA_DOMAIN_PRESETS);
    const dedup = new Map<string, DomainDokuPreset>();
    for (const preset of merged) dedup.set(preset.id, preset);
    return Array.from(dedup.values());
  }, [dynamicDomainIds, showMoreCategories]);

  const selectedCategory = useMemo(
    () => categoryPresets.find((preset) => preset.id === selectedDomainId) || DOMAIN_DOKU_PRESETS[selectedDomainId],
    [categoryPresets, selectedDomainId]
  );

  const suggestionDomainId = useMemo(
    () => normalizeSuggestionDomain(selectedDomainId) ?? toDomainFromPerspective(state.perspective),
    [selectedDomainId, state.perspective]
  );

  const {
    suggestions: topicSuggestions,
    isLoading: isSuggestionsLoading,
    isRefreshing: isSuggestionsRefreshing,
    error: suggestionsError,
    lastInsertedSuggestionId,
    refreshOne: refreshOneSuggestion,
    selectSuggestion: selectSuggestionAndLog,
  } = useTopicSuggestions({
    domainId: suggestionDomainId,
    childId: activeProfileId || undefined,
    profileId: activeProfileId || undefined,
    enabled: activeStep === 0 && Boolean(suggestionDomainId),
  });

  const quickStartTopics = useMemo(
    () => Array.from(new Set(selectedCategory?.topics || [])).slice(0, 4),
    [selectedCategory]
  );

  useEffect(() => {
    setLanguage(toDokuLanguage(i18n.language));
  }, [i18n.language]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!backend || !user) return;
      try {
        const profile = await backend.user.me();
        if (profile.preferredLanguage) setLanguage(toDokuLanguage(profile.preferredLanguage));
        setCredits((profile as any).billing?.dokuCredits ?? null);
        setPermissions((profile as any).billing?.permissions ?? null);
      } catch (error) {
        console.error('[ModernDokuWizard] Failed to load profile:', error);
      }
    };
    void loadProfile();
  }, [backend, user]);

  const updateState = useCallback(
    (updates: Partial<DokuWizardState>) => setState((prev) => ({ ...prev, ...updates })),
    []
  );

  useEffect(() => {
    if (!selectedCategory) return;
    setState((prev) => {
      const domainChanged = lastAppliedDomainRef.current !== selectedCategory.id;
      lastAppliedDomainRef.current = selectedCategory.id;
      const nextTopic = domainChanged
        ? selectedCategory.topics[0] || prev.topic
        : prev.topic.trim().length > 0
        ? prev.topic
        : selectedCategory.topics[0] || prev.topic;
      const nextPerspective = selectedCategory.perspective;
      if (prev.topic === nextTopic && prev.perspective === nextPerspective) return prev;
      return { ...prev, perspective: nextPerspective, topic: nextTopic };
    });
  }, [selectedCategory]);

  const handleSelectSuggestion = useCallback(
    (item: TopicSuggestionItemDTO) => {
      updateState({ topic: item.topicTitle });
      void selectSuggestionAndLog(item);
    },
    [selectSuggestionAndLog, updateState]
  );

  const canProceed = activeStep === 0 ? state.topic.trim().length >= 3 : true;
  const generationBlocked = Boolean(credits && credits.remaining !== null && credits.remaining <= 0);

  const createDoku = async () => {
    if (!userId || !state.topic.trim()) return;
    if (generationBlocked) {
      if (permissions && !permissions.freeTrialActive) {
        setUpgradeMessage('Deine Probierzeit ist vorbei. Frag deine Eltern, ob sie einen Plan aussuchen möchten.');
      } else {
        setUpgradeMessage('Deine Doku-Münzen für diesen Monat sind aufgebraucht. Frag deine Eltern!');
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

      const effectiveDomainId =
        normalizeSuggestionDomain(suggestionDomainId || selectedDomainId) ||
        toDomainFromPerspective(state.perspective);

      const generationConfig = {
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
        domainId: effectiveDomainId,
      } as any;

      const created = await backend.doku.generateDoku({
        userId,
        profileId: activeProfileId || undefined,
        config: generationConfig,
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
      const query = new URLSearchParams();
      const createdDomain = normalizeSuggestionDomain(effectiveDomainId);
      if (createdDomain) query.set('domain', createdDomain);
      navigate(`/doku-reader/${created.id}${query.toString() ? `?${query.toString()}` : ''}`);
    } catch (error) {
      console.error('[ModernDokuWizard] Error generating doku:', error);
      if (error instanceof Error && error.message.includes('Abo-Limit erreicht')) {
        setUpgradeMessage(error.message);
        setShowUpgradeModal(true);
      } else {
        alert('Das hat leider nicht geklappt. Versuch es einfach nochmal!');
      }
    } finally {
      if (timer) clearInterval(timer);
      setGenerating(false);
      setPhase('text');
    }
  };

  const summary = [
    { label: 'Thema', value: state.topic, icon: '💡' },
    { label: 'Alter', value: `${state.ageGroup} Jahre`, icon: '🎂' },
    {
      label: 'Wie viel?',
      value: depthOptions.find((item) => item.value === state.depth)?.label || '-',
      icon: '📖',
    },
    {
      label: 'Erklärt wie?',
      value: perspectiveOptions.find((item) => item.value === state.perspective)?.label || '-',
      icon: '🔭',
    },
    { label: 'Stimmung', value: toneOptions.find((item) => item.value === state.tone)?.label || '-', icon: '✨' },
    { label: 'Länge', value: lengthOptions.find((item) => item.value === state.length)?.desc || '-', icon: '📏' },
    {
      label: 'Mitmachen',
      value: state.includeInteractive
        ? `${state.quizQuestions} Quiz + ${state.handsOnActivities} Aufgaben`
        : 'Ohne',
      icon: '🎯',
    },
  ];

  return (
    <div
      className="relative min-h-screen pb-24"
      style={{ color: 'var(--talea-text-primary)', fontFamily: taleaBodyFont }}
    >
      <TaleaPageBackground isDark={isDark} />

      <div className={cn(taleaPageShellClass, 'relative z-10 pt-4')}>
        {/* Header */}
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{
                borderColor: 'var(--talea-border-light)',
                background: 'var(--talea-surface-inset)',
                color: 'var(--talea-text-muted)',
              }}
            >
              <Wand2 className="h-3 w-3" />
              Doku Wizard
            </span>
            <h1
              className="mt-2 text-[2.2rem] font-semibold leading-[0.98] sm:text-[2.6rem]"
              style={{
                color: 'var(--talea-text-primary)',
                fontFamily: taleaDisplayFont,
              }}
            >
              Neue Doku zaubern
            </h1>
          </div>

          <button
            type="button"
            onClick={() => navigate('/doku')}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[1.1rem] border bg-[var(--talea-surface-primary)] px-4 text-sm font-semibold text-[var(--talea-text-primary)] transition-colors hover:bg-[var(--talea-surface-inset)]"
            style={{ borderColor: 'var(--talea-border-light)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </button>
        </header>

        {generating ? (
          <GenerationView phase={phase} reduceMotion={!!reduceMotion} />
        ) : (
          <>
            {/* Progress steps */}
            <div className="mb-6 flex justify-center">
              <TaleaProgressSteps steps={wizardSteps} activeIndex={activeStep} />
            </div>

            {/* Wizard panel */}
            <div
              className="rounded-[1.8rem] border p-5 shadow-[0_12px_30px_rgba(33,44,62,0.08)] md:p-7"
              style={{
                borderColor: 'var(--talea-border-light)',
                background: 'var(--talea-surface-primary)',
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* STEP 0: Topic */}
                  {activeStep === 0 && (
                    <div className="space-y-6">
                      <StepTitle
                        eyebrow="Schritt 1"
                        title="Was möchtest du entdecken?"
                        subtitle="Wähle eine Themen-Welt und finde dein perfektes Doku-Thema."
                      />

                      {/* Domain picker */}
                      <div
                        className="rounded-2xl border p-4"
                        style={{
                          borderColor: 'var(--talea-border-light)',
                          background: 'var(--talea-surface-inset)',
                        }}
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--talea-text-muted)]">
                              Themen-Welten
                            </p>
                            <p className="text-xs text-[var(--talea-text-muted)]">
                              Welche Welt fasziniert dich gerade?
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowMoreCategories((current) => !current)}
                            className="inline-flex items-center gap-1 rounded-full border bg-[var(--talea-surface-primary)] px-3 py-1.5 text-[11px] font-bold text-[var(--talea-text-primary)] transition-colors hover:bg-[var(--talea-surface-inset)]"
                            style={{ borderColor: 'var(--talea-border-light)' }}
                          >
                            {showMoreCategories ? 'Weniger' : 'Mehr'}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                          {categoryPresets.map((preset) => {
                            const active = selectedDomainId === preset.id;
                            return (
                              <motion.button
                                key={preset.id}
                                type="button"
                                onClick={() => {
                                  setSelectedDomainId(preset.id);
                                  updateState({
                                    perspective: preset.perspective,
                                    topic: preset.topics[0] || state.topic,
                                  });
                                }}
                                whileHover={reduceMotion ? undefined : { y: -2 }}
                                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                                className={cn(
                                  'group flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors',
                                  active
                                    ? 'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_14%,var(--talea-surface-primary))] shadow-[0_6px_18px_rgba(123,168,156,0.18)]'
                                    : 'border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] hover:border-[var(--talea-border-soft)]'
                                )}
                              >
                                <span className="text-xl leading-none">{preset.emoji}</span>
                                <p
                                  className="text-xs font-semibold leading-tight"
                                  style={{ color: 'var(--talea-text-primary)' }}
                                >
                                  {preset.label}
                                </p>
                                <p className="text-[10px] leading-tight" style={{ color: 'var(--talea-text-muted)' }}>
                                  {preset.description}
                                </p>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Topic input */}
                      <div className="space-y-2">
                        <label htmlFor="doku-topic" className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--talea-text-muted)]">
                          Dein Thema
                        </label>
                        <input
                          id="doku-topic"
                          type="text"
                          value={state.topic}
                          onChange={(e) => updateState({ topic: e.target.value })}
                          placeholder={selectedCategory?.topics?.[0] || 'z.B. Vulkane oder Sonnensystem'}
                          className={cn(taleaInputClass, 'h-12 text-base')}
                        />
                      </div>

                      {/* Quick start */}
                      {quickStartTopics.length > 0 && (
                        <div
                          className="rounded-2xl border p-4"
                          style={{
                            borderColor: 'var(--talea-border-light)',
                            background: 'var(--talea-surface-inset)',
                          }}
                        >
                          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--talea-text-muted)]">
                            Schnellstart
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {quickStartTopics.map((topic) => {
                              const active = state.topic === topic;
                              return (
                                <motion.button
                                  key={topic}
                                  type="button"
                                  onClick={() => updateState({ topic })}
                                  whileTap={reduceMotion ? undefined : { scale: 0.96 }}
                                  className={cn(
                                    'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                                    active
                                      ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                                      : 'border-[var(--talea-border-light)] bg-[var(--talea-surface-primary)] text-[var(--talea-text-primary)] hover:bg-[var(--talea-surface-inset)]'
                                  )}
                                >
                                  {topic}
                                </motion.button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Gemini ideas */}
                      {suggestionDomainId && (
                        <section
                          className="rounded-2xl border p-4"
                          aria-labelledby="doku-ideas-heading"
                          style={{
                            borderColor: 'var(--talea-border-light)',
                            background: 'var(--talea-surface-inset)',
                          }}
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                              <p id="doku-ideas-heading" className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--talea-text-muted)]">
                                Ideen für dich
                              </p>
                              <p className="text-xs text-[var(--talea-text-muted)]" role="status" aria-live="polite">
                                {isSuggestionsLoading
                                  ? 'Gemini findet gerade spannende Fragen für dich ...'
                                  : `${Math.min(topicSuggestions?.items?.length || 0, 12)} Vorschläge in ${selectedCategory?.label || 'dieser Kategorie'}`}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void refreshOneSuggestion()}
                              disabled={isSuggestionsLoading || isSuggestionsRefreshing}
                              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-[var(--talea-surface-primary)] px-3 py-1.5 text-[11px] font-bold text-[var(--talea-text-primary)] transition-colors hover:bg-[var(--talea-surface-inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
                              style={{ borderColor: 'var(--talea-border-light)' }}
                            >
                              {isSuggestionsRefreshing ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                              ) : (
                                <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                              )}
                              {isSuggestionsRefreshing ? 'Neue Idee kommt ...' : 'Neue Idee'}
                            </button>
                          </div>

                          {suggestionsError && (
                            <div role="alert" className="mb-2 rounded-lg border border-red-300/35 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-700 dark:text-red-200">
                              {suggestionsError}
                            </div>
                          )}

                          <div className="max-h-[30rem] overflow-y-auto pr-1">
                            <SuggestionGrid
                              items={topicSuggestions?.items || []}
                              isLoading={isSuggestionsLoading}
                              lastInsertedSuggestionId={lastInsertedSuggestionId}
                              maxItems={12}
                              variant="talea"
                              onSelect={handleSelectSuggestion}
                            />
                          </div>
                        </section>
                      )}
                    </div>
                  )}

                  {/* STEP 1: Audience */}
                  {activeStep === 1 && (
                    <div className="space-y-7">
                      <StepTitle
                        eyebrow="Schritt 2"
                        title="Für wen ist die Doku?"
                        subtitle="Wähle Alter und gewünschte Tiefe."
                      />

                      <div>
                        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--talea-text-muted)]">
                          Alter
                        </p>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                          {ageOptions.map((item) => (
                            <Choice
                              key={item.value}
                              selected={state.ageGroup === item.value}
                              onClick={() => updateState({ ageGroup: item.value })}
                              title={item.label}
                              description={item.desc}
                              emoji={item.emoji}
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--talea-text-muted)]">
                          Wie viel möchtest du erfahren?
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          {depthOptions.map((item) => (
                            <Choice
                              key={item.value}
                              selected={state.depth === item.value}
                              onClick={() => updateState({ depth: item.value })}
                              title={item.label}
                              description={item.desc}
                              emoji={item.emoji}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: Voice / Perspective */}
                  {activeStep === 2 && (
                    <div className="space-y-7">
                      <StepTitle
                        eyebrow="Schritt 3"
                        title="Wie soll es dir erklärt werden?"
                        subtitle="Stil und Ton bestimmen, wie sich deine Doku liest."
                      />

                      <div>
                        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--talea-text-muted)]">
                          Erklärweise
                        </p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                          {perspectiveOptions.map((item) => (
                            <Choice
                              key={item.value}
                              selected={state.perspective === item.value}
                              onClick={() => updateState({ perspective: item.value })}
                              title={item.label}
                              description={item.desc}
                              emoji={item.emoji}
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--talea-text-muted)]">
                          Stimmung
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          {toneOptions.map((item) => (
                            <Choice
                              key={item.value}
                              selected={state.tone === item.value}
                              onClick={() => updateState({ tone: item.value })}
                              title={item.label}
                              description={item.desc}
                              emoji={item.emoji}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: Content */}
                  {activeStep === 3 && (
                    <div className="space-y-7">
                      <StepTitle
                        eyebrow="Schritt 4"
                        title="Wie viel Inhalt darf es sein?"
                        subtitle="Länge und interaktive Mitmach-Elemente."
                      />

                      <div>
                        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--talea-text-muted)]">
                          Länge
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          {lengthOptions.map((item) => (
                            <Choice
                              key={item.value}
                              selected={state.length === item.value}
                              onClick={() => updateState({ length: item.value })}
                              title={item.label}
                              description={item.desc}
                              emoji={item.emoji}
                            />
                          ))}
                        </div>
                      </div>

                      <div
                        className="rounded-2xl border p-4"
                        style={{
                          borderColor: 'var(--talea-border-light)',
                          background: 'var(--talea-surface-inset)',
                        }}
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--talea-text-primary)' }}>
                              <span>🎯</span> Mitmach-Elemente
                            </p>
                            <p className="text-xs text-[var(--talea-text-muted)]">
                              Quiz und Aufgaben einbauen?
                            </p>
                          </div>
                          <motion.button
                            type="button"
                            onClick={() => updateState({ includeInteractive: !state.includeInteractive })}
                            whileTap={reduceMotion ? undefined : { scale: 0.96 }}
                            className="relative h-7 w-14 rounded-full transition-colors"
                            style={{
                              background: state.includeInteractive
                                ? 'var(--primary)'
                                : 'var(--talea-border-soft)',
                            }}
                            aria-pressed={state.includeInteractive}
                          >
                            <motion.span
                              animate={{ x: state.includeInteractive ? 28 : 2 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                              className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow"
                            />
                          </motion.button>
                        </div>

                        <AnimatePresence>
                          {state.includeInteractive && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25 }}
                              className="overflow-hidden border-t pt-4"
                              style={{ borderColor: 'var(--talea-border-light)' }}
                            >
                              <div className="grid grid-cols-2 gap-4">
                                <Counter
                                  label="Quiz-Fragen"
                                  value={state.quizQuestions}
                                  onChange={(v) => updateState({ quizQuestions: v })}
                                  min={0}
                                  max={10}
                                />
                                <Counter
                                  label="Aufgaben"
                                  value={state.handsOnActivities}
                                  onChange={(v) => updateState({ handsOnActivities: v })}
                                  min={0}
                                  max={5}
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}

                  {/* STEP 4: Summary */}
                  {activeStep === 4 && (
                    <div className="space-y-6">
                      <StepTitle
                        eyebrow="Letzter Schritt"
                        title="Alles bereit!"
                        subtitle="Hier ist deine Auswahl. Wenn alles passt, geht's los."
                      />

                      <div
                        className="rounded-2xl border"
                        style={{
                          borderColor: 'var(--talea-border-light)',
                          background: 'var(--talea-surface-inset)',
                        }}
                      >
                        <div className="divide-y" style={{ borderColor: 'var(--talea-border-light)' }}>
                          {summary.map((item) => (
                            <div
                              key={item.label}
                              className="flex items-start justify-between gap-4 px-4 py-3"
                              style={{ borderColor: 'var(--talea-border-light)' }}
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="text-base">{item.icon}</span>
                                <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--talea-text-muted)]">
                                  {item.label}
                                </span>
                              </div>
                              <span
                                className="max-w-[60%] text-right text-sm font-semibold"
                                style={{ color: 'var(--talea-text-primary)' }}
                              >
                                {item.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <motion.button
                        type="button"
                        onClick={createDoku}
                        disabled={generationBlocked}
                        whileHover={generationBlocked || reduceMotion ? undefined : { y: -2, scale: 1.005 }}
                        whileTap={generationBlocked || reduceMotion ? undefined : { scale: 0.98 }}
                        className={cn(
                          'flex w-full items-center justify-center gap-3 rounded-2xl px-6 py-4 text-base font-bold transition-all',
                          generationBlocked
                            ? 'cursor-not-allowed opacity-60'
                            : 'shadow-[0_18px_38px_rgba(123,168,156,0.28)]'
                        )}
                        style={{
                          background:
                            'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--talea-accent-sky) 65%, white) 100%)',
                          color: 'white',
                        }}
                      >
                        <Sparkles className="h-5 w-5" />
                        {generationBlocked ? 'Gerade nicht möglich' : 'Doku zaubern! (1 Münze)'}
                      </motion.button>

                      {credits && (
                        <p className="text-center text-xs" style={{ color: 'var(--talea-text-muted)' }}>
                          Doku-Münzen: {credits.remaining === null ? 'unbegrenzt' : credits.remaining} noch übrig
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer navigation */}
            <div className="mt-5 flex items-center justify-between">
              <button
                type="button"
                onClick={activeStep === 0 ? () => navigate('/doku') : () => setActiveStep((prev) => prev - 1)}
                className="inline-flex items-center gap-1.5 rounded-[1.1rem] border bg-[var(--talea-surface-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--talea-text-primary)] transition-colors hover:bg-[var(--talea-surface-inset)]"
                style={{ borderColor: 'var(--talea-border-light)' }}
              >
                <ArrowLeft className="h-4 w-4" />
                Zurück
              </button>

              {activeStep < wizardSteps.length - 1 && (
                <motion.button
                  type="button"
                  onClick={() => setActiveStep((prev) => prev + 1)}
                  disabled={!canProceed}
                  whileHover={canProceed && !reduceMotion ? { y: -1, scale: 1.01 } : undefined}
                  whileTap={canProceed && !reduceMotion ? { scale: 0.98 } : undefined}
                  className={cn(
                    'inline-flex min-h-10 items-center justify-center gap-2 rounded-[1.1rem] border px-5 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary)]/14 disabled:cursor-not-allowed disabled:opacity-50',
                    canProceed
                      ? 'border-transparent text-white shadow-[0_14px_34px_rgba(123,168,156,0.24)]'
                      : 'border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)] text-[var(--talea-text-muted)]'
                  )}
                  style={
                    canProceed
                      ? {
                          background:
                            'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--talea-accent-sky) 68%, white) 100%)',
                        }
                      : undefined
                  }
                >
                  Weiter
                  <ArrowRight className="h-4 w-4" />
                </motion.button>
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

// ────────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ────────────────────────────────────────────────────────────────────────────────
const StepTitle: React.FC<{ eyebrow: string; title: string; subtitle: string }> = ({
  eyebrow,
  title,
  subtitle,
}) => (
  <div className="space-y-1.5">
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em]"
      style={{
        borderColor: 'var(--talea-border-light)',
        background: 'var(--talea-surface-inset)',
        color: 'var(--talea-text-muted)',
      }}
    >
      {eyebrow}
    </span>
    <h2
      className="text-2xl font-semibold leading-tight sm:text-[1.75rem]"
      style={{ color: 'var(--talea-text-primary)', fontFamily: taleaDisplayFont }}
    >
      {title}
    </h2>
    <p className="text-sm" style={{ color: 'var(--talea-text-muted)' }}>
      {subtitle}
    </p>
  </div>
);

const GenerationView: React.FC<{ phase: GenerationPhase; reduceMotion: boolean }> = ({
  phase,
  reduceMotion,
}) => {
  const phases: GenerationPhase[] = ['text', 'cover', 'sections', 'personality', 'complete'];
  const currentIdx = phases.indexOf(phase);

  return (
    <div className="mx-auto max-w-xl">
      <div
        className="rounded-[1.8rem] border p-6 shadow-[0_18px_42px_rgba(33,44,62,0.10)]"
        style={{
          borderColor: 'var(--talea-border-light)',
          background: 'var(--talea-surface-primary)',
        }}
      >
        <div className="mb-7 flex flex-col items-center text-center">
          <motion.div
            animate={
              reduceMotion
                ? undefined
                : { rotate: 360, scale: [1, 1.06, 1] }
            }
            transition={{
              rotate: { duration: 6, repeat: Infinity, ease: 'linear' },
              scale: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' },
            }}
            className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-3xl"
            style={{
              background:
                'linear-gradient(135deg, color-mix(in srgb, var(--primary) 18%, transparent) 0%, color-mix(in srgb, var(--talea-accent-lavender) 16%, transparent) 100%)',
            }}
          >
            <Sparkles className="h-9 w-9" style={{ color: 'var(--primary)' }} />
          </motion.div>

          <h2
            className="text-2xl font-semibold"
            style={{ color: 'var(--talea-text-primary)', fontFamily: taleaDisplayFont }}
          >
            {phaseLabels[phase]}
          </h2>

          {/* Loading dots */}
          <div className="mt-3 flex items-center gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                animate={reduceMotion ? undefined : { opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                className="h-1.5 w-1.5 rounded-full bg-[var(--primary)]"
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {phases.map((item, index) => {
            const isDone = index < currentIdx;
            const isActive = index === currentIdx;
            return (
              <motion.div
                key={item}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                  isActive
                    ? 'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_10%,var(--talea-surface-primary))]'
                    : 'border-[var(--talea-border-light)] bg-[var(--talea-surface-inset)]'
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                    isDone || isActive
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-[var(--talea-surface-primary)] text-[var(--talea-text-muted)]'
                  )}
                >
                  {isDone ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : isActive ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                </span>
                <span
                  className={cn(
                    'text-sm font-semibold',
                    isActive ? 'text-[var(--talea-text-primary)]' : 'text-[var(--talea-text-muted)]'
                  )}
                >
                  {phaseLabels[item]}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
