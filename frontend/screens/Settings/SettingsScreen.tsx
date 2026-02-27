import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { PricingTable, UserProfile, useAuth, useClerk, useUser } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useBackend } from '../../hooks/useBackend';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../../src/i18n';
import { useTheme } from '../../contexts/ThemeContext';
import { toast } from 'sonner';
import { getBackendUrl } from '../../config';
import {
  Ban,
  BookOpen,
  Check,
  Clock3,
  CreditCard,
  Crown,
  FileText,
  Globe,
  Headphones,
  Info,
  KeyRound,
  Languages,
  Lock,
  Monitor,
  Moon,
  LogOut,
  Plus,
  RefreshCcw,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Target,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GeneratedAudioLibraryEntry } from '../../types/generated-audio';
import {
  getAllOfflineGeneratedAudios,
  removeGeneratedAudioOffline,
  saveDokuOffline,
  saveGeneratedAudioOffline,
  saveStoryOffline,
} from '../../utils/offlineDb';

type ThemeOption = 'light' | 'dark' | 'system';
type SubscriptionPlan = 'free' | 'starter' | 'familie' | 'premium';

type CreditUsage = {
  limit: number | null;
  used: number;
  remaining: number | null;
  costPerGeneration: 1;
};

type BillingSnapshot = {
  plan: SubscriptionPlan;
  periodStart: Date;
  storyCredits: CreditUsage;
  dokuCredits: CreditUsage;
  audioCredits: CreditUsage;
  permissions: {
    canReadCommunityDokus: boolean;
    canUseAudioDokus: boolean;
    freeTrialActive: boolean;
    freeTrialEndsAt: Date | null;
    freeTrialDaysRemaining: number;
  };
};

type ProfileSnapshot = {
  subscription: SubscriptionPlan;
  billing: BillingSnapshot;
};

type GeneratedAudioListResponse = {
  items: GeneratedAudioLibraryEntry[];
  total: number;
  hasMore: boolean;
};

type GroupedGeneratedAudio = {
  key: string;
  sourceType: 'story' | 'doku';
  sourceId: string;
  sourceTitle: string;
  coverImageUrl?: string;
  createdAt: string | Date;
  items: GeneratedAudioLibraryEntry[];
};

type DokuNarrationInput = {
  title?: string;
  summary?: string;
  topic?: string;
  content?: {
    sections?: Array<{
      title?: string;
      content?: string;
    }>;
  };
};

function buildDokuNarrationText(doku: DokuNarrationInput): string {
  const blocks: string[] = [];
  if (doku.title) blocks.push(doku.title);
  if (doku.summary) blocks.push(doku.summary);
  if (doku.topic) blocks.push(`Thema: ${doku.topic}.`);
  if (doku.content?.sections?.length) {
    for (const section of doku.content.sections) {
      if (section.title) blocks.push(section.title);
      if (section.content) blocks.push(section.content);
    }
  }
  return blocks.join('\n\n').trim();
}

type KeywordPreset = {
  id: string;
  label: string;
  keywords: string[];
};

type ParentalPresets = {
  blockedThemePresets: KeywordPreset[];
  blockedWordPresets: KeywordPreset[];
  goalPresets: KeywordPreset[];
};

type ParentalControlsSnapshot = {
  enabled: boolean;
  onboardingCompleted: boolean;
  hasPin: boolean;
  blockedThemes: string[];
  blockedWords: string[];
  learningGoals: string[];
  profileKeywords: string[];
  dailyLimits: {
    stories: number | null;
    dokus: number | null;
  };
};

const PLAN_META: Record<
  SubscriptionPlan,
  {
    title: string;
    icon: typeof Sparkles;
    gradient: string;
    storyLimit: string;
    dokuLimit: string;
    audioLimit: string;
    community: string;
  }
> = {
  free: {
    title: 'Free',
    icon: Sparkles,
    gradient: 'from-[#64748B] to-[#94A3B8]',
    storyLimit: '3 / Monat (7 Tage Test)',
    dokuLimit: '3 / Monat (7 Tage Test)',
    audioLimit: '1 / Monat (nur Test)',
    community: 'Nur waehrend Testphase',
  },
  starter: {
    title: 'Starter',
    icon: Sparkles,
    gradient: 'from-[#FF6B9D] to-[#A989F2]',
    storyLimit: '10 / Monat',
    dokuLimit: '10 / Monat',
    audioLimit: '2 / Monat',
    community: 'Ja',
  },
  familie: {
    title: 'Familie',
    icon: Users,
    gradient: 'from-[#2DD4BF] to-[#0EA5E9]',
    storyLimit: '25 / Monat',
    dokuLimit: '25 / Monat',
    audioLimit: '10 / Monat',
    community: 'Ja',
  },
  premium: {
    title: 'Premium',
    icon: Crown,
    gradient: 'from-[#FF9B5C] to-[#FF6B9D]',
    storyLimit: '50 / Monat',
    dokuLimit: '50 / Monat',
    audioLimit: 'Unbegrenzt',
    community: 'Ja',
  },
};

