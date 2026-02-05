import React, { useState, useEffect } from 'react';
import { UserProfile, PricingTable } from '@clerk/clerk-react';
import { useTranslation } from 'react-i18next';
import { useBackend } from '../../hooks/useBackend';
import { useUser } from '@clerk/clerk-react';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../../src/i18n';
import { useTheme } from '../../contexts/ThemeContext';
import { toast } from 'sonner';
import { Sun, Moon, Monitor, Languages, CreditCard, Sparkles, Users, Crown, BookOpen, FileText } from 'lucide-react';

type ThemeOption = 'light' | 'dark' | 'system';

type SubscriptionPlan = 'starter' | 'familie' | 'premium';

const PLAN_CARDS: Array<{
  id: SubscriptionPlan;
  icon: typeof Sparkles;
  stories: number;
  dokus: number;
  accent: string;
  glow: string;
}> = [
  {
    id: 'starter',
    icon: Sparkles,
    stories: 5,
    dokus: 3,
    accent: 'from-rose-200/70 to-purple-200/70',
    glow: 'bg-gradient-to-br from-rose-200/70 to-purple-200/70',
  },
  {
    id: 'familie',
    icon: Users,
    stories: 20,
    dokus: 10,
    accent: 'from-amber-200/70 to-emerald-200/70',
    glow: 'bg-gradient-to-br from-amber-200/70 to-emerald-200/70',
  },
  {
    id: 'premium',
    icon: Crown,
    stories: 60,
    dokus: 30,
    accent: 'from-sky-200/70 to-indigo-200/70',
    glow: 'bg-gradient-to-br from-sky-200/70 to-indigo-200/70',
  },
];

// Custom Language Selection Component for Clerk UserProfile
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
        <div className="flex items-center gap-2 mb-2">
          <Languages className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
            {t('settings.language')}
          </h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('settings.languageDescription')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            disabled={isSaving}
            className={`
              relative p-4 rounded-xl border-2 transition-all duration-200
              ${
                selectedLanguage === lang.code
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 shadow-md'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20'
              }
              ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {selectedLanguage === lang.code && (
              <div className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            )}

            <div className="flex items-center gap-3">
              <span className="text-3xl">{lang.flag}</span>
              <div className="text-left">
                <div className="font-semibold text-gray-900 dark:text-gray-100">
                  {lang.nativeName}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{lang.name}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="font-medium">
            {t('settings.currentLanguage')}:{' '}
            {SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage)?.nativeName}
          </span>
        </div>
      </div>
    </div>
  );
}

// Custom Theme Selection Component for Clerk UserProfile
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

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
          {t('settings.themeTitle')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('settings.themeDescription')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { value: 'light' as ThemeOption, icon: Sun, label: t('settings.light'), description: t('settings.lightDescription') },
          { value: 'dark' as ThemeOption, icon: Moon, label: t('settings.dark'), description: t('settings.darkDescription') },
          { value: 'system' as ThemeOption, icon: Monitor, label: t('settings.system'), description: t('settings.systemDescription') },
        ].map((themeOption) => {
          const Icon = themeOption.icon;
          return (
            <button
              key={themeOption.value}
              onClick={() => handleThemeChange(themeOption.value)}
              className={`
                relative p-4 rounded-xl border-2 transition-all duration-200
                ${
                  theme === themeOption.value
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 shadow-md'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                }
              `}
            >
              {theme === themeOption.value && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}

              <div className="flex flex-col items-center gap-3">
                <Icon
                  className={`w-8 h-8 ${
                    theme === themeOption.value
                      ? 'text-purple-600 dark:text-purple-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                />
                <div className="text-center">
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {themeOption.label}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {themeOption.description}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
        if (active) {
          setCurrentPlan(profile.subscription as SubscriptionPlan);
        }
      } catch (err) {
        console.error('Failed to load subscription plan:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadPlan();
    return () => {
      active = false;
    };
  }, [backend]);

  return (
    <div className="p-6">
      <div className="flex items-start gap-4 mb-6">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
          <CreditCard className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {t('settings.subscription')} &amp; {t('settings.billing')}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Wähle dein Abo und verwalte deine Monatslimits.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLAN_CARDS.map((plan) => {
          const Icon = plan.icon;
          const isActive = currentPlan === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative overflow-hidden rounded-2xl border transition-all duration-200 ${
                isActive
                  ? 'border-purple-400/70 shadow-xl ring-2 ring-purple-300/50'
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300/60 dark:hover:border-purple-600/40'
              }`}
            >
              <div className={`absolute -top-12 -right-12 h-28 w-28 rounded-full blur-2xl ${plan.glow}`} />
              <div className="relative p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${plan.accent}`}>
                      <Icon className="h-5 w-5 text-gray-900/70" />
                    </span>
                    <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {t(`settings.subscriptionPlans.${plan.id}`)}
                    </span>
                  </div>
                  {isActive && (
                    <span className="text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 px-2 py-1 rounded-full">
                      Aktiv
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/70 dark:bg-gray-900/40 border border-white/60 dark:border-gray-700/60 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      <BookOpen className="h-4 w-4" />
                      {t('admin.stories')}
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                      {plan.stories}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">pro Monat</div>
                  </div>
                  <div className="rounded-xl bg-white/70 dark:bg-gray-900/40 border border-white/60 dark:border-gray-700/60 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      <FileText className="h-4 w-4" />
                      {t('admin.dokus')}
                    </div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                      {plan.dokus}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">pro Monat</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-purple-200 dark:border-purple-800 bg-white/80 dark:bg-gray-900/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              Abo auswählen
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isLoading && currentPlan === null ? 'Lade dein aktuelles Abo...' : 'Abrechnung läuft über Clerk Billing.'}
            </p>
          </div>
          {currentPlan && (
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
              Aktuell: {t(`settings.subscriptionPlans.${currentPlan}`)}
            </span>
          )}
        </div>
        <div id="pricing-table" className="rounded-xl overflow-hidden">
          <PricingTable ctaPosition="bottom" newSubscriptionRedirectUrl="/settings?billing=success" />
        </div>
      </div>
    </div>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {t('settings.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{t('settings.subtitle')}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
          <UserProfile
            appearance={{
              baseTheme: undefined,
              elements: {
                rootBox: 'w-full',
                card: 'shadow-none bg-transparent',
                navbar: 'bg-gray-50 dark:bg-gray-900',
                navbarButton: 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
                navbarButtonActive: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
                pageScrollBox: 'bg-white dark:bg-gray-800',
                page: 'bg-white dark:bg-gray-800',
                formButtonPrimary: 'bg-purple-600 hover:bg-purple-700 text-white',
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
        </div>
      </div>
    </div>
  );
}
