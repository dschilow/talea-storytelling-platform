import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import type { BackendModule } from 'i18next';

import de from './locales/de.json';

// Supported languages configuration
export const SUPPORTED_LANGUAGES = [
  { code: 'de', name: 'Deutsch', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]['code'];

// Keep the German fallback synchronous. Other languages are separate chunks;
// Workbox precaches them so changing language still works offline.
const localeLoaders = {
  en: () => import('./locales/en.json'),
  fr: () => import('./locales/fr.json'),
  es: () => import('./locales/es.json'),
  it: () => import('./locales/it.json'),
  nl: () => import('./locales/nl.json'),
  ru: () => import('./locales/ru.json'),
};
const localeBackend: BackendModule = {
  type: 'backend',
  init() {},
  read(language, _namespace, callback) {
    const load = localeLoaders[language as keyof typeof localeLoaders];
    if (!load) { callback(null, {}); return; }
    load().then(module => callback(null, module.default), error => callback(error, false));
  },
};

i18n
  .use(localeBackend)
  .use(LanguageDetector) // Detect user language
  .use(initReactI18next) // Bind to React
  .init({
    resources: { de: { translation: de } },
    partialBundledLanguages: true,
    load: 'languageOnly',
    fallbackLng: 'de', // Default to German
    supportedLngs: SUPPORTED_LANGUAGES.map(lang => lang.code),

    interpolation: {
      escapeValue: false, // React already escapes
    },

    detection: {
      // Order of language detection
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'talea_language',
    },

    react: {
      useSuspense: true,
    },
  });

export default i18n;
