import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import de from './locales/de.json';
import en from './locales/en.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import it from './locales/it.json';
import nl from './locales/nl.json';
import ru from './locales/ru.json';

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

// Type-safe translation resources
const resources = {
  de: { translation: de },
  en: { translation: en },
  fr: { translation: fr },
  es: { translation: es },
  it: { translation: it },
  nl: { translation: nl },
  ru: { translation: ru },
};

i18n
  .use(LanguageDetector) // Detect user language
  .use(initReactI18next) // Bind to React
  .init({
    resources,
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
