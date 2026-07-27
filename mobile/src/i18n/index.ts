import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import { storage, StorageKeys } from '@/lib/storage';

import de from './locales/de.json';
import en from './locales/en.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import it from './locales/it.json';
import nl from './locales/nl.json';
import ru from './locales/ru.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'de', name: 'Deutsch', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((language) => language.code) as readonly string[];

const resources = {
  de: { translation: de },
  en: { translation: en },
  fr: { translation: fr },
  es: { translation: es },
  it: { translation: it },
  nl: { translation: nl },
  ru: { translation: ru },
};

/** Device locale, narrowed to a language we actually ship. */
function detectDeviceLanguage(): SupportedLanguage {
  const locales = getLocales();
  for (const locale of locales) {
    const code = locale.languageCode?.toLowerCase();
    if (code && SUPPORTED_CODES.includes(code)) {
      return code as SupportedLanguage;
    }
  }
  return 'de';
}

/**
 * i18n is initialised synchronously with the device language so the very first
 * frame is already translated; the stored preference (if any) is applied a tick
 * later once AsyncStorage resolves.
 */
i18n.use(initReactI18next).init({
  resources,
  lng: detectDeviceLanguage(),
  fallbackLng: 'de',
  supportedLngs: SUPPORTED_CODES as string[],
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
  // React Native's Intl.PluralRules is available on Hermes; no polyfill needed.
  compatibilityJSON: undefined,
});

export async function restoreStoredLanguage(): Promise<void> {
  const stored = await storage.getString(StorageKeys.language);
  if (stored && SUPPORTED_CODES.includes(stored) && stored !== i18n.language) {
    await i18n.changeLanguage(stored);
  }
}

export async function persistLanguage(language: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(language);
  await storage.setString(StorageKeys.language, language);
}

/** Maps an app language to a BCP-47 tag for date/number formatting. */
export function dateLocaleFor(language: string): string {
  const map: Record<string, string> = {
    de: 'de-DE',
    en: 'en-GB',
    fr: 'fr-FR',
    es: 'es-ES',
    it: 'it-IT',
    nl: 'nl-NL',
    ru: 'ru-RU',
  };
  return map[language] ?? 'de-DE';
}

export default i18n;
