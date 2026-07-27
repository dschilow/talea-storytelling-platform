import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useOptionalUserAccess } from './UserAccessProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { persistLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n';

const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((language) => language.code) as readonly string[];

/**
 * One-way sync of the server-side account preferences into the app on sign-in.
 *
 * Ported from frontend/hooks/useLanguageSync.ts and extended to cover the theme.
 * It applies once per session: after that the local choice wins, and the
 * Settings screen is what pushes changes back to the server. Without the
 * one-shot guard, a user toggling dark mode would be overwritten by the next
 * profile refresh.
 */
export function LanguageSync() {
  const { i18n } = useTranslation();
  const { serverLanguage, serverTheme } = useOptionalUserAccess();
  const { setPreference } = useTheme();

  const languageApplied = useRef(false);
  const themeApplied = useRef(false);

  useEffect(() => {
    if (languageApplied.current) return;
    if (!serverLanguage || !SUPPORTED_CODES.includes(serverLanguage)) return;

    languageApplied.current = true;
    if (serverLanguage !== i18n.language) {
      void persistLanguage(serverLanguage as SupportedLanguage);
    }
  }, [i18n.language, serverLanguage]);

  useEffect(() => {
    if (themeApplied.current) return;
    if (!serverTheme) return;

    themeApplied.current = true;
    setPreference(serverTheme);
  }, [serverTheme, setPreference]);

  return null;
}
