import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBackend } from '../../hooks/useBackend';
import { useUser } from '@clerk/clerk-react';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../../src/i18n';
import { useTheme } from '../../contexts/ThemeContext';
import { toast } from 'sonner';
import { Sun, Moon, Monitor } from 'lucide-react';

type ThemeOption = 'light' | 'dark' | 'system';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const backend = useBackend();
  const { user, isLoaded } = useUser();
  const { theme, setTheme: setGlobalTheme } = useTheme();

  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(
    (i18n.language as SupportedLanguage) || 'de'
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load user's preferred language from backend
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
      // Update language in backend
      await backend.user.updateLanguage({ language });

      // Update i18n
      await i18n.changeLanguage(language);
      setSelectedLanguage(language);

      // Save to localStorage
      localStorage.setItem('talea_language', language);

      toast.success(t('settings.saved'));
    } catch (err) {
      console.error('Failed to save language:', err);
      toast.error(t('settings.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {t('settings.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{t('settings.subtitle')}</p>
        </div>

        {/* Settings Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {/* Theme Section */}
          <div className="mb-8 pb-8 border-b border-gray-200 dark:border-gray-700">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
                Darstellung
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Wähle zwischen hellem, dunklem oder automatischem Modus
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { value: 'light' as ThemeOption, icon: Sun, label: 'Hell', description: 'Helles Theme' },
                { value: 'dark' as ThemeOption, icon: Moon, label: 'Dunkel', description: 'Dunkles Theme' },
                { value: 'system' as ThemeOption, icon: Monitor, label: 'System', description: 'Automatisch' },
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
                    {/* Selected indicator */}
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

          {/* Language Section */}
          <div className="mb-8">
            <div className="mb-4">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
                {t('settings.language')}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('settings.languageDescription')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  {/* Selected indicator */}
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
          </div>

          {/* Current Language Info */}
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
                {SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage)
                  ?.nativeName}
              </span>
            </div>
          </div>

          {/* Additional Settings Sections (Placeholder) */}
          <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
              {t('settings.account')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {t('settings.subscription')}:{' '}
              <span className="font-semibold text-purple-600 dark:text-purple-400">
                {/* This will be populated from user profile */}
                Starter
              </span>
            </p>
          </div>
        </div>

        {/* App Version */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          {t('settings.version')}: 1.0.0 (i18n + dark mode enabled)
        </div>
      </div>
    </div>
  );
}