const SettingsBackground: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <motion.div
        className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-20"
        style={{
          background: isDark
            ? 'radial-gradient(circle, rgba(94,128,166,0.42) 0%, rgba(34,56,82,0.26) 55%, transparent 76%)'
            : 'radial-gradient(circle, rgba(227,213,202,0.55) 0%, rgba(214,204,194,0.28) 52%, transparent 74%)',
        }}
        animate={{ scale: [1, 1.15, 1], x: [0, 20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full opacity-20"
        style={{
          background: isDark
            ? 'radial-gradient(circle, rgba(83,118,152,0.35) 0%, rgba(20,34,52,0.3) 56%, transparent 76%)'
            : 'radial-gradient(circle, rgba(245,235,224,0.6) 0%, rgba(213,189,175,0.22) 55%, transparent 75%)',
        }}
        animate={{ scale: [1, 1.2, 1], y: [0, -20, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
};

function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const backend = useBackend();
  const { user, isLoaded } = useUser();
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(
    (i18n.language as SupportedLanguage) || 'de'
  );
  const [isSaving, setIsSaving] = useState(false);
  const loadedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !user?.id) return;
    if (loadedForUserRef.current === user.id) return;
    loadedForUserRef.current = user.id;

    let mounted = true;
    const loadUserLanguage = async () => {
      try {
        const profile = await backend.user.me();
        const nextLanguage = profile.preferredLanguage as SupportedLanguage | undefined;
        if (!mounted || !nextLanguage) return;

        setSelectedLanguage(nextLanguage);
        if (i18n.language !== nextLanguage) {
          await i18n.changeLanguage(nextLanguage);
        }
      } catch (err) {
        console.error('Failed to load user language:', err);
      }
    };

    void loadUserLanguage();
    return () => {
      mounted = false;
    };
  }, [backend, i18n, isLoaded, user?.id]);

  const handleLanguageChange = async (language: SupportedLanguage) => {
    setIsSaving(true);
    try {
      await backend.user.updateLanguage({ language });
      await i18n.changeLanguage(language);
      setSelectedLanguage(language);
      localStorage.setItem('talea_language', language);
      toast.success(t('settings.saved'));
    } catch (err) {
      console.error('Failed to save language:', err);
      toast.error(t('settings.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#A989F2] to-[#FF6B9D] flex items-center justify-center shadow-md">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
              {t('settings.language')}
            </h2>
            <p className="text-xs text-muted-foreground">{t('settings.languageDescription')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <motion.button
            key={lang.code}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleLanguageChange(lang.code)}
            disabled={isSaving}
            className={`relative p-4 rounded-2xl border-2 transition-all ${
              selectedLanguage === lang.code
                ? 'border-[#A989F2] bg-[#A989F2]/10 shadow-lg shadow-[#A989F2]/10'
                : 'border-border bg-card/70 hover:border-[#A989F2]/40 hover:shadow-md hover:bg-accent/70'
            } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {selectedLanguage === lang.code && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-2 right-2 w-6 h-6 bg-[#A989F2] rounded-full flex items-center justify-center shadow-sm"
              >
                <Check className="w-4 h-4 text-white" />
              </motion.div>
            )}
            <div className="flex items-center gap-3">
              <span className="text-3xl">{lang.flag}</span>
              <div className="text-left">
                <div className="font-bold text-foreground">{lang.nativeName}</div>
                <div className="text-sm text-muted-foreground">{lang.name}</div>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function ThemeSelector() {
  const { t } = useTranslation();
  const { theme, setTheme: setGlobalTheme } = useTheme();

  const handleThemeChange = async (newTheme: ThemeOption) => {
    try {
      await setGlobalTheme(newTheme);
      toast.success(t('settings.saved'));
    } catch (err) {
      console.error('Failed to save theme:', err);
      toast.error(t('settings.saveFailed'));
    }
  };

  const themeOptions = [
    { value: 'light' as ThemeOption, icon: Sun, label: t('settings.light'), description: t('settings.lightDescription') },
    { value: 'dark' as ThemeOption, icon: Moon, label: t('settings.dark'), description: t('settings.darkDescription') },
    { value: 'system' as ThemeOption, icon: Monitor, label: t('settings.system'), description: t('settings.systemDescription') },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF9B5C] to-[#FF6B9D] flex items-center justify-center shadow-md">
            <Sun className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
              {t('settings.themeTitle')}
            </h2>
            <p className="text-xs text-muted-foreground">{t('settings.themeDescription')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {themeOptions.map((option, i) => {
          const Icon = option.icon;
          return (
            <motion.button
              key={option.value}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleThemeChange(option.value)}
              className={`relative p-5 rounded-2xl border-2 transition-all ${
                theme === option.value
                  ? 'border-[#FF9B5C] bg-[#FF9B5C]/10 shadow-lg shadow-[#FF9B5C]/10'
                  : 'border-border bg-card/70 hover:border-[#FF9B5C]/40 hover:shadow-md hover:bg-accent/70'
              }`}
            >
              {theme === option.value && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2 w-6 h-6 bg-[#FF9B5C] rounded-full flex items-center justify-center shadow-sm"
                >
                  <Check className="w-4 h-4 text-white" />
                </motion.div>
              )}
              <div className="flex flex-col items-center gap-3">
                <Icon className="w-8 h-8 text-foreground/80" />
                <div className="text-center">
                  <div className="font-bold text-foreground">{option.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{option.description}</div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function mergeKeywords(current: string[], incoming: string[]): string[] {
  const dedup = new Set<string>(current.map((item) => item.trim().toLowerCase()).filter(Boolean));
  incoming.forEach((item) => {
    const normalized = item.trim().toLowerCase();
    if (normalized) dedup.add(normalized);
  });
  return Array.from(dedup).slice(0, 32);
}

function TagPill(props: { value: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#d5bdaf] bg-[#f9f1e7] px-2.5 py-1 text-[11px] font-semibold text-[#4d6178] dark:border-[#4c6077] dark:bg-[#1b2a3f] dark:text-[#b8c9df]">
      {props.value}
      <button
        type="button"
        onClick={props.onRemove}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#e6d8cb] text-[#4d6178] dark:bg-[#2a3d55] dark:text-[#b8c9df]"
        aria-label={`Remove ${props.value}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function KeywordPresetChips(props: {
  presets: KeywordPreset[];
  onApply: (keywords: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {props.presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => props.onApply(preset.keywords)}
          className="rounded-full border border-[#d6ccc2] bg-[#f5ebe0] px-3 py-1 text-xs font-semibold text-[#3a4a61] transition hover:bg-[#edede9] dark:border-[#4a617c] dark:bg-[#1c2b42] dark:text-[#c3d4ea] dark:hover:bg-[#233754]"
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}

function KeywordEditor(props: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  values: string[];
  presets?: KeywordPreset[];
  inputValue: string;
  inputPlaceholder: string;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (value: string) => void;
  onApplyPreset?: (keywords: string[]) => void;
}) {
  return (
    <div className="rounded-2xl border border-[#d6ccc2] bg-[#fffaf3] p-4 dark:border-[#425874] dark:bg-[#17263a]">
      <div className="mb-3 flex items-start gap-2">
        <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#f5ebe0] text-[#556d88] dark:bg-[#24364d] dark:text-[#bfd1e8]">
          {props.icon}
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">{props.title}</p>
          <p className="text-xs text-muted-foreground">{props.subtitle}</p>
        </div>
      </div>

      {props.presets && props.presets.length > 0 && props.onApplyPreset && (
        <div className="mb-3">
          <KeywordPresetChips presets={props.presets} onApply={props.onApplyPreset} />
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-1.5">
        {props.values.length === 0 ? (
          <span className="text-xs text-muted-foreground">Noch keine Eintraege.</span>
        ) : (
          props.values.map((value) => (
            <TagPill key={value} value={value} onRemove={() => props.onRemove(value)} />
          ))
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          value={props.inputValue}
          onChange={(event) => props.onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              props.onAdd();
            }
          }}
          placeholder={props.inputPlaceholder}
          className="h-9 flex-1 rounded-xl border border-[#d6ccc2] bg-white px-3 text-sm text-[#2a3a4d] outline-none placeholder:text-[#93a3b8] focus:border-[#b79f8e] dark:border-[#47607c] dark:bg-[#20324a] dark:text-[#e6effd] dark:placeholder:text-[#8ea3bf]"
        />
        <button
          type="button"
          onClick={props.onAdd}
          className="inline-flex h-9 items-center justify-center rounded-xl border border-[#d5bdaf] bg-[#f5ebe0] px-3 text-sm font-semibold text-[#2f4058] hover:bg-[#edede9] dark:border-[#496381] dark:bg-[#243850] dark:text-[#d5e4f8] dark:hover:bg-[#2b425f]"
        >
          <Plus className="mr-1 h-4 w-4" />
          Add
        </button>
      </div>
    </div>
  );
}

function ParentalDashboardPanel() {
  const backend = useBackend();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [controls, setControls] = useState<ParentalControlsSnapshot | null>(null);
  const [presets, setPresets] = useState<ParentalPresets>({
    blockedThemePresets: [],
    blockedWordPresets: [],
    goalPresets: [],
  });

  const [currentPin, setCurrentPin] = useState('');
  const [unlockPin, setUnlockPin] = useState('');
  const [setupPin, setSetupPin] = useState('');
  const [setupPinConfirm, setSetupPinConfirm] = useState('');
  const [nextPin, setNextPin] = useState('');
  const [nextPinConfirm, setNextPinConfirm] = useState('');

  const [enabled, setEnabled] = useState(false);
  const [blockedThemes, setBlockedThemes] = useState<string[]>([]);
  const [blockedWords, setBlockedWords] = useState<string[]>([]);
  const [learningGoals, setLearningGoals] = useState<string[]>([]);
  const [profileKeywords, setProfileKeywords] = useState<string[]>([]);
  const [dailyStoryLimit, setDailyStoryLimit] = useState<number | null>(null);
  const [dailyDokuLimit, setDailyDokuLimit] = useState<number | null>(null);

  const [themeInput, setThemeInput] = useState('');
  const [wordInput, setWordInput] = useState('');
  const [goalInput, setGoalInput] = useState('');
  const [profileInput, setProfileInput] = useState('');

  const loadParental = async () => {
    try {
      setLoading(true);
      const response = await backend.user.getParentalControls();
      const nextControls = (response as any).controls as ParentalControlsSnapshot;
      const nextPresets = (response as any).presets as ParentalPresets;
      setControls(nextControls);
      setPresets(nextPresets);
      setEnabled(nextControls.enabled);
      setBlockedThemes(nextControls.blockedThemes ?? []);
      setBlockedWords(nextControls.blockedWords ?? []);
      setLearningGoals(nextControls.learningGoals ?? []);
      setProfileKeywords(nextControls.profileKeywords ?? []);
      setDailyStoryLimit(nextControls.dailyLimits?.stories ?? null);
      setDailyDokuLimit(nextControls.dailyLimits?.dokus ?? null);
      if (!nextControls.hasPin) {
        setCurrentPin('');
      }
    } catch (error) {
      console.error('Failed to load parental controls:', error);
      toast.error('Eltern-Dashboard konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParental();
  }, [backend]);

  const unlocked = !controls?.hasPin || currentPin.length > 0;

  const addKeyword = (
    input: string,
    values: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    const next = mergeKeywords(values, [input]);
    setter(next);
  };

  const validatePin = (pin: string) => /^\d{4,8}$/.test(pin);

  const saveControls = async () => {
    if (!controls) return;

    const payload: any = {
      enabled,
      onboardingCompleted: true,
      blockedThemes,
      blockedWords,
      learningGoals,
      profileKeywords,
      dailyStoryLimit,
      dailyDokuLimit,
    };

    if (controls.hasPin) {
      if (!currentPin) {
        toast.error('Bitte zuerst Eltern-PIN eingeben.');
        return;
      }
      payload.currentPin = currentPin;
      if (nextPin || nextPinConfirm) {
        if (nextPin !== nextPinConfirm) {
          toast.error('Neuer PIN und Bestaetigung stimmen nicht ueberein.');
          return;
        }
        if (!validatePin(nextPin)) {
          toast.error('PIN muss 4 bis 8 Ziffern haben.');
          return;
        }
        payload.newPin = nextPin;
      }
    } else {
      if (setupPin !== setupPinConfirm) {
        toast.error('PIN und Bestaetigung stimmen nicht ueberein.');
        return;
      }
      if (!validatePin(setupPin)) {
        toast.error('Bitte einen PIN mit 4 bis 8 Ziffern setzen.');
        return;
      }
      payload.newPin = setupPin;
    }

    try {
      setSaving(true);
      const response = await backend.user.saveParentalControls(payload);
      const nextControls = (response as any).controls as ParentalControlsSnapshot;
      setControls(nextControls);
      setEnabled(nextControls.enabled);
      setBlockedThemes(nextControls.blockedThemes ?? []);
      setBlockedWords(nextControls.blockedWords ?? []);
      setLearningGoals(nextControls.learningGoals ?? []);
      setProfileKeywords(nextControls.profileKeywords ?? []);
      setDailyStoryLimit(nextControls.dailyLimits?.stories ?? null);
      setDailyDokuLimit(nextControls.dailyLimits?.dokus ?? null);

      if (payload.newPin) {
        setCurrentPin(payload.newPin);
        setUnlockPin('');
        setSetupPin('');
        setSetupPinConfirm('');
        setNextPin('');
        setNextPinConfirm('');
      }
      toast.success('Eltern-Dashboard gespeichert.');
    } catch (error) {
      console.error('Failed to save parental controls:', error);
      toast.error(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  const unlock = async () => {
    if (!unlockPin.trim()) {
      toast.error('Bitte PIN eingeben.');
      return;
    }

    try {
      const response = await backend.user.verifyParentalPin({ pin: unlockPin.trim() });
      if ((response as any).ok) {
        setCurrentPin(unlockPin.trim());
        setUnlockPin('');
        toast.success('Eltern-Dashboard entsperrt.');
      } else {
        toast.error('PIN ungueltig.');
      }
    } catch (error) {
      console.error('Failed to verify parental pin:', error);
      toast.error('PIN konnte nicht geprueft werden.');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-border bg-card/70 p-5 text-sm text-muted-foreground">
          Lade Eltern-Dashboard...
        </div>
      </div>
    );
  }

  if (!controls) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-border bg-card/70 p-5 text-sm text-muted-foreground">
          Eltern-Dashboard nicht verfuegbar.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 max-w-full overflow-x-hidden">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#d5bdaf] via-[#e3d5ca] to-[#d6ccc2] text-[#2f4058]">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
            Eltern-Dashboard
          </h2>
          <p className="text-xs text-muted-foreground">
            Sicherheit, Lernziele und Tageslimits fuer Storys und Dokus.
          </p>
        </div>
      </div>

      {controls.hasPin && !unlocked && (
        <div className="rounded-2xl border border-[#d6ccc2] bg-[#fff8ef] p-4 dark:border-[#4b5f79] dark:bg-[#17263a]">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Lock className="h-4 w-4" />
            PIN-Schutz aktiv
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Bitte Eltern-PIN eingeben, um Regeln und Limits zu bearbeiten.
          </p>
          <div className="flex items-center gap-2">
            <input
              value={unlockPin}
              onChange={(event) => setUnlockPin(event.target.value)}
              type="password"
              inputMode="numeric"
              placeholder="PIN"
              className="h-10 flex-1 rounded-xl border border-[#d6ccc2] bg-white px-3 text-sm outline-none focus:border-[#b79f8e] dark:border-[#45607e] dark:bg-[#20324a]"
            />
            <button
              type="button"
              onClick={unlock}
              className="inline-flex h-10 items-center rounded-xl border border-[#d5bdaf] bg-[#f5ebe0] px-4 text-sm font-semibold text-[#2f4058] dark:border-[#496381] dark:bg-[#243850] dark:text-[#d5e4f8]"
            >
              Entsperren
            </button>
          </div>
        </div>
      )}

      {unlocked && (
        <>
          <div className="rounded-2xl border border-[#d6ccc2] bg-[#fff8ef] p-4 dark:border-[#4b5f79] dark:bg-[#17263a]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">Kinderschutz aktivieren</p>
                <p className="text-xs text-muted-foreground">
                  Aktiv steuert Tabu-Themen, Lernziele und Tageslimits in Story- und Doku-Prompts.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEnabled((prev) => !prev)}
                className={`relative h-7 w-14 rounded-full transition ${enabled ? 'bg-[#b79f8e]' : 'bg-muted'}`}
              >
                <motion.span
                  animate={{ x: enabled ? 28 : 2 }}
                  className="absolute top-0.5 h-6 w-6 rounded-full bg-white"
                />
              </button>
            </div>
            <div className="mt-3 rounded-xl border border-[#e3d5ca] bg-[#f8f1e8] px-3 py-2 text-xs text-[#586b84] dark:border-[#3f546f] dark:bg-[#1b2d43] dark:text-[#a7bdd8]">
              <Info className="mr-1 inline h-3.5 w-3.5" />
              Regeln greifen bei neuen Generierungen. Bestehende Inhalte bleiben unveraendert.
            </div>
          </div>

          <KeywordEditor
            title="Tabu-Themen"
            subtitle="Diese Themen sollen in Storys und Dokus vermieden werden."
            icon={<Ban className="h-4 w-4" />}
            values={blockedThemes}
            presets={presets.blockedThemePresets}
            inputValue={themeInput}
            inputPlaceholder="z.B. horror"
            onInputChange={setThemeInput}
            onAdd={() => {
              addKeyword(themeInput, blockedThemes, setBlockedThemes);
              setThemeInput('');
            }}
            onRemove={(value) => setBlockedThemes((prev) => prev.filter((item) => item !== value))}
            onApplyPreset={(keywords) => setBlockedThemes((prev) => mergeKeywords(prev, keywords))}
          />

          <KeywordEditor
            title="Tabu-Woerter"
            subtitle="Diese Begriffe werden in neu generierten Texten geblockt."
            icon={<Ban className="h-4 w-4" />}
            values={blockedWords}
            presets={presets.blockedWordPresets}
            inputValue={wordInput}
            inputPlaceholder="z.B. beleidigung"
            onInputChange={setWordInput}
            onAdd={() => {
              addKeyword(wordInput, blockedWords, setBlockedWords);
              setWordInput('');
            }}
            onRemove={(value) => setBlockedWords((prev) => prev.filter((item) => item !== value))}
            onApplyPreset={(keywords) => setBlockedWords((prev) => mergeKeywords(prev, keywords))}
          />

          <KeywordEditor
            title="Lernziele"
            subtitle="Diese Ziele werden bei neuen Storys und Dokus bevorzugt."
            icon={<Target className="h-4 w-4" />}
            values={learningGoals}
            presets={presets.goalPresets}
            inputValue={goalInput}
            inputPlaceholder="z.B. teamarbeit"
            onInputChange={setGoalInput}
            onAdd={() => {
              addKeyword(goalInput, learningGoals, setLearningGoals);
              setGoalInput('');
            }}
            onRemove={(value) => setLearningGoals((prev) => prev.filter((item) => item !== value))}
            onApplyPreset={(keywords) => setLearningGoals((prev) => mergeKeywords(prev, keywords))}
          />

          <KeywordEditor
            title="Profil-/Pfad-Schlagwoerter"
            subtitle="Zusatz-Keywords fuer die inhaltliche Ausrichtung."
            icon={<Target className="h-4 w-4" />}
            values={profileKeywords}
            inputValue={profileInput}
            inputPlaceholder="z.B. natur"
            onInputChange={setProfileInput}
            onAdd={() => {
              addKeyword(profileInput, profileKeywords, setProfileKeywords);
              setProfileInput('');
            }}
            onRemove={(value) => setProfileKeywords((prev) => prev.filter((item) => item !== value))}
          />

          <div className="rounded-2xl border border-[#d6ccc2] bg-[#fffaf3] p-4 dark:border-[#425874] dark:bg-[#17263a]">
            <p className="text-sm font-bold text-foreground">Tageslimits (unabhaengig vom Abo)</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Schuetzt Credits davor, an einem einzigen Tag komplett verbraucht zu werden.
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-[#e3d5ca] bg-[#f8f1e8] p-3 dark:border-[#3f546f] dark:bg-[#1b2d43]">
                <p className="text-xs font-semibold text-muted-foreground">Storys pro Tag</p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDailyStoryLimit(null)}
                    className={`rounded-lg px-2 py-1 text-xs font-semibold ${dailyStoryLimit === null ? 'bg-[#d5bdaf] text-white' : 'bg-white text-[#49617c] dark:bg-[#20324a] dark:text-[#b5c9e2]'}`}
                  >
                    Unbegrenzt
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={dailyStoryLimit ?? ''}
                    onChange={(event) =>
                      setDailyStoryLimit(event.target.value === '' ? null : Number(event.target.value))
                    }
                    className="h-8 w-20 rounded-lg border border-[#d6ccc2] bg-white px-2 text-sm outline-none focus:border-[#b79f8e] dark:border-[#45607e] dark:bg-[#20324a]"
                    placeholder="z.B. 4"
                  />
                </div>
              </div>
              <div className="rounded-xl border border-[#e3d5ca] bg-[#f8f1e8] p-3 dark:border-[#3f546f] dark:bg-[#1b2d43]">
                <p className="text-xs font-semibold text-muted-foreground">Dokus pro Tag</p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDailyDokuLimit(null)}
                    className={`rounded-lg px-2 py-1 text-xs font-semibold ${dailyDokuLimit === null ? 'bg-[#d5bdaf] text-white' : 'bg-white text-[#49617c] dark:bg-[#20324a] dark:text-[#b5c9e2]'}`}
                  >
                    Unbegrenzt
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={dailyDokuLimit ?? ''}
                    onChange={(event) =>
                      setDailyDokuLimit(event.target.value === '' ? null : Number(event.target.value))
                    }
                    className="h-8 w-20 rounded-lg border border-[#d6ccc2] bg-white px-2 text-sm outline-none focus:border-[#b79f8e] dark:border-[#45607e] dark:bg-[#20324a]"
                    placeholder="z.B. 3"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#d6ccc2] bg-[#fff8ef] p-4 dark:border-[#4b5f79] dark:bg-[#17263a]">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
              <KeyRound className="h-4 w-4" />
              Eltern-PIN
            </div>
            {!controls.hasPin ? (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <input
                  type="password"
                  inputMode="numeric"
                  value={setupPin}
                  onChange={(event) => setSetupPin(event.target.value)}
                  placeholder="Neuer PIN (4-8 Ziffern)"
                  className="h-10 rounded-xl border border-[#d6ccc2] bg-white px-3 text-sm outline-none focus:border-[#b79f8e] dark:border-[#45607e] dark:bg-[#20324a]"
                />
                <input
                  type="password"
                  inputMode="numeric"
                  value={setupPinConfirm}
                  onChange={(event) => setSetupPinConfirm(event.target.value)}
                  placeholder="PIN bestaetigen"
                  className="h-10 rounded-xl border border-[#d6ccc2] bg-white px-3 text-sm outline-none focus:border-[#b79f8e] dark:border-[#45607e] dark:bg-[#20324a]"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <input
                  type="password"
                  inputMode="numeric"
                  value={nextPin}
                  onChange={(event) => setNextPin(event.target.value)}
                  placeholder="Neuer PIN (optional)"
                  className="h-10 rounded-xl border border-[#d6ccc2] bg-white px-3 text-sm outline-none focus:border-[#b79f8e] dark:border-[#45607e] dark:bg-[#20324a]"
                />
                <input
                  type="password"
                  inputMode="numeric"
                  value={nextPinConfirm}
                  onChange={(event) => setNextPinConfirm(event.target.value)}
                  placeholder="Neuer PIN bestaetigen"
                  className="h-10 rounded-xl border border-[#d6ccc2] bg-white px-3 text-sm outline-none focus:border-[#b79f8e] dark:border-[#45607e] dark:bg-[#20324a]"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={loadParental}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Neu laden
            </Button>
            <Button type="button" onClick={saveControls} disabled={saving}>
              {saving ? 'Speichere...' : 'Speichern'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function UsageCard(props: {
  title: string;
  subtitle: string;
  usage: CreditUsage;
  icon: React.ReactNode;
  accentClass: string;
}) {
  const limitText = props.usage.limit === null ? 'unbegrenzt' : String(props.usage.limit);
  const remainingText = props.usage.remaining === null ? 'unbegrenzt' : String(props.usage.remaining);
  const progress =
    props.usage.limit === null
      ? 24
      : props.usage.limit <= 0
      ? 100
      : Math.min(100, Math.round((props.usage.used / props.usage.limit) * 100));

  return (
    <div className="rounded-2xl border border-border bg-card/70 backdrop-blur-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{props.title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{props.subtitle}</p>
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${props.accentClass}`}>{props.icon}</div>
      </div>

      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-2xl font-bold text-foreground">{remainingText}</p>
          <p className="text-[11px] text-muted-foreground">verbleibend</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-foreground">{props.usage.used} / {limitText}</p>
          <p className="text-[11px] text-muted-foreground">verbraucht / limit</p>
        </div>
      </div>

      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-[#A989F2] to-[#FF6B9D]" style={{ width: `${progress}%` }} />
      </div>

      <p className="text-[11px] text-muted-foreground mt-2">Kosten: {props.usage.costPerGeneration} Credit pro Generierung</p>
    </div>
  );
}

function AudioLibraryPanel() {
  const backend = useBackend();
  const audioPlayer = useAudioPlayer();
  const { getToken } = useAuth();
  const backendUrl = getBackendUrl();
  const [items, setItems] = useState<GeneratedAudioLibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'story' | 'doku'>('all');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [playBusyKey, setPlayBusyKey] = useState<string | null>(null);
  const [offlineBusyId, setOfflineBusyId] = useState<string | null>(null);
  const [offlineSavedIds, setOfflineSavedIds] = useState<Set<string>>(new Set());

  const callAudioLibraryApi = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const token = await getToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(init?.headers as Record<string, string> | undefined),
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${backendUrl}${path}`, {
        ...init,
        headers,
        credentials: 'include',
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed with status ${response.status}`);
      }

      if (response.status === 204) {
        return {} as T;
      }

      const text = await response.text();
      if (!text) {
        return {} as T;
      }
      return JSON.parse(text) as T;
    },
    [backendUrl, getToken],
  );

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        sourceType: sourceFilter,
        sort,
        limit: '300',
        offset: '0',
      });
      const payload = await callAudioLibraryApi<GeneratedAudioListResponse>(
        `/story/audio-library?${params.toString()}`,
        { method: 'GET' },
      );
      setItems(Array.isArray(payload.items) ? payload.items : []);
    } catch (error) {
      console.error('Failed to load generated audio library:', error);
      toast.error('Audio-Bibliothek konnte nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [callAudioLibraryApi, sourceFilter, sort]);

  const loadOfflineSaved = useCallback(async () => {
    try {
      const offlineItems = await getAllOfflineGeneratedAudios();
      setOfflineSavedIds(new Set(offlineItems.map((entry) => entry.id)));
    } catch (error) {
      console.error('Failed to load offline audio library state:', error);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    void loadOfflineSaved();
  }, [loadOfflineSaved]);

  const groupedItems = useMemo<GroupedGeneratedAudio[]>(() => {
    const grouped = new Map<string, GroupedGeneratedAudio>();
    for (const entry of items) {
      const key = `${entry.sourceType}:${entry.sourceId}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.items.push(entry);
        if (new Date(entry.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
          existing.createdAt = entry.createdAt;
        }
        continue;
      }

      grouped.set(key, {
        key,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        sourceTitle: entry.sourceTitle,
        coverImageUrl: entry.coverImageUrl,
        createdAt: entry.createdAt,
        items: [entry],
      });
    }

    const groups = Array.from(grouped.values()).map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => {
        const orderA = Number.isFinite(a.itemOrder as number) ? (a.itemOrder as number) : Number.MAX_SAFE_INTEGER;
        const orderB = Number.isFinite(b.itemOrder as number) ? (b.itemOrder as number) : Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }),
    }));

    return groups.sort((a, b) => {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sort === 'newest' ? diff : -diff;
    });
  }, [items, sort]);

  const visibleGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return groupedItems;
    return groupedItems.filter((group) => {
      const chapterTitles = group.items
        .map((item) => `${item.itemTitle} ${item.itemSubtitle || ''}`)
        .join(' ');
      const haystack = `${group.sourceTitle} ${chapterTitles}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [groupedItems, query]);

  const formatDate = (value: string | Date) => {
    try {
      return new Intl.DateTimeFormat('de-DE', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value));
    } catch {
      return '-';
    }
  };

  const handleDeleteGroup = useCallback(
    async (group: GroupedGeneratedAudio) => {
      const confirmDelete = window.confirm(
        `"${group.sourceTitle}" wirklich loeschen? (${group.items.length} Audio-Teil(e))`,
      );
      if (!confirmDelete) return;

      try {
        setDeletingKey(group.key);
        await Promise.all(
          group.items.map((entry) =>
            callAudioLibraryApi(`/story/audio-library/${encodeURIComponent(entry.id)}`, {
              method: 'DELETE',
            }),
          ),
        );

        await Promise.all(group.items.map((entry) => removeGeneratedAudioOffline(entry.id).catch(() => undefined)));

        setItems((prev) =>
          prev.filter(
            (item) => !(item.sourceType === group.sourceType && item.sourceId === group.sourceId),
          ),
        );
        setOfflineSavedIds((prev) => {
          const next = new Set(prev);
          for (const entry of group.items) {
            next.delete(entry.id);
          }
          return next;
        });
        toast.success('Titel entfernt.');
      } catch (error) {
        console.error('Failed to delete generated audio:', error);
        toast.error('Titel konnte nicht geloescht werden.');
      } finally {
        setDeletingKey(null);
      }
    },
    [callAudioLibraryApi],
  );

  const handlePlayGroup = useCallback(
    async (group: GroupedGeneratedAudio) => {
      try {
        setPlayBusyKey(group.key);

        if (group.sourceType === 'story') {
          const existingIndex = audioPlayer.playlist.findIndex((item) => item.parentStoryId === group.sourceId);
          if (existingIndex >= 0) {
            audioPlayer.playFromPlaylist(existingIndex);
            return;
          }

          const story = await backend.story.get({ id: group.sourceId });
          const chapters = Array.isArray((story as any)?.chapters) ? ((story as any).chapters as any[]) : [];
          if (chapters.length === 0) {
            throw new Error('Story hat keine Kapitel.');
          }
          audioPlayer.startStoryConversion(
            group.sourceId,
            (story as any).title || group.sourceTitle,
            chapters as any,
            group.coverImageUrl,
            true,
          );
          return;
        }

        const existingIndex = audioPlayer.playlist.findIndex((item) => item.parentDokuId === group.sourceId);
        if (existingIndex >= 0) {
          audioPlayer.playFromPlaylist(existingIndex);
          return;
        }

        const doku = (await backend.doku.getDoku({ id: group.sourceId })) as DokuNarrationInput & { title?: string };
        const narration = buildDokuNarrationText(doku);
        if (!narration) {
          throw new Error('Doku hat keinen vorlesbaren Inhalt.');
        }

        audioPlayer.startDokuConversion(
          group.sourceId,
          doku.title || group.sourceTitle,
          narration,
          group.coverImageUrl,
          true,
        );
      } catch (error) {
        console.error('[AudioLibrary] Failed to play grouped audio item:', error);
        toast.error('Titel konnte nicht im Player gestartet werden.');
      } finally {
        setPlayBusyKey(null);
      }
    },
    [audioPlayer, backend],
  );

  const handleToggleOffline = useCallback(
    async (group: GroupedGeneratedAudio) => {
      try {
        setOfflineBusyId(group.key);
        const allSaved = group.items.length > 0 && group.items.every((item) => offlineSavedIds.has(item.id));

        if (allSaved) {
          await Promise.all(group.items.map((item) => removeGeneratedAudioOffline(item.id)));
          setOfflineSavedIds((prev) => {
            const next = new Set(prev);
            for (const item of group.items) {
              next.delete(item.id);
            }
            return next;
          });
          toast.success('Offline-Audio entfernt.');
          return;
        }

        await Promise.all(group.items.map((item) => saveGeneratedAudioOffline(item)));

        if (group.sourceType === 'story') {
          try {
            const story = await backend.story.get({ id: group.sourceId });
            await saveStoryOffline(story as any);
          } catch (error) {
            console.warn('[AudioLibrary] Story offline save failed:', error);
          }
        } else {
          try {
            const doku = await backend.doku.getDoku({ id: group.sourceId });
            await saveDokuOffline(doku as any);
          } catch (error) {
            console.warn('[AudioLibrary] Doku offline save failed:', error);
          }
        }

        setOfflineSavedIds((prev) => {
          const next = new Set(prev);
          for (const item of group.items) {
            next.add(item.id);
          }
          return next;
        });
        toast.success('Audio + zugehoeriger Inhalt offline gespeichert.');
      } catch (error) {
        console.error('Failed to toggle offline generated audio:', error);
        toast.error('Offline-Speicherung fehlgeschlagen.');
      } finally {
        setOfflineBusyId(null);
      }
    },
    [backend, offlineSavedIds],
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
            Audio-Bibliothek
          </h2>
          <p className="text-xs text-muted-foreground">
            Persistente Story- und Doku-Audios aus dem Player (geraeteuebergreifend).
          </p>
        </div>
        <Button type="button" variant="outline" onClick={loadItems} disabled={loading}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Aktualisieren
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Titel suchen..."
          className="h-9 rounded-xl border border-[#d6ccc2] bg-white px-3 text-sm text-[#2a3a4d] outline-none placeholder:text-[#93a3b8] focus:border-[#b79f8e] dark:border-[#47607c] dark:bg-[#20324a] dark:text-[#e6effd] dark:placeholder:text-[#8ea3bf]"
        />
        <select
          value={sourceFilter}
          onChange={(event) => setSourceFilter(event.target.value as 'all' | 'story' | 'doku')}
          className="h-9 rounded-xl border border-[#d6ccc2] bg-white px-3 text-sm text-[#2a3a4d] outline-none focus:border-[#b79f8e] dark:border-[#47607c] dark:bg-[#20324a] dark:text-[#e6effd]"
        >
          <option value="all">Alle Typen</option>
          <option value="story">Story</option>
          <option value="doku">Doku</option>
        </select>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as 'newest' | 'oldest')}
          className="h-9 rounded-xl border border-[#d6ccc2] bg-white px-3 text-sm text-[#2a3a4d] outline-none focus:border-[#b79f8e] dark:border-[#47607c] dark:bg-[#20324a] dark:text-[#e6effd]"
        >
          <option value="newest">Neueste zuerst</option>
          <option value="oldest">Aelteste zuerst</option>
        </select>
        <div className="h-9 inline-flex items-center justify-end text-xs text-muted-foreground">
          {visibleGroups.length} Titel
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card/70 p-5 text-sm text-muted-foreground">
          Lade Audio-Bibliothek...
        </div>
      ) : visibleGroups.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card/70 p-5 text-sm text-muted-foreground">
          Keine gespeicherten Audios gefunden.
        </div>
      ) : (
        <div className="space-y-3">
          {visibleGroups.map((group) => {
            const isStory = group.sourceType === 'story';
            const savedCount = group.items.filter((item) => offlineSavedIds.has(item.id)).length;
            const isOfflineSaved = savedCount > 0 && savedCount === group.items.length;
            const isBusyOffline = offlineBusyId === group.key;
            const isDeleting = deletingKey === group.key;
            const isPlayBusy = playBusyKey === group.key;
            const chapterCount = new Set(
              group.items.map((item) => `${item.itemOrder ?? ''}:${(item.itemTitle || '').trim()}`),
            ).size;
            return (
              <div key={group.key} className="rounded-2xl border border-border bg-card/70 p-4">
                <div className="flex items-start gap-3">
                  <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted shrink-0">
                    {group.coverImageUrl ? (
                      <img src={group.coverImageUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${isStory ? 'bg-[#A989F2]/15 text-[#7C6BE3]' : 'bg-[#2DD4BF]/15 text-[#0EA5E9]'}`}>
                        {isStory ? 'Story' : 'Doku'}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{formatDate(group.createdAt)}</span>
                      <span className="text-[11px] text-muted-foreground">{chapterCount} Kapitel/Teile</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-foreground truncate">{group.sourceTitle}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Wird im Player kapitelweise abgespielt.
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => void handlePlayGroup(group)} disabled={isPlayBusy}>
                    <Headphones className="mr-2 h-4 w-4" />
                    {isPlayBusy ? 'Bereite vor...' : 'Im Player abspielen'}
                  </Button>
                  <Button
                    type="button"
                    variant={isOfflineSaved ? 'default' : 'outline'}
                    className={isOfflineSaved ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : undefined}
                    onClick={() => void handleToggleOffline(group)}
                    disabled={isBusyOffline}
                  >
                    {isOfflineSaved ? <Check className="mr-2 h-4 w-4" /> : null}
                    {isBusyOffline
                      ? 'Speichere...'
                      : isOfflineSaved
                      ? 'Offline entfernen'
                      : 'Offline speichern'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void handleDeleteGroup(group)} disabled={isDeleting}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {isDeleting ? 'Loesche...' : 'Loeschen'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SignOutPanel() {
  const { signOut } = useClerk();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#d5bdaf] to-[#e3d5ca] flex items-center justify-center shadow-md">
            <LogOut className="w-5 h-5 text-[#2f4058]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
              Abmelden
            </h2>
            <p className="text-xs text-muted-foreground">Sichere Abmeldung von deinem Talea Konto.</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#d6ccc2] bg-[#fff8ef] p-5 dark:border-[#4b5f79] dark:bg-[#17263a]">
        <p className="text-sm text-muted-foreground mb-4">
          Du kannst dich jederzeit abmelden und spaeter mit demselben Konto wieder einloggen.
        </p>
        <Button type="button" onClick={handleSignOut} disabled={isSigningOut} className="bg-[#c68d8d] hover:bg-[#b87878] text-white">
          <LogOut className="mr-2 h-4 w-4" />
          {isSigningOut ? 'Abmeldung...' : 'Jetzt abmelden'}
        </Button>
      </div>
    </div>
  );
}

function BillingPanel() {
  const backend = useBackend();
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadBilling = async () => {
    try {
      setIsLoading(true);
      const nextProfile = (await backend.user.me()) as unknown as ProfileSnapshot;
      setProfile(nextProfile);
    } catch (err) {
      console.error('Failed to load billing profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBilling();
  }, [backend]);

  const billing = profile?.billing ?? null;
  const currentPlan = billing?.plan ?? profile?.subscription ?? 'free';
  const currentPlanMeta = PLAN_META[currentPlan];
  const CurrentPlanIcon = currentPlanMeta.icon;
  const periodStartLabel = useMemo(() => {
    if (!billing?.periodStart) return '-';
    return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(new Date(billing.periodStart));
  }, [billing?.periodStart]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2DD4BF] to-[#0EA5E9] flex items-center justify-center shadow-md">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
              Abo & Credits
            </h2>
            <p className="text-xs text-muted-foreground">Monatliche Credits, Verbrauch und Planwechsel in einem Bereich.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={loadBilling}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Aktualisieren
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-card/70 p-5 text-sm text-muted-foreground">
          Lade Billing-Daten...
        </div>
      ) : billing ? (
        <>
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card/70 backdrop-blur-lg p-5">
            <div className={`absolute -top-14 -right-10 h-32 w-32 rounded-full blur-2xl opacity-40 bg-gradient-to-br ${currentPlanMeta.gradient}`} />
            <div className="relative flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${currentPlanMeta.gradient}`}>
                  <CurrentPlanIcon className="h-5 w-5 text-white" />
                </span>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Aktueller Plan</p>
                  <h3 className="text-xl font-bold text-foreground">{currentPlanMeta.title}</h3>
                  <p className="text-xs text-muted-foreground">Abrechnungsmonat: {periodStartLabel}</p>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${billing.permissions.canReadCommunityDokus ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'}`}>
                  Community: {billing.permissions.canReadCommunityDokus ? 'aktiv' : 'gesperrt'}
                </span>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${billing.permissions.canUseAudioDokus ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'}`}>
                  Audio: {billing.permissions.canUseAudioDokus ? 'aktiv' : 'gesperrt'}
                </span>
              </div>
            </div>
          </div>

          {currentPlan === 'free' && (
            <div
              className={`rounded-2xl border p-4 text-sm ${
                billing.permissions.freeTrialActive
                  ? 'border-[#A989F2]/30 bg-[#A989F2]/10 text-foreground'
                  : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-200'
              }`}
            >
              {billing.permissions.freeTrialActive ? (
                <div className="flex items-center gap-2">
                  <Clock3 className="w-4 h-4" />
                  <span>
                    Free-Testphase aktiv: noch {billing.permissions.freeTrialDaysRemaining} Tage.
                    Danach keine Generierung, keine Community-Dokus und keine Audio-Dokus.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Clock3 className="w-4 h-4" />
                  <span>
                    Free-Testphase abgelaufen. Upgrade auf Starter, Familie oder Premium, um weiter zu generieren.
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <UsageCard
              title="StoryCredits"
              subtitle="1 Story = 1 Credit"
              usage={billing.storyCredits}
              icon={<BookOpen className="w-4 h-4 text-white" />}
              accentClass="bg-gradient-to-br from-[#A989F2] to-[#7C6BE3]"
            />
            <UsageCard
              title="DokuCredits"
              subtitle="1 Doku = 1 Credit"
              usage={billing.dokuCredits}
              icon={<FileText className="w-4 h-4 text-white" />}
              accentClass="bg-gradient-to-br from-[#2DD4BF] to-[#0EA5E9]"
            />
            <UsageCard
              title="AudioCredits"
              subtitle="1 Audio-Doku = 1 Credit"
              usage={billing.audioCredits}
              icon={<Headphones className="w-4 h-4 text-white" />}
              accentClass="bg-gradient-to-br from-[#FF9B5C] to-[#FF6B9D]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {(Object.keys(PLAN_META) as SubscriptionPlan[]).map((plan) => {
              const meta = PLAN_META[plan];
              const PlanIcon = meta.icon;
              const active = currentPlan === plan;
              return (
                <div
                  key={plan}
                  className={`relative rounded-2xl border p-4 ${
                    active
                      ? 'border-[#A989F2] bg-[#A989F2]/10 shadow-lg shadow-[#A989F2]/10'
                      : 'border-border bg-card/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${meta.gradient}`}>
                        <PlanIcon className="h-4 w-4 text-white" />
                      </span>
                      <p className="text-sm font-bold text-foreground">{meta.title}</p>
                    </div>
                    {active && <span className="text-[10px] font-bold uppercase tracking-wider text-[#A989F2]">Aktiv</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">Story: {meta.storyLimit}</p>
                  <p className="text-xs text-muted-foreground">Doku: {meta.dokuLimit}</p>
                  <p className="text-xs text-muted-foreground">Audio: {meta.audioLimit}</p>
                  <p className="text-xs text-muted-foreground mt-1">Community: {meta.community}</p>
                </div>
              );
            })}
          </div>

          <div id="billing-plan-switcher" className="rounded-2xl border border-[#A989F2]/30 bg-card/70 backdrop-blur-lg p-4 md:p-5">
            <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-bold text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
                  Plan in Clerk Billing wechseln
                </h3>
                <p className="text-xs text-muted-foreground">
                  Der Checkout oeffnet als eigenes Fenster. Nach erfolgreichem Wechsel hier auf `Aktualisieren` klicken.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-[#A989F2] bg-[#A989F2]/10 rounded-full px-3 py-1">
                Monatlich wechselbar
              </span>
            </div>

            <div className="rounded-2xl border border-border bg-card/80 p-2 md:p-3">
              <PricingTable
                ctaPosition="bottom"
                newSubscriptionRedirectUrl="/settings?billing=success"
                checkoutProps={{
                  appearance: {
                    elements: {
                      drawerBackdrop: 'z-[5000] !fixed',
                      drawerRoot: 'z-[5001] !fixed',
                      drawerContent: 'z-[5002] !fixed',
                      modalBackdrop: 'z-[5000] !fixed',
                      modalContent: 'z-[5002] !fixed',
                    },
                  },
                }}
              />
            </div>
          </div>

        </>
      ) : (
        <div className="rounded-2xl border border-border bg-card/70 p-5 text-sm text-muted-foreground">
          Billing-Daten konnten nicht geladen werden.
        </div>
      )}
    </div>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    if (!location.search.includes('section=billing')) return;
    const handle = window.setTimeout(() => {
      document.getElementById('billing-plan-switcher')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 320);
    return () => window.clearTimeout(handle);
  }, [location.search]);

  return (
    <div className="min-h-screen relative pb-28 bg-[linear-gradient(180deg,#f5ebe0_0%,#edede9_100%)] dark:bg-[linear-gradient(180deg,#111b29_0%,#152235_100%)]">
      <SettingsBackground />

      <div className="relative z-10 pt-6">
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#d5bdaf] via-[#e3d5ca] to-[#d6ccc2] flex items-center justify-center shadow-xl shadow-[#d5bdaf]/35"
            >
              <Settings className="w-7 h-7 text-[#2f4058]" />
            </motion.div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
                {t('settings.title')}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">{t('settings.subtitle')}</p>
            </div>
          </div>
        </motion.div>

        <div className="rounded-3xl bg-card/70 backdrop-blur-xl border border-border shadow-xl overflow-visible md:overflow-hidden min-h-[72vh] md:min-h-[calc(100vh-170px)]">
          <UserProfile
            appearance={{
              baseTheme: undefined,
              elements: {
                rootBox: 'talea-settings-profile w-full !max-w-none !min-w-0',
                cardBox: '!w-full !max-w-none !min-w-0 !h-auto md:!h-[calc(100vh-170px)]',
                card: '!h-auto md:!h-full !w-full !max-w-none !min-w-0 shadow-none bg-transparent',
                navbar: 'bg-card/70 backdrop-blur-lg border-b md:border-b-0 md:border-r border-[#d6ccc2] dark:border-[#4a5f78] !w-full !max-w-none',
                navbarButtons: '!flex !flex-col !gap-1.5 !w-full',
                navbarButton: 'text-foreground/70 hover:bg-accent/70 rounded-xl transition-all',
                navbarButtonActive: 'bg-[#f5ebe0] text-[#425b78] dark:bg-[#223850] dark:text-[#c9dbf1] font-semibold',
                navbarMobileMenuRow:
                  'hidden md:flex items-center justify-between px-3 py-2 border-b border-[#d6ccc2] dark:border-[#4a5f78] bg-card/70',
                navbarMobileMenuButton:
                  'hidden md:inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#d6ccc2] dark:border-[#4a5f78] bg-[#f5ebe0] dark:bg-[#223850] text-[#425b78] dark:text-[#c9dbf1]',
                pageScrollBox: '!h-auto md:!h-full !min-w-0 bg-transparent',
                page: '!h-auto md:!h-full !min-w-0 bg-transparent',
                formButtonPrimary: 'bg-gradient-to-r from-[#f2d9d6] via-[#e3d5ca] to-[#d5e3cf] hover:opacity-90 text-[#22344c] rounded-xl shadow-lg',
                formFieldInput: 'rounded-xl border-[#d6ccc2] dark:border-[#4a617a] bg-card/70 backdrop-blur-lg',
              },
            }}
          >
            <UserProfile.Page
              label={t('settings.language')}
              labelIcon={<Languages className="w-4 h-4" />}
              url="language"
            >
              <LanguageSelector />
            </UserProfile.Page>

            <UserProfile.Page
              label={t('settings.appearance')}
              labelIcon={<Sun className="w-4 h-4" />}
              url="appearance"
            >
              <ThemeSelector />
            </UserProfile.Page>

            <UserProfile.Page label="Zahlung" labelIcon={<CreditCard className="w-4 h-4" />} url="billing">
              <BillingPanel />
            </UserProfile.Page>

            <UserProfile.Page
              label="Eltern Dashboard"
              labelIcon={<Shield className="w-4 h-4" />}
              url="parental"
            >
              <ParentalDashboardPanel />
            </UserProfile.Page>

            <UserProfile.Page
              label="Audio-Bibliothek"
              labelIcon={<Headphones className="w-4 h-4" />}
              url="audio-library"
            >
              <AudioLibraryPanel />
            </UserProfile.Page>

            <UserProfile.Page label={t('navigation.logout')} labelIcon={<LogOut className="w-4 h-4" />} url="logout">
              <SignOutPanel />
            </UserProfile.Page>
          </UserProfile>
        </div>
      </div>
    </div>
  );
}
