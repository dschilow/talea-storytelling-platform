// Talea Settings Screen - Professional, immersive settings experience
// Redesigned with Talea design system: glass-morphism, animations, gradient accents

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserProfile, PricingTable } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';
import { useBackend } from '../../hooks/useBackend';
import { useUser } from '@clerk/clerk-react';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../../src/i18n';
import { useTheme } from '../../contexts/ThemeContext';
import { toast } from 'sonner';
import {
  Sun, Moon, Monitor, Languages, CreditCard, Sparkles, Users,
  Crown, BookOpen, FileText, Settings, Check, Globe
} from 'lucide-react';

type ThemeOption = 'light' | 'dark' | 'system';
type SubscriptionPlan = 'starter' | 'familie' | 'premium';

const PLAN_CARDS: Array<{
  id: SubscriptionPlan;
  icon: typeof Sparkles;
  stories: number;
  dokus: number;
  gradient: string;
  shadow: string;
}> = [
  { id: 'starter', icon: Sparkles, stories: 5, dokus: 3, gradient: 'from-[#FF6B9D] to-[#A989F2]', shadow: 'shadow-[#A989F2]/15' },
  { id: 'familie', icon: Users, stories: 20, dokus: 10, gradient: 'from-[#2DD4BF] to-[#0EA5E9]', shadow: 'shadow-[#2DD4BF]/15' },
  { id: 'premium', icon: Crown, stories: 60, dokus: 30, gradient: 'from-[#FF9B5C] to-[#FF6B9D]', shadow: 'shadow-[#FF9B5C]/15' },
];

// =====================================================
// ANIMATED BACKGROUND
// =====================================================
const SettingsBackground: React.FC = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
    <motion.div
      className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-15"
      style={{ background: 'radial-gradient(circle, rgba(169,137,242,0.4) 0%, rgba(255,107,157,0.2) 50%, transparent 70%)' }}
      animate={{ scale: [1, 1.15, 1], x: [0, 20, 0] }}
      transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full opacity-15"
      style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.3) 0%, transparent 70%)' }}
      animate={{ scale: [1, 1.2, 1], y: [0, -20, 0] }}
      transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
    />
  </div>
);

// =====================================================
// LANGUAGE SELECTOR
// =====================================================
function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const backend = useBackend();
  const { user, isLoaded } = useUser();
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(
    (i18n.language as SupportedLanguage) || 'de'
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isLoaded && user && backend) {
      loadUserLanguage();
    }
  }, [isLoaded, user, backend]);

  const loadUserLanguage = async () => {
    try {
      const profile = await backend.user.me();
      if (profile.preferredLanguage) {
        setSelectedLanguage(profile.preferredLanguage);
        i18n.changeLanguage(profile.preferredLanguage);
      }
    } catch (err) {
      console.error('Failed to load user language:', err);
    }
  };

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
        {SUPPORTED_LANGUAGES.map((lang, i) => (
          <motion.button
            key={lang.code}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleLanguageChange(lang.code)}
            disabled={isSaving}
            className={`relative p-4 rounded-2xl border-2 transition-all ${
              selectedLanguage === lang.code
                ? 'border-[#A989F2] bg-[#A989F2]/10 shadow-lg shadow-[#A989F2]/10'
                : 'border-white/[0.08] bg-white/[0.06] hover:border-[#A989F2]/40 hover:shadow-md hover:bg-white/[0.10]'
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

      <div className="mt-6 p-4 bg-[#A989F2]/5 border border-[#A989F2]/20 rounded-2xl">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <Languages className="w-4 h-4 text-[#A989F2]" />
          <span className="font-medium">
            {t('settings.currentLanguage')}:{' '}
            <strong>{SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage)?.nativeName}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// THEME SELECTOR
// =====================================================
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
    { value: 'light' as ThemeOption, icon: Sun, label: t('settings.light'), description: t('settings.lightDescription'), emoji: '☀️' },
    { value: 'dark' as ThemeOption, icon: Moon, label: t('settings.dark'), description: t('settings.darkDescription'), emoji: '🌙' },
    { value: 'system' as ThemeOption, icon: Monitor, label: t('settings.system'), description: t('settings.systemDescription'), emoji: '💻' },
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
                  : 'border-white/[0.08] bg-white/[0.06] hover:border-[#FF9B5C]/40 hover:shadow-md hover:bg-white/[0.10]'
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
                <span className="text-3xl">{option.emoji}</span>
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

// =====================================================
// BILLING PANEL
// =====================================================
function BillingPanel() {
  const { t } = useTranslation();
  const backend = useBackend();
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const loadPlan = async () => {
      try {
        setIsLoading(true);
        const profile = await backend.user.me();
        if (active) setCurrentPlan(profile.subscription as SubscriptionPlan);
      } catch (err) {
        console.error('Failed to load subscription plan:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    loadPlan();
    return () => { active = false; };
  }, [backend]);

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2DD4BF] to-[#0EA5E9] flex items-center justify-center shadow-md">
          <CreditCard className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
            {t('settings.subscription')} & {t('settings.billing')}
          </h2>
          <p className="text-xs text-muted-foreground">Wähle dein Abo und verwalte deine Monatslimits.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLAN_CARDS.map((plan, i) => {
          const Icon = plan.icon;
          const isActive = currentPlan === plan.id;

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`relative overflow-hidden rounded-2xl border-2 transition-all ${
                isActive
                  ? 'border-[#A989F2] shadow-xl ring-2 ring-[#A989F2]/20 bg-[#A989F2]/5'
                  : 'border-white/[0.08] bg-white/[0.06] hover:shadow-lg hover:bg-white/[0.10]'
              }`}
            >
              {/* Gradient glow */}
              <div className={`absolute -top-12 -right-12 h-28 w-28 rounded-full blur-2xl opacity-40 bg-gradient-to-br ${plan.gradient}`} />

              <div className="relative p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${plan.gradient} shadow-md ${plan.shadow}`}>
                      <Icon className="h-5 w-5 text-white" />
                    </span>
                    <span className="text-lg font-bold text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
                      {t(`settings.subscriptionPlans.${plan.id}`)}
                    </span>
                  </div>
                  {isActive && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-[10px] font-bold uppercase tracking-wider text-[#A989F2] bg-[#A989F2]/10 px-2 py-1 rounded-full"
                    >
                      Aktiv
                    </motion.span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/[0.06] border border-white/[0.08] p-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <BookOpen className="h-3.5 w-3.5" />
                      {t('admin.stories')}
                    </div>
                    <div className="text-2xl font-bold text-foreground mt-1.5">{plan.stories}</div>
                    <div className="text-[10px] text-muted-foreground">pro Monat</div>
                  </div>
                  <div className="rounded-xl bg-white/[0.06] border border-white/[0.08] p-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <FileText className="h-3.5 w-3.5" />
                      {t('admin.dokus')}
                    </div>
                    <div className="text-2xl font-bold text-foreground mt-1.5">{plan.dokus}</div>
                    <div className="text-[10px] text-muted-foreground">pro Monat</div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-[#A989F2]/30 bg-white/[0.06] backdrop-blur-lg p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
              Abo auswählen
            </h3>
            <p className="text-xs text-muted-foreground">
              {isLoading && currentPlan === null ? 'Lade dein aktuelles Abo...' : 'Abrechnung läuft über Clerk Billing.'}
            </p>
          </div>
          {currentPlan && (
            <span className="text-xs font-semibold text-foreground bg-muted px-3 py-1 rounded-full">
              Aktuell: {t(`settings.subscriptionPlans.${currentPlan}`)}
            </span>
          )}
        </div>
        <div className="rounded-xl overflow-hidden">
          <PricingTable ctaPosition="bottom" newSubscriptionRedirectUrl="/settings?billing=success" />
        </div>
      </div>
    </div>
  );
}

// =====================================================
// MAIN SETTINGS SCREEN
// =====================================================
export default function SettingsScreen() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen relative pb-28">
      <SettingsBackground />

      <div className="relative z-10 pt-6">
        {/* Header */}
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
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#A989F2] to-[#FF6B9D] flex items-center justify-center shadow-xl shadow-[#A989F2]/25"
            >
              <Settings className="w-7 h-7 text-white" />
            </motion.div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight" style={{ fontFamily: '"Fredoka", "Nunito", sans-serif' }}>
                {t('settings.title')}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">{t('settings.subtitle')}</p>
            </div>
          </div>
        </motion.div>

        {/* Clerk UserProfile with custom pages */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-3xl bg-white/[0.06] backdrop-blur-xl border border-white/[0.08] shadow-xl overflow-hidden"
        >
          <UserProfile
            appearance={{
              baseTheme: undefined,
              elements: {
                rootBox: 'w-full',
                card: 'shadow-none bg-transparent',
                navbar: 'bg-white/[0.04] backdrop-blur-lg border-r border-white/[0.06]',
                navbarButton: 'text-foreground/70 hover:bg-white/[0.08] rounded-xl transition-all',
                navbarButtonActive: 'bg-[#A989F2]/10 text-[#A989F2] font-semibold',
                pageScrollBox: 'bg-transparent',
                page: 'bg-transparent',
                formButtonPrimary: 'bg-gradient-to-r from-[#A989F2] to-[#FF6B9D] hover:opacity-90 text-white rounded-xl shadow-lg',
                formFieldInput: 'rounded-xl border-white/[0.08] bg-white/[0.06] backdrop-blur-lg',
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

            <UserProfile.Page
              label={`${t('settings.subscription')} & ${t('settings.billing')}`}
              labelIcon={<CreditCard className="w-4 h-4" />}
              url="billing"
            >
              <BillingPanel />
            </UserProfile.Page>
          </UserProfile>
        </motion.div>
      </div>
    </div>
  );
}
